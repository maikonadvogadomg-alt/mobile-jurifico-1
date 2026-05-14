import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

const ORGAOS = [
  { label: "PJe Nacional (CNJ)", url: "https://pje.jus.br", hint: "Sistema nacional do PJe" },
  { label: "TJMG", url: "https://pje.tjmg.jus.br", hint: "Tribunal de Justiça de MG" },
  { label: "TJSP (E-SAJ)", url: "https://esaj.tjsp.jus.br/esaj/portal.do", hint: "Tribunal de Justiça de SP" },
  { label: "TJRJ (e-Proc)", url: "https://www.tjrj.jus.br", hint: "Tribunal de Justiça do RJ" },
  { label: "STJ", url: "https://processo.stj.jus.br/processo/pesquisa", hint: "Superior Tribunal de Justiça" },
  { label: "STF", url: "https://portal.stf.jus.br/processos/listarPartes.asp", hint: "Supremo Tribunal Federal" },
  { label: "TST", url: "https://pje.tst.jus.br/primeirograu/login.seam", hint: "Tribunal Superior do Trabalho" },
  { label: "TRF1", url: "https://pje1g.trf1.jus.br/consultapublica", hint: "Tribunal Regional Federal 1ª Região" },
  { label: "TRF3", url: "https://pje.trf3.jus.br/consultapublica/login.seam", hint: "Tribunal Regional Federal 3ª Região" },
];

const ACOES = [
  { id: "peticionar", label: "Como Peticionar", icon: "file-plus" },
  { id: "certificado", label: "Certificado Digital", icon: "shield" },
  { id: "intimacao", label: "Intimações", icon: "bell" },
  { id: "documentos", label: "Upload de Docs", icon: "upload" },
  { id: "audiencia", label: "Audiência Virtual", icon: "video" },
  { id: "procuracao", label: "Procuração Eletrônica", icon: "edit" },
];

export default function PdpjScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [orgao, setOrgao] = useState(ORGAOS[0]);
  const [acao, setAcao] = useState(ACOES[0].id);
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!aiProviders.length) { Alert.alert("Sem IA", "Configure um provedor de IA."); return; }
    setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const acaoObj = ACOES.find(a => a.id === acao);
      const tema = pergunta.trim() || (acaoObj?.label ?? acao);
      const msgs: AiMessage[] = [
        {
          role: "system",
          content: "Você é um especialista em sistemas processuais eletrônicos brasileiros (PJe, e-SAJ, e-Proc, SEEU, PROJUDI, etc.) e no processo digital do CNJ (PDPJ-Br). Forneça orientações detalhadas, práticas e atualizadas em português.",
        },
        {
          role: "user",
          content: `Sistema: ${orgao.label} (${orgao.url})\nTema: ${tema}\n\nPor favor, explique de forma detalhada e prática como proceder, incluindo:\n1. Requisitos e pré-requisitos\n2. Passo a passo\n3. Atenções importantes\n4. Dicas e boas práticas`,
        },
      ];
      const res = await callAI(msgs, aiProviders);
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally { setLoading(false); }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>PDPJ · Processo Digital</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>PJe · e-SAJ · e-Proc · CNJ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.foreground }]}>Sistema / Tribunal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {ORGAOS.map(o => (
            <TouchableOpacity key={o.label} style={[styles.orgaoChip, { backgroundColor: orgao.label === o.label ? colors.primary : colors.secondary, borderColor: orgao.label === o.label ? colors.primary : colors.border }]} onPress={() => setOrgao(o)}>
              <Text style={[styles.orgaoText, { color: orgao.label === o.label ? colors.primaryForeground : colors.foreground }]}>{o.label}</Text>
              <Text style={[styles.orgaoHint, { color: orgao.label === o.label ? colors.primaryForeground + "cc" : colors.mutedForeground }]}>{o.hint}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Link direto */}
        <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => Clipboard.setStringAsync(orgao.url).then(() => Alert.alert("Link copiado", orgao.url))}>
          <Feather name="external-link" size={13} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={1}>{orgao.url}</Text>
          <Text style={[styles.copyHint, { color: colors.mutedForeground }]}>Copiar</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.foreground }]}>Ação / Tema</Text>
        <View style={styles.acaoGrid}>
          {ACOES.map(a => (
            <TouchableOpacity key={a.id} style={[styles.acaoBtn, { backgroundColor: acao === a.id ? colors.primary + "15" : colors.secondary, borderColor: acao === a.id ? colors.primary : colors.border }]} onPress={() => setAcao(a.id)}>
              <Feather name={a.icon as any} size={16} color={acao === a.id ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.acaoText, { color: acao === a.id ? colors.primary : colors.foreground }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Dúvida específica (opcional)</Text>
        <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textArea, { color: colors.foreground }]}
            value={pergunta} onChangeText={setPergunta}
            placeholder="Descreva sua dúvida específica..."
            placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={3} textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={[styles.askBtn, { backgroundColor: loading ? colors.muted : colors.primary }]} onPress={handleAsk} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="help-circle" size={16} color={colors.primaryForeground} />}
          <Text style={[styles.askBtnText, { color: colors.primaryForeground }]}>{loading ? "Consultando IA..." : "Obter Orientação"}</Text>
        </TouchableOpacity>

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Feather name="book-open" size={14} color={colors.primary} />
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>{orgao.label} · {ACOES.find(a => a.id === acao)?.label}</Text>
              <TouchableOpacity onPress={() => Clipboard.setStringAsync(result).then(() => Alert.alert("Copiado"))} style={[styles.copyBtn, { borderColor: colors.border }]}>
                <Feather name="copy" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.resultScroll} nestedScrollEnabled>
              <Text style={[styles.resultText, { color: colors.foreground }]}>{result}</Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  orgaoChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, marginRight: 7, minWidth: 80 },
  orgaoText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  orgaoHint: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  linkText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  copyHint: { fontSize: 10, fontFamily: "Inter_400Regular" },
  acaoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  acaoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, minWidth: "45%" },
  acaoText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  textAreaWrap: { borderRadius: 10, borderWidth: 1, padding: 12 },
  textArea: { fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 70, lineHeight: 18 },
  askBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  askBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultTitle: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  copyBtn: { padding: 6, borderRadius: 6, borderWidth: 1 },
  resultScroll: { maxHeight: 500 },
  resultText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
