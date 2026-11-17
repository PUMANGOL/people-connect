import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardEdit, Filter, CheckCircle2, Clock, FileEdit, Search, Users,
  ShieldCheck, MessageSquareText, Download,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { Card, CardTitle, EmptyState } from '@/src/components/ui/card';
import { Input, Select, FormField, Textarea } from '@/src/components/ui/input';
import { Dialog } from '@/src/components/ui/dialog';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import { mentorAvaliacoesService, colaboradorFeedbackService } from '@/src/services/mentoria.service';
import type {
  MentorAvaliacao, ColaboradorFeedback, EstadoAvaliacao, CategoriaTrilho,
} from '@/lib/types';
import {
  MOMENTOS_AVALIACAO, criteriosAvalMentor, CLASSIFICACOES_GLOBAIS_MENTOR,
  ESCALA_AVALIACAO_MENTOR,
} from '@/lib/avaliacao-schemas';
import { exportarAvaliacaoMentorPDF } from '@/src/lib/pdf-mentoria';
import { exportarCentroAvaliacoesExcel } from '@/src/lib/excel-mentoria';

const ESTADO_OPTIONS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'submetida', label: 'Submetida' },
  { value: 'validada', label: 'Validada' },
];

const CATEGORIA_OPTIONS = [
  { value: 'gestao', label: 'Direção / Gestão' },
  { value: 'tecnicos', label: 'Coord. / Técnicos' },
];

const MOMENTO_OPTIONS = MOMENTOS_AVALIACAO.map((m) => ({ value: m.value, label: m.label }));

function estadoInfo(estado: EstadoAvaliacao) {
  switch (estado) {
    case 'validada':
      return { label: 'Validada', variant: 'success' as const, icon: CheckCircle2 };
    case 'submetida':
      return { label: 'Submetida', variant: 'info' as const, icon: Clock };
    default:
      return { label: 'Rascunho', variant: 'warning' as const, icon: FileEdit };
  }
}

function momentoLabel(m: string): string {
  return MOMENTOS_AVALIACAO.find((x) => x.value === m)?.label ?? m;
}

type Tab = 'mentor' | 'colaborador';

export default function CentroAvaliacoesPage() {
  const [tab, setTab] = useState<Tab>('mentor');
  const [avals, setAvals] = useState<MentorAvaliacao[]>([]);
  const [feedbacks, setFeedbacks] = useState<ColaboradorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fCat, setFCat] = useState('');
  const [fMomento, setFMomento] = useState('');
  const [detalhe, setDetalhe] = useState<MentorAvaliacao | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [a, f] = await Promise.all([
        mentorAvaliacoesService.list(),
        // Feedback do colaborador — só admin: pode falhar silenciosamente.
        Promise.resolve([] as ColaboradorFeedback[]),
      ]);
      setAvals(a);
      setFeedbacks(f);
    } catch {
      setAvals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const kpis = useMemo(() => {
    return {
      total: avals.length,
      rascunho: avals.filter((a) => a.estado === 'rascunho').length,
      submetidas: avals.filter((a) => a.estado === 'submetida').length,
      validadas: avals.filter((a) => a.estado === 'validada').length,
    };
  }, [avals]);

  const avalsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return avals.filter((a) => {
      if (fEstado && a.estado !== fEstado) return false;
      if (fCat && a.categoria !== fCat) return false;
      if (fMomento && a.momento !== fMomento) return false;
      if (!q) return true;
      return (
        (a.colaborador_nome ?? '').toLowerCase().includes(q) ||
        (a.mentor_nome ?? '').toLowerCase().includes(q)
      );
    });
  }, [avals, busca, fEstado, fCat, fMomento]);

  async function handleValidar(av: MentorAvaliacao) {
    try {
      const actualizada = await mentorAvaliacoesService.update(av.id, { validar: true });
      setAvals((prev) => prev.map((x) => (x.id === av.id ? actualizada : x)));
      if (detalhe?.id === av.id) setDetalhe(actualizada);
      toast.success('Avaliação validada');
    } catch {
      toast.error('Não foi possível validar');
    }
  }

  async function handleGravarObs(av: MentorAvaliacao, obs: string) {
    try {
      const actualizada = await mentorAvaliacoesService.update(av.id, { observacoes_dpc: obs });
      setAvals((prev) => prev.map((x) => (x.id === av.id ? actualizada : x)));
      if (detalhe?.id === av.id) setDetalhe(actualizada);
      toast.success('Observações DPC guardadas');
    } catch {
      toast.error('Erro ao guardar observações');
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
          <h1 className="text-2xl font-bold text-navy-800">Centro de Avaliações</h1>
          <p className="mt-1 text-sm text-navy-500">
            Todas as avaliações de mentor · validação pela DPC · exportação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportarCentroAvaliacoesExcel(avalsFiltradas)}
            disabled={avalsFiltradas.length === 0}
          >
            Exportar Excel
          </Button>
        </div>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile label="Total" value={kpis.total} tone="neutral" />
        <KpiTile label="Rascunho" value={kpis.rascunho} tone="warning" />
        <KpiTile label="Submetidas" value={kpis.submetidas} tone="info" />
        <KpiTile label="Validadas" value={kpis.validadas} tone="success" />
      </motion.div>

      <motion.div variants={staggerItem} className="border-b border-navy-100">
        <nav className="flex gap-6 -mb-px">
          <TabBtn
            active={tab === 'mentor'}
            onClick={() => setTab('mentor')}
            label={`Avaliações do Mentor (${avals.length})`}
            icon={<ClipboardEdit className="h-4 w-4" />}
          />
          <TabBtn
            active={tab === 'colaborador'}
            onClick={() => setTab('colaborador')}
            label={`Feedback do Colaborador (${feedbacks.length})`}
            icon={<MessageSquareText className="h-4 w-4" />}
          />
        </nav>
      </motion.div>

      {tab === 'mentor' && (
        <>
          <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3">
            <Filter className="h-4 w-4 text-navy-400" />
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Procurar colaborador ou mentor..."
                className="pl-9"
              />
            </div>
            <Select
              options={MOMENTO_OPTIONS}
              value={fMomento}
              onChange={setFMomento}
              placeholder="Todos os momentos"
              className="sm:w-40"
            />
            <Select
              options={CATEGORIA_OPTIONS}
              value={fCat}
              onChange={setFCat}
              placeholder="Todas categorias"
              className="sm:w-48"
            />
            <Select
              options={ESTADO_OPTIONS}
              value={fEstado}
              onChange={setFEstado}
              placeholder="Todos os estados"
              className="sm:w-40"
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            {loading ? (
              <SkeletonList rows={6} cols={4} />
            ) : avalsFiltradas.length === 0 ? (
              <EmptyState
                icon={<ClipboardEdit className="h-8 w-8" />}
                title="Sem avaliações"
                description="Assim que os mentores começarem a submeter, verás tudo aqui."
              />
            ) : (
              <div className="space-y-2">
                {avalsFiltradas.map((av) => {
                  const info = estadoInfo(av.estado);
                  const Icon = info.icon;
                  return (
                    <button
                      key={av.id}
                      onClick={() => setDetalhe(av)}
                      className="group flex w-full items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 text-left transition hover:shadow-card hover:border-navy-200"
                    >
                      <Avatar name={av.colaborador_nome ?? '—'} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-navy-800">
                          {av.colaborador_nome ?? 'Sem colaborador'}
                        </p>
                        <p className="truncate text-xs text-navy-500">
                          Mentor: {av.mentor_nome ?? '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="accent" size="sm">
                            {av.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos'}
                          </Badge>
                          <Badge variant="neutral" size="sm">{momentoLabel(av.momento)}</Badge>
                          {av.preenchido_em && (
                            <span className="text-[11px] text-navy-400">
                              Submetida{' '}
                              {new Date(av.preenchido_em).toLocaleDateString('pt-AO')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={info.variant} size="md">
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}

      {tab === 'colaborador' && (
        <motion.div variants={staggerItem}>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Feedback do colaborador"
            description="Por privacidade não há listagem global. Abre Onboarding → Colaboradores, escolhe um colaborador, e na sua ficha verás a secção «Feedback do Colaborador» com todos os momentos submetidos (com detalhe e exportação PDF)."
            action={{ label: 'Ir para Colaboradores', onClick: () => (window.location.href = '/onboarding') }}
          />
        </motion.div>
      )}

      {detalhe && (
        <DetalheAvaliacaoModal
          avaliacao={detalhe}
          onClose={() => setDetalhe(null)}
          onValidar={handleValidar}
          onGravarObs={handleGravarObs}
        />
      )}
    </motion.div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: number; tone: 'success' | 'info' | 'warning' | 'neutral' }) {
  const cls = {
    success: 'bg-success-50 text-success-700',
    info: 'bg-info-50 text-info-700',
    warning: 'bg-warning-50 text-warning-700',
    neutral: 'bg-navy-50 text-navy-700',
  }[tone];
  return (
    <div className={`rounded-xl ${cls} px-4 py-3`}>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
        active ? 'border-navy-700 text-navy-800' : 'border-transparent text-navy-400 hover:text-navy-700',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DetalheAvaliacaoModal({
  avaliacao,
  onClose,
  onValidar,
  onGravarObs,
}: {
  avaliacao: MentorAvaliacao;
  onClose: () => void;
  onValidar: (av: MentorAvaliacao) => void;
  onGravarObs: (av: MentorAvaliacao, obs: string) => void;
}) {
  const [obs, setObs] = useState(avaliacao.observacoes_dpc ?? '');
  const criterios = criteriosAvalMentor(avaliacao.categoria as CategoriaTrilho);
  const info = estadoInfo(avaliacao.estado);
  const Icon = info.icon;
  const media = useMemo(() => {
    const nums = criterios
      .map((c) => avaliacao.criterios?.[c.key])
      .filter((v) => typeof v === 'number') as number[];
    if (!nums.length) return null;
    return (nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2);
  }, [avaliacao, criterios]);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Avatar name={avaliacao.colaborador_nome ?? '—'} size="sm" />
            <div>
              <p className="text-lg font-semibold text-navy-800">
                {avaliacao.colaborador_nome ?? '—'}
              </p>
              <p className="text-xs text-navy-500">
                Mentor: {avaliacao.mentor_nome ?? '—'} · {momentoLabel(avaliacao.momento)}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={info.variant} size="md">
          <Icon className="h-3 w-3" />
          {info.label}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-xl font-bold text-navy-800 tabular-nums">{media ?? '—'}</p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Média critérios</p>
        </div>
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-xl font-bold text-navy-800">
            {avaliacao.categoria === 'gestao' ? 'Dir/Gestão' : 'Téc/Coord'}
          </p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Categoria</p>
        </div>
        <div className="rounded-lg bg-navy-50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-navy-800">
            {CLASSIFICACOES_GLOBAIS_MENTOR.find((c) => c.value === avaliacao.classificacao_global)?.label ?? '—'}
          </p>
          <p className="text-[10px] font-medium uppercase text-navy-400">Global</p>
        </div>
      </div>

      <div className="max-h-[42vh] overflow-y-auto pr-1 space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy-500">
            Critérios ({criterios.length})
          </p>
          <div className="rounded-lg border border-navy-100 divide-y divide-navy-100">
            {criterios.map((c) => {
              const val = avaliacao.criterios?.[c.key];
              const comentario = avaliacao.comentarios_criterios?.[c.key];
              return (
                <div key={c.key} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-navy-700">{c.label}</p>
                    <Badge variant={val === undefined ? 'neutral' : 'accent'} size="sm">
                      {val ?? '—'}
                    </Badge>
                  </div>
                  {comentario && (
                    <p className="mt-1 text-xs italic text-navy-500">« {comentario} »</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {avaliacao.pontos_fortes && (
          <Card>
            <CardTitle className="mb-1 text-sm">Pontos fortes</CardTitle>
            <p className="text-sm text-navy-700 whitespace-pre-wrap">{avaliacao.pontos_fortes}</p>
          </Card>
        )}
        {avaliacao.oportunidades_melhoria && (
          <Card>
            <CardTitle className="mb-1 text-sm">Oportunidades de melhoria</CardTitle>
            <p className="text-sm text-navy-700 whitespace-pre-wrap">
              {avaliacao.oportunidades_melhoria}
            </p>
          </Card>
        )}
        {avaliacao.situacoes_contributo && (
          <Card>
            <CardTitle className="mb-1 text-sm">Situações de contributo</CardTitle>
            <p className="text-sm text-navy-700 whitespace-pre-wrap">
              {avaliacao.situacoes_contributo}
            </p>
          </Card>
        )}

        {avaliacao.plano_accao && avaliacao.plano_accao.length > 0 && (
          <Card>
            <CardTitle className="mb-2 text-sm">Plano de acção</CardTitle>
            <ul className="space-y-1.5 text-sm">
              {avaliacao.plano_accao.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-navy-400 tabular-nums">{i + 1}.</span>
                  <span className="flex-1">
                    <strong className="text-navy-800">{p.acao || '—'}</strong>
                    {p.responsavel && <span className="text-navy-500"> · {p.responsavel}</span>}
                    {p.prazo && <span className="text-navy-500"> · {new Date(p.prazo).toLocaleDateString('pt-AO')}</span>}
                    <Badge
                      variant={p.estado === 'concluido' ? 'success' : p.estado === 'em_curso' ? 'info' : 'neutral'}
                      size="sm"
                      className="ml-2"
                    >
                      {p.estado}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <FormField
          label="Observações DPC"
          hint="Notas internas da DPC sobre esta avaliação. Guardadas ao clicar em «Gravar observações»."
        >
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            autoResize
            placeholder="Notas para follow-up interno da DPC..."
          />
        </FormField>

        <div className="rounded-xl border border-navy-100 bg-navy-25 p-3 text-xs text-navy-500 flex flex-wrap gap-3">
          <span>
            <strong>Manter mentor:</strong> {avaliacao.manter_mentor ?? '—'}
          </span>
          <span>
            <strong>Necessita orientação:</strong>{' '}
            {avaliacao.necessita_orientacao ? 'Sim' : 'Não'}
          </span>
          <span>
            <strong>Necessita clarificação:</strong>{' '}
            {avaliacao.necessita_clarificacao ? 'Sim' : 'Não'}
          </span>
        </div>

        <p className="text-[11px] text-navy-400">
          Escala usada: {ESCALA_AVALIACAO_MENTOR.map((e) => `${e.label}=${e.descricao}`).join(' · ')}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-navy-100 pt-4">
        <Button
          variant="ghost"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={() => exportarAvaliacaoMentorPDF(avaliacao)}
        >
          Exportar PDF
        </Button>
        <Button
          variant="secondary"
          onClick={() => onGravarObs(avaliacao, obs)}
        >
          Gravar observações
        </Button>
        {avaliacao.estado === 'submetida' && (
          <Button
            variant="primary"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            onClick={() => onValidar(avaliacao)}
          >
            Validar avaliação
          </Button>
        )}
      </div>
    </Dialog>
  );
}
