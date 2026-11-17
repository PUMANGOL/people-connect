import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, isDatabaseConfigured } from './_shared/db';
import { nvidia, NVIDIA_CONFIG, isNvidiaReady } from './_shared/nvidia-client';
import { embed } from './_shared/embeddings';

/**
 * GET /api/health-nvidia
 * Verifica se a NVIDIA API está configurada e responde correctamente.
 * Faz um teste real: 1 embedding (custo ~0) e 1 chat completion pequena.
 */

export default async (): Promise<Response> => {
  if (!isNvidiaReady()) {
    return errorResponse('NVIDIA_API_KEY não configurada', 503);
  }

  const results: Record<string, unknown> = {
    chatModel: NVIDIA_CONFIG.chatModel,
    embedModel: NVIDIA_CONFIG.embedModel,
    baseUrl: 'nvidia',
    database_configured: isDatabaseConfigured(),
  };

  // Teste 1: embedding
  try {
    const t0 = Date.now();
    const vec = await embed('teste');
    results.embedding = {
      ok: true,
      dimensions: vec.length,
      latencia_ms: Date.now() - t0,
    };
  } catch (err) {
    results.embedding = {
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
    };
  }

  // Teste 2: chat (pequeno)
  try {
    const t0 = Date.now();
    const completion = await nvidia.chat.completions.create({
      model: NVIDIA_CONFIG.chatModel,
      messages: [{ role: 'user', content: 'Responde apenas "OK"' }],
      max_tokens: 10,
      temperature: 0,
    });
    results.chat = {
      ok: true,
      resposta: completion.choices[0]?.message?.content,
      tokens: completion.usage?.total_tokens,
      latencia_ms: Date.now() - t0,
    };
  } catch (err) {
    results.chat = {
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
    };
  }

  return jsonResponse({ status: 'ok', ...results });
};

export const config: Config = {
  path: '/api/health-nvidia',
};
