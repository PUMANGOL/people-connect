import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserCheck, CheckCircle, Clock, AlertTriangle, Lock,
  BookOpen, MessageSquare, GraduationCap, Settings, Layers,
  ClipboardCheck, CheckCircle2, Route as RouteIcon, Mail, Building2,
  Calendar, RefreshCw, Sparkles, UserPlus, UserX, Pencil, FileEdit, Download,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge, ProgressBar, ProgressRing, Avatar } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { Dialog, ConfirmDialog } from '@/src/components/ui/dialog';
import { Select, FormField, Input, Textarea } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { colaboradoresService, submissoesService, type SubmissaoItem, type ColaboradorRow } from '@/src/services/onboarding-v2.service';
import { assignmentsService, mentorsService, colaboradorFeedbackService, mentorPortalService, type EtapaMentor, type ChecklistItemProgresso } from '@/src/services/mentoria.service';
import { MentorFichaCampos } from '@/src/components/MentorFichaCampos';
import { DocumentosEtapa } from '@/src/components/onboarding/DocumentosEtapa';
import { anexosService, type DocumentoPedido, type EtapaAnexo } from '@/src/services/anexos.service';
import { SearchableSelect } from '@/src/components/ui/searchable-select';
import { tempoExperiencia } from '@/src/lib/tempo-experiencia';
import type { MentorAssignment, Mentor, ColaboradorFeedback } from '@/lib/types';
import { MOMENTOS_AVALIACAO, CLASSIFICACOES_GLOBAIS_FEEDBACK, ESTADOS_ETAPA_V3, ESCALA_QUALITATIVA_FEEDBACK, ESCALA_SIM_PARCIAL_NAO, ESCALA_ELEVADO_MEDIO_BAIXO } from '@/lib/avaliacao-schemas';
import { exportarFeedbackColaboradorPDF } from '@/src/lib/pdf-mentoria';
import { toast } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import { etapaEmAtraso, formatarData } from '@/src/lib/datas';
import { Checkbox } from '@/components/ui/checkbox';

const TIPO_ICONS: Record<string, typeof BookOpen> = {
  documental: BookOpen, conversacional: MessageSquare, formacao: GraduationCap, administrativo: Settings, misto: Layers,
};
const ESTADO_CFG: Record<string, { label: string; bgColor: string; badge: 'success' | 'info' | 'error' | 'neutral' }> = {
  pendente: { label: 'Bloqueada', bgColor: 'bg-navy-100', badge: 'neutral' },
  em_curso: { label: 'Em Curso', bgColor: 'bg-info-100', badge: 'info' },
  concluida: { label: 'Concluída', bgColor: 'bg-success-100', badge: 'success' },
  atrasada: { label: 'Atrasada', bgColor: 'bg-error-100', badge: 'error' },
};

interface ProgRow {
  id: string;
  estado: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  data_prevista?: string | null;
  etapa_nome: string;
  etapa_tipo: string;
  duracao_dias: number;
  descricao: string | null;
  ordem?: number;
  documentos_pedidos?: DocumentoPedido[];
}

export default function ColaboradorProgressoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [colaborador, setColaborador] = useState<ColaboradorRow | null>(null);
  const [progresso, setProgresso] = useState<ProgRow[]>([]);
  const [submissoes, setSubmissoes] = useState<SubmissaoItem[]>([]);
  const [anexos, setAnexos] = useState<EtapaAnexo[]>([]);
  const [assignments, setAssignments] = useState<MentorAssignment[]>([]);
  const [feedbacks, setFeedbacks] = useState<ColaboradorFeedback[]>([]);
  const [feedbackDetalhe, setFeedbackDetalhe] = useState<ColaboradorFeedback | null>(null);
  const [progressoFull, setProgressoFull] = useState<EtapaMentor[]>([]);
  const [checklistProg, setChecklistProg] = useState<ChecklistItemProgresso[]>([]);
  const [etapaEmEdicao, setEtapaEmEdicao] = useState<EtapaMentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [terminandoAssignment, setTerminandoAssignment] = useState(false);
  const [confirmTerminar, setConfirmTerminar] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) {
      setErro('ID de colaborador em falta na URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const detalhe = await colaboradoresService.getById(id);
      setColaborador(detalhe.colaborador ?? null);
      setProgresso((detalhe.progresso as unknown as ProgRow[]) ?? []);
      // As submissões são secundárias — falham silenciosamente.
      try {
        const subs = await submissoesService.doColaborador(id);
        setSubmissoes(subs);
      } catch {
        setSubmissoes([]);
      }
      try {
        setAnexos(await anexosService.doColaborador(id));
      } catch {
        setAnexos([]);
      }
      // Assignments do mentor — histórico + activo (silencioso em caso de erro)
      try {
        const asgs = await assignmentsService.list(id);
        setAssignments(asgs);
      } catch {
        setAssignments([]);
      }
      // Feedbacks (auto-avaliação) submetidos pelo colaborador
      try {
        const fbs = await colaboradorFeedbackService.porColaborador(id);
        setFeedbacks(fbs);
      } catch {
        setFeedbacks([]);
      }
      // Progresso "rico" (com checklist_items, fase, etc.) via endpoint mentor-portal
      // (o admin tem acesso — user.role === 'rh_admin' passa por todos os guards)
      try {
        const detalheRico = await mentorPortalService.detalhe(id);
        setProgressoFull(detalheRico.progresso);
        setChecklistProg(detalheRico.checklist_progresso);
      } catch {
        setProgressoFull([]);
        setChecklistProg([]);
      }
    } catch (err) {
      setColaborador(null);
      setProgresso([]);
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o colaborador.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const assignmentActivo = assignments.find((a) => a.activo);

  async function handleTerminarMentor() {
    if (!assignmentActivo) return;
    setTerminandoAssignment(true);
    try {
      await assignmentsService.terminar(assignmentActivo.id);
      toast.success('Atribuição do mentor terminada');
      setConfirmTerminar(false);
      await carregar();
    } catch {
      toast.error('Não foi possível terminar a atribuição');
    } finally {
      setTerminandoAssignment(false);
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
              <div className="h-4 w-64 rounded bg-navy-100 animate-pulse" />
            </div>
            <div className="h-20 w-20 rounded-full bg-navy-100 animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-navy-50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (erro || !colaborador) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/onboarding')} className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700">
          <ArrowLeft className="h-4 w-4" /> Voltar aos Colaboradores
        </button>
        <div className="rounded-2xl border border-error-100 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-50 text-error-500">
            <UserCheck className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-navy-800">Não foi possível carregar o colaborador</h2>
          <p className="mt-1 text-sm text-navy-500">{erro ?? 'O colaborador pode ter sido removido, ou não tens acesso.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/onboarding')}>
              Voltar à lista
            </Button>
            <Button variant="primary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const concluidas = progresso.filter((p) => p.estado === 'concluida').length;
  const atrasadas = progresso.filter((p) => etapaEmAtraso(p.estado, p.data_prevista)).length;
  const emCurso = progresso.filter((p) => p.estado === 'em_curso' && !etapaEmAtraso(p.estado, p.data_prevista)).length;
  const bloqueadas = progresso.filter((p) => p.estado === 'pendente' && !etapaEmAtraso(p.estado, p.data_prevista)).length;
  const pct = progresso.length > 0 ? Math.round((concluidas / progresso.length) * 100) : 0;

  const confirmados = submissoes.filter((s) => s.estado !== 'pendente').length;
  const pctSub = submissoes.length > 0 ? Math.round((confirmados / submissoes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/onboarding')} className="flex items-center gap-1 text-sm text-navy-500 transition-colors hover:text-navy-700">
        <ArrowLeft className="h-4 w-4" /> Voltar aos Colaboradores
      </button>

      {/* === Cartão de identidade + progresso === */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar name={colaborador.nome} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-navy-800 truncate">{colaborador.nome}</h1>
            <p className="text-sm text-navy-500 truncate">{colaborador.funcao}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-navy-500">
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {colaborador.direccao}</span>
              {colaborador.email && (
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {colaborador.email}</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Admissão: {new Date(colaborador.data_admissao).toLocaleDateString('pt-AO')}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {colaborador.categoria && (
                <Badge variant="accent" size="sm">
                  {colaborador.categoria === 'gestao' ? 'Direção / Gestão' : 'Técnicos'}
                </Badge>
              )}
              <Badge variant={colaborador.estado_onboarding === 'concluido' ? 'success' : colaborador.estado_onboarding === 'em_curso' ? 'info' : 'neutral'} size="sm">
                {colaborador.estado_onboarding === 'concluido' ? 'Onboarding Concluído' : colaborador.estado_onboarding === 'em_curso' ? 'Onboarding em Curso' : 'Onboarding Não Iniciado'}
              </Badge>
              <Badge variant={colaborador.welcome_completed ? 'success' : 'warning'} size="sm">
                {colaborador.welcome_completed ? 'Welcome Concluído' : 'Welcome Pendente'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressRing value={pct} size={88} strokeWidth={7} />
            <p className="text-xs text-navy-400 mt-1">Trilho concluído</p>
          </div>
        </div>

        {/* Sumário de etapas */}
        <div className="mt-6 pt-6 border-t border-navy-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SumarioTile label="Concluídas" value={concluidas} tone="success" />
          <SumarioTile label="Em curso" value={emCurso} tone="info" />
          <SumarioTile label="Atrasadas" value={atrasadas} tone="error" />
          <SumarioTile label="Bloqueadas" value={bloqueadas} tone="neutral" />
        </div>
      </div>

      {/* === Card Mentor === */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-navy-500" />
            <h2 className="text-lg font-semibold text-navy-800">Mentor</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assignmentActivo ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Pencil className="h-4 w-4" />}
                  onClick={() => setShowAssignModal(true)}
                >
                  Mudar mentor
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<UserX className="h-4 w-4" />}
                  onClick={() => setConfirmTerminar(true)}
                >
                  Terminar atribuição
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UserPlus className="h-4 w-4" />}
                onClick={() => setShowAssignModal(true)}
              >
                Atribuir mentor
              </Button>
            )}
          </div>
        </div>

        {assignmentActivo ? (
          <div className="mt-4 rounded-xl border border-navy-100 bg-navy-25 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={assignmentActivo.mentor_nome ?? '—'} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-800">
                  {assignmentActivo.mentor_nome ?? 'Mentor'}
                </p>
                <p className="text-xs text-navy-400">
                  Atribuído em{' '}
                  {new Date(assignmentActivo.atribuido_em).toLocaleDateString('pt-AO')}
                </p>
              </div>
              <Badge variant="success" size="sm">Activo</Badge>
            </div>
            <div className="mt-3">
              <MentorFichaCampos
                email={assignmentActivo.mentor_email}
                departamento={assignmentActivo.mentor_departamento}
                funcao={assignmentActivo.mentor_funcao}
                dataInicioContrato={assignmentActivo.mentor_data_inicio_contrato}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-navy-500">
            Este colaborador ainda não tem mentor atribuído. A mentoria é parte do processo
            Pumangol — atribui um mentor para desbloquear o acompanhamento.
          </p>
        )}

        {/* Histórico */}
        {assignments.filter((a) => !a.activo).length > 0 && (
          <div className="mt-4 pt-4 border-t border-navy-100">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-400">
              Histórico
            </p>
            <ul className="space-y-1 text-xs text-navy-500">
              {assignments
                .filter((a) => !a.activo)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-navy-300" />
                    <span className="font-medium text-navy-700">{a.mentor_nome ?? 'Mentor'}</span>
                    <span>·</span>
                    <span>
                      {new Date(a.atribuido_em).toLocaleDateString('pt-AO')}
                      {a.terminado_em
                        ? ` — ${new Date(a.terminado_em).toLocaleDateString('pt-AO')}`
                        : ''}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {/* === Feedback submetido pelo colaborador === */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-800">
            <FileEdit className="h-5 w-5 text-navy-500" /> Feedback do Colaborador
          </h2>
          {feedbacks.length > 0 && (
            <span className="text-xs text-navy-500 tabular-nums">
              {feedbacks.filter((f) => f.estado === 'submetida' || f.estado === 'validada').length}
              {' '}submetido(s) de {feedbacks.length}
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-navy-500">
          Auto-avaliação preenchida pelo colaborador nos momentos definidos (Dia 15/30/60/90 e Final).
          O rascunho não é visível — apenas os feedbacks submetidos ou validados.
        </p>
        {feedbacks.length === 0 || feedbacks.every((f) => f.estado === 'rascunho') ? (
          <EmptyState
            icon={<FileEdit className="h-6 w-6" />}
            title="Sem feedback submetido"
            description="O colaborador ainda não submeteu nenhuma auto-avaliação. Rascunhos em curso não aparecem aqui."
          />
        ) : (
          <div className="space-y-2">
            {feedbacks
              .filter((f) => f.estado !== 'rascunho')
              .map((f) => {
                const momentoLbl = MOMENTOS_AVALIACAO.find((m) => m.value === f.momento)?.label ?? f.momento;
                const classifLbl = CLASSIFICACOES_GLOBAIS_FEEDBACK.find((c) => c.value === f.classificacao_global)?.label;
                const isValidada = f.estado === 'validada';
                return (
                  <button
                    key={f.id}
                    onClick={() => setFeedbackDetalhe(f)}
                    className="flex w-full items-center gap-3 rounded-xl border border-navy-100 bg-white p-3 text-left transition hover:shadow-card hover:border-navy-200"
                  >
                    <div className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                      isValidada ? 'bg-success-50 text-success-600' : 'bg-info-50 text-info-600',
                    )}>
                      {isValidada ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-800">{momentoLbl}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-navy-500">
                        <Badge variant={isValidada ? 'success' : 'info'} size="sm">
                          {isValidada ? 'Validado' : 'Submetido'}
                        </Badge>
                        {f.submetido_em && (
                          <span>
                            {new Date(f.submetido_em).toLocaleDateString('pt-AO')}
                          </span>
                        )}
                        {classifLbl && <span>· {classifLbl}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* === Etapas do Trilho === */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-800">
            <RouteIcon className="h-5 w-5 text-navy-500" /> Etapas do Trilho
          </h2>
          {progresso.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-navy-500">
              <span className="tabular-nums font-medium">{concluidas} / {progresso.length}</span>
              <div className="w-24"><ProgressBar value={pct} size="sm" /></div>
            </div>
          )}
        </div>
        {progresso.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title="Sem trilho atribuído"
            description="Este colaborador ainda não tem trilho de onboarding. Atribui um trilho na lista de Colaboradores."
            action={{ label: 'Voltar à lista', onClick: () => navigate('/onboarding') }}
          />
        ) : (
          <div className="space-y-1">
            {progresso.map((prog, idx) => {
              const atrasada = etapaEmAtraso(prog.estado, prog.data_prevista);
              const estadoVisual = atrasada ? 'atrasada' : prog.estado;
              const cfg = ESTADO_CFG[estadoVisual] ?? ESTADO_CFG.pendente;
              const Icon = TIPO_ICONS[prog.etapa_tipo] ?? BookOpen;
              const isLast = idx === progresso.length - 1;
              // Etapa "rica" com checklist_items para o modal admin
              const etapaRica = progressoFull.find((p) => p.id === prog.id) ?? null;
              const isConcluida = prog.estado === 'concluida';
              return (
                <div key={prog.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bgColor}`}>
                      {estadoVisual === 'concluida' ? <CheckCircle className="h-5 w-5 text-success-600" />
                        : estadoVisual === 'atrasada' ? <AlertTriangle className="h-5 w-5 text-error-500" />
                        : estadoVisual === 'em_curso' ? <Clock className="h-5 w-5 text-info-600" />
                        : <Lock className="h-5 w-5 text-navy-400" />}
                    </div>
                    {!isLast && <div className="my-1 w-px flex-1 bg-navy-100" />}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-navy-400" />
                          <p className="font-medium text-navy-800">{prog.etapa_nome}</p>
                        </div>
                        {prog.descricao && <p className="mt-0.5 text-xs text-navy-500">{prog.descricao}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
                          <span className="text-xs text-navy-400">{prog.duracao_dias ?? 1} dia(s)</span>
                          {prog.data_inicio && (
                            <span className="text-xs text-info-600">Início {formatarData(prog.data_inicio)}</span>
                          )}
                          {prog.data_prevista && (
                            <span className={cn('text-xs', atrasada ? 'font-medium text-error-600' : 'text-navy-500')}>
                              Fim {formatarData(prog.data_prevista)}
                            </span>
                          )}
                          {prog.data_conclusao && (
                            <span className="text-xs text-success-600 inline-flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Concluída {new Date(prog.data_conclusao).toLocaleDateString('pt-AO')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acções admin (full access) */}
                      {etapaRica && (
                        <div className="flex flex-wrap items-center gap-2">
                          {!isConcluida && (
                            <Button
                              variant="accent"
                              size="sm"
                              leftIcon={<CheckCircle2 className="h-4 w-4" />}
                              onClick={async () => {
                                if (!window.confirm(`Marcar "${prog.etapa_nome}" como concluída?`)) return;
                                try {
                                  await mentorPortalService.concluirEtapa(prog.id);
                                  toast.success('Etapa concluída');
                                  carregar();
                                } catch {
                                  toast.error('Não foi possível concluir a etapa');
                                }
                              }}
                            >
                              Concluir
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Pencil className="h-4 w-4" />}
                            onClick={() => setEtapaEmEdicao(etapaRica)}
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                    <DocumentosEtapa
                      progressoId={prog.id}
                      documentos={prog.documentos_pedidos ?? []}
                      anexos={anexos.filter((a) => a.progresso_id === prog.id)}
                      editavel={false}
                      avisoBloqueado="O colaborador ainda não anexou documentos."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === Confirmação de Documentos (só leitura) === */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-800">
            <ClipboardCheck className="h-5 w-5 text-navy-500" /> Confirmação de Documentos
          </h2>
          {submissoes.length > 0 && (
            <div className="text-right">
              <p className="text-sm font-medium text-navy-700 tabular-nums">
                {confirmados} / {submissoes.length}
              </p>
              <p className="text-xs text-navy-400">{pctSub}% confirmados</p>
            </div>
          )}
        </div>
        <p className="mb-4 text-xs text-navy-500">
          O colaborador confirma os documentos que já entregou e pode carregar o ficheiro. Esta lista é só de consulta.
        </p>
        {submissoes.length === 0 ? (
          <p className="text-sm text-navy-400">Sem documentos exigidos configurados.</p>
        ) : (
          <div className="space-y-2">
            {submissoes.map((s) => {
              const confirmado = s.estado !== 'pendente';
              return (
                <div
                  key={s.documento_exigido_id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    confirmado ? 'border-success-200 bg-success-50/40' : 'border-navy-100',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2',
                      confirmado ? 'border-success-600 bg-success-600 text-white' : 'border-navy-300 bg-white',
                    )}
                  >
                    {confirmado && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-medium', confirmado ? 'text-success-700' : 'text-navy-800')}>
                      {s.nome}
                      {s.obrigatorio && <span className="ml-1 text-error-500">*</span>}
                    </p>
                    {s.descricao && <p className="text-xs text-navy-500">{s.descricao}</p>}
                    {confirmado && s.submetido_em && (
                      <p className="mt-0.5 text-xs text-success-600">
                        Confirmado em {new Date(s.submetido_em).toLocaleDateString('pt-AO')}
                      </p>
                    )}
                  </div>
                  <Badge variant={confirmado ? 'success' : 'neutral'} size="sm">
                    {confirmado ? 'Confirmado' : 'Pendente'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAssignModal && id && (
        <AtribuirMentorModal
          colaboradorId={id}
          assignmentActivo={assignmentActivo ?? null}
          onClose={() => setShowAssignModal(false)}
          onDone={() => { setShowAssignModal(false); carregar(); }}
        />
      )}

      <ConfirmDialog
        open={confirmTerminar}
        onClose={() => setConfirmTerminar(false)}
        onConfirm={handleTerminarMentor}
        title="Terminar atribuição do mentor?"
        description={
          assignmentActivo
            ? `A atribuição de ${assignmentActivo.mentor_nome ?? 'este mentor'} será terminada. O colaborador ficará sem mentor activo até nova atribuição.`
            : ''
        }
        confirmLabel="Sim, terminar"
        destructive
        loading={terminandoAssignment}
      />

      {feedbackDetalhe && colaborador && (
        <FeedbackDetalheModal
          feedback={feedbackDetalhe}
          colaboradorNome={colaborador.nome}
          onClose={() => setFeedbackDetalhe(null)}
        />
      )}

      {etapaEmEdicao && (
        <EditarEtapaModal
          etapa={etapaEmEdicao}
          checklistProg={checklistProg}
          onClose={() => setEtapaEmEdicao(null)}
          onSaved={() => { setEtapaEmEdicao(null); carregar(); }}
        />
      )}
    </div>
  );
}

function EditarEtapaModal({
  etapa,
  checklistProg,
  onClose,
  onSaved,
}: {
  etapa: EtapaMentor;
  checklistProg: ChecklistItemProgresso[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [estado, setEstado] = useState(etapa.estado);
  const [dataInicio, setDataInicio] = useState(etapa.data_inicio ? etapa.data_inicio.slice(0, 10) : '');
  const [dataPrevista, setDataPrevista] = useState(etapa.data_prevista ? etapa.data_prevista.slice(0, 10) : '');
  const [observacoes, setObservacoes] = useState(etapa.observacoes ?? '');
  const [responsavel, setResponsavel] = useState(etapa.responsavel?.trim() || etapa.responsavel_default?.trim() || '');
  const [feitos, setFeitos] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const ci of checklistProg) {
      if (ci.progresso_id === etapa.id && ci.concluido) s.add(ci.item_key);
    }
    return s;
  });
  const [saving, setSaving] = useState(false);

  const estadoOptions = ESTADOS_ETAPA_V3.map((e) => ({ value: e.value, label: e.label }));

  async function toggleCheck(itemKey: string, marcar: boolean) {
    try {
      await mentorPortalService.toggleChecklist({
        progresso_id: etapa.id,
        item_key: itemKey,
        concluido: marcar,
      });
      setFeitos((prev) => {
        const next = new Set(prev);
        if (marcar) next.add(itemKey);
        else next.delete(itemKey);
        return next;
      });
    } catch {
      toast.error('Não foi possível actualizar o item');
    }
  }

  async function salvar() {
    setSaving(true);
    try {
      if (dataInicio && dataPrevista && dataPrevista < dataInicio) {
        toast.error('O fim tem de ser igual ou posterior ao início');
        setSaving(false);
        return;
      }
      const patch: Partial<{ estado: string; data_inicio: string; data_prevista: string; observacoes: string; responsavel: string }> = {};
      if (estado !== etapa.estado) patch.estado = estado;
      if (dataInicio !== (etapa.data_inicio?.slice(0, 10) ?? '')) patch.data_inicio = dataInicio;
      if (dataPrevista !== (etapa.data_prevista?.slice(0, 10) ?? '')) patch.data_prevista = dataPrevista;
      if (observacoes !== (etapa.observacoes ?? '')) patch.observacoes = observacoes;
      if (responsavel.trim() !== (etapa.responsavel?.trim() || etapa.responsavel_default?.trim() || '')) patch.responsavel = responsavel.trim();
      if (Object.keys(patch).length > 0) {
        await mentorPortalService.atualizarEtapa(etapa.id, patch);
      }
      toast.success('Etapa actualizada');
      onSaved();
    } catch {
      toast.error('Não foi possível guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">Editar etapa</h2>
      <p className="mb-4 text-sm text-navy-500">{etapa.etapa_nome}</p>

      <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Estado">
            <Select options={estadoOptions} value={estado} onChange={setEstado} />
          </FormField>
          <FormField label="Início">
            <DateInput value={dataInicio} onChange={(v) => setDataInicio(v)} />
          </FormField>
          <FormField label="Fim">
            <DateInput value={dataPrevista} onChange={(v) => setDataPrevista(v)} />
          </FormField>
        </div>

        <FormField label="Responsável" hint="Quem trata esta etapa. Ex.: DPC, Mentor, Área.">
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex: DPC" />
        </FormField>

        <FormField label="Observações internas" hint="Notas internas — visíveis para admin/mentor.">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            autoResize
            placeholder="Notas sobre esta etapa..."
          />
        </FormField>

        {etapa.checklist_items && etapa.checklist_items.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-500">
              Checklist ({feitos.size}/{etapa.checklist_items.length})
            </p>
            <div className="space-y-1.5">
              {etapa.checklist_items.map((item) => {
                const done = feitos.has(item.key);
                return (
                  <label
                    key={item.key}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors',
                      done ? 'border-success-200 bg-success-50/40' : 'border-navy-100 bg-white hover:bg-navy-25',
                    )}
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(checked) => toggleCheck(item.key, checked)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', done ? 'text-success-700' : 'text-navy-800')}>
                        {item.label}
                        {item.obrigatorio && <span className="ml-1 text-error-500">*</span>}
                      </p>
                      {item.responsavel && (
                        <p className="text-[11px] text-navy-500">Responsável: {item.responsavel}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" onClick={salvar} loading={saving}>Guardar</Button>
      </div>
    </Dialog>
  );
}

function nivelFeedback(valor: string | undefined): string {
  if (!valor) return '—';
  const escala = [...ESCALA_QUALITATIVA_FEEDBACK, ...ESCALA_SIM_PARCIAL_NAO, ...ESCALA_ELEVADO_MEDIO_BAIXO];
  return escala.find((x) => x.value === valor)?.label ?? valor;
}

function FeedbackDetalheModal({
  feedback,
  colaboradorNome,
  onClose,
}: {
  feedback: ColaboradorFeedback;
  colaboradorNome: string;
  onClose: () => void;
}) {
  const momentoLbl = MOMENTOS_AVALIACAO.find((m) => m.value === feedback.momento)?.label ?? feedback.momento;
  const classifLbl = CLASSIFICACOES_GLOBAIS_FEEDBACK.find((c) => c.value === feedback.classificacao_global)?.label ?? '—';
  const isValidada = feedback.estado === 'validada';

  const fbWithNome: ColaboradorFeedback = { ...feedback, colaborador_nome: colaboradorNome };

  function blocoValores(fonte: Record<string, { valor: string; comentario?: string }> | undefined): [string, string, string][] {
    if (!fonte) return [];
    return Object.entries(fonte).map(([k, v]) => [k, nivelFeedback(v?.valor), v?.comentario ?? '']);
  }

  const geralRows = blocoValores(feedback.avaliacao_geral);
  const culturaRows = blocoValores(
    (feedback.blocos_aprendizagem?.cultura as Record<string, { valor: string; comentario?: string }>) ?? {},
  );
  const mentorRows = blocoValores(feedback.feedback_mentor_gestor);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">Feedback do colaborador</h2>
          <p className="text-sm text-navy-500">{colaboradorNome} · {momentoLbl}</p>
        </div>
        <Badge variant={isValidada ? 'success' : 'info'} size="md">
          {isValidada ? 'Validado' : 'Submetido'}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-navy-800">
            {feedback.categoria === 'gestao' ? 'Dir/Gestão' : 'Téc/Coord'}
          </p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Categoria</p>
        </div>
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-navy-800">{momentoLbl}</p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Momento</p>
        </div>
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-navy-800">{classifLbl}</p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Global</p>
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-3">
        {geralRows.length > 0 && (
          <BlocoLeitura titulo="Avaliação geral" rows={geralRows} />
        )}
        {culturaRows.length > 0 && (
          <BlocoLeitura titulo="Cultura e valores" rows={culturaRows} />
        )}
        {mentorRows.length > 0 && (
          <BlocoLeitura titulo="Feedback sobre o mentor / gestor" rows={mentorRows} />
        )}

        {feedback.principais_aprendizagens && (
          <div className="rounded-lg border border-navy-100 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-500">
              Principais aprendizagens
            </p>
            <p className="text-sm text-navy-700 whitespace-pre-wrap">
              {feedback.principais_aprendizagens}
            </p>
          </div>
        )}
        {feedback.comentarios_finais && (
          <div className="rounded-lg border border-navy-100 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-500">
              Comentários finais
            </p>
            <p className="text-sm text-navy-700 whitespace-pre-wrap">
              {feedback.comentarios_finais}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button
          variant="primary"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={() => exportarFeedbackColaboradorPDF(fbWithNome)}
        >
          Exportar PDF
        </Button>
      </div>
    </Dialog>
  );
}

function BlocoLeitura({ titulo, rows }: { titulo: string; rows: [string, string, string][] }) {
  return (
    <div className="rounded-lg border border-navy-100">
      <p className="border-b border-navy-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-navy-500">
        {titulo}
      </p>
      <div className="divide-y divide-navy-50">
        {rows.map(([key, valor, comentario]) => (
          <div key={key} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-navy-700 capitalize">
                {key.replace(/_/g, ' ')}
              </p>
              <Badge variant={valor === '—' ? 'neutral' : 'accent'} size="sm">
                {valor}
              </Badge>
            </div>
            {comentario && <p className="mt-1 text-xs italic text-navy-500">« {comentario} »</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AtribuirMentorModal({
  colaboradorId,
  assignmentActivo,
  onClose,
  onDone,
}: {
  colaboradorId: string;
  assignmentActivo: MentorAssignment | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mentores, setMentores] = useState<Mentor[]>([]);
  const [mentorId, setMentorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mentorsService
      .list()
      .then((rows) => setMentores(rows.filter((m) => m.activo && m.nome)))
      .catch(() => setMentores([]))
      .finally(() => setLoading(false));
  }, []);

  const opcoes = mentores.filter((m) => m.id !== assignmentActivo?.mentor_id);
  const mentorEscolhido = mentores.find((m) => m.id === mentorId);

  async function submit() {
    if (!mentorId) {
      toast.error('Selecciona um mentor');
      return;
    }
    setSaving(true);
    try {
      const created = await assignmentsService.create({ colaborador_id: colaboradorId, mentor_id: mentorId });
      const detalheConvite = created.convite_mentor === 'enviado'
        ? 'Enviámos um email para o mentor definir a password e entrar no painel.'
        : created.convite_mentor === 'sem_email'
          ? 'Este mentor não tem email, por isso o convite de acesso não foi enviado.'
          : created.convite_mentor === 'falhou'
            ? 'A atribuição ficou registada, mas o email de acesso falhou.'
            : assignmentActivo
              ? 'A atribuição anterior foi terminada automaticamente.'
              : undefined;
      toast.success(
        assignmentActivo ? 'Mentor actualizado' : 'Mentor atribuído',
        detalheConvite,
      );
      onDone();
    } catch {
      toast.error('Não foi possível atribuir o mentor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl min-h-[36rem]">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">
        {assignmentActivo ? 'Mudar mentor' : 'Atribuir mentor'}
      </h2>
      <p className="mb-4 text-sm text-navy-500">
        {assignmentActivo
          ? 'A atribuição actual será terminada e substituída pelo novo mentor.'
          : 'Selecciona o mentor que vai acompanhar este colaborador.'}
      </p>

      {assignmentActivo && (
        <div className="mb-4 rounded-lg border border-navy-100 bg-navy-25 px-3 py-2 text-xs text-navy-600">
          Actual: <strong className="text-navy-800">{assignmentActivo.mentor_nome ?? '—'}</strong>
        </div>
      )}

      <FormField
        label="Mentor"
        required
        hint={
          loading
            ? 'A carregar mentores...'
            : opcoes.length === 0
              ? 'Não há outro nome na tabela de mentores.'
              : undefined
        }
      >
        <SearchableSelect
          options={opcoes.map((m) => ({
            value: m.id,
            label: m.nome,
            hint: tempoExperiencia(m.data_inicio_contrato) ?? undefined,
          }))}
          placeholder={loading ? 'A carregar...' : 'Seleccionar mentor'}
          searchPlaceholder="Pesquisar nome..."
          menuClassName="max-h-80"
          value={mentorId}
          onChange={setMentorId}
          disabled={loading || opcoes.length === 0}
        />
      </FormField>
      {mentorEscolhido && (
        <div className="mt-4">
          <MentorFichaCampos
            email={mentorEscolhido.email}
            departamento={mentorEscolhido.departamento}
            funcao={mentorEscolhido.funcao}
            dataInicioContrato={mentorEscolhido.data_inicio_contrato}
          />
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={saving} disabled={!mentorId}>
          {assignmentActivo ? 'Substituir mentor' : 'Atribuir'}
        </Button>
      </div>
    </Dialog>
  );
}

function SumarioTile({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'error' | 'neutral' }) {
  const cls = {
    success: 'bg-success-50 text-success-700',
    info: 'bg-info-50 text-info-700',
    error: 'bg-error-50 text-error-600',
    neutral: 'bg-navy-50 text-navy-600',
  }[tone];
  return (
    <div className={`rounded-lg ${cls} px-3 py-2.5 text-center`}>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
