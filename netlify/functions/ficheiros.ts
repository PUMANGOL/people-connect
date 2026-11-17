import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { podeVerColaborador } from './_shared/acesso-colaborador';
import { lerDocumentosPedidos } from './_shared/anexos';
import { novaChave, prepararEnvio, StorageError, urlLeitura, validarFicheiro, type Finalidade } from './_shared/storage';

/**
 * Ficheiros no bucket S3.
 * POST /api/ficheiros/envio   { finalidade, tipo, tamanho, progressoId?, documentoChave? }
 *   → { url, fields, key }: o browser faz POST multipart directamente para o bucket.
 *   Depois confirma em /api/perfil/imagem (foto, capa) ou /api/etapa-anexos (documento).
 * GET  /api/ficheiros?key=…&descarregar=1
 *   → 302 para um URL assinado, depois de validar quem pode ler.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINALIDADES: Finalidade[] = ['foto', 'capa', 'documento'];

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  const url = new URL(req.url);
  const accao = url.pathname.split('/').filter(Boolean)[2] ?? null;

  try {
    const user = await requireAuth(req);

    if (req.method === 'POST' && accao === 'envio') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const finalidade = body.finalidade as Finalidade;
      const tipo = typeof body.tipo === 'string' ? body.tipo : '';
      const tamanho = Number(body.tamanho);
      if (finalidade === 'capa') return errorResponse('A capa do perfil é fixa.', 400);
      if (!FINALIDADES.includes(finalidade)) return errorResponse('Finalidade inválida', 400);
      validarFicheiro(finalidade, tipo, tamanho);

      if (finalidade === 'foto') {
        const key = novaChave(`perfis/${user.id}/foto`, tipo);
        return jsonResponse({ data: await prepararEnvio('foto', key, tipo) });
      }

      const progressoId = typeof body.progressoId === 'string' ? body.progressoId : '';
      const documentoChave = typeof body.documentoChave === 'string' ? body.documentoChave : '';
      if (!UUID_RE.test(progressoId) || !documentoChave) return errorResponse('Documento inválido', 400);

      const rows = await sql`
        SELECT p.colaborador_id, p.estado::text AS estado, e.documentos_pedidos, c.utilizador_id
          FROM progresso_onboarding p
          JOIN etapas_trilho e ON e.id = p.etapa_id
          JOIN colaboradores c ON c.id = p.colaborador_id
         WHERE p.id = ${progressoId}
      `;
      if (!rows.length) return errorResponse('Etapa não encontrada', 404);
      const etapa = rows[0];
      if (etapa.utilizador_id !== user.id && user.role !== 'rh_admin') {
        return errorResponse('Só o colaborador desta etapa pode anexar documentos.', 403);
      }
      if (etapa.estado === 'concluida') return errorResponse('Esta etapa já está concluída.', 409);
      const pedidos = lerDocumentosPedidos(etapa.documentos_pedidos);
      if (!pedidos.some((d) => d.chave === documentoChave)) return errorResponse('Este documento não é pedido nesta etapa.', 400);

      const key = novaChave(`trilhos/${etapa.colaborador_id}/${progressoId}`, tipo);
      return jsonResponse({ data: await prepararEnvio('documento', key, tipo) });
    }

    if (req.method === 'GET' && !accao) {
      const key = url.searchParams.get('key') ?? '';
      const descarregar = url.searchParams.get('descarregar') === '1';
      if (!key || key.includes('..')) return errorResponse('Ficheiro não encontrado', 404);
      const [raiz, dono] = key.split('/');

      let nome: string | undefined;
      if (raiz === 'perfis' && UUID_RE.test(dono ?? '')) {
        // Fotos e capas de perfil são visíveis para qualquer pessoa com sessão.
      } else if (raiz === 'trilhos' && UUID_RE.test(dono ?? '')) {
        if (!(await podeVerColaborador(user, dono))) return errorResponse('Sem permissão para este ficheiro.', 403);
        const anexo = await sql`SELECT ficheiro_nome FROM etapa_anexos WHERE ficheiro_key = ${key} LIMIT 1`;
        if (!anexo.length) return errorResponse('Ficheiro não encontrado', 404);
        nome = anexo[0].ficheiro_nome as string;
      } else {
        return errorResponse('Ficheiro não encontrado', 404);
      }

      const destino = await urlLeitura(key, { nome, descarregar });
      return new Response(null, {
        status: 302,
        headers: { Location: destino, 'Cache-Control': 'private, max-age=300' },
      });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[ficheiros]', err);
    return errorResponse(publicErrorMessage(err, 'Não foi possível tratar o ficheiro.'));
  }
};

export const config: Config = {
  path: ['/api/ficheiros', '/api/ficheiros/:accao'],
};
