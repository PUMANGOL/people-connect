import { apiClient } from './api.client';

export interface KbDocumento {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  direccao: string;
  tipo_ficheiro: string;
  tamanho_bytes: number;
  estado: 'processando' | 'indexado' | 'falha' | 'arquivado';
  chunks_total: number;
  embedding_model: string;
  erro_processamento: string | null;
  texto_fonte?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbChunkPreview {
  id: string;
  ordem: number;
  conteudo: string;
  tokens: number;
  metadata: { pagina?: number };
}

export interface UploadResult {
  id: string;
  titulo: string;
  chunks: number;
  estado: string;
}

export interface KbTestHit {
  id: string;
  score: number;
  origem: 'kb' | 'faq';
  titulo: string;
  pagina: number | null;
  direccao?: string;
  excerpt: string;
}

export interface KbTestResult {
  stats: {
    total_documentos: number;
    documentos_indexados: number;
    total_chunks: number;
    faqs_publicadas: number;
    faqs_com_embedding: number;
    threshold_relevancia: number;
    top_k: number;
    nvidia_ready: boolean;
    embed_model: string;
  };
  query?: {
    texto: string;
    latencia_ms: number;
    top_score: number;
    acima_do_threshold: boolean;
    precisa_escalar: boolean;
    hits: number;
  };
  hits?: KbTestHit[];
  hint?: string;
}

export const kbService = {
  async list(params?: { estado?: string; direccao?: string }): Promise<KbDocumento[]> {
    const res = await apiClient.get<{ data: KbDocumento[] }>('/kb-documentos', { params });
    return res.data?.data ?? [];
  },

  async get(id: string): Promise<{ documento: KbDocumento; chunks_preview: KbChunkPreview[] }> {
    const res = await apiClient.get<{
      data: { documento: KbDocumento; chunks_preview: KbChunkPreview[] };
    }>(`/kb-documentos/${id}`);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/kb-documentos/${id}`);
  },

  async update(id: string, data: Partial<KbDocumento>): Promise<KbDocumento> {
    const res = await apiClient.patch<{ data: KbDocumento }>(`/kb-documentos/${id}`, data);
    return res.data.data;
  },

  async reindex(id: string): Promise<{ chunks: number; modo: string }> {
    const res = await apiClient.post<{ data: { chunks: number; modo: string } }>('/kb-reindex', {
      id,
    });
    return res.data.data;
  },

  async createManual(params: {
    titulo: string;
    texto: string;
    categoria: string;
    direccao: string;
    descricao?: string;
  }): Promise<UploadResult> {
    const res = await apiClient.post<{ data: UploadResult }>('/kb-manual', params);
    return res.data.data;
  },

  async test(q?: string): Promise<KbTestResult> {
    const res = await apiClient.get<KbTestResult>('/kb-test', {
      params: q ? { q } : undefined,
      silencioso: true,
    });
    return res.data;
  },

  /**
   * Upload de PDF/DOCX. Devolve o documento indexado (ou existente se hash duplicado).
   */
  async upload(params: {
    file: File;
    titulo: string;
    categoria: string;
    direccao: string;
    criado_por?: string;
  }): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('titulo', params.titulo);
    formData.append('categoria', params.categoria);
    formData.append('direccao', params.direccao);
    if (params.criado_por) formData.append('criado_por', params.criado_por);

    const headers: HeadersInit = {};
    try {
      const token =
        sessionStorage.getItem('pumangol-auth-token') ??
        localStorage.getItem('pumangol-auth-token');
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* optional */
    }

    const res = await fetch('/api/kb-upload', {
      method: 'POST',
      body: formData,
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? 'Falha no upload');
    }
    const data = await res.json();
    return data.data as UploadResult;
  },
};
