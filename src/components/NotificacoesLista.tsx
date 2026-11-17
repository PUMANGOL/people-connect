import {
  Bell, Briefcase, UserCheck, GraduationCap, MessageSquare, Calendar, AlertTriangle, BookOpen,
  ClipboardEdit, FileWarning, UserPlus, CalendarClock, CheckCircle2, Megaphone, MessageCircle, Award,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { useNotificationsStore } from '@/src/store/notifications.store';
import { notificacoesOnboardingService } from '@/src/services/mentoria.service';

const NOTIF_ICONS: Record<string, typeof Bell> = {
  vaga_criada: Briefcase,
  candidato_movido: UserCheck,
  entrevista_agendada: Calendar,
  parecer_pendente: GraduationCap,
  onboarding_novo: UserCheck,
  etapa_atrasada: AlertTriangle,
  checkin_proximo: Calendar,
  faq_reportada: BookOpen,
  chatbot_escalacao: MessageSquare,
  // Onboarding v3 / Mentor
  colaborador_atribuido: UserPlus,
  etapa_prestes_expirar: CalendarClock,
  roadmap_atrasado: AlertTriangle,
  avaliacao_pendente: ClipboardEdit,
  feedback_pendente: MessageSquare,
  documento_obrigatorio_falta: FileWarning,
  onboarding_concluido: CheckCircle2,
  comentario_recebido: MessageSquare,
  validacao_pendente: ClipboardEdit,
  // Comunidade
  comunidade_publicacao: Megaphone,
  comunidade_comentario: MessageCircle,
  reconhecimento_director: Award,
};

function getRelativeTime(dateStr: string): string {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(dateStr).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
}

/** Marca todas como lidas (store + servidor). */
export function useMarcarTodasLidas() {
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
  return () => {
    markAllAsRead();
    notificacoesOnboardingService.marcarTodasLidas().catch(() => { /* silencioso */ });
  };
}

/** Lista de notificações do store partilhado (sino do topo e cartão da página inicial). */
export function NotificacoesLista({ limite = 20, onAbrir }: { limite?: number; onAbrir?: () => void }) {
  const { notifications, markAsRead } = useNotificationsStore();
  const navigate = useNavigate();

  function abrir(notif: Notification) {
    markAsRead(notif.id);
    if (!notif.lida_em) {
      notificacoesOnboardingService.marcarLida(notif.id).catch(() => { /* silencioso */ });
    }
    if (notif.link_accao) navigate(notif.link_accao);
    onAbrir?.();
  }

  if (notifications.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Sem notificações</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {notifications.slice(0, limite).map((notif) => {
        const Icon = NOTIF_ICONS[notif.tipo] ?? Bell;
        const isUnread = !notif.lida_em;
        return (
          <button
            key={notif.id}
            onClick={() => abrir(notif)}
            className={cn(
              'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-neutral-100 transition-colors',
              isUnread && 'bg-neutral-50',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
              isUnread ? 'bg-navy-50 text-navy-700' : 'bg-neutral-100 text-neutral-400',
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm leading-snug', isUnread ? 'text-neutral-900 font-semibold' : 'text-neutral-600')}>
                {notif.mensagem}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">{getRelativeTime(notif.created_at)}</p>
            </div>
            {isUnread && <span className="w-2 h-2 rounded-full bg-brand-red-500 flex-shrink-0 mt-2" />}
          </button>
        );
      })}
    </div>
  );
}
