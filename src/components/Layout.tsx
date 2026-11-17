import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AuthUser } from '@/lib/types';
import { destinoQuandoBloqueado } from '@/lib/paginas';
import { apiClient } from '@/src/services/api.client';
import { useAuthStore } from '@/src/store/auth.store';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useUIStore } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import { PumukiChat } from './assistente/PumukiChat';
import { motion } from 'motion/react';
import { fadeInUp } from '@/src/lib/animations';

export function Layout() {
  const { sidebarCollapsed } = useUIStore();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const bloqueio = user?.paginas ? destinoQuandoBloqueado(location.pathname, user.paginas) : null;

  // Revalida a sessão guardada no browser: o perfil pode ter mudado entretanto
  // (ex.: promovido a admin) e `is_mentor` não existia em sessões antigas.
  useEffect(() => {
    const { user, setUser } = useAuthStore.getState();
    if (!user || user.processo_id) return; // acesso por link de onboarding não usa sessão
    apiClient
      .get<{ data: AuthUser }>('/sessao', { silencioso: true })
      .then((res) => {
        const atual = res.data.data;
        if (
          atual.role !== user.role || atual.is_mentor !== user.is_mentor
          || atual.nome !== user.nome || (atual.foto_url ?? null) !== (user.foto_url ?? null)
          || (atual.funcao ?? null) !== (user.funcao ?? null)
          || (atual.departamento ?? null) !== (user.departamento ?? null)
          || atual.is_dev !== user.is_dev
          || JSON.stringify(atual.paginas ?? []) !== JSON.stringify(user.paginas ?? [])
        ) {
          setUser({ ...user, ...atual });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-background flex pt-[67px]">
      {/* Barra de topo fixa (largura total); menu lateral por baixo dela */}
      <TopNav />
      <Sidebar />
      {/* Pumuki — assistente (Dify via API) em bolha flutuante, só nas páginas autenticadas */}
      <PumukiChat />
      <div className={cn(
        'flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out',
        sidebarCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[240px]',
      )}>
        <main className="relative flex-1 min-w-0 p-6 md:p-8 overflow-x-clip">
          <motion.div
            initial={false}
            animate="visible"
            variants={fadeInUp}
            className="mx-auto max-w-7xl"
          >
            {bloqueio ? <Navigate to={bloqueio} replace /> : <Outlet />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
