import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { apagarObjecto, confirmarEnvio, StorageError } from './_shared/storage';

/**
 * Confirmação de Submissões (EPIC 3.4 — revisto).
 *
 * Nesta versão a plataforma não recebe upload de ficheiros: o colaborador
 * apenas *confirma* (checkbox) que já submeteu cada documento pelo canal
 * combinado (email/entrega física). O admin vê essa confirmação em tempo
 * real na página do colaborador.
 *
 * GET    /api/submissoes                    — checklist do colaborador autenticado.
 * POST   /api/submissoes                    — { documento_exigido_id } marca como confirmado.
 * DELETE /api/submissoes/:id                — o colaborador desmarca a própria confirmação.
 * GET    /api/submissoes/colaborador/:id    — admin: checklist de um colaborador.
 * PATCH  /api/submissoes/:id                — admin: pode ainda aprovar/rejeitar/anotar.
 */

async function colaboradorDoUtilizador(utilizadorId: string): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM colaboradores WHERE utilizador_id = ${utilizadorId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return (rows[0]?.id as string) ?? null;
}

async function checklistDe(colaboradorId: string) {
  return sql`
    SELECT d.id AS documento_exigido_id, d.nome, d.descricao, d.obrigatorio, d.ordem,
           s.id AS submissao_id, COALESCE(s.estado, 'pendente') AS estado,
           s.ficheiro_ref, s.ficheiro_nome, s.motivo_rejeicao, s.submetido_em, s.avaliado_em
    FROM documentos_exigidos d
    LEFT JOIN submissoes_documentos s
      ON s.documento_exigido_id = d.id AND s.colaborador_id = ${colaboradorId}
    WHERE d.activo = true
    ORDER BY d.ordem, d.nome
  `;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const isColaboradorPath = parts.includes('colaborador');

  try {
    const user = await requireAuth(req);

    // Admin: submissões de um colaborador específico
    if (req.method === 'GET' && isColaboradorPath) {
      if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
      const colaboradorId = last;
      const rows = await checklistDe(colaboradorId);
      return jsonResponse({ data: rows });
    }

    // Colaborador: a própria checklist
    if (req.method === 'GET') {
      const colaboradorId = await colaboradorDoUtilizador(user.id);
      if (!colaboradorId) return jsonResponse({ data: [] });
      const rows = await checklistDe(colaboradorId);
      return jsonResponse({ data: rows });
    }

    // Colaborador: confirma a entrega e, se vier um ficheiro, guarda-o.
    if (req.method === 'POST') {
      const colaboradorId = await colaboradorDoUtilizador(user.id);
      if (!colaboradorId) return errorResponse('Conta sem registo de colaborador associado', 400);
      const body = await req.json();
      const documentoExigidoId = body.documento_exigido_id;
      if (!documentoExigidoId) return errorResponse('documento_exigido_id em falta', 400);

      const ficheiroId = typeof body.ficheiro_id === 'string' ? body.ficheiro_id : '';
      const ficheiroNome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 180) : '';
      if (ficheiroId) {
        await confirmarEnvio('submissao', ficheiroId, `submissoes/${user.id}`, user.id);
        if (!ficheiroNome) return errorResponse('Indica o nome do ficheiro.', 400);
      }

      const anterior = await sql`
        SELECT ficheiro_ref FROM submissoes_documentos
         WHERE colaborador_id = ${colaboradorId} AND documento_exigido_id = ${documentoExigidoId}
      `;
      const rows = ficheiroId
        ? await sql`
            INSERT INTO submissoes_documentos
              (colaborador_id, documento_exigido_id, estado, ficheiro_ref, ficheiro_nome, submetido_em)
            VALUES
              (${colaboradorId}, ${documentoExigidoId}, 'submetido', ${ficheiroId}, ${ficheiroNome}, NOW())
            ON CONFLICT (colaborador_id, documento_exigido_id) DO UPDATE SET
              estado = 'submetido',
              ficheiro_ref = ${ficheiroId},
              ficheiro_nome = ${ficheiroNome},
              motivo_rejeicao = NULL,
              submetido_em = NOW(),
              avaliado_em = NULL
            RETURNING *
          `
        : await sql`
            INSERT INTO submissoes_documentos
              (colaborador_id, documento_exigido_id, estado, submetido_em)
            VALUES
              (${colaboradorId}, ${documentoExigidoId}, 'submetido', NOW())
            ON CONFLICT (colaborador_id, documento_exigido_id) DO UPDATE SET
              estado = 'submetido',
              motivo_rejeicao = NULL,
              submetido_em = NOW(),
              avaliado_em = NULL
            RETURNING *
          `;
      const antigo = anterior[0]?.ficheiro_ref as string | undefined;
      if (ficheiroId && antigo && antigo !== ficheiroId) await apagarObjecto(antigo);
      return jsonResponse({ data: rows[0] }, 201);
    }

    // Colaborador: desmarcar (apagar a confirmação)
    if (req.method === 'DELETE' && last && !isColaboradorPath) {
      const colaboradorId = await colaboradorDoUtilizador(user.id);
      if (!colaboradorId) return errorResponse('Conta sem registo de colaborador associado', 400);
      const rows = await sql`
        DELETE FROM submissoes_documentos
        WHERE id = ${last} AND colaborador_id = ${colaboradorId}
        RETURNING id, ficheiro_ref
      `;
      if (!rows.length) return errorResponse('Confirmação não encontrada', 404);
      await apagarObjecto(rows[0].ficheiro_ref as string | null);
      return jsonResponse({ data: { ok: true } });
    }

    // Admin: avaliar submissão
    if (req.method === 'PATCH' && last) {
      if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
      const body = await req.json();
      const estado = body.estado as string; // 'aprovado' | 'rejeitado'
      if (!['aprovado', 'rejeitado', 'submetido', 'pendente'].includes(estado)) {
        return errorResponse('Estado inválido', 400);
      }
      const rows = await sql`
        UPDATE submissoes_documentos SET
          estado = ${estado},
          motivo_rejeicao = ${estado === 'rejeitado' ? (body.motivo_rejeicao ?? null) : null},
          avaliado_em = NOW()
        WHERE id = ${last}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[submissoes]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/submissoes', '/api/submissoes/:id', '/api/submissoes/colaborador/:id'],
};
