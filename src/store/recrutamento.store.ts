import { create } from 'zustand';
import type { EstadoPipeline, EstadoVaga } from '@/lib/types';

interface FiltrosPipeline {
  direccao: string | null;
  estado: EstadoVaga | null;
  search: string;
}

interface RecrutamentoState {
  vagaActivaId: string | null;
  viewMode: 'kanban' | 'lista';
  filtros: FiltrosPipeline;

  setVagaActiva: (id: string | null) => void;
  setViewMode: (mode: 'kanban' | 'lista') => void;
  setFiltros: (filtros: Partial<FiltrosPipeline>) => void;
  resetFiltros: () => void;
}

const defaultFiltros: FiltrosPipeline = {
  direccao: null,
  estado: null,
  search: '',
};

export const useRecrutamentoStore = create<RecrutamentoState>((set) => ({
  vagaActivaId: null,
  viewMode: 'kanban',
  filtros: { ...defaultFiltros },

  setVagaActiva: (id) => set({ vagaActivaId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setFiltros: (partial) => set((s) => ({ filtros: { ...s.filtros, ...partial } })),
  resetFiltros: () => set({ filtros: { ...defaultFiltros } }),
}));
