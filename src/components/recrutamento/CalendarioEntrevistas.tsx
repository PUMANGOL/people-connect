import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { Entrevista } from '@/lib/types';

const FASE_COLORS = {
  primeira_entrevista_dpc: 'bg-info-100 text-info-700 border-info-200',
  segunda_entrevista_area: 'bg-gold-100 text-gold-800 border-gold-200',
  entrevista_tecnica: 'bg-navy-100 text-navy-700 border-navy-200',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface CalendarioEntrevistasProps {
  entrevistas: Entrevista[];
  onEntrevistaClick?: (entrevista: Entrevista) => void;
}

export function CalendarioEntrevistas({ entrevistas, onEntrevistaClick }: CalendarioEntrevistasProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return days;
  }, [year, month]);

  function getEntrevistasForDay(day: number) {
    return entrevistas.filter((e) => {
      const d = new Date(e.data);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="bg-white border border-navy-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100">
        <h3 className="text-lg font-semibold text-navy-800">
          {MESES[month]} {year}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-navy-100">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="px-2 py-2 text-center text-xs font-medium text-navy-400 uppercase">
            {dia}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dayEntrevistas = day ? getEntrevistasForDay(day) : [];
          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1.5 border-b border-r border-navy-50 ${
                day ? 'bg-white' : 'bg-navy-25'
              }`}
            >
              {day && (
                <>
                  <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday(day)
                      ? 'bg-gold-500 text-white'
                      : 'text-navy-600'
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEntrevistas.slice(0, 2).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => onEntrevistaClick?.(e)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${
                          FASE_COLORS[e.fase] ?? 'bg-navy-100 text-navy-600 border-navy-200'
                        } hover:opacity-80 transition-opacity`}
                      >
                        {e.candidato?.nome ?? 'Entrevista'}
                      </button>
                    ))}
                    {dayEntrevistas.length > 2 && (
                      <p className="text-[10px] text-navy-400 pl-1">
                        +{dayEntrevistas.length - 2} mais
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
