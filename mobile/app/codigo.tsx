import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import { callAI, type AiMessage } from "@/lib/ai-service";

const MODES = [
  { id: "gerar",      label: "Gerar Código",   icon: "code",        prompt: (t: string) => `Gere código completo e funcional para: ${t}\n\nForneça o código completo, comentado e pronto para uso.` },
  { id: "explicar",   label: "Explicar",        icon: "book-open",   prompt: (t: string) => `Explique o seguinte código em português detalhado:\n\n\`\`\`\n${t}\n\`\`\`` },
  { id: "revisar",    label: "Revisar",         icon: "check-circle",prompt: (t: string) => `Revise o código abaixo, aponte problemas, bugs e sugira melhorias:\n\n\`\`\`\n${t}\n\`\`\`` },
  { id: "otimizar",   label: "Otimizar",        icon: "zap",         prompt: (t: string) => `Otimize este código mantendo a funcionalidade:\n\n\`\`\`\n${t}\n\`\`\`` },
  { id: "converter",  label: "Converter",       icon: "shuffle",     prompt: (t: string) => `Converta este código para outra linguagem ou padrão mais adequado:\n\n\`\`\`\n${t}\n\`\`\`` },
  { id: "testar",     label: "Gerar Testes",    icon: "git-branch",  prompt: (t: string) => `Gere testes unitários completos para este código:\n\n\`\`\`\n${t}\n\`\`\`` },
] as const;
type ModeId = typeof MODES[number]["id"];

const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Java", "C#", "Go", "Rust", "PHP", "Ruby", "SQL"];

export default function CodigoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aiProviders } = useSettings();

  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ModeId>("gerar");
  const [lang, setLang] = useState("TypeScript");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = async () => {
    if (!input.trim()) { Alert.alert("Atenção", "Digite código ou descrição."); return; }
    if (!aiProviders.length) { Alert.alert("Sem IA", "Configure um provedor de IA nas Configurações."); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const modeObj = MODES.find(m => m.id === mode)!;
      const userPrompt = modeObj.prompt(input) + (mode === "gerar" ? `\n\nLinguagem preferida: ${lang}` : "");
      const msgs: AiMessage[] = [
        { role: "system", content: `Você é um assistente especializado em programação. Responda sempre em português. Para código, use blocos de código formatados com a linguagem indicada. Seja preciso e prático.` },
        ...messages.slice(-6),
        { role: "user", content: userPrompt },
      ];
      const res = await callAI(msgs, aiProviders, abortRef.current.signal);
      setResult(res);
      setMessages(prev => [...prev, { role: "user", content: userPrompt }, { role: "assistant", content: res }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e.name !== "AbortError") Alert.alert("Erro", e.message);
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    Alert.alert("Copiado", "Resultado copiado.");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Assistente de Código</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>IA para programação</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={() => { setMessages([]); setResult(null); }}>
            <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.foreground }]}>Modo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {MODES.map(m => (
            <TouchableOpacity key={m.id} style={[styles.chip, { backgroundColor: mode === m.id ? colors.primary : colors.secondary, borderColor: mode === m.id ? colors.primary : colors.border }]} onPress={() => setMode(m.id)}>
              <Feather name={m.icon as any} size={13} color={mode === m.id ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.chipText, { color: mode === m.id ? colors.primaryForeground : colors.foreground }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {mode === "gerar" && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Linguagem</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {LANGUAGES.map(l => (
                <TouchableOpacity key={l} style={[styles.chip, { backgroundColor: lang === l ? colors.accent + "30" : colors.secondary, borderColor: lang === l ? colors.accent : colors.border }]} onPress={() => setLang(l)}>
                  <Text style={[styles.chipText, { color: lang === l ? colors.accent : colors.foreground }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>
          {mode === "gerar" ? "Descreva o que precisa" : "Cole o código"}
        </Text>
        <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textArea, { color: colors.foreground }]}
            value={input} onChangeText={setInput}
            placeholder={mode === "gerar" ? "Ex: função para validar CPF em TypeScript..." : "Cole o código aqui..."}
            placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={6} textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={[styles.runBtn, { backgroundColor: loading ? colors.muted : colors.primary }]} onPress={handleRun} disabled={loading}>
          {loading ? (
            <>
              <ActivityIndicator size="small" color={colors.primaryForeground} />
              <Text style={[styles.runBtnText, { color: colors.primaryForeground }]}>Processando...</Text>
              <TouchableOpacity onPress={() => abortRef.current?.abort()} style={styles.abortBtn}>
                <Feather name="square" size={14} color={colors.primaryForeground} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Feather name="play" size={16} color={colors.primaryForeground} />
              <Text style={[styles.runBtnText, { color: colors.primaryForeground }]}>{MODES.find(m => m.id === mode)?.label ?? "Executar"}</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>Resultado</Text>
              <TouchableOpacity onPress={handleCopy} style={[styles.copyBtn, { borderColor: colors.border }]}>
                <Feather name="copy" size={14} color={colors.mutedForeground} />
                <Text style={[styles.copyText, { color: colors.mutedForeground }]}>Copiar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.resultScroll} nestedScrollEnabled>
              <Text style={[styles.resultText, { color: colors.foreground }]}>{result}</Text>
            </ScrollView>
          </View>
        )}
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
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  textAreaWrap: { borderRadius: 12, borderWidth: 1, padding: 12 },
  textArea: { fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 120, lineHeight: 19 },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  runBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  abortBtn: { marginLeft: 8, padding: 4 },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  copyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  resultScroll: { maxHeight: 400 },
  resultText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
