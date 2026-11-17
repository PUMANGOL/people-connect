import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Check, UserPlus, CalendarClock, AlertTriangle,
  ClipboardEdit, FileWarning, MessageSquare, CheckCircle2, Megaphone, MessageCircle, Award,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card, EmptyState } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import { notificacoesOnboardingService } from '@/src/services/mentoria.service';
import type {
  NotificacaoOnboarding, TipoNotificacaoOnboarding,
} from '@/lib/types';

const ICONS: Record<TipoNotificacaoOnboarding, typeof Bell> = {
  colaborador_atribuido: UserPlus,
  etapa_prestes_expirar: CalendarClock,
  roadmap_atrasado: AlertTriangle,
  avaliacao_pendente: ClipboardEdit,
  feedback_pendente: MessageSquare,
  documento_obrigatorio_falta: FileWarning,
  onboarding_concluido: CheckCircle2,
  comentario_recebido: MessageSquare,
  validacao_pendente: ClipboardEdit,
  comunidade_publicacao: Megaphone,
  comunidade_comentario: MessageCircle,
  reconhecimento_director: Award,
};

const CORES: Record<TipoNotificacaoOnboarding, string> = {
  colaborador_atribuido: 'bg-info-50 text-info-600',
  etapa_prestes_expirar: 'bg-warning-50 text-warning-600',
  roadmap_atrasado: 'bg-error-50 text-error-500',
  avaliacao_pendente: 'bg-gold-50 text-gold-700',
  feedback_pendente: 'bg-gold-50 text-gold-700',
  documento_obrigatorio_falta: 'bg-error-50 text-error-500',
  onboarding_concluido: 'bg-success-50 text-success-600',
  comentario_recebido: 'bg-navy-50 text-navy-600',
  validacao_pendente: 'bg-warning-50 text-warning-600',
  comunidade_publicacao: 'bg-gold-50 text-gold-700',
  comunidade_comentario: 'bg-navy-50 text-navy-600',
  reconhecimento_director: 'bg-gold-50 text-gold-700',
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
}

type Filtro = 'todas' | 'nao_lidas' | 'lidas';

export default function NotificacoesMentor() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificacaoOnboarding[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  async function carregar() {
    setLoading(true);
    try {
      const inbox = await notificacoesOnboardingService.inbox();
      setItems(inbox.items);
      setNaoLidas(inbox.nao_lidas);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    if (filtro === 'nao_lidas') return items.filter((n) => !n.lida);
    if (filtro === 'lidas') return items.filter((n) => n.lida);
    return items;
  }, [items, filtro]);

  async function handleClick(n: NotificacaoOnboarding) {
    if (!n.lida) {
      try {
        await notificacoesOnboardingService.marcarLida(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, lida: true, lida_em: new Date().toISOString() } : x)),
        );
        setNaoLidas((c) => Math.max(0, c - 1));
      } catch {
        // ignore silently
      }
    }
    if (n.link_accao) navigate(n.link_accao);
  }

  async function handleMarcarTodas() {
    try {
      await notificacoesOnboardingService.marcarTodasLidas();
      setItems((prev) => prev.map((x) => ({ ...x, lida: true, lida_em: new Date().toISOString() })));
      setNaoLidas(0);
      toast.success('Notificações marcadas como lidas');
    } catch {
      toast.error('Não foi possível marcar todas');
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Notificações</h1>
          <p className="mt-1 text-sm text-navy-500">
            {items.length} total · {naoLidas} por ler
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-navy-200 bg-white p-0.5">
            <FiltroBtn label="Todas" active={filtro === 'todas'} onClick={() => setFiltro('todas')} />
            <FiltroBtn
              label={`Não lidas${naoLidas > 0 ? ` (${naoLidas})` : ''}`}
              active={filtro === 'nao_lidas'}
              onClick={() => setFiltro('nao_lidas')}
            />
            <FiltroBtn label="Lidas" active={filtro === 'lidas'} onClick={() => setFiltro('lidas')} />
          </div>
          {naoLidas > 0 && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCheck className="h-4 w-4" />}
              onClick={handleMarcarTodas}
            >
              Marcar todas
            </Button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <SkeletonList rows={6} cols={2} />
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="Sem notificações"
          description={
            filtro === 'nao_lidas'
              ? 'Estás em dia! Nada por ler.'
              : filtro === 'lidas'
              ? 'Ainda não há notificações lidas.'
              : 'Assim que houver acções ou eventos relevantes, aparecem aqui.'
          }
        />
      ) : (
        <motion.div variants={staggerItem} className="space-y-2">
          {filtradas.map((n) => {
            const Icon = ICONS[n.tipo] ?? Bell;
            const cor = CORES[n.tipo] ?? 'bg-navy-50 text-navy-600';
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  n.lida
                    ? 'border-navy-100 bg-white hover:bg-navy-25'
                    : 'border-gold-200 bg-gold-50/30 hover:bg-gold-50',
                )}
              >
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', cor)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm', n.lida ? 'text-navy-700' : 'font-semibold text-navy-800')}>
                    {n.titulo}
                  </p>
                  {n.mensagem && (
                    <p className="mt-0.5 text-xs text-navy-500 line-clamp-2">{n.mensagem}</p>
                  )}
                  <p className="mt-1 text-[11px] text-navy-400">{relTime(n.created_at)}</p>
                </div>
                {!n.lida && (
                  <Badge variant="accent" size="sm">
                    Nova
                  </Badge>
                )}
                {n.lida && (
                  <Check className="h-4 w-4 text-navy-300" />
                )}
              </button>
            );
          })}
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <Card className="bg-gradient-to-r from-navy-25 to-white">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-navy-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-navy-800">Como funciona</p>
              <p className="mt-1 text-xs text-navy-500">
                Recebes notificações quando te é atribuído um novo mentorado, quando há checkpoints
                próximos, quando o trilho está atrasado, quando há avaliações pendentes ou quando o
                mentorado te deixa um comentário.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function FiltroBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-navy-700 text-white' : 'text-navy-500 hover:text-navy-700',
      )}
    >
      {label}
    </button>
  );
}
