import { ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store';
import { homeForRole, ROUTES } from '@/lib/constants';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { role, logout } = useAuthStore();
  const home = homeForRole(role);

  async function handleSair() {
    try {
      const { logoutMsal, MSAL_CONFIGURED } = await import('@/src/services/msal.service');
      if (MSAL_CONFIGURED) await logoutMsal();
    } catch {
      // silencioso
    }
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-error-50 text-error-500 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">403</h1>
        <p className="text-lg font-medium text-foreground mb-2">Acesso Não Autorizado</p>
        <p className="text-muted-foreground mb-8">
          Não tem permissão para aceder a esta página. Contacte a equipa da DPC em{' '}
          <a href="mailto:dpc@pumangol.ao" className="text-gold-600 font-medium hover:underline">
            dpc@pumangol.ao
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate(-1)}>Voltar</Button>
          <Button variant="primary" onClick={() => navigate(home, { replace: true })}>
            Ir para o meu Dashboard
          </Button>
          <Button variant="ghost" leftIcon={<LogOut className="w-4 h-4" />} onClick={handleSair}>
            Sair da sessão
          </Button>
        </div>
      </div>
    </div>
  );
}
