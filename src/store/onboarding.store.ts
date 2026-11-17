import { create } from 'zustand';
import type { EstadoOnboarding } from '@/lib/types';

interface FiltrosOnboarding {
  direccao: string | null;
  estado: EstadoOnboarding | null;
  trilho: string | null;
  search: string;
}

interface OnboardingState {
  trilhoActivoId: string | null;
  colaboradorActivoId: string | null;
  filtros: FiltrosOnboarding;

  setTrilhoActivo: (id: string | null) => void;
  setColaboradorActivo: (id: string | null) => void;
  setFiltros: (filtros: Partial<FiltrosOnboarding>) => void;
  resetFiltros: () => void;
}

const defaultFiltros: FiltrosOnboarding = {
  direccao: null,
  estado: null,
  trilho: null,
  search: '',
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  trilhoActivoId: null,
  colaboradorActivoId: null,
  filtros: { ...defaultFiltros },

  setTrilhoActivo: (id) => set({ trilhoActivoId: id }),
  setColaboradorActivo: (id) => set({ colaboradorActivoId: id }),
  setFiltros: (partial) => set((s) => ({ filtros: { ...s.filtros, ...partial } })),
  resetFiltros: () => set({ filtros: { ...defaultFiltros } }),
}));
