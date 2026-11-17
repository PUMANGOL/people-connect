import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, UserRole } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  processoId: string | null;

  setUser: (user: AuthUser) => void;
  setRole: (role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  setProcessoId: (id: string) => void;
  clearUser: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      processoId: null,

      setUser: (user) =>
        set({
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
          processoId: user.processo_id ?? null,
        }),

      setRole: (role) => set({ role }),

      setLoading: (isLoading) => set({ isLoading }),

      setProcessoId: (processoId) => set({ processoId }),

      clearUser: () =>
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
          processoId: null,
        }),

      logout: () => {
        set({
          user: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
          processoId: null,
        });
        window.dispatchEvent(new CustomEvent('auth:logout'));
      },
    }),
    {
      name: 'pumangol-auth',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        processoId: state.processoId,
      }),
    }
  )
);
