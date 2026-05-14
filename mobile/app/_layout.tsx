import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SQLiteProvider } from "expo-sqlite";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View, Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { initDb } from "@/lib/sqlite-service";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const SCREEN_OPTS = { headerShown: false, presentation: "card", gestureEnabled: true } as const;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Editor */}
      <Stack.Screen name="editor" options={SCREEN_OPTS} />

      {/* Histórico */}
      <Stack.Screen name="historico" options={SCREEN_OPTS} />

      {/* Processos */}
      <Stack.Screen name="consulta-processual" options={SCREEN_OPTS} />
      <Stack.Screen name="pdpj" options={SCREEN_OPTS} />
      <Stack.Screen name="painel" options={SCREEN_OPTS} />
      <Stack.Screen name="tramitacao" options={SCREEN_OPTS} />
      <Stack.Screen name="djen" options={SCREEN_OPTS} />
      <Stack.Screen name="comunicacoes" options={SCREEN_OPTS} />
      <Stack.Screen name="corporativo" options={SCREEN_OPTS} />
      <Stack.Screen name="token-generator" options={SCREEN_OPTS} />

      {/* Ferramentas */}
      <Stack.Screen name="codigo" options={SCREEN_OPTS} />
      <Stack.Screen name="filtrador" options={SCREEN_OPTS} />
      <Stack.Screen name="ementas" options={SCREEN_OPTS} />
      <Stack.Screen name="playground" options={SCREEN_OPTS} />
      <Stack.Screen name="comparador" options={SCREEN_OPTS} />
      <Stack.Screen name="importador" options={SCREEN_OPTS} />
      <Stack.Screen name="pesquisa-web" options={SCREEN_OPTS} />

      {/* Admin */}
      <Stack.Screen name="admin" options={SCREEN_OPTS} />
    </Stack>
  );
}

/** Shown in the browser preview — real app runs via Expo Go on device */
function WebBanner() {
  return (
    <View style={wb.container}>
      <View style={wb.card}>
        <Text style={wb.icon}>⚖️</Text>
        <Text style={wb.title}>Assistente Jurídico</Text>
        <Text style={wb.subtitle}>App Móvel para Advogados</Text>
        <View style={wb.divider} />
        <Text style={wb.body}>
          Este app utiliza SQLite nativo e recursos exclusivos do dispositivo.
          {"\n\n"}
          Para usar, instale o <Text style={wb.bold}>Expo Go</Text> no seu
          smartphone e escaneie o QR Code exibido no console do workflow.
        </Text>
        <View style={wb.featureBox}>
          <Text style={wb.featureTitle}>20 telas incluídas:</Text>
          <Text style={wb.feature}>• Editor de documentos jurídicos (ABNT)</Text>
          <Text style={wb.feature}>• Pesquisa de jurisprudência por IA</Text>
          <Text style={wb.feature}>• Consulta processual (DataJud)</Text>
          <Text style={wb.feature}>• Filtrador, ementas, comparador</Text>
          <Text style={wb.feature}>• Configuração multi-provedor de IA</Text>
          <Text style={wb.feature}>• Google Drive, Neon PostgreSQL</Text>
        </View>
        <View style={wb.badge}>
          <Text style={wb.badgeText}>Pronto para EAS Build (APK)</Text>
        </View>
      </View>
    </View>
  );
}

const wb = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F3EF", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  icon: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#1B3A6B", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6B6B80", textAlign: "center", marginTop: 4, marginBottom: 16 },
  divider: { height: 1, backgroundColor: "#E8E6DF", marginBottom: 16 },
  body: { fontSize: 14, color: "#1A1A2E", lineHeight: 22, textAlign: "center", marginBottom: 20 },
  bold: { fontWeight: "700" },
  featureBox: { backgroundColor: "#EEF1F6", borderRadius: 10, padding: 14, marginBottom: 16 },
  featureTitle: { fontSize: 13, fontWeight: "700", color: "#1B3A6B", marginBottom: 8 },
  feature: { fontSize: 13, color: "#1A1A2E", lineHeight: 22 },
  badge: { backgroundColor: "#1B3A6B", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // Web: SQLite uses SharedArrayBuffer (unavailable in iframes / cross-origin).
  // Show an informational banner instead of crashing.
  if (Platform.OS === "web") {
    return (
      <SafeAreaProvider>
        <WebBanner />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SettingsProvider>
          <SQLiteProvider
            databaseName="legal_assistant.db"
            onInit={async (db) => { initDb(db); }}
          >
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </SQLiteProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
