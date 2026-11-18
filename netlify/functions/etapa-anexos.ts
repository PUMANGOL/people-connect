import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';
import { podeVerColaborador } from './_shared/acesso-colaborador';
import { apagarObjecto, confirmarEnvio, descartarEnvio, StorageError } from './_shared/storage';
import { formatarAnexo, lerDocumentosPedidos } from './_shared/anexos';

/**
 * Documentos anexados pelo colaborador às etapas do seu trilho (Serviço de Ficheiros).
 * GET    /api/etapa-anexos?colaboradorId=…  — anexos do colaborador (próprio, RH ou mentor)
 * POST   /api/etapa-anexos                  — { progressoId, documentoChave, key, nome } depois do envio
 * DELETE /api/etapa-anexos/:id              — remove, enquanto a etapa não estiver concluída
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POR_DOCUMENTO = 5;

async function etapaEditavel(user: AuthUser, progressoId: string) {
  const rows = await sql`
    SELECT p.colaborador_id, p.estado::text AS estado, e.documentos_pedidos, c.utilizador_id
      FROM progresso_onboarding p
      JOIN etapas_trilho e ON e.id = p.etapa_id
      JOIN colaboradores c ON c.id = p.colaborador_id
     WHERE p.id = ${progressoId}
  `;
  if (!rows.length) throw new StorageError('Etapa não encontrada', 404);
  const etapa = rows[0];
  if (etapa.utilizador_id !== user.id && user.role !== 'rh_admin') {
    throw new StorageError('Só o colaborador desta etapa pode alterar os documentos.', 403);
  }
  if (etapa.estado === 'concluida') throw new StorageError('Esta etapa já está concluída.', 409);
  return {
    colaboradorId: etapa.colaborador_id as string,
    pedidos: lerDocumentosPedidos(etapa.documentos_pedidos),
  };
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  const url = new URL(req.url);
  const id = url.pathname.split('/').filter(Boolean)[2] ?? null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'GET' && !id) {
      const colaboradorId = url.searchParams.get('colaboradorId') ?? '';
      if (!UUID_RE.test(colaboradorId)) return errorResponse('Colaborador inválido', 400);
      if (!(await podeVerColaborador(user, colaboradorId))) return errorResponse('Sem permissão', 403);
      const rows = await sql`
        SELECT a.*
          FROM etapa_anexos a
          JOIN progresso_onboarding p ON p.id = a.progresso_id
         WHERE p.colaborador_id = ${colaboradorId}
         ORDER BY a.created_at
      `;
      return jsonResponse({ data: rows.map(formatarAnexo) });
    }

    if (req.method === 'POST' && !id) {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const progressoId = typeof body.progressoId === 'string' ? body.progressoId : '';
      const documentoChave = typeof body.documentoChave === 'string' ? body.documentoChave : '';
      const key = typeof body.key === 'string' ? body.key : '';
      const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 200) : '';
      if (!UUID_RE.test(progressoId) || !documentoChave || !nome) return errorResponse('Dados do anexo em falta', 400);

      const etapa = await etapaEditavel(user, progressoId);
      const pasta = `trilhos/${etapa.colaboradorId}/${progressoId}`;
      if (!etapa.pedidos.some((d) => d.chave === documentoChave)) {
        await descartarEnvio(key, pasta, user.id);
        return errorResponse('Este documento não é pedido nesta etapa.', 400);
      }
      const [{ total }] = await sql`
        SELECT COUNT(*)::int AS total FROM etapa_anexos
         WHERE progresso_id = ${progressoId} AND documento_chave = ${documentoChave}
      `;
      if ((total as number) >= MAX_POR_DOCUMENTO) {
        await descartarEnvio(key, pasta, user.id);
        return errorResponse(`Cada documento aceita até ${MAX_POR_DOCUMENTO} ficheiros.`, 409);
      }

      const meta = await confirmarEnvio('documento', key, pasta, user.id);
      const [anexo] = await sql`
        INSERT INTO etapa_anexos (progresso_id, documento_chave, ficheiro_key, ficheiro_nome, ficheiro_tipo, tamanho, enviado_por)
        VALUES (${progressoId}, ${documentoChave}, ${key}, ${nome}, ${meta.tipo}, ${meta.tamanho}, ${user.id})
        RETURNING *
      `;
      return jsonResponse({ data: formatarAnexo(anexo) }, 201);
    }

    if (req.method === 'DELETE' && id) {
      if (!UUID_RE.test(id)) return errorResponse('Anexo não encontrado', 404);
      const rows = await sql`SELECT progresso_id, ficheiro_key FROM etapa_anexos WHERE id = ${id}`;
      if (!rows.length) return errorResponse('Anexo não encontrado', 404);
      await etapaEditavel(user, rows[0].progresso_id as string);
      await sql`DELETE FROM etapa_anexos WHERE id = ${id}`;
      await apagarObjecto(rows[0].ficheiro_key as string);
      return jsonResponse({ data: { id } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[etapa-anexos]', err);
    return errorResponse(publicErrorMessage(err, 'Não foi possível guardar o documento.'));
  }
};

export const config: Config = {
  path: ['/api/etapa-anexos', '/api/etapa-anexos/:id'],
};
