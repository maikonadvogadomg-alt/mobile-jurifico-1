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

const DJEN_TRIBUNAIS = [
  { sigla: "TJMG", nome: "Tribunal de Justiça de Minas Gerais", diario: "https://www.tjmg.jus.br/portal-tjmg/publicacoes/notas-ao-publico.htm" },
  { sigla: "TJSP", nome: "Tribunal de Justiça de São Paulo", diario: "https://www.tjsp.jus.br/DiarioDaJustica/PesquisaPublicacao" },
  { sigla: "STJ", nome: "Superior Tribunal de Justiça", diario: "https://scon.stj.jus.br/SCON/pesquisa.jsp" },
  { sigla: "STF", nome: "Supremo Tribunal Federal", diario: "https://portal.stf.jus.br/noticias/pesquisarNoticias.asp" },
  { sigla: "TST", nome: "Tribunal Superior do Trabalho", diario: "https://www.tst.jus.br/en/web/guest/publicacoes" },
  { sigla: "TRF1", nome: "Tribunal Regional Federal 1ª Região", diario: "https://portal.trf1.jus.br/portaltrf1/comunicacao/imprensa/publicacoes/diario-da-justica.htm" },
  { sigla: "TRF3", nome: "Tribunal Regional Federal 3ª Região", diario: "https://www.trf3.jus.br/trf3/index.php" },
];

const DATE_PRESETS = [
  { label: "Hoje", getValue: () => new Date().toISOString().slice(0, 10) },
  { label: "Ontem", getValue: () => new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
  { label: "7 dias", getValue: () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) },
  { label: "30 dias", getValue: () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) },
];

export default function DjenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [tribunal, setTribunal] = useState(DJEN_TRIBUNAIS[0]);
  const [oab, setOab] = useState("");
  const [nomeParte, setNomeParte] = useState("");
  const [numero, setNumero] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!oab && !nomeParte && !numero) { Alert.alert("Atenção", "Informe ao menos um critério de busca."); return; }
    if (!aiProviders.length) { Alert.alert("Sem IA configurada", "Configure um provedor de IA para usar o assistente DJEN."); return; }
    setLoading(true); setResult(null); setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const criteria: string[] = [];
      if (oab) criteria.push(`OAB nº ${oab}`);
      if (nomeParte) criteria.push(`parte "${nomeParte}"`);
      if (numero) criteria.push(`processo nº ${numero}`);
      const msgs: AiMessage[] = [
        {
          role: "system",
          content: `Você é um assistente jurídico especializado em busca de publicações no Diário da Justiça. Forneça informações detalhadas sobre como encontrar publicações, prazos importantes e orientações práticas. Responda em português.`,
        },
        {
          role: "user",
          content: `Preciso buscar publicações no ${tribunal.sigla} (${tribunal.nome}) para: ${criteria.join(", ")}.
          
Período: ${dataInicio} a ${dataFim}

Por favor, me forneça:
1. Como acessar o DJEN do ${tribunal.sigla} (URL: ${tribunal.diario})
2. Passos para buscar as publicações com os critérios informados
3. O que observar nas publicações (prazos, tipos de ato, etc.)
4. Orientações sobre como agir após encontrar uma publicação relevante
5. Prazo para contestação/resposta após intimação publicada no DJEN

Seja detalhado e prático.`,
        },
      ];
      const res = await callAI(msgs, aiProviders);
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Robô DJEN</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Diário da Justiça Eletrônico</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            O assistente DJEN usa IA para orientar a busca de publicações no diário oficial eletrônico de cada tribunal.
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Tribunal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {DJEN_TRIBUNAIS.map(t => (
            <TouchableOpacity key={t.sigla} style={[styles.chip, { backgroundColor: tribunal.sigla === t.sigla ? colors.primary : colors.secondary, borderColor: tribunal.sigla === t.sigla ? colors.primary : colors.border }]} onPress={() => setTribunal(t)}>
              <Text style={[styles.chipText, { color: tribunal.sigla === t.sigla ? colors.primaryForeground : colors.foreground }]}>{t.sigla}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.tribunalName, { color: colors.mutedForeground }]}>{tribunal.nome}</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Critérios de Busca</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row label="OAB nº" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={oab} onChangeText={setOab} placeholder="183712" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </Row>
          <Row label="Nome da parte" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={nomeParte} onChangeText={setNomeParte} placeholder="João Silva" placeholderTextColor={colors.mutedForeground} />
            </View>
          </Row>
          <Row label="Nº do processo" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={numero} onChangeText={setNumero} placeholder="0000000-00.0000.0.00.0000" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </Row>

          <Row label="Período" colors={colors}>
            <View style={styles.dateRow}>
              <TouchableOpacity style={[styles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {}}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <TextInput style={[styles.dateInput, { color: colors.foreground }]} value={dataInicio} onChangeText={setDataInicio} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </TouchableOpacity>
              <Text style={[styles.dateSep, { color: colors.mutedForeground }]}>até</Text>
              <TouchableOpacity style={[styles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {}}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <TextInput style={[styles.dateInput, { color: colors.foreground }]} value={dataFim} onChangeText={setDataFim} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {DATE_PRESETS.map(p => (
                <TouchableOpacity key={p.label} style={[styles.presetChip, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => { setDataInicio(p.getValue()); setDataFim(new Date().toISOString().slice(0, 10)); }}>
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Row>
        </View>

        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]} onPress={handleSearch} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="search" size={16} color={colors.primaryForeground} />}
          <Text style={[styles.searchBtnText, { color: colors.primaryForeground }]}>{loading ? "Consultando IA..." : "Buscar no DJEN"}</Text>
        </TouchableOpacity>

        {/* Direct link */}
        <TouchableOpacity style={[styles.linkBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => Clipboard.setStringAsync(tribunal.diario).then(() => Alert.alert("Link copiado", tribunal.diario))}>
          <Feather name="external-link" size={14} color={colors.primary} />
          <Text style={[styles.linkBtnText, { color: colors.primary }]} numberOfLines={1}>Acessar DJEN {tribunal.sigla} diretamente</Text>
        </TouchableOpacity>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
            <Feather name="x-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Feather name="book-open" size={14} color={colors.primary} />
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>Orientações DJEN · {tribunal.sigla}</Text>
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

function Row({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return <View style={styles.fieldRow}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { padding: 16, gap: 10 },
  infoBox: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  tribunalName: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  dateInput: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", padding: 0 },
  dateSep: { fontSize: 12, fontFamily: "Inter_400Regular" },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, marginRight: 5 },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  searchBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  linkBtnText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  copyBtn: { padding: 6, borderRadius: 6, borderWidth: 1 },
  resultScroll: { maxHeight: 500 },
  resultText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
