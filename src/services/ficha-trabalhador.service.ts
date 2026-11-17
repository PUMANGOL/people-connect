import { apiClient } from './api.client';
import type { FichaTrabalhador, FichaTrabalhadorDados } from '@/lib/ficha-trabalhador';

export interface FichaColaboradorResumo {
  id: string;
  nome: string;
  funcao: string | null;
  direccao: string | null;
  data_admissao: string | null;
  email: string | null;
  estado_onboarding: string;
}

export interface FichaAdminRow {
  colaborador: FichaColaboradorResumo;
  ficha: FichaTrabalhador;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

/** Erros por campo devolvidos pelo backend (422) quando a submissão está incompleta. */
export function errosDaResposta(err: unknown): Record<string, string> | null {
  const erros = (err as { response?: { data?: { erros?: Record<string, string> } } })?.response?.data?.erros;
  return erros && typeof erros === 'object' ? erros : null;
}

export const fichaTrabalhadorService = {
  // Colaborador — a própria ficha
  minha: () => data<FichaTrabalhador>(apiClient.get('/ficha-trabalhador')),
  guardarMinha: (ficha: FichaTrabalhadorDados, submeter: boolean) =>
    data<FichaTrabalhador>(apiClient.patch('/ficha-trabalhador', { ficha, submeter })),

  // RH Admin
  listar: () =>
    data<{ fichas: FichaAdminRow[] }>(apiClient.get('/fichas-trabalhador')),
  obter: (colaboradorId: string) => data<FichaTrabalhador>(apiClient.get(`/fichas-trabalhador/${colaboradorId}`)),
  guardar: (colaboradorId: string, ficha: FichaTrabalhadorDados, submeter = false) =>
    data<FichaTrabalhador>(apiClient.patch(`/fichas-trabalhador/${colaboradorId}`, { ficha, submeter })),
};
