import { apiClient } from './api.client';

export type CategoriaEvento = 'oficial' | 'formacao' | 'comunidade' | 'obrigatorio' | 'bem_estar';
export type ZonaEvento = 'sede' | 'talatona' | 'academia' | 'postos' | 'online';

export interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaEvento;
  local: string | null;
  zona: ZonaEvento | null;
  link_online: string | null;
  imagem: string | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  destaque: boolean;
  confirmados: number;
  eu_confirmei: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventoPayload {
  titulo: string;
  descricao?: string | null;
  categoria: CategoriaEvento;
  local?: string | null;
  zona?: ZonaEvento | null;
  link_online?: string | null;
  imagem?: string | null;
  inicio: string;
  fim?: string | null;
  dia_inteiro?: boolean;
  destaque?: boolean;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const eventosService = {
  /** Eventos que se sobrepõem ao intervalo [de, ate). */
  intervalo: (de: Date, ate: Date) =>
    data<Evento[]>(apiClient.get('/eventos', { params: { de: de.toISOString(), ate: ate.toISOString() } })),
  destaque: () => data<Evento | null>(apiClient.get('/eventos/destaque')),
  meus: () => data<Evento[]>(apiClient.get('/eventos/meus')),
  criar: (p: EventoPayload) => data<{ id: string }>(apiClient.post('/eventos', p)),
  actualizar: (id: string, p: EventoPayload) => data<{ ok: boolean }>(apiClient.patch(`/eventos/${id}`, p)),
  remover: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/eventos/${id}`)),
  confirmar: (id: string) => data<Evento>(apiClient.post(`/eventos/${id}/presenca`, {})),
  cancelarPresenca: (id: string) => data<Evento>(apiClient.delete(`/eventos/${id}/presenca`)),
};
