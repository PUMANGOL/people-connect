import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';
import { podeVerColaborador } from './_shared/acesso-colaborador';
import { lerDocumentosPedidos } from './_shared/anexos';
import {
  ID_FICHEIRO,
  imagemPorConfirmar,
  linkEnvio,
  StorageError,
  urlLeitura,
  validarFicheiro,
  type Finalidade,
} from './_shared/storage';

/**
 * Ficheiros no Serviço de Ficheiros Pumangol.
 * POST /api/ficheiros/envio   { finalidade, tipo, tamanho, progressoId?, documentoChave? }
 *   → { url }: o browser faz POST multipart directamente para esse link.
 *   Depois confirma em /api/perfil/imagem (foto), /api/etapa-anexos (documento)
 *   ou /api/comunidade/posts (imagem da publicação).
 * GET  /api/ficheiros?key=…&descarregar=1
 *   → 302 para um URL assinado, depois de validar quem pode ler.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINALIDADES: Finalidade[] = ['foto', 'capa', 'documento', 'publicacao', 'submissao', 'empresa'];

async function podeLer(user: AuthUser, key: string): Promise<{ nome?: string } | 'negado' | 'ausente'> {
  const perfil = await sql`SELECT 1 FROM perfis_utilizador WHERE foto_key = ${key} OR capa_key = ${key} LIMIT 1`;
  if (perfil.length) return {};

  const anexo = await sql`
    SELECT a.ficheiro_nome, p.colaborador_id
      FROM etapa_anexos a
      JOIN progresso_onboarding p ON p.id = a.progresso_id
     WHERE a.ficheiro_key = ${key}
     LIMIT 1
  `;
  if (anexo.length) {
    if (!(await podeVerColaborador(user, anexo[0].colaborador_id as string))) return 'negado';
    return { nome: anexo[0].ficheiro_nome as string };
  }

  const publicacao = await sql`
    SELECT 1 FROM comunidade_posts WHERE imagem = ${`/api/ficheiros?key=${key}`} LIMIT 1
  `;
  if (publicacao.length) return {};

  const evento = await sql`
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'eventos' AND column_name = 'imagem'
  `;
  if (evento.length) {
    const comImagem = await sql`
      SELECT 1 FROM eventos WHERE imagem = ${`/api/ficheiros?key=${key}`} LIMIT 1
    `;
    if (comImagem.length) return {};
  }

  const politica = await sql`
    SELECT nome FROM documentos_empresa WHERE ficheiro_ref = ${key} LIMIT 1
  `;
  if (politica.length) return { nome: politica[0].nome as string };

  const submissao = await sql`
    SELECT s.ficheiro_nome, c.utilizador_id
      FROM submissoes_documentos s
      JOIN colaboradores c ON c.id = s.colaborador_id
     WHERE s.ficheiro_ref = ${key}
     LIMIT 1
  `;
  if (submissao.length) {
    if (submissao[0].utilizador_id !== user.id && user.role !== 'rh_admin') return 'negado';
    return { nome: (submissao[0].ficheiro_nome as string) || undefined };
  }

  if (await imagemPorConfirmar(key, user.id)) return {};
  return 'ausente';
}

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
        return jsonResponse({ data: await linkEnvio(`perfis/${user.id}/foto`, user.id, 'PRIVATE') });
      }

      if (finalidade === 'publicacao') {
        return jsonResponse({ data: await linkEnvio(`comunidade/${user.id}`, user.id, 'PRIVATE') });
      }

      if (finalidade === 'submissao') {
        return jsonResponse({ data: await linkEnvio(`submissoes/${user.id}`, user.id, 'PRIVATE') });
      }

      if (finalidade === 'empresa') {
        if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
        return jsonResponse({ data: await linkEnvio('empresa/politicas', user.id, 'PRIVATE') });
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

      return jsonResponse({ data: await linkEnvio(`trilhos/${etapa.colaborador_id}/${progressoId}`, user.id, 'PRIVATE') });
    }

    if (req.method === 'GET' && !accao) {
      const key = url.searchParams.get('key') ?? '';
      const descarregar = url.searchParams.get('descarregar') === '1';
      if (!key || key.includes('..')) return errorResponse('Ficheiro não encontrado', 404);

      if (ID_FICHEIRO.test(key)) {
        const leitura = await podeLer(user, key);
        if (leitura === 'negado') return errorResponse('Sem permissão para este ficheiro.', 403);
        if (leitura === 'ausente') return errorResponse('Ficheiro não encontrado', 404);
        const destino = await urlLeitura(key, { nome: leitura.nome, descarregar });
        return new Response(null, {
          status: 302,
          headers: { Location: destino, 'Cache-Control': 'private, max-age=60' },
        });
      }

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
