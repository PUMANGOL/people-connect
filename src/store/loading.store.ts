import { create } from 'zustand';

// Pedidos iniciados até este tempo depois de uma mudança de página contam para o loader.
const JANELA_MUDANCA_PAGINA_MS = 1000;

/**
 * Estado do loader global.
 * - `pendentes`: pedidos GET à API em curso (interceptores do apiClient) — alimenta o GlobalRequestLoader.
 *   Só contam os pedidos da mudança de página (ver `abrirJanela`); recargas, filtros e gravações não.
 * - `janelaAte`: fim da janela de mudança de página. Abre na navegação e de novo quando sai
 *   um loader de ecrã inteiro (código da página ou guard carregados — a página monta a seguir).
 * - `loadersVisiveis`: AppLoaders no ecrã — enquanto > 0, o chat do Pumuki fica escondido.
 */
interface LoadingState {
  pendentes: number;
  loadersVisiveis: number;
  janelaAte: number;
  abrirJanela: () => void;
  emMudancaDePagina: () => boolean;
  iniciar: () => void;
  terminar: () => void;
  mostrarLoader: () => void;
  esconderLoader: () => void;
}

export const useLoadingStore = create<LoadingState>()((set, get) => ({
  pendentes: 0,
  loadersVisiveis: 0,
  janelaAte: 0,
  abrirJanela: () => set({ janelaAte: Date.now() + JANELA_MUDANCA_PAGINA_MS }),
  emMudancaDePagina: () => Date.now() <= get().janelaAte,
  iniciar: () => set((s) => ({ pendentes: s.pendentes + 1 })),
  terminar: () => set((s) => ({ pendentes: Math.max(0, s.pendentes - 1) })),
  mostrarLoader: () => set((s) => ({ loadersVisiveis: s.loadersVisiveis + 1 })),
  esconderLoader: () => set((s) => ({ loadersVisiveis: Math.max(0, s.loadersVisiveis - 1) })),
}));
