import OpenAI from 'openai';

/**
 * Cliente Piramyd (OpenAI-compatible) — lazy env (Netlify injecta vars em runtime).
 * https://api.piramyd.cloud/llms.txt
 */

function resolveKey(): string {
  const raw = (process.env.PIRAMYD_API_KEY ?? '').trim();
  if (!raw || raw.startsWith('your_') || raw === 'xxx') return '';
  return raw;
}

function resolveBaseUrl(): string {
  return (process.env.PIRAMYD_BASE_URL ?? '').trim() || 'https://api.piramyd.cloud/v1';
}

export function getPiramydConfig() {
  return {
    chatModel: (process.env.PIRAMYD_CHAT_MODEL ?? '').trim() || 'gpt-5.4',
    maxTokens: Number(process.env.PIRAMYD_MAX_TOKENS) || 900,
    temperature: Number(process.env.PIRAMYD_TEMPERATURE) || 0.25,
    maxToolSteps: 3,
  };
}

/** @deprecated use getPiramydConfig() — mantido para imports existentes */
export const PIRAMYD_CONFIG = {
  get chatModel() {
    return getPiramydConfig().chatModel;
  },
  get maxTokens() {
    return getPiramydConfig().maxTokens;
  },
  get temperature() {
    return getPiramydConfig().temperature;
  },
  get maxToolSteps() {
    return getPiramydConfig().maxToolSteps;
  },
};

let _client: OpenAI | null = null;
let _clientKey = '';

export function isPiramydReady(): boolean {
  return resolveKey().length > 8;
}

export function getPiramydClient(): OpenAI {
  const key = resolveKey();
  if (!key) {
    throw new Error('PIRAMYD_API_KEY não configurada');
  }
  // Recria se a key mudou (ex.: env injectada depois do import)
  if (!_client || _clientKey !== key) {
    _client = new OpenAI({
      apiKey: key,
      baseURL: resolveBaseUrl(),
    });
    _clientKey = key;
  }
  return _client;
}

export function getAgentMode(): 'piramyd' | 'nvidia' | 'demo' {
  if (isPiramydReady()) return 'piramyd';
  const nv = (process.env.NVIDIA_API_KEY ?? '').trim();
  if (nv.length > 8) return 'nvidia';
  return 'demo';
}
