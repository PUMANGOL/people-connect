import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select, FormField } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, EmptyState, StatCard } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { admissaoService, type ProcessoAdmissao } from '@/src/services/admissao.service';
import { ESTADO_ADMISSAO_LABEL, SEMAFORO_LABEL, type EstadoAdmissao, type SemaforoAdmissao } from '@/src/lib/admissao-fluxo';
import { useCatalogo } from '@/src/hooks/use-catalogo';

const ESTADO_OPTIONS = (Object.keys(ESTADO_ADMISSAO_LABEL) as EstadoAdmissao[]).map((value) => ({
  value,
  label: ESTADO_ADMISSAO_LABEL[value],
}));

function semaforoVariant(semaforo: SemaforoAdmissao): 'success' | 'warning' | 'error' {
  if (semaforo === 'verde') return 'success';
  if (semaforo === 'amarelo') return 'warning';
  return 'error';
}

function estadoVariant(estado: EstadoAdmissao): 'success' | 'error' | 'info' | 'neutral' {
  if (estado === 'cancelado') return 'error';
  if (estado === 'transferido_onboarding' || estado === 'pronto_para_entrada') return 'success';
  if (estado === 'rascunho') return 'neutral';
  return 'info';
}

function dataLabel(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-AO');
}

export default function AdmissaoListaPage() {
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<ProcessoAdmissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ estado: '', search: '' });
  const [criando, setCriando] = useState(false);

  function carregar() {
    setLoading(true);
    admissaoService.list()
      .then(setProcessos)
      .catch(() => toast.error('Erro', 'Não foi possível carregar as admissões.'))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const filtered = useMemo(() => processos.filter((processo) => {
    if (filtros.estado && processo.estado !== filtros.estado) return false;
    if (!filtros.search) return true;
    const q = filtros.search.toLowerCase();
    return processo.nome.toLowerCase().includes(q)
      || (processo.funcao ?? '').toLowerCase().includes(q)
      || (processo.direccao ?? '').toLowerCase().includes(q)
      || processo.etapa_actual.toLowerCase().includes(q);
  }), [processos, filtros]);

  const counters = useMemo(() => ({
    total: processos.length,
    emCurso: processos.filter((p) => p.estado !== 'cancelado' && p.estado !== 'transferido_onboarding').length,
    bloqueados: processos.filter((p) => p.bloqueado).length,
    fechados: processos.filter((p) => p.estado === 'transferido_onboarding' || p.estado === 'cancelado').length,
  }), [processos]);

  if (loading) return <SkeletonList rows={6} cols={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Admissão</h1>
          <p className="mt-1 text-sm text-navy-400">Processo entre o candidato seleccionado e a activação do onboarding.</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCriando(true)}>
          Novo processo
        </Button>
      </div>

      {processos.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Ainda não há admissões"
          description="Abra um processo a partir de um candidato aprovado, ou crie um manualmente."
          action={{ label: 'Novo processo', onClick: () => setCriando(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={<ClipboardList className="h-5 w-5" />} title="Total" value={counters.total} />
            <StatCard icon={<ClipboardList className="h-5 w-5" />} iconBg="bg-info-50 text-info-600" title="Em curso" value={counters.emCurso} />
            <StatCard icon={<ClipboardList className="h-5 w-5" />} iconBg="bg-error-50 text-error-500" title="Bloqueados" value={counters.bloqueados} />
            <StatCard icon={<ClipboardList className="h-5 w-5" />} iconBg="bg-success-50 text-success-600" title="Encerrados" value={counters.fechados} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
              <Input
                placeholder="Pesquisar por nome, função, direcção ou etapa…"
                className="pl-9"
                value={filtros.search}
                onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select
              options={ESTADO_OPTIONS}
              placeholder="Todos os estados"
              value={filtros.estado}
              onChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}
              className="w-full sm:w-64"
            />
          </div>

          <Card className="overflow-hidden p-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy-700 text-xs uppercase tracking-wide text-white">
                      <th className="px-4 py-3 text-left font-semibold">Candidato</th>
                      <th className="px-4 py-3 text-left font-semibold">Etapa actual</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Semáforo</th>
                      <th className="px-4 py-3 text-left font-semibold">Entrada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-navy-400">Nenhum processo corresponde aos filtros.</td></tr>
                    ) : filtered.map((processo) => (
                      <tr
                        key={processo.id}
                        className="cursor-pointer hover:bg-navy-25"
                        onClick={() => navigate(`/admissao/${processo.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-navy-800">{processo.nome}</div>
                          <div className="text-xs text-navy-400">{[processo.funcao, processo.direccao].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-navy-600">
                          <div>{processo.etapa_nome}</div>
                          <div className="text-xs text-navy-400">{processo.etapa_actual} · {processo.fase}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={estadoVariant(processo.estado)} size="sm">{ESTADO_ADMISSAO_LABEL[processo.estado]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={semaforoVariant(processo.semaforo)} size="sm">{SEMAFORO_LABEL[processo.semaforo]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-navy-500">{dataLabel(processo.data_prevista_entrada)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {criando && (
        <NovoProcessoDialog
          onClose={() => setCriando(false)}
          onCreated={(id) => {
            setCriando(false);
            navigate(`/admissao/${id}`);
          }}
        />
      )}
    </div>
  );
}

function NovoProcessoDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { funcaoOptions, direccaoOptions } = useCatalogo();
  const [form, setForm] = useState({
    nome: '',
    funcao: '',
    direccao: '',
    email: '',
    data_prevista_entrada: '',
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.nome.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    setSaving(true);
    try {
      const processo = await admissaoService.criar({
        nome: form.nome.trim(),
        funcao: form.funcao || null,
        direccao: form.direccao || null,
        email: form.email || null,
        data_prevista_entrada: form.data_prevista_entrada || null,
      });
      toast.success('Admissão aberta', `${processo.nome} está na etapa ${processo.etapa_actual}.`);
      onCreated(processo.id);
    } catch {
      toast.error('Erro', 'Não foi possível abrir a admissão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-4xl">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">Novo processo de admissão</h2>
      <p className="mb-6 text-sm text-navy-400">Abre o processo na confirmação do candidato. A primeira decisão ainda fica por registar.</p>
      <div className="space-y-4">
        <FormField label="Nome" required>
          <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Função">
            <Select
              options={funcaoOptions}
              placeholder={funcaoOptions.length ? 'Seleccionar' : 'Sem funções — crie-as no menu'}
              value={form.funcao}
              onChange={(v) => setForm((f) => ({ ...f, funcao: v }))}
            />
          </FormField>
          <FormField label="Direcção">
            <Select
              options={direccaoOptions}
              placeholder={direccaoOptions.length ? 'Seleccionar' : 'Sem direcções — crie-as no menu'}
              value={form.direccao}
              onChange={(v) => setForm((f) => ({ ...f, direccao: v }))}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail pessoal">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Data prevista de entrada">
            <DateInput value={form.data_prevista_entrada} onChange={(v) => setForm((f) => ({ ...f, data_prevista_entrada: v }))} />
          </FormField>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={saving}>Abrir processo</Button>
      </div>
    </Dialog>
  );
}
