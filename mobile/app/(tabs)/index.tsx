import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DocumentCard from "@/components/DocumentCard";
import { useColors } from "@/hooks/useColors";
import { deleteDocument, getAllDocuments, type Document } from "@/lib/sqlite-service";

const AREAS = ["geral", "civil", "trabalhista", "penal", "tributario", "administrativo", "consumidor"];
const AREA_LABELS: Record<string, string> = {
  geral: "Geral", civil: "Civil", trabalhista: "Trabalhista",
  penal: "Penal", tributario: "Tributário", administrativo: "Adm.", consumidor: "Consumidor",
};

export default function DocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState<string | null>(null);

  const loadDocs = useCallback(() => {
    setLoading(true);
    try {
      const all = getAllDocuments(db);
      setDocs(all);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = useCallback((id: string) => {
    deleteDocument(db, id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, [db]);

  const handleOpen = useCallback((doc: Document) => {
    router.push({ pathname: "/editor", params: { docId: doc.id } });
  }, [router]);

  const handleNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/editor", params: {} });
  }, [router]);

  const filtered = docs.filter((d) => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase());
    const matchArea = !filterArea || d.area === filterArea;
    return matchSearch && matchArea;
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Documentos</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {docs.length} {docs.length === 1 ? "documento" : "documentos"}
            </Text>
          </View>
          <TouchableOpacity
            testID="btn-new-doc"
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={handleNew}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={[styles.newBtnText, { color: colors.primaryForeground }]}>Novo</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar documentos..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...AREAS]}
          keyExtractor={(item) => item ?? "all"}
          contentContainerStyle={{ paddingHorizontal: 0, gap: 6 }}
          renderItem={({ item }) => {
            const active = item === filterArea;
            return (
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.secondary, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setFilterArea(active ? null : item)}
              >
                <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {item ? AREA_LABELS[item] : "Todos"}
                </Text>
              </TouchableOpacity>
            );
          }}
          style={{ marginTop: 8 }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="file-text" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search || filterArea ? "Nenhum resultado" : "Nenhum documento ainda"}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {search || filterArea ? "Tente outros termos" : "Toque em Novo para criar seu primeiro documento"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DocumentCard doc={item} onOpen={handleOpen} onDelete={handleDelete} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
