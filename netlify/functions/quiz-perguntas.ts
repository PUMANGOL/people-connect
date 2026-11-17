import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { asStringArray } from './_shared/opcoes';

function withOpcoes<T extends Record<string, unknown>>(row: T) {
  return { ...row, opcoes: asStringArray(row.opcoes) };
}

/**
 * Banco de perguntas do quiz, configuração e resultados (EPIC 2.9 / 5.3 / 2.10). Admin.
 *
 * GET/POST                 /api/quiz-perguntas
 * PATCH/DELETE             /api/quiz-perguntas/:id
 * GET/PATCH                /api/quiz-config
 * GET                      /api/quiz-resultados
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const resource = parts.includes('quiz-config')
    ? 'config'
    : parts.includes('quiz-resultados')
      ? 'resultados'
      : 'perguntas';
  const id = parts[parts.length - 1] !== 'quiz-perguntas' && resource === 'perguntas' ? parts[parts.length - 1] : null;

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    // ----- Config -----
    if (resource === 'config') {
      if (req.method === 'GET') {
        const rows = await sql`SELECT perguntas_por_sessao, ordem_aleatoria, quiz_ativo FROM quiz_config WHERE id = 1`;
        return jsonResponse({ data: rows[0] ?? { perguntas_por_sessao: 10, ordem_aleatoria: true, quiz_ativo: true } });
      }
      if (req.method === 'PATCH') {
        const body = await req.json();
        const quizAtivo = typeof body.quiz_ativo === 'boolean' ? body.quiz_ativo : null;
        const rows = await sql`
          UPDATE quiz_config SET
            perguntas_por_sessao = COALESCE(${body.perguntas_por_sessao ?? null}, perguntas_por_sessao),
            ordem_aleatoria = COALESCE(${body.ordem_aleatoria ?? null}, ordem_aleatoria),
            quiz_ativo = COALESCE(${quizAtivo}, quiz_ativo)
          WHERE id = 1
          RETURNING perguntas_por_sessao, ordem_aleatoria, quiz_ativo
        `;
        return jsonResponse({ data: rows[0] });
      }
      return errorResponse('Método não suportado', 405);
    }

    // ----- Resultados -----
    if (resource === 'resultados') {
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT r.id, r.total, r.acertos, r.percentagem, r.created_at,
                 c.id AS colaborador_id, c.nome AS colaborador_nome
          FROM quiz_resultados r
          LEFT JOIN colaboradores c ON c.id = r.colaborador_id
          ORDER BY r.created_at DESC LIMIT 200
        `;
        return jsonResponse({ data: rows });
      }
      return errorResponse('Método não suportado', 405);
    }

    // ----- Perguntas -----
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, tipo, pergunta, opcoes, resposta_correcta, explicacao, activa, created_at
        FROM quiz_perguntas ORDER BY created_at DESC
      `;
      return jsonResponse({ data: rows.map(withOpcoes) });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = await sql`
        INSERT INTO quiz_perguntas (tipo, pergunta, opcoes, resposta_correcta, explicacao, activa)
        VALUES (
          ${body.tipo ?? 'escolha_multipla'},
          ${body.pergunta},
          ${sql.json(asStringArray(body.opcoes))},
          ${body.resposta_correcta ?? null},
          ${body.explicacao ?? null},
          ${body.activa ?? true}
        )
        RETURNING *
      `;
      return jsonResponse({ data: withOpcoes(rows[0]) }, 201);
    }

    if (req.method === 'PATCH' && id) {
      const body = await req.json();
      const rows = await sql`
        UPDATE quiz_perguntas SET
          tipo = COALESCE(${body.tipo ?? null}, tipo),
          pergunta = COALESCE(${body.pergunta ?? null}, pergunta),
          opcoes = COALESCE(${body.opcoes == null ? null : sql.json(asStringArray(body.opcoes))}, opcoes),
          resposta_correcta = ${body.resposta_correcta === undefined ? null : body.resposta_correcta},
          explicacao = COALESCE(${body.explicacao ?? null}, explicacao),
          activa = COALESCE(${body.activa ?? null}, activa)
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] ? withOpcoes(rows[0]) : rows[0] });
    }

    if (req.method === 'DELETE' && id) {
      await sql`DELETE FROM quiz_perguntas WHERE id = ${id}`;
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[quiz-perguntas]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/quiz-perguntas',
    '/api/quiz-perguntas/:id',
    '/api/quiz-config',
    '/api/quiz-resultados',
  ],
};
