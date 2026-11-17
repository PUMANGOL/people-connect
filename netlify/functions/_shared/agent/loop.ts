import { sql } from '../db';
import { getAgentMode, getPiramydClient, PIRAMYD_CONFIG, isPiramydReady } from '../piramyd-client';
import { isNvidiaReady, getNvidiaClient, NVIDIA_CONFIG } from '../nvidia-client';
import {
  hitsToFontes,
  retrieveHybrid,
  topScore,
  type HybridHit,
} from '../retrieve-hybrid';
import {
  AGENT_TOOLS,
  executeTool,
  toolCreateEscalation,
  toolGetKbDocumentContent,
  toolListKbDocumentos,
  toolSearchKnowledge,
  looksLikeEscalationRequest,
  looksLikeKbMetaQuestion,
  looksLikeDocumentSummary,
  looksLikeDocumentStatus,
} from './tools';
import { AGENT_SYSTEM_PROMPT } from './prompts';
import { loadAgentConfig, type AgentRuntimeConfig } from './config';
import type {
  AgentContext,
  AgentPhase,
  AgentTurnResult,
  ChatFonte,
  HistoryMessage,
  UiBlock,
} from './types';
import type OpenAI from 'openai';

const MIN_SCORE_ANSWER_FALLBACK = 0.35;

function buildContextBlock(hits: HybridHit[]): string {
  if (!hits.length) return '(sem resultados na base de conhecimento)';
  return hits
    .map((h, i) => {
      const src =
        h.origem === 'faq'
          ? `FAQ ${h.direccao ?? ''} — ${h.pergunta_faq ?? h.titulo}`
          : `${h.titulo}${h.pagina ? `, p.${h.pagina}` : ''}`;
      return `[${i + 1}] (${src}, score=${h.score.toFixed(2)})\n${h.conteudo.slice(0, 900)}`;
    })
    .join('\n\n---\n\n');
}

function composeFromHits(pergunta: string, hits: HybridHit[]): {
  markdown: string;
  ui_blocks: UiBlock[];
  fontes: ChatFonte[];
} {
  const best = hits[0];
  const fontes = hitsToFontes(hits);
  const ui_blocks: UiBlock[] = [];

  const body =
    best?.origem === 'faq'
      ? best.conteudo.includes('\n\n')
        ? best.conteudo.split('\n\n').slice(1).join('\n\n').trim() || best.conteudo
        : best.conteudo
      : best
        ? best.conteudo.slice(0, 1200)
        : 'Não encontrei informação suficiente.';

  const markdown = best
    ? body
    : 'Não encontrei informação suficiente na base de conhecimento para responder a este tema. Reformula a pergunta com mais detalhe ou contacta a DPC.';

  ui_blocks.push({ component: 'MarkdownBody', props: { markdown } });
  if (fontes.length) ui_blocks.push({ component: 'SourceList', props: { fontes } });
  return { markdown, ui_blocks, fontes };
}

async function loadHistory(sessaoId: string, limit = 10): Promise<HistoryMessage[]> {
  const rows = await sql`
    SELECT papel, conteudo FROM chat_mensagens
    WHERE sessao_id = ${sessaoId} AND papel IN ('user', 'assistant')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return [...rows].reverse().map((r) => ({
    papel: r.papel as 'user' | 'assistant',
    conteudo: String(r.conteudo ?? '').slice(0, 2000),
  }));
}

/**
 * Agente com tool-calling via Piramyd (OpenAI-compatible).
 */
async function runPiramydAgent(params: {
  pergunta: string;
  history: HistoryMessage[];
  ctx: AgentContext;
  agentCfg: AgentRuntimeConfig;
}): Promise<{
  markdown: string;
  ui_blocks: UiBlock[];
  fontes: ChatFonte[];
  precisa_escalar: boolean;
  tokens_in: number;
  tokens_out: number;
  modelo: string;
  phases: AgentPhase[];
}> {
  const client = getPiramydClient();
  const phases: AgentPhase[] = ['think', 'tool', 'compose'];
  let ui_blocks: UiBlock[] = [];
  let fontes: ChatFonte[] = [];
  let precisa_escalar = false;
  let tokens_in = 0;
  let tokens_out = 0;
  const agentCfg = params.agentCfg;
  const systemPrompt =
    (agentCfg.system_prompt || AGENT_SYSTEM_PROMPT) +
    `\n\nTens ferramentas reais do sistema RH Pumangol. Para inventário/capacidade da KB usa list_kb_documentos; para conteúdo usa search_knowledge; para RH usa as tools de vagas/candidatos/onboarding/KPIs. Responde em markdown PT-AO, conciso.`;

  type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const isKbMeta = looksLikeKbMetaQuestion(params.pergunta);

  const messages: Msg[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...params.history.slice(-8).map(
      (m) =>
        ({
          role: m.papel === 'assistant' ? 'assistant' : 'user',
          content: m.conteudo,
        }) as Msg
    ),
    {
      role: 'user',
      content: isKbMeta
        ? `${params.pergunta}\n\n[Instrução interna: chama list_kb_documentos agora e responde com o inventário real. Não escales.]`
        : params.pergunta,
    },
  ];

  let finalText = '';
  const modelo = PIRAMYD_CONFIG.chatModel;
  let usedListKb = false;
  const maxSteps = agentCfg.max_tool_steps || PIRAMYD_CONFIG.maxToolSteps;

  for (let step = 0; step < maxSteps; step++) {
    const completion = await client.chat.completions.create({
      model: modelo,
      messages,
      tools: AGENT_TOOLS,
      // Na 1.ª volta de perguntas meta sobre a KB, força tool use
      tool_choice:
        step === 0 && isKbMeta
          ? { type: 'function', function: { name: 'list_kb_documentos' } }
          : 'auto',
      temperature: agentCfg.temperature ?? PIRAMYD_CONFIG.temperature,
      max_tokens: agentCfg.max_tokens || PIRAMYD_CONFIG.maxTokens,
      stream: false,
    });

    tokens_in += completion.usage?.prompt_tokens ?? 0;
    tokens_out += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0];
    const msg = choice.message;

    if (msg.tool_calls?.length) {
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function' || !('function' in tc)) continue;
        const fnName = tc.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }

        const result = await executeTool(fnName, args, {
          utilizador_id: params.ctx.utilizador_id,
          role: params.ctx.role,
          sessao_id: params.ctx.sessao_id,
        });

        if (result.ui_blocks?.length) ui_blocks.push(...result.ui_blocks);
        if (fnName === 'create_escalation' && !isKbMeta) precisa_escalar = true;
        if (fnName === 'list_kb_documentos') usedListKb = true;
        if (fnName === 'search_knowledge') {
          const hits =
            (result.data as {
              hits?: {
                id: string;
                titulo: string;
                score: number;
                origem: 'kb' | 'faq';
                pagina?: number | null;
              }[];
            })?.hits ?? [];
          fontes = hits.map((h) => ({
            titulo: h.titulo,
            pagina: h.pagina ?? null,
            documento_id: h.id,
            score: h.score,
            origem: h.origem,
          }));
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result.data).slice(0, 8000),
        });
      }
      continue;
    }

    finalText = (msg.content ?? '').trim();
    break;
  }

  // Meta KB: se o modelo não listou docs, inventário directo a partir da Neon
  if (isKbMeta && (!usedListKb || !finalText)) {
    const kb = await toolListKbDocumentos({ limit: 50 });
    const data = kb.data as {
      documentos: {
        titulo: string;
        estado: string;
        chunks_total: number;
        direccao: string;
        tipo_ficheiro: string | null;
      }[];
      resumo: {
        total_documentos: number;
        indexados: number;
        faqs_publicadas: number;
        chunks_total: number;
      };
    };
    usedListKb = true;
    if (!finalText) {
      const docs = data.documentos ?? [];
      const lines = docs
        .slice(0, 15)
        .map(
          (d) =>
            `- **${d.titulo}** (${d.tipo_ficheiro ?? 'doc'}, ${d.direccao}) — ${d.estado}, ${d.chunks_total ?? 0} chunks`
        )
        .join('\n');
      finalText =
        `Sim — consigo ler e pesquisar a base de conhecimento da plataforma.\n\n` +
        `**Resumo:** ${data.resumo?.indexados ?? 0} documento(s) indexado(s), ` +
        `${data.resumo?.chunks_total ?? 0} chunks, ${data.resumo?.faqs_publicadas ?? 0} FAQs publicadas.\n\n` +
        (lines ? `**Documentos:**\n${lines}\n\n` : 'Ainda não há documentos indexados.\n\n') +
        `Pergunta-me sobre um tema (ex.: férias, seguro) e pesquiso o conteúdo.`;
    }
  }

  if (!finalText && !isKbMeta) {
    const hits = await retrieveHybrid(params.pergunta, agentCfg.top_k || 5);
    const composed = composeFromHits(params.pergunta, hits);
    finalText = composed.markdown;
    if (!fontes.length) fontes = composed.fontes;
    ui_blocks = [
      ...composed.ui_blocks.filter((b) => b.component === 'MarkdownBody'),
      ...ui_blocks,
    ];
  }

  if (finalText) {
    // Preferir o texto final do modelo; limpar MarkdownBody vazio/duplicado
    ui_blocks = ui_blocks.filter((b) => b.component !== 'MarkdownBody');
    ui_blocks.unshift({ component: 'MarkdownBody', props: { markdown: finalText } });
    if (fontes.length && !ui_blocks.some((b) => b.component === 'SourceList')) {
      ui_blocks.push({ component: 'SourceList', props: { fontes } });
    }
  }

  // Nunca escalar perguntas meta sobre a KB / capacidades
  if (isKbMeta) {
    precisa_escalar = false;
  } else if (looksLikeEscalationRequest(params.pergunta) && !precisa_escalar) {
    precisa_escalar = true;
  }

  return {
    markdown: finalText,
    ui_blocks,
    fontes,
    precisa_escalar,
    tokens_in,
    tokens_out,
    modelo,
    phases,
  };
}

/** Fallback NVIDIA single-shot (sem tools) se Piramyd offline mas NVIDIA ok. */
async function runNvidiaCompose(
  pergunta: string,
  hits: HybridHit[],
  history: HistoryMessage[],
  agentCfg: AgentRuntimeConfig
): Promise<{ text: string; tokens_in: number; tokens_out: number }> {
  const client = getNvidiaClient();
  const contexto = buildContextBlock(hits);
  const historyMsgs = history.slice(-6).map((m) => ({
    role: (m.papel === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.conteudo,
  }));

  const completion = await client.chat.completions.create({
    model: NVIDIA_CONFIG.chatModel,
    messages: [
      { role: 'system', content: agentCfg.system_prompt || AGENT_SYSTEM_PROMPT },
      ...historyMsgs,
      {
        role: 'user',
        content: `CONTEXTO:\n${contexto}\n\nPERGUNTA:\n${pergunta}`,
      },
    ],
    temperature: agentCfg.temperature ?? NVIDIA_CONFIG.temperature,
    max_tokens: agentCfg.max_tokens || NVIDIA_CONFIG.maxTokens,
    stream: false,
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

  return {
    text: completion.choices[0]?.message?.content ?? '',
    tokens_in: completion.usage?.prompt_tokens ?? 0,
    tokens_out: completion.usage?.completion_tokens ?? 0,
  };
}

/** Extrai título de documento a partir da pergunta + histórico recente. */
async function resolveDocumentTitle(
  pergunta: string,
  history: HistoryMessage[]
): Promise<string | null> {
  const docs = await sql`
    SELECT titulo FROM kb_documentos WHERE estado = 'indexado' ORDER BY titulo
  `;
  const titles = docs.map((d) => String(d.titulo ?? ''));
  if (!titles.length) return null;

  const blob = [pergunta, ...history.slice(-4).map((h) => h.conteudo)].join('\n').toLowerCase();

  // match título completo ou palavras-chave longas do título
  let best: { t: string; score: number } | null = null;
  for (const t of titles) {
    const tl = t.toLowerCase();
    if (blob.includes(tl)) {
      return t;
    }
    const words = tl.split(/\s+/).filter((w) => w.length > 4);
    const hits = words.filter((w) => blob.includes(w)).length;
    const score = words.length ? hits / words.length : 0;
    if (score >= 0.4 && (!best || score > best.score)) {
      best = { t, score };
    }
  }
  // follow-up "dele/desse" → último doc mencionado no histórico
  if (/dele|desse|deste|do guia|do documento|do pdf/i.test(pergunta) && best) {
    return best.t;
  }
  if (/dele|desse|deste|do guia|do documento/i.test(pergunta)) {
    // prioriza o título com mais hits no histórico
    for (const t of titles) {
      if (history.some((h) => h.conteudo.toLowerCase().includes(t.toLowerCase().slice(0, 20)))) {
        return t;
      }
    }
    // fallback: único documento
    if (titles.length === 1) return titles[0];
    // ou o mais recente com mais chunks
    const top = await sql`
      SELECT titulo FROM kb_documentos WHERE estado = 'indexado'
      ORDER BY chunks_total DESC NULLS LAST LIMIT 1
    `;
    return (top[0]?.titulo as string) ?? null;
  }
  return best && best.score >= 0.45 ? best.t : null;
}

async function answerDocumentSummaryFast(
  pergunta: string,
  history: HistoryMessage[]
): Promise<{ markdown: string; ui_blocks: UiBlock[]; modelo: string } | null> {
  if (!looksLikeDocumentSummary(pergunta) && !/dele|desse|deste guia|esse documento/i.test(pergunta)) {
    return null;
  }

  const titulo = await resolveDocumentTitle(pergunta, history);
  if (!titulo) return null;

  const content = await toolGetKbDocumentContent({ titulo, max_chunks: 16 });
  const data = content.data as {
    found?: boolean;
    documento?: { titulo: string; direccao: string };
    texto?: string;
  };
  if (!data.found || !data.texto?.trim()) return null;

  const texto = data.texto.slice(0, 10000);
  const docTitle = data.documento?.titulo ?? titulo;

  // Tenta 1 chamada LLM curta; se falhar, resumo extractivo
  if (isPiramydReady()) {
    try {
      const client = getPiramydClient();
      const cfg = PIRAMYD_CONFIG;
      const completion = await client.chat.completions.create({
        model: cfg.chatModel,
        messages: [
          {
            role: 'system',
            content:
              'És o Agente DPC. Resume documentos oficiais em português angolano, claro e estruturado (bullet points). Não inventes. Máx. 350 palavras.',
          },
          {
            role: 'user',
            content: `Resume o documento "${docTitle}" com base neste conteúdo:\n\n${texto}\n\nPergunta do utilizador: ${pergunta}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 700,
        stream: false,
      });
      const md =
        (completion.choices[0]?.message?.content ?? '').trim() ||
        `**${docTitle}**\n\n${texto.slice(0, 800)}…`;
      const markdown = md;
      return {
        markdown,
        ui_blocks: [
          { component: 'MarkdownBody', props: { markdown } },
          {
            component: 'SourceList',
            props: {
              fontes: [
                {
                  titulo: docTitle,
                  pagina: null,
                  documento_id: String((data.documento as { id?: string })?.id ?? ''),
                  score: 1,
                  origem: 'kb',
                },
              ],
            },
          },
        ],
        modelo: cfg.chatModel,
      };
    } catch (err) {
      console.error('[doc summary piramyd]', err);
    }
  }

  // Extractive fallback (sem LLM)
  const paras = texto.split(/\n\n+/).filter((p) => p.trim().length > 40).slice(0, 5);
  const markdown =
    `### Resumo — ${docTitle}\n\n` +
    paras.map((p) => `- ${p.replace(/\s+/g, ' ').trim().slice(0, 280)}`).join('\n');
  return {
    markdown,
    ui_blocks: [
      { component: 'MarkdownBody', props: { markdown } },
      {
        component: 'SourceList',
        props: {
          fontes: [
            {
              titulo: docTitle,
              pagina: null,
              documento_id: '',
              score: 1,
              origem: 'kb',
            },
          ],
        },
      },
    ],
    modelo: 'kb-extractive',
  };
}

async function answerKbMetaLocally(): Promise<{ markdown: string; ui_blocks: UiBlock[] }> {
  const kb = await toolListKbDocumentos({ limit: 50 });
  const data = kb.data as {
    documentos: {
      titulo: string;
      estado: string;
      chunks_total: number;
      direccao: string;
      tipo_ficheiro: string | null;
    }[];
    resumo: {
      indexados: number;
      faqs_publicadas: number;
      chunks_total: number;
    };
  };
  const markdown =
    `Sim — consigo ler e pesquisar a base de conhecimento da plataforma.\n\n` +
    `**Resumo:** ${data.resumo?.indexados ?? 0} documento(s) indexado(s), ` +
    `${data.resumo?.chunks_total ?? 0} chunks, ${data.resumo?.faqs_publicadas ?? 0} FAQs publicadas.\n\n` +
    `Pergunta-me sobre um tema (ex.: férias, seguro) e pesquiso o conteúdo.`;
  return {
    markdown,
    ui_blocks: [
      { component: 'MarkdownBody', props: { markdown } },
      ...(kb.ui_blocks ?? []),
    ],
  };
}

export async function runAgentTurn(params: {
  pergunta: string;
  sessao_id?: string;
  user: { id: string; email: string; role: 'rh_admin' | 'novo_colaborador' };
}): Promise<AgentTurnResult> {
  const t0 = Date.now();
  const mode = getAgentMode();
  const agentCfg = await loadAgentConfig();
  const minScore = agentCfg.min_relevance_score ?? MIN_SCORE_ANSWER_FALLBACK;
  const topK = agentCfg.top_k || 6;
  const cleanPergunta = params.pergunta.trim();
  const isKbMeta = looksLikeKbMetaQuestion(cleanPergunta);

  let sessaoId = params.sessao_id;
  if (!sessaoId) {
    const nova = await sql`
      INSERT INTO chat_sessoes (utilizador_id, titulo)
      VALUES (${params.user.id}, ${cleanPergunta.slice(0, 100)})
      RETURNING id
    `;
    sessaoId = nova[0].id as string;
  } else {
    const sessao = await sql`
      SELECT id FROM chat_sessoes
      WHERE id = ${sessaoId} AND utilizador_id = ${params.user.id} AND arquivada = false
      LIMIT 1
    `;
    if (!sessao.length) {
      throw new Error('Sessao de chat nao encontrada para o utilizador autenticado');
    }
  }

  await sql`
    INSERT INTO chat_mensagens (sessao_id, papel, conteudo)
    VALUES (${sessaoId}, 'user', ${cleanPergunta})
  `;

  const history = await loadHistory(sessaoId, 10);

  // Atalho: inventário / capacidades da KB
  if (isKbMeta) {
    const { markdown, ui_blocks } = await answerKbMetaLocally();
    const latencia = Date.now() - t0;
    const assistant = await sql`
      INSERT INTO chat_mensagens (
        sessao_id, papel, conteudo, latencia_ms, modelo, escalada_para_dpc
      )
      VALUES (
        ${sessaoId}, 'assistant', ${markdown}, ${latencia}, ${'kb-meta-local'}, false
      )
      RETURNING id
    `;
    await sql`UPDATE chat_sessoes SET ultima_actividade = NOW() WHERE id = ${sessaoId}`;
    return {
      sessao_id: sessaoId,
      mensagem_id: assistant[0].id as string,
      resposta: markdown.replace(/[#*_`]/g, '').slice(0, 4000),
      markdown,
      ui_blocks,
      fontes: [],
      precisa_escalar: false,
      latencia_ms: latencia,
      modelo: 'kb-meta-local',
      mode: mode === 'piramyd' ? 'piramyd' : mode === 'nvidia' ? 'nvidia' : 'demo',
      phases: ['tool', 'compose'],
    };
  }

  // Atalho: "está indexado?" — resposta directa da Neon
  if (looksLikeDocumentStatus(cleanPergunta)) {
    const titulo = await resolveDocumentTitle(cleanPergunta, history);
    const kb = await toolListKbDocumentos({ estado: 'indexado', limit: 50 });
    const data = kb.data as {
      documentos: { titulo: string; chunks_total: number; tipo_ficheiro: string | null; direccao: string }[];
    };
    let markdown: string;
    if (titulo) {
      const doc = data.documentos?.find((d) =>
        d.titulo.toLowerCase().includes(titulo.toLowerCase().slice(0, 20))
      ) ?? data.documentos?.find((d) => titulo.toLowerCase().includes(d.titulo.toLowerCase().slice(0, 20)));
      markdown = doc
        ? `Sim — **${doc.titulo}** está indexado (${doc.tipo_ficheiro ?? 'doc'}, ${doc.direccao}, ${doc.chunks_total ?? 0} chunks).\n\nQueres um resumo do conteúdo ou uma pesquisa por um tema específico?`
        : `Não encontrei um documento com esse nome na base indexada.\n\nDocumentos disponíveis:\n${(data.documentos ?? [])
            .map((d) => `- ${d.titulo}`)
            .join('\n')}`;
    } else {
      markdown =
        `Documentos indexados:\n` +
        (data.documentos ?? []).map((d) => `- **${d.titulo}** (${d.chunks_total ?? 0} chunks)`).join('\n') +
        `\n\nDiz o título para um resumo.`;
    }
    const latencia = Date.now() - t0;
    const assistant = await sql`
      INSERT INTO chat_mensagens (sessao_id, papel, conteudo, latencia_ms, modelo, escalada_para_dpc)
      VALUES (${sessaoId}, 'assistant', ${markdown}, ${latencia}, ${'kb-status-local'}, false)
      RETURNING id
    `;
    await sql`UPDATE chat_sessoes SET ultima_actividade = NOW() WHERE id = ${sessaoId}`;
    return {
      sessao_id: sessaoId,
      mensagem_id: assistant[0].id as string,
      resposta: markdown.replace(/[#*_`]/g, '').slice(0, 4000),
      markdown,
      ui_blocks: [{ component: 'MarkdownBody', props: { markdown } }],
      fontes: [],
      precisa_escalar: false,
      latencia_ms: latencia,
      modelo: 'kb-status-local',
      mode: mode === 'piramyd' ? 'piramyd' : mode === 'nvidia' ? 'nvidia' : 'demo',
      phases: ['tool', 'compose'],
    };
  }

  // Atalho: resumo de documento (1 chamada LLM ou extractive) — evita timeout multi-tool
  const fastSummary = await answerDocumentSummaryFast(cleanPergunta, history);
  if (fastSummary) {
    const latencia = Date.now() - t0;
    const assistant = await sql`
      INSERT INTO chat_mensagens (
        sessao_id, papel, conteudo, latencia_ms, modelo, escalada_para_dpc
      )
      VALUES (
        ${sessaoId}, 'assistant', ${fastSummary.markdown}, ${latencia}, ${fastSummary.modelo}, false
      )
      RETURNING id
    `;
    await sql`UPDATE chat_sessoes SET ultima_actividade = NOW() WHERE id = ${sessaoId}`;
    return {
      sessao_id: sessaoId,
      mensagem_id: assistant[0].id as string,
      resposta: fastSummary.markdown.replace(/[#*_`]/g, '').slice(0, 4000),
      markdown: fastSummary.markdown,
      ui_blocks: fastSummary.ui_blocks,
      fontes: [],
      precisa_escalar: false,
      latencia_ms: latencia,
      modelo: fastSummary.modelo,
      mode: mode === 'piramyd' ? 'piramyd' : mode === 'nvidia' ? 'nvidia' : 'demo',
      phases: ['retrieve', 'compose'],
    };
  }
  const ctx: AgentContext = {
    utilizador_id: params.user.id,
    email: params.user.email,
    role: params.user.role,
    sessao_id: sessaoId,
    history,
  };

  let markdown = '';
  let ui_blocks: UiBlock[] = [];
  let fontes: ChatFonte[] = [];
  let precisa_escalar = false;
  let modelo = 'agent-demo-faq';
  let tokens_in = 0;
  let tokens_out = 0;
  let phases: AgentPhase[] = ['retrieve', 'compose'];
  let resultMode: 'demo' | 'nvidia' | 'piramyd' = mode === 'piramyd' ? 'piramyd' : mode === 'nvidia' ? 'nvidia' : 'demo';

  if (mode === 'piramyd' && isPiramydReady()) {
    try {
      const agent = await runPiramydAgent({ pergunta: cleanPergunta, history, ctx, agentCfg });
      markdown = agent.markdown;
      ui_blocks = agent.ui_blocks;
      fontes = agent.fontes;
      precisa_escalar = agent.precisa_escalar;
      tokens_in = agent.tokens_in;
      tokens_out = agent.tokens_out;
      modelo = agent.modelo;
      phases = agent.phases;
      resultMode = 'piramyd';
    } catch (err) {
      console.error('[agent piramyd]', err);
      // fallback hybrid — sem escalar se for meta (já tratado acima)
      phases = ['retrieve', 'compose'];
      const hits = await retrieveHybrid(cleanPergunta, topK);
      const composed = composeFromHits(cleanPergunta, hits);
      markdown = composed.markdown;
      ui_blocks = composed.ui_blocks;
      fontes = composed.fontes;
      precisa_escalar = topScore(hits) < minScore;
      modelo = 'agent-faq-fallback';
      resultMode = 'demo';
    }
  } else if (mode === 'nvidia' && isNvidiaReady()) {
    phases = ['retrieve', 'think', 'compose'];
    const hits = await retrieveHybrid(cleanPergunta, topK);
    const score = topScore(hits);
    if (score >= minScore) {
      try {
        const llm = await runNvidiaCompose(cleanPergunta, hits, history, agentCfg);
        markdown = llm.text || composeFromHits(cleanPergunta, hits).markdown;
        tokens_in = llm.tokens_in;
        tokens_out = llm.tokens_out;
        fontes = hitsToFontes(hits);
        ui_blocks = [
          { component: 'MarkdownBody', props: { markdown } },
          { component: 'SourceList', props: { fontes } },
        ];
        modelo = NVIDIA_CONFIG.chatModel;
        resultMode = 'nvidia';
      } catch {
        const c = composeFromHits(cleanPergunta, hits);
        markdown = c.markdown;
        ui_blocks = c.ui_blocks;
        fontes = c.fontes;
        modelo = 'agent-faq-fallback';
        resultMode = 'demo';
      }
    } else {
      precisa_escalar = true;
      markdown =
        `Não encontrei informação suficiente na base de conhecimento. Vou registar esta questão para a DPC (${agentCfg.email_escalacao}).`;
      ui_blocks = [{ component: 'MarkdownBody', props: { markdown } }];
    }
  } else {
    // Demo: hybrid FAQ only
    phases = ['retrieve', 'compose'];
    await toolSearchKnowledge(cleanPergunta);
    const hits = await retrieveHybrid(cleanPergunta, topK);
    const score = topScore(hits);
    if (score >= minScore) {
      const c = composeFromHits(cleanPergunta, hits);
      markdown = c.markdown;
      ui_blocks = c.ui_blocks;
      fontes = c.fontes;
    } else {
      precisa_escalar = true;
      markdown =
        `Não encontrei informação suficiente na base de conhecimento. Vou registar esta questão para a DPC (${agentCfg.email_escalacao}).`;
      ui_blocks = [{ component: 'MarkdownBody', props: { markdown } }];
    }
    modelo = 'agent-demo-faq';
    resultMode = 'demo';
  }

  const latencia = Date.now() - t0;
  const respostaPlain = markdown.replace(/[#*_`]/g, '').slice(0, 4000);

  const kbChunkIds = fontes
    .filter((f) => f.origem === 'kb')
    .map((f) => f.documento_id);

  const assistant = await sql`
    INSERT INTO chat_mensagens (
      sessao_id, papel, conteudo,
      tokens_input, tokens_output, latencia_ms, modelo,
      chunks_utilizados, score_relevancia, escalada_para_dpc
    )
    VALUES (
      ${sessaoId}, 'assistant', ${markdown},
      ${tokens_in}, ${tokens_out}, ${latencia}, ${modelo},
      ${kbChunkIds}, ${fontes[0]?.score ?? 0}, ${precisa_escalar}
    )
    RETURNING id
  `;
  const mensagemId = assistant[0].id as string;

  // Bloquear escalação em perguntas meta (capacidades / inventário KB)
  if (looksLikeKbMetaQuestion(cleanPergunta)) {
    precisa_escalar = false;
  }

  // Escalações: só registo backend (sem card no chat)
  if (precisa_escalar) {
    await toolCreateEscalation({
      mensagem_id: mensagemId,
      sessao_id: sessaoId,
      utilizador_id: ctx.utilizador_id,
      pergunta: cleanPergunta,
    }).catch((err) => console.error('[escalation]', err));
  }

  // Garantir que nunca enviamos o card de escalação à UI
  ui_blocks = ui_blocks.filter((b) => b.component !== 'EscalationConfirm');

  await sql`UPDATE chat_sessoes SET ultima_actividade = NOW() WHERE id = ${sessaoId}`;

  const seen = new Set<string>();
  const deduped = ui_blocks.filter((b) => {
    const key = `${b.component}:${JSON.stringify(b.props).slice(0, 180)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    sessao_id: sessaoId,
    mensagem_id: mensagemId,
    resposta: respostaPlain,
    markdown,
    ui_blocks: deduped,
    fontes,
    precisa_escalar,
    latencia_ms: latencia,
    modelo,
    mode: resultMode,
    phases,
  };
}
