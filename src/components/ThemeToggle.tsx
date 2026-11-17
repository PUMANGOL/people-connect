import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { alternarTema, temaActual } from '@/src/lib/tema';

export function ThemeToggle({ className }: { className?: string }) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(temaActual() === 'escuro');
  }, []);

  return (
    <button
      type="button"
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setEscuro(alternarTema() === 'escuro')}
      className={cn(
        'p-2 rounded-md hover:bg-neutral-100 transition-colors text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30',
        className,
      )}
    >
      {escuro ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
