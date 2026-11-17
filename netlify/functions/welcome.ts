import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { asStringArray } from './_shared/opcoes';
import { invalidarColaboradores } from './_shared/cache-leitura';

/**
 * Welcome Flow do novo colaborador (EPIC 2).
 *
 * GET  /api/welcome/estado    — vídeos, perguntas do quiz, flags welcome_completed e
 *                               ficha_submetida do colaborador ligado à conta autenticada.
 * POST /api/welcome/completar — regista resultado do quiz e marca welcome_completed=true.
 *
 * O colaborador é resolvido por colaboradores.utilizador_id = <sub do JWT>.
 * Nunca se confia em ids do cliente.
 */

async function resolveColaborador(utilizadorId: string) {
  const rows = await sql`
    SELECT c.id, c.categoria, c.welcome_completed,
           COALESCE(f.estado = 'submetida', false) AS ficha_submetida
    FROM colaboradores c
    LEFT JOIN fichas_trabalhador f ON f.colaborador_id = c.id
    WHERE c.utilizador_id = ${utilizadorId}
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  return rows[0] as { id: string; categoria: string; welcome_completed: boolean; ficha_submetida: boolean } | undefined;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];

  try {
    const user = await requireAuth(req);

    // GET /api/welcome/estado
    if (req.method === 'GET' && last === 'estado') {
      const colaborador = await resolveColaborador(user.id);

      const videos = await sql`
        SELECT slot, titulo, url, descricao, duracao_minima_segundos
        FROM welcome_videos WHERE ativo = true
        ORDER BY ordem, slot
      `;

      const cfg = await sql`SELECT perguntas_por_sessao, ordem_aleatoria, quiz_ativo FROM quiz_config WHERE id = 1`;
      const n = (cfg[0]?.perguntas_por_sessao as number) ?? 10;
      const aleatoria = cfg[0]?.ordem_aleatoria ?? true;
      const quizAtivo = (cfg[0]?.quiz_ativo as boolean | undefined) ?? true;

      const perguntas = !quizAtivo
        ? []
        : aleatoria
        ? await sql`
            SELECT id, tipo, pergunta, opcoes, resposta_correcta, explicacao
            FROM quiz_perguntas WHERE activa = true
            ORDER BY random() LIMIT ${n}
          `
        : await sql`
            SELECT id, tipo, pergunta, opcoes, resposta_correcta, explicacao
            FROM quiz_perguntas WHERE activa = true
            ORDER BY created_at ASC LIMIT ${n}
          `;

      return jsonResponse({
        data: {
          // Admin (sem registo de colaborador) nunca fica preso no welcome.
          welcome_completed: colaborador ? colaborador.welcome_completed : true,
          colaborador_id: colaborador?.id ?? null,
          // Ficha do Trabalhador: primeiro passo do Welcome Flow enquanto não for submetida.
          ficha_submetida: colaborador ? colaborador.ficha_submetida : true,
          videos,
          quiz_ativo: quizAtivo,
          quiz: perguntas.map((row) => ({ ...row, opcoes: asStringArray(row.opcoes) })),
        },
      });
    }

    // POST /api/welcome/completar
    if (req.method === 'POST' && last === 'completar') {
      const colaborador = await resolveColaborador(user.id);
      if (!colaborador) {
        // Sem registo de colaborador (ex.: admin) — nada a marcar.
        return jsonResponse({ data: { ok: true, welcome_completed: true } });
      }

      const body = await req.json().catch(() => ({}));
      const total = Number(body.total) || 0;
      const acertos = Number(body.acertos) || 0;
      const percentagem = total > 0 ? Math.round((acertos / total) * 100) : 0;
      const detalhes = Array.isArray(body.detalhes) ? body.detalhes : [];

      await sql`
        INSERT INTO quiz_resultados (colaborador_id, utilizador_id, total, acertos, percentagem, detalhes)
        VALUES (${colaborador.id}, ${user.id}, ${total}, ${acertos}, ${percentagem}, ${JSON.stringify(detalhes)}::text::jsonb)
      `;

      await sql`
        UPDATE colaboradores SET welcome_completed = true, updated_at = NOW()
        WHERE id = ${colaborador.id}
      `;
      invalidarColaboradores();

      return jsonResponse({ data: { ok: true, welcome_completed: true, percentagem } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[welcome]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/welcome/estado', '/api/welcome/completar'],
};
