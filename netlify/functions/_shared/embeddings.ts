import type OpenAI from 'openai';
import { getNvidiaClient, NVIDIA_CONFIG } from './nvidia-client';

/**
 * Embeddings via NVIDIA (baai/bge-m3, 1024 dims, multilingual).
 *
 * bge-m3 aceita input_type:
 *   - 'query'   → para perguntas de utilizador (retrieval)
 *   - 'passage' → para chunks indexados na KB
 */

interface NvidiaEmbeddingParams {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  input_type?: 'query' | 'passage';
  truncate?: 'NONE' | 'START' | 'END';
}

async function callEmbeddings(params: NvidiaEmbeddingParams): Promise<number[][]> {
  const client = getNvidiaClient();
  const res = await client.embeddings.create(
    params as unknown as Parameters<OpenAI['embeddings']['create']>[0]
  );
  return res.data.map((d) => d.embedding as unknown as number[]);
}

/** Embedding de uma pergunta de utilizador (para retrieval). */
export async function embed(text: string): Promise<number[]> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 4000);
  const embeddings = await callEmbeddings({
    model: NVIDIA_CONFIG.embedModel,
    input: clean,
    encoding_format: 'float',
    input_type: 'query',
    truncate: 'END',
  });
  return embeddings[0];
}

/** Embeddings em batch para chunks de documentos (indexação). */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  const clean = texts.map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 8000));
  return callEmbeddings({
    model: NVIDIA_CONFIG.embedModel,
    input: clean,
    encoding_format: 'float',
    input_type: 'passage',
    truncate: 'END',
  });
}

/** Converte um vector JS array num literal SQL para pgvector. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
