import { apiClient } from './api.client';

export interface CatalogoFuncao {
  id: string;
  nome: string;
  activo: boolean;
  ordem: number;
}

export interface CatalogoDireccao {
  id: string;
  nome: string;
  sigla: string;
  activo: boolean;
  ordem: number;
}

export interface CatalogoCategoria {
  id: string;
  slug: string;
  nome: string;
  activo: boolean;
  ordem: number;
}

export interface Catalogos {
  funcoes: CatalogoFuncao[];
  direccoes: CatalogoDireccao[];
  categorias: CatalogoCategoria[];
}

type TipoCatalogo = 'funcoes' | 'direccoes' | 'categorias';

async function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export const catalogosService = {
  /** `silencioso`: opções de dropdowns (useCatalogo) — não mostra o loader global. */
  list: (silencioso = false) => data<Catalogos>(apiClient.get('/catalogos', { silencioso })),
  create: (tipo: TipoCatalogo, nome: string) =>
    data<CatalogoFuncao | CatalogoDireccao | CatalogoCategoria>(apiClient.post(`/catalogos/${tipo}`, { nome })),
  update: (tipo: TipoCatalogo, id: string, payload: { nome?: string; activo?: boolean }) =>
    data<CatalogoFuncao | CatalogoDireccao | CatalogoCategoria>(apiClient.patch(`/catalogos/${tipo}/${id}`, payload)),
  desactivar: (tipo: TipoCatalogo, id: string) =>
    data<{ ok: boolean }>(apiClient.delete(`/catalogos/${tipo}/${id}`)),
};
