import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import {
  testNeonConnection, initNeonTables, listNeonTables, neonQuery,
  getJurisprudenciasFromNeon, getEmentasFromNeon, getTemplatesFromNeon,
} from "@/lib/neon-client";
import { getAllDocuments, getAiHistory } from "@/lib/sqlite-service";

interface StatCard { label: string; value: number | string; icon: string; color: string; }

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { dbConfigs, getActiveDBConfig } = useSettings();

  const [loading, setLoading] = useState(false);
  const [neonStatus, setNeonStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [neonTables, setNeonTables] = useState<string[]>([]);
  const [neonCounts, setNeonCounts] = useState<Record<string, number>>({});
  const [localStats, setLocalStats] = useState({ docs: 0, history: 0 });
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<string[]>([]);

  const activeDB = getActiveDBConfig();

  const loadLocalStats = useCallback(() => {
    const docs = getAllDocuments(db).length;
    const hist = getAiHistory(db).length;
    setLocalStats({ docs, history: hist });
  }, [db]);

  useEffect(() => { loadLocalStats(); }, [loadLocalStats]);

  const checkNeon = async () => {
    if (!activeDB) { Alert.alert("Sem banco configurado", "Configure um banco em Configurações."); return; }
    setLoading(true); setNeonStatus(null); setNeonTables([]);
    try {
      const status = await testNeonConnection(activeDB.connectionString);
      setNeonStatus(status);
      if (status.ok) {
        const tables = await listNeonTables(activeDB.connectionString);
        setNeonTables(tables);
        const counts: Record<string, number> = {};
        for (const t of tables) {
          try {
            const r = await neonQuery(activeDB.connectionString, `SELECT COUNT(*) as n FROM ${t}`);
            counts[t] = Number(r.rows[0]?.n ?? 0);
          } catch {}
        }
        setNeonCounts(counts);
      }
    } finally { setLoading(false); }
  };

  const createTables = async () => {
    if (!activeDB) return;
    setLoading(true);
    try {
      const r = await initNeonTables(activeDB.connectionString);
      if (r.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Tabelas criadas", r.tables.join(", "));
        await checkNeon();
      } else {
        Alert.alert("Erro", r.error ?? "Falha ao criar tabelas.");
      }
    } finally { setLoading(false); }
  };

  const syncAllToNeon = async () => {
    if (!activeDB) { Alert.alert("Sem banco configurado"); return; }
    setSyncing("all"); setSyncResults([]);
    const log: string[] = [];
    try {
      const { syncDocumentToNeon } = await import("@/lib/neon-client");
      const docs = getAllDocuments(db);
      let synced = 0;
      for (const doc of docs) {
        try {
          await syncDocumentToNeon(activeDB.connectionString, doc);
          synced++;
        } catch (e: any) { log.push(`❌ doc ${doc.id}: ${e.message}`); }
      }
      log.unshift(`✅ ${synced}/${docs.length} documentos sincronizados`);
      setSyncResults(log);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await checkNeon();
    } catch (e: any) {
      setSyncResults([`❌ Erro geral: ${e.message}`]);
    } finally { setSyncing(null); }
  };

  const clearNeonTable = async (table: string) => {
    if (!activeDB) return;
    Alert.alert("Apagar tabela", `Apagar TODOS os registros de "${table}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive",
        onPress: async () => {
          try {
            await neonQuery(activeDB.connectionString, `DELETE FROM ${table}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await checkNeon();
          } catch (e: any) { Alert.alert("Erro", e.message); }
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const dbName = activeDB?.name ?? "Nenhum";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Painel Admin</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>DB: {dbName}</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Local stats */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>SQLite Local (offline)</Text>
        <View style={styles.statsRow}>
          <StatCard icon="file-text" label="Documentos" value={localStats.docs} color={colors.primary} colors={colors} />
          <StatCard icon="clock" label="Histórico IA" value={localStats.history} color={colors.accent} colors={colors} />
        </View>

        {/* Neon status */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Banco Externo (Neon/Postgres)</Text>
        {activeDB ? (
          <>
            {neonStatus && (
              <View style={[styles.statusBanner, { backgroundColor: neonStatus.ok ? colors.success + "15" : colors.destructive + "15", borderColor: neonStatus.ok ? colors.success : colors.destructive }]}>
                <Feather name={neonStatus.ok ? "check-circle" : "x-circle"} size={15} color={neonStatus.ok ? colors.success : colors.destructive} />
                <Text style={[styles.statusText, { color: neonStatus.ok ? colors.success : colors.destructive }]}>{neonStatus.message}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]} onPress={checkNeon} disabled={loading}>
                <Feather name="wifi" size={14} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Verificar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]} onPress={createTables} disabled={loading}>
                <Feather name="layers" size={14} color={colors.accent} />
                <Text style={[styles.actionBtnText, { color: colors.accent }]}>Criar Tabelas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border, flex: 1 }]} onPress={syncAllToNeon} disabled={!!syncing}>
                {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="upload-cloud" size={14} color={colors.primary} />}
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Sincronizar</Text>
              </TouchableOpacity>
            </View>

            {/* Tables */}
            {neonTables.length > 0 && (
              <View style={[styles.tablesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.tablesTitle, { color: colors.foreground }]}>Tabelas no banco ({neonTables.length})</Text>
                {neonTables.map(t => (
                  <View key={t} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    <Feather name="table" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.tableName, { color: colors.foreground }]}>{t}</Text>
                    {neonCounts[t] !== undefined && (
                      <View style={[styles.countBadge, { backgroundColor: colors.primary + "15" }]}>
                        <Text style={[styles.countText, { color: colors.primary }]}>{neonCounts[t]} registros</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.deleteTableBtn} onPress={() => clearNeonTable(t)}>
                      <Feather name="trash-2" size={12} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Sync log */}
            {syncResults.length > 0 && (
              <View style={[styles.logCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.logTitle, { color: colors.foreground }]}>Log de sincronização</Text>
                {syncResults.map((l, i) => (
                  <Text key={i} style={[styles.logLine, { color: l.startsWith("✅") ? colors.success : l.startsWith("❌") ? colors.destructive : colors.mutedForeground }]}>{l}</Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="database" size={28} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum banco externo configurado. Adicione um em Configurações → Bancos de Dados.</Text>
            <TouchableOpacity style={[styles.goSettingsBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/configuracoes")}>
              <Text style={[styles.goSettingsBtnText, { color: colors.primaryForeground }]}>Ir para Configurações</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DB configs list */}
        {dbConfigs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bancos configurados ({dbConfigs.length})</Text>
            {dbConfigs.map(db => (
              <View key={db.id} style={[styles.dbCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.dbDot, { backgroundColor: db.id === activeDB?.id ? colors.success : colors.muted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dbName, { color: colors.foreground }]}>{db.name}</Text>
                  <Text style={[styles.dbProvider, { color: colors.mutedForeground }]}>{db.provider}</Text>
                </View>
                {db.id === activeDB?.id && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "40" }]}>
                    <Text style={[styles.activeBadgeText, { color: colors.success }]}>Ativo</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color, colors }: { icon: string; label: string; value: number | string; color: string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
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
  content: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  statusText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  buttonRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tablesCard: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  tablesTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", padding: 10 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tableName: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  countText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  deleteTableBtn: { padding: 4 },
  logCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 3 },
  logTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  logLine: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  goSettingsBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  goSettingsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dbCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  dbDot: { width: 8, height: 8, borderRadius: 4 },
  dbName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dbProvider: { fontSize: 11, fontFamily: "Inter_400Regular" },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  activeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
