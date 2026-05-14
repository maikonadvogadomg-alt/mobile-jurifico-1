import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type SQLite from "expo-sqlite";

interface Ementa {
  id: string; titulo: string; ementa: string; tribunal: string;
  area: string; numero: string; data: string; created_at: number;
}

function initEmentas(db: SQLite.SQLiteDatabase) {
  db.execSync(`CREATE TABLE IF NOT EXISTS ementas (
    id TEXT PRIMARY KEY, titulo TEXT NOT NULL, ementa TEXT NOT NULL,
    tribunal TEXT DEFAULT '', area TEXT DEFAULT '', numero TEXT DEFAULT '',
    data TEXT DEFAULT '', created_at INTEGER DEFAULT (strftime('%s','now')*1000)
  );`);
}

function getEmentas(db: SQLite.SQLiteDatabase, search?: string): Ementa[] {
  if (search) {
    return db.getAllSync<Ementa>(
      "SELECT * FROM ementas WHERE titulo LIKE ? OR ementa LIKE ? OR tribunal LIKE ? ORDER BY created_at DESC",
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
  }
  return db.getAllSync<Ementa>("SELECT * FROM ementas ORDER BY created_at DESC");
}

function saveEmenta(db: SQLite.SQLiteDatabase, e: Omit<Ementa, "created_at">): void {
  db.runSync(
    "INSERT OR REPLACE INTO ementas (id, titulo, ementa, tribunal, area, numero, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
    e.id, e.titulo, e.ementa, e.tribunal, e.area, e.numero, e.data
  );
}

function deleteEmenta(db: SQLite.SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM ementas WHERE id = ?", id);
}

const AREAS = ["Geral", "Civil", "Trabalhista", "Penal", "Tributário", "Administrativo", "Consumidor", "Previdenciário"];
const TRIBUNAIS = ["STF", "STJ", "TST", "TRF1", "TRF3", "TJMG", "TJSP", "TJRJ", "Outro"];

const DEFAULT_FORM = { id: "", titulo: "", ementa: "", tribunal: "STJ", area: "Geral", numero: "", data: "" };

export default function EmentasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const [ementas, setEmentas] = useState<Ementa[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { try { initEmentas(db); } catch {} }, [db]);

  const load = useCallback(() => setEmentas(getEmentas(db, search || undefined)), [db, search]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ ...DEFAULT_FORM, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); setEditing(false); setShowModal(true); };
  const openEdit = (e: Ementa) => { setForm({ id: e.id, titulo: e.titulo, ementa: e.ementa, tribunal: e.tribunal, area: e.area, numero: e.numero, data: e.data }); setEditing(true); setShowModal(true); };

  const handleSave = () => {
    if (!form.titulo.trim()) { Alert.alert("Atenção", "Informe o título."); return; }
    if (!form.ementa.trim()) { Alert.alert("Atenção", "Informe o texto da ementa."); return; }
    saveEmenta(db, form);
    setShowModal(false); load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (e: Ementa) => {
    Alert.alert("Excluir", `Remover ementa "${e.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => { deleteEmenta(db, e.id); load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={20} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Ementas</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{ementas.length} ementas salvas</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openNew}>
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderColor: colors.border, marginHorizontal: 16, marginVertical: 10 }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput style={[styles.searchInput, { color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder="Buscar ementas..." placeholderTextColor={colors.mutedForeground} />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]} showsVerticalScrollIndicator={false}>
        {ementas.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book" size={44} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{search ? "Nenhuma ementa encontrada" : "Nenhuma ementa"}</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{search ? "Tente outros termos" : "Toque em + para adicionar sua primeira ementa"}</Text>
          </View>
        ) : (
          ementas.map(e => {
            const isExpanded = expanded.has(e.id);
            return (
              <TouchableOpacity key={e.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => toggle(e.id)} activeOpacity={0.9}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{e.titulo}</Text>
                    <View style={styles.cardMeta}>
                      {e.tribunal ? <View style={[styles.badge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}><Text style={[styles.badgeText, { color: colors.primary }]}>{e.tribunal}</Text></View> : null}
                      {e.area !== "Geral" ? <View style={[styles.badge, { backgroundColor: colors.muted + "30", borderColor: colors.border }]}><Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{e.area}</Text></View> : null}
                      {e.numero ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{e.numero}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.cardEmenta, { color: colors.mutedForeground }]} numberOfLines={isExpanded ? undefined : 3}>{e.ementa}</Text>
                <View style={styles.expandRow}>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                  <Text style={[styles.expandText, { color: colors.mutedForeground }]}>{isExpanded ? "Recolher" : "Ver completo"}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? "Editar Ementa" : "Nova Ementa"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Field label="Título *" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.titulo} onChangeText={set("titulo")} placeholder="Ex: Dano moral por negativação indevida" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Tribunal" colors={colors}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TRIBUNAIS.map(t => (
                  <TouchableOpacity key={t} style={[styles.chip, { backgroundColor: form.tribunal === t ? colors.primary : colors.secondary, borderColor: form.tribunal === t ? colors.primary : colors.border }]} onPress={() => set("tribunal")(t)}>
                    <Text style={[styles.chipText, { color: form.tribunal === t ? colors.primaryForeground : colors.foreground }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Field>
            <Field label="Área" colors={colors}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {AREAS.map(a => (
                  <TouchableOpacity key={a} style={[styles.chip, { backgroundColor: form.area === a ? colors.primary + "20" : colors.secondary, borderColor: form.area === a ? colors.primary : colors.border }]} onPress={() => set("area")(a)}>
                    <Text style={[styles.chipText, { color: form.area === a ? colors.primary : colors.foreground }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Field>
            <Field label="Número do Processo/Acórdão" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.numero} onChangeText={set("numero")} placeholder="0000000-00.0000.0.00.0000" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Data" colors={colors}>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground }]} value={form.data} onChangeText={set("data")} placeholder="2024-01-15" placeholderTextColor={colors.mutedForeground} />
              </View>
            </Field>
            <Field label="Ementa *" colors={colors}>
              <View style={[styles.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.textArea, { color: colors.foreground }]} value={form.ementa} onChangeText={set("ementa")} placeholder="Texto completo da ementa..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={6} textAlignVertical="top" />
              </View>
            </Field>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Feather name="save" size={16} color={colors.primaryForeground} />
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{editing ? "Salvar Alterações" : "Adicionar Ementa"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40, paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  cardTop: { flexDirection: "row", gap: 10 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardActions: { gap: 8, alignItems: "center" },
  cardEmenta: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  expandRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  expandText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 5 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  textAreaWrap: { borderRadius: 10, borderWidth: 1, padding: 12 },
  textArea: { fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 120, lineHeight: 19 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, marginBottom: 20 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
