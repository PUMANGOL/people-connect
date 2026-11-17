import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard, Card, CardHeader, CardTitle, CardContent, EmptyState } from '@/src/components/ui/card';
import { Badge, ProgressBar, ProgressRing, Avatar } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { SkeletonList } from '@/src/components/ui/skeleton';
import {
  Users, UserCheck, Route as RouteIcon, TrendingUp,
  LayoutPanelTop, ArrowRight, FileSpreadsheet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { colaboradoresService, trilhosService, type ColaboradorRow, type Trilho } from '@/src/services/onboarding-v2.service';
import { useRecrutamentoSemanalStore } from '@/src/store/recrutamento-semanal.store';

interface DashboardData {
  loading: boolean;
  colaboradores: ColaboradorRow[];
  trilhos: Trilho[];
}

function calcProgresso(c: ColaboradorRow): number {
  const total = Number(c.etapas_total) || 0;
  const feitas = Number(c.etapas_concluidas) || 0;
  if (total === 0) return 0;
  return Math.round((feitas / total) * 100);
}

function progressStatus(pct: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (pct >= 75) return 'success';
  if (pct >= 40) return 'warning';
  if (pct > 0) return 'error';
  return 'neutral';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { registos, importadoEm } = useRecrutamentoSemanalStore();
  const [data, setData] = useState<DashboardData>({ loading: true, colaboradores: [], trilhos: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      colaboradoresService.list().catch(() => [] as ColaboradorRow[]),
      trilhosService.list().catch(() => [] as Trilho[]),
    ]).then(([colaboradores, trilhos]) => {
      if (cancelled) return;
      setData({ loading: false, colaboradores, trilhos });
    });
    return () => { cancelled = true; };
  }, []);

  // "Em onboarding" = qualquer colaborador ainda não concluído (por iniciar ou em curso).
  // O "concluído" é o único estado final; se o filtro fosse só em_curso, um colaborador
  // acabado de criar (estado não_iniciado) nunca apareceria — foi o bug reportado.
  const activos = useMemo(
    () => data.colaboradores.filter((c) => c.estado_onboarding !== 'concluido'),
    [data.colaboradores],
  );

  const concluidos = useMemo(
    () => data.colaboradores.filter((c) => c.estado_onboarding === 'concluido').length,
    [data.colaboradores],
  );

  const emCursoReal = useMemo(
    () => activos.filter((c) => c.estado_onboarding === 'em_curso').length,
    [activos],
  );

  const naoIniciados = useMemo(
    () => activos.filter((c) => c.estado_onboarding === 'nao_iniciado').length,
    [activos],
  );

  // Média de progresso: considera todos os colaboradores registados (concluídos
  // contam 100%, não iniciados contam 0%). Alinha com a página Colaboradores.
  const progressoMedio = useMemo(() => {
    if (data.colaboradores.length === 0) return 0;
    const soma = data.colaboradores.reduce((s, c) => s + calcProgresso(c), 0);
    return Math.round(soma / data.colaboradores.length);
  }, [data.colaboradores]);

  const recrutamentoResumo = useMemo(() => {
    const total = registos.length;
    const fechadas = registos.filter((r) => r.status === 'Fechado').length;
    const emCurso = registos.filter((r) => r.status === 'Em Curso').length;
    const emAtraso = registos.filter((r) => r.status === 'Em Atraso').length;
    const criticas = registos.filter((r) => r.critica).length;
    return { total, fechadas, emCurso, emAtraso, criticas };
  }, [registos]);

  return (
    <motion.div className="space-y-8" variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800 tracking-tight">Dashboard Executivo</h1>
        <p className="text-sm text-neutral-500 mt-1">Visão geral do onboarding e do recrutamento em curso</p>
      </motion.div>

      {/* KPIs reais — apenas 4 */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-info-50 text-info-600"
          title="Candidatos"
          value={recrutamentoResumo.total}
          onClick={() => navigate('/recrutamento/candidatos')}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          iconBg="bg-success-50 text-success-600"
          title="Em Onboarding"
          value={activos.length}
          onClick={() => navigate('/onboarding')}
        />
        <StatCard
          icon={<RouteIcon className="w-5 h-5" />}
          iconBg="bg-navy-50 text-navy-600"
          title="Trilhos Criados"
          value={data.trilhos.length}
          onClick={() => navigate('/onboarding/trilhos')}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-gold-50 text-gold-700"
          title="Progresso Médio"
          value={`${progressoMedio}%`}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recrutamento — resumo Dashboard Semanal */}
        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>Recrutamento</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {importadoEm
                    ? `Importado em ${new Date(importadoEm).toLocaleDateString('pt-AO')}`
                    : 'Sem Excel importado'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => navigate('/recrutamento/dashboard-semanal')}
              >
                Ver Dashboard Semanal
              </Button>
            </CardHeader>
            <CardContent>
              {recrutamentoResumo.total === 0 ? (
                <EmptyState
                  className="py-8"
                  icon={<FileSpreadsheet className="w-6 h-6" />}
                  title="Sem dados de recrutamento"
                  description="Importe o Excel semanal para popular candidatos e vagas."
                  action={{ label: 'Ir para o Dashboard Semanal', onClick: () => navigate('/recrutamento/dashboard-semanal') }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <ResumoTile label="Total" value={recrutamentoResumo.total} tone="neutral" />
                    <ResumoTile label="Fechadas" value={recrutamentoResumo.fechadas} tone="success" />
                    <ResumoTile label="Em Curso" value={recrutamentoResumo.emCurso} tone="info" />
                    <ResumoTile label="Em Atraso" value={recrutamentoResumo.emAtraso} tone="error" />
                  </div>
                  {recrutamentoResumo.criticas > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-error-100 bg-error-50 px-3 py-2">
                      <span className="text-sm text-error-700">
                        <strong>{recrutamentoResumo.criticas}</strong> vaga(s) crítica(s) a exigir acção.
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/recrutamento/dashboard-semanal')}>
                        Rever
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Onboarding Activo — todos os colaboradores registados */}
        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>Colaboradores em Onboarding</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {activos.length} activo(s) · {concluidos} concluído(s)
                </p>
              </div>
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => navigate('/onboarding')}>
                Ver Todos
              </Button>
            </CardHeader>
            <CardContent>
              {data.loading ? (
                <SkeletonList rows={4} cols={3} />
              ) : data.colaboradores.length === 0 ? (
                <EmptyState
                  className="py-8"
                  icon={<UserCheck className="w-6 h-6" />}
                  title="Nenhum colaborador registado"
                  description="Crie um colaborador ou aprove um candidato para começar."
                  action={{ label: 'Ir para Colaboradores', onClick: () => navigate('/onboarding') }}
                />
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <ProgressRing value={progressoMedio} size={80} strokeWidth={6} />
                    <div>
                      <p className="text-sm font-medium text-navy-800">Progresso médio</p>
                      <p className="text-xs text-navy-400">
                        Sobre {data.colaboradores.length} colaborador{data.colaboradores.length === 1 ? '' : 'es'}
                      </p>
                    </div>
                  </div>

                  {/* Discriminação rápida por estado */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-navy-50 px-2 py-2 text-center">
                      <p className="text-lg font-bold text-navy-700 tabular-nums">{naoIniciados}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-navy-500">Por iniciar</p>
                    </div>
                    <div className="rounded-lg bg-info-50 px-2 py-2 text-center">
                      <p className="text-lg font-bold text-info-700 tabular-nums">{emCursoReal}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-info-600">Em curso</p>
                    </div>
                    <div className="rounded-lg bg-success-50 px-2 py-2 text-center">
                      <p className="text-lg font-bold text-success-700 tabular-nums">{concluidos}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-success-600">Concluídos</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto -mr-2 pr-2">
                    {data.colaboradores.map((c) => {
                      const pct = calcProgresso(c);
                      const status = progressStatus(pct);
                      const concluido = c.estado_onboarding === 'concluido';
                      return (
                        <button
                          key={c.id}
                          onClick={() => navigate(`/onboarding/colaborador/${c.id}`)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-navy-25 transition-colors text-left"
                        >
                          <Avatar name={c.nome} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy-800 truncate">{c.nome}</p>
                            <p className="text-xs text-navy-400 truncate">{c.funcao} · {c.direccao}</p>
                          </div>
                          <div className="w-24 flex-shrink-0">
                            <ProgressBar value={pct} size="sm" showLabel />
                          </div>
                          {concluido ? (
                            <Badge variant="success" size="sm">Concluído</Badge>
                          ) : status === 'neutral' ? (
                            <Badge variant="neutral" size="sm">Por iniciar</Badge>
                          ) : (
                            <Badge variant="info" size="sm">Em curso</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Acessos rápidos */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink
          icon={<LayoutPanelTop className="w-5 h-5" />}
          title="Dashboard Semanal"
          description="Painel executivo do recrutamento"
          onClick={() => navigate('/recrutamento/dashboard-semanal')}
        />
        <QuickLink
          icon={<Users className="w-5 h-5" />}
          title="Candidatos"
          description="Aprovar e converter em colaboradores"
          onClick={() => navigate('/recrutamento/candidatos')}
        />
        <QuickLink
          icon={<RouteIcon className="w-5 h-5" />}
          title="Trilhos"
          description="Gerir trilhos de onboarding"
          onClick={() => navigate('/onboarding/trilhos')}
        />
      </motion.div>
    </motion.div>
  );
}

interface ResumoTileProps {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'info' | 'error';
}

function ResumoTile({ label, value, tone }: ResumoTileProps) {
  const bg = {
    neutral: 'bg-navy-50 text-navy-700',
    success: 'bg-success-50 text-success-700',
    info: 'bg-info-50 text-info-700',
    error: 'bg-error-50 text-error-600',
  }[tone];
  return (
    <div className={`rounded-xl px-3 py-3 ${bg}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

interface QuickLinkProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function QuickLink({ icon, title, description, onClick }: QuickLinkProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-5 hover:shadow-card hover:border-gold-300 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-600 flex items-center justify-center group-hover:bg-gold-50 group-hover:text-gold-700 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy-800 truncate">{title}</p>
          <p className="text-xs text-navy-400 truncate">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-navy-300 group-hover:text-gold-500 transition-colors" />
      </div>
    </button>
  );
}
