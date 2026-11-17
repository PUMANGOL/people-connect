import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { onboardingService } from '@/src/services/onboarding.service';
import { useAuthStore } from '@/src/store';
import { setOnboardingToken } from '@/src/services/api.client';
import { Shield } from 'lucide-react';

interface TokenGuardProps {
  children: ReactNode;
}

export function TokenGuard({ children }: TokenGuardProps) {
  const { token } = useParams<{ token: string }>();
  const { setUser, setLoading } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    setLoading(true);
    setOnboardingToken(token);

    onboardingService
      .getByToken(token)
      .then((res) => {
        const processo = res.data;
        setUser({
          id: processo.colaborador_id,
          nome: processo.colaborador?.nome ?? 'Colaborador',
          email: processo.colaborador?.email ?? '',
          role: 'novo_colaborador',
          processo_id: processo.id,
        });
        setStatus('valid');
      })
      .catch(() => {
        setOnboardingToken(null);
        setStatus('invalid');
        setLoading(false);
      });
  }, [token, setUser, setLoading]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-gold-600" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-navy-400 font-medium">A validar o seu acesso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return <Navigate to="/link-invalido" replace />;
  }

  return <>{children}</>;
}
