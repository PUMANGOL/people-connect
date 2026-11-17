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
  /** Mentorados com atribuição activa */
  mentorados_activos: number;
  /** Está no grupo de acesso Mentores */
  no_grupo_mentores: boolean;
  /** Tem um mentor atribuído (é mentorado de alguém) */
  tem_mentor: boolean;
}

export type OperacaoPapel =
  | 'remover_mentor'
  | 'remover_mentorado'
  | 'mentorado_para_colaborador'
  | 'colaborador_para_mentor'
  | 'mentor_para_colaborador';

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const utilizadoresService = {
  list: () => data<UtilizadorRow[]>(apiClient.get('/utilizadores')),
  /** Promove a administrador (`true`) ou retira (`false` — volta a mentor ou colaborador). */
  setAdmin: (id: string, admin: boolean) =>
    data<{ id: string; perfil: UtilizadorRow['perfil'] }>(apiClient.patch(`/utilizadores/${id}`, { admin })),
  papel: (id: string, operacao: OperacaoPapel) =>
    data<{ id: string; perfil: UtilizadorRow['perfil']; operacao: OperacaoPapel }>(
      apiClient.post(`/utilizadores/${id}/papel`, { operacao }),
    ),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/utilizadores/${id}`)),
};
