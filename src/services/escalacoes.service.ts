import { apiClient } from './api.client';

export interface EscalacaoApi {
  id: string;
  mensagem_id: string;
  sessao_id: string;
  utilizador_id: string | null;
  pergunta: string;
  contexto: string | null;
  estado: string;
  atribuido_a: string | null;
  resposta_dpc: string | null;
  respondida_em: string | null;
  criado_em: string;
  utilizador_nome?: string | null;
  utilizador_email?: string | null;
}

export const escalacoesService = {
  async list(estado?: string): Promise<EscalacaoApi[]> {
    const res = await apiClient.get<{ data: EscalacaoApi[] }>('/escalacoes', {
      params: estado ? { estado } : {},
    });
    return res.data?.data ?? [];
  },

  async update(
    id: string,
    body: { estado?: string; resposta_dpc?: string; atribuido_a?: string }
  ): Promise<EscalacaoApi> {
    const res = await apiClient.patch<{ data: EscalacaoApi }>(`/escalacoes/${id}`, body);
    return res.data.data;
  },
};
