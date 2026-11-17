import { apiClient, comRepeticao } from './api.client';

export type Reacao = 'like';

export interface ComunidadePost {
  id: string;
  titulo: string | null;
  conteudo: string;
  imagem: string | null;
  fixado: boolean;
  created_at: string;
  updated_at: string;
  autor_id: string | null;
  autor_nome: string | null;
  likes: number;
  minha_reacao: Reacao | null;
  total_comentarios: number;
}

export interface ComunidadeComentario {
  id: string;
  conteudo: string;
  created_at: string;
  autor_id: string | null;
  autor_nome: string | null;
  autor_perfil: string | null;
}

export interface PostPayload {
  titulo?: string | null;
  conteudo?: string;
  imagem?: string | null;
  fixado?: boolean;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const comunidadeService = {
  feed: (offset = 0, limite = 20) =>
    comRepeticao(() =>
      apiClient
        // Só a primeira página mostra o loader global; "carregar mais" tem o seu indicador.
        .get<{ data: ComunidadePost[]; has_more: boolean }>('/comunidade/posts', {
          params: { offset, limite },
          silencioso: offset > 0,
          semAviso: true,
          timeout: 20_000,
        })
        .then((r) => r.data),
    ),
  obter: (id: string) => data<ComunidadePost>(apiClient.get(`/comunidade/posts/${id}`)),
  criar: (p: PostPayload) => data<{ id: string }>(apiClient.post('/comunidade/posts', p)),
  actualizar: (id: string, p: PostPayload) => data<{ ok: boolean }>(apiClient.patch(`/comunidade/posts/${id}`, p)),
  remover: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/comunidade/posts/${id}`)),
  reagir: (id: string, tipo: Reacao | null) =>
    data<{ likes: number; minha_reacao: Reacao | null }>(
      apiClient.post(`/comunidade/posts/${id}/reacao`, { tipo }),
    ),
  comentarios: (id: string) => data<ComunidadeComentario[]>(apiClient.get(`/comunidade/posts/${id}/comentarios`, { silencioso: true })),
  comentar: (id: string, conteudo: string) =>
    data<ComunidadeComentario>(apiClient.post(`/comunidade/posts/${id}/comentarios`, { conteudo })),
  removerComentario: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/comunidade/comentarios/${id}`)),
};
