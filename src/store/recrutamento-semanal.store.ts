import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CandidatoImportado, EstadoCandidatoImportado, RegistoSemanal } from '@/lib/types';

interface RecrutamentoSemanalState {
  registos: RegistoSemanal[];
  candidatos: CandidatoImportado[];
  importadoEm: string | null;

  setRegistos: (registos: RegistoSemanal[], importadoEm: string) => void;
  setCandidatos: (candidatos: CandidatoImportado[]) => void;
  updateCandidato: (id: string, patch: Partial<CandidatoImportado>) => void;
  updateEstado: (id: string, estado: EstadoCandidatoImportado) => void;
  clear: () => void;
}

export const useRecrutamentoSemanalStore = create<RecrutamentoSemanalState>()(
  persist(
    (set) => ({
      registos: [],
      candidatos: [],
      importadoEm: null,

      setRegistos: (registos, importadoEm) => set({ registos, importadoEm }),
      setCandidatos: (candidatos) => set({ candidatos }),
      updateCandidato: (id, patch) => set((state) => ({
        candidatos: state.candidatos.map((c) => c.id === id ? { ...c, ...patch } : c),
      })),
      updateEstado: (id, estado) => set((state) => ({
        candidatos: state.candidatos.map((c) => c.id === id ? { ...c, estado } : c),
      })),

      clear: () => set({ registos: [], candidatos: [], importadoEm: null }),
    }),
    {
      name: 'pumangol-recrutamento-semanal',
      version: 2,
    }
  )
);
