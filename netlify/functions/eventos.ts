import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { apagarObjecto, confirmarEnvio, StorageError, urlFicheiro } from './_shared/storage';

/**
 * Eventos e Agenda.
 * GET    /api/eventos?de=ISO&ate=ISO        — eventos que se sobrepõem ao intervalo (calendário)
 * GET    /api/eventos/destaque              — evento em destaque (fixado ou o próximo)
 * GET    /api/eventos/meus                  — próximos eventos com presença confirmada
 * POST   /api/eventos                       — criar (admin)
 * PATCH  /api/eventos/:id                   — editar (admin)
 * DELETE /api/eventos/:id                   — remover (admin)
 * POST   /api/eventos/:id/presenca          — confirmar presença
 * DELETE /api/eventos/:id/presenca          — cancelar presença
 */

const CATEGORIAS = ['oficial', 'formacao', 'comunidade', 'obrigatorio', 'bem_estar'];
const ZONAS = ['sede', 'talatona', 'academia', 'postos', 'online'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

/** Confirma uma imagem enviada por este utilizador. Links externos passam. */
async function resolverImagem(imagem: string | null, userId: string): Promise<string | null> {
  if (!imagem) return null;
  const id = idImagemAplicacao(imagem);
  if (!id) return imagem;
  await confirmarEnvio('publicacao', id, `comunidade/${userId}`, userId);
  return urlFicheiro(id);
}

/** Eventos com total de confirmados e se o utilizador confirmou. */
function selectEventos(utilizadorId: string) {
  return sql`
    SELECT
      e.id, e.titulo, e.descricao, e.categoria, e.local, e.zona, e.link_online, e.imagem,
      e.inicio, e.fim, e.dia_inteiro, e.destaque, e.created_at, e.updated_at,
      COALESCE(p.total, 0)::int AS confirmados,
      COALESCE(p.eu, false) AS eu_confirmei
    FROM eventos e
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total, BOOL_OR(utilizador_id = ${utilizadorId}) AS eu
      FROM evento_presencas WHERE evento_id = e.id
    ) p ON true
  `;
}

function dataValida(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function textoOuNull(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t ? t.slice(0, max) : null;
}

type Payload = {
  titulo: string;
  descricao: string | null;
  categoria: string;
  local: string | null;
  zona: string | null;
  link_online: string | null;
  imagem: string | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  destaque: boolean;
};

/** Valida o corpo de criação/edição; devolve a mensagem de erro ou o payload. */
function validar(body: Record<string, unknown>): string | Payload {
  const titulo = textoOuNull(body.titulo, 200);
  if (!titulo) return 'O título é obrigatório';
  const inicio = dataValida(body.inicio);
  if (!inicio) return 'Indique a data e hora de início';
  const fim = body.fim ? dataValida(body.fim) : null;
  if (body.fim && !fim) return 'Data de fim inválida';
  if (fim && fim < inicio) return 'O fim tem de ser depois do início';
  const categoria = typeof body.categoria === 'string' && CATEGORIAS.includes(body.categoria) ? body.categoria : 'oficial';
  const zona = typeof body.zona === 'string' && ZONAS.includes(body.zona) ? body.zona : null;
  const link = textoOuNull(body.link_online, 2000);
  if (link && !/^https?:\/\/\S+$/i.test(link)) return 'O link da reunião tem de começar por http:// ou https://';
  const imagem = imagemValida(body.imagem);
  if (imagem === false) return 'Link da imagem inválido (use um endereço http:// ou https://, ou carrega uma imagem)';
  return {
    titulo,
    descricao: textoOuNull(body.descricao, 5000),
    categoria,
    local: textoOuNull(body.local, 200),
    zona,
    link_online: link,
    imagem,
    inicio,
    fim,
    dia_inteiro: body.dia_inteiro === true,
    destaque: body.destaque === true,
  };
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // ['api', 'eventos', id | 'destaque' | 'meus', 'presenca'?]
  const alvo = parts[2] ?? null;
  const sub = parts[3] ?? null;

  try {
    const user = await requireAuth(req);
    const isAdmin = user.role === 'rh_admin';

    // ===== Calendário =====
    if (req.method === 'GET' && !alvo) {
      const de = dataValida(url.searchParams.get('de'));
      const ate = dataValida(url.searchParams.get('ate'));
      if (!de || !ate) return errorResponse('Indique o intervalo (de, ate)', 400);
      const rows = await sql`
        ${selectEventos(user.id)}
        WHERE e.inicio < ${ate} AND COALESCE(e.fim, e.inicio) >= ${de}
        ORDER BY e.inicio
        LIMIT 500
      `;
      return jsonResponse({ data: rows });
    }

    // ===== Destaque: o fixado mais próximo; senão, o que está a decorrer ou o próximo =====
    if (req.method === 'GET' && alvo === 'destaque') {
      const rows = await sql`
        ${selectEventos(user.id)}
        WHERE COALESCE(e.fim, e.inicio + INTERVAL '1 hour') >= NOW()
        ORDER BY e.destaque DESC, e.inicio
        LIMIT 1
      `;
      return jsonResponse({ data: rows[0] ?? null });
    }

    // ===== Os meus eventos =====
    if (req.method === 'GET' && alvo === 'meus') {
      const rows = await sql`
        ${selectEventos(user.id)}
        WHERE EXISTS (SELECT 1 FROM evento_presencas ep WHERE ep.evento_id = e.id AND ep.utilizador_id = ${user.id})
          AND COALESCE(e.fim, e.inicio + INTERVAL '1 hour') >= NOW()
        ORDER BY e.inicio
        LIMIT 10
      `;
      return jsonResponse({ data: rows });
    }

    if (alvo && !UUID_RE.test(alvo)) return errorResponse('Evento não encontrado', 404);

    // ===== Presença =====
    if (alvo && sub === 'presenca' && (req.method === 'POST' || req.method === 'DELETE')) {
      const existe = await sql`SELECT 1 FROM eventos WHERE id = ${alvo}`;
      if (!existe.length) return errorResponse('Evento não encontrado', 404);
      if (req.method === 'POST') {
        await sql`
          INSERT INTO evento_presencas (evento_id, utilizador_id) VALUES (${alvo}, ${user.id})
          ON CONFLICT (evento_id, utilizador_id) DO NOTHING
        `;
      } else {
        await sql`DELETE FROM evento_presencas WHERE evento_id = ${alvo} AND utilizador_id = ${user.id}`;
      }
      const rows = await sql`${selectEventos(user.id)} WHERE e.id = ${alvo}`;
      return jsonResponse({ data: rows[0] });
    }

    if (!isAdmin) return errorResponse('Sem permissão', 403);

    // ===== Criar =====
    if (req.method === 'POST' && !alvo) {
      const r = validar(await req.json().catch(() => ({})));
      if (typeof r === 'string') return errorResponse(r, 400);
      const imagem = await resolverImagem(r.imagem, user.id);
      const rows = await sql`
        INSERT INTO eventos (titulo, descricao, categoria, local, zona, link_online, imagem, inicio, fim, dia_inteiro, destaque, criado_por)
        VALUES (${r.titulo}, ${r.descricao}, ${r.categoria}, ${r.local}, ${r.zona}, ${r.link_online}, ${imagem},
                ${r.inicio}, ${r.fim}, ${r.dia_inteiro}, ${r.destaque}, ${user.id})
        RETURNING id
      `;
      return jsonResponse({ data: { id: rows[0].id } }, 201);
    }

    // ===== Editar =====
    if (req.method === 'PATCH' && alvo && !sub) {
      const r = validar(await req.json().catch(() => ({})));
      if (typeof r === 'string') return errorResponse(r, 400);
      const anterior = await sql<{ imagem: string | null }[]>`SELECT imagem FROM eventos WHERE id = ${alvo}`;
      if (!anterior.length) return errorResponse('Evento não encontrado', 404);
      const idAnterior = idImagemAplicacao(anterior[0].imagem);
      const idPedido = idImagemAplicacao(r.imagem);
      // A imagem já gravada não volta a ser confirmada: outro admin pode editá-la sem ser o autor do envio.
      const imagem = idPedido && idPedido !== idAnterior ? await resolverImagem(r.imagem, user.id) : r.imagem;
      const rows = await sql`
        UPDATE eventos SET
          titulo = ${r.titulo}, descricao = ${r.descricao}, categoria = ${r.categoria},
          local = ${r.local}, zona = ${r.zona}, link_online = ${r.link_online}, imagem = ${imagem},
          inicio = ${r.inicio}, fim = ${r.fim}, dia_inteiro = ${r.dia_inteiro},
          destaque = ${r.destaque}, updated_at = NOW()
        WHERE id = ${alvo}
        RETURNING id
      `;
      if (!rows.length) return errorResponse('Evento não encontrado', 404);
      const idNovo = idImagemAplicacao(imagem);
      if (idAnterior && idAnterior !== idNovo) await apagarObjecto(idAnterior);
      return jsonResponse({ data: { ok: true } });
    }

    // ===== Remover =====
    if (req.method === 'DELETE' && alvo && !sub) {
      const rows = await sql<{ id: string; imagem: string | null }[]>`DELETE FROM eventos WHERE id = ${alvo} RETURNING id, imagem`;
      if (!rows.length) return errorResponse('Evento não encontrado', 404);
      await apagarObjecto(idImagemAplicacao(rows[0].imagem));
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[eventos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/eventos',
    '/api/eventos/destaque',
    '/api/eventos/meus',
    '/api/eventos/:id',
    '/api/eventos/:id/presenca',
  ],
};
