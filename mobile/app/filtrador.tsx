import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function cleanText(raw: string, opts: FilterOptions): { text: string; removed: number; stats: Stats } {
  let text = raw;
  let removed = 0;
  const lines = text.split("\n");

  // Remove duplicates
  if (opts.removeDups) {
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const line of lines) {
      const key = line.trim().toLowerCase();
      if (key === "" || !seen.has(key)) { filtered.push(line); if (key) seen.add(key); }
    }
    removed += lines.length - filtered.length;
    text = filtered.join("\n");
  }

  // Remove empty lines
  if (opts.removeEmpty) {
    const before = text.split("\n").length;
    text = text.split("\n").filter(l => l.trim() !== "").join("\n");
    removed += before - text.split("\n").length;
  }

  // Remove special symbols
  if (opts.cleanSymbols) {
    text = text.replace(/[▪▸►▼●•◦▶→←↔↑↓★☆■□▲△▽▿◆◇○◎∞∑∆]/g, "");
    text = text.replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, ""); // zero-width chars
  }

  // Normalize whitespace
  if (opts.normalizeSpaces) {
    text = text.replace(/[ \t]{2,}/g, " ");
    text = text.replace(/(\r?\n){3,}/g, "\n\n");
  }

  // Remove page numbers
  if (opts.removePageNums) {
    text = text.replace(/^\s*[-–]\s*\d+\s*[-–]\s*$/gm, "");
    text = text.replace(/^\s*página\s+\d+\s*$/gim, "");
    text = text.replace(/^\s*\d+\s*\/\s*\d+\s*$/gm, "");
  }

  // Remove headers/footers (common patterns)
  if (opts.removeHeaders) {
    text = text.replace(/^(.*tribunal.*|.*ministério.*|.*poder judiciário.*)$/gim, (match) => {
      removed++;
      return "";
    });
  }

  // Remove numbers only lines
  if (opts.removeNumberLines) {
    text = text.split("\n").filter(l => !/^\s*\d+[.\-\s]*\d*\s*$/.test(l)).join("\n");
  }

  text = text.trim();
  const finalLines = text.split("\n").filter(l => l.trim());
  const wordCount = text.split(/\s+/).filter(w => w).length;
  const charCount = text.length;
  return { text, removed, stats: { lines: finalLines.length, words: wordCount, chars: charCount } };
}

interface FilterOptions {
  removeDups: boolean; removeEmpty: boolean; cleanSymbols: boolean;
  normalizeSpaces: boolean; removePageNums: boolean; removeHeaders: boolean; removeNumberLines: boolean;
}
interface Stats { lines: number; words: number; chars: number; }

export default function FiltradorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [raw, setRaw] = useState("");
  const [output, setOutput] = useState("");
  const [removed, setRemoved] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [opts, setOpts] = useState<FilterOptions>({
    removeDups: true, removeEmpty: true, cleanSymbols: true,
    normalizeSpaces: true, removePageNums: true, removeHeaders: false, removeNumberLines: false,
  });

  const toggle = (k: keyof FilterOptions) => setOpts(p => ({ ...p, [k]: !p[k] }));

  const handleFilter = useCallback(() => {
    if (!raw.trim()) { Alert.alert("Atenção", "Cole o texto no campo de entrada."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { text, removed: rm, stats: st } = cleanText(raw, opts);
    setOutput(text); setRemoved(rm); setStats(st);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [raw, opts]);

  const handleCopy = async () => {
    if (!output) return;
    await Clipboard.setStringAsync(output);
    Alert.alert("Copiado", "Texto filtrado copiado.");
  };

  const handleClear = () => { setRaw(""); setOutput(""); setRemoved(0); setStats(null); };

  const OPT_LABELS: [keyof FilterOptions, string][] = [
    ["removeDups",      "Remover linhas duplicadas"],
    ["removeEmpty",     "Remover linhas vazias"],
    ["cleanSymbols",    "Limpar símbolos especiais"],
    ["normalizeSpaces", "Normalizar espaços"],
    ["removePageNums",  "Remover nº de páginas"],
    ["removeHeaders",   "Remover cabeçalhos de tribunal"],
    ["removeNumberLines", "Remover linhas só com números"],
  ];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Filtrador Jurídico</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Limpar e filtrar textos</Text>
        </View>
        <TouchableOpacity onPress={handleClear}><Feather name="refresh-cw" size={18} color={colors.mutedForeground} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.foreground }]}>Texto de entrada</Text>
        <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textArea, { color: colors.foreground }]}
            value={raw} onChangeText={setRaw}
            placeholder="Cole o texto a ser filtrado aqui..."
            placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={8} textAlignVertical="top"
          />
        </View>
        {raw ? <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{raw.length} caracteres · {raw.split("\n").length} linhas</Text> : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Opções de Filtragem</Text>
        <View style={[styles.optsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {OPT_LABELS.map(([k, lbl]) => (
            <View key={k} style={[styles.optRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.optLabel, { color: colors.foreground }]}>{lbl}</Text>
              <Switch value={opts[k]} onValueChange={() => toggle(k)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.primary }]} onPress={handleFilter}>
          <Feather name="filter" size={17} color={colors.primaryForeground} />
          <Text style={[styles.filterBtnText, { color: colors.primaryForeground }]}>Filtrar Texto</Text>
        </TouchableOpacity>

        {stats && (
          <View style={[styles.statsRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <StatBadge label="Linhas" value={stats.lines} colors={colors} />
            <StatBadge label="Palavras" value={stats.words} colors={colors} />
            <StatBadge label="Chars" value={stats.chars} colors={colors} />
            {removed > 0 && <StatBadge label="Removidas" value={removed} colors={colors} highlight />}
          </View>
        )}

        {output ? (
          <View style={[styles.outputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.outputHeader}>
              <Text style={[styles.label, { color: colors.foreground }]}>Texto filtrado</Text>
              <TouchableOpacity style={[styles.copyBtn, { borderColor: colors.border }]} onPress={handleCopy}>
                <Feather name="copy" size={14} color={colors.primary} />
                <Text style={[styles.copyText, { color: colors.primary }]}>Copiar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.outputScroll} nestedScrollEnabled>
              <Text style={[styles.outputText, { color: colors.foreground }]}>{output}</Text>
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatBadge({ label, value, colors, highlight }: { label: string; value: number; colors: any; highlight?: boolean }) {
  return (
    <View style={[styles.statBadge, { backgroundColor: highlight ? colors.warning + "20" : colors.background, borderColor: highlight ? colors.warning : colors.border }]}>
      <Text style={[styles.statValue, { color: highlight ? colors.warning : colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
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
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  textAreaWrap: { borderRadius: 12, borderWidth: 1, padding: 12 },
  textArea: { fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 160, lineHeight: 19 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  optsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  optRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  optLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  filterBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  filterBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  statBadge: { flex: 1, alignItems: "center", padding: 8, borderRadius: 8, borderWidth: 1 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  outputCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  outputHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  copyText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  outputScroll: { maxHeight: 300 },
  outputText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
