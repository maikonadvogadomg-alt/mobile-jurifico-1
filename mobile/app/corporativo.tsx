import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const TABS = [
  { id: "advogado", label: "Advogado" },
  { id: "cnpj",     label: "CNPJ" },
];

type TabType = "advogado" | "cnpj";

export default function CorporativoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<TabType>("advogado");
  const [oabNumero, setOabNumero] = useState("");
  const [oabUf, setOabUf] = useState("MG");
  const [cpfInput, setCpfInput] = useState("");
  const [cnpjInput, setCnpjInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtCpf = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d; if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`; return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };
  const fmtCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 2) return d; if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const handleSearch = async () => {
    setLoading(true); setResults([]); setError(null); setSearched(true);
    try {
      if (tab === "advogado") {
        const n = oabNumero.replace(/\D/g, "");
        if (!n) { setError("Informe o número OAB."); return; }
        const url = `https://cna.oab.org.br/api/advogados/search?nome=&numero=${n}&uf=${oabUf}&tipo=A`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = data?.items || data?.data || (Array.isArray(data) ? data : [data]);
        setResults(items.slice(0, 20));
      } else {
        const n = cnpjInput.replace(/\D/g, "");
        if (n.length < 14) { setError("Informe um CNPJ válido (14 dígitos)."); return; }
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${n}`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults([data]);
      }
    } catch (e: any) {
      setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  const renderValue = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v).slice(0, 100);
    return String(v);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Consulta Corporativo</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>OAB · CNPJ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.id} style={[styles.tab, { backgroundColor: tab === t.id ? colors.primary : colors.secondary, borderColor: tab === t.id ? colors.primary : colors.border }]} onPress={() => { setTab(t.id as TabType); setResults([]); setError(null); setSearched(false); }}>
              <Text style={[styles.tabText, { color: tab === t.id ? colors.primaryForeground : colors.foreground }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {tab === "advogado" && (
            <>
              <Text style={[styles.label, { color: colors.foreground }]}>Número OAB</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={oabNumero} onChangeText={v => setOabNumero(v.replace(/\D/g, ""))} placeholder="183712" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>UF</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {UF_LIST.map(u => (
                  <TouchableOpacity key={u} style={[styles.chip, { backgroundColor: oabUf === u ? colors.primary : colors.secondary, borderColor: oabUf === u ? colors.primary : colors.border }]} onPress={() => setOabUf(u)}>
                    <Text style={[styles.chipText, { color: oabUf === u ? colors.primaryForeground : colors.foreground }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {tab === "cnpj" && (
            <>
              <Text style={[styles.label, { color: colors.foreground }]}>CNPJ</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={cnpjInput} onChangeText={v => setCnpjInput(fmtCnpj(v))} placeholder="00.000.000/0001-00" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="search" size={16} color={colors.primaryForeground} />}
            <Text style={[styles.searchBtnText, { color: colors.primaryForeground }]}>{loading ? "Consultando..." : "Consultar"}</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
            <Feather name="x-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {searched && !loading && results.length === 0 && !error && (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum resultado encontrado.</Text>
        )}

        {results.map((item, idx) => (
          <View key={idx} style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {Object.entries(item).filter(([, v]) => v !== null && v !== undefined && v !== "").slice(0, 15).map(([k, v]) => (
              <View key={k} style={styles.resultRow}>
                <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>{k}:</Text>
                <Text style={[styles.resultValue, { color: colors.foreground }]} numberOfLines={2}>{renderValue(v)}</Text>
                <TouchableOpacity onPress={() => Clipboard.setStringAsync(renderValue(v))} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                  <Feather name="copy" size={12} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
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
  content: { padding: 16, gap: 12 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 4 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  searchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 5 },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  resultKey: { fontSize: 11, fontFamily: "Inter_500Medium", width: 90 },
  resultValue: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
});
