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
  { id: "datajud",    title: "Consulta Processual",    subtitle: "Busca via DataJud · CNJ",              icon: "search",      route: "/consulta-processual", color: "#1B3A6B" },
  { id: "pdpj",       title: "Consulta PDPJ",          subtitle: "Portal de Dados do Poder Judiciário",   icon: "database",    route: "/pdpj",                color: "#1B5E20" },
  { id: "painel",     title: "Painel de Processos",    subtitle: "Monitorar processos salvos",            icon: "monitor",     route: "/painel",              color: "#4A148C" },
  { id: "tramitacao", title: "Tramitação / Publicações", subtitle: "Acompanhar movimentações",            icon: "activity",    route: "/tramitacao",          color: "#B71C1C" },
  { id: "djen",       title: "Robô DJEN",              subtitle: "Diário de Justiça Eletrônico · MG",     icon: "cpu",         route: "/djen",                color: "#E65100" },
  { id: "cnj",        title: "Comunicações CNJ",       subtitle: "Intimações e comunicados CNJ",          icon: "bell",        route: "/comunicacoes",        color: "#006064" },
  { id: "corporativo", title: "Consulta Corporativo",  subtitle: "CPF, OAB, CNPJ, sócio",               icon: "briefcase",   route: "/corporativo",         color: "#37474F" },
  { id: "token",      title: "Gerador de Token PDPJ",  subtitle: "Autenticação para peticionamento",      icon: "key",         route: "/token-generator",     color: "#F57F17" },
];

export default function ProcessosTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Processos</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Consultas e monitoramento processual</Text>
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
