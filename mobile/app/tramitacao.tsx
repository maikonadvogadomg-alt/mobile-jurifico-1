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

interface Tramitacao {
  id: string; titulo: string; descricao: string; prazo: string; status: "pendente" | "concluido" | "vencido";
  processo: string; tribunal: string; tipo: string; created_at: number;
}

function initTramitacao(db: SQLite.SQLiteDatabase) {
  db.execSync(`CREATE TABLE IF NOT EXISTS tramitacoes (
    id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descricao TEXT DEFAULT '',
    prazo TEXT DEFAULT '', status TEXT DEFAULT 'pendente',
    processo TEXT DEFAULT '', tribunal TEXT DEFAULT '', tipo TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now')*1000)
  );`);
}
function getTramitacoes(db: SQLite.SQLiteDatabase): Tramitacao[] {
  return db.getAllSync<Tramitacao>("SELECT * FROM tramitacoes ORDER BY prazo ASC, created_at DESC");
}
function saveTramitacao(db: SQLite.SQLiteDatabase, t: Tramitacao): void {
  db.runSync(`INSERT OR REPLACE INTO tramitacoes VALUES (?,?,?,?,?,?,?,?,?)`,
    t.id, t.titulo, t.descricao, t.prazo, t.status, t.processo, t.tribunal, t.tipo, t.created_at);
}
function deleteTramitacao(db: SQLite.SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM tramitacoes WHERE id=?", id);
}

const TIPOS = ["Prazo Processual", "Audiência", "Perícia", "Intimação", "Recurso", "Sustentação Oral", "Pagamento", "Outro"];
const STATUS_COLORS: Record<string, string> = { pendente: "#D97706", concluido: "#16A34A", vencido: "#DC2626" };
const STATUS_LABELS: Record<string, string> = { pendente: "Pendente", concluido: "Concluído", vencido: "Vencido" };

function isVencido(prazo: string): boolean {
  if (!prazo) return false;
  return new Date(prazo) < new Date(new Date().toISOString().slice(0, 10));
}
function diasRestantes(prazo: string): number | null {
  if (!prazo) return null;
  const diff = new Date(prazo).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function TramitacaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const [items, setItems] = useState<Tramitacao[]>([]);
  const [filter, setFilter] = useState<"todos" | "pendente" | "concluido" | "vencido">("todos");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Tramitacao>({
    id: "", titulo: "", descricao: "", prazo: new Date().toISOString().slice(0, 10),
    status: "pendente", processo: "", tribunal: "", tipo: "Prazo Processual", created_at: Date.now(),
  });

  useEffect(() => { try { initTramitacao(db); } catch {} }, [db]);
  const load = useCallback(() => setItems(getTramitacoes(db)), [db]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), titulo: "", descricao: "", prazo: new Date(Date.now() + 86400000).toISOString().slice(0, 10), status: "pendente", processo: "", tribunal: "", tipo: "Prazo Processual", created_at: Date.now() }); setShowAdd(true); };

  const handleSave = () => {
    if (!form.titulo.trim()) { Alert.alert("Atenção", "Informe o título."); return; }
    const status = form.status === "pendente" && isVencido(form.prazo) ? "vencido" : form.status;
    saveTramitacao(db, { ...form, status });
    setShowAdd(false); load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const markDone = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    saveTramitacao(db, { ...item, status: "concluido" });
    load(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Remover", "Remover este prazo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => { deleteTramitacao(db, id); load(); } },
    ]);
  };

  const set = (k: keyof Tramitacao) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const filtered = filter === "todos" ? items : items.filter(i => {
    const effectiveStatus = i.status === "pendente" && isVencido(i.prazo) ? "vencido" : i.status;
    return effectiveStatus === filter;
  });

  const counts = { todos: items.length, pendente: 0, concluido: 0, vencido: 0 };
  items.forEach(i => {
    const s = i.status === "pendente" && isVencido(i.prazo) ? "vencido" : i.status;
    counts[s as keyof typeof counts]++;
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Tramitação</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{items.length} prazo(s) registrado(s)</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openNew}>
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterRow, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
        {(["todos", "pendente", "vencido", "concluido"] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.secondary, borderColor: filter === f ? colors.primary : colors.border }]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterChipText, { color: filter === f ? colors.primaryForeground : colors.foreground }]}>
              {f === "todos" ? "Todos" : STATUS_LABELS[f]} ({counts[f]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum prazo</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para adicionar um prazo processual</Text>
          </View>
        ) : filtered.map(item => {
          const effectiveStatus = item.status === "pendente" && isVencido(item.prazo) ? "vencido" : item.status;
          const sc = STATUS_COLORS[effectiveStatus];
          const dias = diasRestantes(item.prazo);
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: effectiveStatus === "vencido" ? colors.destructive + "40" : colors.border, borderLeftColor: sc, borderLeftWidth: 3 }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.titulo}</Text>
                  {item.processo ? <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{item.processo} {item.tribunal ? `· ${item.tribunal}` : ""}</Text> : null}
                  <View style={styles.metaRow}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[styles.typeText, { color: colors.mutedForeground }]}>{item.tipo}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "20", borderColor: sc + "40" }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABELS[effectiveStatus]}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  {item.prazo ? (
                    <View style={{ alignItems: "center" }}>
                      <Text style={[styles.prazoDate, { color: effectiveStatus === "vencido" ? colors.destructive : colors.foreground }]}>
                        {item.prazo.slice(0, 10).split("-").reverse().join("/")}
                      </Text>
                      {dias !== null && effectiveStatus !== "concluido" && (
                        <Text style={[styles.diasText, { color: dias <= 0 ? colors.destructive : dias <= 5 ? colors.warning : colors.success }]}>
                          {dias <= 0 ? "Vencido" : `${dias}d`}
                        </Text>
                      )}
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {effectiveStatus !== "concluido" && (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.success + "40" }]} onPress={() => markDone(item.id)}>
                        <Feather name="check" size={13} color={colors.success} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.destructive + "40" }]} onPress={() => handleDelete(item.id)}>
                      <Feather name="trash-2" size={13} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {item.descricao ? <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.descricao}</Text> : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo Prazo</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Título *" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.titulo} onChangeText={set("titulo")} placeholder="Ex: Prazo para contestação" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Data do Prazo *" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.prazo} onChangeText={set("prazo")} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Tipo" colors={colors}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TIPOS.map(t => (
                  <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: form.tipo === t ? colors.primary : colors.secondary, borderColor: form.tipo === t ? colors.primary : colors.border }]} onPress={() => set("tipo")(t)}>
                    <Text style={[styles.chipText, { color: form.tipo === t ? colors.primaryForeground : colors.foreground }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Field>
            <Field label="Nº do Processo" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.processo} onChangeText={set("processo")} placeholder="0000000-00.0000.0.00.0000" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Tribunal" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.tribunal} onChangeText={set("tribunal")} placeholder="TJMG" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
              </View>
            </Field>
            <Field label="Descrição" colors={colors}>
              <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.textArea, { color: colors.foreground }]} value={form.descricao} onChangeText={set("descricao")} placeholder="Detalhes sobre o prazo..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" />
              </View>
            </Field>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Feather name="save" size={16} color={colors.primaryForeground} />
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Salvar Prazo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filterRow: { borderBottomWidth: 1, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", gap: 8, paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", gap: 10 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 5, marginTop: 4, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  typeText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  statusText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  cardRight: { alignItems: "flex-end", gap: 6 },
  prazoDate: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  diasText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  actions: { flexDirection: "row", gap: 5 },
  actionBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 5 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  textAreaWrap: { borderRadius: 8, borderWidth: 1, padding: 10 },
  textArea: { fontSize: 12, fontFamily: "Inter_400Regular", minHeight: 60 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 8, marginBottom: 20 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
