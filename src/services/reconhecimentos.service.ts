import { apiClient } from './api.client';

export type ValorId = 'seguranca' | 'cliente' | 'equipa' | 'inovacao' | 'integridade';

export interface ReconhecimentoItem {
  id: string;
  deId: string;
  deNome: string;
  paraId: string | null;
  paraNome: string;
  valor: ValorId;
  mensagem: string;
  visibilidade: 'publico' | 'privado';
  informarChefe: boolean;
  direccao: string;
  posto: boolean;
  createdAt: string;
  aplausos: number;
  aplaudi: boolean;
  comentarios: number;
}

export interface ReconhecimentoPainel {
  itens: ReconhecimentoItem[];
  totalMes: number;
  mesAnterior: number;
  recebidos: number;
  dados: number;
  porValor: { valor: ValorId; n: number }[];
  equipa: { nome: string; aplausos: number } | null;
  destaque: {
    id: string;
    nome: string;
    funcao: string | null;
    direccao: string;
    aplausos: number;
    texto: string;
    votei: boolean;
    votos: number;
  } | null;
  badges: { valor: ValorId; vezes: number }[];
  sugestoes: { id: string; nome: string; detalhe: string }[];
}

export interface NovoReconhecimento {
  destinatarioId?: string | null;
  destinatarioNome: string;
  valor: ValorId;
  mensagem: string;
  visibilidade: 'publico' | 'privado';
  informarChefe: boolean;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const reconhecimentosService = {
  painel: () => data<ReconhecimentoPainel>(apiClient.get('/reconhecimentos')),
  publicar: (body: NovoReconhecimento) =>
    data<{ id: string; directoresInformados: number }>(apiClient.post('/reconhecimentos', body)),
  aplaudir: (id: string) => data<{ aplausos: number; aplaudi: boolean }>(apiClient.post(`/reconhecimentos/${id}/aplauso`)),
  comentar: (id: string, conteudo: string) =>
    data<{ comentarios: number }>(apiClient.post(`/reconhecimentos/${id}/comentarios`, { conteudo })),
  votar: (nomeadoId: string) => data<{ ok: boolean }>(apiClient.post('/reconhecimentos/voto', { nomeadoId })),
};
