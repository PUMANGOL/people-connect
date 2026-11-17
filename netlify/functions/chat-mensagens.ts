import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, isDatabaseConfigured, sql, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { runAgentTurn } from './_shared/agent/loop';

/**
 * POST /api/chat-mensagens — compat: delega no Agente DPC.
 * PATCH /api/chat-mensagens/:id — feedback { satisfacao: 0|1, feedback_texto? }
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!isDatabaseConfigured()) {
    return errorResponse('DATABASE_URL não configurada', 503);
  }

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // PATCH feedback — /api/chat-mensagens/:id  or path ends with uuid + method PATCH
    if (req.method === 'PATCH' || (req.method === 'POST' && parts.includes('feedback'))) {
      const user = await requireAuth(req);
      const body = await req.json().catch(() => ({}));
      const mensagemId =
        (typeof body.mensagem_id === 'string' && body.mensagem_id) ||
        parts[parts.length - 1] ||
        parts[parts.length - 2];

      if (!mensagemId || mensagemId === 'chat-mensagens' || mensagemId === 'feedback') {
        return errorResponse('mensagem_id obrigatório', 400);
      }

      const satisfacao =
        body.satisfacao === 1 || body.satisfacao === 0 || body.satisfacao === -1
          ? body.satisfacao
          : body.positive === true
            ? 1
            : body.positive === false
              ? 0
              : null;

      if (satisfacao === null) {
        return errorResponse('satisfacao obrigatória (0 ou 1)', 400);
      }

      const feedback = typeof body.feedback_texto === 'string' ? body.feedback_texto : null;

      const rows = await sql`
        UPDATE chat_mensagens
        SET satisfacao = ${satisfacao},
            feedback_texto = COALESCE(${feedback}, feedback_texto)
        WHERE id = ${mensagemId}
        RETURNING id, satisfacao
      `;

      if (rows.length === 0) return errorResponse('Mensagem não encontrada', 404);
      void user; // auth required even if we don't filter by owner yet
      return jsonResponse({ data: rows[0] });
    }

    if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

    // Prefer JWT; fallback optional for legacy callers but prefer require
    let user;
    try {
      user = await requireAuth(req);
    } catch (e) {
      // Compat: se vier utilizador_id no body sem JWT, rejeitar (segurança)
      if (e instanceof AuthError) return authErrorResponse(e);
      throw e;
    }

    const body = await req.json();
    const pergunta = typeof body.pergunta === 'string' ? body.pergunta.trim() : '';
    const sessao_id = typeof body.sessao_id === 'string' ? body.sessao_id : undefined;

    if (!pergunta || pergunta.length < 2) {
      return errorResponse('Pergunta obrigatória (mín. 2 caracteres)', 400);
    }

    const result = await runAgentTurn({
      pergunta,
      sessao_id,
      user: { id: user.id, email: user.email, role: user.role },
    });

    // Shape compat com chat.service antigo + campos novos
    return jsonResponse({
      data: {
        sessao_id: result.sessao_id,
        mensagem_id: result.mensagem_id,
        resposta: result.markdown || result.resposta,
        markdown: result.markdown,
        ui_blocks: result.ui_blocks,
        fontes: result.fontes,
        precisa_escalar: result.precisa_escalar,
        latencia_ms: result.latencia_ms,
        modelo: result.modelo,
        mode: result.mode,
        phases: result.phases,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[chat-mensagens]', err);
    return errorResponse(publicErrorMessage(err, 'Erro no chat'), 500);
  }
};

export const config: Config = {
  path: ['/api/chat-mensagens', '/api/chat-mensagens/:id', '/api/chat-mensagens/:id/feedback'],
};
