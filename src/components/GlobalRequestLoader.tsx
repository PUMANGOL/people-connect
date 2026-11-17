import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoadingStore } from '@/src/store/loading.store';
import { AppLoader } from './AppLoader';

// Só aparece se o pedido demorar mais do que isto (evita piscar nos pedidos rápidos)…
const ATRASO_MS = 250;
// …e, depois de aparecer, fica pelo menos este tempo (evita um flash curto).
const MINIMO_VISIVEL_MS = 400;

/** Loader global sobreposto enquanto houver pedidos GET da mudança de página em curso. */
export function GlobalRequestLoader() {
  const pendentes = useLoadingStore((s) => s.pendentes);
  const [visivel, setVisivel] = useState(false);
  const mostradoEm = useRef(0);

  useEffect(() => {
    if (pendentes > 0) {
      if (visivel) return;
      const t = window.setTimeout(() => {
        mostradoEm.current = Date.now();
        setVisivel(true);
      }, ATRASO_MS);
      return () => window.clearTimeout(t);
    }
    if (!visivel) return;
    const restante = Math.max(0, MINIMO_VISIVEL_MS - (Date.now() - mostradoEm.current));
    const t = window.setTimeout(() => setVisivel(false), restante);
    return () => window.clearTimeout(t);
  }, [pendentes, visivel]);

  return visivel ? <AppLoader sobreposto /> : null;
}

/**
 * Abre a janela de mudança de página a cada nova rota (só o caminho — query string,
 * como filtros, não conta). Fica dentro do BrowserRouter, antes das rotas; layout effect
 * para correr antes dos efeitos da página que disparam os pedidos.
 */
export function MudancaDePagina() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    useLoadingStore.getState().abrirJanela();
  }, [pathname]);
  return null;
}
