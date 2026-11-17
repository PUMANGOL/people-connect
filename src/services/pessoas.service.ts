import { apiClient } from './api.client';

export interface PessoaResumo {
  id: string;
  nome: string;
  perfil: string;
  /** Está na lista de mentores (grupo ou atribuição activa). O perfil `mentor` é só colaborador. */
  e_mentor: boolean;
  funcao: string | null;
  direccao: string | null;
  foto_url: string | null;
}

export interface PessoaEstrutura {
  id: string;
  nome: string;
  funcao: string | null;
  foto_url: string | null;
}

/** Posição na estrutura orgânica (BD + directório Microsoft). */
export interface Estrutura {
  direccao: string | null;
  unidade: string | null;
  cargo: string | null;
  local_trabalho: string | null;
  cidade: string | null;
  lideranca: PessoaEstrutura[];
  colegas: { ambito: 'unidade' | 'direccao'; total: number; pessoas: PessoaEstrutura[] };
}

export interface PessoaActividade {
  tipo: 'publicacao' | 'comentario';
  post_id: string;
  titulo: string;
  texto: string;
  created_at: string;
}

export interface PessoaPerfil {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  e_mentor: boolean;
  activo: boolean;
  funcao: string | null;
  direccao: string | null;
  area: string | null;
  categoria: string | null;
  data_admissao: string | null;
  bio: string | null;
  foto_url: string | null;
  capa_url: string | null;
  localizacao: string | null;
  extensao: string | null;
  disponibilidade: 'disponivel' | 'ocupado' | 'ausente' | null;
  posso_ajudar: string[];
  interesses: string[];
  membro_desde: string;
  estrutura: Estrutura;
  estatisticas: { publicacoes: number; comentarios: number; gostos: number };
  actividade: PessoaActividade[];
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const pessoasService = {
  pesquisar: (q: string, signal?: AbortSignal) =>
    data<PessoaResumo[]>(apiClient.get('/pessoas', { params: { q }, signal, silencioso: true })),
  perfil: (id: string) => data<PessoaPerfil>(apiClient.get(`/pessoas/${id}`)),
};

export const PERFIL_LABEL: Record<string, string> = {
  rh_admin: 'Administrador DPC',
  mentor: 'Mentor',
  novo_colaborador: 'Colaborador',
};

/** «Mentor» só para quem está na lista. O perfil interno `mentor` é colaborador. */
export function rotuloPessoa(perfil: string, eMentor = false): string {
  if (eMentor) return 'Mentor';
  if (perfil === 'rh_admin') return PERFIL_LABEL.rh_admin;
  return 'Colaborador';
}
