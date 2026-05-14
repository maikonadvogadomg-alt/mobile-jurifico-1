import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { clearAiHistory, deleteAiHistory, getAiHistory, type AiHistoryEntry } from "@/lib/sqlite-service";

const ACTION_LABELS: Record<string, string> = {
  minuta: "Gerar Minuta", revisar: "Revisar", refinar: "Refinar",
  resumir: "Resumir", simplificar: "Simplificar", analisar: "Analisar",
  "modo-estrito": "Corrigir", jurisprudencia: "Jurisprudência",
};
const ACTION_COLORS: Record<string, string> = {
  minuta: "#1B3A6B", revisar: "#16A34A", refinar: "#D97706",
  resumir: "#7C3AED", simplificar: "#0891B2", analisar: "#DC2626",
  "modo-estrito": "#374151", jurisprudencia: "#C9A844",
};
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function HistoricoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => setHistory(getAiHistory(db)), [db]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Excluir", "Remover este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => { deleteAiHistory(db, id); setHistory(p => p.filter(h => h.id !== id)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  }, [db]);

  const handleClear = useCallback(() => {
    Alert.alert("Limpar", "Apagar todo o histórico?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => { clearAiHistory(db); setHistory([]); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  }, [db]);

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtered = history.filter(h => !search || h.action.toLowerCase().includes(search.toLowerCase()) || h.input_preview.toLowerCase().includes(search.toLowerCase()) || h.result.toLowerCase().includes(search.toLowerCase()));
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Histórico IA</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{history.length} registros</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.destructive }]} onPress={handleClear}>
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.clearText, { color: colors.destructive }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Buscar..." placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={44} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{search ? "Nenhum resultado" : "Histórico vazio"}</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{search ? "Tente outros termos" : "Suas ações de IA aparecerão aqui"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered} keyExtractor={h => h.id}
          contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isExpanded = expanded.has(item.id);
            const c = ACTION_COLORS[item.action] ?? colors.primary;
            return (
              <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => toggle(item.id)} activeOpacity={0.9}>
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: c + "20", borderColor: c + "40" }]}>
                    <Text style={[styles.badgeText, { color: c }]}>{ACTION_LABELS[item.action] ?? item.action}</Text>
                  </View>
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="trash-2" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                {item.provider ? <Text style={[styles.provider, { color: colors.mutedForeground }]}>via {item.provider}</Text> : null}
                {item.input_preview ? <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={isExpanded ? undefined : 1}>Entrada: {item.input_preview}</Text> : null}
                <Text style={[styles.result, { color: colors.foreground }]} numberOfLines={isExpanded ? undefined : 3}>{item.result}</Text>
                <View style={styles.footer}>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                  <Text style={[styles.expandText, { color: colors.mutedForeground }]}>{isExpanded ? "Minimizar" : "Ver completo"}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, gap: 8 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  clearText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  list: { padding: 16, gap: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 5 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" as any, marginRight: 4 },
  provider: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  preview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  result: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", gap: 4 },
  expandText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
