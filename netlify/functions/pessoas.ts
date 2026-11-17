import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { urlFicheiro } from './_shared/storage';
import { lerEstrutura, pessoasOrg } from './_shared/estrutura';

/**
 * Directório de pessoas (colaboradores, mentores e admins) — todos os perfis.
 * GET /api/pessoas?q=texto   — pesquisa por nome, email, função ou unidade (máx. 8)
 * GET /api/pessoas/:id       — perfil (id = utilizadores.id), estrutura orgânica e actividade na Comunidade
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return errorResponse('Método não suportado', 405);

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ?? null;

  try {
    await requireAuth(req);

    // ===== Pesquisa =====
    if (!id) {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
      if (q.length < 2) return jsonResponse({ data: [] });
      const padrao = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const rows = await sql`
        SELECT p.id, p.nome, p.perfil, p.funcao, p.direccao, p.foto_key,
               (
                 EXISTS (
                   SELECT 1 FROM grupo_utilizador gu
                     JOIN grupo g ON g.id = gu.grupo_id
                    WHERE gu.utilizador_id = p.id AND g.chave = 'mentores'
                 )
                 OR EXISTS (
                   SELECT 1 FROM mentors m
                     JOIN mentor_assignments ma ON ma.mentor_id = m.id AND ma.activo = true
                    WHERE m.utilizador_id = p.id
                 )
               ) AS e_mentor
          FROM (${pessoasOrg()}) p
         WHERE p.estado = 'activo'
           AND (p.nome ILIKE ${padrao} OR p.email ILIKE ${padrao}
                OR p.funcao ILIKE ${padrao} OR p.unidade ILIKE ${padrao})
         ORDER BY (p.nome ILIKE ${q + '%'}) DESC, p.nome
         LIMIT 8
      `;
      return jsonResponse({
        data: rows.map(({ foto_key, e_mentor, ...r }) => ({
          ...r,
          e_mentor: e_mentor === true || e_mentor === 't' || e_mentor === 'true',
          foto_url: urlFicheiro(foto_key as string | null),
        })),
      });
    }

    // ===== Perfil =====
    if (!UUID_RE.test(id)) return errorResponse('Perfil não encontrado', 404);
    const rows = await sql`
      SELECT u.id, u.nome, u.email, u.perfil::text AS perfil, u.estado, u.created_at,
             c.categoria AS colab_categoria, c.data_admissao,
             m.data_inicio_contrato, m.bio,
             (
               EXISTS (
                 SELECT 1 FROM grupo_utilizador gu
                   JOIN grupo g ON g.id = gu.grupo_id
                  WHERE gu.utilizador_id = u.id AND g.chave = 'mentores'
               )
               OR EXISTS (
                 SELECT 1 FROM mentor_assignments ma
                  WHERE ma.mentor_id = m.id AND ma.activo = true
               )
             ) AS e_mentor,
             pu.foto_key, pu.capa_key, pu.bio AS perfil_bio, pu.localizacao, pu.extensao,
             pu.disponibilidade, pu.posso_ajudar, pu.interesses
        FROM utilizadores u
        LEFT JOIN LATERAL (
          SELECT categoria, data_admissao
            FROM colaboradores WHERE utilizador_id = u.id ORDER BY created_at DESC LIMIT 1
        ) c ON true
        LEFT JOIN mentors m ON m.utilizador_id = u.id
        LEFT JOIN perfis_utilizador pu ON pu.utilizador_id = u.id
       WHERE u.id = ${id}
    `;
    if (!rows.length) return errorResponse('Perfil não encontrado', 404);
    const p = rows[0];

    const estrutura = await lerEstrutura(id);
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM comunidade_posts WHERE autor_id = ${id})::int AS publicacoes,
        (SELECT COUNT(*) FROM comunidade_comentarios WHERE autor_id = ${id})::int AS comentarios,
        (SELECT COUNT(*) FROM comunidade_reacoes WHERE utilizador_id = ${id})::int AS gostos
    `;

    // Actividade recente na Comunidade (publicações e comentários)
    const actividade = await sql`
      (SELECT 'publicacao' AS tipo, p.id AS post_id, COALESCE(p.titulo, '') AS titulo,
              p.conteudo AS texto, p.created_at
         FROM comunidade_posts p WHERE p.autor_id = ${id})
      UNION ALL
      (SELECT 'comentario' AS tipo, c.post_id, COALESCE(p.titulo, '') AS titulo,
              c.conteudo AS texto, c.created_at
         FROM comunidade_comentarios c JOIN comunidade_posts p ON p.id = c.post_id
        WHERE c.autor_id = ${id})
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return jsonResponse({
      data: {
        id: p.id,
        nome: p.nome,
        email: p.email,
        perfil: p.perfil,
        e_mentor: p.e_mentor === true || p.e_mentor === 't' || p.e_mentor === 'true',
        activo: p.estado === 'activo',
        funcao: estrutura.cargo,
        direccao: estrutura.direccao,
        area: estrutura.local_trabalho,
        categoria: p.colab_categoria ?? null,
        data_admissao: p.data_admissao ?? p.data_inicio_contrato ?? null,
        bio: p.perfil_bio ?? p.bio ?? null,
        foto_url: urlFicheiro(p.foto_key as string | null),
        capa_url: urlFicheiro(p.capa_key as string | null),
        localizacao: p.localizacao ?? null,
        extensao: p.extensao ?? null,
        disponibilidade: p.disponibilidade ?? null,
        posso_ajudar: p.posso_ajudar ?? [],
        interesses: p.interesses ?? [],
        membro_desde: p.created_at,
        estrutura,
        estatisticas: stats,
        actividade,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[pessoas]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/pessoas', '/api/pessoas/:id'],
};
