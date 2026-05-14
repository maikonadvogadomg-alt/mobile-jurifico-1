import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

type FileStatus = "idle" | "picking" | "processing" | "done" | "error";

interface PickedFile {
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
}

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(mimeType?: string, name?: string): "text" | "image" | "audio" | "other" {
  const m = (mimeType ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(n)) return "image";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac|flac|opus|wma)$/i.test(n)) return "audio";
  if (
    m.startsWith("text/") ||
    m.includes("html") || m.includes("xml") ||
    /\.(txt|html|htm|xml|md|csv|json|rtf|doc|docx)$/i.test(n)
  ) return "text";
  return "other";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function transcribeAudio(uri: string, mimeType: string, aiProviders: ReturnType<typeof useSettings>["aiProviders"]): Promise<string> {
  const active = aiProviders.find(p => p.isActive) ?? aiProviders[0];
  if (!active?.apiKey) throw new Error("Nenhum provedor de IA configurado.");

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

  // Build multipart form
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const name = "audio.m4a";

  const pre = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${name}"`,
    `Content-Type: ${mimeType || "audio/mpeg"}`,
    "",
    "",
  ].join("\r\n");
  const post = ["", `--${boundary}`, `Content-Disposition: form-data; name="model"`, "", "whisper-1", `--${boundary}`, `Content-Disposition: form-data; name="language"`, "", "pt", `--${boundary}--`].join("\r\n");

  // Groq has fastest whisper
  const baseUrl = active.type === "groq"
    ? "https://api.groq.com/openai/v1"
    : (active.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${active.apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: pre + base64 + post,
  });
  if (!res.ok) throw new Error(`Transcription error: HTTP ${res.status}`);
  const data = await res.json();
  return data.text ?? "";
}

async function ocrImage(uri: string, aiProviders: ReturnType<typeof useSettings>["aiProviders"]): Promise<string> {
  const active = aiProviders.find(p => p.isActive) ?? aiProviders[0];
  if (!active?.apiKey) throw new Error("Nenhum provedor de IA configurado.");

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const mimeType = uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  const msgs: AiMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "Faça OCR completo desta imagem. Extraia TODO o texto visível, mantendo a formatação original com quebras de linha. Se for um documento jurídico, mantenha a estrutura dos parágrafos." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
      ] as any,
    },
  ];
  return callAI(msgs, aiProviders);
}

async function processTextFile(uri: string, mimeType?: string): Promise<string> {
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: "utf8" });
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("html") || uri.endsWith(".html") || uri.endsWith(".htm")) return stripHtml(raw);
  return raw;
}

async function aiExtractText(uri: string, fileName: string, aiProviders: ReturnType<typeof useSettings>["aiProviders"]): Promise<string> {
  // For unknown/binary types: attempt base64 + ask AI to parse
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const msgs: AiMessage[] = [
    { role: "system", content: "Você é um extrator de texto. Extraia e apresente todo o conteúdo textual do arquivo. Se houver formatação jurídica (petições, contratos, decisões), preserve a estrutura." },
    { role: "user", content: `Arquivo: ${fileName}\nConteúdo base64 (primeiros 8000 chars): ${base64.slice(0, 8000)}\n\nExtraia o texto completo.` },
  ];
  return callAI(msgs, aiProviders);
}

export default function ImportadorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [status, setStatus] = useState<FileStatus>("idle");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const handlePick = useCallback(async () => {
    try {
      setStatus("picking");
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) { setStatus("idle"); return; }
      const asset = res.assets[0];
      if (asset.size && asset.size > 150 * 1024 * 1024) {
        Alert.alert("Arquivo muito grande", "Limite de 150 MB.");
        setStatus("idle"); return;
      }
      setFile({ name: asset.name, size: asset.size, mimeType: asset.mimeType, uri: asset.uri });
      setResult(null);
      setErrorMsg(null);
      setStatus("idle");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      setStatus("error"); setErrorMsg(e.message ?? "Erro ao selecionar arquivo.");
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    setStatus("processing");
    setResult(null);
    setErrorMsg(null);

    try {
      const category = getFileCategory(file.mimeType, file.name);
      let text = "";

      if (category === "audio") {
        setProgress("Transcrevendo áudio com Whisper...");
        if (!aiProviders.length) throw new Error("Configure um provedor de IA que suporte Whisper (Groq ou OpenAI).");
        text = await transcribeAudio(file.uri, file.mimeType ?? "audio/mpeg", aiProviders);
      } else if (category === "image") {
        setProgress("Executando OCR com IA...");
        if (!aiProviders.length) throw new Error("Configure um provedor de IA com suporte a visão (OpenAI, Gemini, Anthropic).");
        text = await ocrImage(file.uri, aiProviders);
      } else if (category === "text") {
        setProgress("Lendo arquivo...");
        text = await processTextFile(file.uri, file.mimeType);
      } else {
        setProgress("Extraindo texto com IA...");
        if (!aiProviders.length) throw new Error("Configure um provedor de IA para processar este tipo de arquivo.");
        text = await aiExtractText(file.uri, file.name, aiProviders);
      }

      setResult(text);
      setStatus("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message ?? "Erro ao processar arquivo.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setProgress(""); }
  }, [file, aiProviders]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copiado", "Texto copiado para a área de transferência.");
  }, [result]);

  const handleOpenEditor = useCallback(() => {
    if (!result) return;
    router.push({ pathname: "/editor", params: { content: result.slice(0, 8000), title: file?.name ?? "Importado" } } as any);
  }, [result, file, router]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const category = file ? getFileCategory(file.mimeType, file.name) : null;

  const CATEGORY_ICONS: Record<string, string> = { image: "image", audio: "mic", text: "file-text", other: "file" };
  const CATEGORY_LABELS: Record<string, string> = { image: "Imagem (OCR)", audio: "Áudio (Transcrição)", text: "Texto/HTML", other: "Outro (IA)" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Importar Arquivo</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>PDF · HTML · Imagem OCR · Áudio → texto</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pick button */}
        <TouchableOpacity
          style={[styles.pickBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary, borderStyle: "dashed" }]}
          onPress={handlePick}
          disabled={status === "processing"}
          activeOpacity={0.8}
        >
          <Feather name="upload" size={28} color={colors.primary} />
          <Text style={[styles.pickTitle, { color: colors.primary }]}>Selecionar Arquivo</Text>
          <Text style={[styles.pickSub, { color: colors.mutedForeground }]}>
            PDF, TXT, HTML, DOCX, JPG, PNG, MP3, WAV, M4A...{"\n"}Até 150 MB
          </Text>
        </TouchableOpacity>

        {/* File info */}
        {file && (
          <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.fileIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name={(CATEGORY_ICONS[category!] ?? "file") as any} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={2}>{file.name}</Text>
              <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                {formatSize(file.size)} · {CATEGORY_LABELS[category!] ?? "Desconhecido"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setFile(null); setResult(null); setStatus("idle"); }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Info box about processing method */}
        {file && status !== "processing" && !result && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>
                {category === "audio" ? "Transcrição de Áudio" :
                 category === "image" ? "OCR por IA" :
                 category === "text" ? "Leitura Direta" : "Extração por IA"}
              </Text>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                {category === "audio" ? "O áudio será transcrito usando Whisper (Groq ou OpenAI). Suporta português, inglês e outros idiomas." :
                 category === "image" ? "A imagem será enviada para IA com visão (GPT-4V, Gemini, Claude) para extração completa do texto." :
                 category === "text" ? "O arquivo será lido diretamente. HTML terá as tags removidas." : "O arquivo será processado pela IA para extração do conteúdo textual."}
              </Text>
            </View>
          </View>
        )}

        {/* Process button */}
        {file && status !== "processing" && !result && (
          <TouchableOpacity
            style={[styles.processBtn, { backgroundColor: colors.primary }]}
            onPress={handleProcess}
            activeOpacity={0.85}
          >
            <Feather name="cpu" size={18} color={colors.primaryForeground} />
            <Text style={[styles.processBtnText, { color: colors.primaryForeground }]}>Processar Arquivo</Text>
          </TouchableOpacity>
        )}

        {/* Processing */}
        {status === "processing" && (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.mutedForeground }]}>{progress || "Processando..."}</Text>
          </View>
        )}

        {/* Error */}
        {status === "error" && errorMsg && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "40" }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={{ gap: 10 }}>
            <View style={[styles.resultHeader, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
              <Feather name="check-circle" size={15} color={colors.success} />
              <Text style={[styles.resultHeaderText, { color: colors.success }]}>
                Texto extraído — {result.length.toLocaleString()} caracteres
              </Text>
            </View>

            <View style={styles.resultActions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleOpenEditor}>
                <Feather name="edit-3" size={15} color={colors.primaryForeground} />
                <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Abrir no Editor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]} onPress={handleCopy}>
                <Feather name="copy" size={15} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Copiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]} onPress={() => { setResult(null); setStatus("idle"); }}>
                <Feather name="refresh-cw" size={15} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.resultBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.resultText, { color: colors.foreground }]} selectable>
                {result}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  body: { padding: 16, gap: 12 },
  pickBtn: { alignItems: "center", justifyContent: "center", gap: 8, padding: 28, borderRadius: 14, borderWidth: 2 },
  pickTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  pickSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  fileCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  fileIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fileName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fileMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  processBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 15, borderRadius: 12 },
  processBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  processingBox: { alignItems: "center", gap: 12, paddingVertical: 32 },
  processingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  resultHeaderText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultActions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultBox: { borderRadius: 12, borderWidth: 1, padding: 14, maxHeight: 400 },
  resultText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 21 },
});
