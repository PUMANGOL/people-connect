import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, CheckCircle2, Plus, X, ClipboardEdit,
  Trash2, AlertTriangle, Info, Download,
} from 'lucide-react';
import { exportarAvaliacaoMentorPDF } from '@/src/lib/pdf-mentoria';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { Card, CardHeader, CardTitle, EmptyState } from '@/src/components/ui/card';
import { FormField, Input, Textarea, Select } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { ConfirmDialog } from '@/src/components/ui/dialog';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import {
  mentorAvaliacoesService, mentorPortalService,
  type MentoradoRow,
} from '@/src/services/mentoria.service';
import type {
  MentorAvaliacao, CategoriaTrilho, MomentoAvaliacao,
  ClassificacaoGlobal, PlanoAccaoItem,
} from '@/lib/types';
import {
  criteriosAvalMentor, MOMENTOS_AVALIACAO, ESCALA_AVALIACAO_MENTOR,
  CLASSIFICACOES_GLOBAIS_MENTOR,
} from '@/lib/avaliacao-schemas';
import { Checkbox } from '@/components/ui/checkbox';

const CATEGORIA_OPTIONS: { value: CategoriaTrilho; label: string }[] = [
  { value: 'gestao', label: 'Direção / Gestão' },
  { value: 'tecnicos', label: 'Coordenadores / Técnicos' },
];

const MOMENTO_OPTIONS = MOMENTOS_AVALIACAO.map((m) => ({ value: m.value, label: m.label }));

const MANTER_MENTOR_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'a_avaliar', label: 'A avaliar' },
];

type FormState = {
  colaborador_id: string;
  categoria: CategoriaTrilho;
  momento: MomentoAvaliacao;
  periodo_inicio: string;
  periodo_fim: string;
  criterios: Record<string, number | 'N/A'>;
  comentarios_criterios: Record<string, string>;
  pontos_fortes: string;
  oportunidades_melhoria: string;
  situacoes_contributo: string;
  classificacao_global: ClassificacaoGlobal | '';
  manter_mentor: 'sim' | 'nao' | 'a_avaliar' | '';
  necessita_orientacao: boolean;
  necessita_clarificacao: boolean;
  plano_accao: PlanoAccaoItem[];
};

function emptyForm(pre: Partial<FormState> = {}): FormState {
  return {
    colaborador_id: '',
    categoria: 'gestao',
    momento: 'dia_30',
    periodo_inicio: '',
    periodo_fim: '',
    criterios: {},
    comentarios_criterios: {},
    pontos_fortes: '',
    oportunidades_melhoria: '',
    situacoes_contributo: '',
    classificacao_global: '',
    manter_mentor: '',
    necessita_orientacao: false,
    necessita_clarificacao: false,
    plano_accao: [],
    ...pre,
  };
}

function fromServer(av: MentorAvaliacao): FormState {
  return {
    colaborador_id: av.colaborador_id,
    categoria: av.categoria,
    momento: av.momento,
    periodo_inicio: av.periodo_inicio ? av.periodo_inicio.slice(0, 10) : '',
    periodo_fim: av.periodo_fim ? av.periodo_fim.slice(0, 10) : '',
    criterios: av.criterios ?? {},
    comentarios_criterios: av.comentarios_criterios ?? {},
    pontos_fortes: av.pontos_fortes ?? '',
    oportunidades_melhoria: av.oportunidades_melhoria ?? '',
    situacoes_contributo: av.situacoes_contributo ?? '',
    classificacao_global: (av.classificacao_global ?? '') as ClassificacaoGlobal | '',
    manter_mentor: (av.manter_mentor ?? '') as FormState['manter_mentor'],
    necessita_orientacao: av.necessita_orientacao ?? false,
    necessita_clarificacao: av.necessita_clarificacao ?? false,
    plano_accao: Array.isArray(av.plano_accao) ? av.plano_accao : [],
  };
}

function toPayload(f: FormState) {
  return {
    criterios: f.criterios,
    comentarios_criterios: f.comentarios_criterios,
    pontos_fortes: f.pontos_fortes || null,
    oportunidades_melhoria: f.oportunidades_melhoria || null,
    situacoes_contributo: f.situacoes_contributo || null,
    classificacao_global: f.classificacao_global || null,
    manter_mentor: f.manter_mentor || null,
    necessita_orientacao: f.necessita_orientacao,
    necessita_clarificacao: f.necessita_clarificacao,
    plano_accao: f.plano_accao,
  };
}

export default function AvaliacaoMentor() {
  const { avaliacaoId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const preColaborador = search.get('colaborador') ?? '';

  const [avaliacao, setAvaliacao] = useState<MentorAvaliacao | null>(null);
  const [mentorados, setMentorados] = useState<MentoradoRow[]>([]);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm({ colaborador_id: preColaborador }),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitDialog, setSubmitDialog] = useState(false);

  const isEdit = !!avaliacaoId;
  const isReadOnly = avaliacao?.estado === 'validada';

  const criterios = useMemo(() => criteriosAvalMentor(form.categoria), [form.categoria]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [minhos, av] = await Promise.all([
        mentorPortalService.mentorados().catch(() => [] as MentoradoRow[]),
        isEdit ? mentorAvaliacoesService.get(avaliacaoId!) : Promise.resolve(null),
      ]);
      setMentorados(minhos);
      if (av) {
        setAvaliacao(av);
        setForm(fromServer(av));
      } else if (preColaborador) {
        const m = minhos.find((x) => x.id === preColaborador);
        if (m) {
          setForm((prev) => ({
            ...prev,
            colaborador_id: m.id,
            categoria: (m.categoria as CategoriaTrilho) || prev.categoria,
          }));
        }
      }
    } catch {
      toast.error('Não foi possível carregar a avaliação');
    } finally {
      setLoading(false);
    }
  }, [avaliacaoId, isEdit, preColaborador]);

  useEffect(() => { carregar(); }, [carregar]);

  const criteriosPreenchidos = useMemo(() => {
    return criterios.filter((c) => form.criterios[c.key] !== undefined).length;
  }, [criterios, form.criterios]);

  const podeSubmeter = criteriosPreenchidos === criterios.length;

  function setCriterio(key: string, value: number | 'N/A') {
    setForm((prev) => ({ ...prev, criterios: { ...prev.criterios, [key]: value } }));
  }

  function setComentarioCriterio(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      comentarios_criterios: { ...prev.comentarios_criterios, [key]: value },
    }));
  }

  function addPlano() {
    setForm((prev) => ({
      ...prev,
      plano_accao: [
        ...prev.plano_accao,
        { acao: '', responsavel: '', prazo: null, estado: 'pendente' },
      ],
    }));
  }

  function updatePlano(idx: number, patch: Partial<PlanoAccaoItem>) {
    setForm((prev) => ({
      ...prev,
      plano_accao: prev.plano_accao.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }

  function removePlano(idx: number) {
    setForm((prev) => ({
      ...prev,
      plano_accao: prev.plano_accao.filter((_, i) => i !== idx),
    }));
  }

  async function ensureAvaliacao(): Promise<MentorAvaliacao | null> {
    if (avaliacao) return avaliacao;
    if (!form.colaborador_id) {
      toast.error('Selecciona o colaborador antes de guardar');
      return null;
    }
    try {
      const criada = await mentorAvaliacoesService.create({
        colaborador_id: form.colaborador_id,
        categoria: form.categoria,
        momento: form.momento,
        periodo_inicio: form.periodo_inicio || undefined,
        periodo_fim: form.periodo_fim || undefined,
      });
      setAvaliacao(criada);
      navigate(`/mentor/avaliacoes/${criada.id}`, { replace: true });
      return criada;
    } catch {
      toast.error('Não foi possível criar a avaliação');
      return null;
    }
  }

  async function handleSaveDraft() {
    const av = await ensureAvaliacao();
    if (!av) return;
    setSaving(true);
    try {
      const actualizada = await mentorAvaliacoesService.update(av.id, toPayload(form));
      setAvaliacao(actualizada);
      toast.success('Rascunho guardado');
    } catch {
      toast.error('Não foi possível guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitDialog(false);
    const av = await ensureAvaliacao();
    if (!av) return;
    setSaving(true);
    try {
      const actualizada = await mentorAvaliacoesService.update(av.id, {
        ...toPayload(form),
        submeter: true,
      });
      setAvaliacao(actualizada);
      toast.success('Avaliação submetida à DPC');
      navigate('/mentor/avaliacoes');
    } catch {
      toast.error('Não foi possível submeter');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded bg-navy-100 animate-pulse" />
        <div className="h-40 rounded-2xl bg-navy-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-navy-100 animate-pulse" />
      </div>
    );
  }

  const colabInfo = mentorados.find((m) => m.id === form.colaborador_id);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-24"
    >
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button
          onClick={() => navigate('/mentor/avaliacoes')}
          className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar às avaliações
        </button>
        {avaliacao && (
          <Badge
            variant={
              avaliacao.estado === 'validada'
                ? 'success'
                : avaliacao.estado === 'submetida'
                ? 'info'
                : 'warning'
            }
            size="sm"
          >
            {avaliacao.estado === 'validada'
              ? 'Validada'
              : avaliacao.estado === 'submetida'
              ? 'Submetida'
              : 'Rascunho'}
          </Badge>
        )}
      </motion.div>

      {/* Cabeçalho */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardEdit className="h-5 w-5 text-navy-500" />
              {isEdit ? 'Avaliação do Mentor' : 'Nova Avaliação do Mentor'}
            </CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Colaborador" required>
              {isEdit && avaliacao ? (
                <div className="flex items-center gap-3 rounded-lg border border-navy-100 bg-navy-25 px-3 py-2">
                  <Avatar name={avaliacao.colaborador_nome ?? '—'} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-navy-800">
                      {avaliacao.colaborador_nome ?? 'Sem nome'}
                    </p>
                    {colabInfo && (
                      <p className="text-xs text-navy-500">
                        {colabInfo.funcao} · {colabInfo.direccao}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Select
                  options={mentorados.map((m) => ({
                    value: m.id,
                    label: `${m.nome} — ${m.funcao}`,
                  }))}
                  placeholder="Selecciona um mentorado"
                  value={form.colaborador_id}
                  onChange={(v) => {
                    const m = mentorados.find((x) => x.id === v);
                    setForm((prev) => ({
                      ...prev,
                      colaborador_id: v,
                      categoria: (m?.categoria as CategoriaTrilho) || prev.categoria,
                    }));
                  }}
                />
              )}
            </FormField>

            <FormField label="Categoria" required>
              <Select
                options={CATEGORIA_OPTIONS}
                value={form.categoria}
                onChange={(v) => setForm((p) => ({ ...p, categoria: v as CategoriaTrilho }))}
                disabled={isReadOnly || isEdit}
              />
            </FormField>

            <FormField label="Momento" required>
              <Select
                options={MOMENTO_OPTIONS}
                value={form.momento}
                onChange={(v) => setForm((p) => ({ ...p, momento: v as MomentoAvaliacao }))}
                disabled={isReadOnly || isEdit}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Período de acompanhamento — início">
                <DateInput
                  value={form.periodo_inicio}
                  onChange={(v) => setForm((p) => ({ ...p, periodo_inicio: v }))}
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="Fim">
                <DateInput
                  value={form.periodo_fim}
                  onChange={(v) => setForm((p) => ({ ...p, periodo_fim: v }))}
                  disabled={isReadOnly}
                />
              </FormField>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Critérios */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Avaliação do Mentor — 10 critérios</CardTitle>
            <span className="text-xs text-navy-500 tabular-nums">
              {criteriosPreenchidos} / {criterios.length} preenchidos
            </span>
          </CardHeader>

          <div className="mb-4 rounded-lg border border-navy-100 bg-navy-25 px-3 py-2 text-xs text-navy-600 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-navy-700 mb-0.5">Escala de avaliação</p>
              <p>
                <strong>5</strong> Excelente · <strong>4</strong> Bom · <strong>3</strong> Regular ·{' '}
                <strong>2</strong> A melhorar · <strong>1</strong> Insatisfatório · <strong>N/A</strong> Não aplicável
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {criterios.map((c, idx) => {
              const escolhido = form.criterios[c.key];
              return (
                <div key={c.key} className="rounded-xl border border-navy-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-navy-800">
                      <span className="text-navy-400 mr-2 tabular-nums">{idx + 1}.</span>
                      {c.label}
                    </p>
                    {escolhido !== undefined && (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="h-3 w-3" />
                        {escolhido}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {ESCALA_AVALIACAO_MENTOR.map((opt) => {
                      const active = escolhido === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => setCriterio(c.key, opt.value)}
                          title={opt.descricao}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                            active
                              ? 'border-navy-700 bg-navy-700 text-white shadow-sm'
                              : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-25',
                            isReadOnly && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <Textarea
                    value={form.comentarios_criterios[c.key] ?? ''}
                    onChange={(e) => setComentarioCriterio(c.key, e.target.value)}
                    placeholder="Comentários (opcional)"
                    disabled={isReadOnly}
                    className="mt-3 min-h-[60px] text-sm"
                    autoResize
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Reflexão qualitativa */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Comentários abertos</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <FormField label="Pontos fortes observados">
              <Textarea
                value={form.pontos_fortes}
                onChange={(e) => setForm((p) => ({ ...p, pontos_fortes: e.target.value }))}
                disabled={isReadOnly}
                autoResize
                placeholder="O que correu bem no acompanhamento?"
              />
            </FormField>
            <FormField label="Oportunidades de melhoria">
              <Textarea
                value={form.oportunidades_melhoria}
                onChange={(e) => setForm((p) => ({ ...p, oportunidades_melhoria: e.target.value }))}
                disabled={isReadOnly}
                autoResize
                placeholder="Aspectos a ajustar no acompanhamento futuro."
              />
            </FormField>
            <FormField label="Situações concretas de contributo">
              <Textarea
                value={form.situacoes_contributo}
                onChange={(e) => setForm((p) => ({ ...p, situacoes_contributo: e.target.value }))}
                disabled={isReadOnly}
                autoResize
                placeholder="Exemplos específicos em que o mentor teve impacto."
              />
            </FormField>
          </div>
        </Card>
      </motion.div>

      {/* Classificação global + acompanhamento */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Classificação global e acompanhamento</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Classificação global">
              <Select
                options={CLASSIFICACOES_GLOBAIS_MENTOR}
                placeholder="Selecciona..."
                value={form.classificacao_global}
                onChange={(v) =>
                  setForm((p) => ({ ...p, classificacao_global: v as ClassificacaoGlobal }))
                }
                disabled={isReadOnly}
              />
            </FormField>
            <FormField label="Manter o mentor no próximo período?">
              <Select
                options={MANTER_MENTOR_OPTIONS}
                placeholder="Selecciona..."
                value={form.manter_mentor}
                onChange={(v) =>
                  setForm((p) => ({ ...p, manter_mentor: v as FormState['manter_mentor'] }))
                }
                disabled={isReadOnly}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <Checkbox
                checked={form.necessita_orientacao}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, necessita_orientacao: checked }))}
                disabled={isReadOnly}
              />
              O colaborador necessita de orientação adicional
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <Checkbox
                checked={form.necessita_clarificacao}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, necessita_clarificacao: checked }))
                }
                disabled={isReadOnly}
              />
              Necessita de clarificação da função/expectativas
            </label>
          </div>
        </Card>
      </motion.div>

      {/* Plano de acção */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle>Plano de acção</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={addPlano}
              disabled={isReadOnly}
            >
              Adicionar acção
            </Button>
          </CardHeader>

          {form.plano_accao.length === 0 ? (
            <EmptyState
              icon={<ClipboardEdit className="h-6 w-6" />}
              title="Sem acções"
              description="Adiciona acções concretas para acompanhamento futuro (opcional)."
            />
          ) : (
            <div className="space-y-3">
              {form.plano_accao.map((p, idx) => (
                <div key={idx} className="rounded-xl border border-navy-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                      Acção {idx + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removePlano(idx)}
                      disabled={isReadOnly}
                      className="text-navy-400 hover:text-error-500 transition-colors disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Acção" className="sm:col-span-2">
                      <Input
                        value={p.acao}
                        onChange={(e) => updatePlano(idx, { acao: e.target.value })}
                        disabled={isReadOnly}
                        placeholder="O quê?"
                      />
                    </FormField>
                    <FormField label="Responsável">
                      <Input
                        value={p.responsavel}
                        onChange={(e) => updatePlano(idx, { responsavel: e.target.value })}
                        disabled={isReadOnly}
                        placeholder="Quem?"
                      />
                    </FormField>
                    <FormField label="Prazo">
                      <DateInput
                        value={p.prazo ?? ''}
                        onChange={(v) => updatePlano(idx, { prazo: v || null })}
                        disabled={isReadOnly}
                      />
                    </FormField>
                    <FormField label="Estado" className="sm:col-span-2">
                      <Select
                        options={[
                          { value: 'pendente', label: 'Pendente' },
                          { value: 'em_curso', label: 'Em curso' },
                          { value: 'concluido', label: 'Concluído' },
                        ]}
                        value={p.estado}
                        onChange={(v) =>
                          updatePlano(idx, { estado: v as PlanoAccaoItem['estado'] })
                        }
                        disabled={isReadOnly}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Barra inferior */}
      <motion.div
        variants={staggerItem}
        className="fixed inset-x-0 bottom-0 border-t border-navy-100 bg-white/95 backdrop-blur px-4 py-3 shadow-lg z-30"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-navy-500">
            {!podeSubmeter && !isReadOnly && (
              <span className="inline-flex items-center gap-1 text-warning-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Faltam {criterios.length - criteriosPreenchidos} critérios para poder submeter.
              </span>
            )}
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 text-success-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Esta avaliação já foi validada pela DPC.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/mentor/avaliacoes')}
              leftIcon={<X className="h-4 w-4" />}
            >
              Cancelar
            </Button>
            {avaliacao && (avaliacao.estado === 'submetida' || avaliacao.estado === 'validada') && (
              <Button
                variant="ghost"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => exportarAvaliacaoMentorPDF(avaliacao)}
              >
                Exportar PDF
              </Button>
            )}
            {!isReadOnly && (
              <>
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={handleSaveDraft}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Guardar rascunho
                </Button>
                <Button
                  variant="primary"
                  disabled={!podeSubmeter || saving}
                  onClick={() => setSubmitDialog(true)}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Submeter à DPC
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        open={submitDialog}
        onClose={() => setSubmitDialog(false)}
        onConfirm={handleSubmit}
        title="Submeter avaliação?"
        description="Depois de submeter, a avaliação fica visível para a DPC para validação. Continuas a poder editar enquanto não for validada."
        confirmLabel="Sim, submeter"
        loading={saving}
      />
    </motion.div>
  );
}
