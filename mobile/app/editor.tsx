import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Paths, File as FSFile, writeAsStringAsync } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as Speech from "expo-speech";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { callAI, buildLegalPrompt, getProviderName, LEGAL_ACTIONS, type LegalActionId } from "@/lib/ai-service";
import { formatLegalText, type FormattedLine } from "@/lib/legal-formatter";
import { getDocument, saveDocument, saveAiHistory, getAiHistory, type Document, type AiHistoryEntry } from "@/lib/sqlite-service";
import { useSettings } from "@/contexts/SettingsContext";

// ─── Document templates ─────────────────────────────────────────────────────
const TEMPLATES: { label: string; icon: string; content: string }[] = [
  {
    label: "Petição Inicial",
    icon: "file-text",
    content: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE ___

NOME DO AUTOR, [qualificação completa], por seu advogado abaixo assinado, vem propor

AÇÃO DE ___

em face de NOME DO RÉU, [qualificação], pelos fatos e fundamentos a seguir expostos:

I – DOS FATOS

[Descreva os fatos de forma cronológica e detalhada]

II – DO DIREITO

[Fundamente juridicamente o pedido citando leis e jurisprudência]

III – DOS PEDIDOS

Ante o exposto, requer a Vossa Excelência:

a) a procedência total dos pedidos;
b) a condenação do réu ao pagamento das custas processuais e honorários advocatícios;
c) a citação do réu para contestar.

Dá à causa o valor de R$ ___

Nestes termos, pede deferimento.

[Cidade], [Data]

___________________________
[NOME DO ADVOGADO]
OAB/__ nº ___`,
  },
  {
    label: "Recurso de Apelação",
    icon: "corner-up-right",
    content: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA

Processo nº ___

NOME DO RECORRENTE, já qualificado nos autos, vem, por seu advogado, interpor

RECURSO DE APELAÇÃO

contra a sentença de fls. ___, pelos seguintes fundamentos:

I – CABIMENTO E TEMPESTIVIDADE

O recurso é cabível nos termos do art. 1.009 do CPC e tempestivo, sendo interposto dentro do prazo legal de 15 dias.

II – DO MÉRITO RECURSAL

A sentença recorrida merece reforma pelos seguintes fundamentos:

[Fundamentos do recurso]

III – DAS RAZÕES

[Argumentação detalhada]

IV – DO PEDIDO

Requer seja conhecido e provido o presente recurso para reformar a sentença recorrida.

[Cidade], [Data]

___________________________
[NOME DO ADVOGADO]
OAB/__ nº ___`,
  },
  {
    label: "Contrato de Prestação",
    icon: "edit",
    content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: [nome, CPF/CNPJ, endereço]
CONTRATADO: [nome, CPF/CNPJ, endereço]

As partes acima qualificadas celebram o presente contrato, regido pelas cláusulas seguintes:

CLÁUSULA PRIMEIRA – DO OBJETO

O presente contrato tem por objeto a prestação dos seguintes serviços: ___

CLÁUSULA SEGUNDA – DO PRAZO

O contrato terá vigência de ___ meses, a contar da data de sua assinatura.

CLÁUSULA TERCEIRA – DO VALOR E PAGAMENTO

Pelo objeto contratado, o CONTRATANTE pagará ao CONTRATADO o valor de R$ ___, na forma de ___.

CLÁUSULA QUARTA – DAS OBRIGAÇÕES

O CONTRATADO obriga-se a: ___
O CONTRATANTE obriga-se a: ___

CLÁUSULA QUINTA – DA RESCISÃO

O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

CLÁUSULA SEXTA – DO FORO

As partes elegem o foro da Comarca de ___ para dirimir eventuais controvérsias.

[Cidade], [Data]

___________________________          ___________________________
CONTRATANTE                           CONTRATADO`,
  },
  {
    label: "Parecer Jurídico",
    icon: "book-open",
    content: `PARECER JURÍDICO

CONSULENTE: [nome]
ASSUNTO: [tema]
DATA: [data]

I – CONSULTA

[Descreva a consulta formulada]

II – SÍNTESE DOS FATOS

[Resumo dos fatos relevantes]

III – DO DIREITO APLICÁVEL

[Análise das normas jurídicas aplicáveis]

IV – DA JURISPRUDÊNCIA

[Cite jurisprudência relevante]

V – CONCLUSÃO

Ante o exposto, é o parecer.

[Cidade], [Data]

___________________________
[NOME DO ADVOGADO]
OAB/__ nº ___`,
  },
  {
    label: "Habeas Corpus",
    icon: "shield",
    content: `EXCELENTÍSSIMO(A) SENHOR(A) DESEMBARGADOR(A) PRESIDENTE DO EGRÉGIO TRIBUNAL DE JUSTIÇA

IMPETRANTE: [nome e qualificação do advogado]
PACIENTE: [nome e qualificação]
AUTORIDADE COATORA: [nome e cargo]

Vem o impetrante, com fundamento no art. 5º, LXVIII, da Constituição Federal e art. 647 do CPP, impetrar

HABEAS CORPUS

em favor do paciente, pelos fundamentos a seguir expostos:

I – DOS FATOS

[Descrição dos fatos]

II – DO DIREITO

[Fundamentos jurídicos]

III – DO PEDIDO LIMINAR

Requer, liminarmente, a concessão da ordem para [pedido liminar].

IV – DO MÉRITO

Requer seja concedida a ordem de habeas corpus para [pedido principal].

[Cidade], [Data]

___________________________
[NOME DO ADVOGADO/IMPETRANTE]
OAB/__ nº ___`,
  },
  {
    label: "Em Branco",
    icon: "plus",
    content: "",
  },
];

// ─── Formatting helpers ──────────────────────────────────────────────────────
const AREAS = ["geral", "civil", "trabalhista", "penal", "tributario", "administrativo", "consumidor"];
const AREA_LABELS: Record<string, string> = {
  geral: "Geral", civil: "Civil", trabalhista: "Trabalhista",
  penal: "Penal", tributario: "Tributário", administrativo: "Adm.", consumidor: "Consumidor",
};
const ACTION_COLORS: Record<string, string> = {
  minuta: "#1B3A6B", revisar: "#16A34A", refinar: "#D97706",
  resumir: "#7C3AED", simplificar: "#0891B2", analisar: "#DC2626",
  "modo-estrito": "#374151",
};

type EditorMode = "edit" | "preview";

function FormattedDocument({ lines, colors }: { lines: FormattedLine[]; colors: ReturnType<typeof useColors> }) {
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {lines.map((line, i) => {
        if (line.type === "empty") return <View key={i} style={{ height: 10 }} />;
        const style = getLineStyle(line.type);
        return (
          <Text key={i} style={[styles.docLine, style, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
            {line.text}
          </Text>
        );
      })}
    </ScrollView>
  );
}

function getLineStyle(type: FormattedLine["type"]) {
  switch (type) {
    case "title-center":
      return { textAlign: "center" as const, fontFamily: "Inter_700Bold", textTransform: "uppercase" as const, marginVertical: 6 };
    case "title-justify":
      return { textAlign: "justify" as const, fontFamily: "Inter_700Bold", textTransform: "uppercase" as const, marginVertical: 6 };
    case "citation":
      return { marginHorizontal: 32, fontSize: 13, fontStyle: "italic" as const, textAlign: "justify" as const, marginVertical: 3 };
    case "closing":
      return { textAlign: "justify" as const, marginVertical: 4 };
    case "paragraph":
      return { textAlign: "justify" as const, paddingLeft: 40, marginVertical: 2 } as any;
    default:
      return {};
  }
}

// ─── Word/HTML export ────────────────────────────────────────────────────────
function buildWordHtml(title: string, content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split("\n").map(line => {
      if (!line.trim()) return "<p style='margin:0;height:10pt'>&nbsp;</p>";
      const upper = line.trim().toUpperCase();
      if (upper === line.trim() && line.trim().length < 80)
        return `<p style='text-align:center;font-weight:bold;text-transform:uppercase;margin:6pt 0'>${line}</p>`;
      return `<p style='text-indent:4cm;text-align:justify;margin:3pt 0;line-height:1.8'>${line}</p>`;
    }).join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 2cm 3cm; color: #000; }
  p { margin: 0.3em 0; }
</style>
</head>
<body>
<h1 style='text-align:center;font-size:14pt;text-transform:uppercase;margin-bottom:16pt'>${title}</h1>
${escaped}
</body>
</html>`;
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function EditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { aiProviders } = useSettings();
  const { docId, content: paramContent, title: paramTitle } = useLocalSearchParams<{ docId?: string; content?: string; title?: string }>();

  // Core document state
  const [title, setTitle] = useState("Novo Documento");
  const [content, setContent] = useState("");
  const [area, setArea] = useState("geral");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [docIdState, setDocIdState] = useState<string | undefined>(docId);
  const [saving, setSaving] = useState(false);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Modals
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Context panel state
  const [jurisprudencia, setJurisprudencia] = useState("");
  const [promptExtra, setPromptExtra] = useState("");
  const [recentHistory, setRecentHistory] = useState<AiHistoryEntry[]>([]);

  const contentRef = useRef(content);
  contentRef.current = content;

  // Load document or param content
  useEffect(() => {
    if (docId) {
      const doc = getDocument(db, docId);
      if (doc) { setTitle(doc.title); setContent(doc.content); setArea(doc.area); setDocIdState(doc.id); }
    } else if (paramContent) {
      setContent(paramContent);
      if (paramTitle) setTitle(paramTitle.replace(/\.[^.]+$/, ""));
    }
  }, [docId, db, paramContent, paramTitle]);

  // Load recent AI history
  useEffect(() => {
    const h = getAiHistory(db, 8);
    setRecentHistory(h);
  }, [db]);

  const refreshHistory = useCallback(() => {
    setRecentHistory(getAiHistory(db, 8));
  }, [db]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { Alert.alert("Atenção", "Informe um título para o documento."); return; }
    setSaving(true);
    try {
      const saved = saveDocument(db, { id: docIdState, title: title.trim(), content, area });
      setDocIdState(saved.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally { setSaving(false); }
  }, [db, docIdState, title, content, area]);

  const handleAiAction = useCallback(async (actionId: LegalActionId) => {
    setShowActions(false);
    const text = contentRef.current.trim();
    if (!text && actionId !== "minuta") {
      Alert.alert("Atenção", "Escreva algo no documento antes de usar esta ação.");
      return;
    }

    setAiLoading(true);
    const actionLabel = LEGAL_ACTIONS.find(a => a.id === actionId)?.label ?? actionId;
    setAiStatus(`${actionLabel}...`);

    try {
      // Build context from jurisprudência + extra prompt + title
      const contextParts: string[] = [];
      if (jurisprudencia.trim()) contextParts.push(`JURISPRUDÊNCIA APLICÁVEL:\n${jurisprudencia.trim()}`);
      if (promptExtra.trim()) contextParts.push(`INSTRUÇÕES ADICIONAIS:\n${promptExtra.trim()}`);
      if (!text && title.trim()) contextParts.push(`TEMA: ${title.trim()}`);
      const context = contextParts.length ? contextParts.join("\n\n") : undefined;

      const messages = buildLegalPrompt(actionId, text || title, context);
      const result = await callAI(messages, aiProviders);

      saveAiHistory(db, {
        action: actionId,
        input_preview: (text || title).slice(0, 200),
        result,
        model: "",
        provider: getProviderName(aiProviders),
      });

      setContent(result);
      refreshHistory();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Erro de IA", msg);
    } finally { setAiLoading(false); setAiStatus(""); }
  }, [aiProviders, db, title, jurisprudencia, promptExtra, refreshHistory]);

  const handleToggleSpeech = useCallback(() => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      const text = contentRef.current.trim();
      if (!text) { Alert.alert("Atenção", "Sem conteúdo para ler em voz alta."); return; }
      setIsSpeaking(true);
      Speech.speak(text, {
        language: "pt-BR", rate: 0.88, pitch: 1.0,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    }
  }, [isSpeaking]);

  const handleExport = useCallback(async () => {
    if (!content.trim()) { Alert.alert("Atenção", "Documento vazio."); return; }
    try {
      const html = buildWordHtml(title, content);
      const safeName = title.trim().replace(/[^a-z0-9\-_]/gi, "_").slice(0, 40) || "documento";
      const fileName = `${safeName}_${Date.now()}.html`;

      // expo-file-system v55 — use Paths.cache + writeAsStringAsync
      const cacheUri = Paths.cache.uri.replace(/\/?$/, "/");
      const filePath = `${cacheUri}${fileName}`;
      await writeAsStringAsync(filePath, html, { encoding: "utf8" } as any);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/html",
          dialogTitle: "Exportar documento",
          UTI: "public.html",
        });
      } else {
        await Clipboard.setStringAsync(content);
        Alert.alert("Copiado", "Texto copiado para a área de transferência (compartilhamento não disponível neste dispositivo).");
      }
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e.message);
    }
  }, [title, content]);

  const handleApplyTemplate = useCallback((t: typeof TEMPLATES[0]) => {
    if (content.trim()) {
      Alert.alert("Substituir conteúdo?", "O conteúdo atual será substituído pelo template.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Substituir", style: "destructive", onPress: () => { setContent(t.content); setShowTemplates(false); } },
      ]);
    } else {
      setContent(t.content);
      setShowTemplates(false);
    }
  }, [content]);

  const handleReuseHistory = useCallback((entry: AiHistoryEntry) => {
    Alert.alert("Restaurar resultado?", "Substituir o conteúdo atual pelo resultado desta ação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Restaurar",
        onPress: () => {
          setContent(entry.result);
          if (entry.action === "minuta" || entry.action === "refinar") setMode("preview");
          setShowHistory(false);
        },
      },
    ]);
  }, []);

  const formattedLines = formatLegalText(content);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const hasContext = jurisprudencia.trim().length > 0 || promptExtra.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TextInput
          style={[styles.titleInput, { color: colors.foreground }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Título do documento"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
        />

        <TouchableOpacity onPress={handleExport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="share" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.primaryForeground} />
            : <Feather name="save" size={16} color={colors.primaryForeground} />
          }
        </TouchableOpacity>
      </View>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <View style={[styles.toolbar, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
        {/* Mode chips */}
        <TouchableOpacity
          style={[styles.toolChip, { backgroundColor: mode === "edit" ? colors.primary : "transparent", borderColor: colors.border }]}
          onPress={() => setMode("edit")}
        >
          <Feather name="edit-3" size={13} color={mode === "edit" ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.toolChipText, { color: mode === "edit" ? colors.primaryForeground : colors.mutedForeground }]}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolChip, { backgroundColor: mode === "preview" ? colors.primary : "transparent", borderColor: colors.border }]}
          onPress={() => setMode("preview")}
        >
          <Feather name="eye" size={13} color={mode === "preview" ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.toolChipText, { color: mode === "preview" ? colors.primaryForeground : colors.mutedForeground }]}>Prévia</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Template */}
        <TouchableOpacity
          style={[styles.toolChip, { backgroundColor: "transparent", borderColor: colors.border }]}
          onPress={() => setShowTemplates(true)}
        >
          <Feather name="layout" size={13} color={colors.accent} />
          <Text style={[styles.toolChipText, { color: colors.foreground }]}>Modelo</Text>
        </TouchableOpacity>

        {/* Context (jurisprudência + prompt extra) */}
        <TouchableOpacity
          style={[styles.toolChip, { backgroundColor: hasContext ? colors.accent + "25" : "transparent", borderColor: hasContext ? colors.accent : colors.border }]}
          onPress={() => setShowContext(true)}
        >
          <Feather name="layers" size={13} color={hasContext ? colors.accent : colors.mutedForeground} />
          <Text style={[styles.toolChipText, { color: hasContext ? colors.accent : colors.mutedForeground }]}>Contexto</Text>
        </TouchableOpacity>

        {/* Area */}
        <TouchableOpacity
          style={[styles.toolChip, { backgroundColor: "transparent", borderColor: colors.border }]}
          onPress={() => setShowAreaPicker(true)}
        >
          <Feather name="tag" size={13} color={colors.mutedForeground} />
          <Text style={[styles.toolChipText, { color: colors.foreground }]}>{AREA_LABELS[area]}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* TTS */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: isSpeaking ? "#E53935" : colors.secondary, borderColor: isSpeaking ? "#E53935" : colors.border }]}
          onPress={handleToggleSpeech}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Feather name={isSpeaking ? "volume-x" : "volume-2"} size={14} color={isSpeaking ? "#fff" : colors.foreground} />
        </TouchableOpacity>

        {/* History */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => setShowHistory(true)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Feather name="clock" size={14} color={colors.foreground} />
        </TouchableOpacity>

        {/* IA */}
        <TouchableOpacity
          style={[styles.aiBtn, { backgroundColor: aiLoading ? colors.muted : colors.accent }]}
          onPress={() => setShowActions(true)}
          disabled={aiLoading}
          activeOpacity={0.8}
        >
          {aiLoading
            ? <ActivityIndicator size="small" color={colors.accentForeground} />
            : <Feather name="zap" size={14} color={colors.accentForeground} />
          }
          <Text style={[styles.aiBtnText, { color: colors.accentForeground }]}>
            {aiLoading ? aiStatus : "IA"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Context strip (jurisprudência indicator) ───────────────────────── */}
      {hasContext && (
        <TouchableOpacity
          style={[styles.contextStrip, { backgroundColor: colors.accent + "15", borderBottomColor: colors.accent + "40" }]}
          onPress={() => setShowContext(true)}
        >
          <Feather name="layers" size={12} color={colors.accent} />
          <Text style={[styles.contextStripText, { color: colors.accent }]}>
            Contexto ativo:{jurisprudencia.trim() ? " jurisprudência" : ""}{jurisprudencia.trim() && promptExtra.trim() ? " +" : ""}{promptExtra.trim() ? " instruções extras" : ""}
          </Text>
          <Feather name="edit-2" size={11} color={colors.accent} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      )}

      {/* ── Editor area ────────────────────────────────────────────────────── */}
      <View style={[styles.editorArea, { backgroundColor: colors.card }]}>
        {mode === "edit" ? (
          <TextInput
            testID="editor-input"
            style={[styles.textInput, { color: colors.foreground }]}
            multiline
            value={content}
            onChangeText={setContent}
            placeholder="Digite o conteúdo, selecione um modelo ou use a IA para gerar uma minuta..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
            scrollEnabled
          />
        ) : (
          <View style={{ flex: 1, padding: 16 }}>
            <FormattedDocument lines={formattedLines} colors={colors} />
          </View>
        )}
      </View>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* ── Template picker ────────────────────────────────────────────────── */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTemplates(false)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Modelos de Documento</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>Selecione um modelo para iniciar</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.label}
                  style={[styles.templateItem, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                  onPress={() => handleApplyTemplate(t)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.templateIconBox, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name={t.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateItemTitle, { color: colors.foreground }]}>{t.label}</Text>
                    {t.content ? (
                      <Text style={[styles.templateItemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {t.content.slice(0, 60)}...
                      </Text>
                    ) : (
                      <Text style={[styles.templateItemSub, { color: colors.mutedForeground }]}>Documento em branco</Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Context panel (jurisprudência + prompt extra) ────────────────────── */}
      <Modal visible={showContext} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowContext(false)}>
        <KeyboardAvoidingView style={[styles.fullModal, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowContext(false)}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Contexto para IA</Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: hasContext ? colors.primary : colors.muted }]}
              onPress={() => setShowContext(false)}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Aplicar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.contextBody} keyboardShouldPersistTaps="handled">
            {/* Jurisprudência */}
            <View style={styles.contextSection}>
              <View style={styles.contextLabelRow}>
                <Feather name="book" size={14} color={colors.accent} />
                <Text style={[styles.contextLabel, { color: colors.foreground }]}>Jurisprudência</Text>
                {jurisprudencia.trim() && (
                  <TouchableOpacity onPress={() => setJurisprudencia("")} style={{ marginLeft: "auto" }}>
                    <Text style={[styles.clearBtn, { color: colors.destructive }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.contextHint, { color: colors.mutedForeground }]}>
                Cole ementas, súmulas ou acórdãos que a IA deve incluir/respeitar na geração.
              </Text>
              <TextInput
                style={[styles.contextInput, { backgroundColor: colors.card, borderColor: jurisprudencia.trim() ? colors.accent : colors.border, color: colors.foreground }]}
                value={jurisprudencia}
                onChangeText={setJurisprudencia}
                multiline
                textAlignVertical="top"
                placeholder={"Ex: STJ — Súmula 385: Da anotação irregular em cadastro de proteção ao crédito...\n\nOu cole aqui o texto de qualquer decisão relevante."}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Prompt extra */}
            <View style={styles.contextSection}>
              <View style={styles.contextLabelRow}>
                <Feather name="message-square" size={14} color={colors.primary} />
                <Text style={[styles.contextLabel, { color: colors.foreground }]}>Instruções Adicionais</Text>
                {promptExtra.trim() && (
                  <TouchableOpacity onPress={() => setPromptExtra("")} style={{ marginLeft: "auto" }}>
                    <Text style={[styles.clearBtn, { color: colors.destructive }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.contextHint, { color: colors.mutedForeground }]}>
                Instruções específicas para a IA: tom, extensão, partes do processo, argumentos a usar, etc.
              </Text>
              <TextInput
                style={[styles.contextInput, { backgroundColor: colors.card, borderColor: promptExtra.trim() ? colors.primary : colors.border, color: colors.foreground }]}
                value={promptExtra}
                onChangeText={setPromptExtra}
                multiline
                textAlignVertical="top"
                placeholder={"Ex: Incluir argumentos baseados na boa-fé objetiva do CC/02.\nManter tom formal mas objetivo.\nFocar no dano moral, não no material."}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Quick tips */}
            <View style={[styles.tipsBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.tipsTitle, { color: colors.foreground }]}>Como usar o Contexto</Text>
              <Text style={[styles.tipsText, { color: colors.mutedForeground }]}>
                1. Cole a jurisprudência que fundamenta seu caso — a IA citará e usará nas peças geradas.{"\n"}
                2. Use Instruções para guiar a IA: "Petição de 3 laudas", "Incluir dano estético", etc.{"\n"}
                3. O contexto é enviado junto com TODA ação de IA (Gerar Minuta, Refinar, Revisar...).{"\n"}
                4. Para limpar, toque em "Limpar" acima de cada campo.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── AI Actions Modal ───────────────────────────────────────────────── */}
      <Modal visible={showActions} transparent animationType="slide" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Ações de IA</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              Provedor: {getProviderName(aiProviders)}{hasContext ? " · Contexto ativo" : ""}
            </Text>
            <FlatList
              data={LEGAL_ACTIONS}
              keyExtractor={(a) => a.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1, borderLeftWidth: 3, borderLeftColor: ACTION_COLORS[item.id] ?? colors.accent }]}
                  onPress={() => handleAiAction(item.id)}
                  activeOpacity={0.8}
                >
                  <Feather name="zap" size={16} color={ACTION_COLORS[item.id] ?? colors.accent} />
                  <Text style={[styles.actionCardTitle, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.actionCardSub, { color: colors.mutedForeground }]}>{item.description}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── AI History Modal ───────────────────────────────────────────────── */}
      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHistory(false)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16, maxHeight: "80%" }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Histórico de Prompts</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>Toque para restaurar um resultado anterior</Text>
            {recentHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Feather name="clock" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyHistoryText, { color: colors.mutedForeground }]}>Nenhuma ação de IA registrada ainda.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {recentHistory.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={[styles.historyItem, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                    onPress={() => handleReuseHistory(entry)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.historyBadge, { backgroundColor: (ACTION_COLORS[entry.action] ?? colors.primary) + "20" }]}>
                      <Text style={[styles.historyBadgeText, { color: ACTION_COLORS[entry.action] ?? colors.primary }]}>
                        {entry.action.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyPreview, { color: colors.foreground }]} numberOfLines={2}>
                        {entry.result.slice(0, 100)}
                      </Text>
                      <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                        {new Date(entry.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {entry.provider ? ` · ${entry.provider}` : ""}
                      </Text>
                    </View>
                    <Feather name="rotate-ccw" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Area Picker Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAreaPicker} transparent animationType="fade" onRequestClose={() => setShowAreaPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAreaPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Área Jurídica</Text>
            {AREAS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.pickerItem, { borderColor: colors.border, backgroundColor: area === a ? colors.secondary : "transparent" }]}
                onPress={() => { setArea(a); setShowAreaPicker(false); }}
              >
                {area === a && <Feather name="check" size={14} color={colors.primary} />}
                <Text style={[styles.pickerText, { color: colors.foreground, marginLeft: area === a ? 6 : 20 }]}>{AREA_LABELS[a]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1,
  },
  titleInput: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", padding: 0 },
  saveBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  toolbar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 6, gap: 4, borderBottomWidth: 1,
  },
  toolChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1,
  },
  toolChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  divider: { width: 1, height: 20, marginHorizontal: 2 },
  iconBtn: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  aiBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  aiBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  contextStrip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1,
  },
  contextStripText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  editorArea: { flex: 1 },
  textInput: {
    flex: 1, padding: 16, fontSize: 15,
    fontFamily: "Inter_400Regular", lineHeight: 26,
  },
  docLine: { fontSize: 14, lineHeight: 22, marginBottom: 2 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  actionSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
  actionCard: { padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  actionCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },

  // Templates
  templateItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  templateIconBox: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  templateItemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  templateItemSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Context modal
  fullModal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  doneBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  contextBody: { padding: 16, gap: 20, paddingBottom: 40 },
  contextSection: { gap: 6 },
  contextLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  contextLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  contextHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  contextInput: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, minHeight: 120 },
  clearBtn: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tipsBox: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
  tipsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tipsText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  // History
  emptyHistory: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyHistoryText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  historyPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },

  // Area picker
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 2 },
  pickerItem: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "transparent", marginBottom: 4 },
  pickerText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
