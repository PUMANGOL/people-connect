import { FileQuestion } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store';
import { homeForRole } from '@/lib/constants';

export default function NotFound() {
  const navigate = useNavigate();
  const { role } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-navy-50 text-navy-400 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">404</h1>
        <p className="text-lg font-medium text-foreground mb-2">Página Não Encontrada</p>
        <p className="text-muted-foreground mb-8">
          A página que procura não existe ou foi movida.
        </p>
        <Button variant="primary" onClick={() => navigate(homeForRole(role), { replace: true })}>
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
