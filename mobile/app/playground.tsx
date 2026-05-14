import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

// WebView is native-only — conditionally import
let WebView: React.ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}
}

const TEMPLATES = [
  {
    label: "Petição Simples",
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial,sans-serif;font-size:12pt;margin:2cm;line-height:1.8}
h1{text-align:center;font-size:14pt;text-transform:uppercase}
p{text-indent:4cm;text-align:justify;margin:0.5em 0}
.assinatura{text-align:center;margin-top:3em}</style></head><body>
<h1>EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO</h1>
<p><strong>FULANO DE TAL</strong>, brasileiro, CPF nº 000.000.000-00, por meio de seu advogado que esta subscreve, vem propor a presente</p>
<h1>AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS</h1>
<p>em face de <strong>EMPRESA XYZ LTDA</strong>, pelos fatos e fundamentos expostos:</p>
<h1>I – DOS FATOS</h1><p>Descreva os fatos aqui...</p>
<h1>II – DO DIREITO</h1><p>Fundamente juridicamente aqui...</p>
<h1>III – DOS PEDIDOS</h1>
<p>Ante o exposto, requer a Vossa Excelência a procedência total dos pedidos.</p>
<div class="assinatura"><p>Cidade, ${new Date().toLocaleDateString("pt-BR")}</p><br><br>
<p>____________________________<br>Advogado(a) OAB/UF nº 000.000</p></div>
</body></html>`,
  },
  {
    label: "Contrato Simples",
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial,sans-serif;font-size:12pt;margin:2cm;line-height:1.8}
h1{text-align:center;font-size:13pt;text-transform:uppercase;margin:1em 0}
p{text-indent:4cm;text-align:justify;margin:0.4em 0}</style></head><body>
<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p><strong>CONTRATANTE:</strong> Nome, CPF/CNPJ, endereço.</p>
<p><strong>CONTRATADO:</strong> Nome, CPF/CNPJ, endereço.</p>
<h1>CLÁUSULA PRIMEIRA — DO OBJETO</h1>
<p>O presente contrato tem por objeto a prestação de serviços de _______________.</p>
<h1>CLÁUSULA SEGUNDA — DO PRAZO</h1>
<p>O presente contrato terá vigência de ___ meses.</p>
<h1>CLÁUSULA TERCEIRA — DO VALOR</h1>
<p>O CONTRATANTE pagará ao CONTRATADO o valor de R$ _____.</p>
<p style="text-align:center;text-indent:0;margin-top:2em">Cidade, ${new Date().toLocaleDateString("pt-BR")}</p>
<p style="text-align:center;text-indent:0">____________________________<br>CONTRATANTE</p><br>
<p style="text-align:center;text-indent:0">____________________________<br>CONTRATADO</p>
</body></html>`,
  },
  {
    label: "Em branco",
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial,sans-serif;font-size:12pt;margin:2cm;line-height:1.8}
p{text-indent:4cm;text-align:justify}</style></head><body>
<p>Escreva aqui...</p></body></html>`,
  },
];

export default function PlaygroundScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [html, setHtml] = useState(TEMPLATES[0].html);
  const [showEditor, setShowEditor] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (!aiProviders.length) { Alert.alert("Sem IA", "Configure um provedor de IA."); return; }
    setAiLoading(true);
    try {
      const msgs: AiMessage[] = [
        { role: "system", content: "Você é um assistente jurídico especializado. Gere documentos jurídicos em HTML válido com formatação ABNT: parágrafos com recuo de 4cm (text-indent:4cm), texto justificado, títulos em caixa alta centralizados. Retorne APENAS o HTML completo, sem markdown ou comentários." },
        { role: "user", content: `Gere um documento jurídico em HTML para: ${aiPrompt}` },
      ];
      const result = await callAI(msgs, aiProviders);
      const cleanHtml = result.replace(/```html\n?/gi, "").replace(/```\n?/gi, "").trim();
      setHtml(cleanHtml);
      setAiPrompt("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally { setAiLoading(false); }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Playground</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Preview HTML + IA jurídica</Text>
        </View>
        <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => setShowEditor(true)}>
          <Feather name="edit-2" size={15} color={colors.foreground} />
          <Text style={[styles.editBtnText, { color: colors.foreground }]}>HTML</Text>
        </TouchableOpacity>
      </View>

      {/* AI prompt bar */}
      <View style={[styles.aiBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <TextInput
          style={[styles.aiInput, { color: colors.foreground }]}
          value={aiPrompt} onChangeText={setAiPrompt}
          placeholder="Descreva o documento a gerar com IA..."
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="send" onSubmitEditing={handleGenerate}
        />
        <TouchableOpacity style={[styles.aiBtn, { backgroundColor: aiLoading ? colors.muted : colors.primary }]} onPress={handleGenerate} disabled={aiLoading}>
          <Feather name={aiLoading ? "loader" : "zap"} size={16} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Templates */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.templateRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {TEMPLATES.map(t => (
          <TouchableOpacity key={t.label} style={[styles.templateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => setHtml(t.html)}>
            <Text style={[styles.templateChipText, { color: colors.foreground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Preview area */}
      {WebView && Platform.OS !== "web" ? (
        <WebView
          source={{ html, baseUrl: "" }}
          style={styles.webview}
          originWhitelist={["*"]}
          scalesPageToFit
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView style={[styles.webFallback, { backgroundColor: colors.card }]} contentContainerStyle={{ padding: 16 }}>
          <View style={[styles.webInfoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="monitor" size={16} color={colors.primary} />
            <Text style={[styles.webInfoText, { color: colors.foreground }]}>
              Preview HTML disponível apenas no app nativo. No web, edite o HTML e copie-o para um editor externo.
            </Text>
          </View>
          <Text style={[styles.htmlCode, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} numberOfLines={30}>{html}</Text>
        </ScrollView>
      )}

      {/* HTML editor modal */}
      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditor(false)}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar HTML</Text>
            <TouchableOpacity onPress={() => setShowEditor(false)} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Aplicar</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.htmlEditor, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={html} onChangeText={setHtml}
            multiline textAlignVertical="top"
            autoCapitalize="none" autoCorrect={false}
            spellCheck={false}
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  editBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  aiBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  aiInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  aiBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  templateRow: { borderBottomWidth: 1, paddingVertical: 7 },
  templateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  templateChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  webview: { flex: 1 },
  webFallback: { flex: 1 },
  webInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  webInfoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  htmlCode: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", padding: 10, borderRadius: 8, borderWidth: 1, lineHeight: 16 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  doneBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  htmlEditor: { flex: 1, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", margin: 12, padding: 10, borderRadius: 10, borderWidth: 1, lineHeight: 18 },
});
