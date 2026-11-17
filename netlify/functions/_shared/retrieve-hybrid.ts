import { sql } from './db';
import { isNvidiaReady, NVIDIA_CONFIG } from './nvidia-client';
import { embed, toVectorLiteral } from './embeddings';
import type { ChatFonte } from './agent/types';

/**
 * Retrieval híbrido: dense (pgvector) + sparse (FAQs keyword).
 * Fusão RRF (Reciprocal Rank Fusion).
 * Sem NVIDIA: só path FAQ/keyword.
 */

export interface HybridHit {
  id: string;
  conteudo: string;
  score: number;
  titulo: string;
  documento_id: string;
  pagina: number | null;
  origem: 'kb' | 'faq';
  pergunta_faq?: string;
  direccao?: string;
  categoria?: string;
}

const RRF_K = 60;

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9àáâãéêíóôõúç]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 12);
}

/** Pesquisa keyword nas FAQs publicadas. */
export async function retrieveFaqs(query: string, limit = 5): Promise<HybridHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    // fallback: primeiras FAQs se query muito curta
    const rows = await sql`
      SELECT id, pergunta, resposta, direccao, categoria::text as categoria
      FROM faqs WHERE estado = 'publicada'
      ORDER BY data_actualizacao DESC LIMIT ${limit}
    `;
    return rows.map((r: Record<string, unknown>, i: number) => ({
      id: r.id as string,
      conteudo: `${r.pergunta}\n\n${r.resposta}`,
      score: 0.3 - i * 0.02,
      titulo: `FAQ · ${r.direccao}`,
      documento_id: r.id as string,
      pagina: null,
      origem: 'faq' as const,
      pergunta_faq: r.pergunta as string,
      direccao: r.direccao as string,
      categoria: r.categoria as string,
    }));
  }

  // Score simples por ocorrência de tokens em pergunta/variantes/resposta/keywords
  const rows = await sql`
    SELECT id, pergunta, resposta, direccao, categoria::text as categoria,
           variantes, palavras_chave
    FROM faqs
    WHERE estado = 'publicada'
    ORDER BY data_actualizacao DESC
    LIMIT 200
  `;

  const scored: HybridHit[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const blob = [
      r.pergunta,
      r.resposta,
      Array.isArray(r.variantes) ? (r.variantes as string[]).join(' ') : '',
      Array.isArray(r.palavras_chave) ? (r.palavras_chave as string[]).join(' ') : '',
    ]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let hits = 0;
    for (const t of tokens) {
      if (blob.includes(t)) hits += 1;
    }
    if (hits === 0) continue;

    // Boost se a pergunta FAQ contém tokens
    const perguntaNorm = String(r.pergunta ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    let qHits = 0;
    for (const t of tokens) {
      if (perguntaNorm.includes(t)) qHits += 1;
    }

    const score = Math.min(0.98, (hits / tokens.length) * 0.55 + (qHits / tokens.length) * 0.45);
    scored.push({
      id: r.id as string,
      conteudo: `${r.pergunta}\n\n${r.resposta}`,
      score,
      titulo: `FAQ · ${r.direccao} — ${r.categoria}`,
      documento_id: r.id as string,
      pagina: null,
      origem: 'faq',
      pergunta_faq: r.pergunta as string,
      direccao: r.direccao as string,
      categoria: r.categoria as string,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Dense retrieval via pgvector em kb_chunks (requer NVIDIA). */
export async function retrieveDense(query: string, k = NVIDIA_CONFIG.topK): Promise<HybridHit[]> {
  if (!isNvidiaReady()) return [];

  try {
    const queryEmbedding = await embed(query);
    const embLiteral = toVectorLiteral(queryEmbedding);

    const rows = await sql`
      SELECT
        c.id,
        c.conteudo,
        c.metadata->>'pagina' as pagina,
        d.titulo as documento_titulo,
        d.id as documento_id,
        1 - (c.embedding <=> ${embLiteral}::vector) as score
      FROM kb_chunks c
      JOIN kb_documentos d ON d.id = c.documento_id
      WHERE d.estado = 'indexado' AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embLiteral}::vector
      LIMIT ${k}
    `;

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      conteudo: r.conteudo as string,
      score: Number(r.score),
      titulo: r.documento_titulo as string,
      documento_id: r.documento_id as string,
      pagina: r.pagina ? Number(r.pagina) : null,
      origem: 'kb' as const,
    }));
  } catch (err) {
    console.error('[retrieveDense]', err);
    return [];
  }
}

/** Dense retrieval em FAQs publicadas com embedding. */
export async function retrieveFaqsDense(query: string, k = NVIDIA_CONFIG.topK): Promise<HybridHit[]> {
  if (!isNvidiaReady()) return [];

  try {
    const queryEmbedding = await embed(query);
    const embLiteral = toVectorLiteral(queryEmbedding);

    const rows = await sql`
      SELECT
        id, pergunta, resposta, direccao, categoria::text as categoria,
        1 - (embedding <=> ${embLiteral}::vector) as score
      FROM faqs
      WHERE estado = 'publicada' AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embLiteral}::vector
      LIMIT ${k}
    `;

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      conteudo: `${r.pergunta}\n\n${r.resposta}`,
      score: Number(r.score),
      titulo: `FAQ · ${r.direccao} — ${r.categoria}`,
      documento_id: r.id as string,
      pagina: null,
      origem: 'faq' as const,
      pergunta_faq: r.pergunta as string,
      direccao: r.direccao as string,
      categoria: r.categoria as string,
    }));
  } catch (err) {
    // Coluna embedding pode não existir ainda (pré-migração 008)
    console.warn('[retrieveFaqsDense]', err instanceof Error ? err.message : err);
    return [];
  }
}

/** RRF merge de duas listas ranqueadas. */
function rrfMerge(lists: HybridHit[][], topN: number): HybridHit[] {
  const scores = new Map<string, { hit: HybridHit; rrf: number }>();

  for (const list of lists) {
    list.forEach((hit, rank) => {
      const key = `${hit.origem}:${hit.id}`;
      const add = 1 / (RRF_K + rank + 1);
      const prev = scores.get(key);
      if (prev) {
        prev.rrf += add;
        // manter o score de similaridade mais alto
        if (hit.score > prev.hit.score) prev.hit = hit;
      } else {
        scores.set(key, { hit, rrf: add });
      }
    });
  }

  return [...scores.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topN)
    .map(({ hit, rrf }) => ({
      ...hit,
      // normalizar score combinado para UI (0-1)
      score: Math.min(0.99, hit.score * 0.7 + rrf * 10),
    }));
}

export async function retrieveHybrid(query: string, k = 6): Promise<HybridHit[]> {
  // Um único embed de query partilhado seria ideal; por agora parallel
  // (retrieveDense e retrieveFaqsDense cada um chama embed — trade-off latência vs simplicidade)
  const [faqsKw, dense, faqsDense] = await Promise.all([
    retrieveFaqs(query, k),
    retrieveDense(query, k),
    retrieveFaqsDense(query, k),
  ]);

  const lists = [dense, faqsDense, faqsKw].filter((l) => l.length > 0);
  if (lists.length === 0) return [];
  if (lists.length === 1) return lists[0].slice(0, k);
  return rrfMerge(lists, k);
}

export function hitsToFontes(hits: HybridHit[]): ChatFonte[] {
  // dedupe por documento/faq
  const seen = new Set<string>();
  const fontes: ChatFonte[] = [];
  for (const h of hits) {
    const key = h.documento_id;
    if (seen.has(key)) continue;
    seen.add(key);
    fontes.push({
      titulo: h.titulo,
      pagina: h.pagina,
      documento_id: h.documento_id,
      score: h.score,
      origem: h.origem,
    });
  }
  return fontes;
}

export function topScore(hits: HybridHit[]): number {
  return hits[0]?.score ?? 0;
}
