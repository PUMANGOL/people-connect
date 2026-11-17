import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { embedFaqById, reindexPublishedFaqs } from './_shared/faq-embeddings';

/**
 * CRUD FAQs + reindex embeddings.
 *   GET    /api/faqs
 *   POST   /api/faqs
 *   PATCH  /api/faqs/:id
 *   DELETE /api/faqs/:id
 *   POST   /api/faqs/reindex-embeddings
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // parts: ['api', 'faqs'] | ['api', 'faqs', ':id'] | ['api', 'faqs', 'reindex-embeddings']
  const last = parts[parts.length - 1];
  const isReindex = last === 'reindex-embeddings';
  const id = last !== 'faqs' && !isReindex ? last : null;
  const method = req.method;
  const estado = url.searchParams.get('estado');
  const direccao = url.searchParams.get('direccao');

  try {
    if (method === 'GET' && !id && !isReindex) {
      let rows;
      if (estado && direccao) {
        rows = await sql`
          SELECT id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                 owner, estado, vezes_citada, data_actualizacao, created_at,
                 (embedding IS NOT NULL) AS tem_embedding, embedding_actualizado_em
          FROM faqs
          WHERE estado = ${estado}::estado_faq AND direccao = ${direccao}
          ORDER BY data_actualizacao DESC
        `;
      } else if (estado) {
        rows = await sql`
          SELECT id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                 owner, estado, vezes_citada, data_actualizacao, created_at,
                 (embedding IS NOT NULL) AS tem_embedding, embedding_actualizado_em
          FROM faqs WHERE estado = ${estado}::estado_faq
          ORDER BY data_actualizacao DESC
        `;
      } else if (direccao) {
        rows = await sql`
          SELECT id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                 owner, estado, vezes_citada, data_actualizacao, created_at,
                 (embedding IS NOT NULL) AS tem_embedding, embedding_actualizado_em
          FROM faqs WHERE direccao = ${direccao}
          ORDER BY data_actualizacao DESC
        `;
      } else {
        rows = await sql`
          SELECT id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                 owner, estado, vezes_citada, data_actualizacao, created_at,
                 (embedding IS NOT NULL) AS tem_embedding, embedding_actualizado_em
          FROM faqs ORDER BY data_actualizacao DESC LIMIT 500
        `;
      }
      return jsonResponse({ data: rows });
    }

    // Mutations require auth + admin
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') {
      return errorResponse('Sem permissão para alterar FAQs', 403);
    }

    if (method === 'POST' && isReindex) {
      const result = await reindexPublishedFaqs(300);
      return jsonResponse({
        data: result,
        message: `${result.processed} FAQs reindexadas${result.errors ? `, ${result.errors} erros` : ''}`,
      });
    }

    if (method === 'POST' && !id) {
      const body = await req.json();
      const {
        direccao,
        categoria,
        pergunta,
        variantes,
        resposta,
        palavras_chave,
        owner,
        estado: est,
      } = body as Record<string, unknown>;

      if (!direccao || !categoria || !pergunta || !resposta) {
        return errorResponse('direccao, categoria, pergunta e resposta são obrigatórios', 400);
      }

      const rows = await sql`
        INSERT INTO faqs (direccao, categoria, pergunta, variantes, resposta, palavras_chave, owner, estado)
        VALUES (
          ${String(direccao)},
          ${String(categoria)}::categoria_faq,
          ${String(pergunta)},
          ${(variantes as string[]) ?? []},
          ${String(resposta)},
          ${(palavras_chave as string[]) ?? []},
          ${owner ? String(owner) : null},
          ${String(est ?? 'rascunho')}::estado_faq
        )
        RETURNING id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                  owner, estado, vezes_citada, data_actualizacao, created_at
      `;

      const faq = rows[0];
      if (faq.estado === 'publicada') {
        embedFaqById(faq.id as string).catch((e) => console.error('[faqs embed]', e));
      }
      return jsonResponse({ data: faq }, 201);
    }

    if (method === 'PATCH' && id) {
      const body = await req.json();
      const {
        pergunta,
        resposta,
        estado: est,
        categoria,
        palavras_chave,
        variantes,
        direccao,
      } = body as Record<string, unknown>;

      const rows = await sql`
        UPDATE faqs SET
          pergunta = COALESCE(${pergunta != null ? String(pergunta) : null}, pergunta),
          resposta = COALESCE(${resposta != null ? String(resposta) : null}, resposta),
          estado = COALESCE(${est != null ? String(est) : null}::estado_faq, estado),
          categoria = COALESCE(${categoria != null ? String(categoria) : null}::categoria_faq, categoria),
          palavras_chave = COALESCE(${palavras_chave != null ? (palavras_chave as string[]) : null}, palavras_chave),
          variantes = COALESCE(${variantes != null ? (variantes as string[]) : null}, variantes),
          direccao = COALESCE(${direccao != null ? String(direccao) : null}, direccao),
          data_actualizacao = NOW()
        WHERE id = ${id}
        RETURNING id, direccao, categoria, pergunta, variantes, resposta, palavras_chave,
                  owner, estado, vezes_citada, data_actualizacao, created_at
      `;
      if (rows.length === 0) return errorResponse('FAQ não encontrada', 404);

      const faq = rows[0];
      // Re-embed se publicada; limpar se arquivada
      embedFaqById(id).catch((e) => console.error('[faqs embed]', e));

      return jsonResponse({ data: faq });
    }

    if (method === 'DELETE' && id) {
      const rows = await sql`DELETE FROM faqs WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return errorResponse('FAQ não encontrada', 404);
      return jsonResponse({ ok: true });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('faqs error:', err);
    // coluna embedding pode não existir ainda
    const msg = err instanceof Error ? err.message : 'Erro interno';
    if (msg.includes('embedding') || msg.includes('agent_config') || msg.includes('does not exist')) {
      // fallback GET sem colunas novas
      if (method === 'GET') {
        try {
          const rows = await sql`SELECT * FROM faqs ORDER BY data_actualizacao DESC LIMIT 500`;
          return jsonResponse({ data: rows });
        } catch (e2) {
          return errorResponse(publicErrorMessage(e2, 'Erro interno'));
        }
      }
    }
    return errorResponse(msg);
  }
};

export const config: Config = {
  path: ['/api/faqs', '/api/faqs/:id', '/api/faqs/reindex-embeddings'],
};
