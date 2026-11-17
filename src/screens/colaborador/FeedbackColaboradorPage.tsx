import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardEdit, Save, Send, CheckCircle2, AlertTriangle, Info, Lock,
  FileEdit, Clock, Sparkles, Download,
} from 'lucide-react';
import { exportarFeedbackColaboradorPDF } from '@/src/lib/pdf-mentoria';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/card';
import { FormField, Textarea, Select } from '@/src/components/ui/input';
import { ConfirmDialog } from '@/src/components/ui/dialog';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { cn } from '@/lib/utils';
import { colaboradorFeedbackService } from '@/src/services/mentoria.service';
import { colaboradoresService } from '@/src/services/onboarding-v2.service';
import type {
  ColaboradorFeedback, CategoriaTrilho, MomentoAvaliacao, ClassificacaoGlobal,
} from '@/lib/types';
import {
  MOMENTOS_AVALIACAO, CLASSIFICACOES_GLOBAIS_FEEDBACK, ESCALA_QUALITATIVA_FEEDBACK,
  ESCALA_SIM_PARCIAL_NAO,
  FEEDBACK_COORD_GERAL, FEEDBACK_COORD_CULTURA, FEEDBACK_COORD_INTEGRACAO_FUNCIONAL,
  FEEDBACK_COORD_DUVIDAS, FEEDBACK_COORD_MENTOR_GESTOR,
  FEEDBACK_DIR_GERAL, FEEDBACK_DIR_CULTURA_GOV, FEEDBACK_DIR_CE, FEEDBACK_DIR_SUPORTE,
} from '@/lib/avaliacao-schemas';
import { Checkbox } from '@/components/ui/checkbox';

type BlocoQual = readonly { key: string; label: string }[];

function momentoLabel(m: string): string {
  return MOMENTOS_AVALIACAO.find((x) => x.value === m)?.label ?? m;
}

function estadoInfo(estado: string) {
  switch (estado) {
    case 'submetida':
      return { label: 'Submetido', variant: 'info' as const, icon: Clock };
    case 'validada':
      return { label: 'Validado pela DPC', variant: 'success' as const, icon: CheckCircle2 };
    default:
      return { label: 'Rascunho', variant: 'warning' as const, icon: FileEdit };
  }
}

export default function FeedbackColaboradorPage() {
  const [feedbacks, setFeedbacks] = useState<ColaboradorFeedback[]>([]);
  const [current, setCurrent] = useState<ColaboradorFeedback | null>(null);
  const [categoria, setCategoria] = useState<CategoriaTrilho>('tecnicos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [pendente, setPendente] = useState<Partial<ColaboradorFeedback> | null>(null);

  // Detecta a categoria do colaborador uma vez
  useEffect(() => {
    colaboradoresService
      .meuTrilho()
      .then((data) => {
        const cat = (data.colaborador as { categoria?: string } | null)?.categoria;
        if (cat === 'gestao' || cat === 'tecnicos') setCategoria(cat);
      })
      .catch(() => {
        /* silencioso */
      });
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const list = await colaboradorFeedbackService.meus();
      setFeedbacks(list);
      const desbloqueado = list.find((f) => f.desbloqueado && f.estado !== 'validada');
      setCurrent(desbloqueado ?? list[0] ?? null);
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const readOnly = current?.estado === 'submetida' || current?.estado === 'validada';

  async function iniciarFeedback(momento: MomentoAvaliacao) {
    try {
      const criado = await colaboradorFeedbackService.create({ momento, categoria });
      toast.success('Feedback iniciado');
      await carregar();
      setCurrent(criado);
    } catch {
      toast.error('Não foi possível iniciar');
    }
  }

  async function guardar(payload: Partial<ColaboradorFeedback>, submeter = false) {
    if (!current) return;
    setSaving(true);
    try {
      const actualizada = await colaboradorFeedbackService.update(current.id, {
        ...payload,
        submeter,
      });
      setCurrent(actualizada);
      setFeedbacks((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)));
      toast.success(submeter ? 'Feedback submetido à DPC' : 'Rascunho guardado');
      setShowSubmit(false);
    } catch {
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-24 rounded-2xl bg-navy-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-navy-100 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-4xl space-y-6 pb-24"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Feedback / Auto-avaliação</h1>
        <p className="mt-1 text-sm text-navy-500">
          Formulário oficial Pumangol · a tua percepção sobre o processo de indução e integração.
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">
          Escolhe o momento
        </p>
        <SeletorMomento
          feedbacks={feedbacks}
          currentId={current?.id ?? null}
          onSelect={setCurrent}
          onIniciar={iniciarFeedback}
        />
        {feedbacks.length === 0 && (
          <p className="text-xs text-navy-400">
            Ainda não iniciaste nenhum feedback. Clica num dos momentos acima para começar
            (Dia 15, Dia 30, Dia 60, Dia 90 ou Final). Podes guardar rascunho e continuar
            noutro dia.
          </p>
        )}
      </motion.div>

      {current && (
        <FormularioFeedback
          feedback={current}
          categoria={current.categoria}
          readOnly={readOnly}
          saving={saving}
          onGuardar={(p) => guardar(p, false)}
          onSubmeter={(payload) => {
            setPendente(payload);
            setShowSubmit(true);
          }}
        />
      )}

      <ConfirmDialog
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        onConfirm={() => pendente && guardar(pendente, true)}
        title="Submeter feedback?"
        description="Depois de submeter, o feedback fica visível para a DPC e para o teu mentor. Deixarás de o poder editar."
        confirmLabel="Sim, submeter"
        loading={saving}
      />
    </motion.div>
  );
}

// -----------------------------------------------------------
// Selector de momento
// -----------------------------------------------------------
function SeletorMomento({
  feedbacks,
  currentId,
  onSelect,
  onIniciar,
}: {
  feedbacks: ColaboradorFeedback[];
  currentId: string | null;
  onSelect: (f: ColaboradorFeedback) => void;
  onIniciar: (m: MomentoAvaliacao) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOMENTOS_AVALIACAO.map((m) => {
        const existing = feedbacks.find((f) => f.momento === m.value);
        if (!existing) {
          return (
            <button
              key={m.value}
              onClick={() => onIniciar(m.value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-navy-200 bg-white px-3 py-2 text-xs font-medium text-navy-500 transition-colors hover:border-navy-400 hover:text-navy-700"
            >
              <Lock className="h-3 w-3" />
              {m.label}
            </button>
          );
        }
        const info = estadoInfo(existing.estado);
        const Icon = info.icon;
        const active = existing.id === currentId;
        return (
          <button
            key={m.value}
            onClick={() => onSelect(existing)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
              active
                ? 'border-navy-700 bg-navy-700 text-white'
                : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400',
            )}
          >
            <Icon className="h-3 w-3" />
            {m.label}
            {existing.estado === 'submetida' && <Badge variant="info" size="sm" className="ml-1">✓</Badge>}
            {existing.estado === 'validada' && <Sparkles className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------
// Formulário
// -----------------------------------------------------------
type QualState = Record<string, { valor: string; comentario?: string }>;
type DuvState = Record<string, { necessita: boolean; obs?: string }>;

function FormularioFeedback({
  feedback,
  categoria,
  readOnly,
  saving,
  onGuardar,
  onSubmeter,
}: {
  feedback: ColaboradorFeedback;
  categoria: CategoriaTrilho;
  readOnly: boolean;
  saving: boolean;
  onGuardar: (payload: Partial<ColaboradorFeedback>) => void;
  onSubmeter: (payload: Partial<ColaboradorFeedback>) => void;
}) {
  const isGestao = categoria === 'gestao';
  const blocoGeral = isGestao ? FEEDBACK_DIR_GERAL : FEEDBACK_COORD_GERAL;
  const blocoCultura = isGestao ? FEEDBACK_DIR_CULTURA_GOV : FEEDBACK_COORD_CULTURA;
  const blocoMentor = isGestao ? FEEDBACK_DIR_CE : FEEDBACK_COORD_MENTOR_GESTOR;
  const blocoIntegracao = isGestao ? null : FEEDBACK_COORD_INTEGRACAO_FUNCIONAL;
  const blocoDuvidas = isGestao ? FEEDBACK_DIR_SUPORTE : FEEDBACK_COORD_DUVIDAS;

  const [geral, setGeral] = useState<QualState>((feedback.avaliacao_geral as QualState) ?? {});
  const [cultura, setCultura] = useState<QualState>(
    (feedback.blocos_aprendizagem?.cultura as QualState) ?? {},
  );
  const [integracao, setIntegracao] = useState<QualState>(
    (feedback.blocos_aprendizagem?.integracao_funcional as QualState) ?? {},
  );
  const [mentorFeedback, setMentorFeedback] = useState<QualState>(
    (feedback.feedback_mentor_gestor as QualState) ?? {},
  );
  const [duvidas, setDuvidas] = useState<DuvState>((feedback.duvidas_reforco as DuvState) ?? {});
  const [aprendizagens, setAprendizagens] = useState(feedback.principais_aprendizagens ?? '');
  const [comentarios, setComentarios] = useState(feedback.comentarios_finais ?? '');
  const [classificacao, setClassificacao] = useState<ClassificacaoGlobal | ''>(
    (feedback.classificacao_global ?? '') as ClassificacaoGlobal | '',
  );

  const totalObrig = blocoGeral.length + blocoCultura.length + blocoMentor.length + (blocoIntegracao?.length ?? 0);
  const preenchidos =
    Object.values(geral).filter((v) => v.valor).length +
    Object.values(cultura).filter((v) => v.valor).length +
    Object.values(mentorFeedback).filter((v) => v.valor).length +
    (blocoIntegracao ? Object.values(integracao).filter((v) => v.valor).length : 0);

  const podeSubmeter = preenchidos === totalObrig;

  function payload(): Partial<ColaboradorFeedback> {
    return {
      avaliacao_geral: geral,
      blocos_aprendizagem: {
        cultura,
        ...(blocoIntegracao ? { integracao_funcional: integracao } : {}),
      },
      feedback_mentor_gestor: mentorFeedback,
      duvidas_reforco: duvidas,
      principais_aprendizagens: aprendizagens || null,
      comentarios_finais: comentarios || null,
      classificacao_global: classificacao || null,
    };
  }

  const info = estadoInfo(feedback.estado);
  const Icon = info.icon;

  return (
    <motion.div variants={staggerItem} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-navy-500" />
            Feedback · {momentoLabel(feedback.momento)}
          </CardTitle>
          <Badge variant={info.variant} size="md">
            <Icon className="h-3 w-3" />
            {info.label}
          </Badge>
        </CardHeader>
        <p className="text-xs text-navy-500">
          Categoria:{' '}
          <strong>
            {isGestao
              ? 'Directores e Gestores'
              : 'Coordenadores, Técnicos, Assistentes e Operacionais'}
          </strong>
        </p>
      </Card>

      <BlocoQualitativo
        titulo={isGestao ? 'Avaliação geral da indução' : 'Experiência de indução'}
        itens={blocoGeral}
        valores={geral}
        onChange={setGeral}
        readOnly={readOnly}
        escala={ESCALA_QUALITATIVA_FEEDBACK}
      />

      <BlocoQualitativo
        titulo={isGestao ? 'Cultura, governo e organização' : 'Cultura e valores'}
        itens={blocoCultura}
        valores={cultura}
        onChange={setCultura}
        readOnly={readOnly}
        escala={ESCALA_QUALITATIVA_FEEDBACK}
      />

      {blocoIntegracao && (
        <BlocoQualitativo
          titulo="Integração funcional"
          itens={blocoIntegracao}
          valores={integracao}
          onChange={setIntegracao}
          readOnly={readOnly}
          escala={ESCALA_SIM_PARCIAL_NAO}
        />
      )}

      <BlocoQualitativo
        titulo={isGestao ? 'Comissão Executiva e prioridades' : 'Feedback sobre o mentor / gestor'}
        itens={blocoMentor}
        valores={mentorFeedback}
        onChange={setMentorFeedback}
        readOnly={readOnly}
        escala={ESCALA_QUALITATIVA_FEEDBACK}
      />

      <BlocoDuvidas
        titulo={isGestao ? 'Necessidades de suporte adicional' : 'Dúvidas que precisam de reforço'}
        itens={blocoDuvidas}
        valores={duvidas}
        onChange={setDuvidas}
        readOnly={readOnly}
      />

      <Card>
        <CardHeader>
          <CardTitle>Aprendizagens e comentários</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <FormField label="Principais aprendizagens neste período">
            <Textarea
              value={aprendizagens}
              onChange={(e) => setAprendizagens(e.target.value)}
              disabled={readOnly}
              autoResize
              placeholder="O que ficaste a saber e queres registar?"
            />
          </FormField>
          <FormField label="Comentários finais">
            <Textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              disabled={readOnly}
              autoResize
              placeholder="Notas livres para a DPC e para o teu mentor."
            />
          </FormField>
          <FormField label="Classificação global da experiência">
            <Select
              options={CLASSIFICACOES_GLOBAIS_FEEDBACK}
              placeholder="Selecciona..."
              value={classificacao}
              onChange={(v) => setClassificacao(v as ClassificacaoGlobal)}
              disabled={readOnly}
            />
          </FormField>
        </div>
      </Card>

      {/* Barra inferior fixa */}
      <div className="fixed inset-x-0 bottom-0 border-t border-navy-100 bg-white/95 backdrop-blur px-4 py-3 shadow-lg z-30">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-navy-500 inline-flex items-center gap-1.5">
            {readOnly ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success-600" />
                Já submetido — só leitura.
              </>
            ) : !podeSubmeter ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-warning-600" />
                Faltam {totalObrig - preenchidos} item(ns) para poderes submeter.
              </>
            ) : (
              <>
                <Info className="h-3.5 w-3.5 text-info-600" />
                Tudo preenchido. Podes submeter à DPC.
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readOnly && (
              <Button
                variant="secondary"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => exportarFeedbackColaboradorPDF(feedback)}
              >
                Exportar PDF
              </Button>
            )}
            {!readOnly && (
              <>
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={() => onGuardar(payload())}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Guardar rascunho
                </Button>
                <Button
                  variant="primary"
                  disabled={!podeSubmeter || saving}
                  onClick={() => onSubmeter(payload())}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Submeter
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------
// Blocos genéricos
// -----------------------------------------------------------
function BlocoQualitativo({
  titulo,
  itens,
  valores,
  onChange,
  readOnly,
  escala,
}: {
  titulo: string;
  itens: BlocoQual;
  valores: QualState;
  onChange: (v: QualState) => void;
  readOnly: boolean;
  escala: { value: string; label: string }[];
}) {
  function setItem(key: string, patch: Partial<{ valor: string; comentario: string }>) {
    onChange({ ...valores, [key]: { ...valores[key], ...patch } });
  }
  const preenchidos = itens.filter((i) => valores[i.key]?.valor).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <span className="text-xs text-navy-500 tabular-nums">
          {preenchidos} / {itens.length}
        </span>
      </CardHeader>
      <div className="space-y-3">
        {itens.map((it) => {
          const v = valores[it.key]?.valor ?? '';
          const c = valores[it.key]?.comentario ?? '';
          return (
            <div key={it.key} className="rounded-lg border border-navy-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-medium text-navy-800">{it.label}</p>
                {v && (
                  <Badge variant="success" size="sm">
                    <CheckCircle2 className="h-3 w-3" />
                    {escala.find((e) => e.value === v)?.label}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {escala.map((opt) => {
                  const active = v === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setItem(it.key, { valor: opt.value })}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                        active
                          ? 'border-navy-700 bg-navy-700 text-white'
                          : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400',
                        readOnly && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={c}
                onChange={(e) => setItem(it.key, { comentario: e.target.value })}
                disabled={readOnly}
                placeholder="Comentário (opcional)"
                autoResize
                className="mt-2 min-h-[48px] text-sm"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BlocoDuvidas({
  titulo,
  itens,
  valores,
  onChange,
  readOnly,
}: {
  titulo: string;
  itens: BlocoQual;
  valores: DuvState;
  onChange: (v: DuvState) => void;
  readOnly: boolean;
}) {
  function toggle(key: string, necessita: boolean) {
    onChange({ ...valores, [key]: { ...valores[key], necessita } });
  }
  function setObs(key: string, obs: string) {
    onChange({ ...valores, [key]: { ...valores[key], necessita: valores[key]?.necessita ?? false, obs } });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <span className="text-xs text-navy-500">Marca as áreas onde precisas de apoio.</span>
      </CardHeader>
      <div className="space-y-2">
        {itens.map((it) => {
          const marc = valores[it.key]?.necessita ?? false;
          const obs = valores[it.key]?.obs ?? '';
          return (
            <div key={it.key} className={cn('rounded-lg border p-3', marc ? 'border-warning-200 bg-warning-50/40' : 'border-navy-100')}>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={marc}
                  onCheckedChange={(checked) => toggle(it.key, checked)}
                  disabled={readOnly}
                />
                <span className="text-sm font-medium text-navy-800">{it.label}</span>
              </label>
              {marc && (
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(it.key, e.target.value)}
                  disabled={readOnly}
                  placeholder="Descreve a dúvida ou o suporte que precisas..."
                  autoResize
                  className="mt-2 min-h-[48px] text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
