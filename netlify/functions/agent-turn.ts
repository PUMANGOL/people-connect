import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { runAgentTurn } from './_shared/agent/loop';

/**
 * POST /api/agent-turn
 * Body: { pergunta: string, sessao_id?: string }
 * Auth: Bearer JWT
 *
 * Executa o Agente DPC (hybrid RAG + tools + GenUI blocks).
 * Funciona em modo demo sem NVIDIA_API_KEY.
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  if (!isDatabaseConfigured()) {
    return errorResponse('DATABASE_URL não configurada', 503);
  }

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const pergunta = typeof body.pergunta === 'string' ? body.pergunta.trim() : '';
    const sessao_id = typeof body.sessao_id === 'string' ? body.sessao_id : undefined;

    if (!pergunta || pergunta.length < 2) {
      return errorResponse('Pergunta obrigatória (mín. 2 caracteres)', 400);
    }
    if (pergunta.length > 2000) {
      return errorResponse('Pergunta demasiado longa (máx. 2000 caracteres)', 400);
    }

    // O agente só reconhece 'rh_admin' e 'novo_colaborador'. Mentor entra
    // como 'rh_admin' para efeitos de RAG (tem acesso à mesma base de
    // conhecimento). Regra Zero: não alterar o Assistente Virtual.
    const roleParaAgente: 'rh_admin' | 'novo_colaborador' =
      user.role === 'novo_colaborador' ? 'novo_colaborador' : 'rh_admin';

    const result = await runAgentTurn({
      pergunta,
      sessao_id,
      user: { id: user.id, email: user.email, role: roleParaAgente },
    });

    return jsonResponse({ data: result });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[agent-turn]', err);
    return errorResponse(publicErrorMessage(err, 'Erro no agente'), 500);
  }
};

export const config: Config = {
  path: '/api/agent-turn',
};
