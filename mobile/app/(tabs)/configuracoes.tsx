import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  useSettings, AIProvider, DBConfig, AIProviderType,
  PROVIDER_LABELS, PROVIDER_PLACEHOLDER, PROVIDER_DEFAULTS, AI_MODELS,
  DBProvider, detectProviderFromKey,
} from "@/contexts/SettingsContext";
import { testNeonConnection, initNeonTables } from "@/lib/neon-client";

type SectionKey = "ai" | "database" | "general" | "drive" | "security";

const DB_PROVIDERS: { value: DBProvider; label: string }[] = [
  { value: "neon",        label: "Neon (PostgreSQL)" },
  { value: "postgres",    label: "PostgreSQL" },
  { value: "supabase",    label: "Supabase" },
  { value: "sqlite",      label: "SQLite local" },
  { value: "mysql",       label: "MySQL" },
  { value: "turso",       label: "Turso (libSQL)" },
  { value: "mongodb",     label: "MongoDB" },
  { value: "railway",     label: "Railway" },
];

const AI_PROVIDER_TYPES: AIProviderType[] = [
  "groq","openai","anthropic","gemini","xai","openrouter","perplexity","deepseek","mistral","custom",
];

function SectionHeader({ icon, title, expanded, onToggle, colors }: {
  icon: string; title: string; expanded: boolean; onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}
      onPress={onToggle} activeOpacity={0.85}
    >
      <Feather name={icon as any} size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
    </TouchableOpacity>
  );
}

function SecretInput({ value, onChangeText, placeholder, colors }: {
  value: string; onChangeText: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
        secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
      />
      <TouchableOpacity onPress={() => setShow(!show)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name={show ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    aiProviders, dbConfigs, settings,
    addAIProvider, updateAIProvider, removeAIProvider, setActiveAIProvider,
    addDBConfig, removeDBConfig, updateSettings,
    getActiveAIProvider, getActiveDBConfig,
  } = useSettings();

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({ ai: true, database: false, general: false, drive: false, security: false });
  const toggle = (k: SectionKey) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  // AI provider add modal
  const [showAddAI, setShowAddAI] = useState(false);
  const [newAIType, setNewAIType] = useState<AIProviderType>("openai");
  const [newAIName, setNewAIName] = useState("");
  const [newAIKey, setNewAIKey] = useState("");
  const [newAIUrl, setNewAIUrl] = useState("");
  const [newAIModel, setNewAIModel] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  // DB add modal
  const [showAddDB, setShowAddDB] = useState(false);
  const [newDBProvider, setNewDBProvider] = useState<DBProvider>("neon");
  const [newDBName, setNewDBName] = useState("Banco Principal");
  const [newDBUrl, setNewDBUrl] = useState("");
  const [dbTesting, setDbTesting] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [initingDb, setInitingDb] = useState(false);

  // General settings draft
  const [datajudKey, setDatajudKey] = useState(settings.datajudKey || "");
  const [appPassword, setAppPassword] = useState(settings.appPassword || "");
  const [driveFolder, setDriveFolder] = useState(settings.driveFolder || "");
  const [driveToken, setDriveToken] = useState(settings.driveToken || "");

  const handleAddAI = useCallback(() => {
    if (!newAIKey.trim() && newAIType !== "custom") {
      Alert.alert("Atenção", "Informe a chave de API."); return;
    }
    const detectedType = detectProviderFromKey(newAIKey) ?? newAIType;
    const defaults = PROVIDER_DEFAULTS[detectedType];
    addAIProvider({
      name: newAIName.trim() || PROVIDER_LABELS[detectedType],
      type: detectedType,
      apiKey: newAIKey.trim(),
      baseUrl: newAIUrl.trim() || defaults.baseUrl,
      model: newAIModel.trim() || defaults.defaultModel,
      isActive: aiProviders.length === 0,
    });
    setShowAddAI(false);
    setNewAIKey(""); setNewAIName(""); setNewAIUrl(""); setNewAIModel("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newAIKey, newAIType, newAIName, newAIUrl, newAIModel, aiProviders.length, addAIProvider]);

  const handleTestAI = async (p: AIProvider) => {
    setTestingId(p.id);
    try {
      const base = (p.baseUrl || PROVIDER_DEFAULTS[p.type].baseUrl).replace(/\/$/, "");
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${p.apiKey}` },
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("✅ Chave válida", `${p.name} está funcionando.`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert("❌ Chave inválida", e.message);
    } finally { setTestingId(null); }
  };

  const handleAddDB = useCallback(async () => {
    if (!newDBUrl.trim()) { Alert.alert("Atenção", "Informe a URL/string de conexão."); return; }
    const url = newDBUrl.trim();
    addDBConfig({ provider: newDBProvider, name: newDBName.trim() || "Banco de Dados", connectionString: url });
    setShowAddDB(false);
    setNewDBUrl(""); setNewDBName("Banco Principal");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-create tables for Neon/PostgreSQL
    if (newDBProvider === "neon" || newDBProvider === "postgres") {
      setInitingDb(true);
      try {
        const r = await initNeonTables(url);
        if (r.ok) {
          Alert.alert("✅ Banco configurado", `Conectado! Tabelas criadas:\n${r.tables.join("\n")}`);
        } else {
          Alert.alert("Aviso", r.error ?? "Banco adicionado, mas não foi possível criar as tabelas.");
        }
      } catch (e: any) {
        Alert.alert("Aviso", "Banco adicionado. Crie as tabelas manualmente pelo botão 'Inicializar'.");
      } finally { setInitingDb(false); }
    }
  }, [newDBUrl, newDBProvider, newDBName, addDBConfig]);

  const handleTestDB = async (url: string) => {
    if (!url) { Alert.alert("Atenção", "Sem URL configurada."); return; }
    setDbTesting(true); setDbStatus(null);
    try {
      const r = await testNeonConnection(url);
      setDbStatus(r);
    } finally { setDbTesting(false); }
  };

  const handleInitTables = async (url: string) => {
    if (!url) return;
    setInitingDb(true);
    try {
      const r = await initNeonTables(url);
      if (r.ok) {
        Alert.alert("Tabelas criadas", r.tables.join(", "));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Erro", r.error ?? "Falha ao criar tabelas.");
      }
    } finally { setInitingDb(false); }
  };

  const handleSaveGeneral = () => {
    updateSettings({ datajudKey, appPassword, driveFolder, driveToken });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Salvo", "Configurações gerais salvas.");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const activeProvider = getActiveAIProvider();
  const activeDB = getActiveDBConfig();

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Configurações</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {activeProvider ? `IA: ${activeProvider.name || activeProvider.type}` : "Sem IA configurada"} · {activeDB ? activeDB.name : "Sem DB"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.adminBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => router.push("/admin")}
          >
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.adminBtnText, { color: colors.primary }]}>Admin</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── AI Providers ── */}
        <SectionHeader icon="cpu" title={`Provedores de IA (${aiProviders.length})`} expanded={expanded.ai} onToggle={() => toggle("ai")} colors={colors} />
        {expanded.ai && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.info, { color: colors.mutedForeground }]}>
              Adicione um ou mais provedores. O app usa o provedor ativo. Prefixos: gsk_=Groq, sk-or-=OpenRouter, AIza=Gemini, sk-ant-=Anthropic, xai-=xAI.
            </Text>

            {aiProviders.map((p) => (
              <View key={p.id} style={[styles.providerCard, { borderColor: p.isActive ? colors.primary : colors.border, backgroundColor: p.isActive ? colors.primary + "08" : colors.background }]}>
                <View style={styles.providerTop}>
                  <View style={styles.providerTitleRow}>
                    {p.isActive && <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />}
                    <Text style={[styles.providerName, { color: colors.foreground }]}>{p.name || p.type}</Text>
                    <Text style={[styles.providerType, { color: colors.mutedForeground }]}>{p.type}</Text>
                  </View>
                  <View style={styles.providerActions}>
                    {!p.isActive && (
                      <TouchableOpacity style={[styles.providerBtn, { borderColor: colors.primary }]} onPress={() => setActiveAIProvider(p.id)}>
                        <Text style={[styles.providerBtnText, { color: colors.primary }]}>Ativar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.providerBtn, { borderColor: colors.border }]}
                      onPress={() => handleTestAI(p)}
                      disabled={testingId === p.id}
                    >
                      {testingId === p.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="check-circle" size={14} color={colors.mutedForeground} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.providerBtn, { borderColor: colors.destructive + "50" }]}
                      onPress={() => Alert.alert("Remover", `Remover ${p.name}?`, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => removeAIProvider(p.id) }])}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.providerModel, { color: colors.mutedForeground }]}>
                  modelo: {p.model || PROVIDER_DEFAULTS[p.type]?.defaultModel || "—"} · chave: {p.apiKey ? "••••" + p.apiKey.slice(-4) : "(sem chave)"}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]} onPress={() => setShowAddAI(true)}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Adicionar Provedor de IA</Text>
            </TouchableOpacity>

            {/* DataJud key */}
            <View style={styles.separator} />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Chave DataJud (CNJ)</Text>
            <Text style={[styles.fieldDesc, { color: colors.mutedForeground }]}>Necessária para consultas processuais</Text>
            <SecretInput value={datajudKey} onChangeText={setDatajudKey} placeholder="APIKey ..." colors={colors} />
            <TouchableOpacity style={[styles.saveSmallBtn, { backgroundColor: colors.primary }]} onPress={handleSaveGeneral}>
              <Text style={[styles.saveSmallText, { color: colors.primaryForeground }]}>Salvar chave DataJud</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Database ── */}
        <SectionHeader icon="database" title={`Bancos de Dados (${dbConfigs.length})`} expanded={expanded.database} onToggle={() => toggle("database")} colors={colors} />
        {expanded.database && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.info, { color: colors.mutedForeground }]}>
              O app funciona offline via SQLite interno. Configure um banco externo (Neon, Supabase, etc.) para sincronização na nuvem.
            </Text>

            {dbStatus && (
              <View style={[styles.statusBanner, { backgroundColor: dbStatus.ok ? colors.success + "15" : colors.destructive + "15", borderColor: dbStatus.ok ? colors.success : colors.destructive }]}>
                <Feather name={dbStatus.ok ? "check-circle" : "x-circle"} size={15} color={dbStatus.ok ? colors.success : colors.destructive} />
                <Text style={[styles.statusText, { color: dbStatus.ok ? colors.success : colors.destructive }]}>{dbStatus.message}</Text>
              </View>
            )}

            {dbConfigs.map((db) => (
              <View key={db.id} style={[styles.providerCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <View style={styles.providerTop}>
                  <View>
                    <Text style={[styles.providerName, { color: colors.foreground }]}>{db.name}</Text>
                    <Text style={[styles.providerType, { color: colors.mutedForeground }]}>{db.provider}</Text>
                  </View>
                  <View style={styles.providerActions}>
                    <TouchableOpacity style={[styles.providerBtn, { borderColor: colors.border }]} onPress={() => handleTestDB(db.connectionString)} disabled={dbTesting}>
                      {dbTesting ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="wifi" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                    {db.provider === "neon" || db.provider === "postgres" || db.provider === "supabase" ? (
                      <TouchableOpacity style={[styles.providerBtn, { borderColor: colors.border }]} onPress={() => handleInitTables(db.connectionString)} disabled={initingDb}>
                        {initingDb ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="layers" size={14} color={colors.accent} />}
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.providerBtn, { borderColor: colors.destructive + "50" }]}
                      onPress={() => Alert.alert("Remover", `Remover ${db.name}?`, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => removeDBConfig(db.id) }])}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.providerModel, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {db.connectionString.replace(/\/\/[^@]+@/, "//***@")}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]} onPress={() => setShowAddDB(true)}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Adicionar Banco de Dados</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Google Drive ── */}
        <SectionHeader icon="cloud" title="Google Drive" expanded={expanded.drive} onToggle={() => toggle("drive")} colors={colors} />
        {expanded.drive && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>ID da Pasta</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={driveFolder} onChangeText={setDriveFolder} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs..." placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Token OAuth2</Text>
            <SecretInput value={driveToken} onChangeText={setDriveToken} placeholder="ya29.a0AfH6SM..." colors={colors} />
            <TouchableOpacity style={[styles.saveSmallBtn, { backgroundColor: colors.primary }]} onPress={handleSaveGeneral}>
              <Text style={[styles.saveSmallText, { color: colors.primaryForeground }]}>Salvar Drive</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Security ── */}
        <SectionHeader icon="shield" title="Segurança" expanded={expanded.security} onToggle={() => toggle("security")} colors={colors} />
        {expanded.security && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Senha de Acesso</Text>
            <Text style={[styles.info, { color: colors.mutedForeground }]}>Deixe vazio para desabilitar.</Text>
            <SecretInput value={appPassword} onChangeText={setAppPassword} placeholder="Senha de proteção" colors={colors} />
            <TouchableOpacity style={[styles.saveSmallBtn, { backgroundColor: colors.primary }]} onPress={handleSaveGeneral}>
              <Text style={[styles.saveSmallText, { color: colors.primaryForeground }]}>Salvar senha</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footerCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.footerTitle, { color: colors.foreground }]}>Assistente Jurídico v1.0</Text>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Armazenamento local: SQLite (offline){"\n"}Chamadas de IA diretas pelo dispositivo{"\n"}Sem dependência de servidor
          </Text>
        </View>
      </ScrollView>

      {/* ── Modal: Add AI Provider ── */}
      <Modal visible={showAddAI} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddAI(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Provedor de IA</Text>
            <TouchableOpacity onPress={() => setShowAddAI(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Tipo do Provedor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {AI_PROVIDER_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, { backgroundColor: newAIType === t ? colors.primary : colors.secondary, borderColor: newAIType === t ? colors.primary : colors.border }]}
                  onPress={() => { setNewAIType(t); setNewAIKey(""); setNewAIModel(PROVIDER_DEFAULTS[t].defaultModel); }}
                >
                  <Text style={[styles.typeChipText, { color: newAIType === t ? colors.primaryForeground : colors.foreground }]}>
                    {PROVIDER_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Nome (opcional)</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={newAIName} onChangeText={setNewAIName} placeholder={PROVIDER_LABELS[newAIType]} placeholderTextColor={colors.mutedForeground} />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Chave de API *</Text>
            <SecretInput value={newAIKey} onChangeText={v => { setNewAIKey(v); const detected = detectProviderFromKey(v); if (detected && detected !== newAIType) setNewAIType(detected); }} placeholder={PROVIDER_PLACEHOLDER[newAIType]} colors={colors} />

            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>Modelo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(AI_MODELS[newAIType] || []).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.typeChip, { backgroundColor: newAIModel === m ? colors.primary + "20" : colors.secondary, borderColor: newAIModel === m ? colors.primary : colors.border }]}
                  onPress={() => setNewAIModel(m)}
                >
                  <Text style={[styles.typeChipText, { color: newAIModel === m ? colors.primary : colors.foreground, fontSize: 11 }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={newAIModel} onChangeText={setNewAIModel} placeholder={PROVIDER_DEFAULTS[newAIType].defaultModel} placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            </View>

            {newAIType === "custom" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>URL Base *</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput style={[styles.input, { color: colors.foreground }]} value={newAIUrl} onChangeText={setNewAIUrl} placeholder="https://api.exemplo.com/v1" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.saveSmallBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleAddAI}>
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.saveSmallText, { color: colors.primaryForeground }]}>Adicionar Provedor</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: Add DB Config ── */}
      <Modal visible={showAddDB} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddDB(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Banco de Dados</Text>
            <TouchableOpacity onPress={() => setShowAddDB(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Provedor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {DB_PROVIDERS.map((dp) => (
                <TouchableOpacity
                  key={dp.value}
                  style={[styles.typeChip, { backgroundColor: newDBProvider === dp.value ? colors.primary : colors.secondary, borderColor: newDBProvider === dp.value ? colors.primary : colors.border }]}
                  onPress={() => setNewDBProvider(dp.value)}
                >
                  <Text style={[styles.typeChipText, { color: newDBProvider === dp.value ? colors.primaryForeground : colors.foreground }]}>{dp.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Nome</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.foreground }]} value={newDBName} onChangeText={setNewDBName} placeholder="Banco Principal" placeholderTextColor={colors.mutedForeground} />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>String de Conexão *</Text>
            <Text style={[styles.fieldDesc, { color: colors.mutedForeground }]}>postgresql://user:pass@host/db?sslmode=require</Text>
            <SecretInput value={newDBUrl} onChangeText={setNewDBUrl} placeholder="postgresql://..." colors={colors} />

            <TouchableOpacity style={[styles.saveSmallBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleAddDB}>
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.saveSmallText, { color: colors.primaryForeground }]}>Adicionar Banco</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  adminBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  content: { padding: 16, gap: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 2, marginTop: 12 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  section: { borderRadius: 10, borderWidth: 1, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 14, gap: 10 },
  info: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  fieldDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 6 },
  separator: { height: 1, backgroundColor: "#00000015", marginVertical: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  input: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 8, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveSmallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 8 },
  saveSmallText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  providerCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  providerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  providerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  providerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  providerType: { fontSize: 11, fontFamily: "Inter_400Regular" },
  providerModel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  providerActions: { flexDirection: "row", gap: 6 },
  providerBtn: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  providerBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  footerCard: { marginTop: 16, padding: 14, borderRadius: 10, borderWidth: 1 },
  footerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  typeChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
