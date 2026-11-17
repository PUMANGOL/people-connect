import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export const ITENS_POR_PAGINA = 8;

/** Junta aos filtros valores que já existem na lista e ainda não estão no catálogo. */
export function juntarOpcoes(
  opcoes: Array<{ value: string; label: string }>,
  valores: Array<string | null | undefined>,
) {
  const existentes = new Set(opcoes.map((opcao) => opcao.value));
  const extra = [...new Set(valores.map((valor) => (valor ?? '').trim()).filter((valor) => valor && !existentes.has(valor)))]
    .sort((a, b) => a.localeCompare(b, 'pt'))
    .map((valor) => ({ value: valor, label: valor }));
  return [...opcoes, ...extra];
}

export function paginar<T>(itens: T[], pagina: number, tamanho = ITENS_POR_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho));
  const actual = Math.min(Math.max(0, pagina), totalPaginas - 1);
  return {
    actual,
    totalPaginas,
    visiveis: itens.slice(actual * tamanho, (actual + 1) * tamanho),
    total: itens.length,
  };
}

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  tamanho = ITENS_POR_PAGINA,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamanho?: number;
  onChange: (pagina: number) => void;
}) {
  if (total === 0 || totalPaginas <= 1) return null;
  const inicio = pagina * tamanho + 1;
  const fim = Math.min((pagina + 1) * tamanho, total);
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p className="text-xs text-navy-400">{inicio}–{fim} de {total}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onChange(pagina - 1)} disabled={pagina <= 0} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-sm text-navy-500">{pagina + 1} / {totalPaginas}</span>
        <Button variant="ghost" size="icon" onClick={() => onChange(pagina + 1)} disabled={pagina >= totalPaginas - 1} aria-label="Página seguinte">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
