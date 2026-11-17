import { apiClient } from './api.client';
import type {
  OnboardingProcess,
  Etapa,
  ApiResponse,
  PaginatedResponse,
} from '@/lib/types';

export interface CreateOnboardingPayload {
  nome: string;
  email: string;
  departamento: string;
  data_inicio: string;
  template_id: string;
}

export interface OnboardingFilters {
  estado?: string;
  departamento?: string;
  nome?: string;
  page?: number;
  limit?: number;
}

export const onboardingService = {
  create: (payload: CreateOnboardingPayload) =>
    apiClient.post<ApiResponse<OnboardingProcess>>('/onboarding', payload).then((r) => r.data),

  list: (filters: OnboardingFilters = {}) =>
    apiClient
      .get<PaginatedResponse<OnboardingProcess>>('/onboarding', { params: filters })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ApiResponse<OnboardingProcess>>(`/onboarding/${id}/detalhe`).then((r) => r.data),

  getByToken: (token: string) =>
    apiClient.get<ApiResponse<OnboardingProcess>>(`/onboarding/token/${token}`).then((r) => r.data),

  concluirEtapa: (etapaId: string) =>
    apiClient.patch<ApiResponse<Etapa>>(`/onboarding/etapas/${etapaId}/concluir`).then((r) => r.data),

  aprovarEtapa: (etapaId: string) =>
    apiClient.patch<ApiResponse<Etapa>>(`/onboarding/etapas/${etapaId}/aprovar`).then((r) => r.data),

  marcarFormacaoConcluida: (etapaId: string) =>
    apiClient
      .patch<ApiResponse<Etapa>>(`/onboarding/etapas/${etapaId}/formacao-concluida`)
      .then((r) => r.data),

  enviarLembrete: (processoId: string) =>
    apiClient.post<ApiResponse<void>>(`/onboarding/${processoId}/lembrete`).then((r) => r.data),

  getTemplates: () =>
    apiClient.get<ApiResponse<{ id: string; nome: string }[]>>('/onboarding/templates').then((r) => r.data),
};
