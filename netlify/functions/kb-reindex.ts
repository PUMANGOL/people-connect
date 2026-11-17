import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { chunkText } from './_shared/chunker';
import { embedPassages, toVectorLiteral } from './_shared/embeddings';
import { isNvidiaReady } from './_shared/nvidia-client';

/**
 * POST /api/kb-reindex
 * Body: { id: uuid }
 *
 * V1:
 * - Se texto_fonte existe → re-chunk + re-embed
 * - Senão → re-embed dos chunks existentes (sem re-extrair PDF)
 */

const BATCH_SIZE = 16;

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
    if (!isNvidiaReady()) return errorResponse('NVIDIA_API_KEY não configurada', 503);
    if (!isDatabaseConfigured()) return errorResponse('DATABASE_URL não configurada', 503);

    const body = await req.json();
    const id = String(body.id ?? '').trim();
    if (!id) return errorResponse('id obrigatório', 400);

    const docs = await sql`SELECT * FROM kb_documentos WHERE id = ${id}`;
    if (docs.length === 0) return errorResponse('Documento não encontrado', 404);
    const doc = docs[0] as Record<string, unknown>;

    await sql`
      UPDATE kb_documentos SET estado = 'processando', erro_processamento = NULL, updated_at = NOW()
      WHERE id = ${id}
    `;

    try {
      const textoFonte = typeof doc.texto_fonte === 'string' ? doc.texto_fonte.trim() : '';

      if (textoFonte.length > 40) {
        // Re-chunk completo
        await sql`DELETE FROM kb_chunks WHERE documento_id = ${id}`;
        const chunks = chunkText(textoFonte);
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const embeddings = await embedPassages(batch.map((c) => c.conteudo));
          for (let j = 0; j < batch.length; j++) {
            const c = batch[j];
            const embLiteral = toVectorLiteral(embeddings[j]);
            await sql`
              INSERT INTO kb_chunks (documento_id, ordem, conteudo, tokens, embedding, metadata)
              VALUES (
                ${id}, ${c.ordem}, ${c.conteudo}, ${c.tokens},
                ${embLiteral}::vector, ${JSON.stringify(c.metadata ?? {})}::text::jsonb
              )
            `;
          }
        }
        await sql`
          UPDATE kb_documentos
          SET estado = 'indexado', chunks_total = ${chunks.length}, updated_at = NOW()
          WHERE id = ${id}
        `;
        return jsonResponse({
          data: { id, chunks: chunks.length, modo: 'rechunk' },
          message: `Reindexado com re-chunk (${chunks.length} chunks)`,
        });
      }

      // Só re-embed chunks existentes
      const existing = await sql`
        SELECT id, conteudo FROM kb_chunks WHERE documento_id = ${id} ORDER BY ordem
      `;
      if (existing.length === 0) {
        throw new Error(
          'Sem texto_fonte nem chunks — reindex não disponível (re-faz upload do PDF/DOCX)'
        );
      }

      for (let i = 0; i < existing.length; i += BATCH_SIZE) {
        const batch = existing.slice(i, i + BATCH_SIZE) as { id: string; conteudo: string }[];
        const embeddings = await embedPassages(batch.map((c) => c.conteudo));
        for (let j = 0; j < batch.length; j++) {
          const embLiteral = toVectorLiteral(embeddings[j]);
          await sql`
            UPDATE kb_chunks SET embedding = ${embLiteral}::vector WHERE id = ${batch[j].id}
          `;
        }
      }

      await sql`
        UPDATE kb_documentos
        SET estado = 'indexado', chunks_total = ${existing.length}, updated_at = NOW()
        WHERE id = ${id}
      `;

      return jsonResponse({
        data: { id, chunks: existing.length, modo: 'reembed' },
        message: `Embeddings actualizados (${existing.length} chunks)`,
      });
    } catch (procErr) {
      const msg = publicErrorMessage(procErr, 'Erro no reindex');
      await sql`
        UPDATE kb_documentos SET estado = 'falha', erro_processamento = ${msg}, updated_at = NOW()
        WHERE id = ${id}
      `;
      return errorResponse(msg, 500);
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[kb-reindex]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: '/api/kb-reindex',
};
