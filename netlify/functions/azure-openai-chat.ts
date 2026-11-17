import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

/**
 * Proxy para Azure OpenAI Service. Mantém a API key server-only.
 *
 * Env vars:
 * - AZURE_OPENAI_ENDPOINT: https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-15-preview
 * - AZURE_OPENAI_KEY: API key da resource
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;

  if (!endpoint || !key) {
    return errorResponse('Azure OpenAI não configurado', 503);
  }

  if (req.method !== 'POST') {
    return errorResponse('Método não suportado', 405);
  }

  try {
    const body = await req.json();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return jsonResponse(data, res.status);
  } catch (err) {
    console.error('azure-openai-chat error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro ao contactar Azure OpenAI'));
  }
};

export const config: Config = {
  path: '/api/azure-openai-chat',
};
