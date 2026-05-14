import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface FeatureItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
}

const FEATURES: FeatureItem[] = [
  { id: "importador",  title: "Importar Arquivo",       subtitle: "PDF, HTML, imagem OCR, áudio → texto", icon: "upload",       route: "/importador",     color: "#0077B6" },
  { id: "pesquisa",    title: "Pesquisa Jurídica",      subtitle: "IA com links clicáveis e fontes",      icon: "search",       route: "/pesquisa-web",   color: "#1B5E20" },
  { id: "codigo",      title: "Assistente de Código",   subtitle: "IA para gerar e revisar código",        icon: "code",         route: "/codigo",         color: "#1565C0" },
  { id: "filtrador",   title: "Filtrador Jurídico",     subtitle: "Limpar e filtrar textos",               icon: "filter",       route: "/filtrador",      color: "#2E7D32" },
  { id: "playground",  title: "Playground HTML",        subtitle: "Editor e visualizador HTML",            icon: "globe",        route: "/playground",     color: "#6A1B9A" },
  { id: "comparador",  title: "Comparador Jurídico",    subtitle: "TJMG + BCB — comparativo",              icon: "columns",      route: "/comparador",     color: "#AD1457" },
  { id: "ementas",     title: "Ementas",                subtitle: "Banco de ementas jurídicas",            icon: "book",         route: "/ementas",        color: "#BF360C" },
  { id: "historico",   title: "Histórico IA",           subtitle: "Registro de todas as ações de IA",     icon: "clock",        route: "/historico",      color: "#37474F" },
];

export default function FerramentasTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ferramentas</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Utilidades e assistentes jurídicos</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {FEATURES.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(f.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: f.color + "18" }]}>
              <Feather name={f.icon as any} size={24} color={f.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{f.title}</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{f.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  grid: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
