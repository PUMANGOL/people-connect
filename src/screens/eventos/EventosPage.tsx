import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { ConfirmDialog } from '@/src/components/ui/dialog';
import { SkeletonCard } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { cn } from '@/lib/utils';
import { proximosFeriados } from '@/src/lib/feriados-angola';
import { eventosService, type CategoriaEvento, type Evento, type ZonaEvento } from '@/src/services/eventos.service';
import {
  CATEGORIAS_EVENTO, ORDEM_CATEGORIAS, ZONAS_EVENTO,
  Calendario, EventoDestaque, EventoDetalhe, EventoForm, PontoCategoria,
  diaCurto, intervaloDaVista, quando, type Vista,
} from './componentes';

// Zonas do filtro «Local» (como no modelo; «Online» fica só no formulário).
const ZONAS_FILTRO: ZonaEvento[] = ['sede', 'talatona', 'academia', 'postos'];

export default function EventosPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'rh_admin';

  const [vista, setVista] = useState<Vista>('mes');
  const [cursor, setCursor] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [destaque, setDestaque] = useState<Evento | null>(null);
  const [carregandoDestaque, setCarregandoDestaque] = useState(true);
  const [meus, setMeus] = useState<Evento[]>([]);

  const [categoria, setCategoria] = useState<CategoriaEvento | null>(null);
  const [zona, setZona] = useState<ZonaEvento | null>(null);

  const [aberto, setAberto] = useState<Evento | null>(null);
  const [form, setForm] = useState<{ evento?: Evento; dia?: Date } | null>(null);
  const [remover, setRemover] = useState<Evento | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [aGuardarPresenca, setAGuardarPresenca] = useState<string | null>(null);

  const { de, ate } = intervaloDaVista(vista, cursor);
  const chaveIntervalo = `${de.getTime()}-${ate.getTime()}`;

  const carregarCalendario = useCallback(async () => {
    setCarregando(true);
    try {
      setEventos(await eventosService.intervalo(de, ate));
    } catch {
      setEventos([]);
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveIntervalo]);

  const carregarLaterais = useCallback(async () => {
    const [d, m] = await Promise.all([
      eventosService.destaque().catch(() => null),
      eventosService.meus().catch(() => [] as Evento[]),
    ]);
    setDestaque(d);
    setMeus(m);
    setCarregandoDestaque(false);
  }, []);

  useEffect(() => { carregarCalendario(); }, [carregarCalendario]);
  useEffect(() => { carregarLaterais(); }, [carregarLaterais]);

  const recarregarTudo = () => {
    carregarCalendario();
    carregarLaterais();
  };

  const filtrados = useMemo(
    () => eventos.filter((e) => (!categoria || e.categoria === categoria) && (!zona || e.zona === zona)),
    [eventos, categoria, zona],
  );

  /** Substitui o evento actualizado em todas as listas da página. */
  function aplicar(actualizado: Evento) {
    setEventos((prev) => prev.map((e) => (e.id === actualizado.id ? actualizado : e)));
    setDestaque((d) => (d?.id === actualizado.id ? actualizado : d));
    setAberto((a) => (a?.id === actualizado.id ? actualizado : a));
  }

  async function alternarPresenca(e: Evento) {
    setAGuardarPresenca(e.id);
    try {
      const r = e.eu_confirmei ? await eventosService.cancelarPresenca(e.id) : await eventosService.confirmar(e.id);
      aplicar(r);
      setMeus(await eventosService.meus().catch(() => meus));
      toast.success(r.eu_confirmei ? 'Presença confirmada' : 'Presença cancelada', r.titulo);
    } catch {
      toast.error('Não foi possível actualizar a presença', 'Tenta novamente.');
    } finally {
      setAGuardarPresenca(null);
    }
  }

  async function confirmarRemocao() {
    if (!remover) return;
    setRemovendo(true);
    try {
      await eventosService.remover(remover.id);
      toast.success('Evento removido', remover.titulo);
      setRemover(null);
      setAberto(null);
      recarregarTudo();
    } catch {
      toast.error('Erro ao remover', 'Tenta novamente.');
    } finally {
      setRemovendo(false);
    }
  }

  const feriados = useMemo(() => proximosFeriados(3), []);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <nav aria-label="Caminho" className="text-xs text-navy-400">
          <Link to="/inicio" className="hover:text-navy-700">People Connect</Link>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-[#0B6B3A]">Eventos e Agenda</span>
        </nav>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0A0A0A] dark:text-white">Eventos e Agenda</h1>
        <p className="mt-1 text-sm text-navy-500">
          Town halls, formações, encontros de comunidades e celebrações — tudo o que acontece na Pumangol, num só calendário.
        </p>
        {isAdmin && (
          <div className="mt-4">
            <Button variant="primary" onClick={() => setForm({})} leftIcon={<Plus className="h-4 w-4" />}>Criar evento</Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <ChipFiltro activo={!categoria} onClick={() => setCategoria(null)}>Todos</ChipFiltro>
          {ORDEM_CATEGORIAS.map((c) => (
            <ChipFiltro key={c} activo={categoria === c} onClick={() => setCategoria(categoria === c ? null : c)}>
              <PontoCategoria categoria={c} /> {CATEGORIAS_EVENTO[c].filtro}
            </ChipFiltro>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {carregandoDestaque ? (
            <SkeletonCard />
          ) : destaque ? (
            <EventoDestaque
              evento={destaque}
              onAbrir={() => setAberto(destaque)}
              onPresenca={alternarPresenca}
              aGuardarPresenca={aGuardarPresenca === destaque.id}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-navy-300" />
              <p className="mt-2 text-sm text-navy-500">Não há eventos agendados.</p>
            </div>
          )}

          <Calendario
            vista={vista}
            onVista={setVista}
            cursor={cursor}
            onCursor={setCursor}
            eventos={filtrados}
            carregando={carregando}
            onAbrir={setAberto}
            onCriarNoDia={isAdmin ? (dia) => setForm({ dia }) : undefined}
          />
        </div>

        {/* Coluna lateral */}
        <aside className="space-y-5">
          <section className="rounded-2xl border border-navy-100 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0A0A0A] dark:text-white">Os meus eventos</h2>
              {meus.length > 0 && (
                <span className="rounded-full bg-[#DDF5E8] px-2 py-0.5 text-[11px] font-semibold text-[#0B5E35]">
                  {meus.length} confirmado{meus.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {meus.length === 0 ? (
              <p className="mt-3 text-xs text-navy-400">Ainda não confirmou presença em nenhum evento.</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy-50">
                {meus.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setAberto(e)} className="flex w-full items-start gap-2.5 py-2.5 text-left">
                      <PontoCategoria categoria={e.categoria} className="mt-1.5" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#0A0A0A] hover:underline dark:text-white">{e.titulo}</span>
                        <span className="block text-xs text-navy-400">{quando(e)}{e.local ? ` · ${e.local}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="text-sm font-bold text-[#0A0A0A] dark:text-white">Feriados e datas a lembrar</h2>
            <ul className="mt-3 space-y-2">
              {feriados.map((f) => (
                <li key={f.data.toISOString()} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[#0A0A0A] dark:text-white/90">{f.nome}</span>
                  <span className="shrink-0 text-xs text-navy-400">{diaCurto(f.data)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {aberto && (
        <EventoDetalhe
          evento={aberto}
          isAdmin={isAdmin}
          onFechar={() => setAberto(null)}
          onPresenca={alternarPresenca}
          aGuardarPresenca={aGuardarPresenca === aberto.id}
          onEditar={() => { setForm({ evento: aberto }); setAberto(null); }}
          onRemover={() => setRemover(aberto)}
        />
      )}

      {form && (
        <EventoForm
          evento={form.evento}
          diaInicial={form.dia}
          onFechar={() => setForm(null)}
          onGuardado={() => { setForm(null); recarregarTudo(); }}
        />
      )}

      <ConfirmDialog
        open={!!remover}
        onClose={() => setRemover(null)}
        onConfirm={confirmarRemocao}
        title="Remover evento?"
        description={remover ? `O evento "${remover.titulo}" e as presenças confirmadas serão removidos.` : ''}
        confirmLabel="Sim, remover"
        destructive
        loading={removendo}
      />
    </div>
  );
}

function ChipFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        activo
          ? 'border-[#0B6B3A] bg-[#0B6B3A] text-white'
          : 'border-navy-100 bg-white text-navy-700 hover:border-navy-200 hover:bg-navy-50',
      )}
    >
      {children}
    </button>
  );
}
