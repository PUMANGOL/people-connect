import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Documentos Exigidos — checklist definido pelo admin (EPIC 5.7).
 * GET                          /api/documentos-exigidos
 * POST                         /api/documentos-exigidos           (admin)
 * PATCH/DELETE                 /api/documentos-exigidos/:id        (admin)
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1] !== 'documentos-exigidos' ? parts[parts.length - 1] : null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, nome, descricao, obrigatorio, categoria, ordem, activo, created_at
        FROM documentos_exigidos WHERE activo = true ORDER BY ordem, nome
      `;
      return jsonResponse({ data: rows });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = await sql`
        INSERT INTO documentos_exigidos (nome, descricao, obrigatorio, categoria, ordem)
        VALUES (${body.nome}, ${body.descricao ?? null}, ${body.obrigatorio ?? true}, ${body.categoria ?? null}, ${body.ordem ?? 0})
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    if (req.method === 'PATCH' && id) {
      const body = await req.json();
      const rows = await sql`
        UPDATE documentos_exigidos SET
          nome = COALESCE(${body.nome ?? null}, nome),
          descricao = COALESCE(${body.descricao ?? null}, descricao),
          obrigatorio = COALESCE(${body.obrigatorio ?? null}, obrigatorio),
          categoria = ${body.categoria === undefined ? null : body.categoria},
          ordem = COALESCE(${body.ordem ?? null}, ordem),
          activo = COALESCE(${body.activo ?? null}, activo)
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    if (req.method === 'DELETE' && id) {
      // Soft delete para preservar submissões associadas
      await sql`UPDATE documentos_exigidos SET activo = false WHERE id = ${id}`;
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[documentos-exigidos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/documentos-exigidos', '/api/documentos-exigidos/:id'],
};
