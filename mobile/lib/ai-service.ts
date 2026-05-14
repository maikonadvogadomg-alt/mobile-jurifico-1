import type { AIProvider } from "@/contexts/SettingsContext";
import { resolveActiveAI } from "@/contexts/SettingsContext";

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function callAI(
  messages: AiMessage[],
  aiProviders: AIProvider[],
  signal?: AbortSignal,
): Promise<string> {
  const config = resolveActiveAI(aiProviders);
  if (!config) {
    throw new Error(
      "Nenhum provedor de IA configurado. Vá em Configurações e adicione uma chave de API.",
    );
  }

  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  const body = JSON.stringify({
    model: config.model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });

  const res = await fetch(url, { method: "POST", headers, body, signal });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Erro da API (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta inválida da API de IA.");
  return content;
}

export function getProviderLabel(aiProviders: AIProvider[]): string {
  const active = aiProviders.find(p => p.isActive) ?? aiProviders[0];
  if (!active) return "Não configurado";
  return active.name || active.type;
}

export function getProviderName(aiProviders: AIProvider[]): string {
  return getProviderLabel(aiProviders);
}

export const LEGAL_ACTIONS = [
  { id: "minuta",       label: "Gerar Minuta",   description: "Cria minuta jurídica completa" },
  { id: "revisar",      label: "Revisar",         description: "Revisão jurídica e ortográfica" },
  { id: "refinar",      label: "Refinar",         description: "Melhora argumentação" },
  { id: "resumir",      label: "Resumir",         description: "Resumo objetivo" },
  { id: "simplificar",  label: "Simplificar",     description: "Linguagem acessível" },
  { id: "analisar",     label: "Analisar",        description: "Análise jurídica detalhada" },
  { id: "modo-estrito", label: "Corrigir",        description: "Apenas português e estilo" },
] as const;

export type LegalActionId = typeof LEGAL_ACTIONS[number]["id"];

export function buildLegalPrompt(action: LegalActionId, text: string, context?: string): AiMessage[] {
  const systemMsg: AiMessage = {
    role: "system",
    content: `Você é um assistente jurídico especializado em direito brasileiro.
Sempre responda em português brasileiro formal e técnico.
Mantenha o estilo jurídico, seguindo normas ABNT quando aplicável.
Nos documentos gerados: cabeçalhos NÃO-endereçados devem ter texto justificado; recuo de parágrafo = 4cm; cabeçalhos endereçados (EXMO. SR. DR.) devem ser centralizados.
NÃO invente dados, leis, números de processo ou jurisprudência.${context ? `\nContexto: ${context}` : ""}`,
  };

  const prompts: Record<LegalActionId, string> = {
    minuta:         `Gere uma minuta jurídica completa e bem estruturada com base em:\n\n${text}`,
    revisar:        `Revise o texto jurídico abaixo corrigindo erros gramaticais, ortográficos e de estilo sem alterar conteúdo:\n\n${text}`,
    refinar:        `Refine e melhore a argumentação jurídica mantendo os fatos e pedidos originais:\n\n${text}`,
    resumir:        `Faça um resumo objetivo e preciso do seguinte texto jurídico:\n\n${text}`,
    simplificar:    `Reescreva em linguagem mais clara e acessível, mantendo o significado:\n\n${text}`,
    analisar:       `Faça análise jurídica detalhada apontando pontos fortes, fracos e sugestões:\n\n${text}`,
    "modo-estrito": `Corrija APENAS erros de português e estilo. NÃO altere conteúdo, argumentos ou estrutura:\n\n${text}`,
  };

  return [systemMsg, { role: "user", content: prompts[action] }];
}

export async function searchJurisprudencia(
  query: string,
  aiProviders: AIProvider[],
): Promise<string> {
  const messages: AiMessage[] = [
    {
      role: "system",
      content: `Você é especialista em jurisprudência brasileira.
Forneça jurisprudência relevante e atualizada dos tribunais superiores (STF, STJ, TST) e estaduais.
Cite sempre: tribunal, número do acórdão (se disponível), data aproximada, relator e ementa.
IMPORTANTE: Não invente jurisprudência. Se não tiver certeza, indique claramente.
Responda em português formal.`,
    },
    {
      role: "user",
      content: `Pesquise jurisprudência relevante sobre: "${query}"\n\nForneça 3-5 ementas relevantes com dados e análise sobre a tendência jurisprudencial.`,
    },
  ];

  return callAI(messages, aiProviders);
}
