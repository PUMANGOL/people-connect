import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { invalidarColaboradores, invalidarMentores } from './_shared/cache-leitura';

/**
 * Catálogos do onboarding (admin gere; os restantes leem para os dropdowns).
 *
 * GET    /api/catalogos
 * POST   /api/catalogos/:tipo            { nome }
 * PATCH  /api/catalogos/:tipo/:id        { nome?, activo? }
 * DELETE /api/catalogos/:tipo/:id        desactiva
 *
 * tipo = funcoes | direccoes | categorias
 *
 * Tabelas, colunas e dados iniciais: migração 0005_catalogos.sql
 * (não se prepara a BD dentro do pedido).
 */

const TIPOS = ['funcoes', 'direccoes', 'categorias'] as const;
type Tipo = (typeof TIPOS)[number];

function slugDe(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || 'categoria';
}

function siglaDe(nome: string): string {
  const partes = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p.length > 2 && !['de', 'da', 'do', 'das', 'dos', 'para'].includes(p.toLowerCase()));
  const sigla = (partes.map((p) => p[0]).join('') || 'DIR').toUpperCase().slice(0, 8);
  return sigla;
}

function tipoDe(value: string | undefined): Tipo | null {
  return TIPOS.includes(value as Tipo) ? (value as Tipo) : null;
}

async function listar() {
  const [funcoes, direccoes, categorias] = await Promise.all([
    sql`SELECT id, nome, activo, ordem FROM funcoes ORDER BY ordem, nome`,
    sql`SELECT id, nome, sigla, activo, ordem FROM direccoes ORDER BY ordem, nome`,
    sql`SELECT id, slug, nome, activo, ordem FROM categorias_onboarding ORDER BY ordem, nome`,
  ]);
  return { funcoes, direccoes, categorias };
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // /api/catalogos | /api/catalogos/:tipo | /api/catalogos/:tipo/:id
  const tipo = tipoDe(parts[2]);
  const id = parts[3];

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET' && !tipo) {
      return jsonResponse({ data: await listar() });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
    if (!tipo) return errorResponse('Catálogo desconhecido', 404);

    if (req.method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}));
      const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
      if (!nome) return errorResponse('O nome é obrigatório', 400);
      const criado = await criar(tipo, nome);
      if (!criado) return errorResponse('Já existe um registo com esse nome', 409);
      return jsonResponse({ data: criado }, 201);
    }

    if (!id) return errorResponse('Método não suportado', 405);

    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      const actualizado = await actualizar(tipo, id, body);
      if (!actualizado) return errorResponse('Registo não encontrado', 404);
      if (actualizado === 'duplicado') return errorResponse('Já existe um registo com esse nome', 409);
      return jsonResponse({ data: actualizado });
    }

    if (req.method === 'DELETE') {
      const ok = await desactivar(tipo, id);
      if (!ok) return errorResponse('Registo não encontrado', 404);
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[catalogos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

async function criar(tipo: Tipo, nome: string) {
  if (tipo === 'funcoes') {
    const dup = await sql`SELECT id FROM funcoes WHERE lower(nome) = lower(${nome}) LIMIT 1`;
    if (dup.length) return null;
    const rows = await sql`
      INSERT INTO funcoes (nome) VALUES (${nome}) RETURNING id, nome, activo, ordem
    `;
    return rows[0];
  }
  if (tipo === 'direccoes') {
    const dup = await sql`SELECT id FROM direccoes WHERE lower(nome) = lower(${nome}) LIMIT 1`;
    if (dup.length) return null;
    let sigla = siglaDe(nome);
    const usadas = await sql`SELECT sigla FROM direccoes`;
    const set = new Set(usadas.map((r) => String(r.sigla).toUpperCase()));
    let n = 2;
    while (set.has(sigla)) {
      sigla = `${siglaDe(nome).slice(0, 6)}${n}`;
      n += 1;
    }
    const rows = await sql`
      INSERT INTO direccoes (nome, sigla) VALUES (${nome}, ${sigla})
      RETURNING id, nome, sigla, activo, ordem
    `;
    return rows[0];
  }
  const dup = await sql`SELECT id FROM categorias_onboarding WHERE lower(nome) = lower(${nome}) LIMIT 1`;
  if (dup.length) return null;
  let slug = slugDe(nome);
  const slugs = await sql`SELECT slug FROM categorias_onboarding`;
  const set = new Set(slugs.map((r) => String(r.slug)));
  let n = 2;
  while (set.has(slug)) {
    slug = `${slugDe(nome)}_${n}`;
    n += 1;
  }
  const rows = await sql`
    INSERT INTO categorias_onboarding (slug, nome) VALUES (${slug}, ${nome})
    RETURNING id, slug, nome, activo, ordem
  `;
  return rows[0];
}

async function actualizar(tipo: Tipo, id: string, body: { nome?: unknown; activo?: unknown }) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : null;
  const activo = typeof body.activo === 'boolean' ? body.activo : null;

  if (tipo === 'funcoes') {
    const atual = await sql`SELECT id, nome FROM funcoes WHERE id = ${id} LIMIT 1`;
    if (!atual.length) return null;
    if (nome && nome.toLowerCase() !== String(atual[0].nome).toLowerCase()) {
      const dup = await sql`SELECT id FROM funcoes WHERE lower(nome) = lower(${nome}) AND id <> ${id} LIMIT 1`;
      if (dup.length) return 'duplicado' as const;
    }
    const anterior = String(atual[0].nome);
    const rows = await sql`
      UPDATE funcoes SET
        nome = COALESCE(${nome}, nome),
        activo = COALESCE(${activo}, activo)
      WHERE id = ${id}
      RETURNING id, nome, activo, ordem
    `;
    if (nome && nome !== anterior) {
      await sql`UPDATE colaboradores SET funcao = ${nome} WHERE funcao = ${anterior}`;
      await sql`UPDATE trilhos_onboarding SET funcao = ${nome} WHERE funcao = ${anterior}`;
      await sql`UPDATE mentors SET funcao = ${nome} WHERE funcao = ${anterior}`;
      invalidarColaboradores();
      invalidarMentores();
    }
    return rows[0];
  }

  if (tipo === 'direccoes') {
    const atual = await sql`SELECT id, nome FROM direccoes WHERE id = ${id} LIMIT 1`;
    if (!atual.length) return null;
    if (nome && nome.toLowerCase() !== String(atual[0].nome).toLowerCase()) {
      const dup = await sql`SELECT id FROM direccoes WHERE lower(nome) = lower(${nome}) AND id <> ${id} LIMIT 1`;
      if (dup.length) return 'duplicado' as const;
    }
    const anterior = String(atual[0].nome);
    const rows = await sql`
      UPDATE direccoes SET
        nome = COALESCE(${nome}, nome),
        activo = COALESCE(${activo}, activo),
        updated_at = now()
      WHERE id = ${id}
      RETURNING id, nome, sigla, activo, ordem
    `;
    if (nome && nome !== anterior) {
      await sql`UPDATE colaboradores SET direccao = ${nome} WHERE direccao = ${anterior}`;
      invalidarColaboradores();
      await sql`UPDATE mentors SET departamento = ${nome} WHERE departamento = ${anterior}`;
      invalidarMentores();
      await sql`UPDATE utilizadores SET departamento = ${nome} WHERE departamento = ${anterior}`;
      await sql`UPDATE vagas SET direccao = ${nome} WHERE direccao = ${anterior}`;
      await sql`UPDATE faqs SET direccao = ${nome} WHERE direccao = ${anterior}`;
      await sql`UPDATE kb_documentos SET direccao = ${nome} WHERE direccao = ${anterior}`;
    }
    return rows[0];
  }

  const atual = await sql`SELECT id, nome FROM categorias_onboarding WHERE id = ${id} LIMIT 1`;
  if (!atual.length) return null;
  if (nome && nome.toLowerCase() !== String(atual[0].nome).toLowerCase()) {
    const dup = await sql`SELECT id FROM categorias_onboarding WHERE lower(nome) = lower(${nome}) AND id <> ${id} LIMIT 1`;
    if (dup.length) return 'duplicado' as const;
  }
  const rows = await sql`
    UPDATE categorias_onboarding SET
      nome = COALESCE(${nome}, nome),
      activo = COALESCE(${activo}, activo)
    WHERE id = ${id}
    RETURNING id, slug, nome, activo, ordem
  `;
  return rows[0];
}

async function desactivar(tipo: Tipo, id: string): Promise<boolean> {
  if (tipo === 'funcoes') {
    const rows = await sql`UPDATE funcoes SET activo = false WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  if (tipo === 'direccoes') {
    const rows = await sql`UPDATE direccoes SET activo = false, updated_at = now() WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  const rows = await sql`UPDATE categorias_onboarding SET activo = false WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export const config: Config = {
  path: ['/api/catalogos', '/api/catalogos/:tipo', '/api/catalogos/:tipo/:id'],
};
