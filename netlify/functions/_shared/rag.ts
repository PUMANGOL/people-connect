import { sql } from './db';
import { embed, toVectorLiteral } from './embeddings';
import { nvidia, NVIDIA_CONFIG } from './nvidia-client';

/**
 * Pipeline RAG (Retrieval-Augmented Generation).
 *
 * 1. Embedding da pergunta (bge-m3)
 * 2. Top-K chunks por similaridade cosine em pgvector
 * 3. Se score < 0.75 → escalação automática para DPC
 * 4. Prompt LLM (DeepSeek v4 Flash) com system prompt estrito
 * 5. Devolve resposta + reasoning + citações + tokens
 */

interface RetrievedChunk {
  id: string;
  conteudo: string;
  score: number;
  documento_titulo: string;
  documento_id: string;
  pagina: number | null;
}

export async function retrieveTopK(query: string, k = NVIDIA_CONFIG.topK): Promise<RetrievedChunk[]> {
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
    WHERE d.estado = 'indexado'
    ORDER BY c.embedding <=> ${embLiteral}::vector
    LIMIT ${k}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    conteudo: r.conteudo as string,
    score: Number(r.score),
    documento_titulo: r.documento_titulo as string,
    documento_id: r.documento_id as string,
    pagina: r.pagina ? Number(r.pagina) : null,
  }));
}

const SYSTEM_PROMPT = `És o assistente virtual da Pumangol, Direcção de Pessoas e Culturas (DPC).
Respondes em português angolano formal mas acessível.

REGRAS ESTRITAS:
1. Responde APENAS com base no CONTEXTO fornecido.
2. Se o contexto não tem a informação, diz "Vou escalar esta questão para a DPC" e nada mais.
3. NÃO escrevas [Fonte: …] no texto — as fontes são apresentadas pela UI.
4. Nunca inventes informação sobre salários, contratos ou dados pessoais.
5. Não dês conselhos legais, médicos ou financeiros — sugere consultar a DPC.
6. Sê conciso: máximo 3 parágrafos curtos.`;

export interface RagFonte {
  titulo: string;
  pagina: number | null;
  documento_id: string;
  score: number;
}

export interface RagResult {
  resposta: string;
  reasoning?: string;
  chunks_utilizados: string[];
  score_medio: number;
  precisa_escalar: boolean;
  fontes: RagFonte[];
  tokens_input: number;
  tokens_output: number;
  modelo: string;
}

const FALLBACK_MSG = 'Não encontrei informação suficiente sobre a sua pergunta na base de conhecimento. Vou escalar esta questão para a equipa da DPC, que responderá por email em breve. Também pode contactar directamente dpc@pumangol.ao.';

export async function ragQuery(pergunta: string): Promise<RagResult> {
  // Passo 1-2: retrieve
  const chunks = await retrieveTopK(pergunta);
  const topScore = chunks[0]?.score ?? 0;

  // Passo 3: escalação automática
  if (topScore < NVIDIA_CONFIG.minRelevanceScore) {
    return {
      resposta: FALLBACK_MSG,
      chunks_utilizados: [],
      score_medio: topScore,
      precisa_escalar: true,
      fontes: [],
      tokens_input: 0,
      tokens_output: 0,
      modelo: NVIDIA_CONFIG.chatModel,
    };
  }

  // Passo 4: construir prompt + chamar DeepSeek
  const contexto = chunks
    .map((c, i) => `[${i + 1}] (Fonte: ${c.documento_titulo}${c.pagina ? ', p.' + c.pagina : ''})\n${c.conteudo}`)
    .join('\n\n---\n\n');

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `CONTEXTO:\n${contexto}\n\nPERGUNTA: ${pergunta}` },
  ];

  // Parâmetros extra NVIDIA/DeepSeek não estão no tipo OpenAI SDK.
  // Fazer cast para any para permitir chat_template_kwargs.
  const params = {
    model: NVIDIA_CONFIG.chatModel,
    messages,
    temperature: NVIDIA_CONFIG.temperature,
    top_p: NVIDIA_CONFIG.topP,
    max_tokens: NVIDIA_CONFIG.maxTokens,
    stream: false,
    chat_template_kwargs: {
      thinking: true,
      reasoning_effort: NVIDIA_CONFIG.reasoningEffort,
    },
  };

  const completion = await nvidia.chat.completions.create(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  const msg = completion.choices[0].message as {
    content?: string | null;
    reasoning?: string;
    reasoning_content?: string;
  };

  const reasoning = msg.reasoning ?? msg.reasoning_content;

  return {
    resposta: msg.content ?? '',
    reasoning,
    chunks_utilizados: chunks.map((c) => c.id),
    score_medio: chunks.reduce((s, c) => s + c.score, 0) / chunks.length,
    precisa_escalar: false,
    fontes: chunks.map((c) => ({
      titulo: c.documento_titulo,
      pagina: c.pagina,
      documento_id: c.documento_id,
      score: c.score,
    })),
    tokens_input: completion.usage?.prompt_tokens ?? 0,
    tokens_output: completion.usage?.completion_tokens ?? 0,
    modelo: NVIDIA_CONFIG.chatModel,
  };
}
