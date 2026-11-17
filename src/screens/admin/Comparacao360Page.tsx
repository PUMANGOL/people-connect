import { useEffect, useMemo, useState } from 'react';
import { LineChart, Users, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardTitle, EmptyState } from '@/src/components/ui/card';
import { Select, FormField } from '@/src/components/ui/input';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import {
  mentorAvaliacoesService, colaboradorFeedbackService,
} from '@/src/services/mentoria.service';
import { colaboradoresService, type ColaboradorRow } from '@/src/services/onboarding-v2.service';
import type { MentorAvaliacao, ColaboradorFeedback } from '@/lib/types';
import { MOMENTOS_AVALIACAO } from '@/lib/avaliacao-schemas';

const MOMENTO_OPTIONS = MOMENTOS_AVALIACAO.map((m) => ({ value: m.value, label: m.label }));

// Eixos comparáveis entre mentor→colaborador e colaborador→mentor.
// Ambos usam o mesmo par de chaves (o feedback do colaborador tem
// `feedback_mentor_gestor.{disponibilidade,clareza,gestor_directo,integracao_equipa}`).
// Escala do mentor: 1..5 (numérico). Escala do colaborador: excelente/bom/regular/melhorar → 4/3/2/1 → normalizamos para /5.
const EIXOS: { key: string; label: string; colaboradorKey?: string }[] = [
  { key: 'disponibilidade',    label: 'Disponibilidade',                colaboradorKey: 'disponibilidade' },
  { key: 'clareza',            label: 'Clareza das orientações',         colaboradorKey: 'clareza' },
  { key: 'integracao_equipa',  label: 'Integração na equipa',            colaboradorKey: 'integracao_equipa' },
  { key: 'primeiros_dias',     label: 'Primeiros dias',                  colaboradorKey: undefined },
  { key: 'cultura',            label: 'Cultura / valores',               colaboradorKey: undefined },
  { key: 'encaminhamento',     label: 'Encaminhamento',                  colaboradorKey: undefined },
  { key: 'cumprimento',        label: 'Cumprimento de checkpoints',      colaboradorKey: undefined },
];

const QUAL_TO_NUM: Record<string, number> = {
  excelente: 5,
  bom: 4,
  regular: 3,
  melhorar: 2,
  nao: 1,
};

function qualToNum(v: string | undefined): number | null {
  if (!v) return null;
  const val = QUAL_TO_NUM[v.toLowerCase()];
  return typeof val === 'number' ? val : null;
}

function critNum(v: number | 'N/A' | undefined): number | null {
  if (typeof v === 'number') return v;
  return null;
}

interface Ponto {
  eixo: string;
  label: string;
  mentor: number | null;
  colaborador: number | null;
}

export default function Comparacao360Page() {
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([]);
  const [avals, setAvals] = useState<MentorAvaliacao[]>([]);
  const [feedbacks, setFeedbacks] = useState<ColaboradorFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [colaboradorId, setColaboradorId] = useState('');
  const [momento, setMomento] = useState('');

  useEffect(() => {
    Promise.all([
      colaboradoresService.list(),
      mentorAvaliacoesService.list(),
    ])
      .then(([cs, as]) => {
        setColaboradores(cs);
        setAvals(as);
      })
      .catch(() => {
        /* silencioso */
      })
      .finally(() => setLoading(false));
  }, []);

  // Carrega os feedbacks do colaborador seleccionado (endpoint por colaborador)
  useEffect(() => {
    if (!colaboradorId) {
      setFeedbacks([]);
      return;
    }
    colaboradorFeedbackService
      .porColaborador(colaboradorId)
      .then(setFeedbacks)
      .catch(() => setFeedbacks([]));
  }, [colaboradorId]);

  const momentos = useMemo(() => {
    const ms = new Set<string>();
    avals.filter((a) => a.colaborador_id === colaboradorId).forEach((a) => ms.add(a.momento));
    feedbacks.forEach((f) => ms.add(f.momento));
    return Array.from(ms);
  }, [avals, feedbacks, colaboradorId]);

  const cruzamento = useMemo<Ponto[]>(() => {
    if (!colaboradorId) return [];
    const av = avals.find(
      (a) => a.colaborador_id === colaboradorId && (!momento || a.momento === momento),
    );
    const fb = feedbacks.find((f) => !momento || f.momento === momento);

    return EIXOS.map((e) => ({
      eixo: e.key,
      label: e.label,
      mentor: av ? critNum(av.criterios?.[e.key]) : null,
      colaborador:
        fb && e.colaboradorKey
          ? qualToNum(fb.feedback_mentor_gestor?.[e.colaboradorKey]?.valor)
          : null,
    }));
  }, [avals, feedbacks, colaboradorId, momento]);

  const colOptions = colaboradores.map((c) => ({
    value: c.id,
    label: `${c.nome} — ${c.funcao}`,
  }));
  const colInfo = colaboradores.find((c) => c.id === colaboradorId);

  const temDados = cruzamento.some((p) => p.mentor !== null || p.colaborador !== null);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Comparação 360°</h1>
        <p className="mt-1 text-sm text-navy-500">
          Cruza a percepção do mentor com a auto-avaliação do colaborador em critérios comparáveis.
        </p>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Colaborador" required>
              <Select
                options={colOptions}
                placeholder={loading ? 'A carregar...' : 'Seleccionar colaborador'}
                value={colaboradorId}
                onChange={(v) => {
                  setColaboradorId(v);
                  setMomento('');
                }}
              />
            </FormField>
            <FormField label="Momento" hint="Vazio = usa a avaliação mais recente disponível.">
              <Select
                options={
                  momentos.length > 0
                    ? MOMENTO_OPTIONS.filter((m) => momentos.includes(m.value))
                    : MOMENTO_OPTIONS
                }
                placeholder="Todos os disponíveis"
                value={momento}
                onChange={setMomento}
                disabled={!colaboradorId}
              />
            </FormField>
          </div>
        </Card>
      </motion.div>

      {loading ? (
        <SkeletonList rows={3} cols={2} />
      ) : !colaboradorId ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Selecciona um colaborador"
          description="A comparação 360° cruza os dois lados: como o mentor vê o processo e como o colaborador o experiencia."
        />
      ) : !temDados ? (
        <EmptyState
          icon={<LineChart className="h-8 w-8" />}
          title="Sem dados suficientes"
          description="É necessário pelo menos uma avaliação do mentor ou feedback do colaborador para desenhar o radar."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Radar */}
          <motion.div variants={staggerItem} className="lg:col-span-2">
            <Card>
              <CardTitle className="mb-3">
                {colInfo?.nome} · Radar 360°
                {momento && (
                  <Badge variant="neutral" size="sm" className="ml-2">
                    {MOMENTOS_AVALIACAO.find((m) => m.value === momento)?.label}
                  </Badge>
                )}
              </CardTitle>
              <RadarSVG pontos={cruzamento} />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-navy-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-navy-700" />
                  Percepção do mentor
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-500" />
                  Auto-avaliação do colaborador
                </span>
                <span className="text-navy-400">Escala 0-5</span>
              </div>
            </Card>
          </motion.div>

          {/* Tabela de valores + notas */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardTitle className="mb-3">Detalhe por eixo</CardTitle>
              <div className="space-y-2">
                {cruzamento.map((p) => (
                  <div key={p.eixo} className="rounded-lg border border-navy-100 p-2.5">
                    <p className="text-xs font-medium text-navy-800">{p.label}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Badge variant="neutral" size="sm">
                        Mentor: {p.mentor ?? '—'}
                      </Badge>
                      <Badge variant={p.colaborador == null ? 'neutral' : 'accent'} size="sm">
                        Colab.: {p.colaborador ?? '—'}
                      </Badge>
                      {p.mentor !== null && p.colaborador !== null && (
                        <span
                          className={`text-[11px] font-semibold ${
                            Math.abs(p.mentor - p.colaborador) >= 2
                              ? 'text-error-500'
                              : Math.abs(p.mentor - p.colaborador) >= 1
                              ? 'text-warning-600'
                              : 'text-success-600'
                          }`}
                        >
                          Δ {(p.mentor - p.colaborador).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-lg bg-navy-25 p-3 text-xs text-navy-600">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  Só os eixos onde <em>ambos</em> os lados respondem podem ser cruzados. Os
                  restantes mostram apenas a perspectiva do mentor. A escala do colaborador
                  (excelente/bom/regular/melhorar) é normalizada em 5→2.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ---- Componente Radar em SVG puro ----
function RadarSVG({ pontos }: { pontos: Ponto[] }) {
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 140;
  const levels = 5;
  const N = pontos.length;

  // Ângulo por eixo (topo é -90°)
  const angleFor = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / N;

  const point = (i: number, valor: number | null) => {
    const v = valor ?? 0;
    const r = (v / 5) * radius;
    const a = angleFor(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const labelPoint = (i: number) => {
    const r = radius + 24;
    const a = angleFor(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // Grelha (níveis 1-5)
  const gridPolygons: string[] = [];
  for (let l = 1; l <= levels; l++) {
    const rl = (l / levels) * radius;
    const pts: string[] = [];
    for (let i = 0; i < N; i++) {
      const a = angleFor(i);
      pts.push(`${cx + rl * Math.cos(a)},${cy + rl * Math.sin(a)}`);
    }
    gridPolygons.push(pts.join(' '));
  }

  // Linhas radiais
  const axes = pontos.map((_, i) => {
    const a = angleFor(i);
    return { x1: cx, y1: cy, x2: cx + radius * Math.cos(a), y2: cy + radius * Math.sin(a) };
  });

  const mentorPts = pontos
    .map((p, i) => point(i, p.mentor))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
  const colabPts = pontos
    .map((p, i) => point(i, p.colaborador))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <div className="flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px] h-auto">
        {/* Grelha */}
        {gridPolygons.map((poly, i) => (
          <polygon
            key={i}
            points={poly}
            fill="none"
            stroke="#E5E9F2"
            strokeWidth={1}
          />
        ))}
        {/* Eixos */}
        {axes.map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="#D6DBE8"
            strokeWidth={1}
          />
        ))}
        {/* Área do colaborador (por baixo) */}
        {pontos.some((p) => p.colaborador !== null) && (
          <polygon
            points={colabPts}
            fill="#C8A951"
            fillOpacity={0.22}
            stroke="#C8A951"
            strokeWidth={2}
          />
        )}
        {/* Área do mentor (por cima) */}
        {pontos.some((p) => p.mentor !== null) && (
          <polygon
            points={mentorPts}
            fill="#1B2B4B"
            fillOpacity={0.18}
            stroke="#1B2B4B"
            strokeWidth={2}
          />
        )}
        {/* Pontos + Labels */}
        {pontos.map((p, i) => {
          const lbl = labelPoint(i);
          const mp = point(i, p.mentor);
          const cp = point(i, p.colaborador);
          return (
            <g key={i}>
              {p.mentor !== null && (
                <circle cx={mp.x} cy={mp.y} r={3.5} fill="#1B2B4B" />
              )}
              {p.colaborador !== null && (
                <circle cx={cp.x} cy={cp.y} r={3.5} fill="#C8A951" />
              )}
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor={
                  Math.abs(lbl.x - cx) < 8 ? 'middle' : lbl.x > cx ? 'start' : 'end'
                }
                dominantBaseline={lbl.y > cy + 4 ? 'hanging' : lbl.y < cy - 4 ? 'auto' : 'middle'}
                fontSize={10}
                fill="#334155"
              >
                {p.label}
              </text>
            </g>
          );
        })}
        {/* Legenda escala no eixo topo */}
        {[1, 2, 3, 4, 5].map((v) => (
          <text
            key={v}
            x={cx + 3}
            y={cy - (v / 5) * radius}
            fontSize={8}
            fill="#94A3B8"
          >
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}
