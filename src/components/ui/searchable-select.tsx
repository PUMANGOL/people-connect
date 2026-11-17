import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt');
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Pesquisar...',
  emptyLabel = 'Sem resultados',
  disabled,
  error,
  menuClassName,
}: {
  options: SearchableOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  error?: string;
  menuClassName?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const seleccionado = options.find((o) => o.value === value);

  const filtradas = useMemo(() => {
    const q = normalizar(pesquisa.trim());
    if (!q) return options;
    return options.filter((o) => normalizar(`${o.label} ${o.hint ?? ''}`).includes(q));
  }, [options, pesquisa]);

  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    function fora(e: MouseEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setPesquisa('');
  }

  function escolher(valor: string) {
    onChange?.(valor);
    fechar();
  }

  return (
    <div ref={raiz} className={cn('relative', aberto && 'z-40')}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3.5 text-left text-sm transition-all duration-200 ease-interaction',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-error-500' : 'border-input',
          !seleccionado && 'text-muted-foreground',
        )}
      >
        <span className="truncate">{seleccionado?.label ?? placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-navy-400 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-navy-100 bg-white shadow-lg"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              fechar();
            }
          }}
        >
          <div className="border-b border-navy-100 p-2">
            <input
              ref={campo}
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-navy-500"
            />
          </div>
          <ul role="listbox" className={cn('max-h-36 overflow-y-auto py-1', menuClassName)}>
            {filtradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-navy-400">{emptyLabel}</li>
            ) : (
              filtradas.map((opt) => {
                const activo = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={activo}
                      onClick={() => escolher(opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-navy-800 hover:bg-navy-50',
                        activo && 'bg-navy-50 font-medium',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && <span className="shrink-0 text-xs text-navy-400">{opt.hint}</span>}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
