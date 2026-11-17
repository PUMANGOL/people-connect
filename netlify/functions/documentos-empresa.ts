import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Documentos da Empresa (EPIC 3.3 consulta / 5.6 gestão).
 * GET                        /api/documentos-empresa   — consulta (colaborador e admin)
 * POST                       /api/documentos-empresa   — criar (admin)
 * PATCH/DELETE               /api/documentos-empresa/:id (admin)
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1] !== 'documentos-empresa' ? parts[parts.length - 1] : null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, nome, categoria, url, ficheiro_ref, descricao, created_at
        FROM documentos_empresa ORDER BY categoria, nome
      `;
      return jsonResponse({ data: rows });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = await sql`
        INSERT INTO documentos_empresa (nome, categoria, url, ficheiro_ref, descricao)
        VALUES (${body.nome}, ${body.categoria ?? 'politica'}, ${body.url ?? null}, ${body.ficheiro_ref ?? null}, ${body.descricao ?? null})
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    if (req.method === 'PATCH' && id) {
      const body = await req.json();
      const rows = await sql`
        UPDATE documentos_empresa SET
          nome = COALESCE(${body.nome ?? null}, nome),
          categoria = COALESCE(${body.categoria ?? null}, categoria),
          url = COALESCE(${body.url ?? null}, url),
          descricao = COALESCE(${body.descricao ?? null}, descricao)
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    if (req.method === 'DELETE' && id) {
      await sql`DELETE FROM documentos_empresa WHERE id = ${id}`;
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[documentos-empresa]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/documentos-empresa', '/api/documentos-empresa/:id'],
};
