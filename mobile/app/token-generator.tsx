import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface TokenClaims {
  sub: string; name: string; iss: string; aud: string;
  jti: string; extraKey: string; extraValue: string;
  exp: number; nbf: number; iat: number;
}

function buildPayload(claims: TokenClaims): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: claims.sub, iss: claims.iss || "assistente-juridico",
    aud: claims.aud || "api", jti: claims.jti || generateUUID(),
    iat: now, nbf: claims.nbf ? Math.floor(claims.nbf) : now,
    exp: claims.exp ? Math.floor(claims.exp) : now + 3600,
  };
  if (claims.name) payload.name = claims.name;
  if (claims.extraKey && claims.extraValue) payload[claims.extraKey] = claims.extraValue;
  return payload;
}

const EXPIRY_PRESETS = [
  { label: "1h", seconds: 3600 },
  { label: "8h", seconds: 28800 },
  { label: "24h", seconds: 86400 },
  { label: "7d", seconds: 604800 },
  { label: "30d", seconds: 2592000 },
  { label: "90d", seconds: 7776000 },
];

export default function TokenGeneratorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sub, setSub] = useState("");
  const [name, setName] = useState("");
  const [iss, setIss] = useState("assistente-juridico");
  const [aud, setAud] = useState("api");
  const [jti, setJti] = useState(() => generateUUID());
  const [extraKey, setExtraKey] = useState("role");
  const [extraValue, setExtraValue] = useState("advogado");
  const [expiryOffset, setExpiryOffset] = useState(3600);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [generated, setGenerated] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [decodeInput, setDecodeInput] = useState("");

  const generateHmac = async (header: string, payload: string, k: string): Promise<string> => {
    const data = `${header}.${payload}`;
    const enc = new TextEncoder();
    const keyData = enc.encode(k);
    const dataBuffer = enc.encode(data);
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
      return base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
    }
    throw new Error("crypto.subtle não disponível neste ambiente.");
  };

  const handleGenerate = async () => {
    if (!sub.trim()) { Alert.alert("Atenção", "Informe o Subject (sub)."); return; }
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = buildPayload({ sub, name, iss, aud, jti, extraKey, extraValue, exp: now + expiryOffset, nbf: now, iat: now });
      const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const sig = secret ? await generateHmac(header, payloadB64, secret) : base64UrlEncode("unsigned");
      const token = `${header}.${payloadB64}.${sig}`;
      setGenerated(token);
      setDecoded(JSON.stringify(payload, null, 2));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  const handleDecode = () => {
    try {
      const parts = decodeInput.trim().split(".");
      if (parts.length < 2) throw new Error("JWT inválido (precisa ter 3 partes separadas por ponto).");
      const decodedHeader = JSON.parse(decodeBase64Url(parts[0]));
      const decodedPayload = JSON.parse(decodeBase64Url(parts[1]));
      const exp = decodedPayload.exp;
      const expired = exp ? exp < Math.floor(Date.now() / 1000) : false;
      setDecoded(JSON.stringify({ header: decodedHeader, payload: decodedPayload, expired }, null, 2));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro ao decodificar", e.message);
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado", "Token copiado para a área de transferência.");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Gerador de Token JWT</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Gerar e decodificar tokens</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Gerar Token</Text>

          <F label="Subject (sub) *" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={sub} onChangeText={setSub} placeholder="usuario@exemplo.com" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            </View>
          </F>
          <F label="Nome" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={name} onChangeText={setName} placeholder="Dr. João Silva" placeholderTextColor={colors.mutedForeground} />
            </View>
          </F>
          <View style={styles.rowTwo}>
            <F label="Issuer (iss)" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={iss} onChangeText={setIss} placeholder="meu-app" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
              </View>
            </F>
            <F label="Audience (aud)" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={aud} onChangeText={setAud} placeholder="api" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
              </View>
            </F>
          </View>
          <F label="Expiração" colors={colors}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {EXPIRY_PRESETS.map(p => (
                <TouchableOpacity key={p.label} style={[styles.chip, { backgroundColor: expiryOffset === p.seconds ? colors.primary : colors.secondary, borderColor: expiryOffset === p.seconds ? colors.primary : colors.border }]} onPress={() => setExpiryOffset(p.seconds)}>
                  <Text style={[styles.chipText, { color: expiryOffset === p.seconds ? colors.primaryForeground : colors.foreground }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </F>
          <View style={styles.rowTwo}>
            <F label="Campo extra (key)" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={extraKey} onChangeText={setExtraKey} placeholder="role" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
              </View>
            </F>
            <F label="Campo extra (value)" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={extraValue} onChangeText={setExtraValue} placeholder="advogado" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
              </View>
            </F>
          </View>
          <F label="Secret (HMAC-SHA256)" colors={colors}>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={secret} onChangeText={setSecret} placeholder="Deixe vazio para token não assinado" placeholderTextColor={colors.mutedForeground} secureTextEntry={!showSecret} autoCapitalize="none" autoCorrect={false} />
              <TouchableOpacity onPress={() => setShowSecret(!showSecret)}><Feather name={showSecret ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
          </F>

          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: colors.primary }]} onPress={handleGenerate}>
            <Feather name="key" size={16} color={colors.primaryForeground} />
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>Gerar Token JWT</Text>
          </TouchableOpacity>
        </View>

        {generated && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Token Gerado</Text>
              <TouchableOpacity onPress={() => handleCopy(generated)} style={[styles.copyBtn, { borderColor: colors.border }]}>
                <Feather name="copy" size={14} color={colors.primary} />
                <Text style={[styles.copyText, { color: colors.primary }]}>Copiar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.tokenScroll} horizontal showsHorizontalScrollIndicator>
              <Text style={[styles.tokenText, { color: colors.primary }]}>{generated}</Text>
            </ScrollView>
          </View>
        )}

        {/* Decode section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Decodificar Token</Text>
          <View style={[styles.textAreaWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textArea, { color: colors.foreground }]}
              value={decodeInput} onChangeText={setDecodeInput}
              placeholder="Cole o token JWT aqui..."
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={3} textAlignVertical="top"
              autoCapitalize="none" autoCorrect={false}
            />
          </View>
          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]} onPress={handleDecode}>
            <Feather name="unlock" size={16} color={colors.primary} />
            <Text style={[styles.generateBtnText, { color: colors.primary }]}>Decodificar</Text>
          </TouchableOpacity>
        </View>

        {decoded && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payload</Text>
              <TouchableOpacity onPress={() => handleCopy(decoded)} style={[styles.copyBtn, { borderColor: colors.border }]}>
                <Feather name="copy" size={14} color={colors.primary} />
                <Text style={[styles.copyText, { color: colors.primary }]}>Copiar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.decodedScroll} nestedScrollEnabled>
              <Text style={[styles.decodedText, { color: colors.foreground }]}>{decoded}</Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function F({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>{children}</View>;
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
  rowTwo: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  generateBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  copyText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tokenScroll: { maxHeight: 60 },
  tokenText: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  textAreaWrap: { borderRadius: 8, borderWidth: 1, padding: 10 },
  textArea: { fontSize: 12, fontFamily: "Inter_400Regular", minHeight: 60 },
  decodedScroll: { maxHeight: 200 },
  decodedText: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 17 },
});
