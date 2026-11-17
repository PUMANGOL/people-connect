import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * GET  /api/escalacoes?estado=
 * PATCH /api/escalacoes/:id  { estado, resposta_dpc, atribuido_a }
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (!isDatabaseConfigured()) return errorResponse('DATABASE_URL não configurada', 503);

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const id = last !== 'escalacoes' ? last : null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET' && !id) {
      const estado = url.searchParams.get('estado');
      const rows = estado
        ? await sql`
            SELECT e.*, u.nome as utilizador_nome, u.email as utilizador_email
            FROM escalacoes e
            LEFT JOIN utilizadores u ON u.id = e.utilizador_id
            WHERE e.estado = ${estado}
            ORDER BY e.criado_em DESC
            LIMIT 100
          `
        : await sql`
            SELECT e.*, u.nome as utilizador_nome, u.email as utilizador_email
            FROM escalacoes e
            LEFT JOIN utilizadores u ON u.id = e.utilizador_id
            ORDER BY e.criado_em DESC
            LIMIT 100
          `;
      return jsonResponse({ data: rows });
    }

    if (req.method === 'PATCH' && id) {
      if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
      const body = await req.json();
      const { estado, resposta_dpc, atribuido_a } = body;
      const rows = await sql`
        UPDATE escalacoes SET
          estado = COALESCE(${estado ?? null}, estado),
          resposta_dpc = COALESCE(${resposta_dpc ?? null}, resposta_dpc),
          atribuido_a = COALESCE(${atribuido_a ?? null}, atribuido_a),
          respondida_em = CASE
            WHEN ${estado ?? null} IN ('respondida', 'adicionada_kb') THEN NOW()
            ELSE respondida_em
          END
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Escalação não encontrada', 404);
      return jsonResponse({ data: rows[0] });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[escalacoes]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'), 500);
  }
};

export const config: Config = {
  path: ['/api/escalacoes', '/api/escalacoes/:id'],
};
