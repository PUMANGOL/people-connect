import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Building2, Mail, Calendar, MessageSquare,
  CheckCircle2, Clock, Lock, AlertTriangle, Route as RouteIcon,
  ClipboardEdit, Send, Users, Activity, ChevronRight,
  Sparkles, Layers, BookOpen, GraduationCap, Settings, ClipboardCheck,
  Download,
} from 'lucide-react';
import { exportarRelatorioIntegracaoPDF } from '@/src/lib/pdf-mentoria';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Badge, ProgressRing, ProgressBar, Avatar } from '@/src/components/ui/badge';
import { Card, CardHeader, CardTitle, EmptyState } from '@/src/components/ui/card';
import { FormField, Input, Textarea } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { formatarData } from '@/src/lib/datas';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { useAuthStore } from '@/src/store/auth.store';
import { cn } from '@/lib/utils';
import {
  mentorPortalService, timelineService,
  mentorAvaliacoesService, colaboradorFeedbackService,
  type MentoradoRow, type EtapaMentor, type ChecklistItemProgresso,
} from '@/src/services/mentoria.service';
import type { ComentarioMentor, TimelineEvento } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentosEtapa } from '@/src/components/onboarding/DocumentosEtapa';
import { anexosService, type EtapaAnexo } from '@/src/services/anexos.service';

const TIPO_ICONS: Record<string, typeof BookOpen> = {
  documental: BookOpen,
  conversacional: MessageSquare,
  formacao: GraduationCap,
  administrativo: Settings,
  misto: Layers,
};

const ESTADO_CFG: Record<string, { label: string; badge: 'success' | 'info' | 'warning' | 'error' | 'neutral'; bg: string }> = {
  nao_iniciada:       { label: 'Não iniciada',        badge: 'neutral', bg: 'bg-navy-100' },
  em_preparacao:      { label: 'Em preparação',       badge: 'info',    bg: 'bg-info-100' },
  em_curso:           { label: 'Em curso',            badge: 'info',    bg: 'bg-info-100' },
  aguardar_validacao: { label: 'A aguardar validação', badge: 'warning', bg: 'bg-warning-100' },
  concluida:          { label: 'Concluída',           badge: 'success', bg: 'bg-success-100' },
  reagendada:         { label: 'Reagendada',          badge: 'warning', bg: 'bg-warning-100' },
  bloqueada:          { label: 'Bloqueada',           badge: 'error',   bg: 'bg-error-100' },
  cancelada:          { label: 'Cancelada',           badge: 'neutral', bg: 'bg-navy-100' },
  // fallback do modelo antigo
  pendente:           { label: 'Não iniciada',        badge: 'neutral', bg: 'bg-navy-100' },
  atrasada:           { label: 'Atrasada',            badge: 'error',   bg: 'bg-error-100' },
};

type TabId = 'trilho' | 'comentarios' | 'timeline';

export default function TimelineMentorado() {
  const { colaboradorId } = useParams();
  const navigate = useNavigate();
  const podeDefinirResponsavel = useAuthStore((s) => s.role === 'rh_admin');

  const [colaborador, setColaborador] = useState<MentoradoRow | null>(null);
  const [progresso, setProgresso] = useState<EtapaMentor[]>([]);
  const [checklistProg, setChecklistProg] = useState<ChecklistItemProgresso[]>([]);
  const [anexos, setAnexos] = useState<EtapaAnexo[]>([]);
  const [comentarios, setComentarios] = useState<ComentarioMentor[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>('trilho');
  const [novoComentario, setNovoComentario] = useState('');
  const [comentarioVisivel, setComentarioVisivel] = useState(true);
  const [aEnviarComentario, setAEnviarComentario] = useState(false);
  const [expandedEtapa, setExpandedEtapa] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!colaboradorId) {
      setErro('ID do colaborador em falta.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const [detalhe, tl, docs] = await Promise.all([
        mentorPortalService.detalhe(colaboradorId),
        timelineService.porColaborador(colaboradorId).catch(() => []),
        anexosService.doColaborador(colaboradorId).catch(() => [] as EtapaAnexo[]),
      ]);
      setColaborador(detalhe.colaborador);
      setProgresso(detalhe.progresso);
      setAnexos(docs);
      setChecklistProg(detalhe.checklist_progresso);
      setComentarios(detalhe.comentarios);
      setTimeline(tl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => { carregar(); }, [carregar]);

  const stats = useMemo(() => {
    const total = progresso.length;
    const concluidas = progresso.filter((p) => p.estado === 'concluida').length;
    const emCurso = progresso.filter((p) => p.estado === 'em_curso' || p.estado === 'em_preparacao').length;
    const aValidar = progresso.filter((p) => p.estado === 'aguardar_validacao').length;
    const atrasadas = progresso.filter((p) => p.estado === 'atrasada' || p.estado === 'bloqueada').length;
    const p = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    return { total, concluidas, emCurso, aValidar, atrasadas, pct: p };
  }, [progresso]);

  const checklistByProgresso = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const ci of checklistProg) {
      if (!ci.concluido) continue;
      if (!map.has(ci.progresso_id)) map.set(ci.progresso_id, new Set());
      map.get(ci.progresso_id)!.add(ci.item_key);
    }
    return map;
  }, [checklistProg]);

  const etapasPorFase = useMemo(() => {
    const groups = new Map<string, { nome: string | null; numero: number | null; etapas: EtapaMentor[] }>();
    for (const p of progresso) {
      const fase = p.fase == null || String(p.fase).trim() === '' ? null : String(p.fase).trim();
      const nome = p.fase_nome?.trim() || (fase ? `Fase ${fase}` : null);
      const key = nome ?? '';
      if (!groups.has(key)) {
        const numero = fase != null && Number.isFinite(Number(fase)) ? Number(fase) : null;
        groups.set(key, { nome, numero, etapas: [] });
      }
      groups.get(key)!.etapas.push(p);
    }
    return Array.from(groups.values()).sort((a, b) => (a.numero ?? Number.MAX_SAFE_INTEGER) - (b.numero ?? Number.MAX_SAFE_INTEGER));
  }, [progresso]);

  async function handleExportarRelatorio() {
    if (!colaborador) return;
    try {
      const [avs, fbs] = await Promise.all([
        mentorAvaliacoesService.listPorColaborador(colaborador.id).catch(() => []),
        colaboradorFeedbackService.porColaborador(colaborador.id).catch(() => []),
      ]);
      const feedbackSubmetido = fbs.find((f) => f.estado === 'submetida' || f.estado === 'validada');
      const mentorNome =
        colaborador.mentor_nome
        || avs.find((a) => a.mentor_nome)?.mentor_nome
        || null;
      await exportarRelatorioIntegracaoPDF({
        colaborador_nome: colaborador.nome,
        cargo: colaborador.funcao,
        direccao: colaborador.direccao,
        data_admissao: colaborador.data_admissao,
        mentor_nome: mentorNome,
        avaliacoes: avs,
        feedback: feedbackSubmetido ?? null,
      });
      toast.success('Relatório gerado');
    } catch {
      toast.error('Não foi possível gerar o relatório');
    }
  }

  async function handleNovoComentario() {
    if (!colaboradorId || !novoComentario.trim()) return;
    setAEnviarComentario(true);
    try {
      const criado = await mentorPortalService.comentar({
        colaborador_id: colaboradorId,
        texto: novoComentario.trim(),
        visivel_colaborador: comentarioVisivel,
      });
      setComentarios((prev) => [criado, ...prev]);
      setNovoComentario('');
      toast.success('Comentário publicado');
    } catch {
      toast.error('Não foi possível publicar o comentário');
    } finally {
      setAEnviarComentario(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded bg-navy-100 animate-pulse" />
        <div className="rounded-2xl border border-navy-100 bg-white p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-navy-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-56 rounded bg-navy-100 animate-pulse" />
              <div className="h-4 w-40 rounded bg-navy-100 animate-pulse" />
            </div>
            <div className="h-20 w-20 rounded-full bg-navy-100 animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-navy-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (erro || !colaborador) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/mentor/mentorados')}
          className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos Mentorados
        </button>
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Não foi possível abrir este mentorado"
          description={erro ?? 'Pode ter sido removido ou não tens acesso.'}
          action={{ label: 'Tentar novamente', onClick: carregar }}
        />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.button
        variants={staggerItem}
        onClick={() => navigate('/mentor/mentorados')}
        className="flex items-center gap-1 text-sm text-navy-500 transition-colors hover:text-navy-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos Mentorados
      </motion.button>

      {/* Identidade + Progresso */}
      <motion.div variants={staggerItem} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar name={colaborador.nome} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-navy-800 truncate">{colaborador.nome}</h1>
            <p className="text-sm text-navy-500 truncate">{colaborador.funcao}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-navy-500">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {colaborador.direccao}
              </span>
              {colaborador.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {colaborador.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Admissão: {new Date(colaborador.data_admissao).toLocaleDateString('pt-AO')}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {colaborador.categoria && (
                <Badge variant="accent" size="sm">
                  {colaborador.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos'}
                </Badge>
              )}
              <Badge
                variant={
                  colaborador.estado_onboarding === 'concluido'
                    ? 'success'
                    : colaborador.estado_onboarding === 'em_curso'
                    ? 'info'
                    : 'neutral'
                }
                size="sm"
              >
                {colaborador.estado_onboarding === 'concluido'
                  ? 'Onboarding Concluído'
                  : colaborador.estado_onboarding === 'em_curso'
                  ? 'Onboarding em Curso'
                  : 'Onboarding Não Iniciado'}
              </Badge>
              <Badge variant={colaborador.welcome_completed ? 'success' : 'warning'} size="sm">
                {colaborador.welcome_completed ? 'Welcome OK' : 'Welcome pendente'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressRing value={stats.pct} size={88} strokeWidth={7} />
            <p className="mt-1 text-xs text-navy-400">Trilho concluído</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-navy-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SumarioTile label="Concluídas" value={stats.concluidas} tone="success" />
          <SumarioTile label="Em curso" value={stats.emCurso} tone="info" />
          <SumarioTile label="A validar" value={stats.aValidar} tone="warning" />
          <SumarioTile label="Bloqueadas" value={stats.atrasadas} tone="error" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link to={`/mentor/avaliacoes/nova?colaborador=${colaborador.id}`}>
            <Button variant="primary" size="sm" leftIcon={<ClipboardEdit className="h-4 w-4" />}>
              Nova avaliação
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExportarRelatorio}
          >
            Relatório de Integração
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={carregar}
          >
            Recarregar
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem} className="border-b border-navy-100">
        <nav className="flex gap-6 -mb-px">
          <TabBtn active={tab === 'trilho'} onClick={() => setTab('trilho')} icon={<RouteIcon className="h-4 w-4" />} label="Trilho & Checklist" />
          <TabBtn active={tab === 'comentarios'} onClick={() => setTab('comentarios')} icon={<MessageSquare className="h-4 w-4" />} label={`Comentários (${comentarios.length})`} />
          <TabBtn active={tab === 'timeline'} onClick={() => setTab('timeline')} icon={<Activity className="h-4 w-4" />} label={`Timeline (${timeline.length})`} />
        </nav>
      </motion.div>

      {tab === 'trilho' && (
        <motion.div variants={staggerItem} className="space-y-4">
          {etapasPorFase.length === 0 ? (
            <EmptyState
              icon={<RouteIcon className="h-6 w-6" />}
              title="Sem trilho atribuído"
              description="Este colaborador ainda não tem trilho de indução. A DPC pode atribuir um a partir da lista de Colaboradores."
            />
          ) : (
            etapasPorFase.map((grupo) => (
              <Card key={grupo.nome ?? 'sem-fase'}>
                {grupo.nome && (
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {grupo.numero != null && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-navy-700 text-xs font-bold text-white">
                          {grupo.numero}
                        </span>
                      )}
                      {grupo.nome}
                    </CardTitle>
                    <span className="text-xs text-navy-400">{grupo.etapas.length} etapa(s)</span>
                  </CardHeader>
                )}
                <div className="space-y-2">
                  {grupo.etapas.map((et) => {
                    const cfg = ESTADO_CFG[et.estado] ?? ESTADO_CFG.nao_iniciada;
                    const Icon = TIPO_ICONS[et.etapa_tipo] ?? BookOpen;
                    const feitos = checklistByProgresso.get(et.id) ?? new Set<string>();
                    const totalItens = et.checklist_items?.length ?? 0;
                    const feitosCount = totalItens
                      ? et.checklist_items.filter((i) => feitos.has(i.key)).length
                      : 0;
                    const expanded = expandedEtapa === et.id;
                    return (
                      <div
                        key={et.id}
                        className={cn(
                          'rounded-xl border transition-colors',
                          expanded ? 'border-navy-200 bg-navy-25' : 'border-navy-100 bg-white',
                        )}
                      >
                        <button
                          onClick={() => setExpandedEtapa(expanded ? null : et.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
                            {et.estado === 'concluida' ? (
                              <CheckCircle2 className="h-4 w-4 text-success-600" />
                            ) : et.estado === 'em_curso' || et.estado === 'em_preparacao' ? (
                              <Clock className="h-4 w-4 text-info-600" />
                            ) : et.estado === 'aguardar_validacao' ? (
                              <ClipboardCheck className="h-4 w-4 text-warning-600" />
                            ) : et.estado === 'atrasada' || et.estado === 'bloqueada' ? (
                              <AlertTriangle className="h-4 w-4 text-error-500" />
                            ) : (
                              <Lock className="h-4 w-4 text-navy-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-navy-400" />
                              <p className="truncate text-sm font-medium text-navy-800">
                                {et.etapa_nome}
                              </p>
                              {et.obrigatoria && (
                                <span className="text-[10px] font-semibold text-error-500">*</span>
                              )}
                              {et.bloqueante && (
                                <Badge variant="warning" size="sm">Bloqueante</Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-navy-500">
                              <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
                              <span>{et.duracao_dias} dia(s)</span>
                              {(et.data_inicio || et.data_prevista) && (
                                <span>
                                  {et.data_inicio ? `Início ${formatarData(et.data_inicio)}` : 'Início —'}
                                  {' · '}
                                  {et.data_prevista ? `Fim ${formatarData(et.data_prevista)}` : 'Fim —'}
                                </span>
                              )}
                              {totalItens > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <ClipboardCheck className="h-3 w-3" />
                                  {feitosCount}/{totalItens} itens
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 text-navy-400 transition-transform',
                              expanded && 'rotate-90',
                            )}
                          />
                        </button>

                        {expanded && (
                          <div className="border-t border-navy-100 px-4 py-4 space-y-4">
                            {et.descricao && (
                              <p className="text-sm text-navy-600">{et.descricao}</p>
                            )}

                            {/* Read-only para o mentor — quem marca conclusão é o colaborador */}
                            <DatasEtapaEditor etapa={et} onSaved={carregar} />

                            <div className="rounded-lg border border-navy-100 bg-navy-25 px-3 py-2 text-xs">
                              <p className="text-[10px] font-medium uppercase text-navy-400">Estado</p>
                              <p className="mt-0.5 text-navy-800">{cfg.label}</p>
                            </div>
                            <ResponsavelEtapa etapa={et} podeEditar={podeDefinirResponsavel} onSaved={carregar} />

                            <DocumentosEtapa
                              progressoId={et.id}
                              documentos={et.documentos_pedidos ?? []}
                              anexos={anexos.filter((a) => a.progresso_id === et.id)}
                              editavel={false}
                              avisoBloqueado="O colaborador ainda não anexou documentos."
                            />

                            {et.checklist_items && et.checklist_items.length > 0 && (
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-500">
                                  Checklist (somente leitura)
                                </p>
                                <div className="space-y-1.5">
                                  {et.checklist_items.map((item) => {
                                    const done = feitos.has(item.key);
                                    return (
                                      <div
                                        key={item.key}
                                        className={cn(
                                          'flex items-start gap-3 rounded-lg border p-2.5',
                                          done ? 'border-success-200 bg-success-50/40' : 'border-navy-100 bg-white',
                                        )}
                                      >
                                        <div className={cn(
                                          'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border-2',
                                          done ? 'border-success-600 bg-success-600 text-white' : 'border-navy-300 bg-white',
                                        )}>
                                          {done && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className={cn('text-sm', done ? 'text-success-700' : 'text-navy-800')}>
                                            {item.label}
                                            {item.obrigatorio && <span className="ml-1 text-error-500">*</span>}
                                          </p>
                                          {item.responsavel && (
                                            <p className="text-[11px] text-navy-500">
                                              Responsável: {item.responsavel}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {et.observacoes && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-500">
                                  Observações
                                </p>
                                <p className="whitespace-pre-wrap rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700">
                                  {et.observacoes}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-navy-500">
                              {et.data_inicio && (
                                <span>Iniciada: {new Date(et.data_inicio).toLocaleDateString('pt-AO')}</span>
                              )}
                              {et.data_conclusao && (
                                <span className="inline-flex items-center gap-1 text-success-600">
                                  <Sparkles className="h-3 w-3" />
                                  Concluída: {new Date(et.data_conclusao).toLocaleDateString('pt-AO')}
                                </span>
                              )}
                            </div>

                            <p className="rounded-lg bg-info-50/50 px-3 py-2 text-[11px] text-info-700">
                              {podeDefinirResponsavel
                                ? 'Podes ajustar as datas e o responsável. O estado das etapas continua a ser actualizado pelo próprio colaborador.'
                                : 'Podes ajustar as datas de início e fim. O estado das etapas continua a ser actualizado pelo próprio colaborador.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))
          )}

          {stats.total > 0 && (
            <div className="rounded-xl border border-navy-100 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-navy-500">
                <span>Progresso do trilho</span>
                <span className="tabular-nums font-medium">
                  {stats.concluidas} / {stats.total} · {stats.pct}%
                </span>
              </div>
              <ProgressBar value={stats.pct} size="md" />
            </div>
          )}
        </motion.div>
      )}

      {tab === 'comentarios' && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Card>
            <CardTitle className="mb-3">Novo comentário</CardTitle>
            <div className="space-y-3">
              <Textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Escreve uma nota ou feedback para o mentorado / DPC..."
                autoResize
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-navy-600 cursor-pointer">
                  <Checkbox
                    checked={comentarioVisivel}
                    onCheckedChange={(checked) => setComentarioVisivel(checked)}
                  />
                  Visível para o colaborador
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="h-4 w-4" />}
                  loading={aEnviarComentario}
                  disabled={!novoComentario.trim()}
                  onClick={handleNovoComentario}
                >
                  Publicar
                </Button>
              </div>
            </div>
          </Card>

          {comentarios.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="Sem comentários"
              description="Adiciona o primeiro comentário para começar o histórico."
            />
          ) : (
            <div className="space-y-3">
              {comentarios.map((c) => (
                <div key={c.id} className="rounded-xl border border-navy-100 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.autor_nome ?? '—'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-800">
                        {c.autor_nome ?? 'Autor desconhecido'}
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
                    <Badge variant={c.visivel_colaborador ? 'info' : 'neutral'} size="sm">
                      {c.visivel_colaborador ? 'Visível ao colaborador' : 'Só mentor / DPC'}
                    </Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-navy-700">{c.texto}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'timeline' && (
        <motion.div variants={staggerItem}>
          {timeline.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="Sem eventos ainda"
              description="Assim que houver actividade (etapas concluídas, avaliações submetidas, etc.), aparece aqui."
            />
          ) : (
            <div className="rounded-2xl border border-navy-100 bg-white p-6">
              <div className="space-y-1">
                {timeline.map((ev, idx) => {
                  const isLast = idx === timeline.length - 1;
                  return (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-navy-500" />
                        </div>
                        {!isLast && <div className="my-1 w-px flex-1 bg-navy-100" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm text-navy-800">{ev.descricao}</p>
                        <p className="mt-0.5 text-[11px] text-navy-400">
                          {ev.actor_nome ?? 'Sistema'}
                          {ev.actor_role ? ` (${ev.actor_role})` : ''} ·{' '}
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
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function SumarioTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'info' | 'error' | 'warning' | 'neutral';
}) {
  const cls = {
    success: 'bg-success-50 text-success-700',
    info: 'bg-info-50 text-info-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-600',
    neutral: 'bg-navy-50 text-navy-600',
  }[tone];
  return (
    <div className={`rounded-lg ${cls} px-3 py-2.5 text-center`}>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider">{label}</p>
    </div>
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

function responsavelVisivel(etapa: EtapaMentor) {
  return etapa.responsavel?.trim() || etapa.responsavel_default?.trim() || '';
}

function ResponsavelEtapa({ etapa, podeEditar, onSaved }: { etapa: EtapaMentor; podeEditar: boolean; onSaved: () => void }) {
  const actual = responsavelVisivel(etapa);
  const [valor, setValor] = useState(actual);
  const [saving, setSaving] = useState(false);

  if (!podeEditar) {
    return (
      <div className="rounded-lg border border-navy-100 bg-navy-25 px-3 py-2 text-xs">
        <p className="text-[10px] font-medium uppercase text-navy-400">Responsável</p>
        <p className="mt-0.5 text-navy-800">{actual || '—'}</p>
      </div>
    );
  }

  async function guardar() {
    setSaving(true);
    try {
      await mentorPortalService.atualizarEtapa(etapa.id, { responsavel: valor.trim() });
      toast.success('Responsável actualizado');
      onSaved();
    } catch {
      toast.error('Não foi possível guardar o responsável');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy-100 bg-white px-3 py-2">
      <FormField label="Responsável">
        <div className="flex items-center gap-2">
          <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: DPC, Mentor, Área" />
          <Button variant="accent" size="sm" onClick={guardar} loading={saving} disabled={valor.trim() === responsavelVisivel(etapa)}>
            Guardar
          </Button>
        </div>
      </FormField>
    </div>
  );
}

function DatasEtapaEditor({ etapa, onSaved }: { etapa: EtapaMentor; onSaved: () => void }) {
  const [inicio, setInicio] = useState(etapa.data_inicio?.slice(0, 10) ?? '');
  const [fim, setFim] = useState(etapa.data_prevista?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!inicio || !fim) return toast.error('Indique início e fim');
    if (fim < inicio) return toast.error('O fim tem de ser igual ou posterior ao início');
    setSaving(true);
    try {
      await mentorPortalService.atualizarEtapa(etapa.id, { data_inicio: inicio, data_prevista: fim });
      toast.success('Datas actualizadas');
      onSaved();
    } catch {
      toast.error('Não foi possível guardar as datas');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <FormField label="Início">
        <DateInput value={inicio} onChange={(v) => setInicio(v)} />
      </FormField>
      <FormField label="Fim">
        <DateInput value={fim} onChange={(v) => setFim(v)} />
      </FormField>
      <Button variant="accent" size="sm" onClick={guardar} loading={saving}>Guardar datas</Button>
    </div>
  );
}
