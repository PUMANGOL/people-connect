# EPIC-11 · Assistente Virtual RAG (Base de Conhecimento + Chat Inteligente)

**Objectivo:** Substituir o chatbot mock por um assistente virtual empresarial com RAG (pgvector + NVIDIA API), gestão de KB pela DPC, upload de PDF/DOCX, citações de fonte e escalonamento inteligente.

**Provider:** NVIDIA NIM API (`integrate.api.nvidia.com/v1`) — `deepseek-ai/deepseek-v4-flash` (chat) + `baai/bge-m3` (embeddings, 1024 dims, multilingual PT).
**Prioridade:** MVP+ — depende do EPIC-10 estar deployado
**Sprint:** Sprint 5-6
**Ver:** `docs/architecture/ADR-006-assistente-virtual-rag.md`

---

## S-110 · Migração pgvector + Tabelas KB/Chat

**Esforço:** S (2 pt)
**Dependências:** —

### User Story
Como developer, quero as estruturas de dados prontas na Neon DB para suportar RAG (chunks vectorizados, sessões, mensagens, escalonamentos v2).

### Critérios de Aceitação
- [ ] Executar `CREATE EXTENSION IF NOT EXISTS vector;` na Neon
- [ ] Migração `db/migrations/006_kb_rag.sql` com:
  - `kb_documentos` (metadata + estado + embedding_model)
  - `kb_chunks` com coluna `embedding vector(1024)` (bge-m3) + índice HNSW
  - `chat_sessoes`
  - `chat_mensagens` (com `chunks_utilizados` para auditoria)
  - `escalacoes` (evolução do actual)
  - Materialized view `kb_analytics`
- [ ] Testar SELECT com similaridade cosine: `SELECT id, 1 - (embedding <=> '[...]'::vector) as score FROM kb_chunks ORDER BY embedding <=> '[...]'::vector LIMIT 5`
- [ ] Documentar comando de refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY kb_analytics`

---

## S-111 · Netlify Functions: NVIDIA Client + Embeddings + RAG Pipeline

**Esforço:** M (3 pt)
**Dependências:** S-110

### User Story
Como developer, quero utilitários partilhados para gerar embeddings via NVIDIA bge-m3, dividir texto em chunks e executar o pipeline RAG completo com DeepSeek v4 Flash.

### Critérios de Aceitação
- [ ] `npm install openai` (SDK OpenAI compatível com NVIDIA API)
- [ ] `netlify/functions/_shared/nvidia-client.ts` — cliente OpenAI apontando para `integrate.api.nvidia.com/v1`, config centralizada
- [ ] `netlify/functions/_shared/embeddings.ts` com `embed(text)` (input_type=query) e `embedPassages(texts[])` (input_type=passage)
- [ ] `netlify/functions/_shared/chunker.ts` com `chunkText(text, opts)` — 500 tokens, overlap 50
- [ ] `netlify/functions/_shared/rag.ts` com:
  - `retrieveTopK(query, k=5)` — pesquisa vectorial cosine em kb_chunks
  - `ragQuery(pergunta)` — pipeline (embed query → top-K → prompt → DeepSeek com `thinking=true, reasoning_effort=medium` → resposta + reasoning)
- [ ] Threshold escalação: score < 0.75 → `precisa_escalar: true`
- [ ] Env vars (Netlify): `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_CHAT_MODEL`, `NVIDIA_EMBED_MODEL` (todos SEM `VITE_`)
- [ ] Fallback: se NVIDIA falhar, devolver mensagem amigável (não quebrar UI)
- [ ] Guardar campo `reasoning` do DeepSeek na tabela `chat_mensagens` (para debug e transparência opcional)

---

## S-112 · Upload de PDF/DOCX + Indexação Automática

**Esforço:** M (3 pt)
**Dependências:** S-111

### User Story
Como RH Admin, quero fazer upload de documentos PDF ou DOCX para a Base de Conhecimento e vê-los indexados automaticamente com chunks vectorizados.

### Critérios de Aceitação
- [ ] `npm install pdf-parse mammoth` (parser PDF + DOCX)
- [ ] `netlify/functions/kb-upload.ts` recebe `multipart/form-data`:
  - Valida tipo (PDF/DOCX) e tamanho (max 10MB)
  - Calcula SHA-256 → dedup (se hash existir, devolve o doc existente)
  - Cria registo `kb_documentos` com `estado='processando'`
  - Extrai texto → chunk → embed em batch de 50 → guarda em `kb_chunks`
  - Actualiza estado para `indexado` ou `falha`
- [ ] Idempotência: reprocessar o mesmo hash não duplica chunks
- [ ] Endpoint `POST /api/kb-reindex/:id` para forçar re-processamento
- [ ] Logs de auditoria em `audit_log`
- [ ] Toast na UI: "Documento X indexado — N chunks criados"

---

## S-113 · Página Admin: Base de Conhecimento

**Esforço:** M (3 pt)
**Dependências:** S-112

### User Story
Como RH Admin, quero uma interface para gerir os documentos da Base de Conhecimento (upload, listar, reindexar, arquivar), acessível apenas a admins.

### Critérios de Aceitação
- [ ] Nova página `/base-conhecimento` (substitui a existente ou renomeia BaseConhecimentoPage.tsx)
- [ ] Tabs: **Documentos** | **FAQs manuais** (backward compat) | **Categorias & Direcções**
- [ ] Tab Documentos:
  - Botão "Adicionar Documento" abre modal com `DocumentUploader`
  - DataTable: título, tipo (PDF/DOCX), direcção, categoria, chunks, estado (badge), criado_por, data
  - Filtros: direcção, categoria, estado
  - Acções por linha: Ver detalhe, Reindexar, Arquivar, Apagar
- [ ] Página de detalhe `/base-conhecimento/documento/:id`:
  - Metadata + preview do texto extraído (primeiros 500 chars por chunk)
  - Estatísticas: nº chunks, tokens totais, custo estimado de indexação
  - Chunks com paginação
  - Botão "Testar pergunta" → chama RAG e mostra quais chunks foram retornados
- [ ] RBAC: PermissionGate `resource="base_conhecimento" action="edit"` obriga `rh_admin`
- [ ] **Sidebar Novo Colaborador NÃO tem link para /base-conhecimento** (já garantido pelo sidebar dinâmico)

---

## S-114 · Chat RAG-aware (React) — reescrever AiAssistant

**Esforço:** L (5 pt)
**Dependências:** S-111

### User Story
Como colaborador (novo ou admin), quero conversar com o assistente virtual e receber respostas baseadas em documentos oficiais Pumangol, com citações claras.

### Critérios de Aceitação
- [ ] Rewrite de `src/pages/AiAssistant.tsx` para usar novo endpoint `/api/chat-mensagens`
- [ ] Estado de sessão persistente (guarda `sessao_id` no localStorage)
- [ ] Novo componente `SourceCitation`: cartão colapsável com título doc + página + score
- [ ] Cada resposta assistant mostra:
  - Texto formatado (markdown básico)
  - "Fontes utilizadas" com 1-5 citações (`SourceCitation`)
  - Botões 👍/👎 + campo opcional de feedback
- [ ] Se `precisa_escalar: true`:
  - Mostrar banner amarelo "Vou escalar esta pergunta para a DPC"
  - Botão "Adicionar contexto extra" (opcional)
  - Toast: "A DPC responderá por email em breve"
- [ ] Streaming (se SDK OpenAI suportar via Netlify): resposta token-a-token
- [ ] Retry automático em erro de rede (max 3, backoff exponencial)
- [ ] Mobile-first: chat ocupa 100% viewport em mobile, teclado não esconde input

---

## S-115 · Histórico de Conversas

**Esforço:** S (2 pt)
**Dependências:** S-114

### User Story
Como colaborador, quero ver o histórico das minhas conversas anteriores para retomar contextos ou consultar respostas passadas.

### Critérios de Aceitação
- [ ] Nova página `/assistente/historico` (colaborador vê apenas as suas)
- [ ] Lista de sessões: título (primeiros 100 chars da 1ª pergunta), última actividade, nº mensagens, ícone se teve escalação
- [ ] Clique numa sessão → abre chat com todas as mensagens carregadas
- [ ] Endpoint `GET /api/chat-sessoes?utilizador_id=me` (filtrado no backend por JWT)
- [ ] Endpoint `GET /api/chat-sessoes/:id/mensagens`
- [ ] Botão "Arquivar sessão" (soft delete via campo `arquivada`)
- [ ] Admin pode ver histórico de qualquer utilizador (endpoint `?utilizador_id=<uuid>`)

---

## S-116 · Escalonamentos v2 + "Adicionar à KB"

**Esforço:** M (3 pt)
**Dependências:** S-114

### User Story
Como RH Admin, quero receber notificação quando o assistente escala uma pergunta, responder ao colaborador e opcionalmente transformar a minha resposta num novo documento da KB.

### Critérios de Aceitação
- [ ] Página `/assistente/escalacoes` reescrita para usar tabela `escalacoes` nova
- [ ] Notification bell no topnav destaca escalações pendentes (badge vermelho)
- [ ] Modal "Responder Escalação":
  - Contexto: pergunta original + resposta do bot + chunks utilizados (transparência)
  - Textarea para resposta da DPC
  - Checkbox "Adicionar esta resposta à Base de Conhecimento como FAQ curada"
  - Ao submeter:
    - Actualiza `escalacoes.estado='respondida'` + `resposta_dpc`
    - Envia email ao colaborador (Netlify Function chama SendGrid/Graph API — futuro)
    - Se checkbox activo: cria `kb_documentos` tipo `manual` com o texto Q+A e indexa
- [ ] Analytics: gráfico "Top escalações → oportunidades de FAQ"

---

## S-117 · Dashboard Analytics da KB

**Esforço:** S (2 pt)
**Dependências:** S-114

### User Story
Como RH Admin, quero ver métricas de uso do assistente para saber se está a resolver dúvidas e onde precisa melhorar a KB.

### Critérios de Aceitação
- [ ] Nova secção na página `/analitica` chamada "Assistente RAG"
- [ ] KPIs (últimos 30 dias):
  - Total mensagens (users + bot)
  - Taxa de resolução automática (sem escalação)
  - Latência média (ms)
  - Satisfação média (👍/👎)
  - **Custo estimado** = tokens_total × preços OpenAI
- [ ] Gráfico linha: perguntas/dia
- [ ] Top 10 perguntas frequentes (agrupamento por embedding similar)
- [ ] Top 10 documentos mais citados
- [ ] Documentos "órfãos" (0 citações em 90d — candidatos a arquivamento)
- [ ] Endpoint `GET /api/kb-analytics` (usa a materialized view)

---

## Prioridade e Ordem

**Ordem sugerida de implementação (2 sprints):**

**Sprint 5 (backend + admin):**
1. S-110 (migração)
2. S-111 (RAG pipeline)
3. S-112 (upload)
4. S-113 (admin KB page)

**Sprint 6 (frontend colaborador):**
5. S-114 (chat RAG)
6. S-115 (histórico)
7. S-116 (escalonamentos v2)
8. S-117 (analytics)

---

## Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| Custo OpenAI escala mais do que esperado | Dashboard de custo diário + alerta $30/mês |
| Latência RAG > 5s frustra utilizadores | Streaming token-a-token + spinner amigável |
| Chunks mal formatados dão respostas más | Página de "Testar pergunta" no admin p/ debugging |
| Vazamento de dados sensíveis via LLM | Curadoria manual dos docs uploaded; system prompt estrito |
| pgvector performance com muitos chunks | Índice HNSW já criado; monitorizar EXPLAIN ANALYZE |

---

## Definição de Pronto

- Utilizador novo colaborador faz login → clica "Assistente Virtual" → pergunta "Quantos dias de férias tenho?" → recebe resposta em <3s com citação do doc "Manual de Benefícios, p.12"
- Admin faz upload de "codigo-conduta.pdf" → vê estado "indexado" em <30s → pergunta ao bot valida que retorna chunks do doc
- Admin responde a uma escalação → colaborador recebe email → resposta fica na KB para futuras perguntas
- Dashboard mostra custo mensal <$25 para uso normal
