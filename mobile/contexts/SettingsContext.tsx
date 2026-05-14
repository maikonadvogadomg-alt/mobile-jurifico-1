import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// ── AI Provider ───────────────────────────────────────────────────────────────

export type AIProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "mistral"
  | "groq"
  | "openrouter"
  | "perplexity"
  | "xai"
  | "custom";

export interface AIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  isActive: boolean;
}

// ── DB Config ─────────────────────────────────────────────────────────────────

export type DBProvider =
  | "neon"
  | "postgres"
  | "supabase"
  | "sqlite"
  | "mysql"
  | "mongodb"
  | "turso"
  | "redis"
  | "firebase"
  | "planetscale"
  | "railway";

export interface DBConfig {
  id: string;
  name: string;
  provider: DBProvider;
  connectionString: string;
  host?: string;
  database?: string;
  user?: string;
  password?: string;
  port?: number;
  ssl?: boolean;
}

// ── App Settings ──────────────────────────────────────────────────────────────

export interface AppSettings {
  datajudKey: string;
  appPassword: string;
  driveFolder: string;
  driveToken: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  datajudKey: "",
  appPassword: "",
  driveFolder: "",
  driveToken: "",
};

// ── Provider base URLs ────────────────────────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<AIProviderType, { baseUrl: string; defaultModel: string }> = {
  openai:     { baseUrl: "https://api.openai.com/v1",                                         defaultModel: "gpt-4o-mini" },
  anthropic:  { baseUrl: "https://api.anthropic.com/v1",                                      defaultModel: "claude-3-5-sonnet-20241022" },
  gemini:     { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",            defaultModel: "gemini-2.0-flash" },
  deepseek:   { baseUrl: "https://api.deepseek.com/v1",                                       defaultModel: "deepseek-chat" },
  mistral:    { baseUrl: "https://api.mistral.ai/v1",                                         defaultModel: "mistral-medium-latest" },
  groq:       { baseUrl: "https://api.groq.com/openai/v1",                                    defaultModel: "llama-3.3-70b-versatile" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1",                                      defaultModel: "openai/gpt-4o-mini" },
  perplexity: { baseUrl: "https://api.perplexity.ai",                                         defaultModel: "sonar-pro" },
  xai:        { baseUrl: "https://api.x.ai/v1",                                               defaultModel: "grok-2-latest" },
  custom:     { baseUrl: "",                                                                   defaultModel: "gpt-4o-mini" },
};

export const PROVIDER_LABELS: Record<AIProviderType, string> = {
  openai:     "OpenAI",
  anthropic:  "Anthropic Claude",
  gemini:     "Google Gemini",
  deepseek:   "DeepSeek",
  mistral:    "Mistral AI",
  groq:       "Groq (Rápido/Grátis)",
  openrouter: "OpenRouter",
  perplexity: "Perplexity",
  xai:        "xAI / Grok",
  custom:     "API Personalizada",
};

export const PROVIDER_PLACEHOLDER: Record<AIProviderType, string> = {
  openai:     "sk-...",
  anthropic:  "sk-ant-...",
  gemini:     "AIzaSy...",
  deepseek:   "sk-...",
  mistral:    "...",
  groq:       "gsk_...",
  openrouter: "sk-or-...",
  perplexity: "pplx-...",
  xai:        "xai-...",
  custom:     "Bearer token...",
};

export const AI_MODELS: Record<AIProviderType, string[]> = {
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic:  ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  gemini:     ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  deepseek:   ["deepseek-chat", "deepseek-reasoner"],
  mistral:    ["mistral-medium-latest", "mistral-small-latest", "codestral-latest"],
  groq:       ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  openrouter: ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct"],
  perplexity: ["sonar-pro", "sonar", "sonar-reasoning"],
  xai:        ["grok-2-latest", "grok-3", "grok-3-mini"],
  custom:     [],
};

// ── Auto-detect provider from key ────────────────────────────────────────────

export function detectProviderFromKey(key: string): AIProviderType | null {
  const k = key.trim();
  if (k.startsWith("gsk_"))   return "groq";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("pplx-"))  return "perplexity";
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("AIza"))   return "gemini";
  if (k.startsWith("xai-"))   return "xai";
  if (k.startsWith("sk-"))    return "openai";
  return null;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  AI_PROVIDERS: "@legal/ai_providers",
  DB_CONFIGS:   "@legal/db_configs",
  SETTINGS:     "@legal/settings",
};

// ── Context ───────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  aiProviders: AIProvider[];
  dbConfigs: DBConfig[];
  settings: AppSettings;
  loaded: boolean;

  addAIProvider: (p: Omit<AIProvider, "id">) => void;
  updateAIProvider: (id: string, data: Partial<AIProvider>) => void;
  removeAIProvider: (id: string) => void;
  setActiveAIProvider: (id: string) => void;
  getActiveAIProvider: () => AIProvider | null;

  addDBConfig: (c: Omit<DBConfig, "id">) => void;
  updateDBConfig: (id: string, data: Partial<DBConfig>) => void;
  removeDBConfig: (id: string) => void;
  getActiveDBConfig: () => DBConfig | null;

  updateSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  aiProviders: [],
  dbConfigs: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,
  addAIProvider: () => {},
  updateAIProvider: () => {},
  removeAIProvider: () => {},
  setActiveAIProvider: () => {},
  getActiveAIProvider: () => null,
  addDBConfig: () => {},
  updateDBConfig: () => {},
  removeDBConfig: () => {},
  getActiveDBConfig: () => null,
  updateSettings: () => {},
  resetAll: async () => {},
});

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);
  const [dbConfigs, setDBConfigs] = useState<DBConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.AI_PROVIDERS),
      AsyncStorage.getItem(STORAGE_KEYS.DB_CONFIGS),
      AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
    ]).then(([ai, db, st]) => {
      if (ai) { try { setAIProviders(JSON.parse(ai)); } catch {} }
      if (db) { try { setDBConfigs(JSON.parse(db)); } catch {} }
      if (st) { try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(st) }); } catch {} }
    }).finally(() => setLoaded(true));
  }, []);

  const persistAI = (list: AIProvider[]) => AsyncStorage.setItem(STORAGE_KEYS.AI_PROVIDERS, JSON.stringify(list));
  const persistDB = (list: DBConfig[]) => AsyncStorage.setItem(STORAGE_KEYS.DB_CONFIGS, JSON.stringify(list));
  const persistST = (s: AppSettings) => AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));

  const addAIProvider = useCallback((p: Omit<AIProvider, "id">) => {
    setAIProviders(prev => {
      const next = [...prev, { ...p, id: genId() }];
      persistAI(next);
      return next;
    });
  }, []);

  const updateAIProvider = useCallback((id: string, data: Partial<AIProvider>) => {
    setAIProviders(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...data } : p);
      persistAI(next);
      return next;
    });
  }, []);

  const removeAIProvider = useCallback((id: string) => {
    setAIProviders(prev => {
      const next = prev.filter(p => p.id !== id);
      persistAI(next);
      return next;
    });
  }, []);

  const setActiveAIProvider = useCallback((id: string) => {
    setAIProviders(prev => {
      const next = prev.map(p => ({ ...p, isActive: p.id === id }));
      persistAI(next);
      return next;
    });
  }, []);

  const getActiveAIProvider = useCallback((): AIProvider | null => {
    return aiProviders.find(p => p.isActive) ?? aiProviders[0] ?? null;
  }, [aiProviders]);

  const addDBConfig = useCallback((c: Omit<DBConfig, "id">) => {
    setDBConfigs(prev => {
      const next = [...prev, { ...c, id: genId() }];
      persistDB(next);
      return next;
    });
  }, []);

  const updateDBConfig = useCallback((id: string, data: Partial<DBConfig>) => {
    setDBConfigs(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      persistDB(next);
      return next;
    });
  }, []);

  const removeDBConfig = useCallback((id: string) => {
    setDBConfigs(prev => {
      const next = prev.filter(c => c.id !== id);
      persistDB(next);
      return next;
    });
  }, []);

  const getActiveDBConfig = useCallback((): DBConfig | null => {
    return dbConfigs[0] ?? null;
  }, [dbConfigs]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      persistST(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.AI_PROVIDERS),
      AsyncStorage.removeItem(STORAGE_KEYS.DB_CONFIGS),
      AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS),
    ]);
    setAIProviders([]);
    setDBConfigs([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{
      aiProviders, dbConfigs, settings, loaded,
      addAIProvider, updateAIProvider, removeAIProvider, setActiveAIProvider, getActiveAIProvider,
      addDBConfig, updateDBConfig, removeDBConfig, getActiveDBConfig,
      updateSettings, resetAll,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

// ── Compatibility helper — pick the active AI config ─────────────────────────

export function resolveActiveAI(aiProviders: AIProvider[]): {
  apiKey: string; baseUrl: string; model: string; provider: string;
} | null {
  const active = aiProviders.find(p => p.isActive) ?? aiProviders[0];
  if (!active || !active.apiKey) return null;
  const defaults = PROVIDER_DEFAULTS[active.type];
  return {
    apiKey:   active.apiKey,
    baseUrl:  (active.baseUrl || defaults.baseUrl).replace(/\/$/, ""),
    model:    active.model || defaults.defaultModel,
    provider: active.type,
  };
}
