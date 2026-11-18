import type { Config } from './_shared/route-config';
import sanitizeHtml from 'sanitize-html';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { apagarObjecto, confirmarEnvio, StorageError, urlFicheiro } from './_shared/storage';

/**
 * Comunidade — página inicial da plataforma.
 * GET    /api/comunidade/posts                    — feed (todos os perfis)
 * GET    /api/comunidade/posts/:id                — uma publicação (página de leitura)
 * POST   /api/comunidade/posts                    — publicar (admin)
 * PATCH  /api/comunidade/posts/:id                — editar / fixar (admin)
 * DELETE /api/comunidade/posts/:id                — remover (admin)
 * POST   /api/comunidade/posts/:id/reacao         — { tipo: 'like' | null }
 * GET    /api/comunidade/posts/:id/comentarios    — lista de comentários
 * POST   /api/comunidade/posts/:id/comentarios    — { conteudo }
 * DELETE /api/comunidade/comentarios/:id          — autor do comentário ou admin
 */

const MAX_CONTEUDO = 5000; // caracteres de texto (sem tags)
const MAX_CONTEUDO_HTML = 50_000;
const MAX_COMENTARIO = 1000;
// Link externo ou imagem enviada para o serviço (a app guarda só o endereço /api/ficheiros?key=…).
const MAX_IMAGEM_URL = 2000;
const ID_IMAGEM = /^\/api\/ficheiros\?key=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function idImagemAplicacao(imagem: string | null | undefined): string | null {
  if (!imagem) return null;
  return imagem.match(ID_IMAGEM)?.[1] ?? null;
}

function imagemValida(imagem: unknown): string | null | false {
  if (imagem == null) return null;
  if (typeof imagem !== 'string') return false;
  const url = imagem.trim();
  if (!url) return null;
  const id = idImagemAplicacao(url);
  if (id) return urlFicheiro(id);
  if (url.length > MAX_IMAGEM_URL || !/^https?:\/\/\S+$/i.test(url)) return false;
  return url;
}

/** Confirma que uma imagem da app foi mesmo enviada por este utilizador. Links externos passam. */
async function resolverImagem(imagem: string | null, userId: string): Promise<string | null> {
  if (!imagem) return null;
  const id = idImagemAplicacao(imagem);
  if (!id) return imagem;
  await confirmarEnvio('publicacao', id, `comunidade/${userId}`, userId);
  return urlFicheiro(id);
}

// O conteúdo das publicações vem do editor rico (HTML). Só passam as tags do editor.
const HTML_PERMITIDO: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre', 'hr'],
  // target/rel são sempre impostos pelo transformTags abaixo
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
};

/** Sanitiza o HTML da publicação e devolve também o texto simples (para validar e resumir). */
function conteudoSeguro(valor: unknown): { html: string; texto: string } {
  const html = typeof valor === 'string' ? sanitizeHtml(valor, HTML_PERMITIDO).trim() : '';
  const texto = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .trim();
  return { html: texto ? html : '', texto };
}

function validarConteudo(c: { html: string; texto: string }): string | null {
  if (!c.texto) return 'O conteúdo da publicação é obrigatório';
  if (c.texto.length > MAX_CONTEUDO || c.html.length > MAX_CONTEUDO_HTML) {
    return `A publicação não pode ter mais de ${MAX_CONTEUDO} caracteres`;
  }
  return null;
}

function resumo(texto: string, max = 120): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

// Notificações no sino (tabela onboarding_notificacoes, inbox comum a todos os perfis).
// Falhas não bloqueiam a publicação/comentário.
async function notificarNovaPublicacao(postId: string, autorId: string, titulo: string | null, conteudo: string) {
  try {
    await sql`
      INSERT INTO onboarding_notificacoes (destinatario_id, destinatario_role, tipo, titulo, mensagem, link_accao)
      SELECT u.id, u.perfil::text, 'comunidade_publicacao',
             ${'Nova publicação na comunidade'},
             ${'Nova publicação: ' + resumo(titulo || conteudo)},
             ${'/noticias/publicacao/' + postId}
        FROM utilizadores u
       WHERE u.estado = 'activo' AND u.id <> ${autorId}
    `;
  } catch (err) {
    console.error('[comunidade] notificar publicação', err);
  }
}

async function notificarComentario(postId: string, autor: { id: string; nome: string }, conteudo: string) {
  try {
    // Autor da publicação + quem já comentou (excepto quem acabou de comentar)
    await sql`
      INSERT INTO onboarding_notificacoes (destinatario_id, destinatario_role, tipo, titulo, mensagem, link_accao)
      SELECT u.id, u.perfil::text, 'comunidade_comentario',
             ${'Novo comentário na comunidade'},
             ${autor.nome + ' comentou: ' + resumo(conteudo, 100)},
             ${'/noticias/publicacao/' + postId}
        FROM utilizadores u
       WHERE u.estado = 'activo'
         AND u.id <> ${autor.id}
         AND u.id IN (
           SELECT autor_id FROM comunidade_posts WHERE id = ${postId} AND autor_id IS NOT NULL
           UNION
           SELECT autor_id FROM comunidade_comentarios WHERE post_id = ${postId} AND autor_id IS NOT NULL
         )
    `;
  } catch (err) {
    console.error('[comunidade] notificar comentário', err);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Publicações com autor, gostos (e se o utilizador gostou) e total de comentários. */
function selectPosts(utilizadorId: string) {
  return sql`
    SELECT
      p.id, p.titulo, p.conteudo, p.imagem, p.fixado, p.created_at, p.updated_at,
      p.autor_id, u.nome AS autor_nome,
      COALESCE(r.likes, 0)::int AS likes,
      r.minha_reacao,
      COALESCE(c.total, 0)::int AS total_comentarios
    FROM comunidade_posts p
    LEFT JOIN utilizadores u ON u.id = p.autor_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE tipo = 'like') AS likes,
        MAX(tipo) FILTER (WHERE utilizador_id = ${utilizadorId}) AS minha_reacao
      FROM comunidade_reacoes WHERE post_id = p.id
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total FROM comunidade_comentarios WHERE post_id = p.id
    ) c ON true
  `;
}

async function contagens(postId: string, utilizadorId: string) {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE tipo = 'like')::int AS likes,
      MAX(tipo) FILTER (WHERE utilizador_id = ${utilizadorId}) AS minha_reacao
    FROM comunidade_reacoes WHERE post_id = ${postId}
  `;
  return rows[0];
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // ['api', 'comunidade', 'posts' | 'comentarios', id?, sub?]
  const recurso = parts[2];
  const id = parts[3] ?? null;
  const sub = parts[4] ?? null;

  try {
    const user = await requireAuth(req);
    const isAdmin = user.role === 'rh_admin';

    // ===== Comentários (remoção) =====
    if (recurso === 'comentarios' && req.method === 'DELETE' && id) {
      const rows = await sql`SELECT autor_id FROM comunidade_comentarios WHERE id = ${id}`;
      if (!rows.length) return errorResponse('Comentário não encontrado', 404);
      if (!isAdmin && rows[0].autor_id !== user.id) return errorResponse('Sem permissão', 403);
      await sql`DELETE FROM comunidade_comentarios WHERE id = ${id}`;
      return jsonResponse({ data: { ok: true } });
    }

    if (recurso !== 'posts') return errorResponse('Rota não encontrada', 404);

    // ===== Feed =====
    if (req.method === 'GET' && !id) {
      const limite = Math.min(50, Math.max(1, Number(url.searchParams.get('limite')) || 20));
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const rows = await sql`
        ${selectPosts(user.id)}
        ORDER BY p.fixado DESC, p.created_at DESC
        LIMIT ${limite + 1} OFFSET ${offset}
      `;
      return jsonResponse({ data: rows.slice(0, limite), has_more: rows.length > limite });
    }

    // ===== Publicação (página de leitura) =====
    if (req.method === 'GET' && id && !sub) {
      if (!UUID_RE.test(id)) return errorResponse('Publicação não encontrada', 404);
      const rows = await sql`${selectPosts(user.id)} WHERE p.id = ${id}`;
      if (!rows.length) return errorResponse('Publicação não encontrada', 404);
      return jsonResponse({ data: rows[0] });
    }

    // ===== Reacção (like / remover) =====
    if (req.method === 'POST' && id && sub === 'reacao') {
      const body = await req.json().catch(() => ({}));
      const tipo = body?.tipo ?? null;
      if (tipo !== null && tipo !== 'like') {
        return errorResponse('Reacção inválida', 400);
      }
      const post = await sql`SELECT id FROM comunidade_posts WHERE id = ${id}`;
      if (!post.length) return errorResponse('Publicação não encontrada', 404);
      if (tipo === null) {
        await sql`DELETE FROM comunidade_reacoes WHERE post_id = ${id} AND utilizador_id = ${user.id}`;
      } else {
        await sql`
          INSERT INTO comunidade_reacoes (post_id, utilizador_id, tipo)
          VALUES (${id}, ${user.id}, ${tipo})
          ON CONFLICT (post_id, utilizador_id) DO UPDATE SET tipo = EXCLUDED.tipo, created_at = NOW()
        `;
      }
      return jsonResponse({ data: await contagens(id, user.id) });
    }

    // ===== Comentários de uma publicação =====
    if (id && sub === 'comentarios') {
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT c.id, c.conteudo, c.created_at, c.autor_id, u.nome AS autor_nome, u.perfil::text AS autor_perfil
          FROM comunidade_comentarios c
          LEFT JOIN utilizadores u ON u.id = c.autor_id
          WHERE c.post_id = ${id}
          ORDER BY c.created_at ASC
        `;
        return jsonResponse({ data: rows });
      }
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const conteudo = typeof body?.conteudo === 'string' ? body.conteudo.trim() : '';
        if (!conteudo) return errorResponse('Escreva um comentário', 400);
        if (conteudo.length > MAX_COMENTARIO) {
          return errorResponse(`O comentário não pode ter mais de ${MAX_COMENTARIO} caracteres`, 400);
        }
        const post = await sql`SELECT id FROM comunidade_posts WHERE id = ${id}`;
        if (!post.length) return errorResponse('Publicação não encontrada', 404);
        const rows = await sql`
          INSERT INTO comunidade_comentarios (post_id, autor_id, conteudo)
          VALUES (${id}, ${user.id}, ${conteudo})
          RETURNING id, conteudo, created_at, autor_id
        `;
        await notificarComentario(id, user, conteudo);
        return jsonResponse({ data: { ...rows[0], autor_nome: user.nome, autor_perfil: user.role } }, 201);
      }
    }

    // ===== Gestão de publicações (admin) =====
    if (!isAdmin) return errorResponse('Sem permissão', 403);

    if (req.method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}));
      const conteudo = conteudoSeguro(body?.conteudo);
      const titulo = typeof body?.titulo === 'string' && body.titulo.trim() ? body.titulo.trim() : null;
      const imagem = imagemValida(body?.imagem);
      const erroConteudo = validarConteudo(conteudo);
      if (erroConteudo) return errorResponse(erroConteudo, 400);
      if (imagem === false) return errorResponse('Link da imagem inválido (use um endereço http:// ou https://, ou carrega uma imagem)', 400);
      const imagemFinal = await resolverImagem(imagem, user.id);
      const rows = await sql`
        INSERT INTO comunidade_posts (autor_id, titulo, conteudo, imagem, fixado)
        VALUES (${user.id}, ${titulo}, ${conteudo.html}, ${imagemFinal}, ${body?.fixado === true})
        RETURNING id
      `;
      await notificarNovaPublicacao(rows[0].id as string, user.id, titulo, conteudo.texto);
      return jsonResponse({ data: { id: rows[0].id } }, 201);
    }

    if (req.method === 'PATCH' && id && !sub) {
      const body = await req.json().catch(() => ({}));
      const atual = await sql`SELECT * FROM comunidade_posts WHERE id = ${id}`;
      if (!atual.length) return errorResponse('Publicação não encontrada', 404);
      const p = atual[0];

      const conteudo = conteudoSeguro('conteudo' in body ? body.conteudo : p.conteudo);
      const titulo = 'titulo' in body ? (String(body.titulo ?? '').trim() || null) : p.titulo;
      const imagemPedida = 'imagem' in body ? imagemValida(body.imagem) : undefined;
      const fixado = 'fixado' in body ? body.fixado === true : p.fixado;
      const erroConteudo = validarConteudo(conteudo);
      if (erroConteudo) return errorResponse(erroConteudo, 400);
      if (imagemPedida === false) return errorResponse('Link da imagem inválido (use um endereço http:// ou https://, ou carrega uma imagem)', 400);
      const imagem = imagemPedida === undefined ? p.imagem as string | null : await resolverImagem(imagemPedida, user.id);

      await sql`
        UPDATE comunidade_posts SET
          titulo = ${titulo}, conteudo = ${conteudo.html}, imagem = ${imagem}, fixado = ${fixado}, updated_at = NOW()
        WHERE id = ${id}
      `;
      const idAnterior = idImagemAplicacao(p.imagem as string | null);
      const idNovo = idImagemAplicacao(imagem as string | null);
      if (idAnterior && idAnterior !== idNovo) await apagarObjecto(idAnterior);
      return jsonResponse({ data: { ok: true } });
    }

    if (req.method === 'DELETE' && id && !sub) {
      const rows = await sql`DELETE FROM comunidade_posts WHERE id = ${id} RETURNING imagem`;
      if (!rows.length) return errorResponse('Publicação não encontrada', 404);
      await apagarObjecto(idImagemAplicacao(rows[0].imagem as string | null));
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[comunidade]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/comunidade/posts',
    '/api/comunidade/posts/:id',
    '/api/comunidade/posts/:id/reacao',
    '/api/comunidade/posts/:id/comentarios',
    '/api/comunidade/comentarios/:id',
  ],
};
