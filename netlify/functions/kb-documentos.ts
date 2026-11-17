import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

/**
 * CRUD dos documentos da KB.
 *   GET    /api/kb-documentos             — listar
 *   GET    /api/kb-documentos/:id         — detalhe + chunks preview
 *   PATCH  /api/kb-documentos/:id         — actualizar (estado, título)
 *   DELETE /api/kb-documentos/:id         — apagar (cascade nos chunks)
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const id = last !== 'kb-documentos' ? last : null;
  const method = req.method;

  const estado = url.searchParams.get('estado');
  const direccao = url.searchParams.get('direccao');

  try {
    if (method === 'GET' && !id) {
      let rows;
      if (estado && direccao) {
        rows = await sql`
          SELECT id, titulo, descricao, categoria, direccao, tipo_ficheiro, tamanho_bytes,
                 estado, chunks_total, embedding_model, erro_processamento,
                 created_at, updated_at
          FROM kb_documentos
          WHERE estado = ${estado} AND direccao = ${direccao}
          ORDER BY updated_at DESC
          LIMIT 200
        `;
      } else if (estado) {
        rows = await sql`
          SELECT id, titulo, descricao, categoria, direccao, tipo_ficheiro, tamanho_bytes,
                 estado, chunks_total, embedding_model, erro_processamento,
                 created_at, updated_at
          FROM kb_documentos WHERE estado = ${estado}
          ORDER BY updated_at DESC LIMIT 200
        `;
      } else if (direccao) {
        rows = await sql`
          SELECT id, titulo, descricao, categoria, direccao, tipo_ficheiro, tamanho_bytes,
                 estado, chunks_total, embedding_model, erro_processamento,
                 created_at, updated_at
          FROM kb_documentos WHERE direccao = ${direccao}
          ORDER BY updated_at DESC LIMIT 200
        `;
      } else {
        rows = await sql`
          SELECT id, titulo, descricao, categoria, direccao, tipo_ficheiro, tamanho_bytes,
                 estado, chunks_total, embedding_model, erro_processamento,
                 created_at, updated_at
          FROM kb_documentos
          ORDER BY updated_at DESC LIMIT 200
        `;
      }
      return jsonResponse({ data: rows });
    }

    if (method === 'GET' && id) {
      const doc = await sql`SELECT * FROM kb_documentos WHERE id = ${id}`;
      if (doc.length === 0) return errorResponse('Documento não encontrado', 404);

      const chunks = await sql`
        SELECT id, ordem, conteudo, tokens, metadata
        FROM kb_chunks WHERE documento_id = ${id}
        ORDER BY ordem ASC LIMIT 50
      `;

      return jsonResponse({
        data: {
          documento: doc[0],
          chunks_preview: chunks,
        },
      });
    }

    if (method === 'PATCH' && id) {
      const body = await req.json();
      const { titulo, descricao, categoria, direccao, estado: newEstado } = body;
      const rows = await sql`
        UPDATE kb_documentos SET
          titulo = COALESCE(${titulo}, titulo),
          descricao = COALESCE(${descricao}, descricao),
          categoria = COALESCE(${categoria}::categoria_faq, categoria),
          direccao = COALESCE(${direccao}, direccao),
          estado = COALESCE(${newEstado}, estado),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    if (method === 'DELETE' && id) {
      // ON DELETE CASCADE em kb_chunks trata dos chunks
      await sql`DELETE FROM kb_documentos WHERE id = ${id}`;
      return jsonResponse({ ok: true });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    console.error('[kb-documentos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/kb-documentos', '/api/kb-documentos/:id'],
};
