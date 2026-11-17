import { apiClient } from './api.client';

export interface MembroGrupo {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

export interface GrupoPainel {
  id: string;
  nome: string;
  chave: string;
  descricao: string | null;
  sistema: boolean;
  membros: MembroGrupo[];
  acesso_ids: string[];
}

export interface AcessoPainel {
  id: string;
  chave: string;
  nome: string;
  rota: string;
  modulo: string;
  perfis: string[];
  ordem: number;
  restrito: boolean;
  sistema: boolean;
}

export interface PainelAcessos {
  eu_id: string;
  grupos: GrupoPainel[];
  acessos: AcessoPainel[];
  utilizadores: MembroGrupo[];
}

function data<T>(pedido: Promise<{ data: { data: T } }>): Promise<T> {
  return pedido.then((resposta) => resposta.data.data);
}

const silencio = { semAviso: true } as const;

export const acessosService = {
  painel: () => data<PainelAcessos>(apiClient.get('/acessos')),
  criarGrupo: (nome: string, descricao: string) =>
    data<PainelAcessos>(apiClient.post('/grupos', { nome, descricao }, silencio)),
  guardarGrupo: (
    id: string,
    body: { nome?: string; descricao?: string; utilizador_ids?: string[]; acesso_ids?: string[] },
  ) => data<PainelAcessos>(apiClient.patch(`/grupos/${id}`, body, silencio)),
  apagarGrupo: (id: string) => data<PainelAcessos>(apiClient.delete(`/grupos/${id}`, silencio)),
  restrito: (id: string, restrito: boolean) =>
    data<PainelAcessos>(apiClient.patch(`/acessos/${id}`, { restrito }, silencio)),
};
