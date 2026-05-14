import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

// Parse URLs from text and split into segments
interface TextSegment { text: string; url?: string }
function parseLinks(text: string): TextSegment[] {
  const URL_RE = /https?:\/\/[^\s\)\]\}"'<>]+/g;
  const segments: TextSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[0], url: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length ? segments : [{ text }];
}

function LinkedText({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) {
  const segments = parseLinks(text);
  return (
    <Text style={[styles.resultText, { color: colors.foreground }]}>
      {segments.map((seg, i) =>
        seg.url ? (
          <Text key={i} style={[styles.link, { color: colors.primary }]}
            onPress={() => Linking.openURL(seg.url!).catch(() => {})}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}

const SUGESTOES = [
  "Jurisprudência STJ sobre dano moral 2024",
  "Lei 14.133/2021 alterações recentes",
  "Novo CPC artigo 1.015 rol taxativo",
  "Precedentes TJMG responsabilidade civil médica",
  "Súmulas STF direito trabalhista",
];

const SYSTEM_PROMPT = `Você é um assistente jurídico especializado em pesquisa. Quando o usuário fizer uma pesquisa:

1. Forneça uma resposta completa e fundamentada sobre o tema jurídico
2. Inclua referências a leis, artigos e julgados relevantes
3. Quando possível, inclua URLs de fontes oficiais como:
   - STJ: https://www.stj.jus.br/sites/portalp/Jurisprudencia/...
   - STF: https://portal.stf.jus.br/...
   - Planalto: https://www.planalto.gov.br/ccivil_03/...
   - DataJud: https://jurisprudencia.stj.jus.br/...
   - Jusbrasil: https://www.jusbrasil.com.br/...
4. Formate a resposta em seções claras
5. Sempre inclua pelo menos 2-3 links relevantes para fontes primárias

Priorize fontes oficiais do judiciário brasileiro.`;

export default function PesquisaWebScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    if (!aiProviders.length) { setError("Configure um provedor de IA nas configurações."); return; }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const msgs: AiMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Pesquise sobre: ${term}\n\nForneça uma análise jurídica completa com links para fontes oficiais.` },
      ];
      const res = await callAI(msgs, aiProviders, abortRef.current.signal);
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Erro na pesquisa.");
    } finally { setLoading(false); }
  }, [query, aiProviders]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Pesquisa Jurídica</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>IA com links para fontes oficiais</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Pesquise leis, jurisprudência, doutrinas..."
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          onSubmitEditing={() => handleSearch()}
          autoFocus
          multiline={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: loading ? colors.muted : colors.primary }]}
          onPress={() => handleSearch()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.primaryForeground} />
            : <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Suggestions (when no result) */}
        {!result && !loading && !error && (
          <View style={styles.suggestions}>
            <Text style={[styles.sugTitle, { color: colors.mutedForeground }]}>Sugestões:</Text>
            {SUGESTOES.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.sugChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => { setQuery(s); handleSearch(s); }}
              >
                <Feather name="trending-up" size={13} color={colors.primary} />
                <Text style={[styles.sugText, { color: colors.foreground }]}>{s}</Text>
              </TouchableOpacity>
            ))}

            <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Para busca com resultados em tempo real, configure Perplexity como provedor de IA nas configurações.
              </Text>
            </View>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Pesquisando...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>Resultado da pesquisa</Text>
              <TouchableOpacity onPress={() => setResult(null)} style={{ marginLeft: "auto" }}>
                <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <LinkedText text={result} colors={colors} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  searchBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 12 },
  suggestions: { gap: 8 },
  sugTitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  sugChip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  sugText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  center: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  resultMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  resultText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  link: { textDecorationLine: "underline" },
});
