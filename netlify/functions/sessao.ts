import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { urlFicheiro } from './_shared/storage';
import { paginasDaSessao } from './_shared/controlo-acesso';

/** GET /api/sessao — utilizador da sessão actual. */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return errorResponse('Método não suportado', 405);

  try {
    const user = await requireAuth(req);
    // Um admin pode ter também perfil de mentor activo (e mentorados).
    const [mentor, perfil, cargo, acesso] = await Promise.all([
      sql`SELECT 1 FROM mentors WHERE utilizador_id = ${user.id} AND activo = true LIMIT 1`,
      sql`SELECT foto_key FROM perfis_utilizador WHERE utilizador_id = ${user.id}`,
      sql`
        SELECT
          COALESCE(
            NULLIF(btrim(m.funcao), ''),
            NULLIF(btrim(c.funcao), ''),
            NULLIF(btrim(ft.funcao), ''),
            NULLIF(btrim(eo.cargo), '')
          ) AS funcao,
          COALESCE(
            NULLIF(btrim(u.departamento), ''),
            NULLIF(btrim(m.departamento), ''),
            NULLIF(btrim(c.direccao), ''),
            NULLIF(btrim(eo.direccao), '')
          ) AS departamento
        FROM utilizadores u
        LEFT JOIN mentors m ON m.utilizador_id = u.id
        LEFT JOIN LATERAL (
          SELECT funcao, direccao
            FROM colaboradores
           WHERE utilizador_id = u.id
           ORDER BY created_at DESC
           LIMIT 1
        ) c ON true
        LEFT JOIN LATERAL (
          SELECT f.funcao
            FROM fichas_trabalhador f
            JOIN colaboradores c2 ON c2.id = f.colaborador_id
           WHERE c2.utilizador_id = u.id
           ORDER BY f.updated_at DESC
           LIMIT 1
        ) ft ON true
        LEFT JOIN LATERAL (
          SELECT cargo, direccao
            FROM estrutura_organica
           WHERE lower(u.email) = ANY(emails)
           LIMIT 1
        ) eo ON true
        WHERE u.id = ${user.id}
      `.catch((err) => {
        console.error('[sessao] cargo', err);
        return [] as { funcao: string | null; departamento: string | null }[];
      }),
      paginasDaSessao(user.id, user.role).catch((err) => {
        console.error('[sessao] controlo de acesso', err);
        return { is_dev: false, paginas: [] as { rota: string; visivel: boolean }[] };
      }),
    ]);
    const funcao = (cargo[0]?.funcao as string | null) ?? null;
    const departamento = (cargo[0]?.departamento as string | null) ?? user.departamento ?? null;
    return jsonResponse({
      data: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        funcao,
        departamento,
        is_mentor: mentor.length > 0,
        foto_url: urlFicheiro(perfil[0]?.foto_key as string | null | undefined),
        is_dev: acesso.is_dev,
        paginas: acesso.paginas,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[sessao]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: '/api/sessao',
};
