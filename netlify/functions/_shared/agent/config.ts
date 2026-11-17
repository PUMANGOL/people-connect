import { sql, isDatabaseConfigured } from '../db';
import { AGENT_SYSTEM_PROMPT, DEFAULT_BOAS_VINDAS } from './prompts';
import { getPiramydConfig } from '../piramyd-client';
import { NVIDIA_CONFIG } from '../nvidia-client';

/**
 * Config runtime do Agente DPC.
 * Precedência: DB (agent_config) > env/código defaults.
 * Cache in-memory TTL 30s; invalidar em PATCH.
 */

export interface AgentRuntimeConfig {
  system_prompt: string;
  mensagem_boas_vindas: string;
  email_escalacao: string;
  temperature: number;
  max_tokens: number;
  top_k: number;
  min_relevance_score: number;
  max_tool_steps: number;
  reasoning_effort: 'low' | 'medium' | 'high';
  updated_at: string | null;
  source: 'db' | 'defaults';
}

const MAX_PROMPT_CHARS = 12_000;
const CACHE_TTL_MS = 30_000;

let cache: { value: AgentRuntimeConfig; at: number } | null = null;

export function getDefaultAgentConfig(): AgentRuntimeConfig {
  const piramyd = getPiramydConfig();
  return {
    system_prompt: AGENT_SYSTEM_PROMPT,
    mensagem_boas_vindas: DEFAULT_BOAS_VINDAS,
    email_escalacao: 'dpc@pumangol.ao',
    temperature: piramyd.temperature,
    max_tokens: piramyd.maxTokens,
    top_k: NVIDIA_CONFIG.topK,
    min_relevance_score: NVIDIA_CONFIG.minRelevanceScore,
    max_tool_steps: piramyd.maxToolSteps,
    reasoning_effort: (NVIDIA_CONFIG.reasoningEffort as 'low' | 'medium' | 'high') || 'low',
    updated_at: null,
    source: 'defaults',
  };
}

export function invalidateAgentConfigCache(): void {
  cache = null;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function validateAgentConfigPatch(body: Record<string, unknown>): {
  ok: true;
  data: Partial<AgentRuntimeConfig>;
} | { ok: false; error: string } {
  const data: Partial<AgentRuntimeConfig> = {};

  if (body.system_prompt !== undefined) {
    if (typeof body.system_prompt !== 'string' || !body.system_prompt.trim()) {
      return { ok: false, error: 'System prompt é obrigatório' };
    }
    const cleaned = body.system_prompt.replace(/\0/g, '').trim();
    if (cleaned.length > MAX_PROMPT_CHARS) {
      return { ok: false, error: `System prompt excede ${MAX_PROMPT_CHARS} caracteres` };
    }
    data.system_prompt = cleaned;
  }

  if (body.mensagem_boas_vindas !== undefined) {
    if (typeof body.mensagem_boas_vindas !== 'string') {
      return { ok: false, error: 'Mensagem de boas-vindas inválida' };
    }
    data.mensagem_boas_vindas = body.mensagem_boas_vindas.replace(/\0/g, '').trim().slice(0, 1000);
  }

  if (body.email_escalacao !== undefined) {
    if (typeof body.email_escalacao !== 'string' || !body.email_escalacao.includes('@')) {
      return { ok: false, error: 'Email de escalação inválido' };
    }
    data.email_escalacao = body.email_escalacao.trim().slice(0, 255);
  }

  if (body.temperature !== undefined) {
    const t = Number(body.temperature);
    if (Number.isNaN(t) || t < 0 || t > 1.5) {
      return { ok: false, error: 'Temperature deve estar entre 0 e 1.5' };
    }
    data.temperature = clamp(t, 0, 1.5);
  }

  if (body.max_tokens !== undefined) {
    const n = Number(body.max_tokens);
    if (!Number.isFinite(n) || n < 100 || n > 4000) {
      return { ok: false, error: 'max_tokens deve estar entre 100 e 4000' };
    }
    data.max_tokens = Math.round(n);
  }

  if (body.top_k !== undefined) {
    const n = Number(body.top_k);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return { ok: false, error: 'top_k deve estar entre 1 e 20' };
    }
    data.top_k = Math.round(n);
  }

  if (body.min_relevance_score !== undefined) {
    const n = Number(body.min_relevance_score);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      return { ok: false, error: 'min_relevance_score deve estar entre 0 e 1' };
    }
    data.min_relevance_score = clamp(n, 0, 1);
  }

  if (body.max_tool_steps !== undefined) {
    const n = Number(body.max_tool_steps);
    if (!Number.isFinite(n) || n < 1 || n > 8) {
      return { ok: false, error: 'max_tool_steps deve estar entre 1 e 8' };
    }
    data.max_tool_steps = Math.round(n);
  }

  if (body.reasoning_effort !== undefined) {
    if (!['low', 'medium', 'high'].includes(String(body.reasoning_effort))) {
      return { ok: false, error: 'reasoning_effort deve ser low, medium ou high' };
    }
    data.reasoning_effort = body.reasoning_effort as 'low' | 'medium' | 'high';
  }

  return { ok: true, data };
}

function rowToConfig(row: Record<string, unknown>): AgentRuntimeConfig {
  const defaults = getDefaultAgentConfig();
  return {
    system_prompt: (row.system_prompt as string) || defaults.system_prompt,
    mensagem_boas_vindas: (row.mensagem_boas_vindas as string) || defaults.mensagem_boas_vindas,
    email_escalacao: (row.email_escalacao as string) || defaults.email_escalacao,
    temperature: Number(row.temperature ?? defaults.temperature),
    max_tokens: Number(row.max_tokens ?? defaults.max_tokens),
    top_k: Number(row.top_k ?? defaults.top_k),
    min_relevance_score: Number(row.min_relevance_score ?? defaults.min_relevance_score),
    max_tool_steps: Number(row.max_tool_steps ?? defaults.max_tool_steps),
    reasoning_effort:
      (row.reasoning_effort as 'low' | 'medium' | 'high') || defaults.reasoning_effort,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    source: 'db',
  };
}

export async function loadAgentConfig(force = false): Promise<AgentRuntimeConfig> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const defaults = getDefaultAgentConfig();

  if (!isDatabaseConfigured()) {
    cache = { value: defaults, at: Date.now() };
    return defaults;
  }

  try {
    const rows = await sql`
      SELECT system_prompt, mensagem_boas_vindas, email_escalacao,
             temperature, max_tokens, top_k, min_relevance_score,
             max_tool_steps, reasoning_effort, updated_at
      FROM agent_config
      WHERE chave = 'default'
      LIMIT 1
    `;
    if (rows.length === 0) {
      cache = { value: defaults, at: Date.now() };
      return defaults;
    }
    const cfg = rowToConfig(rows[0] as Record<string, unknown>);
    cache = { value: cfg, at: Date.now() };
    return cfg;
  } catch (err) {
    // Tabela pode não existir ainda (migração pendente)
    console.warn('[agent-config] fallback defaults:', err instanceof Error ? err.message : err);
    cache = { value: defaults, at: Date.now() };
    return defaults;
  }
}

/** Config pública (chat) — sem system prompt completo se quisermos; por agora devolve boas-vindas + email. */
export function toPublicConfig(cfg: AgentRuntimeConfig) {
  return {
    mensagem_boas_vindas: cfg.mensagem_boas_vindas,
    email_escalacao: cfg.email_escalacao,
  };
}

export function toAdminConfig(cfg: AgentRuntimeConfig) {
  return {
    system_prompt: cfg.system_prompt,
    mensagem_boas_vindas: cfg.mensagem_boas_vindas,
    email_escalacao: cfg.email_escalacao,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    top_k: cfg.top_k,
    min_relevance_score: cfg.min_relevance_score,
    max_tool_steps: cfg.max_tool_steps,
    reasoning_effort: cfg.reasoning_effort,
    updated_at: cfg.updated_at,
    source: cfg.source,
  };
}
