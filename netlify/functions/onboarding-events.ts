import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Timeline + Notificações + Comentários (leitura).
 *
 * GET  /api/onboarding-timeline/:colaboradorId    — timeline do colaborador
 * GET  /api/onboarding-notificacoes               — inbox do próprio (todos os perfis)
 * PATCH /api/onboarding-notificacoes/:id          — marcar lida
 * POST /api/onboarding-notificacoes/mark-all-read
 * GET  /api/onboarding-comentarios/:colaboradorId — comentários visíveis para o requester
 */

async function colaboradorIdDoUtilizador(uid: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM colaboradores WHERE utilizador_id = ${uid} LIMIT 1`;
  return (rows[0]?.id as string) ?? null;
}

async function mentorIdDoUtilizador(uid: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM mentors WHERE utilizador_id = ${uid} AND activo = true`;
  return (rows[0]?.id as string) ?? null;
}

async function mentorTemAcesso(mentorId: string, colaboradorId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM mentor_assignments
     WHERE mentor_id = ${mentorId} AND colaborador_id = ${colaboradorId} AND activo = true
  `;
  return rows.length > 0;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];

  try {
    const user = await requireAuth(req);
    const method = req.method;

    // === Timeline ===
    if (method === 'GET' && prev === 'onboarding-timeline') {
      const colaboradorId = last;
      if (user.role === 'novo_colaborador') {
        const own = await colaboradorIdDoUtilizador(user.id);
        if (own !== colaboradorId) return errorResponse('Sem acesso', 403);
      } else if (user.role === 'mentor') {
        const mid = await mentorIdDoUtilizador(user.id);
        if (!mid || !(await mentorTemAcesso(mid, colaboradorId))) return errorResponse('Sem acesso', 403);
      }
      const rows = await sql`
        SELECT * FROM onboarding_timeline
         WHERE colaborador_id = ${colaboradorId}
         ORDER BY created_at DESC LIMIT 300
      `;
      return jsonResponse({ data: rows });
    }

    // === Notificações — inbox ===
    if (method === 'GET' && last === 'onboarding-notificacoes') {
      const rows = await sql`
        SELECT * FROM onboarding_notificacoes
         WHERE destinatario_id = ${user.id}
         ORDER BY created_at DESC LIMIT 100
      `;
      const naoLidas = rows.filter((r) => !r.lida).length;
      return jsonResponse({ data: { items: rows, nao_lidas: naoLidas } });
    }

    // === Notificações — mark all read ===
    if (method === 'POST' && last === 'mark-all-read') {
      await sql`
        UPDATE onboarding_notificacoes SET lida = true, lida_em = NOW()
         WHERE destinatario_id = ${user.id} AND lida = false
      `;
      return jsonResponse({ data: { ok: true } });
    }

    // === Notificações — mark single read ===
    if (method === 'PATCH' && prev === 'onboarding-notificacoes') {
      const rows = await sql`
        UPDATE onboarding_notificacoes SET lida = true, lida_em = NOW()
         WHERE id = ${last} AND destinatario_id = ${user.id}
         RETURNING id
      `;
      if (!rows.length) return errorResponse('Notificação não encontrada', 404);
      return jsonResponse({ data: { ok: true } });
    }

    // === Comentários ===
    if (method === 'GET' && prev === 'onboarding-comentarios') {
      const colaboradorId = last;
      if (user.role === 'novo_colaborador') {
        const own = await colaboradorIdDoUtilizador(user.id);
        if (own !== colaboradorId) return errorResponse('Sem acesso', 403);
        // colaborador só vê os visíveis
        const rows = await sql`
          SELECT * FROM onboarding_comentarios
           WHERE colaborador_id = ${colaboradorId} AND visivel_colaborador = true
           ORDER BY created_at DESC LIMIT 100
        `;
        return jsonResponse({ data: rows });
      }
      if (user.role === 'mentor') {
        const mid = await mentorIdDoUtilizador(user.id);
        if (!mid || !(await mentorTemAcesso(mid, colaboradorId))) return errorResponse('Sem acesso', 403);
      }
      const rows = await sql`
        SELECT * FROM onboarding_comentarios
         WHERE colaborador_id = ${colaboradorId}
         ORDER BY created_at DESC LIMIT 200
      `;
      return jsonResponse({ data: rows });
    }

    return errorResponse('Rota não encontrada', 404);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[onboarding-events]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/onboarding-timeline/:colaboradorId',
    '/api/onboarding-notificacoes',
    '/api/onboarding-notificacoes/:id',
    '/api/onboarding-notificacoes/mark-all-read',
    '/api/onboarding-comentarios/:colaboradorId',
  ],
};
