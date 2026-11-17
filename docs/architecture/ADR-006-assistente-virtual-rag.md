# ADR-006 · Assistente Virtual RAG — Arquitectura Completa (NVIDIA)

**Data:** 2026-07-15
**Estado:** Proposto
**Contexto:** Substituir o chatbot actual (mock/FAQ simples) por um Assistente Virtual empresarial com RAG (Retrieval-Augmented Generation), gestão de base de conhecimento pela DPC, upload de PDF/DOCX, citações de fonte e escalonamento.

**Provider LLM escolhido:** NVIDIA NIM API (`integrate.api.nvidia.com/v1`) — API OpenAI-compatible.

---

## Visão Geral

```
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐
│  Novo       │    │  Netlify         │    │  Neon Postgres │
│  Colaborador│───►│  Functions       │───►│  + pgvector    │
│  (React)    │    │  (RAG endpoint)  │    │  (KB + chunks) │
└─────────────┘    └────────┬─────────┘    └────────────────┘
                            │
                            ▼
                   ┌──────────────────────┐
                   │  NVIDIA NIM API      │
                   │  integrate.api.      │
                   │  nvidia.com/v1       │
                   │                      │
                   │  • DeepSeek v4 Flash │
                   │  • BAAI BGE-M3       │
                   │    (embeddings PT)   │
                   └──────────────────────┘
```

### Escala prevista
- 600 colaboradores
- ~50-200 documentos KB (políticas, manuais, procedimentos)
- ~3.000-6.000 mensagens/mês (5-10 perguntas/colaborador)

---

## Escolha de Modelos NVIDIA

### Chat/Reasoning (LLM principal)
**`deepseek-ai/deepseek-v4-flash`** — modelo já em uso pelo utilizador.

Vantagens:
- Suporta `reasoning_content` (chain-of-thought) via `chat_template_kwargs.thinking: true` — útil para respostas mais precisas em perguntas complexas de RH
- Context window grande (~128k tokens) — suporta muito contexto de chunks
- Multilingual (bom PT)
- Latência baixa (variante "flash")
- OpenAI-compatible API

### Embeddings (vectorização)
**Recomendação: `baai/bge-m3`** (1024 dims)

Comparação dos modelos de embeddings disponíveis na NVIDIA:

| Modelo | Dims | Multilingual | Recomendação |
|---|---|---|---|
| `nvidia/nv-embedqa-e5-v5` | 1024 | Parcial (EN forte) | ⚠️ menos ideal para PT |
| `nvidia/llama-3.2-nv-embedqa-1b-v2` | 2048 | Sim | ✓ alternativa NVIDIA-nativa |
| `baai/bge-m3` | **1024** | **Sim (100+ idiomas)** | **✅ RECOMENDADO — melhor para PT-AO** |
| `nvidia/nv-embed-v1` | 4096 | Sim | ⚠️ 4x mais storage/compute, ganho marginal |
| `nvidia/nv-embedqa-mistral-7b-v2` | 4096 | Sim | ⚠️ excelente qualidade mas caro |

**Justificação do bge-m3:**
- Treinado explicitamente em 100+ idiomas (Português incluído no core training set)
- Top rank consistente no MTEB multilingual leaderboard
- 1024 dims = boa qualidade + storage/query performance óptimo em pgvector
- Disponível na NVIDIA API catalog
- Suporta dense + sparse + colbert retrieval (só usamos dense por agora, mas dá margem de evolução)

**Impacto no schema:** `vector(1024)` em vez de `vector(1536)`.

---

### Custo estimado (mensal)

| Componente | Detalhe | Custo |
|---|---|---|
| Neon Launch | 3GB storage + 190 compute hours | **$0-19** |
| pgvector | Extensão gratuita | **$0** |
| NVIDIA API — DeepSeek v4 Flash | ~6M tokens/mês (chat) | **Ver notas ▼** |
| NVIDIA API — BGE-M3 | ~500k tokens/mês (embeddings) | **Ver notas ▼** |
| Netlify (functions + hosting) | Free tier | **$0** |
| **Total (estimativa)** | | **~$0-30/mês** |

**Notas sobre pricing NVIDIA:**
- A NVIDIA API catalog oferece **créditos gratuitos** para avaliação (variam por conta) — cobre facilmente o MVP
- Em produção, o pricing depende da conta (Enterprise vs Developer). Não há tabela pública fixa como a OpenAI
- Alternativas para produção:
  - **NVIDIA DGX Cloud / NIM microservices** — self-hosted no cloud, custo fixo por hora GPU
  - **Continuar com API catalog** com créditos pagos
- Para 600 colaboradores com uso moderado, os créditos free tier + eventuais recargas devem manter o custo **< $30/mês**

---

## 1. Modelo de Dados

### Nova migração `db/migrations/006_kb_rag.sql`

```sql
-- Habilitar pgvector (extensão nativa da Neon)
CREATE EXTENSION IF NOT EXISTS vector;

-- === Documentos da Base de Conhecimento ===
CREATE TABLE kb_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(500) NOT NULL,
  descricao TEXT,
  categoria categoria_faq NOT NULL DEFAULT 'processos',
  direccao VARCHAR(100) NOT NULL,
  tipo_ficheiro VARCHAR(20), -- 'pdf', 'docx', 'manual'
  ficheiro_url TEXT, -- storage path (Netlify Blobs ou S3 futuro)
  ficheiro_hash VARCHAR(64), -- SHA-256 para dedup
  tamanho_bytes INT,
  criado_por UUID REFERENCES utilizadores(id),
  estado VARCHAR(30) DEFAULT 'processando', -- processando|indexado|falha|arquivado
  erro_processamento TEXT,
  chunks_total INT DEFAULT 0,
  embedding_model VARCHAR(100) DEFAULT 'baai/bge-m3', -- rastreabilidade
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === Chunks vectorizados ===
-- ⚠️ DIMENSÃO 1024 (bge-m3), não 1536 (OpenAI)
CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES kb_documentos(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  conteudo TEXT NOT NULL,
  tokens INT,
  embedding vector(1024), -- bge-m3 dimension
  metadata JSONB DEFAULT '{}'::jsonb, -- {pagina, secao, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice HNSW para pesquisa por similaridade cosine
CREATE INDEX kb_chunks_embedding_idx
  ON kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX kb_chunks_documento_idx ON kb_chunks(documento_id);

-- === Sessões de Conversa ===
CREATE TABLE chat_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilizador_id UUID REFERENCES utilizadores(id),
  colaborador_id UUID REFERENCES colaboradores(id),
  titulo VARCHAR(200),
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_actividade TIMESTAMPTZ DEFAULT NOW(),
  arquivada BOOLEAN DEFAULT false
);
CREATE INDEX chat_sessoes_utilizador_idx ON chat_sessoes(utilizador_id, ultima_actividade DESC);

-- === Mensagens da Conversa ===
CREATE TABLE chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES chat_sessoes(id) ON DELETE CASCADE,
  papel VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  conteudo TEXT NOT NULL,
  reasoning TEXT, -- reasoning_content do DeepSeek (chain-of-thought) — opcional para debug
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  latencia_ms INT,
  modelo VARCHAR(100), -- 'deepseek-ai/deepseek-v4-flash'
  chunks_utilizados UUID[] DEFAULT '{}',
  score_relevancia REAL,
  satisfacao SMALLINT, -- -1 | null | 1
  feedback_texto TEXT,
  escalada_para_dpc BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chat_mensagens_sessao_idx ON chat_mensagens(sessao_id, created_at);
CREATE INDEX chat_mensagens_escaladas_idx ON chat_mensagens(escalada_para_dpc) WHERE escalada_para_dpc = true;

-- === Escalonamentos DPC ===
CREATE TABLE escalacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES chat_mensagens(id),
  sessao_id UUID NOT NULL REFERENCES chat_sessoes(id),
  utilizador_id UUID REFERENCES utilizadores(id),
  pergunta TEXT NOT NULL,
  contexto TEXT,
  estado VARCHAR(30) DEFAULT 'pendente',
  atribuido_a UUID REFERENCES utilizadores(id),
  resposta_dpc TEXT,
  respondida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX escalacoes_estado_idx ON escalacoes(estado, criado_em DESC);

-- === Analytics ===
CREATE MATERIALIZED VIEW kb_analytics AS
SELECT
  DATE_TRUNC('day', m.created_at) AS dia,
  COUNT(*) FILTER (WHERE m.papel = 'user') AS perguntas,
  COUNT(*) FILTER (WHERE m.escalada_para_dpc) AS escalacoes,
  AVG(m.score_relevancia) FILTER (WHERE m.papel = 'assistant') AS relevancia_media,
  AVG(m.latencia_ms) FILTER (WHERE m.papel = 'assistant') AS latencia_media_ms,
  AVG(m.satisfacao)::REAL AS satisfacao_media,
  SUM(m.tokens_input + m.tokens_output) AS tokens_total
FROM chat_mensagens m
WHERE m.created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', m.created_at);

CREATE UNIQUE INDEX kb_analytics_dia_idx ON kb_analytics(dia);
```

---

## 2. Fluxo RAG

```
Utilizador envia pergunta
        │
        ▼
1. Guardar user message em chat_mensagens
        │
        ▼
2. Gerar embedding com bge-m3 (NVIDIA API)
        │
        ▼
3. SELECT top 5 chunks (similaridade cosine em pgvector)
        │
        ▼
4. Se score max < 0.75 → escalação para DPC
        │
        ▼
5. Construir prompt (system + contexto + pergunta)
        │
        ▼
6. Chamar DeepSeek v4 Flash com reasoning=true
        │
        ▼
7. Guardar assistant message + reasoning + chunks + tokens
        │
        ▼
8. Devolver resposta com citações
```

**Configuração recomendada:**
- Chunk size: **500 tokens**, overlap 50
- Embeddings: **baai/bge-m3** (1024 dims)
- Chat: **deepseek-ai/deepseek-v4-flash** com `thinking=true` + `reasoning_effort=medium` (medium em vez de high para reduzir latência/tokens no MVP)
- Top-K: **5 chunks**
- Threshold escalação: similaridade **< 0.75**
- Temperature: **0.2** (respostas consistentes)

---

## 3. Arquitectura de Pastas

```
netlify/functions/
  _shared/
    db.ts                      # existe
    nvidia-client.ts           # NEW — wrapper OpenAI SDK apontando p/ NVIDIA
    embeddings.ts              # NEW — embed() + embedBatch() usando bge-m3
    chunker.ts                 # NEW
    pdf-parser.ts              # NEW — pdf-parse
    docx-parser.ts             # NEW — mammoth
    rag.ts                     # NEW — pipeline RAG com DeepSeek
    auth.ts                    # NEW — validar JWT MSAL
  kb-documentos.ts             # NEW — CRUD documentos
  kb-upload.ts                 # NEW — POST upload PDF/DOCX
  kb-reindex.ts                # NEW
  chat-sessoes.ts              # NEW
  chat-mensagens.ts            # NEW — POST mensagem (dispara RAG)
  chat-history.ts              # NEW

src/
  services/
    ai-provider.ts             # existe — adicionar NvidiaRagProvider
  pages/
    assistente/
      ChatPage.tsx             # rewrite
      MinhasSessoesPage.tsx    # NEW
    admin/
      KbDocumentosPage.tsx     # NEW
      KbDocumentoDetailPage.tsx # NEW
```

---

## 4. Endpoints REST

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/api/kb-upload` | rh_admin | Upload PDF/DOCX |
| GET | `/api/kb-documentos` | rh_admin | Listar docs |
| GET | `/api/kb-documentos/:id` | rh_admin | Detalhe |
| PATCH | `/api/kb-documentos/:id` | rh_admin | Actualizar/arquivar |
| DELETE | `/api/kb-documentos/:id` | rh_admin | Apagar + chunks |
| POST | `/api/kb-reindex/:id` | rh_admin | Re-processar |
| POST | `/api/chat-mensagens` | qualquer autenticado | Enviar pergunta (RAG) |
| GET | `/api/chat-sessoes` | próprio autenticado | Minhas sessões |
| GET | `/api/chat-sessoes/:id/mensagens` | próprio+admin | Histórico |
| POST | `/api/chat-mensagens/:id/feedback` | próprio | 👍/👎 |
| GET | `/api/escalacoes` | rh_admin | Listar |
| PATCH | `/api/escalacoes/:id/responder` | rh_admin | Responder + opcional "add à KB" |

---

## 5. Exemplos de Código (NVIDIA)

### 5.1 Cliente NVIDIA (reutilizável em todas as functions)

```typescript
// netlify/functions/_shared/nvidia-client.ts
import OpenAI from 'openai';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

if (!NVIDIA_API_KEY) {
  console.warn('NVIDIA_API_KEY not set — RAG functions will fail');
}

export const nvidia = new OpenAI({
  apiKey: NVIDIA_API_KEY ?? 'missing',
  baseURL: NVIDIA_BASE_URL,
});

// Configurações centralizadas
export const NVIDIA_CONFIG = {
  chatModel: 'deepseek-ai/deepseek-v4-flash',
  embedModel: 'baai/bge-m3',
  embedDimensions: 1024,
  maxTokens: 800, // resposta máxima
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  minRelevanceScore: 0.75,
};
```

### 5.2 Embeddings via NVIDIA (bge-m3)

```typescript
// netlify/functions/_shared/embeddings.ts
import { nvidia, NVIDIA_CONFIG } from './nvidia-client';

export async function embed(text: string): Promise<number[]> {
  const res = await nvidia.embeddings.create({
    model: NVIDIA_CONFIG.embedModel,
    input: text,
    // bge-m3 na NVIDIA aceita input_type para optimizar query vs passage
    // @ts-expect-error — extensão NVIDIA à API OpenAI
    input_type: 'query',
    encoding_format: 'float',
  });
  return res.data[0].embedding as number[];
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  // Ao indexar documentos, usar input_type='passage'
  const res = await nvidia.embeddings.create({
    model: NVIDIA_CONFIG.embedModel,
    input: texts,
    // @ts-expect-error
    input_type: 'passage',
    encoding_format: 'float',
  });
  return res.data.map((d) => d.embedding as number[]);
}
```

**Nota:** o `bge-m3` na NVIDIA aceita `input_type` como parâmetro adicional — `'query'` para perguntas de utilizador (retrieval) e `'passage'` para documentos indexados. Isto **melhora significativamente a qualidade** vs usar o mesmo tipo para ambos.

### 5.3 Chunker (idêntico)

```typescript
// netlify/functions/_shared/chunker.ts
import { NVIDIA_CONFIG } from './nvidia-client';

const AVG_CHARS_PER_TOKEN = 4;

export interface Chunk {
  ordem: number;
  conteudo: string;
  tokens: number;
  metadata: { pagina?: number; secao?: string };
}

export function chunkText(text: string, opts?: { pagina?: number }): Chunk[] {
  const chunkSize = NVIDIA_CONFIG.chunkSize * AVG_CHARS_PER_TOKEN;
  const overlap = NVIDIA_CONFIG.chunkOverlap * AVG_CHARS_PER_TOKEN;
  const chunks: Chunk[] = [];
  let start = 0;
  let ordem = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastSpace = text.lastIndexOf(' ', end);
      end = Math.max(lastPeriod, lastSpace);
    }
    const conteudo = text.substring(start, end).trim();
    if (conteudo.length > 50) {
      chunks.push({
        ordem: ordem++,
        conteudo,
        tokens: Math.ceil(conteudo.length / AVG_CHARS_PER_TOKEN),
        metadata: { pagina: opts?.pagina },
      });
    }
    start = end - overlap;
  }
  return chunks;
}
```

### 5.4 Pipeline RAG com DeepSeek v4 Flash

```typescript
// netlify/functions/_shared/rag.ts
import { sql } from './db';
import { embed } from './embeddings';
import { nvidia, NVIDIA_CONFIG } from './nvidia-client';

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
  const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

  const rows = await sql`
    SELECT
      c.id,
      c.conteudo,
      c.metadata->>'pagina' as pagina,
      d.titulo as documento_titulo,
      d.id as documento_id,
      1 - (c.embedding <=> ${embeddingLiteral}::vector) as score
    FROM kb_chunks c
    JOIN kb_documentos d ON d.id = c.documento_id
    WHERE d.estado = 'indexado'
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
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
3. Cita SEMPRE a fonte no formato [Fonte: {título}, p.{página}] no final de cada afirmação factual.
4. Nunca inventes informação sobre salários, contratos ou dados pessoais.
5. Não dês conselhos legais, médicos ou financeiros — sugere consultar a DPC.
6. Sê conciso: máximo 3 parágrafos curtos.`;

export interface RagResult {
  resposta: string;
  reasoning?: string;
  chunks_utilizados: string[];
  score_medio: number;
  precisa_escalar: boolean;
  fontes: { titulo: string; pagina: number | null; documento_id: string }[];
  tokens_input: number;
  tokens_output: number;
}

export async function ragQuery(pergunta: string): Promise<RagResult> {
  const chunks = await retrieveTopK(pergunta);
  const topScore = chunks[0]?.score ?? 0;

  // Escalação automática se relevância baixa
  if (topScore < NVIDIA_CONFIG.minRelevanceScore) {
    return {
      resposta: 'Não encontrei informação suficiente sobre a sua pergunta na base de conhecimento. Vou escalar esta questão para a equipa da DPC, que responderá por email em breve. Também pode contactar directamente dpc@pumangol.ao.',
      chunks_utilizados: [],
      score_medio: topScore,
      precisa_escalar: true,
      fontes: [],
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  const contexto = chunks
    .map((c, i) => `[${i + 1}] (Fonte: ${c.documento_titulo}${c.pagina ? ', p.' + c.pagina : ''})\n${c.conteudo}`)
    .join('\n\n---\n\n');

  const completion = await nvidia.chat.completions.create({
    model: NVIDIA_CONFIG.chatModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `CONTEXTO:\n${contexto}\n\nPERGUNTA: ${pergunta}` },
    ],
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: NVIDIA_CONFIG.maxTokens,
    // @ts-expect-error — extensão NVIDIA DeepSeek para reasoning
    chat_template_kwargs: { thinking: true, reasoning_effort: 'medium' },
    stream: false,
  });

  const msg = completion.choices[0].message;
  const reasoning = (msg as { reasoning?: string; reasoning_content?: string }).reasoning
    ?? (msg as { reasoning_content?: string }).reasoning_content;

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
    })),
    tokens_input: completion.usage?.prompt_tokens ?? 0,
    tokens_output: completion.usage?.completion_tokens ?? 0,
  };
}
```

### 5.5 Upload endpoint (usa `embedPassages`)

```typescript
// netlify/functions/kb-upload.ts
import type { Config } from '@netlify/functions';
import { sql, jsonResponse, errorResponse } from './_shared/db';
import { chunkText } from './_shared/chunker';
import { embedPassages } from './_shared/embeddings';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const titulo = formData.get('titulo') as string;
    const categoria = (formData.get('categoria') as string) ?? 'processos';
    const direccao = formData.get('direccao') as string;
    const criadoPor = formData.get('criado_por') as string;

    if (!file || !titulo) return errorResponse('Ficheiro e título obrigatórios', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const tipoFicheiro = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';

    const doc = await sql`
      INSERT INTO kb_documentos (titulo, categoria, direccao, tipo_ficheiro, tamanho_bytes, criado_por, estado, embedding_model)
      VALUES (${titulo}, ${categoria}::categoria_faq, ${direccao}, ${tipoFicheiro}, ${buffer.length}, ${criadoPor}, 'processando', 'baai/bge-m3')
      RETURNING id
    `;
    const documentoId = doc[0].id;

    try {
      let text: string;
      if (tipoFicheiro === 'pdf') {
        const parsed = await pdf(buffer);
        text = parsed.text;
      } else {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      }

      const chunks = chunkText(text);

      // Embed em batch (NVIDIA aceita arrays)
      const BATCH_SIZE = 32; // ajuste conservador para bge-m3
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddings = await embedPassages(batch.map((c) => c.conteudo));

        for (let j = 0; j < batch.length; j++) {
          const c = batch[j];
          const embLiteral = `[${embeddings[j].join(',')}]`;
          await sql`
            INSERT INTO kb_chunks (documento_id, ordem, conteudo, tokens, embedding, metadata)
            VALUES (${documentoId}, ${c.ordem}, ${c.conteudo}, ${c.tokens}, ${embLiteral}::vector, ${JSON.stringify(c.metadata)}::jsonb)
          `;
        }
      }

      await sql`
        UPDATE kb_documentos
        SET estado = 'indexado', chunks_total = ${chunks.length}, updated_at = NOW()
        WHERE id = ${documentoId}
      `;

      return jsonResponse({ data: { id: documentoId, chunks: chunks.length } }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no processamento';
      await sql`UPDATE kb_documentos SET estado = 'falha', erro_processamento = ${msg} WHERE id = ${documentoId}`;
      throw err;
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Erro', 500);
  }
};

export const config: Config = { path: '/api/kb-upload' };
```

### 5.6 Chat endpoint

```typescript
// netlify/functions/chat-mensagens.ts
import type { Config } from '@netlify/functions';
import { sql, jsonResponse, errorResponse, handleCors } from './_shared/db';
import { ragQuery } from './_shared/rag';
import { NVIDIA_CONFIG } from './_shared/nvidia-client';

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const { sessao_id, utilizador_id, pergunta } = await req.json();

    if (!pergunta) return errorResponse('Pergunta obrigatória', 400);

    let sessaoId = sessao_id;
    if (!sessaoId) {
      const nova = await sql`
        INSERT INTO chat_sessoes (utilizador_id, titulo)
        VALUES (${utilizador_id}, ${pergunta.slice(0, 100)})
        RETURNING id
      `;
      sessaoId = nova[0].id;
    }

    await sql`
      INSERT INTO chat_mensagens (sessao_id, papel, conteudo)
      VALUES (${sessaoId}, 'user', ${pergunta})
    `;

    const t0 = Date.now();
    const result = await ragQuery(pergunta);
    const latencia = Date.now() - t0;

    const assistant = await sql`
      INSERT INTO chat_mensagens (
        sessao_id, papel, conteudo, reasoning,
        tokens_input, tokens_output, latencia_ms, modelo,
        chunks_utilizados, score_relevancia, escalada_para_dpc
      )
      VALUES (
        ${sessaoId}, 'assistant', ${result.resposta}, ${result.reasoning ?? null},
        ${result.tokens_input}, ${result.tokens_output}, ${latencia}, ${NVIDIA_CONFIG.chatModel},
        ${result.chunks_utilizados}, ${result.score_medio}, ${result.precisa_escalar}
      )
      RETURNING id
    `;

    if (result.precisa_escalar) {
      await sql`
        INSERT INTO escalacoes (mensagem_id, sessao_id, utilizador_id, pergunta)
        VALUES (${assistant[0].id}, ${sessaoId}, ${utilizador_id}, ${pergunta})
      `;
    }

    await sql`UPDATE chat_sessoes SET ultima_actividade = NOW() WHERE id = ${sessaoId}`;

    return jsonResponse({
      data: {
        sessao_id: sessaoId,
        mensagem_id: assistant[0].id,
        resposta: result.resposta,
        fontes: result.fontes,
        precisa_escalar: result.precisa_escalar,
        latencia_ms: latencia,
      },
    });
  } catch (err) {
    console.error('chat-mensagens error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Erro', 500);
  }
};

export const config: Config = { path: '/api/chat-mensagens' };
```

---

## 6. Variáveis de Ambiente

### Netlify (backend only — **sem prefixo VITE_**)

```
NVIDIA_API_KEY=nvapi-<a tua nova key regenerada>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-v4-flash
NVIDIA_EMBED_MODEL=baai/bge-m3
DATABASE_URL=postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require
```

### `.env.example` (repositório)

```
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-v4-flash
NVIDIA_EMBED_MODEL=baai/bge-m3
```

**⚠️ NUNCA usar prefixo `VITE_` para a API key** — isso expõe a chave no bundle JavaScript enviado ao browser.

---

## 7. Segurança e Boas Práticas

1. **API key só em Netlify env vars** — nunca em código, nunca em `VITE_*`
2. **Rate limiting**: 20 req/min por utilizador (evita esgotar créditos NVIDIA)
3. **Auth server-side** obrigatório em `/api/kb-*` (só rh_admin) e `/api/chat-*` (autenticado)
4. **PII protection**: system prompt proíbe salários, contratos, dados pessoais
5. **Dedup SHA-256**: evita indexar o mesmo doc 2x e desperdiçar tokens
6. **Encriptação Neon**: `sslmode=require` obrigatório
7. **Logs de auditoria** de uploads e escalações em `audit_log`

---

## 8. Optimizações de Custo

Como o pricing NVIDIA depende de créditos, optimizações críticas:

1. **Batch embeddings** (32 chunks/chamada, não 1)
2. **Cache de embeddings de perguntas frequentes** — se a mesma pergunta é feita 10x/dia, embed 1x
3. **`reasoning_effort=medium` em vez de `high`** — economia de tokens
4. **`max_tokens=800`** para respostas (não 16384 do exemplo)
5. **Limitar histórico enviado ao LLM** a 5 últimas mensagens (não a sessão inteira)
6. **Dashboard de custo** — coluna `tokens_input + tokens_output` em `chat_mensagens` permite calcular gasto diário
7. **Alerta se tokens_total/dia > threshold** (ex: 500k)

---

## 9. Vantagens NVIDIA vs OpenAI para este projecto

| Aspecto | NVIDIA (DeepSeek + BGE-M3) | OpenAI (gpt-4o-mini + emb-3-small) |
|---|---|---|
| Já tenho chave | ✅ Sim | ❌ Não |
| Português (bge-m3 vs emb-3-small) | ✅ Nativo 100+ idiomas | ⚠️ EN-first |
| Reasoning explícito | ✅ DeepSeek `thinking=true` | ⚠️ Só `o1` (caro) |
| API compatibility | ✅ OpenAI SDK | ✅ Nativo |
| Custo previsível | ⚠️ Depende dos créditos | ✅ Pay-per-token claro |
| Ecossistema | Modelos NVIDIA + community | Modelos OpenAI |
| Latência | ⚠️ Depende do endpoint | ✅ Baixa consistente |

**Trade-off aceitável:** para o projecto Pumangol (600 users, PT-AO), NVIDIA + bge-m3 dá **melhor qualidade em português** com o custo já coberto pelos créditos existentes.

---

## 10. Alternativa "sem custo variável" (futuro)

Se o custo NVIDIA escalar, migrar para **NVIDIA NIM microservices self-hosted**:
- DeepSeek v4 Flash como container Docker no cluster GPU Pumangol (ou Azure VM com GPU)
- BGE-M3 como container separado
- Custo: fixo por hora de GPU (~$1-2/h para T4, ~$4/h para A100)
- Vantagem: dados nunca saem da infra Pumangol (compliance máximo)

O código do frontend **não muda** — só se altera `NVIDIA_BASE_URL` para o endpoint interno.

---

## 11. Plano de Implementação

Ver `docs/stories/EPIC-11-assistente-rag.md` (já actualizado para NVIDIA).

| Story | Descrição | Esforço |
|---|---|---|
| S-110 | Migração pgvector + tabelas (dim 1024) | S (2pt) |
| S-111 | NVIDIA client + embeddings + RAG pipeline | M (3pt) |
| S-112 | Upload PDF/DOCX + indexação | M (3pt) |
| S-113 | KbDocumentosPage admin | M (3pt) |
| S-114 | Chat RAG-aware com reasoning display | L (5pt) |
| S-115 | Histórico de conversas | S (2pt) |
| S-116 | Escalonamentos v2 | M (3pt) |
| S-117 | Dashboard KB analytics | S (2pt) |

---

## Decisão

Aprovar arquitectura RAG com **NVIDIA NIM API**:
- **Chat**: `deepseek-ai/deepseek-v4-flash` (reasoning-enabled)
- **Embeddings**: `baai/bge-m3` (1024 dims, multilingual PT)
- **DB**: Neon + pgvector (já existe)
- **Backend**: Netlify Functions (co-deploy)
- **Interface AIProvider mantém-se** — troca de provider transparente

Custo mensal estimado: **$0-30/mês** (dependente dos créditos NVIDIA + Neon tier).
