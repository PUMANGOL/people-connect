import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { apagarObjecto, confirmarEnvio, StorageError, urlFicheiro } from './_shared/storage';
import { lerEstrutura } from './_shared/estrutura';

/**
 * O meu perfil (utilizador da sessão).
 * GET    /api/perfil                  — dados pessoais, estrutura orgânica, reconhecimentos e actividade
 * PATCH  /api/perfil                  — { bio, localizacao, telefone, extensao, disponibilidade, posso_ajudar, interesses }
 * PUT    /api/perfil/imagem           — { tipo: 'foto', key } depois do envio para o serviço de ficheiros
 * DELETE /api/perfil/imagem?tipo=foto — remove a foto ou a capa
 */

const DISPONIBILIDADES = ['disponivel', 'ocupado', 'ausente'];
const MAX_ETIQUETAS = 10;

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().slice(0, max);
  return limpo || null;
}

function etiquetas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const item of valor) {
    if (typeof item !== 'string') continue;
    const limpo = item.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!limpo || vistas.has(limpo.toLowerCase())) continue;
    vistas.add(limpo.toLowerCase());
    lista.push(limpo);
    if (lista.length >= MAX_ETIQUETAS) break;
  }
  return lista;
}

async function lerPerfil(userId: string) {
  const rows = await sql`
    SELECT u.id, u.nome, u.email, u.perfil::text AS perfil, u.created_at,
           c.id AS colaborador_id, c.categoria AS colab_categoria, c.data_admissao,
           m.id AS mentor_id, m.data_inicio_contrato, m.bio AS mentor_bio,
           pu.foto_key, pu.capa_key, pu.bio, pu.localizacao, pu.telefone, pu.extensao,
           COALESCE(pu.disponibilidade, 'disponivel') AS disponibilidade,
           COALESCE(pu.posso_ajudar, '{}') AS posso_ajudar,
           COALESCE(pu.interesses, '{}') AS interesses
      FROM utilizadores u
      LEFT JOIN LATERAL (
        SELECT id, categoria, data_admissao
          FROM colaboradores WHERE utilizador_id = u.id ORDER BY created_at DESC LIMIT 1
      ) c ON true
      LEFT JOIN mentors m ON m.utilizador_id = u.id
      LEFT JOIN perfis_utilizador pu ON pu.utilizador_id = u.id
     WHERE u.id = ${userId}
  `;
  if (!rows.length) return null;
  const p = rows[0];

  const [estrutura, stats, reconhecimentos, porValor, ultimosReconhecimentos, actividade, mentor, mentorados, onboarding] =
    await Promise.all([
      lerEstrutura(userId),
      sql`
        SELECT
          (SELECT COUNT(*) FROM comunidade_posts WHERE autor_id = ${userId})::int AS publicacoes,
          (SELECT COUNT(*) FROM comunidade_comentarios WHERE autor_id = ${userId})::int AS comentarios,
          (SELECT COUNT(*) FROM comunidade_reacoes WHERE utilizador_id = ${userId})::int AS gostos
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM reconhecimentos WHERE destinatario_id = ${userId})::int AS recebidos,
          (SELECT COUNT(*) FROM reconhecimentos WHERE autor_id = ${userId})::int AS dados,
          (SELECT COUNT(*) FROM reconhecimento_aplausos a
             JOIN reconhecimentos r ON r.id = a.reconhecimento_id
            WHERE r.destinatario_id = ${userId})::int AS aplausos
      `,
      sql`
        SELECT valor, COUNT(*)::int AS total
          FROM reconhecimentos WHERE destinatario_id = ${userId}
         GROUP BY valor ORDER BY total DESC
      `,
      sql`
        SELECT r.id, r.valor, r.mensagem, r.created_at, u.nome AS autor_nome
          FROM reconhecimentos r JOIN utilizadores u ON u.id = r.autor_id
         WHERE r.destinatario_id = ${userId}
         ORDER BY r.created_at DESC
         LIMIT 5
      `,
      sql`
        (SELECT 'publicacao' AS tipo, p.id AS post_id, COALESCE(p.titulo, '') AS titulo,
                p.conteudo AS texto, p.created_at
           FROM comunidade_posts p WHERE p.autor_id = ${userId})
        UNION ALL
        (SELECT 'comentario' AS tipo, c.post_id, COALESCE(p.titulo, '') AS titulo,
                c.conteudo AS texto, c.created_at
           FROM comunidade_comentarios c JOIN comunidade_posts p ON p.id = c.post_id
          WHERE c.autor_id = ${userId})
        UNION ALL
        (SELECT 'reconhecimento' AS tipo, NULL::uuid AS post_id, r.destinatario_nome AS titulo,
                r.mensagem AS texto, r.created_at
           FROM reconhecimentos r WHERE r.autor_id = ${userId})
        ORDER BY created_at DESC
        LIMIT 12
      `,
      p.colaborador_id
        ? sql`
            SELECT m.nome, m.funcao, m.utilizador_id
              FROM mentor_assignments ma JOIN mentors m ON m.id = ma.mentor_id
             WHERE ma.colaborador_id = ${p.colaborador_id as string} AND ma.activo
             LIMIT 1
          `
        : Promise.resolve([]),
      p.mentor_id
        ? sql`SELECT COUNT(*)::int AS total FROM mentor_assignments WHERE mentor_id = ${p.mentor_id as string} AND activo`
        : Promise.resolve([{ total: 0 }]),
      p.colaborador_id
        ? sql`
            SELECT t.nome AS trilho_nome,
                   COUNT(po.id)::int AS total,
                   COUNT(po.id) FILTER (WHERE po.estado = 'concluida')::int AS concluidas
              FROM colaboradores c
              JOIN trilhos_onboarding t ON t.id = c.trilho_id
              LEFT JOIN progresso_onboarding po ON po.colaborador_id = c.id AND po.trilho_id = t.id
             WHERE c.id = ${p.colaborador_id as string}
             GROUP BY t.nome
          `
        : Promise.resolve([]),
    ]);

  return {
    id: p.id,
    nome: p.nome,
    email: p.email,
    perfil: p.perfil,
    funcao: estrutura.cargo,
    direccao: estrutura.direccao,
    area: estrutura.local_trabalho,
    categoria: p.colab_categoria ?? null,
    data_admissao: p.data_admissao ?? p.data_inicio_contrato ?? null,
    membro_desde: p.created_at,
    foto_url: urlFicheiro(p.foto_key as string | null),
    capa_url: urlFicheiro(p.capa_key as string | null),
    bio: p.bio ?? p.mentor_bio ?? null,
    localizacao: p.localizacao ?? null,
    telefone: p.telefone ?? null,
    extensao: p.extensao ?? null,
    disponibilidade: p.disponibilidade,
    posso_ajudar: p.posso_ajudar ?? [],
    interesses: p.interesses ?? [],
    mentor: mentor[0] ?? null,
    mentorados: (mentorados[0]?.total as number) ?? 0,
    onboarding: onboarding[0] ?? null,
    estrutura,
    estatisticas: stats[0],
    reconhecimentos: {
      ...reconhecimentos[0],
      por_valor: porValor,
      ultimos: ultimosReconhecimentos,
    },
    actividade,
  };
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  const url = new URL(req.url);
  const accao = url.pathname.split('/').filter(Boolean)[2] ?? null;

  try {
    const user = await requireAuth(req);

    if (!accao && req.method === 'GET') {
      const perfil = await lerPerfil(user.id);
      if (!perfil) return errorResponse('Perfil não encontrado', 404);
      return jsonResponse({ data: perfil });
    }

    if (!accao && req.method === 'PATCH') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const [actual] = await sql`SELECT * FROM perfis_utilizador WHERE utilizador_id = ${user.id}`;
      const tem = (campo: string) => Object.prototype.hasOwnProperty.call(body, campo);

      const disponibilidade = tem('disponibilidade') ? body.disponibilidade : actual?.disponibilidade ?? 'disponivel';
      if (typeof disponibilidade !== 'string' || !DISPONIBILIDADES.includes(disponibilidade)) {
        return errorResponse('Disponibilidade inválida', 400);
      }
      const novo = {
        bio: tem('bio') ? texto(body.bio, 600) : actual?.bio ?? null,
        localizacao: tem('localizacao') ? texto(body.localizacao, 80) : actual?.localizacao ?? null,
        telefone: tem('telefone') ? texto(body.telefone, 30) : actual?.telefone ?? null,
        extensao: tem('extensao') ? texto(body.extensao, 10) : actual?.extensao ?? null,
        disponibilidade,
        posso_ajudar: tem('posso_ajudar') ? etiquetas(body.posso_ajudar) : (actual?.posso_ajudar as string[] | undefined) ?? [],
        interesses: tem('interesses') ? etiquetas(body.interesses) : (actual?.interesses as string[] | undefined) ?? [],
      };

      await sql`
        INSERT INTO perfis_utilizador (utilizador_id, bio, localizacao, telefone, extensao, disponibilidade, posso_ajudar, interesses)
        VALUES (${user.id}, ${novo.bio}, ${novo.localizacao}, ${novo.telefone}, ${novo.extensao},
                ${novo.disponibilidade}, ${novo.posso_ajudar}::text[], ${novo.interesses}::text[])
        ON CONFLICT (utilizador_id) DO UPDATE SET
          bio = EXCLUDED.bio, localizacao = EXCLUDED.localizacao, telefone = EXCLUDED.telefone,
          extensao = EXCLUDED.extensao, disponibilidade = EXCLUDED.disponibilidade,
          posso_ajudar = EXCLUDED.posso_ajudar, interesses = EXCLUDED.interesses, updated_at = now()
      `;
      return jsonResponse({ data: novo });
    }

    if (accao === 'imagem' && req.method === 'PUT') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const tipo = body.tipo;
      if (tipo === 'capa') return errorResponse('A capa do perfil é fixa.', 400);
      if (tipo !== 'foto') return errorResponse('Tipo de imagem inválido', 400);
      const key = typeof body.key === 'string' ? body.key : '';
      await confirmarEnvio(tipo, key, `perfis/${user.id}/${tipo}`, user.id);

      const [anterior] = await sql`SELECT foto_key, capa_key FROM perfis_utilizador WHERE utilizador_id = ${user.id}`;
      if (tipo === 'foto') {
        await sql`
          INSERT INTO perfis_utilizador (utilizador_id, foto_key) VALUES (${user.id}, ${key})
          ON CONFLICT (utilizador_id) DO UPDATE SET foto_key = EXCLUDED.foto_key, updated_at = now()
        `;
      } else {
        await sql`
          INSERT INTO perfis_utilizador (utilizador_id, capa_key) VALUES (${user.id}, ${key})
          ON CONFLICT (utilizador_id) DO UPDATE SET capa_key = EXCLUDED.capa_key, updated_at = now()
        `;
      }
      const chaveAnterior = (tipo === 'foto' ? anterior?.foto_key : anterior?.capa_key) as string | null | undefined;
      if (chaveAnterior && chaveAnterior !== key) await apagarObjecto(chaveAnterior);
      return jsonResponse({ data: { tipo, url: urlFicheiro(key) } });
    }

    if (accao === 'imagem' && req.method === 'DELETE') {
      const tipo = url.searchParams.get('tipo');
      if (tipo === 'capa') return errorResponse('A capa do perfil é fixa.', 400);
      if (tipo !== 'foto') return errorResponse('Tipo de imagem inválido', 400);
      const [anterior] = await sql`SELECT foto_key, capa_key FROM perfis_utilizador WHERE utilizador_id = ${user.id}`;
      if (tipo === 'foto') await sql`UPDATE perfis_utilizador SET foto_key = NULL, updated_at = now() WHERE utilizador_id = ${user.id}`;
      else await sql`UPDATE perfis_utilizador SET capa_key = NULL, updated_at = now() WHERE utilizador_id = ${user.id}`;
      await apagarObjecto((tipo === 'foto' ? anterior?.foto_key : anterior?.capa_key) as string | null | undefined);
      return jsonResponse({ data: { tipo, url: null } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[perfil]', err);
    return errorResponse(publicErrorMessage(err, 'Não foi possível actualizar o perfil.'));
  }
};

export const config: Config = {
  path: ['/api/perfil', '/api/perfil/:accao'],
};
