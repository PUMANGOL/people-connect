import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import {
  ErroAcesso,
  apagarGrupo,
  assertDev,
  actualizarGrupo,
  carregarPainel,
  criarGrupo,
  definirRestrito,
} from './_shared/controlo-acesso';

/**
 * Controlo de acesso por página. Só a conta DEV (grupo `dev`).
 *
 * GET    /api/acessos       — grupos, páginas e pessoas
 * PATCH  /api/acessos/:id  — { restrito: boolean }
 * POST   /api/grupos       — { nome, descricao }
 * PATCH  /api/grupos/:id   — nome, descricao, utilizador_ids, acesso_ids
 * DELETE /api/grupos/:id
 *
 * As mutações devolvem o painel actualizado.
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const partes = new URL(req.url).pathname.split('/').filter(Boolean);

  try {
    const user = await requireAuth(req);
    await assertDev(user.id, user.role);
    const method = req.method;

    if (method === 'GET' && partes.length === 2 && partes[1] === 'acessos') {
      return jsonResponse({ data: await carregarPainel(user.id) });
    }

    if (method === 'PATCH' && partes[1] === 'acessos' && partes.length === 3) {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.restrito !== 'boolean') return errorResponse('Indica se a página fica restrita.', 400);
      await definirRestrito(partes[2], body.restrito);
      return jsonResponse({ data: await carregarPainel(user.id) });
    }

    if (method === 'POST' && partes[1] === 'grupos' && partes.length === 2) {
      const body = await req.json().catch(() => ({}));
      await criarGrupo(body?.nome, body?.descricao);
      return jsonResponse({ data: await carregarPainel(user.id) }, 201);
    }

    if (method === 'PATCH' && partes[1] === 'grupos' && partes.length === 3) {
      const body = await req.json().catch(() => ({}));
      await actualizarGrupo(partes[2], body ?? {});
      return jsonResponse({ data: await carregarPainel(user.id) });
    }

    if (method === 'DELETE' && partes[1] === 'grupos' && partes.length === 3) {
      await apagarGrupo(partes[2]);
      return jsonResponse({ data: await carregarPainel(user.id) });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof ErroAcesso) return errorResponse(err.message, err.status);
    if ((err as { code?: string }).code === '42P01') {
      return errorResponse('Falta aplicar a migração 0022_controlo_acesso.', 503);
    }
    console.error('[acessos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/acessos', '/api/acessos/:id', '/api/grupos', '/api/grupos/:id'],
};
