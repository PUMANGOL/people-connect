import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

/**
 * Converte o Direct Line SECRET (server-only) num TOKEN de utilizador de curta duração
 * para enviar ao browser. O secret nunca vai para o frontend.
 *
 * Env vars:
 * - COPILOT_DIRECT_LINE_SECRET: obtido no portal Copilot Studio → canal Web
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const secret = process.env.COPILOT_DIRECT_LINE_SECRET;
  if (!secret) {
    return errorResponse('COPILOT_DIRECT_LINE_SECRET não configurado no ambiente', 503);
  }

  try {
    const res = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return errorResponse(`Direct Line error: ${text}`, res.status);
    }
    const data = await res.json();
    return jsonResponse({
      token: data.token,
      conversationId: data.conversationId ?? null,
      expires_in: data.expires_in,
    });
  } catch (err) {
    console.error('copilot-token error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro ao gerar token'));
  }
};

export const config: Config = {
  path: '/api/copilot-token',
};
