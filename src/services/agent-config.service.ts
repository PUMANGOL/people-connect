import { apiClient } from './api.client';

export interface AgentConfig {
  system_prompt: string;
  mensagem_boas_vindas: string;
  email_escalacao: string;
  temperature: number;
  max_tokens: number;
  top_k: number;
  min_relevance_score: number;
  max_tool_steps: number;
  reasoning_effort: 'low' | 'medium' | 'high';
  updated_at?: string | null;
  source?: 'db' | 'defaults';
}

export interface AgentPublicConfig {
  mensagem_boas_vindas: string;
  email_escalacao: string;
}

export type AgentConfigUpdate = Partial<
  Omit<AgentConfig, 'updated_at' | 'source'>
>;

export const agentConfigService = {
  async getAdmin(): Promise<{ data: AgentConfig; defaults: AgentConfig }> {
    const res = await apiClient.get<{ data: AgentConfig; defaults: AgentConfig }>(
      '/agent-config'
    );
    return { data: res.data.data, defaults: res.data.defaults };
  },

  async getPublic(): Promise<AgentPublicConfig> {
    const res = await apiClient.get<{ data: AgentPublicConfig }>(
      '/agent-config',
      { params: { public: '1' } }
    );
    return res.data.data;
  },

  async update(body: AgentConfigUpdate): Promise<AgentConfig> {
    const res = await apiClient.patch<{ data: AgentConfig }>('/agent-config', body);
    return res.data.data;
  },

  async reset(): Promise<AgentConfig> {
    const res = await apiClient.post<{ data: AgentConfig }>('/agent-config/reset');
    return res.data.data;
  },
};
