import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, HelpCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { EmptyState } from '@/src/components/ui/card';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import {
  quizService,
  type QuizPergunta,
  type QuizTipo,
  type QuizResultadoAdmin,
} from '@/src/services/onboarding-v2.service';
import { Checkbox } from '@/components/ui/checkbox';

const TIPO_OPTIONS = [
  { value: 'escolha_multipla', label: 'Escolha múltipla' },
  { value: 'verdadeiro_falso', label: 'Verdadeiro / Falso' },
  { value: 'informativa', label: 'Informativa (sem resposta)' },
];
const TIPO_LABEL: Record<QuizTipo, string> = {
  escolha_multipla: 'Escolha múltipla',
  verdadeiro_falso: 'V / F',
  informativa: 'Informativa',
};

function opcoesDe(p: Pick<QuizPergunta, 'tipo' | 'opcoes'>): string[] {
  if (p.tipo === 'verdadeiro_falso') return ['Verdadeiro', 'Falso'];
  const raw = p.opcoes as unknown;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return [];
    }
  }
  return [];
}

function emptyPergunta(): Partial<QuizPergunta> {
  return { tipo: 'escolha_multipla', pergunta: '', opcoes: ['', ''], resposta_correcta: 0, explicacao: '', activa: true };
}

export default function QuizAdminPage() {
  const [perguntas, setPerguntas] = useState<QuizPergunta[]>([]);
  const [resultados, setResultados] = useState<QuizResultadoAdmin[]>([]);
  const [config, setConfig] = useState({ perguntas_por_sessao: 10, ordem_aleatoria: true });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<QuizPergunta> | null>(null);

  function carregar() {
    Promise.all([quizService.listPerguntas(), quizService.getConfig(), quizService.resultados()])
      .then(([p, c, r]) => {
        setPerguntas(p);
        setConfig(c);
        setResultados(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function guardarConfig() {
    try {
      await quizService.updateConfig(config);
      toast.success('Configuração guardada');
    } catch {
      toast.error('Erro ao guardar configuração');
    }
  }

  async function guardarPergunta() {
    if (!editing || !editing.pergunta?.trim()) {
      toast.error('Pergunta obrigatória');
      return;
    }
    const payload: Partial<QuizPergunta> = {
      tipo: editing.tipo,
      pergunta: editing.pergunta,
      opcoes: editing.tipo === 'verdadeiro_falso' ? ['Verdadeiro', 'Falso'] : editing.tipo === 'informativa' ? [] : editing.opcoes,
      resposta_correcta: editing.tipo === 'informativa' ? null : editing.resposta_correcta ?? 0,
      explicacao: editing.explicacao ?? null,
      activa: editing.activa ?? true,
    };
    try {
      if (editing.id) await quizService.updatePergunta(editing.id, payload);
      else await quizService.createPergunta(payload);
      toast.success('Pergunta guardada');
      setEditing(null);
      carregar();
    } catch {
      toast.error('Erro ao guardar pergunta');
    }
  }

  async function remover(id: string) {
    try {
      await quizService.deletePergunta(id);
      setPerguntas((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function toggleActiva(p: QuizPergunta) {
    try {
      await quizService.updatePergunta(p.id, { activa: !p.activa });
      setPerguntas((prev) => prev.map((x) => (x.id === p.id ? { ...x, activa: !x.activa } : x)));
    } catch {
      toast.error('Erro ao actualizar');
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl"><SkeletonList rows={6} cols={3} /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Quiz de Boas-Vindas</h1>
          <p className="mt-1 text-sm text-navy-400">Gere o banco de perguntas e a configuração do quiz.</p>
        </div>
        <Button variant="accent" onClick={() => setEditing(emptyPergunta())}>
          <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nova pergunta</span>
        </Button>
      </div>

      {/* Configuração */}
      <div className="rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">Configuração</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">Perguntas por sessão</label>
            <Input
              type="number"
              className="w-32"
              value={String(config.perguntas_por_sessao)}
              onChange={(e) => setConfig((c) => ({ ...c, perguntas_por_sessao: Number(e.target.value) || 1 }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <Checkbox
              checked={config.ordem_aleatoria}
              onCheckedChange={(checked) => setConfig((c) => ({ ...c, ordem_aleatoria: checked }))}
            />
            Ordem aleatória
          </label>
          <Button variant="secondary" size="sm" onClick={guardarConfig}>
            <span className="inline-flex items-center gap-1.5"><Save className="h-4 w-4" /> Guardar</span>
          </Button>
        </div>
      </div>

      {/* Perguntas */}
      {perguntas.length === 0 ? (
        <EmptyState icon={<HelpCircle className="h-8 w-8" />} title="Sem perguntas" description="Cria a primeira pergunta do quiz." />
      ) : (
        <div className="space-y-2">
          {perguntas.map((p) => {
            const opcoes = opcoesDe(p);
            return (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="neutral" size="sm">{TIPO_LABEL[p.tipo]}</Badge>
                  {!p.activa && <Badge variant="error" size="sm">Inactiva</Badge>}
                </div>
                <p className="font-medium text-navy-800">{p.pergunta}</p>
                {p.tipo !== 'informativa' && (
                  <p className="mt-1 text-xs text-navy-400">
                    {opcoes.map((o, i) => (
                      <span key={i} className={i === p.resposta_correcta ? 'text-success-600 font-medium' : ''}>
                        {o}{i < opcoes.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-navy-500">
                <Checkbox checked={p.activa} onCheckedChange={() => toggleActiva(p)} />
                Activa
              </label>
              <button onClick={() => setEditing({ ...p, opcoes: opcoes.length ? opcoes : ['', ''] })} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remover(p.id)} className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            );
          })}
        </div>
      )}

      {/* Resultados */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy-500">
          <BarChart3 className="h-4 w-4" /> Resultados dos colaboradores
        </h2>
        {resultados.length === 0 ? (
          <p className="text-sm text-navy-400">Ainda sem resultados registados.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-surface-secondary text-left text-xs uppercase text-navy-400">
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {resultados.map((r) => (
                  <tr key={r.id} className="even:bg-surface-secondary/40">
                    <td className="px-4 py-2.5 text-navy-800">{r.colaborador_nome ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={r.percentagem >= 50 ? 'success' : 'error'} size="sm">
                        {r.acertos}/{r.total} ({r.percentagem}%)
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-navy-400">{new Date(r.created_at).toLocaleDateString('pt-AO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog de edição */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <h2 className="mb-4 text-lg font-semibold text-navy-800">{editing.id ? 'Editar pergunta' : 'Nova pergunta'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Tipo</label>
              <Select
                options={TIPO_OPTIONS}
                value={editing.tipo ?? 'escolha_multipla'}
                onChange={(v) => setEditing((e) => ({ ...e!, tipo: v as QuizTipo, resposta_correcta: 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Pergunta</label>
              <Input value={editing.pergunta ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, pergunta: e.target.value }))} />
            </div>

            {editing.tipo === 'escolha_multipla' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-navy-500">Opções (marca a correcta)</label>
                <div className="space-y-2">
                  {(editing.opcoes ?? ['', '']).map((op, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correcta"
                        checked={editing.resposta_correcta === i}
                        onChange={() => setEditing((x) => ({ ...x!, resposta_correcta: i }))}
                        className="text-navy-700 focus:ring-gold-500"
                      />
                      <Input
                        value={op}
                        className="flex-1"
                        placeholder={`Opção ${i + 1}`}
                        onChange={(e) =>
                          setEditing((x) => ({ ...x!, opcoes: (x!.opcoes ?? []).map((o, k) => (k === i ? e.target.value : o)) }))
                        }
                      />
                      {(editing.opcoes?.length ?? 0) > 2 && (
                        <button
                          onClick={() => setEditing((x) => ({ ...x!, opcoes: (x!.opcoes ?? []).filter((_, k) => k !== i) }))}
                          className="text-error-400 hover:text-error-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {(editing.opcoes?.length ?? 0) < 4 && (
                  <button
                    onClick={() => setEditing((x) => ({ ...x!, opcoes: [...(x!.opcoes ?? []), ''] }))}
                    className="mt-2 text-xs font-medium text-gold-600 hover:underline"
                  >
                    + Adicionar opção
                  </button>
                )}
              </div>
            )}

            {editing.tipo === 'verdadeiro_falso' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-navy-500">Resposta correcta</label>
                <Select
                  options={[{ value: '0', label: 'Verdadeiro' }, { value: '1', label: 'Falso' }]}
                  value={String(editing.resposta_correcta ?? 0)}
                  onChange={(v) => setEditing((e) => ({ ...e!, resposta_correcta: Number(v) }))}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Explicação (opcional)</label>
              <Input value={editing.explicacao ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, explicacao: e.target.value }))} />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="accent" onClick={guardarPergunta}>Guardar</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
