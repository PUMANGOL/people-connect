import { apiClient } from './api.client';
import type { FAQ } from '@/lib/types';

export type FaqCreate = {
  direccao: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  variantes?: string[];
  palavras_chave?: string[];
  owner?: string | null;
  estado?: string;
};

export const faqsService = {
  async list(params?: { estado?: string; direccao?: string }): Promise<FAQ[]> {
    const res = await apiClient.get<{ data: FAQ[] }>('/faqs', { params });
    return res.data?.data ?? [];
  },

  async create(body: FaqCreate): Promise<FAQ> {
    const res = await apiClient.post<{ data: FAQ }>('/faqs', body);
    return res.data.data;
  },

  async update(id: string, body: Partial<FaqCreate>): Promise<FAQ> {
    const res = await apiClient.patch<{ data: FAQ }>(`/faqs/${id}`, body);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/faqs/${id}`);
  },

  async reindexEmbeddings(): Promise<{ processed: number; errors: number }> {
    const res = await apiClient.post<{ data: { processed: number; errors: number } }>(
      '/faqs/reindex-embeddings'
    );
    return res.data.data;
  },
};
