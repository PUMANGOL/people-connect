import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { welcomeService } from '@/src/services/onboarding-v2.service';
import { useAuthStore } from '@/src/store/auth.store';
import { AppLoader } from '@/src/components/AppLoader';

/**
 * Guard do Welcome Flow (EPIC 2.7).
 * Um novo colaborador sem `welcome_completed` é reencaminhado para /welcome.
 * Admins (sem registo de colaborador) passam sempre — o backend devolve true.
 */
export function WelcomeGuard({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [state, setState] = useState<'checking' | 'ok' | 'redirect'>('checking');

  useEffect(() => {
    // Só o novo colaborador é sujeito ao welcome flow.
    if (user?.role !== 'novo_colaborador') {
      setState('ok');
      return;
    }
    let cancelled = false;
    welcomeService
      .estado()
      .then((e) => !cancelled && setState(e.welcome_completed ? 'ok' : 'redirect'))
      .catch(() => !cancelled && setState('ok')); // falha de rede não deve bloquear acesso
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (state === 'checking') return <AppLoader />;
  if (state === 'redirect') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}
