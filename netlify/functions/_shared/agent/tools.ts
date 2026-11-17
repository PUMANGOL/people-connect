import { sql } from '../db';
import { retrieveHybrid, type HybridHit } from '../retrieve-hybrid';
import type { AuthRole } from '../auth';
import type { UiBlock } from './types';
import type OpenAI from 'openai';

export interface ToolResult {
  ok: boolean;
  data: unknown;
  ui_blocks?: UiBlock[];
}

export const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description:
        'Pesquisa no conteúdo da base de conhecimento (documentos PDF/DOCX indexados + FAQs). Usar para perguntas sobre políticas, benefícios, processos. NÃO usar para listar inventário de documentos — nesse caso usa list_kb_documentos.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Pergunta ou termos de pesquisa (tema concreto, não a frase inteira do chat)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_kb_documentos',
      description:
        'Lista documentos da base de conhecimento da plataforma (título, estado, chunks, direcção, tipo). Usar quando o utilizador pergunta se consegues ler documentos, o que está indexado, ou inventário da KB.',
      parameters: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            description: 'Opcional: indexado | processando | falha | arquivado',
          },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_kb_document_content',
      description:
        'Obtém o texto (chunks) de um documento indexado pelo título ou id. Usar para resumos, leituras e perguntas sobre um documento específico.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Parte do título do documento' },
          documento_id: { type: 'string', description: 'UUID do documento (opcional)' },
          max_chunks: { type: 'number', description: 'Máx. chunks (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_faqs',
      description: 'Lista FAQs publicadas, opcionalmente filtradas por direcção ou categoria.',
      parameters: {
        type: 'object',
        properties: {
          direccao: { type: 'string' },
          categoria: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_vagas',
      description: 'Lista vagas de recrutamento na plataforma (estado, direcção, título).',
      parameters: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            description: 'aberta | em_triagem | em_entrevistas | em_proposta | fechada | cancelada',
          },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_candidatos',
      description: 'Lista candidatos no pipeline de recrutamento.',
      parameters: {
        type: 'object',
        properties: {
          vaga_id: { type: 'string' },
          estado_pipeline: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_colaboradores',
      description: 'Lista colaboradores em onboarding ou activos na plataforma.',
      parameters: {
        type: 'object',
        properties: {
          estado_onboarding: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_onboarding',
      description: 'Obtém o trilho/progresso de onboarding do utilizador autenticado (ou por nome).',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Opcional: nome do colaborador a pesquisar' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_trilhos',
      description: 'Lista trilhos de onboarding activos e as suas etapas.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_kpis',
      description: 'KPIs executivos: vagas abertas, candidatos, onboarding, interacções e escalações do assistente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_escalacoes',
      description: 'Lista escalações DPC (questões do chatbot que precisam de humano).',
      parameters: {
        type: 'object',
        properties: {
          estado: { type: 'string', description: 'pendente | em_analise | respondida | adicionada_kb' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_escalation',
      description:
        'Cria uma escalação para a DPC quando a base de conhecimento não tem resposta suficiente ou o utilizador pede humano.',
      parameters: {
        type: 'object',
        properties: {
          pergunta: { type: 'string' },
          contexto: { type: 'string' },
        },
        required: ['pergunta'],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: {
    utilizador_id: string;
    role: AuthRole;
    sessao_id: string;
    mensagem_id?: string;
  }
): Promise<ToolResult> {
  switch (name) {
    case 'search_knowledge':
      return toolSearchKnowledge(String(args.query ?? ''));
    case 'list_kb_documentos':
      return toolListKbDocumentos({
        estado: args.estado ? String(args.estado) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 50,
      });
    case 'get_kb_document_content':
      return toolGetKbDocumentContent({
        titulo: args.titulo ? String(args.titulo) : undefined,
        documento_id: args.documento_id ? String(args.documento_id) : undefined,
        max_chunks: typeof args.max_chunks === 'number' ? args.max_chunks : 20,
      });
    case 'list_faqs':
      return toolListFaqs({
        direccao: args.direccao ? String(args.direccao) : undefined,
        categoria: args.categoria ? String(args.categoria) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 10,
      });
    case 'list_vagas':
      return toolListVagas({
        estado: args.estado ? String(args.estado) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
    case 'list_candidatos':
      return toolListCandidatos({
        vaga_id: args.vaga_id ? String(args.vaga_id) : undefined,
        estado_pipeline: args.estado_pipeline ? String(args.estado_pipeline) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
    case 'list_colaboradores':
      return toolListColaboradores({
        estado_onboarding: args.estado_onboarding ? String(args.estado_onboarding) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
    case 'get_my_onboarding':
      return toolGetMyOnboarding(ctx.utilizador_id, args.nome ? String(args.nome) : undefined);
    case 'list_trilhos':
      return toolListTrilhos(typeof args.limit === 'number' ? args.limit : 10);
    case 'get_dashboard_kpis':
      return toolDashboardKpis();
    case 'list_escalacoes':
      return toolListEscalacoes({
        estado: args.estado ? String(args.estado) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
    case 'create_escalation':
      return toolCreateEscalation({
        mensagem_id: ctx.mensagem_id,
        sessao_id: ctx.sessao_id,
        utilizador_id: ctx.utilizador_id,
        pergunta: String(args.pergunta ?? ''),
        contexto: args.contexto ? String(args.contexto) : undefined,
      });
    default:
      return { ok: false, data: { error: `Tool desconhecida: ${name}` } };
  }
}

export async function toolSearchKnowledge(query: string): Promise<ToolResult> {
  const hits = await retrieveHybrid(query, 6);
  return {
    ok: true,
    data: {
      hits: hits.map((h) => ({
        id: h.id,
        origem: h.origem,
        titulo: h.titulo,
        score: Number(h.score.toFixed(3)),
        excerpt: h.conteudo.slice(0, 700),
        pergunta_faq: h.pergunta_faq,
        direccao: h.direccao,
        pagina: h.pagina,
      })),
      count: hits.length,
      top_score: hits[0]?.score ?? 0,
    },
  };
}

export async function toolGetKbDocumentContent(filters: {
  titulo?: string;
  documento_id?: string;
  max_chunks?: number;
}): Promise<ToolResult> {
  const maxChunks = Math.min(filters.max_chunks ?? 20, 40);
  let docs: Record<string, unknown>[] = [];

  if (filters.documento_id) {
    docs = (await sql`
      SELECT id, titulo, direccao, tipo_ficheiro, estado, chunks_total
      FROM kb_documentos WHERE id = ${filters.documento_id} LIMIT 1
    `) as Record<string, unknown>[];
  } else if (filters.titulo?.trim()) {
    const term = `%${filters.titulo.trim()}%`;
    docs = (await sql`
      SELECT id, titulo, direccao, tipo_ficheiro, estado, chunks_total
      FROM kb_documentos
      WHERE estado = 'indexado' AND titulo ILIKE ${term}
      ORDER BY chunks_total DESC NULLS LAST
      LIMIT 3
    `) as Record<string, unknown>[];
  } else {
    return { ok: false, data: { error: 'Indica titulo ou documento_id' } };
  }

  if (!docs.length) {
    return { ok: true, data: { found: false, message: 'Documento não encontrado.' } };
  }

  const doc = docs[0];
  const chunks = await sql`
    SELECT ordem, conteudo, tokens
    FROM kb_chunks
    WHERE documento_id = ${doc.id as string}
    ORDER BY ordem ASC
    LIMIT ${maxChunks}
  `;

  const texto = chunks.map((c) => String(c.conteudo ?? '')).join('\n\n');

  return {
    ok: true,
    data: {
      found: true,
      documento: doc,
      chunks_devolvidos: chunks.length,
      texto: texto.slice(0, 14000),
    },
  };
}

export async function toolListKbDocumentos(filters: {
  estado?: string;
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const rows = filters.estado
    ? await sql`
        SELECT id, titulo, descricao, direccao, tipo_ficheiro, estado,
               chunks_total, tamanho_bytes, created_at, updated_at
        FROM kb_documentos
        WHERE estado = ${filters.estado}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, titulo, descricao, direccao, tipo_ficheiro, estado,
               chunks_total, tamanho_bytes, created_at, updated_at
        FROM kb_documentos
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT ${limit}
      `;

  const faqsCount = await sql`
    SELECT COUNT(*)::int as n FROM faqs WHERE estado = 'publicada'
  `;
  const chunksCount = await sql`SELECT COUNT(*)::int as n FROM kb_chunks`;
  const indexados = rows.filter((d) => d.estado === 'indexado').length;

  const resumo = {
    total_documentos: rows.length,
    indexados,
    faqs_publicadas: (faqsCount[0]?.n as number) ?? 0,
    chunks_total: (chunksCount[0]?.n as number) ?? 0,
    pode_ler_documentos: true,
  };
  const documentos = (rows as Record<string, unknown>[]).map((r) => ({
    titulo: String(r.titulo ?? ''),
    estado: String(r.estado ?? ''),
    chunks_total: Number(r.chunks_total ?? 0),
    direccao: String(r.direccao ?? ''),
    tipo_ficheiro: (r.tipo_ficheiro as string | null) ?? null,
  }));
  return {
    ok: true,
    data: { documentos, resumo },
    ui_blocks: [
      {
        component: 'KbDocumentList',
        props: { documentos, resumo },
      },
    ],
  };
}

export async function toolListFaqs(filters: {
  direccao?: string;
  categoria?: string;
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 10, 30);
  let rows: Record<string, unknown>[];
  if (filters.direccao && filters.categoria) {
    rows = (await sql`
      SELECT id, direccao, categoria::text as categoria, pergunta, resposta, estado::text as estado
      FROM faqs WHERE estado = 'publicada'
        AND direccao = ${filters.direccao}
        AND categoria = ${filters.categoria}::categoria_faq
      ORDER BY data_actualizacao DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
  } else if (filters.direccao) {
    rows = (await sql`
      SELECT id, direccao, categoria::text as categoria, pergunta, resposta, estado::text as estado
      FROM faqs WHERE estado = 'publicada' AND direccao = ${filters.direccao}
      ORDER BY data_actualizacao DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
  } else {
    rows = (await sql`
      SELECT id, direccao, categoria::text as categoria, pergunta, resposta, estado::text as estado
      FROM faqs WHERE estado = 'publicada'
      ORDER BY data_actualizacao DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
  }
  return { ok: true, data: { faqs: rows, count: rows.length } };
}

async function toolListVagas(filters: { estado?: string; limit?: number }): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 20, 50);
  const rows = filters.estado
    ? await sql`
        SELECT id, titulo, direccao, estado::text as estado, numero_posicoes, data_abertura, prazo_alvo
        FROM vagas WHERE estado = ${filters.estado}::estado_vaga
        ORDER BY created_at DESC LIMIT ${limit}
      `
    : await sql`
        SELECT id, titulo, direccao, estado::text as estado, numero_posicoes, data_abertura, prazo_alvo
        FROM vagas ORDER BY created_at DESC LIMIT ${limit}
      `;
  const vagas = rows as Record<string, unknown>[];
  return {
    ok: true,
    data: { vagas, count: vagas.length },
    ui_blocks: [
      {
        component: 'DataTableCard',
        props: {
          title: 'Vagas',
          columns: ['Título', 'Direcção', 'Estado', 'Posições'],
          rows: vagas.map((v) => [
            String(v.titulo ?? ''),
            String(v.direccao ?? ''),
            String(v.estado ?? ''),
            String(v.numero_posicoes ?? ''),
          ]),
        },
      },
    ],
  };
}

async function toolListCandidatos(filters: {
  vaga_id?: string;
  estado_pipeline?: string;
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 20, 50);
  let rows;
  if (filters.vaga_id) {
    rows = await sql`
      SELECT id, nome, vaga_id, estado_pipeline::text as estado_pipeline, origem::text as origem, data_entrada
      FROM candidatos WHERE vaga_id = ${filters.vaga_id}
      ORDER BY data_entrada DESC LIMIT ${limit}
    `;
  } else if (filters.estado_pipeline) {
    rows = await sql`
      SELECT id, nome, vaga_id, estado_pipeline::text as estado_pipeline, origem::text as origem, data_entrada
      FROM candidatos WHERE estado_pipeline = ${filters.estado_pipeline}::estado_pipeline
      ORDER BY data_entrada DESC LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT id, nome, vaga_id, estado_pipeline::text as estado_pipeline, origem::text as origem, data_entrada
      FROM candidatos ORDER BY data_entrada DESC LIMIT ${limit}
    `;
  }
  return { ok: true, data: { candidatos: rows, count: rows.length } };
}

async function toolListColaboradores(filters: {
  estado_onboarding?: string;
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 20, 50);
  const rows = filters.estado_onboarding
    ? await sql`
        SELECT id, nome, funcao, direccao, estado_onboarding::text as estado_onboarding, data_admissao
        FROM colaboradores WHERE estado_onboarding = ${filters.estado_onboarding}::estado_onboarding
        ORDER BY data_admissao DESC LIMIT ${limit}
      `
    : await sql`
        SELECT id, nome, funcao, direccao, estado_onboarding::text as estado_onboarding, data_admissao
        FROM colaboradores ORDER BY data_admissao DESC LIMIT ${limit}
      `;
  return { ok: true, data: { colaboradores: rows, count: rows.length } };
}

export async function toolGetMyOnboarding(
  utilizadorId: string,
  nomeOverride?: string
): Promise<ToolResult> {
  const userRows = await sql`
    SELECT id, nome, email FROM utilizadores WHERE id = ${utilizadorId} LIMIT 1
  `;
  if (userRows.length === 0 && !nomeOverride) {
    return { ok: false, data: { error: 'Utilizador não encontrado' } };
  }
  const nome = nomeOverride || (userRows[0]?.nome as string) || '';
  const firstName = nome.split(/\s+/)[0] || nome;

  const cols = await sql`
    SELECT c.id, c.nome, c.funcao, c.direccao, c.estado_onboarding::text as estado_onboarding, c.data_admissao
    FROM colaboradores c
    WHERE c.nome ILIKE ${'%' + firstName + '%'}
    ORDER BY c.created_at DESC
    LIMIT 1
  `;

  if (!cols.length) {
    return {
      ok: true,
      data: { found: false, message: 'Sem trilho de onboarding associado.' },
    };
  }

  const col = cols[0] as Record<string, unknown>;
  let progresso: Record<string, unknown>[] = [];
  try {
    progresso = (await sql`
      SELECT e.nome, e.ordem, p.estado::text as estado
      FROM progresso_onboarding p
      JOIN etapas_trilho e ON e.id = p.etapa_id
      WHERE p.colaborador_id = ${col.id as string}
      ORDER BY e.ordem ASC
    `) as Record<string, unknown>[];
  } catch {
    progresso = [];
  }

  const etapas = progresso.map((p) => ({
    nome: String(p.nome),
    estado: String(p.estado ?? 'pendente'),
  }));
  const done = etapas.filter((e) => e.estado === 'concluida').length;
  const percent = etapas.length ? Math.round((done / etapas.length) * 100) : 0;

  return {
    ok: true,
    data: { found: true, colaborador: col, percent, etapas },
    ui_blocks: [
      {
        component: 'TrilhoProgressCard',
        props: {
          percent,
          etapas: etapas.slice(0, 8),
          colaborador_nome: String(col.nome),
        },
      },
    ],
  };
}

async function toolListTrilhos(limit = 10): Promise<ToolResult> {
  const rows = await sql`
    SELECT t.id, t.funcao, t.nome, t.duracao_estimada, t.versao, t.activo,
      (SELECT COUNT(*)::int FROM etapas_trilho e WHERE e.trilho_id = t.id) as etapas
    FROM trilhos_onboarding t
    WHERE t.activo = true
    ORDER BY t.created_at DESC
    LIMIT ${Math.min(limit, 30)}
  `;
  return { ok: true, data: { trilhos: rows, count: rows.length } };
}

async function toolDashboardKpis(): Promise<ToolResult> {
  const [vagasAbertas, candidatosActivos, onboardingCurso, msgs, escalacoes] = await Promise.all([
    sql`SELECT COUNT(*)::int as n FROM vagas WHERE estado = 'aberta'`,
    sql`SELECT COUNT(*)::int as n FROM candidatos WHERE estado_pipeline NOT IN ('contratacao', 'transicao_onboarding')`,
    sql`SELECT COUNT(*)::int as n FROM colaboradores WHERE estado_onboarding = 'em_curso'`,
    sql`SELECT COUNT(*)::int as n FROM chat_mensagens WHERE papel = 'user' AND created_at > NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int as n FROM escalacoes WHERE estado IN ('pendente', 'em_analise')`,
  ]);
  const kpis = {
    vagas_abertas: Number(vagasAbertas[0].n),
    candidatos_activos: Number(candidatosActivos[0].n),
    colaboradores_onboarding: Number(onboardingCurso[0].n),
    perguntas_chat_30d: Number(msgs[0].n),
    escalacoes_abertas: Number(escalacoes[0].n),
  };
  return {
    ok: true,
    data: kpis,
    ui_blocks: [
      {
        component: 'KpiGrid',
        props: {
          items: [
            { label: 'Vagas abertas', value: kpis.vagas_abertas },
            { label: 'Candidatos', value: kpis.candidatos_activos },
            { label: 'Em onboarding', value: kpis.colaboradores_onboarding },
            { label: 'Perguntas 30d', value: kpis.perguntas_chat_30d },
            { label: 'Escalações', value: kpis.escalacoes_abertas },
          ],
        },
      },
    ],
  };
}

async function toolListEscalacoes(filters: {
  estado?: string;
  limit?: number;
}): Promise<ToolResult> {
  const limit = Math.min(filters.limit ?? 20, 50);
  const rows = filters.estado
    ? await sql`
        SELECT id, pergunta, estado, criado_em, respondida_em, utilizador_id
        FROM escalacoes WHERE estado = ${filters.estado}
        ORDER BY criado_em DESC LIMIT ${limit}
      `
    : await sql`
        SELECT id, pergunta, estado, criado_em, respondida_em, utilizador_id
        FROM escalacoes ORDER BY criado_em DESC LIMIT ${limit}
      `;
  return { ok: true, data: { escalacoes: rows, count: rows.length } };
}

export async function toolCreateEscalation(params: {
  mensagem_id?: string;
  sessao_id: string;
  utilizador_id: string;
  pergunta: string;
  contexto?: string;
}): Promise<ToolResult> {
  // mensagem_id é FK — se ainda não existir, criar placeholder system msg
  let mensagemId = params.mensagem_id;
  if (!mensagemId) {
    const m = await sql`
      INSERT INTO chat_mensagens (sessao_id, papel, conteudo, escalada_para_dpc)
      VALUES (${params.sessao_id}, 'system', ${'[escalação] ' + params.pergunta}, true)
      RETURNING id
    `;
    mensagemId = m[0].id as string;
  }

  const rows = await sql`
    INSERT INTO escalacoes (mensagem_id, sessao_id, utilizador_id, pergunta, contexto, estado)
    VALUES (
      ${mensagemId},
      ${params.sessao_id},
      ${params.utilizador_id},
      ${params.pergunta},
      ${params.contexto ?? null},
      'pendente'
    )
    RETURNING id
  `;
  const escalacaoId = rows[0].id as string;

  return {
    ok: true,
    data: { escalacao_id: escalacaoId },
    // Sem card de UI — a escalação fica só no backend / página Escalações
  };
}

export function looksLikeOnboarding(q: string): boolean {
  return /trilho|onboarding|integra|admiss|buddy|check-?in|etapas? do onboarding/i.test(q);
}

export function looksLikeEscalationRequest(q: string): boolean {
  return /escalar|falar com (a )?dpc|humano|pessoa real|n[aã]o ajuda|reclama/i.test(q);
}

/** Perguntas sobre capacidades / inventário da KB — nunca escalar. */
export function looksLikeKbMetaQuestion(q: string): boolean {
  const s = q.toLowerCase();
  return (
    /consegues? (ler|aceder|acederes|pesquisar|ver)|podes? (ler|aceder|pesquisar)/i.test(s) ||
    /documentos? da (base de )?conhecimento|base de conhecimento( da plataforma)?/i.test(s) ||
    /que documentos|quais documentos|lista(r)? (os )?documentos|documentos (tens|há|existem)/i.test(s) ||
    /o que (tens|há|existe) (na|em) (a )?(kb|base)|kb indexad/i.test(s) ||
    /lês (os )?documentos|ler os documentos/i.test(s)
  );
}

/** Pedido de resumo/leitura de um documento (possivelmente com "dele" no follow-up). */
export function looksLikeDocumentSummary(q: string): boolean {
  const s = q.toLowerCase();
  return (
    /resumo|resume|sumari|sintetiz|o que (diz|fala|contém)|explica (o |esse |este )?documento|ler (o |esse |este )?guia/i.test(
      s
    ) || /quero (um )?resumo|faz(er)? (um )?resumo/i.test(s)
  );
}

/** Perguntas do tipo "está indexado?" / "tens o documento X?" */
export function looksLikeDocumentStatus(q: string): boolean {
  return /indexad|está na (base|kb)|tens (o |esse )?documento|existe (o )?documento|já (foi )?carregad/i.test(
    q
  );
}

export type { HybridHit };
