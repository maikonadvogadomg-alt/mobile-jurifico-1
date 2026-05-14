import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";
import type SQLite from "expo-sqlite";

interface ProcessoMonitorado {
  id: string; numero: string; tribunal: string; apelido: string;
  status: "ativo" | "encerrado" | "suspenso"; ultima_verificacao: number;
  ultimo_movimento: string; created_at: number;
}

function initProcessos(db: SQLite.SQLiteDatabase) {
  db.execSync(`CREATE TABLE IF NOT EXISTS processos_monitorados (
    id TEXT PRIMARY KEY, numero TEXT NOT NULL, tribunal TEXT DEFAULT '',
    apelido TEXT DEFAULT '', status TEXT DEFAULT 'ativo',
    ultima_verificacao INTEGER DEFAULT 0, ultimo_movimento TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now')*1000)
  );`);
}

function getProcessos(db: SQLite.SQLiteDatabase): ProcessoMonitorado[] {
  return db.getAllSync<ProcessoMonitorado>("SELECT * FROM processos_monitorados ORDER BY created_at DESC");
}
function saveProcesso(db: SQLite.SQLiteDatabase, p: Omit<ProcessoMonitorado, "ultima_verificacao" | "ultimo_movimento" | "created_at">): void {
  db.runSync(`INSERT OR REPLACE INTO processos_monitorados (id, numero, tribunal, apelido, status, ultima_verificacao, ultimo_movimento, created_at)
    VALUES (?, ?, ?, ?, ?, 0, '', ?) ON CONFLICT(id) DO UPDATE SET numero=excluded.numero, tribunal=excluded.tribunal, apelido=excluded.apelido, status=excluded.status`,
    p.id, p.numero, p.tribunal, p.apelido, p.status, Date.now());
}
function updateProcessoStatus(db: SQLite.SQLiteDatabase, id: string, movimento: string): void {
  db.runSync("UPDATE processos_monitorados SET ultima_verificacao=?, ultimo_movimento=? WHERE id=?", Date.now(), movimento, id);
}
function deleteProcesso(db: SQLite.SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM processos_monitorados WHERE id=?", id);
}

const TRIBUNAIS = ["tjmg","tjsp","tjrj","trf1","trf3","trf5","tst","stj","trt3"];
const STATUS_LABELS: Record<string, string> = { ativo: "Ativo", encerrado: "Encerrado", suspenso: "Suspenso" };
const STATUS_COLORS: Record<string, string> = { ativo: "#16A34A", encerrado: "#6B7280", suspenso: "#D97706" };

export default function PainelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { settings } = useSettings();

  const [processos, setProcessos] = useState<ProcessoMonitorado[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ numero: "", tribunal: "tjmg", apelido: "", status: "ativo" as const });

  useEffect(() => { try { initProcessos(db); } catch {} }, [db]);
  const load = useCallback(() => setProcessos(getProcessos(db)), [db]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleAdd = () => {
    if (!form.numero.replace(/\D/g, "")) { Alert.alert("Atenção", "Informe o número do processo."); return; }
    saveProcesso(db, { id: Date.now().toString(36), ...form });
    setShowAdd(false);
    setForm({ numero: "", tribunal: "tjmg", apelido: "", status: "ativo" });
    load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCheck = async (p: ProcessoMonitorado) => {
    if (!settings.datajudKey) { Alert.alert("Chave DataJud necessária", "Configure em Configurações."); return; }
    setChecking(p.id);
    try {
      const num = p.numero.replace(/\D/g, "");
      const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${p.tribunal}/_search`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `ApiKey ${settings.datajudKey}` },
        body: JSON.stringify({ query: { match: { "numeroProcesso.keyword": num } }, size: 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const hit = data?.hits?.hits?.[0]?._source;
      const movimento = hit?.movimentos?.[0]?.nome || hit?.situacao || "Sem movimentos";
      updateProcessoStatus(db, p.id, movimento);
      load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally { setChecking(null); }
  };

  const handleDelete = (p: ProcessoMonitorado) => {
    Alert.alert("Remover", `Remover ${p.apelido || p.numero}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => { deleteProcesso(db, p.id); load(); } },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Painel de Processos</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{processos.length} processo(s) monitorado(s)</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}>
        {processos.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={44} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum processo monitorado</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para adicionar um processo para acompanhar</Text>
          </View>
        ) : processos.map(p => {
          const sc = STATUS_COLORS[p.status] ?? colors.mutedForeground;
          return (
            <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  {p.apelido ? <Text style={[styles.cardApelido, { color: colors.foreground }]}>{p.apelido}</Text> : null}
                  <Text style={[styles.cardNumero, { color: p.apelido ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>{p.numero}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>{p.tribunal.toUpperCase()}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "20", borderColor: sc + "40" }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABELS[p.status]}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.btn, { borderColor: colors.primary + "40" }]} onPress={() => handleCheck(p)} disabled={checking === p.id}>
                    {checking === p.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { borderColor: colors.border }]} onPress={() => router.push({ pathname: "/consulta-processual", params: { numero: p.numero } })}>
                    <Feather name="external-link" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { borderColor: colors.destructive + "40" }]} onPress={() => handleDelete(p)}>
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
              {p.ultimo_movimento ? (
                <View style={[styles.movBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name="activity" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.movText, { color: colors.mutedForeground }]} numberOfLines={2}>{p.ultimo_movimento}</Text>
                </View>
              ) : null}
              {p.ultima_verificacao > 0 && (
                <Text style={[styles.verif, { color: colors.mutedForeground }]}>
                  Verificado em {new Date(p.ultima_verificacao).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Processo</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.foreground }]}>Número CNJ *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={form.numero} onChangeText={set("numero")} placeholder="0000000-00.0000.0.00.0000" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Apelido (opcional)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={form.apelido} onChangeText={set("apelido")} placeholder="Ex: Ação de indenização João" placeholderTextColor={colors.mutedForeground} />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Tribunal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {TRIBUNAIS.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: form.tribunal === t ? colors.primary : colors.secondary, borderColor: form.tribunal === t ? colors.primary : colors.border }]} onPress={() => set("tribunal")(t)}>
                  <Text style={[styles.chipText, { color: form.tribunal === t ? colors.primaryForeground : colors.foreground }]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Adicionar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", gap: 10 },
  cardApelido: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cardNumero: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardActions: { gap: 5 },
  btn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  movBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 7, borderWidth: 1 },
  movText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  verif: { fontSize: 10, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 12 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
