import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

interface DiffLine {
  type: "equal" | "added" | "removed" | "changed"; a: string; b: string; lineNum: number;
}

function computeDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < maxLen; i++) {
    const al = aLines[i] ?? "";
    const bl = bLines[i] ?? "";
    if (!aLines[i]) result.push({ type: "added", a: "", b: bl, lineNum: i + 1 });
    else if (!bLines[i]) result.push({ type: "removed", a: al, b: "", lineNum: i + 1 });
    else if (al === bl) result.push({ type: "equal", a: al, b: bl, lineNum: i + 1 });
    else result.push({ type: "changed", a: al, b: bl, lineNum: i + 1 });
  }
  return result;
}

const DIFF_COLORS: Record<DiffLine["type"], { bg: string; border: string }> = {
  equal:   { bg: "transparent",     border: "transparent" },
  added:   { bg: "#16A34A15",       border: "#16A34A40" },
  removed: { bg: "#DC262615",       border: "#DC262640" },
  changed: { bg: "#D9770615",       border: "#D9770640" },
};

export default function ComparadorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [stats, setStats] = useState({ added: 0, removed: 0, changed: 0, equal: 0 });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const [filterType, setFilterType] = useState<DiffLine["type"] | "all">("all");

  const handleCompare = useCallback(() => {
    if (!textA.trim() && !textB.trim()) { Alert.alert("Atenção", "Preencha pelo menos um dos campos."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lines = computeDiff(textA, textB);
    setDiff(lines);
    const s = { added: 0, removed: 0, changed: 0, equal: 0 };
    lines.forEach(l => s[l.type]++);
    setStats(s);
    setAiAnalysis(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [textA, textB]);

  const handleAiAnalysis = async () => {
    if (!textA || !textB) { Alert.alert("Atenção", "Preencha os dois textos."); return; }
    if (!aiProviders.length) { Alert.alert("Sem IA", "Configure um provedor de IA."); return; }
    setAnalyzing(true); setAiAnalysis(null);
    try {
      const msgs: AiMessage[] = [
        { role: "system", content: "Você é um assistente jurídico especializado em análise de documentos. Analise as diferenças entre dois textos jurídicos de forma clara e objetiva em português." },
        { role: "user", content: `Compare os dois textos jurídicos abaixo e explique as principais diferenças, implicações jurídicas e qual versão é mais favorável (se aplicável):\n\n**VERSÃO A:**\n${textA.slice(0, 2000)}\n\n**VERSÃO B:**\n${textB.slice(0, 2000)}` },
      ];
      const result = await callAI(msgs, aiProviders);
      setAiAnalysis(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally { setAnalyzing(false); }
  };

  const filtered = diff?.filter(l => filterType === "all" ? l.type !== "equal" : l.type === filterType) ?? [];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Comparador</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Diff de documentos jurídicos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        {/* Input A */}
        <View style={styles.inputHeader}>
          <Text style={[styles.label, { color: colors.foreground }]}>Versão A (original)</Text>
          <TouchableOpacity onPress={() => setShowA(!showA)} style={[styles.toggleBtn, { borderColor: colors.border }]}>
            <Text style={[styles.toggleBtnText, { color: colors.primary }]}>{showA ? "Ocultar" : "Editar"}</Text>
          </TouchableOpacity>
        </View>
        {showA && (
          <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput style={[styles.textArea, { color: colors.foreground }]} value={textA} onChangeText={setTextA} placeholder="Cole o texto original aqui..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={6} textAlignVertical="top" />
          </View>
        )}
        {!showA && textA ? <Text style={[styles.previewLine, { color: colors.mutedForeground }]}>{textA.split("\n")[0].slice(0, 80)}...</Text> : null}

        {/* Input B */}
        <View style={styles.inputHeader}>
          <Text style={[styles.label, { color: colors.foreground }]}>Versão B (revisada)</Text>
          <TouchableOpacity onPress={() => setShowB(!showB)} style={[styles.toggleBtn, { borderColor: colors.border }]}>
            <Text style={[styles.toggleBtnText, { color: colors.primary }]}>{showB ? "Ocultar" : "Editar"}</Text>
          </TouchableOpacity>
        </View>
        {showB && (
          <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput style={[styles.textArea, { color: colors.foreground }]} value={textB} onChangeText={setTextB} placeholder="Cole o texto revisado aqui..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={6} textAlignVertical="top" />
          </View>
        )}
        {!showB && textB ? <Text style={[styles.previewLine, { color: colors.mutedForeground }]}>{textB.split("\n")[0].slice(0, 80)}...</Text> : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.compareBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={handleCompare}>
            <Feather name="git-branch" size={16} color={colors.primaryForeground} />
            <Text style={[styles.compareBtnText, { color: colors.primaryForeground }]}>Comparar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.compareBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]} onPress={handleAiAnalysis} disabled={analyzing}>
            {analyzing ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="cpu" size={16} color={colors.primary} />}
            <Text style={[styles.compareBtnText, { color: colors.primary }]}>Analisar IA</Text>
          </TouchableOpacity>
        </View>

        {diff && (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              {([["all", "Tudo", diff.filter(l => l.type !== "equal").length, colors.foreground],
                ["added", "+ Adicionadas", stats.added, "#16A34A"],
                ["removed", "- Removidas", stats.removed, "#DC2626"],
                ["changed", "~ Alteradas", stats.changed, "#D97706"]] as [DiffLine["type"] | "all", string, number, string][]).map(([type, label, count, color]) => (
                <TouchableOpacity key={type} style={[styles.statBtn, { backgroundColor: filterType === type ? color + "20" : colors.secondary, borderColor: filterType === type ? color : colors.border }]} onPress={() => setFilterType(type)}>
                  <Text style={[styles.statCount, { color }]}>{count}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Diff lines */}
            <View style={[styles.diffCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {filtered.length === 0 ? (
                <Text style={[styles.noDiff, { color: colors.mutedForeground }]}>
                  {filterType === "all" ? "Textos idênticos!" : "Nenhuma diferença deste tipo."}
                </Text>
              ) : filtered.map((line, i) => {
                const dc = DIFF_COLORS[line.type];
                return (
                  <View key={i} style={[styles.diffLine, { backgroundColor: dc.bg, borderLeftColor: line.type === "equal" ? "transparent" : dc.border }]}>
                    <Text style={[styles.lineNum, { color: colors.mutedForeground }]}>{line.lineNum}</Text>
                    {line.type === "changed" ? (
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.diffText, { color: "#DC2626", textDecorationLine: "line-through" }]}>{line.a}</Text>
                        <Text style={[styles.diffText, { color: "#16A34A" }]}>{line.b}</Text>
                      </View>
                    ) : line.type === "added" ? (
                      <Text style={[styles.diffText, { color: "#16A34A", flex: 1 }]}>+ {line.b}</Text>
                    ) : line.type === "removed" ? (
                      <Text style={[styles.diffText, { color: "#DC2626", flex: 1, textDecorationLine: "line-through" }]}>- {line.a}</Text>
                    ) : (
                      <Text style={[styles.diffText, { color: colors.mutedForeground, flex: 1 }]}>{line.a}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {aiAnalysis && (
          <View style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.analysisHeader}>
              <Feather name="cpu" size={14} color={colors.primary} />
              <Text style={[styles.analysisTitle, { color: colors.foreground }]}>Análise da IA</Text>
            </View>
            <Text style={[styles.analysisText, { color: colors.foreground }]}>{aiAnalysis}</Text>
          </View>
        )}
      </ScrollView>
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
  inputHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  toggleBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  textAreaWrap: { borderRadius: 10, borderWidth: 1, padding: 12 },
  textArea: { fontSize: 12, fontFamily: "Inter_400Regular", minHeight: 100, lineHeight: 18 },
  previewLine: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  buttonRow: { flexDirection: "row", gap: 8 },
  compareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  compareBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 6 },
  statBtn: { flex: 1, alignItems: "center", padding: 8, borderRadius: 8, borderWidth: 1, gap: 2 },
  statCount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  diffCard: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  diffLine: { flexDirection: "row", gap: 6, paddingVertical: 3, paddingHorizontal: 8, borderLeftWidth: 3 },
  lineNum: { fontSize: 10, fontFamily: "Inter_400Regular", width: 26, textAlign: "right", paddingTop: 1 },
  diffText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17 },
  noDiff: { textAlign: "center", padding: 20, fontSize: 13, fontFamily: "Inter_400Regular" },
  analysisCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  analysisHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  analysisTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  analysisText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
