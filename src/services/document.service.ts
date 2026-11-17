import { apiClient } from './api.client';
import type { Documento, ApiResponse } from '@/lib/types';

export const documentService = {
  listByProcesso: (processoId: string) =>
    apiClient
      .get<ApiResponse<Documento[]>>('/documents', { params: { processo_id: processoId } })
      .then((r) => r.data),

  upload: (processoId: string, tipo: string, file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('processo_id', processoId);
    formData.append('tipo', tipo);

    return apiClient
      .post<ApiResponse<Documento>>('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onProgress && evt.total) {
            onProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      })
      .then((r) => r.data);
  },

  getDocumentosObrigatorios: () =>
    apiClient
      .get<ApiResponse<{ tipo: string; nome: string; obrigatorio: boolean }[]>>('/documents/tipos')
      .then((r) => r.data),
};
