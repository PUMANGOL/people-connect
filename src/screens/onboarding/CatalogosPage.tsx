import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Power, Search, Tags } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Paginacao, paginar } from '@/src/components/ui/paginacao';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { EmptyState } from '@/src/components/ui/card';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { cn } from '@/lib/utils';
import {
  catalogosService,
  type CatalogoCategoria,
  type CatalogoDireccao,
  type CatalogoFuncao,
  type Catalogos,
} from '@/src/services/catalogos.service';

type Aba = 'funcoes' | 'direccoes' | 'categorias';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'funcoes', label: 'Funções' },
  { id: 'direccoes', label: 'Direcções' },
  { id: 'categorias', label: 'Categorias' },
];

export default function CatalogosPage() {
  const [aba, setAba] = useState<Aba>('funcoes');
  const [catalogo, setCatalogo] = useState<Catalogos | null>(null);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [aCriar, setACriar] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(0);

  const carregar = useCallback(() => {
    setLoading(true);
    catalogosService.list()
      .then(setCatalogo)
      .catch(() => toast.error('Não foi possível carregar os catálogos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(carregar, [carregar]);

  async function criar() {
    const nome = novoNome.trim();
    if (!nome) return toast.error('Indique um nome');
    setACriar(true);
    try {
      await catalogosService.create(aba, nome);
      setNovoNome('');
      toast.success('Registo criado');
      carregar();
    } catch {
      toast.error('Não foi possível criar. Confirme que o nome ainda não existe.');
    } finally {
      setACriar(false);
    }
  }

  async function guardarNome() {
    if (!editando?.nome.trim()) return toast.error('Indique um nome');
    try {
      await catalogosService.update(aba, editando.id, { nome: editando.nome.trim() });
      toast.success('Nome actualizado');
      setEditando(null);
      carregar();
    } catch {
      toast.error('Não foi possível actualizar');
    }
  }

  async function alternar(id: string, activo: boolean) {
    try {
      if (activo) await catalogosService.desactivar(aba, id);
      else await catalogosService.update(aba, id, { activo: true });
      carregar();
    } catch {
      toast.error('Não foi possível alterar o estado');
    }
  }

  const itens = catalogo?.[aba] ?? [];
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (estado === 'activa' && !item.activo) return false;
      if (estado === 'inactiva' && item.activo) return false;
      if (!q) return true;
      const extra = extraDe(aba, item) ?? '';
      return item.nome.toLowerCase().includes(q) || extra.toLowerCase().includes(q);
    });
  }, [itens, busca, estado, aba]);
  const paginaLista = paginar(filtrados, pagina);

  useEffect(() => { setPagina(0); }, [aba, busca, estado]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">Funções, direcções e categorias</h1>
        <p className="mt-1 text-sm text-navy-400">
          Estes valores alimentam os dropdowns ao criar colaboradores e trilhos.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-navy-50 p-1">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setAba(item.id); setNovoNome(''); setBusca(''); setEstado(''); setPagina(0); }}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              aba === item.id ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500 hover:text-navy-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); void criar(); }}
      >
        <Input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={aba === 'funcoes' ? 'Nova função' : aba === 'direccoes' ? 'Nova direcção' : 'Nova categoria'}
        />
        <Button type="submit" variant="accent" loading={aCriar}>
          <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Adicionar</span>
        </Button>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome..." className="pl-9" />
        </div>
        <Select
          options={[{ value: 'activa', label: 'Activas' }, { value: 'inactiva', label: 'Inactivas' }]}
          placeholder="Todos os estados"
          value={estado}
          onChange={setEstado}
          className="w-full sm:w-44"
        />
      </div>

      {loading ? (
        <SkeletonList rows={6} cols={2} />
      ) : itens.length === 0 ? (
        <EmptyState icon={<Tags className="h-8 w-8" />} title="Sem registos" description="Adicione o primeiro valor desta lista." />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" />} title="Sem resultados" description="Ajuste o filtro para ver outros registos." />
      ) : (
        <div className="space-y-2">
          {paginaLista.visiveis.map((item) => (
            <Linha
              key={item.id}
              nome={item.nome}
              extra={extraDe(aba, item)}
              activo={item.activo}
              onEdit={() => setEditando({ id: item.id, nome: item.nome })}
              onToggle={() => alternar(item.id, item.activo)}
            />
          ))}
          <Paginacao
            pagina={paginaLista.actual}
            totalPaginas={paginaLista.totalPaginas}
            total={paginaLista.total}
            onChange={setPagina}
          />
        </div>
      )}

      {editando && (
        <Dialog open onClose={() => setEditando(null)}>
          <h2 className="mb-4 text-lg font-semibold text-navy-800">Editar nome</h2>
          <Input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          <p className="mt-2 text-xs text-navy-400">
            {aba === 'categorias'
              ? 'O identificador usado nos registos mantém-se. Só muda o nome apresentado.'
              : 'Os colaboradores e trilhos que usam este valor passam a mostrar o nome novo.'}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button variant="accent" onClick={guardarNome}>Guardar</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function extraDe(aba: Aba, item: CatalogoFuncao | CatalogoDireccao | CatalogoCategoria): string | null {
  if (aba === 'direccoes' && 'sigla' in item) return item.sigla;
  if (aba === 'categorias' && 'slug' in item) return item.slug;
  return null;
}

function Linha({
  nome, extra, activo, onEdit, onToggle,
}: {
  nome: string;
  extra: string | null;
  activo: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border bg-white p-4', activo ? 'border-navy-100' : 'border-navy-100 opacity-60')}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy-800">{nome}</p>
        {extra && <p className="text-xs text-navy-400">{extra}</p>}
      </div>
      <Badge variant={activo ? 'success' : 'neutral'} size="sm">{activo ? 'Activa' : 'Inactiva'}</Badge>
      <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700" aria-label="Editar">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={onToggle} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700" aria-label={activo ? 'Desactivar' : 'Activar'}>
        <Power className="h-4 w-4" />
      </button>
    </div>
  );
}
