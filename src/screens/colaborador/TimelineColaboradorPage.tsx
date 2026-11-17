import { useEffect, useState } from 'react';
import {
  Activity, MessageSquare, ClipboardCheck, UserPlus, RouteIcon,
  Sparkles, CheckCircle2, FileText, Award,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, EmptyState } from '@/src/components/ui/card';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { cn } from '@/lib/utils';
import { colaboradoresService } from '@/src/services/onboarding-v2.service';
import { timelineService, comentariosService } from '@/src/services/mentoria.service';
import type { TimelineEvento, ComentarioMentor, TipoEventoTimeline } from '@/lib/types';

const EVENT_ICONS: Record<TipoEventoTimeline, typeof Activity> = {
  utilizador_criado: UserPlus,
  mentor_atribuido: UserPlus,
  mentor_removido: UserPlus,
  roadmap_iniciado: RouteIcon,
  etapa_iniciada: RouteIcon,
  etapa_estado_alterado: Activity,
  etapa_concluida: CheckCircle2,
  checklist_item_concluido: ClipboardCheck,
  documento_confirmado: FileText,
  avaliacao_preenchida: ClipboardCheck,
  feedback_submetido: MessageSquare,
  comentario_mentor: MessageSquare,
  prazo_alterado: Activity,
  onboarding_concluido: Award,
  welcome_completed: Sparkles,
  observacao: Activity,
};

const EVENT_COLORS: Record<TipoEventoTimeline, string> = {
  utilizador_criado: 'bg-navy-50 text-navy-600',
  mentor_atribuido: 'bg-info-50 text-info-600',
  mentor_removido: 'bg-navy-50 text-navy-600',
  roadmap_iniciado: 'bg-gold-50 text-gold-700',
  etapa_iniciada: 'bg-info-50 text-info-600',
  etapa_estado_alterado: 'bg-navy-50 text-navy-600',
  etapa_concluida: 'bg-success-50 text-success-600',
  checklist_item_concluido: 'bg-success-50 text-success-600',
  documento_confirmado: 'bg-success-50 text-success-600',
  avaliacao_preenchida: 'bg-gold-50 text-gold-700',
  feedback_submetido: 'bg-info-50 text-info-600',
  comentario_mentor: 'bg-navy-50 text-navy-600',
  prazo_alterado: 'bg-warning-50 text-warning-600',
  onboarding_concluido: 'bg-success-50 text-success-700',
  welcome_completed: 'bg-gold-50 text-gold-700',
  observacao: 'bg-navy-50 text-navy-600',
};

type Tab = 'timeline' | 'comentarios';

export default function TimelineColaboradorPage() {
  const [tab, setTab] = useState<Tab>('timeline');
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvento[]>([]);
  const [comentarios, setComentarios] = useState<ComentarioMentor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const meu = await colaboradoresService.meuTrilho();
        const cid = meu.colaborador?.id ?? null;
        setColaboradorId(cid);
        if (!cid) {
          setLoading(false);
          return;
        }
        const [tl, cm] = await Promise.all([
          timelineService.porColaborador(cid).catch(() => []),
          comentariosService.porColaborador(cid).catch(() => []),
        ]);
        setTimeline(tl);
        setComentarios(cm);
      } catch {
        /* silencioso */
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-3xl space-y-6"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Timeline & Comentários</h1>
        <p className="mt-1 text-sm text-navy-500">
          Histórico das acções do teu onboarding e mensagens do teu mentor.
        </p>
      </motion.div>

      {!loading && !colaboradorId ? (
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title="Sem histórico"
          description="Ainda não foi criado nenhum evento — o teu onboarding pode não ter iniciado."
        />
      ) : (
        <>
          <motion.div variants={staggerItem} className="border-b border-navy-100">
            <nav className="flex gap-6 -mb-px">
              <TabBtn
                active={tab === 'timeline'}
                onClick={() => setTab('timeline')}
                icon={<Activity className="h-4 w-4" />}
                label={`Timeline (${timeline.length})`}
              />
              <TabBtn
                active={tab === 'comentarios'}
                onClick={() => setTab('comentarios')}
                icon={<MessageSquare className="h-4 w-4" />}
                label={`Comentários do mentor (${comentarios.length})`}
              />
            </nav>
          </motion.div>

          {loading ? (
            <SkeletonList rows={5} cols={2} />
          ) : tab === 'timeline' ? (
            timeline.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                title="Sem eventos ainda"
                description="Assim que houver actividade (etapas, avaliações, comentários), aparece aqui."
              />
            ) : (
              <motion.div variants={staggerItem}>
                <Card>
                  <CardHeader>
                    <CardTitle>Actividade do onboarding</CardTitle>
                    <span className="text-xs text-navy-400">Mais recente primeiro</span>
                  </CardHeader>
                  <div className="space-y-3">
                    {timeline.map((ev, idx) => {
                      const Icon = EVENT_ICONS[ev.tipo] ?? Activity;
                      const cor = EVENT_COLORS[ev.tipo] ?? 'bg-navy-50 text-navy-600';
                      const isLast = idx === timeline.length - 1;
                      return (
                        <div key={ev.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${cor}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            {!isLast && <div className="my-1 w-px flex-1 bg-navy-100" />}
                          </div>
                          <div className="flex-1 pb-3">
                            <p className="text-sm text-navy-800">{ev.descricao}</p>
                            <p className="mt-0.5 text-[11px] text-navy-400">
                              {ev.actor_nome ?? 'Sistema'}
                              {ev.actor_role ? ` · ${ev.actor_role}` : ''} ·{' '}
                              {new Date(ev.created_at).toLocaleString('pt-AO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            )
          ) : comentarios.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-8 w-8" />}
              title="Sem comentários"
              description="O teu mentor ainda não te deixou nenhuma mensagem visível."
            />
          ) : (
            <motion.div variants={staggerItem} className="space-y-3">
              {comentarios.map((c) => (
                <div key={c.id} className="rounded-xl border border-navy-100 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.autor_nome ?? '—'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-800">
                        {c.autor_nome ?? 'Mentor'}
                      </p>
                      <p className="text-[11px] text-navy-400">
                        {c.autor_role ?? ''} ·{' '}
                        {new Date(c.created_at).toLocaleString('pt-AO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Badge variant="info" size="sm">Visível</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-navy-700">{c.texto}</p>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
        active
          ? 'border-navy-700 text-navy-800'
          : 'border-transparent text-navy-400 hover:text-navy-700',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
