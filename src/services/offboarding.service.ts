import { apiClient } from './api.client';
import type {
  OffboardingProcess,
  TarefaOffboarding,
  OffboardingMotivo,
  ApiResponse,
  PaginatedResponse,
} from '@/lib/types';

export interface CreateOffboardingPayload {
  colaborador_id: string;
  data_saida: string;
  motivo: OffboardingMotivo;
  template_id?: string;
}

export const offboardingService = {
  create: (payload: CreateOffboardingPayload) =>
    apiClient
      .post<ApiResponse<OffboardingProcess>>('/offboarding', payload)
      .then((r) => r.data),

  list: (params: { estado?: string; page?: number; limit?: number } = {}) =>
    apiClient
      .get<PaginatedResponse<OffboardingProcess>>('/offboarding', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ApiResponse<OffboardingProcess>>(`/offboarding/${id}`).then((r) => r.data),

  concluirTarefa: (tarefaId: string) =>
    apiClient
      .patch<ApiResponse<TarefaOffboarding>>(`/offboarding/tarefas/${tarefaId}/concluir`)
      .then((r) => r.data),

  validarTarefa: (tarefaId: string) =>
    apiClient
      .patch<ApiResponse<TarefaOffboarding>>(`/offboarding/tarefas/${tarefaId}/validar`)
      .then((r) => r.data),

  arquivar: (processoId: string) =>
    apiClient
      .post<ApiResponse<OffboardingProcess>>(`/offboarding/${processoId}/arquivar`)
      .then((r) => r.data),
};
