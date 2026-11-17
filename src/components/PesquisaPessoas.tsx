import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { Avatar } from '@/src/components/ui/badge';
import { cn } from '@/lib/utils';
import { pessoasService, PERFIL_LABEL, type PessoaResumo } from '@/src/services/pessoas.service';

const DEBOUNCE_MS = 250;

/** Pesquisa de colaboradores (inclui mentores e admins) na barra de topo. */
export function PesquisaPessoas({ className }: { className?: string }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<PessoaResumo[]>([]);
  const [aberto, setAberto] = useState(false);
  const [aCarregar, setACarregar] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setResultados([]);
      setACarregar(false);
      return;
    }
    const controller = new AbortController();
    setACarregar(true);
    const timer = window.setTimeout(() => {
      pessoasService
        .pesquisar(termo, controller.signal)
        .then((r) => {
          setResultados(r);
          setIndice(0);
        })
        .catch(() => { /* pedido cancelado ou falha: mantém a lista anterior */ })
        .finally(() => !controller.signal.aborted && setACarregar(false));
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function abrirPerfil(p: PessoaResumo) {
    navigate(`/perfil/${p.id}`);
    setQ('');
    setAberto(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, Math.max(resultados.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = resultados[indice];
      if (p) abrirPerfil(p);
    } else if (e.key === 'Escape') {
      setAberto(false);
      inputRef.current?.blur();
    }
  }

  const termoValido = q.trim().length >= 2;

  return (
    <div className={cn('relative', className)}>
      {/* Cores fixas (arbitrárias) para não serem trocadas pelo tema escuro: o campo é sempre branco na barra verde */}
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={aberto && termoValido}
        aria-controls="pesquisa-pessoas-resultados"
        aria-autocomplete="list"
        aria-label="Procurar colaborador"
        placeholder="Procurar Colaborador"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-full border-0 bg-[#ffffff]/95 pl-4 pr-10 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] shadow-sm outline-none focus:bg-[#ffffff] focus:ring-2 focus:ring-white/60 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
        {aCarregar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </span>

      {aberto && termoValido && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div
            id="pesquisa-pessoas-resultados"
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-white py-1 text-foreground shadow-float"
          >
            {resultados.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                {aCarregar ? 'A pesquisar…' : 'Nenhum colaborador encontrado'}
              </p>
            ) : (
              resultados.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={i === indice}
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => abrirPerfil(p)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                    i === indice ? 'bg-navy-50' : 'hover:bg-neutral-50',
                  )}
                >
                  <Avatar name={p.nome} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{p.nome}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {[PERFIL_LABEL[p.perfil] ?? p.perfil, p.funcao, p.direccao].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
