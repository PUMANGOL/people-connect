import { apiClient } from './api.client';

export interface ChatFonte {
  titulo: string;
  pagina: number | null;
  documento_id: string;
  score: number;
}

export interface ChatMensagem {
  id: string;
  papel: 'user' | 'assistant' | 'system';
  conteudo: string;
  reasoning?: string | null;
  chunks_utilizados?: string[];
  score_relevancia?: number | null;
  escalada_para_dpc?: boolean;
  satisfacao?: number | null;
  feedback_texto?: string | null;
  latencia_ms?: number | null;
  modelo?: string | null;
  created_at: string;
}

export interface ChatSessao {
  id: string;
  titulo: string;
  iniciada_em: string;
  ultima_actividade: string;
  arquivada: boolean;
  total_mensagens?: number;
  escalacoes?: number;
}

export interface EnviarPerguntaResponse {
  sessao_id: string;
  mensagem_id: string;
  resposta: string;
  markdown?: string;
  ui_blocks?: unknown[];
  fontes: ChatFonte[];
  precisa_escalar: boolean;
  latencia_ms: number;
  modelo: string;
  mode?: 'demo' | 'nvidia';
  demo_banner?: string;
}

export const chatService = {
  /**
   * Envia uma pergunta ao Agente DPC (hybrid RAG + GenUI).
   * Preferir agent.service.turn() para novos ecrãs.
   */
  async enviarPergunta(params: {
    pergunta: string;
    sessao_id?: string;
    utilizador_id?: string;
  }): Promise<EnviarPerguntaResponse> {
    const res = await apiClient.post<{ data: EnviarPerguntaResponse }>(
      '/chat-mensagens',
      { pergunta: params.pergunta, sessao_id: params.sessao_id },
      { timeout: 90_000 }
    );
    return res.data.data;
  },

  async listarSessoes(utilizadorId?: string): Promise<ChatSessao[]> {
    const res = await apiClient.get<{ data: ChatSessao[] }>('/chat-sessoes', {
      params: utilizadorId ? { utilizador_id: utilizadorId } : {},
    });
    return res.data?.data ?? [];
  },

  async obterMensagens(sessaoId: string): Promise<ChatMensagem[]> {
    const res = await apiClient.get<{ data: ChatMensagem[] }>(`/chat-sessoes/${sessaoId}/mensagens`);
    return res.data?.data ?? [];
  },

  async arquivarSessao(sessaoId: string): Promise<void> {
    await apiClient.patch(`/chat-sessoes/${sessaoId}`, { arquivada: true });
  },
};
