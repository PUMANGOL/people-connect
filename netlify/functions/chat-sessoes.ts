import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * GET /api/chat-sessoes?utilizador_id=<uuid>
 *   Lista sessões do utilizador (mais recentes primeiro)
 *
 * GET /api/chat-sessoes/:id/mensagens
 *   Lista mensagens de uma sessão
 *
 * PATCH /api/chat-sessoes/:id
 *   { arquivada: true } — soft delete
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  try {
    const user = await requireAuth(req);
    // GET /api/chat-sessoes
    if (method === 'GET' && parts[parts.length - 1] === 'chat-sessoes') {
      const utilizadorId = user.id;
      const rows = utilizadorId
        ? await sql`
            SELECT s.id, s.titulo, s.iniciada_em, s.ultima_actividade, s.arquivada,
              (SELECT COUNT(*) FROM chat_mensagens m WHERE m.sessao_id = s.id) as total_mensagens,
              (SELECT COUNT(*) FROM chat_mensagens m WHERE m.sessao_id = s.id AND m.escalada_para_dpc) as escalacoes
            FROM chat_sessoes s
            WHERE s.utilizador_id = ${utilizadorId} AND s.arquivada = false
            ORDER BY s.ultima_actividade DESC LIMIT 50
          `
        : await sql`
            SELECT s.id, s.titulo, s.iniciada_em, s.ultima_actividade, s.arquivada
            FROM chat_sessoes s
            WHERE s.arquivada = false
            ORDER BY s.ultima_actividade DESC LIMIT 100
          `;
      return jsonResponse({ data: rows });
    }

    // GET /api/chat-sessoes/:id/mensagens
    if (method === 'GET' && parts[parts.length - 1] === 'mensagens') {
      const sessaoId = parts[parts.length - 2];
      const msgs = await sql`
        SELECT id, papel, conteudo, reasoning, chunks_utilizados,
               score_relevancia, escalada_para_dpc, satisfacao, feedback_texto,
               latencia_ms, modelo, created_at
        FROM chat_mensagens
        WHERE sessao_id = ${sessaoId}
          AND EXISTS (SELECT 1 FROM chat_sessoes s WHERE s.id = ${sessaoId} AND s.utilizador_id = ${user.id})
        ORDER BY created_at ASC
      `;
      return jsonResponse({ data: msgs });
    }

    // PATCH /api/chat-sessoes/:id
    if (method === 'PATCH') {
      const sessaoId = parts[parts.length - 1];
      const body = await req.json();
      const { arquivada, titulo } = body;
      const rows = await sql`
        UPDATE chat_sessoes SET
          arquivada = COALESCE(${arquivada}, arquivada),
          titulo = COALESCE(${titulo}, titulo)
        WHERE id = ${sessaoId} AND utilizador_id = ${user.id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[chat-sessoes]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/chat-sessoes', '/api/chat-sessoes/:id', '/api/chat-sessoes/:id/mensagens'],
};
