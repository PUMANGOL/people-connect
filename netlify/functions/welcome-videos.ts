import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Gestão dos vídeos de boas-vindas (EPIC 2.8 / 5.4). Admin.
 * GET   /api/welcome-videos           — lista os vídeos pela ordem do Welcome Flow
 * POST  /api/welcome-videos           — novo vídeo { titulo, url, descricao, duracao_minima_segundos }
 * POST  /api/welcome-videos/reordenar — { slots: string[] } — nova sequência (arrastar e soltar)
 * PATCH /api/welcome-videos/:slot      — { titulo, url, descricao, duracao_minima_segundos, ativo }
 * DELETE /api/welcome-videos/:slot     — remove o tipo de vídeo (deixa de aparecer no Welcome Flow)
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const slot = parts[parts.length - 1] !== 'welcome-videos' ? parts[parts.length - 1] : null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      const rows = await sql`SELECT slot, titulo, url, descricao, duracao_minima_segundos, ativo, ordem, updated_at FROM welcome_videos ORDER BY ordem, slot`;
      return jsonResponse({ data: rows });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    if (req.method === 'POST' && !slot) {
      const body = await req.json().catch(() => ({}));
      const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
      const videoUrl = typeof body?.url === 'string' ? body.url.trim() : '';
      if (!titulo) return errorResponse('O título do vídeo é obrigatório', 400);
      if (!/^https?:\/\/\S+$/i.test(videoUrl)) return errorResponse('Indique um URL válido (http:// ou https://)', 400);
      const duracao = Math.max(0, Math.min(600, Number(body?.duracao_minima_segundos) || 20));
      // Entra no fim da sequência; o admin pode reordenar depois.
      const novoSlot = `extra_${Date.now().toString(36)}`;
      const rows = await sql`
        INSERT INTO welcome_videos (slot, titulo, url, descricao, duracao_minima_segundos, ordem)
        VALUES (${novoSlot}, ${titulo}, ${videoUrl}, ${body?.descricao?.trim?.() || null}, ${duracao},
                (SELECT COALESCE(MAX(ordem), 0) + 1 FROM welcome_videos))
        RETURNING slot, titulo, url, descricao, duracao_minima_segundos, ativo, ordem, updated_at
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    if (req.method === 'POST' && slot === 'reordenar') {
      const body = await req.json().catch(() => ({}));
      const slots = Array.isArray(body?.slots) ? body.slots.filter((s: unknown) => typeof s === 'string') : [];
      if (!slots.length) return errorResponse('Indique a nova ordem dos vídeos', 400);
      // Slots omitidos (ex.: criados entretanto noutra sessão) ficam no fim, pela ordem actual.
      await sql`
        UPDATE welcome_videos w SET ordem = o.n, updated_at = NOW()
        FROM (
          SELECT v.slot, ROW_NUMBER() OVER (
            ORDER BY COALESCE(array_position(${sql.array(slots)}::text[], v.slot), 2147483647), v.ordem, v.slot
          ) AS n
          FROM welcome_videos v
        ) o
        WHERE w.slot = o.slot
      `;
      return jsonResponse({ data: { ok: true } });
    }

    if (req.method === 'PATCH' && slot) {
      const body = await req.json();
      const { titulo, url: videoUrl, descricao, duracao_minima_segundos } = body;
      const ativo = typeof body?.ativo === 'boolean' ? body.ativo : null;
      const duracao = duracao_minima_segundos != null
        ? Math.max(0, Math.min(600, Number(duracao_minima_segundos) || 0))
        : null;
      const rows = await sql`
        UPDATE welcome_videos SET
          titulo = COALESCE(${titulo ?? null}, titulo),
          url = COALESCE(${videoUrl ?? null}, url),
          descricao = COALESCE(${descricao ?? null}, descricao),
          duracao_minima_segundos = COALESCE(${duracao}, duracao_minima_segundos),
          ativo = COALESCE(${ativo}, ativo),
          updated_at = NOW()
        WHERE slot = ${slot}
        RETURNING slot, titulo, url, descricao, duracao_minima_segundos, ativo, ordem, updated_at
      `;
      if (!rows.length) return errorResponse('Slot não encontrado', 404);
      return jsonResponse({ data: rows[0] });
    }

    if (req.method === 'DELETE' && slot) {
      const rows = await sql`DELETE FROM welcome_videos WHERE slot = ${slot} RETURNING slot`;
      if (!rows.length) return errorResponse('Slot não encontrado', 404);
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[welcome-videos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/welcome-videos', '/api/welcome-videos/:slot'],
};
