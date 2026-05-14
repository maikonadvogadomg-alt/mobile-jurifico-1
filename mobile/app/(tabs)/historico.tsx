import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { clearAiHistory, deleteAiHistory, getAiHistory, type AiHistoryEntry } from "@/lib/sqlite-service";

const ACTION_LABELS: Record<string, string> = {
  minuta: "Gerar Minuta",
  revisar: "Revisar",
  refinar: "Refinar",
  resumir: "Resumir",
  simplificar: "Simplificar",
  analisar: "Analisar",
  "modo-estrito": "Corrigir",
  jurisprudencia: "Jurisprudência",
};

const ACTION_COLORS: Record<string, string> = {
  minuta: "#1B3A6B",
  revisar: "#16A34A",
  refinar: "#D97706",
  resumir: "#7C3AED",
  simplificar: "#0891B2",
  analisar: "#DC2626",
  "modo-estrito": "#374151",
  jurisprudencia: "#C9A844",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoricoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setHistory(getAiHistory(db));
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Excluir item", "Remover este registro do histórico?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive",
        onPress: () => {
          deleteAiHistory(db, id);
          setHistory((prev) => prev.filter((h) => h.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [db]);

  const handleClearAll = useCallback(() => {
    Alert.alert("Limpar histórico", "Deseja apagar todo o histórico de IA?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar tudo", style: "destructive",
        onPress: () => {
          clearAiHistory(db);
          setHistory([]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [db]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = history.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return h.action.toLowerCase().includes(s) || h.input_preview.toLowerCase().includes(s) || h.result.toLowerCase().includes(s);
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Histórico</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{history.length} registros de IA</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: colors.destructive }]}
              onPress={handleClearAll}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.clearText, { color: colors.destructive }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar no histórico..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={44} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search ? "Nenhum resultado" : "Histórico vazio"}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {search ? "Tente outros termos" : "Suas ações de IA aparecerão aqui"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(h) => h.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isExpanded = expanded.has(item.id);
            const actionColor = ACTION_COLORS[item.action] ?? colors.primary;
            return (
              <TouchableOpacity
                style={[styles.histItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.9}
              >
                <View style={styles.histTop}>
                  <View style={[styles.actionBadge, { backgroundColor: actionColor + "20", borderColor: actionColor + "40" }]}>
                    <Text style={[styles.actionLabel, { color: actionColor }]}>
                      {ACTION_LABELS[item.action] ?? item.action}
                    </Text>
                  </View>
                  <Text style={[styles.histDate, { color: colors.mutedForeground }]}>{formatDate(item.created_at)}</Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {item.provider ? (
                  <Text style={[styles.histProvider, { color: colors.mutedForeground }]}>via {item.provider}</Text>
                ) : null}

                {item.input_preview ? (
                  <Text style={[styles.histPreview, { color: colors.mutedForeground }]} numberOfLines={isExpanded ? undefined : 1}>
                    Entrada: {item.input_preview}
                  </Text>
                ) : null}

                <Text style={[styles.histResult, { color: colors.foreground }]} numberOfLines={isExpanded ? undefined : 3}>
                  {item.result}
                </Text>

                <View style={styles.histFooter}>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                  <Text style={[styles.expandText, { color: colors.mutedForeground }]}>
                    {isExpanded ? "Minimizar" : "Ver completo"}
                  </Text>
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
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  clearText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  list: { padding: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  histItem: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  histTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  actionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  histDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto", marginRight: 4 },
  histProvider: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  histPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  histResult: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  histFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  expandText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
