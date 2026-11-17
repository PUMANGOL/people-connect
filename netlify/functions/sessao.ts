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
    const [mentor, perfil, acesso] = await Promise.all([
      sql`SELECT 1 FROM mentors WHERE utilizador_id = ${user.id} AND activo = true LIMIT 1`,
      sql`SELECT foto_key FROM perfis_utilizador WHERE utilizador_id = ${user.id}`,
      paginasDaSessao(user.id, user.role).catch((err) => {
        console.error('[sessao] controlo de acesso', err);
        return { is_dev: false, paginas: [] as { rota: string; visivel: boolean }[] };
      }),
    ]);
    return jsonResponse({
      data: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        departamento: user.departamento,
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
