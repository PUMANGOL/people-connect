import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { pt } from 'react-day-picker/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const pad = (n: number) => String(n).padStart(2, '0');

interface DateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Mostra o campo de hora ao lado da data. */
  comHora?: boolean;
  /** Datas anteriores a esta ficam desactivadas. */
  minimo?: Date | null;
  /** Datas posteriores a esta ficam desactivadas. */
  maximo?: Date | null;
  /**
   * Menus de mês e ano no topo do calendário, para saltar anos (ex.: data de nascimento).
   * `anoMinimo` é o primeiro ano do menu (por omissão, há 100 anos).
   */
  seletorAno?: boolean;
  anoMinimo?: number;
  /** Mês mostrado ao abrir sem data escolhida. */
  mesPadrao?: Date | null;
  placeholder?: string;
  disabled?: boolean;
  /** Mostra "Limpar" no calendário quando há data escolhida. */
  permitirLimpar?: boolean;
  className?: string;
}

/**
 * Data (Calendar do shadcn num Popover) + hora opcional.
 * Ao mudar só a data mantém-se a hora escolhida; sem hora, assume 09:00.
 */
export function DateTimePicker({
  value, onChange, comHora = true, minimo, maximo, seletorAno = false, anoMinimo, mesPadrao,
  placeholder = 'Escolher data', disabled, permitirLimpar = false, className,
}: DateTimePickerProps) {
  const [aberto, setAberto] = useState(false);

  function escolherDia(dia: Date | undefined) {
    if (!dia) return;
    const base = value ?? new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0);
    onChange(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), base.getHours(), base.getMinutes()));
    setAberto(false);
  }

  function escolherHora(hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const base = value ?? new Date();
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
  }

  const minimoDia = minimo ? new Date(minimo.getFullYear(), minimo.getMonth(), minimo.getDate()) : null;
  const maximoDia = maximo ? new Date(maximo.getFullYear(), maximo.getMonth(), maximo.getDate()) : null;
  const desactivados = [
    ...(minimoDia ? [{ before: minimoDia }] : []),
    ...(maximoDia ? [{ after: maximoDia }] : []),
  ];
  // Intervalo dos menus de mês/ano: do ano mínimo até à data máxima (ou fim do ano corrente).
  const hoje = new Date();
  const inicioMenus = minimoDia ?? new Date(anoMinimo ?? hoje.getFullYear() - 100, 0, 1);
  const fimMenus = maximoDia ?? new Date(hoje.getFullYear(), 11, 31);

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            'flex h-10 flex-1 items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm transition-colors',
            'hover:bg-neutral-50 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-focus',
            'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
            !value && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-navy-400" />
          {value ? `${value.getDate()} ${MESES_CURTOS[value.getMonth()]} ${value.getFullYear()}` : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={pt}
            weekStartsOn={1}
            selected={value ?? undefined}
            defaultMonth={value ?? mesPadrao ?? minimo ?? undefined}
            onSelect={escolherDia}
            disabled={desactivados.length ? desactivados : undefined}
            {...(seletorAno ? { captionLayout: 'dropdown' as const, startMonth: inicioMenus, endMonth: fimMenus } : {})}
            autoFocus
          />
          {permitirLimpar && value && (
            <div className="border-t border-navy-50 px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => { onChange(null); setAberto(false); }}
                className="text-xs font-semibold text-navy-500 hover:text-navy-800"
              >
                Limpar
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {comHora && (
        <input
          type="time"
          aria-label="Hora"
          value={value ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : ''}
          onChange={(e) => escolherHora(e.target.value)}
          disabled={disabled || !value}
          className="h-10 w-[7.5rem] rounded-md border border-input bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/25 disabled:opacity-50 dark:bg-input/30"
        />
      )}
    </div>
  );
}

/** "AAAA-MM-DD" (hora local) ⇄ Date. */
function paraData(valor: string | null | undefined): Date | null {
  const m = valor ? /^(\d{4})-(\d{2})-(\d{2})/.exec(valor) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function paraTexto(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Campo só de data com o calendário do shadcn — substitui <input type="date">.
 * Mesmo formato de valor: "AAAA-MM-DD" ('' = sem data).
 */
export function DateInput({ value, onChange, minimo, maximo, seletorAno, anoMinimo, mesPadrao, placeholder, disabled, className }: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** "AAAA-MM-DD" — dias anteriores ficam desactivados. */
  minimo?: string | null;
  /** "AAAA-MM-DD" — dias posteriores ficam desactivados. */
  maximo?: string | null;
  /** Menus de mês e ano no calendário (datas distantes, como a de nascimento). */
  seletorAno?: boolean;
  anoMinimo?: number;
  /** "AAAA-MM-DD" — mês mostrado ao abrir sem data escolhida. */
  mesPadrao?: string | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <DateTimePicker
      value={paraData(value)}
      onChange={(d) => onChange(d ? paraTexto(d) : '')}
      comHora={false}
      minimo={paraData(minimo)}
      maximo={paraData(maximo)}
      seletorAno={seletorAno}
      anoMinimo={anoMinimo}
      mesPadrao={paraData(mesPadrao)}
      placeholder={placeholder}
      disabled={disabled}
      permitirLimpar
      className={className}
    />
  );
}
