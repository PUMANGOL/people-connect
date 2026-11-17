import { apiClient } from './api.client';
import type { Vaga, Candidato, Entrevista, PaginatedResponse, ApiResponse } from '@/lib/types';

// Endpoints alinhados com as Netlify Functions em netlify/functions/*
// A base URL vem do api.client (VITE_API_BASE_URL ?? '/api')
export const recrutamentoService = {
  // Vagas
  listVagas(params?: { estado?: string; direccao?: string; search?: string; page?: number; limit?: number }) {
    return apiClient.get<PaginatedResponse<Vaga>>('/vagas', { params });
  },
  getVaga(id: string) {
    return apiClient.get<ApiResponse<Vaga>>(`/vagas/${id}`);
  },
  createVaga(data: Partial<Vaga>) {
    return apiClient.post<ApiResponse<Vaga>>('/vagas', data);
  },
  updateVaga(id: string, data: Partial<Vaga>) {
    return apiClient.patch<ApiResponse<Vaga>>(`/vagas/${id}`, data);
  },
  cancelVaga(id: string, motivo: string) {
    return apiClient.patch<ApiResponse<Vaga>>(`/vagas/${id}`, { estado: 'cancelada', motivo });
  },

  // Candidatos
  listCandidatos(params?: { vaga_id?: string; estado_pipeline?: string; origem?: string; search?: string; page?: number; limit?: number }) {
    return apiClient.get<PaginatedResponse<Candidato>>('/candidatos', { params });
  },
  getCandidato(id: string) {
    return apiClient.get<ApiResponse<Candidato>>(`/candidatos/${id}`);
  },
  createCandidato(data: Partial<Candidato>) {
    return apiClient.post<ApiResponse<Candidato>>('/candidatos', data);
  },
  updateCandidato(id: string, data: Partial<Candidato>) {
    return apiClient.patch<ApiResponse<Candidato>>(`/candidatos/${id}`, data);
  },
  moveCandidato(id: string, novaFase: string, nota?: string) {
    return apiClient.patch<ApiResponse<Candidato>>(`/candidatos/${id}`, { estado_pipeline: novaFase, nota });
  },

  // Entrevistas
  listEntrevistas(params?: { candidato_id?: string; vaga_id?: string; page?: number; limit?: number }) {
    return apiClient.get<PaginatedResponse<Entrevista>>('/entrevistas', { params });
  },
  getEntrevista(id: string) {
    return apiClient.get<ApiResponse<Entrevista>>(`/entrevistas/${id}`);
  },
  createEntrevista(data: Partial<Entrevista>) {
    return apiClient.post<ApiResponse<Entrevista>>('/entrevistas', data);
  },
  updateEntrevista(id: string, data: Partial<Entrevista>) {
    return apiClient.patch<ApiResponse<Entrevista>>(`/entrevistas/${id}`, data);
  },

  // Pipeline de uma vaga
  getVagaPipeline(vagaId: string) {
    return apiClient.get<ApiResponse<Candidato[]>>(`/candidatos`, { params: { vaga_id: vagaId } });
  },
};
