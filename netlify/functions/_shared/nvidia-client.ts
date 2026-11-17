import OpenAI from 'openai';

/**
 * Cliente NVIDIA NIM API (OpenAI-compatible).
 *
 * Env vars (servidor):
 *   NVIDIA_API_KEY         — obrigatória
 *   NVIDIA_BASE_URL        — default: https://integrate.api.nvidia.com/v1
 *   NVIDIA_CHAT_MODEL      — default: deepseek-ai/deepseek-v4-flash
 *   NVIDIA_EMBED_MODEL     — default: baai/bge-m3
 */

const rawKey = process.env.NVIDIA_API_KEY?.trim() ?? '';
const NVIDIA_API_KEY =
  rawKey && rawKey !== 'missing' && rawKey !== 'xxx' && !rawKey.startsWith('your_')
    ? rawKey
    : '';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

// Sem aviso ao carregar o módulo: a API carrega-o em todas as rotas e o aviso aparecia em
// todos os pedidos. Quem precisa da NVIDIA verifica isNvidiaReady() e devolve o próprio erro.

/** Cliente lazy — só instancia quando há key real (evita crashes do SDK OpenAI). */
let _nvidia: OpenAI | null = null;

export function getNvidiaClient(): OpenAI {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY não configurada');
  }
  if (!_nvidia) {
    _nvidia = new OpenAI({
      apiKey: NVIDIA_API_KEY,
      baseURL: NVIDIA_BASE_URL,
    });
  }
  return _nvidia;
}

/** @deprecated use getNvidiaClient() — mantido para imports existentes */
export const nvidia = new Proxy({} as OpenAI, {
  get(_t, prop) {
    const client = getNvidiaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const NVIDIA_CONFIG = {
  chatModel: process.env.NVIDIA_CHAT_MODEL ?? 'deepseek-ai/deepseek-v4-flash',
  embedModel: process.env.NVIDIA_EMBED_MODEL ?? 'baai/bge-m3',
  embedDimensions: 1024, // bge-m3
  maxTokens: 800,
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  // bge-m3 devolve scores tipicamente entre 0.4-0.8 para conteúdo relevante.
  // Threshold agressivo (0.75) causa muitas escalações desnecessárias.
  // 0.5 é um bom compromisso — dá margem para reformulações e sinónimos.
  minRelevanceScore: 0.5,
  temperature: 0.2,
  topP: 0.95,
  // reasoning_effort:
  //   'low' → ~2-4s latência, óptimo para MVP e perguntas simples de RH
  //   'medium' → ~8-12s, melhores respostas para questões complexas
  //   'high' → ~15-30s, análise profunda (evitar em produção)
  reasoningEffort: 'low' as 'low' | 'medium' | 'high',
};

export function isNvidiaReady(): boolean {
  return NVIDIA_API_KEY.length > 0;
}
