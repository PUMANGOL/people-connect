import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { normalizarDocumentosPedidos } from './_shared/anexos';

/**
 * Trilhos de onboarding — templates (EPIC 5.2). Admin.
 *
 * GET    /api/trilhos               — lista templates (is_template=true) com etapas
 * GET    /api/trilhos/:id           — um trilho com etapas
 * POST   /api/trilhos               — cria template { nome, funcao, categoria, descricao, duracao_estimada, etapas[] }
 * PATCH  /api/trilhos/:id           — actualiza campos e substitui etapas
 * POST   /api/trilhos/:id/duplicar  — duplica um template
 * DELETE /api/trilhos/:id           — remove template (as instâncias atribuídas não são afectadas)
 */

interface EtapaInput {
  nome: string;
  tipo?: string;
  duracao_dias?: number;
  descricao?: string | null;
  conteudo_ref?: string | null;
  criterio_conclusao?: string | null;
  obrigatoria?: boolean;
  bloqueante?: boolean;
  ordem?: number;
  responsavel_default?: string | null;
  documentos_pedidos?: unknown;
}

/** A coluna é integer. `parseInt` aceita "1.0" e devolve 1. */
function asInt(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asIntOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function textoOuNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const texto = value.trim();
  return texto || null;
}

async function etapasDoTrilho(trilhoId: string) {
  return sql`
    SELECT id, trilho_id, ordem, nome, tipo, duracao_dias, descricao, conteudo_ref,
           criterio_conclusao, obrigatoria, bloqueante, responsavel_default, documentos_pedidos
    FROM etapas_trilho WHERE trilho_id = ${trilhoId} ORDER BY ordem
  `;
}

async function inserirEtapas(trilhoId: string, etapas: EtapaInput[]) {
  for (let i = 0; i < etapas.length; i++) {
    const e = etapas[i];
    await sql`
      INSERT INTO etapas_trilho
        (trilho_id, ordem, nome, tipo, duracao_dias, descricao, conteudo_ref, criterio_conclusao, obrigatoria, bloqueante, responsavel_default, documentos_pedidos)
      VALUES (
        ${trilhoId}, ${asInt(e.ordem, i + 1)}, ${e.nome}, ${(e.tipo ?? 'documental')}::tipo_etapa,
        ${asInt(e.duracao_dias, 1)}, ${e.descricao ?? null}, ${e.conteudo_ref ?? null},
        ${e.criterio_conclusao ?? null}, ${e.obrigatoria ?? true}, ${e.bloqueante ?? false},
        ${textoOuNull(e.responsavel_default)}, ${sql.json(normalizarDocumentosPedidos(e.documentos_pedidos))}
      )
    `;
  }
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const isDuplicar = parts[parts.length - 1] === 'duplicar';
  const id = isDuplicar
    ? parts[parts.length - 2]
    : parts[parts.length - 1] !== 'trilhos'
      ? parts[parts.length - 1]
      : null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET') {
      if (id) {
        const t = await sql`SELECT * FROM trilhos_onboarding WHERE id = ${id}`;
        if (!t.length) return errorResponse('Trilho não encontrado', 404);
        return jsonResponse({ data: { ...t[0], etapas: await etapasDoTrilho(id) } });
      }
      const trilhos = await sql`
        SELECT t.*, (SELECT COUNT(*) FROM etapas_trilho e WHERE e.trilho_id = t.id) AS num_etapas
        FROM trilhos_onboarding t
        WHERE COALESCE(t.is_template, true) = true
        ORDER BY t.created_at DESC
      `;
      // Anexa etapas a cada trilho
      const withEtapas = await Promise.all(
        trilhos.map(async (t) => ({ ...t, etapas: await etapasDoTrilho(t.id as string) }))
      );
      return jsonResponse({ data: withEtapas });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    if (req.method === 'POST' && isDuplicar && id) {
      const orig = await sql`SELECT * FROM trilhos_onboarding WHERE id = ${id}`;
      if (!orig.length) return errorResponse('Trilho não encontrado', 404);
      const o = orig[0];
      const nova = await sql`
        INSERT INTO trilhos_onboarding (funcao, nome, duracao_estimada, versao, activo, categoria, descricao, is_template)
        VALUES (${o.funcao}, ${`${o.nome} (cópia)`}, ${o.duracao_estimada}, ${o.versao}, ${o.activo}, ${o.categoria}, ${o.descricao}, true)
        RETURNING *
      `;
      const etapas = (await etapasDoTrilho(id)) as unknown as EtapaInput[];
      await inserirEtapas(nova[0].id as string, etapas);
      return jsonResponse({ data: { ...nova[0], etapas: await etapasDoTrilho(nova[0].id as string) } }, 201);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const nova = await sql`
        INSERT INTO trilhos_onboarding (funcao, nome, duracao_estimada, versao, activo, categoria, descricao, is_template)
        VALUES (
          ${body.funcao ?? ''}, ${body.nome}, ${asIntOrNull(body.duracao_estimada)}, ${asInt(body.versao, 1)},
          ${body.activo ?? true}, ${body.categoria ?? 'tecnicos'}, ${body.descricao ?? null}, true
        )
        RETURNING *
      `;
      const trilhoId = nova[0].id as string;
      if (Array.isArray(body.etapas)) await inserirEtapas(trilhoId, body.etapas);
      return jsonResponse({ data: { ...nova[0], etapas: await etapasDoTrilho(trilhoId) } }, 201);
    }

    if (req.method === 'PATCH' && id) {
      const body = await req.json();
      const rows = await sql`
        UPDATE trilhos_onboarding SET
          nome = COALESCE(${body.nome ?? null}, nome),
          funcao = COALESCE(${body.funcao ?? null}, funcao),
          duracao_estimada = COALESCE(${body.duracao_estimada ?? null}, duracao_estimada),
          categoria = COALESCE(${body.categoria ?? null}, categoria),
          descricao = COALESCE(${body.descricao ?? null}, descricao),
          activo = COALESCE(${body.activo ?? null}, activo)
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Trilho não encontrado', 404);
      if (Array.isArray(body.etapas)) {
        await sql`DELETE FROM etapas_trilho WHERE trilho_id = ${id}`;
        await inserirEtapas(id, body.etapas);
      }
      return jsonResponse({ data: { ...rows[0], etapas: await etapasDoTrilho(id) } });
    }

    if (req.method === 'DELETE' && id) {
      await sql`DELETE FROM etapas_trilho WHERE trilho_id = ${id}`;
      await sql`DELETE FROM trilhos_onboarding WHERE id = ${id}`;
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[trilhos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/trilhos', '/api/trilhos/:id', '/api/trilhos/:id/duplicar'],
};
