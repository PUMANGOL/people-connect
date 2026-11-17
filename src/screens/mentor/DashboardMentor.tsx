import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, AlertTriangle, TrendingUp, ClipboardEdit,
  CalendarClock, ArrowRight, Bell, GraduationCap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { StatCard, EmptyState, Card, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { SkeletonStatCard, SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { useAuthStore } from '@/src/store/auth.store';
import {
  mentorPortalService,
  notificacoesOnboardingService,
  type MentorDashboard,
} from '@/src/services/mentoria.service';
import type { NotificacaoOnboarding } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
}

function relativeDate(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  if (days > 0) return `em ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}

export default function DashboardMentor() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dash, setDash] = useState<MentorDashboard | null>(null);
  const [notif, setNotif] = useState<NotificacaoOnboarding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      mentorPortalService.dashboard(),
      notificacoesOnboardingService.inbox(),
    ])
      .then(([d, inbox]) => {
        setDash(d);
        setNotif(inbox.items.slice(0, 5));
      })
      .catch(() => {
        setDash(null);
        setNotif([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <SkeletonList rows={5} cols={3} />
      </div>
    );
  }

  const nomeMentor = user?.nome?.split(' ')[0] ?? 'Mentor';
  const mentorados = dash?.mentorados ?? 0;
  const concluidos = dash?.concluidos ?? 0;
  const emAtraso = dash?.em_atraso ?? 0;
  const progressoMedio = dash?.progresso_medio ?? 0;
  const avaliacoesPendentes = dash?.avaliacoes_pendentes ?? 0;
  const checkpoints = dash?.checkpoints_proximos ?? [];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-navy-400">
            Portal do Mentor
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy-800">Olá, {nomeMentor}</h1>
          <p className="mt-1 text-sm text-navy-500">
            Aqui tens a visão dos teus mentorados e os pontos de acção do dia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => navigate('/mentor/mentorados')}
          >
            Meus Mentorados
          </Button>
          <Button
            variant="primary"
            leftIcon={<ClipboardEdit className="h-4 w-4" />}
            onClick={() => navigate('/mentor/avaliacoes/nova')}
          >
            Nova Avaliação
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-navy-50 text-navy-600"
          title="Mentorados activos"
          value={mentorados}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-info-50 text-info-600"
          title="Progresso médio"
          value={`${progressoMedio}%`}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="bg-success-50 text-success-600"
          title="Onboarding concluído"
          value={concluidos}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="bg-error-50 text-error-500"
          title="Em atraso"
          value={emAtraso}
        />
      </motion.div>

      {/* Grelha 2 colunas: checkpoints + acções rápidas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Checkpoints próximos */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-navy-500" />
                Próximos checkpoints
              </CardTitle>
              <Link
                to="/mentor/mentorados"
                className="text-xs font-medium text-navy-500 transition-colors hover:text-navy-700 flex items-center gap-1"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            {checkpoints.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="Sem checkpoints marcados"
                description="Quando houver etapas com data prevista nos próximos dias, aparecem aqui."
              />
            ) : (
              <div className="divide-y divide-navy-50 -mx-6">
                {checkpoints.map((cp) => (
                  <button
                    key={cp.id}
                    onClick={() => navigate(`/mentor/mentorados/${cp.colaborador_id}`)}
                    className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-navy-25"
                  >
                    <Avatar name={cp.colaborador_nome} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-800">
                        {cp.colaborador_nome}
                      </p>
                      <p className="truncate text-xs text-navy-500">{cp.etapa_nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-navy-700">
                        {formatDate(cp.data_prevista)}
                      </p>
                      <p className="text-[11px] text-navy-400">
                        {relativeDate(cp.data_prevista)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Acções rápidas + Avaliações pendentes */}
        <motion.div variants={staggerItem} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardEdit className="h-5 w-5 text-navy-500" />
                Avaliações pendentes
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  avaliacoesPendentes > 0
                    ? 'bg-warning-50 text-warning-600'
                    : 'bg-success-50 text-success-600'
                }`}
              >
                <span className="text-2xl font-bold tabular-nums">{avaliacoesPendentes}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-navy-500">
                  {avaliacoesPendentes > 0
                    ? 'Avaliação(ões) por concluir ou submeter.'
                    : 'Estás em dia com as avaliações.'}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 mt-1"
                  onClick={() => navigate('/mentor/avaliacoes')}
                >
                  Ir para avaliações →
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-navy-500" />
                Notificações recentes
              </CardTitle>
              <Link
                to="/mentor/notificacoes"
                className="text-xs font-medium text-navy-500 transition-colors hover:text-navy-700 flex items-center gap-1"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            {notif.length === 0 ? (
              <p className="text-sm text-navy-400">Sem notificações novas.</p>
            ) : (
              <div className="space-y-2">
                {notif.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.link_accao) navigate(n.link_accao);
                      else navigate('/mentor/notificacoes');
                    }}
                    className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-navy-25"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        n.lida ? 'bg-navy-200' : 'bg-gold-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          n.lida ? 'text-navy-500' : 'font-medium text-navy-800'
                        }`}
                      >
                        {n.titulo}
                      </p>
                      <p className="text-[11px] text-navy-400">
                        {new Date(n.created_at).toLocaleString('pt-AO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Estado do papel */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-gradient-to-r from-navy-25 to-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-700 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-navy-800">
              Mentoria — Master Prompt Enterprise · Fase 3
            </p>
            <p className="text-xs text-navy-500">
              Acompanha os teus mentorados, valida checkpoints e submete as avaliações nos momentos
              definidos (Dia 15, 30, 60, 90 e Final).
            </p>
          </div>
          <Badge variant="accent" size="sm">v3</Badge>
        </div>
      </motion.div>
    </motion.div>
  );
}
