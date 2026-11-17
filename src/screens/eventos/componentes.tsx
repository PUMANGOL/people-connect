import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Star, Trash2, Users, Video,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { FormField, Input, Textarea } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog } from '@/src/components/ui/dialog';
import { toast } from '@/src/store';
import { cn } from '@/lib/utils';
import { feriadosDoAno, type Feriado } from '@/src/lib/feriados-angola';
import {
  eventosService, type CategoriaEvento, type Evento, type EventoPayload, type ZonaEvento,
} from '@/src/services/eventos.service';

// ============================================================
// Categorias, zonas e formatação
// ============================================================

export const CATEGORIAS_EVENTO: Record<CategoriaEvento, {
  label: string;
  filtro: string;
  ponto: string;
  chip: string;
}> = {
  oficial:     { label: 'Oficial',     filtro: 'Oficiais e town halls',   ponto: 'bg-[#0B6B3A]', chip: 'bg-[#DDF5E8] text-[#0B5E35]' },
  formacao:    { label: 'Formação',    filtro: 'Formações (Academia)',    ponto: 'bg-[#F59E0B]', chip: 'bg-[#FDF1DC] text-[#8A5A00]' },
  comunidade:  { label: 'Comunidade',  filtro: 'Comunidades',             ponto: 'bg-[#1E3A8A]', chip: 'bg-[#E3E9FB] text-[#1E3A8A]' },
  obrigatorio: { label: 'Obrigatório', filtro: 'Obrigatórios (HSE)',      ponto: 'bg-[#DC2626]', chip: 'bg-[#FDE4E4] text-[#B42318]' },
  bem_estar:   { label: 'Bem-estar',   filtro: 'Bem-estar e celebrações', ponto: 'bg-[#9333EA]', chip: 'bg-[#F3E8FF] text-[#7E22CE]' },
};
export const ORDEM_CATEGORIAS = Object.keys(CATEGORIAS_EVENTO) as CategoriaEvento[];

export const ZONAS_EVENTO: Record<ZonaEvento, string> = {
  sede: 'Sede',
  talatona: 'Talatona',
  academia: 'Academia',
  postos: 'Postos',
  online: 'Online',
};

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function maisDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Segunda-feira da semana de `d`. */
export function inicioDaSemana(d: Date): Date {
  const r = inicioDoDia(d);
  return maisDias(r, -((r.getDay() + 6) % 7));
}

export function hora(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Seg 2 Nov" */
export function diaCurto(d: Date): string {
  return `${DIAS_CURTOS[d.getDay()]} ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

/** "Hoje, 10:30" · "Amanhã, 07:00" · "Sáb 24 Out, 07:00" (sem hora nos de dia inteiro). */
export function quando(e: Evento, agora = new Date()): string {
  const d = new Date(e.inicio);
  const dia = mesmoDia(d, agora) ? 'Hoje' : mesmoDia(d, maisDias(agora, 1)) ? 'Amanhã' : diaCurto(d);
  return e.dia_inteiro ? dia : `${dia}, ${hora(e.inicio)}`;
}

/** "10:30 – 11:30" · "Todo o dia" */
export function horario(e: Evento): string {
  if (e.dia_inteiro) return 'Todo o dia';
  return e.fim && mesmoDia(new Date(e.inicio), new Date(e.fim)) ? `${hora(e.inicio)} – ${hora(e.fim)}` : hora(e.inicio);
}

function fimEfectivo(e: Evento): Date {
  if (e.fim) return new Date(e.fim);
  const d = new Date(e.inicio);
  return e.dia_inteiro ? maisDias(inicioDoDia(d), 1) : new Date(d.getTime() + 60 * 60 * 1000);
}

/** "Começa em 1 h 15 min" · "A decorrer" · "Amanhã" · "Daqui a 3 dias" */
export function contagem(e: Evento, agora: Date): string {
  const inicio = new Date(e.inicio);
  if (agora >= inicio) return agora < fimEfectivo(e) ? 'A decorrer' : 'Terminado';
  const dias = Math.round((inicioDoDia(inicio).getTime() - inicioDoDia(agora).getTime()) / 86_400_000);
  if (dias === 1) return 'Amanhã';
  if (dias > 1) return `Daqui a ${dias} dias`;
  if (e.dia_inteiro) return 'Hoje';
  const min = Math.ceil((inicio.getTime() - agora.getTime()) / 60_000);
  if (min < 60) return `Começa em ${min} min`;
  return `Começa em ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** Eventos que ocupam o dia `dia` (inclui eventos de vários dias). */
export function eventosDoDia(eventos: Evento[], dia: Date): Evento[] {
  const ini = inicioDoDia(dia);
  const fim = maisDias(ini, 1);
  return eventos.filter((e) => new Date(e.inicio) < fim && fimEfectivo(e) > ini);
}

/** Feriados indexados por "AAAA-M-D" para os anos indicados. */
export function mapaFeriados(anos: number[]): Map<string, Feriado> {
  const m = new Map<string, Feriado>();
  for (const ano of anos) for (const f of feriadosDoAno(ano)) m.set(chaveDia(f.data), f);
  return m;
}
export const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// ============================================================
// Adicionar ao calendário (.ics)
// ============================================================

function icsData(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function icsDia(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
function icsTexto(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Descarrega o evento em .ics (Outlook, Google Calendar, Calendário do telemóvel…). */
export function descarregarIcs(e: Evento) {
  const inicio = new Date(e.inicio);
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pumangol//People Connect//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@peopleconnect.pumangol`,
    `DTSTAMP:${icsData(new Date())}`,
    ...(e.dia_inteiro
      // Dia inteiro: DTEND é o dia a seguir ao último dia (exclusivo).
      ? [`DTSTART;VALUE=DATE:${icsDia(inicio)}`, `DTEND;VALUE=DATE:${icsDia(maisDias(inicioDoDia(e.fim ? new Date(e.fim) : inicio), 1))}`]
      : [`DTSTART:${icsData(inicio)}`, `DTEND:${icsData(fimEfectivo(e))}`]),
    `SUMMARY:${icsTexto(e.titulo)}`,
    ...(e.descricao ? [`DESCRIPTION:${icsTexto(e.descricao + (e.link_online ? `\n\n${e.link_online}` : ''))}`] : []),
    ...(e.local ? [`LOCATION:${icsTexto(e.local)}`] : []),
    ...(e.link_online ? [`URL:${e.link_online}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.titulo.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'evento'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Relógio que actualiza a cada minuto (contagem decrescente do destaque). */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return agora;
}

export function PontoCategoria({ categoria, className }: { categoria: CategoriaEvento; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-2 w-2 shrink-0 rounded-full', CATEGORIAS_EVENTO[categoria].ponto, className)} />;
}

// ============================================================
// Evento em destaque
// ============================================================

interface AccoesEvento {
  onPresenca: (e: Evento) => void;
  aGuardarPresenca: boolean;
}

export function EventoDestaque({ evento, onPresenca, aGuardarPresenca, onAbrir, navegacao }: AccoesEvento & {
  evento: Evento;
  onAbrir: () => void;
  navegacao?: { indice: number; total: number; onAnterior: () => void; onSeguinte: () => void };
}) {
  const agora = useAgora();
  const inicio = new Date(evento.inicio);
  const rotuloDia = mesmoDia(inicio, agora) ? 'Hoje' : mesmoDia(inicio, maisDias(agora, 1)) ? 'Amanhã' : DIAS_CURTOS[inicio.getDay()];

  return (
    <article className="relative overflow-hidden rounded-2xl bg-[#12343F] p-5 text-white shadow-card sm:p-6">
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#1B4A4C]/70" />
      {navegacao && navegacao.total > 1 && (
        <div className="relative mb-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={navegacao.onAnterior}
            aria-label="Evento anterior"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-white/80">
            {navegacao.indice + 1} / {navegacao.total}
          </span>
          <button
            type="button"
            onClick={navegacao.onSeguinte}
            aria-label="Evento seguinte"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <div key={evento.id} className="relative flex flex-col gap-5 animate-in fade-in duration-300 sm:flex-row">
        {/* Bloco da data */}
        <div className="flex shrink-0 flex-row items-center justify-center gap-3 rounded-xl bg-[#3DD68C] px-4 py-3 text-[#0B2A1C] sm:w-[88px] sm:flex-col sm:gap-0 sm:py-6">
          <span className="text-[11px] font-bold uppercase tracking-widest">{rotuloDia}</span>
          <span className="text-3xl font-extrabold leading-none sm:mt-1 sm:text-4xl">{inicio.getDate()}</span>
          <span className="text-xs font-bold uppercase tracking-widest sm:mt-1">{MESES_CURTOS[inicio.getMonth()]}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">{CATEGORIAS_EVENTO[evento.categoria].label}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#12343F]">{contagem(evento, agora)}</span>
          </div>
          <button type="button" onClick={onAbrir} className="mt-2 text-left">
            <h2 className="text-xl font-extrabold leading-tight tracking-tight hover:underline sm:text-2xl">{evento.titulo}</h2>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{horario(evento)}</span>
            {evento.local && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{evento.local}</span>}
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{evento.confirmados} confirmados</span>
          </div>

          {evento.descricao && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/80">{evento.descricao}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <BotaoPresenca evento={evento} onPresenca={onPresenca} aGuardar={aGuardarPresenca} escuro />
            <button
              type="button"
              onClick={() => descarregarIcs(evento)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <CalendarPlus className="h-4 w-4" /> Adicionar ao calendário
            </button>
            {evento.link_online && (
              <a
                href={evento.link_online}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Video className="h-4 w-4" /> Entrar pelo Teams
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function BotaoPresenca({ evento, onPresenca, aGuardar, escuro = false }: {
  evento: Evento;
  onPresenca: (e: Evento) => void;
  aGuardar: boolean;
  escuro?: boolean;
}) {
  if (evento.eu_confirmei) {
    return (
      <button
        type="button"
        onClick={() => onPresenca(evento)}
        disabled={aGuardar}
        title="Clica para cancelar a presença"
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-60',
          escuro ? 'border-[#3DD68C] text-[#3DD68C] hover:bg-[#3DD68C]/10' : 'border-[#0B6B3A] text-[#0B6B3A] hover:bg-[#DDF5E8]',
        )}
      >
        <Check className="h-4 w-4" /> Presença confirmada
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPresenca(evento)}
      disabled={aGuardar}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60',
        escuro ? 'bg-[#3DD68C] text-[#0B2A1C] hover:bg-[#5EE6A8]' : 'bg-[#0B6B3A] text-white hover:bg-[#095A31]',
      )}
    >
      <Check className="h-4 w-4" /> Confirmar presença
    </button>
  );
}

// ============================================================
// Calendário (Mês · Semana · Lista)
// ============================================================

export type Vista = 'mes' | 'semana' | 'lista';

const CABECALHO_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface CalendarioProps {
  vista: Vista;
  onVista: (v: Vista) => void;
  cursor: Date;
  onCursor: (d: Date) => void;
  eventos: Evento[];
  carregando: boolean;
  onAbrir: (e: Evento) => void;
  /** Admin: clicar num dia abre o formulário com essa data. */
  onCriarNoDia?: (dia: Date) => void;
}

/** Primeiro e último dia (exclusivo) visíveis na vista actual. */
export function intervaloDaVista(vista: Vista, cursor: Date): { de: Date; ate: Date } {
  if (vista === 'semana') {
    const de = inicioDaSemana(cursor);
    return { de, ate: maisDias(de, 7) };
  }
  const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  if (vista === 'lista') return { de: primeiro, ate: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) };
  const de = inicioDaSemana(primeiro);
  const ultimo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const semanas = Math.ceil((((primeiro.getDay() + 6) % 7) + ultimo.getDate()) / 7);
  return { de, ate: maisDias(de, semanas * 7) };
}

export function Calendario({ vista, onVista, cursor, onCursor, eventos, carregando, onAbrir, onCriarNoDia }: CalendarioProps) {
  const hoje = new Date();
  const { de, ate } = intervaloDaVista(vista, cursor);
  const feriados = useMemo(() => mapaFeriados([de.getFullYear(), maisDias(ate, -1).getFullYear()]), [de, ate]);

  function navegar(delta: -1 | 1) {
    onCursor(vista === 'semana' ? maisDias(cursor, delta * 7) : new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  const titulo = vista === 'semana'
    ? `${de.getDate()} ${MESES_CURTOS[de.getMonth()]} – ${maisDias(ate, -1).getDate()} ${MESES_CURTOS[maisDias(ate, -1).getMonth()]} ${maisDias(ate, -1).getFullYear()}`
    : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const dias: Date[] = [];
  for (let d = de; d < ate; d = maisDias(d, 1)) dias.push(d);

  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-4 sm:p-5">
      {/* Barra de navegação */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => navegar(-1)} aria-label="Anterior" className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-100 text-navy-600 hover:bg-navy-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-[150px] text-center text-base font-bold text-[#0A0A0A] dark:text-white">{titulo}</h2>
        <button type="button" onClick={() => navegar(1)} aria-label="Seguinte" className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-100 text-navy-600 hover:bg-navy-50">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onCursor(new Date())} className="h-9 rounded-lg border border-navy-100 px-3 text-sm font-medium text-navy-700 hover:bg-navy-50">
          Hoje
        </button>
        {carregando && <span className="text-xs text-navy-400">A carregar…</span>}

        <div role="tablist" aria-label="Vista" className="ml-auto flex rounded-lg bg-navy-50 p-1">
          {([['mes', 'Mês'], ['semana', 'Semana'], ['lista', 'Lista']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => onVista(v)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                vista === v ? 'bg-white text-navy-800 shadow-sm dark:bg-white/10 dark:text-white' : 'text-navy-500 hover:text-navy-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {vista === 'mes' && (
        <div>
          <div className="grid grid-cols-7 gap-1.5 pb-1.5">
            {CABECALHO_SEMANA.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-navy-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {dias.map((dia) => {
              const doMes = dia.getMonth() === cursor.getMonth();
              const eHoje = mesmoDia(dia, hoje);
              const lista = eventosDoDia(eventos, dia);
              const feriado = feriados.get(chaveDia(dia));
              return (
                <div
                  key={dia.toISOString()}
                  onClick={onCriarNoDia ? () => onCriarNoDia(dia) : undefined}
                  title={onCriarNoDia ? 'Criar evento neste dia' : undefined}
                  className={cn(
                    'min-h-[88px] rounded-lg border p-1.5 transition-colors',
                    doMes ? 'border-navy-100 bg-white' : 'border-transparent bg-navy-50/70',
                    eHoje && 'border-2 border-[#0B6B3A] bg-[#F1FAF5] dark:border-[#2FB673] dark:bg-[#0B6B3A]/20',
                    onCriarNoDia && 'cursor-pointer hover:border-navy-200',
                  )}
                >
                  <div className={cn(
                    'text-xs font-semibold',
                    !doMes && 'text-navy-300',
                    doMes && !eHoje && 'text-[#0A0A0A] dark:text-white',
                    eHoje && 'font-extrabold text-[#0B6B3A] dark:text-[#3DD68C]',
                  )}>
                    {dia.getDate()}
                  </div>
                  {feriado && <p className="mt-0.5 truncate text-[10px] italic text-navy-400" title={feriado.nome}>{feriado.nome}</p>}
                  <div className="mt-1 space-y-1">
                    {lista.slice(0, 2).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onAbrir(e); }}
                        title={`${e.dia_inteiro ? '' : `${hora(e.inicio)} · `}${e.titulo}`}
                        className={cn(
                          'block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold',
                          eHoje && e.categoria === 'oficial' ? 'bg-[#0B6B3A] text-white' : CATEGORIAS_EVENTO[e.categoria].chip,
                        )}
                      >
                        {e.titulo}
                      </button>
                    ))}
                    {lista.length > 2 && (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onVista('lista'); }}
                        className="block w-full truncate rounded px-1.5 text-left text-[10px] font-medium text-navy-500 hover:underline"
                      >
                        +{lista.length - 2} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === 'semana' && (
        <div className="grid gap-2 sm:grid-cols-7">
          {dias.map((dia, i) => {
            const eHoje = mesmoDia(dia, hoje);
            const lista = eventosDoDia(eventos, dia);
            const feriado = feriados.get(chaveDia(dia));
            return (
              <div key={dia.toISOString()} className={cn('min-h-[140px] rounded-lg border p-2', eHoje ? 'border-2 border-[#0B6B3A] bg-[#F1FAF5] dark:bg-[#0B6B3A]/10' : 'border-navy-100')}>
                <p className={cn('text-[11px] font-semibold uppercase tracking-wider', eHoje ? 'text-[#0B6B3A]' : 'text-navy-400')}>
                  {CABECALHO_SEMANA[i]} {dia.getDate()}
                </p>
                {feriado && <p className="mt-0.5 truncate text-[10px] italic text-navy-400" title={feriado.nome}>{feriado.nome}</p>}
                <div className="mt-2 space-y-1.5">
                  {lista.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onAbrir(e)}
                      className={cn('block w-full rounded-md px-2 py-1 text-left text-[11px]', CATEGORIAS_EVENTO[e.categoria].chip)}
                    >
                      <span className="block font-semibold">{e.dia_inteiro ? 'Todo o dia' : hora(e.inicio)}</span>
                      <span className="line-clamp-2">{e.titulo}</span>
                    </button>
                  ))}
                  {lista.length === 0 && onCriarNoDia && (
                    <button type="button" onClick={() => onCriarNoDia(dia)} className="text-[11px] text-navy-300 hover:text-navy-600">+ Criar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === 'lista' && (
        <div className="divide-y divide-navy-50">
          {eventos.length === 0 ? (
            <p className="py-10 text-center text-sm text-navy-400">Sem eventos em {MESES[cursor.getMonth()].toLowerCase()}.</p>
          ) : (
            eventos.map((e) => (
              <button key={e.id} type="button" onClick={() => onAbrir(e)} className="flex w-full items-start gap-4 py-3 text-left hover:bg-navy-50/50">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[11px] font-semibold uppercase text-navy-400">{DIAS_CURTOS[new Date(e.inicio).getDay()]}</p>
                  <p className="text-xl font-extrabold leading-none text-[#0A0A0A] dark:text-white">{new Date(e.inicio).getDate()}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#0A0A0A] dark:text-white">
                    <PontoCategoria categoria={e.categoria} />
                    <span className="truncate">{e.titulo}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {horario(e)}{e.local ? ` · ${e.local}` : ''} · {e.confirmados} confirmados
                    {e.eu_confirmei && <span className="ml-1 font-semibold text-[#0B6B3A]">· Vou</span>}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-50 pt-3">
        {ORDEM_CATEGORIAS.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-navy-500">
            <PontoCategoria categoria={c} /> {CATEGORIAS_EVENTO[c].label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Detalhe do evento
// ============================================================

export function EventoDetalhe({ evento, isAdmin, onFechar, onPresenca, aGuardarPresenca, onEditar, onRemover }: AccoesEvento & {
  evento: Evento;
  isAdmin: boolean;
  onFechar: () => void;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const inicio = new Date(evento.inicio);
  return (
    <Dialog open onClose={onFechar} className="max-w-lg">
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', CATEGORIAS_EVENTO[evento.categoria].chip)}>
          {CATEGORIAS_EVENTO[evento.categoria].label}
        </span>
        {evento.destaque && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-0.5 text-[11px] font-semibold text-gold-700">
            <Star className="h-3 w-3" /> Em destaque
          </span>
        )}
      </div>
      <h2 className="mt-3 text-xl font-extrabold leading-tight text-[#0A0A0A] dark:text-white">{evento.titulo}</h2>

      <div className="mt-3 space-y-1.5 text-sm text-navy-600">
        <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-navy-400" />{diaCurto(inicio)} {inicio.getFullYear()} · {horario(evento)}</p>
        {evento.local && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-navy-400" />{evento.local}{evento.zona ? ` · ${ZONAS_EVENTO[evento.zona]}` : ''}
          </p>
        )}
        <p className="flex items-center gap-2"><Users className="h-4 w-4 text-navy-400" />{evento.confirmados} confirmados</p>
      </div>

      {evento.descricao && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#0A0A0A] dark:text-white/90">{evento.descricao}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        <BotaoPresenca evento={evento} onPresenca={onPresenca} aGuardar={aGuardarPresenca} />
        <Button variant="secondary" onClick={() => descarregarIcs(evento)} leftIcon={<CalendarPlus className="h-4 w-4" />}>
          Adicionar ao calendário
        </Button>
        {evento.link_online && (
          <a href={evento.link_online} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
            <Video className="h-4 w-4" /> Entrar pelo Teams
          </a>
        )}
      </div>

      {isAdmin && (
        <div className="mt-5 flex justify-end gap-1 border-t border-navy-50 pt-3">
          <Button variant="ghost" size="sm" onClick={onEditar} leftIcon={<Pencil className="h-4 w-4" />}>Editar</Button>
          <Button variant="ghost" size="sm" onClick={onRemover} leftIcon={<Trash2 className="h-4 w-4 text-error-500" />}>
            <span className="text-error-600">Remover</span>
          </Button>
        </div>
      )}
    </Dialog>
  );
}

// ============================================================
// Formulário (admin)
// ============================================================

// Valor do Select de zona para "sem zona" (o Select não aceita string vazia como item).
const SEM_ZONA = '__sem_zona';

const OPCOES_CATEGORIA = ORDEM_CATEGORIAS.map((c) => ({ value: c, label: CATEGORIAS_EVENTO[c].filtro }));
const OPCOES_ZONA = [
  { value: SEM_ZONA, label: 'Sem zona' },
  ...Object.entries(ZONAS_EVENTO).map(([value, label]) => ({ value, label })),
];

export function EventoForm({ evento, diaInicial, onFechar, onGuardado }: {
  evento?: Evento;
  diaInicial?: Date;
  onFechar: () => void;
  onGuardado: () => void;
}) {
  const base = diaInicial ? new Date(diaInicial.getFullYear(), diaInicial.getMonth(), diaInicial.getDate(), 9, 0) : null;
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaEvento>(evento?.categoria ?? 'oficial');
  const [diaInteiro, setDiaInteiro] = useState(evento?.dia_inteiro ?? false);
  const [inicio, setInicio] = useState<Date | null>(evento ? new Date(evento.inicio) : base);
  const [fim, setFim] = useState<Date | null>(
    evento?.fim ? new Date(evento.fim) : base ? new Date(base.getTime() + 60 * 60 * 1000) : null,
  );
  const [local, setLocal] = useState(evento?.local ?? '');
  const [zona, setZona] = useState<string>(evento?.zona ?? SEM_ZONA);
  const [link, setLink] = useState(evento?.link_online ?? '');
  const [descricao, setDescricao] = useState(evento?.descricao ?? '');
  const [destaque, setDestaque] = useState(evento?.destaque ?? false);
  const [aGuardar, setAGuardar] = useState(false);

  // Ao mudar o início para depois do fim, o fim acompanha (mantendo a duração de 1 h).
  function mudarInicio(d: Date | null) {
    setInicio(d);
    if (d && fim && fim < d) setFim(new Date(d.getTime() + 60 * 60 * 1000));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return toast.error('Indica o título do evento');
    if (!inicio) return toast.error('Indica a data de início');
    // Dia inteiro: do início do primeiro dia ao fim do último.
    const ini = diaInteiro ? new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0) : inicio;
    const fi = fim
      ? diaInteiro ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59) : fim
      : null;
    if (fi && fi < ini) return toast.error('O fim tem de ser depois do início');

    const payload: EventoPayload = {
      titulo: titulo.trim(),
      categoria,
      descricao: descricao.trim() || null,
      local: local.trim() || null,
      zona: zona === SEM_ZONA ? null : (zona as ZonaEvento),
      link_online: link.trim() || null,
      inicio: ini.toISOString(),
      fim: fi ? fi.toISOString() : null,
      dia_inteiro: diaInteiro,
      destaque,
    };
    setAGuardar(true);
    try {
      if (evento) await eventosService.actualizar(evento.id, payload);
      else await eventosService.criar(payload);
      toast.success(evento ? 'Evento actualizado' : 'Evento criado', payload.titulo);
      onGuardado();
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      toast.error('Não foi possível guardar', resp?.data?.error ?? resp?.data?.message ?? 'Tenta novamente.');
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Dialog open onClose={onFechar} className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{evento ? 'Editar evento' : 'Criar evento'}</h2>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Título" required>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus placeholder="Ex.: Town Hall · Resultados do 3.º trimestre" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Categoria" required>
            <Select items={OPCOES_CATEGORIA} value={categoria} onValueChange={(v) => v && setCategoria(v as CategoriaEvento)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_CATEGORIA.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Zona" hint="Usada no filtro «Local».">
            <Select items={OPCOES_ZONA} value={zona} onValueChange={(v) => setZona(v ?? SEM_ZONA)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_ZONA.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-navy-700">
          <Checkbox checked={diaInteiro} onCheckedChange={(v) => setDiaInteiro(v === true)} />
          Dura o dia todo
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Início" required>
            <DateTimePicker value={inicio} onChange={mudarInicio} comHora={!diaInteiro} />
          </FormField>
          <FormField label="Fim">
            <DateTimePicker value={fim} onChange={setFim} comHora={!diaInteiro} minimo={inicio} placeholder="Sem data de fim" />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Local">
            <Input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={200} placeholder="Ex.: Auditório Sede · Luanda" />
          </FormField>
          <FormField label="Link do Microsoft Teams">
            <Input value={link} onChange={(e) => setLink(e.target.value)} maxLength={2000} placeholder="https://teams.microsoft.com/…" />
          </FormField>
        </div>

        <FormField label="Descrição">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={5000} autoResize placeholder="Agenda, objectivos, o que levar…" />
        </FormField>

        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-navy-700">
          <Checkbox checked={destaque} onCheckedChange={(v) => setDestaque(v === true)} />
          Fixar no cartão em destaque
        </label>

        <div className="flex justify-end gap-2 border-t border-navy-50 pt-4">
          <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={aGuardar}>{evento ? 'Guardar' : 'Criar evento'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
