import { FileText, ArrowRight, CalendarCheck, Star, Briefcase, Clock } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { PIPELINE_PHASES } from '@/lib/constants';
import type { HistoricoPipeline, Entrevista } from '@/lib/types';

interface TimelineEvent {
  id: string;
  type: 'transicao' | 'entrevista' | 'documento' | 'contratacao' | 'entrada';
  data: string;
  titulo: string;
  descricao?: string;
  actor?: string;
}

interface CandidatoTimelineProps {
  dataEntrada: string;
  historico: HistoricoPipeline[];
  entrevistas?: Entrevista[];
  className?: string;
}

function getPipelineLabel(key: string) {
  return PIPELINE_PHASES.find((p) => p.key === key)?.label ?? key;
}

export function CandidatoTimeline({ dataEntrada, historico, entrevistas = [], className }: CandidatoTimelineProps) {
  const events: TimelineEvent[] = [];

  events.push({
    id: 'entrada',
    type: 'entrada',
    data: dataEntrada,
    titulo: 'Entrada no Pipeline',
    descricao: 'Candidato registado no sistema',
  });

  for (const h of historico) {
    events.push({
      id: `h-${h.data}`,
      type: 'transicao',
      data: h.data,
      titulo: `${getPipelineLabel(h.de)} → ${getPipelineLabel(h.para)}`,
      descricao: h.motivo,
      actor: h.utilizador_id,
    });
  }

  for (const e of entrevistas) {
    events.push({
      id: `e-${e.id}`,
      type: 'entrevista',
      data: e.data,
      titulo: `Entrevista: ${e.fase === 'primeira_entrevista_dpc' ? '1ª DPC' : e.fase === 'segunda_entrevista_area' ? '2ª Área' : 'Técnica'}`,
      descricao: e.recomendacao
        ? `Recomendação: ${e.recomendacao === 'avancar' ? 'Avançar' : e.recomendacao === 'reserva' ? 'Reserva' : 'Rejeitar'}`
        : 'Parecer pendente',
      actor: e.entrevistador,
    });
  }

  events.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const typeConfig = {
    entrada: { icon: Briefcase, color: 'bg-navy-100 text-navy-500', lineColor: 'border-navy-200' },
    transicao: { icon: ArrowRight, color: 'bg-info-100 text-info-600', lineColor: 'border-info-200' },
    entrevista: { icon: CalendarCheck, color: 'bg-gold-100 text-gold-700', lineColor: 'border-gold-200' },
    documento: { icon: FileText, color: 'bg-success-100 text-success-600', lineColor: 'border-success-200' },
    contratacao: { icon: Star, color: 'bg-success-100 text-success-600', lineColor: 'border-success-200' },
  };

  return (
    <div className={className}>
      <div className="relative">
        {events.map((event, idx) => {
          const config = typeConfig[event.type];
          const Icon = config.icon;
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isLast && <div className={`w-px flex-1 border-l-2 ${config.lineColor} mt-1`} />}
              </div>
              <div className="flex-1 pb-2">
                <p className="font-medium text-navy-800 text-sm">{event.titulo}</p>
                {event.descricao && <p className="text-xs text-navy-400 mt-0.5">{event.descricao}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-navy-300">
                    {new Date(event.data).toLocaleDateString('pt-AO')}
                  </span>
                  {event.actor && (
                    <span className="text-xs text-navy-400">• {event.actor}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
