/**
 * Contrato do Agente DPC + Generative UI.
 * O frontend só renderiza `component` da allowlist em genui/registry.
 */

export interface ChatFonte {
  titulo: string;
  pagina: number | null;
  documento_id: string;
  score: number;
  origem?: 'kb' | 'faq';
}

export type UiBlock =
  | { component: 'MarkdownBody'; props: { markdown: string } }
  | { component: 'SourceList'; props: { fontes: ChatFonte[] } }
  | {
      component: 'TrilhoProgressCard';
      props: {
        percent: number;
        etapas: { nome: string; estado: string }[];
        colaborador_nome?: string;
      };
    }
  | {
      component: 'EscalationConfirm';
      props: { pergunta: string; escalacao_id?: string; mensagem?: string };
    }
  | {
      component: 'ActionChips';
      props: { actions: { label: string; href?: string; prompt?: string }[] };
    }
  | {
      component: 'FaqCard';
      props: { pergunta: string; resposta: string; direccao: string; categoria?: string };
    }
  | {
      component: 'ContactDpc';
      props: { email: string; motivo?: string };
    }
  | {
      component: 'KbDocumentList';
      props: {
        documentos: {
          titulo: string;
          estado: string;
          chunks_total?: number;
          direccao?: string;
          tipo_ficheiro?: string | null;
        }[];
        resumo?: { indexados?: number; faqs_publicadas?: number; chunks_total?: number };
      };
    }
  | {
      component: 'KpiGrid';
      props: { items: { label: string; value: string | number; hint?: string }[] };
    }
  | {
      component: 'DataTableCard';
      props: { title: string; columns: string[]; rows: string[][] };
    }
  | {
      component: 'ToolStatus';
      props: { tool: string; label: string; state?: 'running' | 'done' | 'error' };
    };

export type AgentPhase = 'retrieve' | 'think' | 'tool' | 'compose';

export type AgentTurnEvent =
  | { type: 'status'; phase: AgentPhase; detail?: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'ui_block'; block: UiBlock }
  | { type: 'citation'; fonte: ChatFonte }
  | {
      type: 'done';
      mensagem_id: string;
      sessao_id: string;
      precisa_escalar: boolean;
      latencia_ms: number;
      modelo: string;
      mode: 'demo' | 'nvidia';
    }
  | { type: 'error'; message: string };

/** Resposta JSON completa (sem SSE) — usada pelo frontend actual. */
export interface AgentTurnResult {
  sessao_id: string;
  mensagem_id: string;
  resposta: string;
  markdown: string;
  ui_blocks: UiBlock[];
  fontes: ChatFonte[];
  precisa_escalar: boolean;
  latencia_ms: number;
  modelo: string;
  mode: 'demo' | 'nvidia' | 'piramyd';
  phases: AgentPhase[];
}

export interface HistoryMessage {
  papel: 'user' | 'assistant' | 'system';
  conteudo: string;
}

export interface AgentContext {
  utilizador_id: string;
  email: string;
  role: 'rh_admin' | 'novo_colaborador';
  sessao_id: string;
  history: HistoryMessage[];
}
