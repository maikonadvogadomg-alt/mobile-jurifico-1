import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface Comunicacao {
  id: number; dataDisponibilizacao: string; tribunal: string; tipo: string;
  orgao: string; processo: string; classe: string; tipoDocumento: string;
  texto: string; destinatarios: Array<{ nome: string; polo: string }>;
  advogados: Array<{ nome: string; oab: string; uf: string }>;
}

function parseItem(item: any): Comunicacao {
  return {
    id: item.id, dataDisponibilizacao: item.data_disponibilizacao || item.dataDisponibilizacao || "",
    tribunal: item.siglaTribunal || item.tribunal || "", tipo: item.tipoComunicacao || item.tipo || "",
    orgao: item.nomeOrgao || item.orgao || "", processo: item.numeroprocessocommascara || item.numero_processo || item.processo || "",
    classe: item.nomeClasse || item.classe || "", tipoDocumento: item.tipoDocumento || "",
    texto: item.texto || "",
    destinatarios: (item.destinatarios || []).map((d: any) => ({ nome: d.nome || "", polo: d.polo === "A" ? "Ativo" : d.polo === "P" ? "Passivo" : d.polo || "" })),
    advogados: (item.destinatarioadvogados || item.advogados || []).map((da: any) => {
      if (da.advogado) return { nome: da.advogado.nome || "", oab: da.advogado.numero_oab || "", uf: da.advogado.uf_oab || "" };
      return { nome: da.nome || "", oab: da.oab || "", uf: da.uf || "" };
    }),
  };
}

export default function ComunicacoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [oab, setOab] = useState("183712");
  const [uf, setUf] = useState("MG");
  const [nomeAdv, setNomeAdv] = useState("");
  const [nomeParte, setNomeParte] = useState("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [loading, setLoading] = useState(false);
  const [comunicacoes, setComunicacoes] = useState<Comunicacao[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

  const handleSearch = async () => {
    setLoading(true); setComunicacoes([]); setError(null); setSearched(true);
    try {
      const params = new URLSearchParams();
      if (oab) params.append("numeroOab", oab.replace(/\D/g, ""));
      if (uf) params.append("ufOab", uf.toUpperCase());
      if (nomeAdv) params.append("nomeAdvogado", nomeAdv);
      if (nomeParte) params.append("nomeParte", nomeParte);
      if (numeroProcesso) params.append("numeroProcesso", numeroProcesso.replace(/[.\-\s]/g, ""));
      if (dataInicio) params.append("dataDisponibilizacaoInicio", dataInicio);
      if (dataFim) params.append("dataDisponibilizacaoFim", dataFim);

      const res = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === "success" && data.items) {
        setComunicacoes(data.items.map(parseItem));
        setTotal(data.count || data.items.length);
      } else {
        setError("Nenhuma comunicação encontrada ou resposta inesperada.");
      }
    } catch (e: any) {
      setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  const toggleExpand = (id: number) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Comunicações CNJ</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>PJe · Intimações e comunicados</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Filtros de Busca</Text>

          <Row label="Nº OAB" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={oab} onChangeText={setOab} placeholder="183712" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </Row>

          <Row label="UF OAB" colors={colors}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {UF_LIST.map(u => (
                <TouchableOpacity key={u} style={[styles.chip, { backgroundColor: uf === u ? colors.primary : colors.secondary, borderColor: uf === u ? colors.primary : colors.border }]} onPress={() => setUf(u)}>
                  <Text style={[styles.chipText, { color: uf === u ? colors.primaryForeground : colors.foreground }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Row>

          <Row label="Nome do Advogado" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={nomeAdv} onChangeText={setNomeAdv} placeholder="Opcional" placeholderTextColor={colors.mutedForeground} />
            </View>
          </Row>

          <Row label="Nome da Parte" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={nomeParte} onChangeText={setNomeParte} placeholder="Opcional" placeholderTextColor={colors.mutedForeground} />
            </View>
          </Row>

          <Row label="Número do Processo" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={numeroProcesso} onChangeText={setNumeroProcesso} placeholder="Opcional" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </Row>

          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Data Início</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={dataInicio} onChangeText={setDataInicio} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Data Fim</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={dataFim} onChangeText={setDataFim} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="search" size={16} color={colors.primaryForeground} />}
            <Text style={[styles.searchBtnText, { color: colors.primaryForeground }]}>{loading ? "Buscando..." : "Buscar Comunicações"}</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
            <Feather name="x-circle" size={15} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {searched && !loading && comunicacoes.length === 0 && !error && (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma comunicação encontrada para os filtros informados.</Text>
        )}

        {total > 0 && <Text style={[styles.totalText, { color: colors.mutedForeground }]}>{total} comunicação(ões) encontrada(s)</Text>}

        {comunicacoes.map(c => {
          const isExpanded = expandedIds.has(c.id);
          return (
            <TouchableOpacity key={c.id} style={[styles.commCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => toggleExpand(c.id)} activeOpacity={0.9}>
              <View style={styles.commHeader}>
                <View style={[styles.badge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{c.tribunal || "CNJ"}</Text>
                </View>
                <Text style={[styles.commDate, { color: colors.mutedForeground }]}>{c.dataDisponibilizacao?.slice(0, 10)}</Text>
              </View>
              <Text style={[styles.commProcesso, { color: colors.foreground }]}>{c.processo || "—"}</Text>
              {c.orgao ? <Text style={[styles.commOrgao, { color: colors.mutedForeground }]}>{c.orgao}</Text> : null}
              {c.tipo ? <Text style={[styles.commTipo, { color: colors.mutedForeground }]}>{c.tipo}</Text> : null}
              {isExpanded && (
                <>
                  {c.destinatarios.map((d, i) => (
                    <Text key={i} style={[styles.commDetail, { color: colors.mutedForeground }]}>Destinatário: {d.nome} ({d.polo})</Text>
                  ))}
                  {c.advogados.map((a, i) => (
                    <Text key={i} style={[styles.commDetail, { color: colors.mutedForeground }]}>Advogado: {a.nome} OAB/{a.uf} {a.oab}</Text>
                  ))}
                  {c.texto ? (
                    <View style={[styles.textoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[styles.textoText, { color: colors.foreground }]}>{c.texto.slice(0, 500)}{c.texto.length > 500 ? "..." : ""}</Text>
                    </View>
                  ) : null}
                </>
              )}
              <View style={styles.expandRow}>
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                <Text style={[styles.expandText, { color: colors.mutedForeground }]}>{isExpanded ? "Minimizar" : "Ver detalhes"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 4 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dateRow: { flexDirection: "row", gap: 10 },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  searchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
  totalText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  commCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 5 },
  commHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  commDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" as any },
  commProcesso: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  commOrgao: { fontSize: 12, fontFamily: "Inter_400Regular" },
  commTipo: { fontSize: 11, fontFamily: "Inter_400Regular" },
  commDetail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  textoBox: { borderRadius: 8, borderWidth: 1, padding: 10 },
  textoText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  expandRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  expandText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
