import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { retrieveHybrid } from './_shared/retrieve-hybrid';
import { loadAgentConfig } from './_shared/agent/config';
import { isNvidiaReady, NVIDIA_CONFIG } from './_shared/nvidia-client';

/**
 * GET /api/kb-test?q=<pergunta>
 * Teste hybrid RAG para admin (tab Testar).
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return errorResponse('Método não suportado', 405);

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);
    if (!isDatabaseConfigured()) return errorResponse('DATABASE_URL não configurada', 503);

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const agentCfg = await loadAgentConfig();

    let totalDocs = 0;
    let indexados = 0;
    let totalChunks = 0;
    let faqsPub = 0;
    let faqsComEmb = 0;

    try {
      const [d1] = await sql`SELECT COUNT(*)::int as n FROM kb_documentos`;
      const [d2] = await sql`SELECT COUNT(*)::int as n FROM kb_documentos WHERE estado = 'indexado'`;
      const [c1] = await sql`SELECT COUNT(*)::int as n FROM kb_chunks`;
      const [f1] = await sql`SELECT COUNT(*)::int as n FROM faqs WHERE estado = 'publicada'`;
      totalDocs = d1.n as number;
      indexados = d2.n as number;
      totalChunks = c1.n as number;
      faqsPub = f1.n as number;
      try {
        const [f2] = await sql`
          SELECT COUNT(*)::int as n FROM faqs
          WHERE estado = 'publicada' AND embedding IS NOT NULL
        `;
        faqsComEmb = f2.n as number;
      } catch {
        faqsComEmb = 0;
      }
    } catch (e) {
      console.error('[kb-test stats]', e);
    }

    const stats = {
      total_documentos: totalDocs,
      documentos_indexados: indexados,
      total_chunks: totalChunks,
      faqs_publicadas: faqsPub,
      faqs_com_embedding: faqsComEmb,
      threshold_relevancia: agentCfg.min_relevance_score,
      top_k: agentCfg.top_k,
      nvidia_ready: isNvidiaReady(),
      embed_model: NVIDIA_CONFIG.embedModel,
    };

    if (!q) {
      return jsonResponse({ stats, hint: 'Passa ?q=<pergunta> para testar retrieval híbrido' });
    }

    const t0 = Date.now();
    const hits = await retrieveHybrid(q, agentCfg.top_k || 6);
    const latencia_ms = Date.now() - t0;
    const topScore = hits[0]?.score ?? 0;

    return jsonResponse({
      stats,
      query: {
        texto: q,
        latencia_ms,
        top_score: topScore,
        acima_do_threshold: topScore >= agentCfg.min_relevance_score,
        precisa_escalar: topScore < agentCfg.min_relevance_score,
        hits: hits.length,
      },
      hits: hits.map((h) => ({
        id: h.id,
        score: h.score,
        origem: h.origem,
        titulo: h.titulo,
        pagina: h.pagina,
        direccao: h.direccao,
        excerpt: h.conteudo.slice(0, 280),
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[kb-test]', err);
    return errorResponse(publicErrorMessage(err, 'Erro'), 500);
  }
};

export const config: Config = {
  path: '/api/kb-test',
};
