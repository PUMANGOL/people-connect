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
      props: {
        items: { label: string; value: string | number; hint?: string }[];
      };
    }
  | {
      component: 'DataTableCard';
      props: {
        title: string;
        columns: string[];
        rows: string[][];
      };
    }
  | {
      component: 'ToolStatus';
      props: { tool: string; label: string; state?: 'running' | 'done' | 'error' };
    };

export type GenUiComponentName = UiBlock['component'];
