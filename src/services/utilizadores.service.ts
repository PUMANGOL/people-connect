import { apiClient } from './api.client';

/**
 * Gestão administrativa de utilizadores.
 * Só rh_admin. Ver netlify/functions/utilizadores.ts.
 */

export interface UtilizadorRow {
  id: string;
  nome: string;
  email: string;
  perfil: 'rh_admin' | 'mentor' | 'novo_colaborador';
  departamento: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
  /** 1 se este utilizador tem linha na tabela colaboradores */
  is_colaborador: number;
  /** 1 se este utilizador é um mentor activo */
  is_mentor_activo: number;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const utilizadoresService = {
  list: () => data<UtilizadorRow[]>(apiClient.get('/utilizadores')),
  /** Promove a administrador (`true`) ou retira (`false` — volta a mentor ou colaborador). */
  setAdmin: (id: string, admin: boolean) =>
    data<{ id: string; perfil: UtilizadorRow['perfil'] }>(apiClient.patch(`/utilizadores/${id}`, { admin })),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/utilizadores/${id}`)),
};
