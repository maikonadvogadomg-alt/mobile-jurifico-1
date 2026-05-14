import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { searchJurisprudencia, getProviderName } from "@/lib/ai-service";
import { saveAiHistory } from "@/lib/sqlite-service";
import { useSettings } from "@/contexts/SettingsContext";

const SUGESTOES = [
  "Dano moral por negativação indevida",
  "Responsabilidade civil médica",
  "Rescisão indireta por falta de pagamento",
  "Revisão de contrato bancário",
  "Usucapião urbana requisitos",
  "Pensão alimentícia fixação",
  "Acidente de trabalho indenização",
  "Saque FGTS por doença grave",
];

export default function JurisprudenciaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { aiProviders } = useSettings();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await searchJurisprudencia(term, aiProviders);
      setResult(res);
      saveAiHistory(db, {
        action: "jurisprudencia",
        input_preview: term,
        result: res,
        model: "",
        provider: getProviderName(aiProviders),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      Alert.alert("Erro na pesquisa", msg);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Jurisprudência</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Pesquisa por IA · {getProviderName(aiProviders)}
        </Text>

        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Ex: dano moral negativação indevida..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
            multiline={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          testID="btn-buscar"
          style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
          onPress={() => handleSearch()}
          disabled={loading || !query.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="search" size={16} color={colors.primaryForeground} />
          )}
          <Text style={[styles.searchBtnText, { color: colors.primaryForeground }]}>
            {loading ? "Pesquisando..." : "Pesquisar"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!result && !loading && !error && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Sugestões de pesquisa</Text>
            <View style={styles.tags}>
              {SUGESTOES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.tag, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => { setQuery(s); handleSearch(s); }}
                  activeOpacity={0.8}
                >
                  <Feather name="chevron-right" size={12} color={colors.accent} />
                  <Text style={[styles.tagText, { color: colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Esta pesquisa usa IA para apresentar jurisprudência relevante. Sempre verifique as fontes originais nos portais dos tribunais.
              </Text>
            </View>
          </View>
        )}

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Feather name="book-open" size={16} color={colors.primary} />
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>Resultado da Pesquisa</Text>
              <TouchableOpacity
                style={{ marginLeft: "auto" }}
                onPress={() => setResult(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.resultText, { color: colors.foreground }]}>{result}</Text>
            <View style={[styles.disclaimer, { borderTopColor: colors.border }]}>
              <Feather name="alert-circle" size={12} color={colors.warning} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                Gerado por IA. Verifique nos portais oficiais dos tribunais.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  searchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  disclaimer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
