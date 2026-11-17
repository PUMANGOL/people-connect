import { apiClient } from './api.client';
import type { UiBlock, ChatFonte } from '@/src/components/assistente/genui/types';

export interface AgentTurnResponse {
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
  phases?: string[];
}

export interface AgentSessao {
  id: string;
  titulo: string;
  iniciada_em: string;
  ultima_actividade: string;
  arquivada: boolean;
  total_mensagens?: number;
  escalacoes?: number;
}

export interface AgentMensagemDb {
  id: string;
  papel: 'user' | 'assistant' | 'system';
  conteudo: string;
  score_relevancia?: number | null;
  escalada_para_dpc?: boolean;
  satisfacao?: number | null;
  latencia_ms?: number | null;
  modelo?: string | null;
  created_at: string;
}

/** Cliente do Agente DPC — timeout alargado para RAG/LLM. */
export const agentService = {
  async turn(params: {
    pergunta: string;
    sessao_id?: string;
  }): Promise<AgentTurnResponse> {
    const res = await apiClient.post<{ data: AgentTurnResponse }>(
      '/agent-turn',
      params,
      { timeout: 90_000 }
    );
    return res.data.data;
  },

  /** Compat path (mesma lógica de agente no backend). */
  async turnViaChat(params: {
    pergunta: string;
    sessao_id?: string;
  }): Promise<AgentTurnResponse> {
    const res = await apiClient.post<{ data: AgentTurnResponse }>(
      '/chat-mensagens',
      params,
      { timeout: 90_000 }
    );
    return res.data.data;
  },

  async listarSessoes(utilizadorId?: string): Promise<AgentSessao[]> {
    const res = await apiClient.get<{ data: AgentSessao[] }>('/chat-sessoes', {
      params: utilizadorId ? { utilizador_id: utilizadorId } : {},
    });
    return res.data?.data ?? [];
  },

  async obterMensagens(sessaoId: string): Promise<AgentMensagemDb[]> {
    const res = await apiClient.get<{ data: AgentMensagemDb[] }>(
      `/chat-sessoes/${sessaoId}/mensagens`
    );
    return res.data?.data ?? [];
  },

  async arquivarSessao(sessaoId: string): Promise<void> {
    await apiClient.patch(`/chat-sessoes/${sessaoId}`, { arquivada: true });
  },

  async feedback(mensagemId: string, positive: boolean): Promise<void> {
    await apiClient.patch(
      `/chat-mensagens/${mensagemId}`,
      { satisfacao: positive ? 1 : 0 },
      { timeout: 15_000 }
    );
  },
};
