import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';

/**
 * Proxy para a API do Dify (app "Pumuki"). A chave fica no servidor; o browser só fala connosco.
 *
 * GET    /api/dify/parametros                     — mensagem de abertura e perguntas sugeridas
 * POST   /api/dify/chat                           — { query, conversation_id? } → stream SSE do Dify
 * POST   /api/dify/chat/:taskId/parar             — interrompe a resposta em curso
 * GET    /api/dify/conversas                      — conversas do utilizador
 * GET    /api/dify/conversas/:id/mensagens        — histórico de uma conversa
 * DELETE /api/dify/conversas/:id                  — apaga uma conversa
 * POST   /api/dify/mensagens/:id/feedback         — { rating: 'like' | 'dislike' | null }
 *
 * Env: DIFY_API_URL (ex.: https://api.dify.ai/v1), DIFY_API_KEY (chave da app), DIFY_APP_ID (referência).
 */

const MAX_PERGUNTA = 4000;

function difyBase(): string {
  const base = (process.env.DIFY_API_URL ?? '').replace(/\/+$/, '');
  if (!base || !process.env.DIFY_API_KEY) {
    throw new Error('Assistente indisponível: a integração com o Dify não está configurada.');
  }
  return base;
}

/** Identificador do utilizador no Dify: pseudónimo estável (sem nome nem email). */
function difyUser(user: AuthUser): string {
  return `pc-${user.id}`;
}

function difyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${difyBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Converte erros do Dify em mensagens em português (nunca expõe detalhes internos). */
async function erroDify(res: Response): Promise<Response> {
  const corpo = await res.json().catch(() => ({} as { code?: string; message?: string }));
  const code = String(corpo?.code ?? '');
  console.error('[dify]', res.status, code, corpo?.message);
  if (res.status === 404 && /conversation/i.test(`${code} ${corpo?.message ?? ''}`)) {
    return errorResponse('Esta conversa já não existe. Comece uma nova conversa.', 404);
  }
  if (res.status === 429) return errorResponse('O assistente está com muitos pedidos. Tente de novo dentro de momentos.', 429);
  if (res.status === 401) return errorResponse('Assistente indisponível: chave de acesso inválida.', 502);
  return errorResponse('O assistente não conseguiu responder. Tente novamente.', 502);
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  // ['api', 'dify', recurso, id?, sub?]
  const parts = url.pathname.split('/').filter(Boolean);
  const recurso = parts[2];
  const id = parts[3] ?? null;
  const sub = parts[4] ?? null;

  try {
    const user = await requireAuth(req);
    const utilizador = difyUser(user);

    // ===== Parâmetros da app (abertura + sugestões) =====
    if (req.method === 'GET' && recurso === 'parametros') {
      const res = await difyFetch('/parameters');
      if (!res.ok) return erroDify(res);
      const p = await res.json();
      return jsonResponse({
        data: {
          mensagem_abertura: p.opening_statement || '',
          perguntas_sugeridas: Array.isArray(p.suggested_questions) ? p.suggested_questions : [],
          sugestoes_apos_resposta: !!p.suggested_questions_after_answer?.enabled,
        },
      });
    }

    // ===== Enviar mensagem (stream SSE) =====
    if (req.method === 'POST' && recurso === 'chat' && !id) {
      const body = await req.json().catch(() => ({}));
      const query = typeof body?.query === 'string' ? body.query.trim() : '';
      if (!query) return errorResponse('Escreva uma pergunta.', 400);
      if (query.length > MAX_PERGUNTA) return errorResponse(`A pergunta não pode ter mais de ${MAX_PERGUNTA} caracteres.`, 400);
      const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';

      const res = await difyFetch('/chat-messages', {
        method: 'POST',
        body: JSON.stringify({
          query,
          inputs: {},
          response_mode: 'streaming',
          conversation_id: conversationId,
          user: utilizador,
          auto_generate_name: true,
        }),
        // Se o utilizador fechar/cancelar, cancela também o pedido ao Dify.
        signal: req.signal,
      });
      if (!res.ok || !res.body) return erroDify(res);

      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ===== Parar resposta =====
    if (req.method === 'POST' && recurso === 'chat' && id && sub === 'parar') {
      const res = await difyFetch(`/chat-messages/${encodeURIComponent(id)}/stop`, {
        method: 'POST',
        body: JSON.stringify({ user: utilizador }),
      });
      if (!res.ok) return erroDify(res);
      return jsonResponse({ data: { ok: true } });
    }

    // ===== Conversas =====
    if (recurso === 'conversas') {
      if (req.method === 'GET' && !id) {
        const res = await difyFetch(`/conversations?user=${encodeURIComponent(utilizador)}&limit=20&sort_by=-updated_at`);
        if (!res.ok) return erroDify(res);
        const j = await res.json();
        const conversas = (j.data ?? []).map((c: { id: string; name: string; updated_at: number }) => ({
          id: c.id, nome: c.name, actualizada_em: c.updated_at,
        }));
        return jsonResponse({ data: conversas });
      }
      if (req.method === 'GET' && id && sub === 'mensagens') {
        const res = await difyFetch(
          `/messages?user=${encodeURIComponent(utilizador)}&conversation_id=${encodeURIComponent(id)}&limit=50`,
        );
        if (!res.ok) return erroDify(res);
        const j = await res.json();
        const mensagens = (j.data ?? []).map((m: {
          id: string; query: string; answer: string; created_at: number; feedback?: { rating?: string } | null;
        }) => ({
          id: m.id, pergunta: m.query, resposta: m.answer, criada_em: m.created_at,
          avaliacao: m.feedback?.rating ?? null,
        }));
        return jsonResponse({ data: mensagens });
      }
      if (req.method === 'DELETE' && id && !sub) {
        const res = await difyFetch(`/conversations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          body: JSON.stringify({ user: utilizador }),
        });
        if (!res.ok && res.status !== 204) return erroDify(res);
        return jsonResponse({ data: { ok: true } });
      }
    }

    // ===== Feedback numa resposta =====
    if (req.method === 'POST' && recurso === 'mensagens' && id && sub === 'feedback') {
      const body = await req.json().catch(() => ({}));
      const rating = body?.rating === 'like' || body?.rating === 'dislike' ? body.rating : null;
      const res = await difyFetch(`/messages/${encodeURIComponent(id)}/feedbacks`, {
        method: 'POST',
        body: JSON.stringify({ rating, user: utilizador }),
      });
      if (!res.ok) return erroDify(res);
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Rota não encontrada', 404);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if ((err as { name?: string })?.name === 'AbortError') return new Response(null, { status: 499 });
    console.error('[dify]', err);
    return errorResponse(publicErrorMessage(err, 'O assistente não está disponível de momento.'));
  }
};

export const config: Config = {
  path: [
    '/api/dify/parametros',
    '/api/dify/chat',
    '/api/dify/chat/:id/parar',
    '/api/dify/conversas',
    '/api/dify/conversas/:id',
    '/api/dify/conversas/:id/mensagens',
    '/api/dify/mensagens/:id/feedback',
  ],
};
