import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';
import { directoresDe, pessoasOrg } from './_shared/estrutura';

/**
 * Mural de reconhecimento.
 * GET  /api/reconhecimentos
 * POST /api/reconhecimentos
 * POST /api/reconhecimentos/:id/aplauso
 * POST /api/reconhecimentos/:id/comentarios   { conteudo }
 * POST /api/reconhecimentos/voto              { nomeadoId }
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALORES = ['seguranca', 'cliente', 'equipa', 'inovacao', 'integridade'] as const;
type Valor = (typeof VALORES)[number];

const NOME_VALOR: Record<Valor, string> = {
  seguranca: 'Segurança em primeiro',
  cliente: 'Foco no cliente',
  equipa: 'Espírito de equipa',
  inovacao: 'Inovação',
  integridade: 'Integridade',
};

function resumo(texto: string, max = 120): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

function valorValido(v: unknown): v is Valor {
  return typeof v === 'string' && (VALORES as readonly string[]).includes(v);
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ?? null;
  const sub = parts[3] ?? null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET' && !id) return jsonResponse({ data: await painel(user.id) });

    if (req.method === 'POST' && !id) return publicar(req, user);

    if (req.method === 'POST' && id === 'voto') return votar(req, user.id);

    if (id && !UUID_RE.test(id)) return errorResponse('Reconhecimento não encontrado', 404);

    if (req.method === 'POST' && id && sub === 'aplauso') {
      const existe = await sql`SELECT 1 FROM reconhecimentos WHERE id = ${id} LIMIT 1`;
      if (!existe.length) return errorResponse('Reconhecimento não encontrado', 404);
      return jsonResponse({ data: await alternarAplauso(id, user.id) });
    }

    if (req.method === 'POST' && id && sub === 'comentarios') return comentar(req, id, user.id);

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[reconhecimentos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

async function painel(utilizadorId: string) {
  const itens = await sql`
    SELECT
      r.id,
      r.autor_id AS "deId",
      ua.nome AS "deNome",
      r.destinatario_id AS "paraId",
      r.destinatario_nome AS "paraNome",
      r.valor,
      r.mensagem,
      r.visibilidade,
      r.informar_chefe AS "informarChefe",
      COALESCE(r.direccao, '') AS direccao,
      r.posto,
      r.created_at AS "createdAt",
      (SELECT COUNT(*)::int FROM reconhecimento_aplausos a WHERE a.reconhecimento_id = r.id) AS aplausos,
      EXISTS (
        SELECT 1 FROM reconhecimento_aplausos a
         WHERE a.reconhecimento_id = r.id AND a.utilizador_id = ${utilizadorId}
      ) AS aplaudi,
      (SELECT COUNT(*)::int FROM reconhecimento_comentarios c WHERE c.reconhecimento_id = r.id) AS comentarios
    FROM reconhecimentos r
    JOIN utilizadores ua ON ua.id = r.autor_id
    WHERE r.visibilidade = 'publico'
       OR r.autor_id = ${utilizadorId}
       OR r.destinatario_id = ${utilizadorId}
    ORDER BY r.created_at DESC
    LIMIT 100
  `;

  const [contagens] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()) AND visibilidade = 'publico')::int AS "totalMes",
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('month', now()) - interval '1 month'
          AND created_at < date_trunc('month', now())
          AND visibilidade = 'publico'
      )::int AS "mesAnterior",
      COUNT(*) FILTER (WHERE destinatario_id = ${utilizadorId})::int AS recebidos,
      COUNT(*) FILTER (WHERE autor_id = ${utilizadorId})::int AS dados
    FROM reconhecimentos
  `;

  const porValorRows = await sql<{ valor: Valor; n: number }[]>`
    SELECT valor, COUNT(*)::int AS n
      FROM reconhecimentos
     WHERE visibilidade = 'publico'
       AND created_at >= date_trunc('month', now())
     GROUP BY valor
  `;
  const porValor = VALORES.map((valor) => ({
    valor,
    n: porValorRows.find((row) => row.valor === valor)?.n ?? 0,
  }));

  const equipas = await sql`
    SELECT COALESCE(NULLIF(btrim(p.unidade), ''), p.direccao) AS nome,
           COUNT(a.utilizador_id)::int AS aplausos
      FROM reconhecimentos r
      JOIN (${pessoasOrg()}) p ON p.id = r.destinatario_id
      LEFT JOIN reconhecimento_aplausos a ON a.reconhecimento_id = r.id
     WHERE r.visibilidade = 'publico'
       AND r.created_at >= date_trunc('month', now())
       AND COALESCE(NULLIF(btrim(p.unidade), ''), p.direccao) IS NOT NULL
     GROUP BY 1
     ORDER BY aplausos DESC, COUNT(DISTINCT r.id) DESC
     LIMIT 1
  `;

  const destaques = await sql`
    SELECT r.destinatario_id AS id,
           u.nome,
           COALESCE(c.funcao, m.funcao) AS funcao,
           COALESCE(c.direccao, u.departamento, '') AS direccao,
           COUNT(a.utilizador_id)::int AS aplausos,
           (ARRAY_AGG(r.mensagem ORDER BY r.created_at DESC))[1] AS texto
      FROM reconhecimentos r
      JOIN utilizadores u ON u.id = r.destinatario_id
      LEFT JOIN reconhecimento_aplausos a ON a.reconhecimento_id = r.id
      LEFT JOIN LATERAL (
        SELECT funcao, direccao FROM colaboradores WHERE utilizador_id = u.id ORDER BY created_at DESC LIMIT 1
      ) c ON true
      LEFT JOIN mentors m ON m.utilizador_id = u.id
     WHERE r.posto = false
       AND r.visibilidade = 'publico'
       AND r.destinatario_id IS NOT NULL
       AND r.created_at >= date_trunc('month', now())
     GROUP BY r.destinatario_id, u.nome, c.funcao, m.funcao, c.direccao, u.departamento
     ORDER BY aplausos DESC, COUNT(r.id) DESC
     LIMIT 1
  `;

  const destaque = destaques[0] ?? null;
  let votei = false;
  let votos = 0;
  if (destaque) {
    const [voto] = await sql`
      SELECT
        EXISTS (
          SELECT 1 FROM reconhecimento_votos
           WHERE eleitor_id = ${utilizadorId}
             AND nomeado_id = ${destaque.id}
             AND mes = date_trunc('month', now())::date
        ) AS votei,
        (SELECT COUNT(*)::int FROM reconhecimento_votos
          WHERE nomeado_id = ${destaque.id}
            AND mes = date_trunc('month', now())::date) AS votos
    `;
    votei = Boolean(voto?.votei);
    votos = Number(voto?.votos ?? 0);
  }

  const badges = await sql<{ valor: Valor; vezes: number }[]>`
    SELECT valor, COUNT(*)::int AS vezes
      FROM reconhecimentos
     WHERE destinatario_id = ${utilizadorId}
     GROUP BY valor
  `;

  const sugestoes = await sql`
    SELECT u.id, u.nome,
           COALESCE(c.funcao, m.funcao, u.departamento, '') AS detalhe
      FROM (
        SELECT DISTINCT ON (destinatario_id) destinatario_id, created_at
          FROM reconhecimentos
         WHERE destinatario_id IS NOT NULL
           AND destinatario_id <> ${utilizadorId}
         ORDER BY destinatario_id, created_at DESC
      ) recente
      JOIN utilizadores u ON u.id = recente.destinatario_id AND u.estado = 'activo'
      LEFT JOIN LATERAL (
        SELECT funcao FROM colaboradores WHERE utilizador_id = u.id ORDER BY created_at DESC LIMIT 1
      ) c ON true
      LEFT JOIN mentors m ON m.utilizador_id = u.id
     ORDER BY recente.created_at DESC
     LIMIT 3
  `;

  return {
    itens,
    totalMes: Number(contagens?.totalMes ?? 0),
    mesAnterior: Number(contagens?.mesAnterior ?? 0),
    recebidos: Number(contagens?.recebidos ?? 0),
    dados: Number(contagens?.dados ?? 0),
    porValor,
    equipa: equipas[0] ? { nome: equipas[0].nome as string, aplausos: Number(equipas[0].aplausos) } : null,
    destaque: destaque
      ? {
          id: destaque.id as string,
          nome: destaque.nome as string,
          funcao: (destaque.funcao as string | null) ?? null,
          direccao: (destaque.direccao as string) || '',
          aplausos: Number(destaque.aplausos),
          texto: destaque.texto as string,
          votei,
          votos,
        }
      : null,
    badges,
    sugestoes,
  };
}

async function publicar(req: Request, user: AuthUser) {
  const body = await req.json().catch(() => ({}));
  const mensagem = typeof body?.mensagem === 'string' ? body.mensagem.trim() : '';
  if (mensagem.length < 12) return errorResponse('Conta o que aconteceu. Uma frase concreta chega.', 400);
  if (mensagem.length > 2000) return errorResponse('A mensagem é demasiado longa.', 400);
  if (!valorValido(body?.valor)) return errorResponse('Escolhe um valor.', 400);
  const visibilidade = body?.visibilidade === 'privado' ? 'privado' : body?.visibilidade === 'publico' ? 'publico' : null;
  if (!visibilidade) return errorResponse('Escolhe se o reconhecimento é público ou privado.', 400);

  let destinatarioId: string | null = null;
  let destinatarioNome = typeof body?.destinatarioNome === 'string' ? body.destinatarioNome.trim() : '';
  if (typeof body?.destinatarioId === 'string' && body.destinatarioId) {
    if (!UUID_RE.test(body.destinatarioId)) return errorResponse('Pessoa não encontrada.', 400);
    const pessoas = await sql`
      SELECT id, nome FROM utilizadores WHERE id = ${body.destinatarioId} AND estado = 'activo' LIMIT 1
    `;
    if (!pessoas.length) return errorResponse('Pessoa não encontrada.', 400);
    if (pessoas[0].id === user.id) return errorResponse('Escolhe outra pessoa.', 400);
    destinatarioId = pessoas[0].id as string;
    destinatarioNome = pessoas[0].nome as string;
  }
  if (destinatarioNome.length < 2) return errorResponse('Escolhe a pessoa ou a equipa a reconhecer.', 400);

  const posto = !destinatarioId && /posto/i.test(destinatarioNome);
  const directores = body?.informarChefe === true && visibilidade === 'publico' && destinatarioId
    ? (await directoresDe(destinatarioId)).filter((d) => d.id !== user.id)
    : [];
  const rows = await sql`
    INSERT INTO reconhecimentos (
      autor_id, destinatario_id, destinatario_nome, valor, mensagem, visibilidade, informar_chefe, direccao, posto
    ) VALUES (
      ${user.id}, ${destinatarioId}, ${destinatarioNome}, ${body.valor}, ${mensagem}, ${visibilidade},
      ${directores.length > 0}, ${user.departamento ?? null}, ${posto}
    )
    RETURNING id
  `;
  const id = rows[0].id as string;
  const directoresInformados = directores.length
    ? await informarDirectores(id, directores, `${user.nome} reconheceu ${destinatarioNome} (${NOME_VALOR[body.valor as Valor]}): ${resumo(mensagem, 100)}`)
    : 0;
  return jsonResponse({ data: { id, directoresInformados } }, 201);
}

async function informarDirectores(reconhecimentoId: string, directores: { id: string; perfil: string }[], texto: string) {
  try {
    const linhas = directores.map((d) => ({
      destinatario_id: d.id,
      destinatario_role: d.perfil,
      tipo: 'reconhecimento_director',
      titulo: 'Reconhecimento na sua direcção',
      mensagem: texto,
      link_accao: '/reconhecimento',
    }));
    await sql`
      INSERT INTO onboarding_notificacoes
        ${sql(linhas, 'destinatario_id', 'destinatario_role', 'tipo', 'titulo', 'mensagem', 'link_accao')}
    `;
    return directores.length;
  } catch (err) {
    console.error('[reconhecimentos] informar directores', err);
    await sql`UPDATE reconhecimentos SET informar_chefe = false WHERE id = ${reconhecimentoId}`.catch(() => {});
    return 0;
  }
}

async function alternarAplauso(reconhecimentoId: string, utilizadorId: string) {
  const meu = await sql`
    SELECT 1 FROM reconhecimento_aplausos
     WHERE reconhecimento_id = ${reconhecimentoId} AND utilizador_id = ${utilizadorId}
  `;
  if (meu.length) {
    await sql`
      DELETE FROM reconhecimento_aplausos
       WHERE reconhecimento_id = ${reconhecimentoId} AND utilizador_id = ${utilizadorId}
    `;
  } else {
    await sql`
      INSERT INTO reconhecimento_aplausos (reconhecimento_id, utilizador_id)
      VALUES (${reconhecimentoId}, ${utilizadorId})
    `;
  }
  const [contagem] = await sql`
    SELECT COUNT(*)::int AS aplausos FROM reconhecimento_aplausos WHERE reconhecimento_id = ${reconhecimentoId}
  `;
  return { aplausos: Number(contagem?.aplausos ?? 0), aplaudi: meu.length === 0 };
}

async function comentar(req: Request, reconhecimentoId: string, utilizadorId: string) {
  const body = await req.json().catch(() => ({}));
  const conteudo = typeof body?.conteudo === 'string' ? body.conteudo.trim() : '';
  if (!conteudo) return errorResponse('Escreve uma linha de agradecimento.', 400);
  if (conteudo.length > 500) return errorResponse('O comentário não pode ter mais de 500 caracteres.', 400);
  const existe = await sql`SELECT id FROM reconhecimentos WHERE id = ${reconhecimentoId}`;
  if (!existe.length) return errorResponse('Reconhecimento não encontrado', 404);
  await sql`
    INSERT INTO reconhecimento_comentarios (reconhecimento_id, autor_id, conteudo)
    VALUES (${reconhecimentoId}, ${utilizadorId}, ${conteudo})
  `;
  const [contagem] = await sql`
    SELECT COUNT(*)::int AS comentarios FROM reconhecimento_comentarios WHERE reconhecimento_id = ${reconhecimentoId}
  `;
  return jsonResponse({ data: { comentarios: Number(contagem?.comentarios ?? 0) } }, 201);
}

async function votar(req: Request, eleitorId: string) {
  const body = await req.json().catch(() => ({}));
  const nomeadoId = typeof body?.nomeadoId === 'string' ? body.nomeadoId : '';
  if (!UUID_RE.test(nomeadoId)) return errorResponse('Escolhe quem queres nomear.', 400);
  if (nomeadoId === eleitorId) return errorResponse('O voto é para outro colaborador.', 400);
  const pessoa = await sql`SELECT id FROM utilizadores WHERE id = ${nomeadoId} AND estado = 'activo'`;
  if (!pessoa.length) return errorResponse('Pessoa não encontrada.', 400);

  const actual = await sql`
    SELECT nomeado_id FROM reconhecimento_votos
     WHERE eleitor_id = ${eleitorId} AND mes = date_trunc('month', now())::date
  `;
  if (actual[0]?.nomeado_id === nomeadoId) {
    await sql`
      DELETE FROM reconhecimento_votos
       WHERE eleitor_id = ${eleitorId} AND mes = date_trunc('month', now())::date
    `;
  } else {
    await sql`
      INSERT INTO reconhecimento_votos (eleitor_id, nomeado_id, mes)
      VALUES (${eleitorId}, ${nomeadoId}, date_trunc('month', now())::date)
      ON CONFLICT (eleitor_id, mes) DO UPDATE SET nomeado_id = EXCLUDED.nomeado_id, created_at = now()
    `;
  }
  return jsonResponse({ data: { ok: true } });
}

export const config: Config = {
  path: [
    '/api/reconhecimentos',
    '/api/reconhecimentos/voto',
    '/api/reconhecimentos/:id/aplauso',
    '/api/reconhecimentos/:id/comentarios',
  ],
};
