import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useLoadingStore } from '@/src/store/loading.store';

/**
 * Loader global: emblema People Connect com ondas verdes a expandir à volta,
 * fixo e centrado no ecrã. Animações em `.app-loader-*` (src/index.css).
 */
export function AppLoader({ label = 'A carregar…', sobreposto = false }: {
  label?: string;
  /** Por cima de uma página já aberta: fundo translúcido em vez de opaco. */
  sobreposto?: boolean;
}) {
  // Regista-se como visível: o chat do Pumuki esconde-se enquanto houver um loader no ecrã.
  useEffect(() => {
    const { mostrarLoader, esconderLoader, abrirJanela } = useLoadingStore.getState();
    mostrarLoader();
    return () => {
      esconderLoader();
      // Loader de ecrã inteiro (Suspense/guard) a sair = a página vai montar agora:
      // os pedidos iniciais dela ainda contam como mudança de página.
      if (!sobreposto) abrirJanela();
    };
  }, [sobreposto]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center',
        sobreposto ? 'bg-background/70 backdrop-blur-[2px] animate-in fade-in duration-200' : 'bg-background',
      )}
    >
      <div className="app-loader relative flex h-32 w-32 items-center justify-center">
        <span aria-hidden="true" className="app-loader-onda" />
        <span aria-hidden="true" className="app-loader-onda" style={{ animationDelay: '0.8s' }} />
        <span aria-hidden="true" className="app-loader-onda" style={{ animationDelay: '1.6s' }} />
        <img
          src="/people-connect-emblema.png"
          alt=""
          className="app-loader-emblema relative h-full w-full object-contain"
        />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
