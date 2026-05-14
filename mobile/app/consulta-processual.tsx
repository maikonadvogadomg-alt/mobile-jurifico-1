import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";

const TRIBUNAIS = [
  { sigla: "tjmg", label: "TJMG" }, { sigla: "tjsp", label: "TJSP" }, { sigla: "tjrj", label: "TJRJ" },
  { sigla: "trf1", label: "TRF1" }, { sigla: "trf3", label: "TRF3" }, { sigla: "trf5", label: "TRF5" },
  { sigla: "tst", label: "TST" }, { sigla: "stj", label: "STJ" }, { sigla: "trt3", label: "TRT3" },
  { sigla: "tjba", label: "TJBA" }, { sigla: "tjrs", label: "TJRS" }, { sigla: "tjpr", label: "TJPR" },
];

interface Processo {
  id: string; numero: string; tribunal: string;
  classe?: string; assunto?: string; orgao?: string; status?: string;
  dataAjuizamento?: string; movimentos?: Array<{ data: string; descricao: string }>;
}

function parseProcesso(hit: any): Processo {
  const src = hit._source || hit;
  return {
    id: hit._id || src.id || "",
    numero: src.numero_cnj || src.numeroProcesso || src.id || "",
    tribunal: src.tribunal || src.siglaTribunal || "",
    classe: src.classe?.nome || src.classe || "",
    assunto: (src.assuntos || [])[0]?.nome || src.assunto || "",
    orgao: src.orgaoJulgador?.nome || src.orgao || "",
    status: src.situacao || src.status || "",
    dataAjuizamento: src.dataAjuizamento || src.data_ajuizamento || "",
    movimentos: (src.movimentos || []).slice(0, 5).map((m: any) => ({
      data: m.dataHora || m.data || "",
      descricao: m.nome || m.descricao || "",
    })),
  };
}

export default function ConsultaProcessualScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();

  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("tjmg");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Processo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const formatNumero = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 20);
    if (d.length <= 7) return d;
    if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`;
    if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`;
    return d;
  };

  const handleSearch = async () => {
    const n = numero.replace(/\D/g, "");
    if (n.length < 15) { Alert.alert("Atenção", "Informe o número do processo com ao menos 15 dígitos (CNJ)."); return; }
    if (!settings.datajudKey) { Alert.alert("Chave DataJud necessária", "Configure a chave DataJud em Configurações para consultas processuais."); return; }
    setLoading(true); setResult(null); setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`;
      const body = JSON.stringify({ query: { match: { "numeroProcesso.keyword": n } }, size: 1 });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `ApiKey ${settings.datajudKey}` },
        body,
      });
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); }
      const data = await res.json();
      const hits = data?.hits?.hits ?? [];
      if (hits.length === 0) { setError("Processo não encontrado no tribunal selecionado."); return; }
      setResult(parseProcesso(hits[0]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Consulta Processual</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>DataJud · CNJ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        {!settings.datajudKey && (
          <View style={[styles.warnBox, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}>
            <Feather name="alert-triangle" size={15} color={colors.warning} />
            <Text style={[styles.warnText, { color: colors.warning }]}>Configure a chave DataJud em Configurações → Provedores de IA.</Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Número do Processo (CNJ)</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={numero} onChangeText={v => setNumero(formatNumero(v))}
            placeholder="0000000-00.0000.0.00.0000" placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric" returnKeyType="search" onSubmitEditing={handleSearch}
          />
          {numero ? <TouchableOpacity onPress={() => setNumero("")}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Tribunal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {TRIBUNAIS.map(t => (
            <TouchableOpacity
              key={t.sigla}
              style={[styles.chip, { backgroundColor: tribunal === t.sigla ? colors.primary : colors.secondary, borderColor: tribunal === t.sigla ? colors.primary : colors.border }]}
              onPress={() => setTribunal(t.sigla)}
            >
              <Text style={[styles.chipText, { color: tribunal === t.sigla ? colors.primaryForeground : colors.foreground }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
          onPress={handleSearch} disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="search" size={18} color={colors.primaryForeground} />}
          <Text style={[styles.searchBtnText, { color: colors.primaryForeground }]}>{loading ? "Consultando..." : "Consultar"}</Text>
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
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>{result.numero}</Text>
              <TouchableOpacity onPress={() => { Clipboard.setStringAsync(result.numero); Alert.alert("Copiado"); }}>
                <Feather name="copy" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {result.tribunal ? <InfoRow label="Tribunal" value={result.tribunal} colors={colors} /> : null}
            {result.classe ? <InfoRow label="Classe" value={result.classe} colors={colors} /> : null}
            {result.assunto ? <InfoRow label="Assunto" value={result.assunto} colors={colors} /> : null}
            {result.orgao ? <InfoRow label="Órgão" value={result.orgao} colors={colors} /> : null}
            {result.status ? <InfoRow label="Situação" value={result.status} colors={colors} /> : null}
            {result.dataAjuizamento ? <InfoRow label="Ajuizamento" value={result.dataAjuizamento.slice(0, 10)} colors={colors} /> : null}

            {result.movimentos && result.movimentos.length > 0 && (
              <>
                <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(!expanded)}>
                  <Text style={[styles.expandText, { color: colors.primary }]}>
                    {expanded ? "Ocultar movimentos" : `Ver ${result.movimentos.length} movimentos`}
                  </Text>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
                </TouchableOpacity>
                {expanded && result.movimentos.map((m, i) => (
                  <View key={i} style={[styles.movimento, { borderLeftColor: colors.primary }]}>
                    <Text style={[styles.movData, { color: colors.mutedForeground }]}>{m.data.slice(0, 10)}</Text>
                    <Text style={[styles.movDesc, { color: colors.foreground }]}>{m.descricao}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { padding: 16, gap: 10 },
  warnBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  warnText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  chipRow: { marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  searchBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  infoRow: { flexDirection: "row", gap: 8 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 80 },
  infoValue: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 4 },
  expandText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  movimento: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 4, gap: 2 },
  movData: { fontSize: 11, fontFamily: "Inter_400Regular" },
  movDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
