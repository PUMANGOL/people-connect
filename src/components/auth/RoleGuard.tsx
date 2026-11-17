import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '@/lib/types';
import { paginaMaisEspecifica } from '@/lib/paginas';
import { useAuthStore } from '@/src/store';
import { ROUTES, homeForRole } from '@/lib/constants';

interface RoleGuardProps {
  roles: UserRole[];
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, redirectTo, fallback }: RoleGuardProps) {
  const { isAuthenticated, isLoading, role, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-navy-400 font-medium">A verificar permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo ?? ROUTES.LOGIN} replace />;
  }

  const pagina = user?.paginas?.length
    ? paginaMaisEspecifica(location.pathname, user.paginas)
    : undefined;
  // Página do catálogo: só entra quem a tem num grupo, mesmo que o perfil fosse outro.
  if (pagina) {
    if (pagina.visivel) return <>{children}</>;
  } else if (role && roles.includes(role)) {
    return <>{children}</>;
  }

  if (!role || !roles.includes(role) || pagina) {
    if (fallback) return <>{fallback}</>;
    // Utilizador autenticado com role válido mas sem acesso a esta rota:
    // redirecciona para a home do seu papel em vez de cair no 403.
    // Isto evita loops (ex.: mentor a aterrar em / que é só rh_admin).
    // Só mostramos /unauthorized se já estivermos na home do role
    // (evita ciclo Navigate → Navigate).
    const target = redirectTo ?? homeForRole(role);
    if (target === location.pathname) {
      return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
    }
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
