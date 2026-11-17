import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { embed, toVectorLiteral } from './_shared/embeddings';
import { isNvidiaReady, NVIDIA_CONFIG } from './_shared/nvidia-client';

/**
 * GET /api/kb-debug?q=<pergunta>
 *
 * Endpoint de diagnóstico do RAG. Mostra:
 *   - Total de documentos e chunks indexados
 *   - Top 10 chunks para a query dada, com score real
 *   - Se o topScore está acima do threshold minRelevanceScore
 *
 * Uso: /api/kb-debug?q=quantos%20dias%20de%20ferias%20tenho
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!isNvidiaReady()) return errorResponse('NVIDIA_API_KEY não configurada', 503);
  if (!isDatabaseConfigured()) return errorResponse('DATABASE_URL não configurada', 503);

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');

    // Estatísticas gerais
    const [totalDocs] = await sql`SELECT COUNT(*)::int as n FROM kb_documentos`;
    const [indexados] = await sql`SELECT COUNT(*)::int as n FROM kb_documentos WHERE estado = 'indexado'`;
    const [totalChunks] = await sql`SELECT COUNT(*)::int as n FROM kb_chunks`;
    const docs = await sql`
      SELECT d.id, d.titulo, d.estado, d.chunks_total, d.embedding_model,
             (SELECT COUNT(*)::int FROM kb_chunks c WHERE c.documento_id = d.id) as chunks_reais
      FROM kb_documentos d
      ORDER BY d.created_at DESC LIMIT 20
    `;

    const stats = {
      total_documentos: totalDocs.n,
      documentos_indexados: indexados.n,
      total_chunks: totalChunks.n,
      threshold_relevancia: NVIDIA_CONFIG.minRelevanceScore,
      embed_model: NVIDIA_CONFIG.embedModel,
      chat_model: NVIDIA_CONFIG.chatModel,
    };

    if (!query) {
      return jsonResponse({
        stats,
        documentos: docs,
        hint: 'Passa ?q=<pergunta> para testar retrieval e ver scores',
      });
    }

    // Retrieval de teste
    const t0 = Date.now();
    const queryEmbedding = await embed(query);
    const embedMs = Date.now() - t0;
    const embLiteral = toVectorLiteral(queryEmbedding);

    const results = await sql`
      SELECT
        c.id,
        LEFT(c.conteudo, 200) as excerpt,
        c.metadata->>'pagina' as pagina,
        d.titulo as documento_titulo,
        1 - (c.embedding <=> ${embLiteral}::vector) as score
      FROM kb_chunks c
      JOIN kb_documentos d ON d.id = c.documento_id
      WHERE d.estado = 'indexado'
      ORDER BY c.embedding <=> ${embLiteral}::vector
      LIMIT 10
    `;

    const topScore = results[0] ? Number(results[0].score) : 0;

    return jsonResponse({
      stats,
      query: {
        texto: query,
        embed_dimensions: queryEmbedding.length,
        embed_latencia_ms: embedMs,
        top_score: topScore,
        acima_do_threshold: topScore >= NVIDIA_CONFIG.minRelevanceScore,
        precisa_escalar: topScore < NVIDIA_CONFIG.minRelevanceScore,
      },
      top_chunks: results.map((r: Record<string, unknown>) => ({
        score: Number(r.score),
        documento: r.documento_titulo,
        pagina: r.pagina,
        excerpt: r.excerpt,
      })),
    });
  } catch (err) {
    console.error('[kb-debug]', err);
    return errorResponse(publicErrorMessage(err, 'Erro'), 500);
  }
};

export const config: Config = {
  path: '/api/kb-debug',
};
