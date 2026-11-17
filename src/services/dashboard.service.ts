import { apiClient } from './api.client';
import type { DashboardSummary, Alerta, ApiResponse } from '@/lib/types';

export const dashboardService = {
  getSummary: () =>
    apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary').then((r) => r.data),

  getAlertas: () =>
    apiClient.get<ApiResponse<Alerta[]>>('/dashboard/alertas').then((r) => r.data),

  dispensarAlerta: (alertaId: string) =>
    apiClient
      .post<ApiResponse<void>>(`/dashboard/alertas/${alertaId}/dispensar`)
      .then((r) => r.data),
};
