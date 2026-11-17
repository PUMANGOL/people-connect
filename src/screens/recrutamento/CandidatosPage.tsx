import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Search, FileSpreadsheet, UserPlus, Check, X, RotateCcw, KeyRound } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select, FormField } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, EmptyState, StatCard } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { useRecrutamentoSemanalStore } from '@/src/store/recrutamento-semanal.store';
import { colaboradoresService, type Credenciais } from '@/src/services/onboarding-v2.service';
import { admissaoService } from '@/src/services/admissao.service';
import { toast } from '@/src/store';
import { EMAIL_DOMINIO } from '@/lib/constants';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import type { CandidatoImportado, EstadoCandidatoImportado } from '@/lib/types';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';

const ESTADO_LABEL: Record<EstadoCandidatoImportado, string> = {
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

const ESTADO_VARIANT: Record<EstadoCandidatoImportado, 'info' | 'success' | 'error'> = {
  em_analise: 'info',
  aprovado: 'success',
  rejeitado: 'error',
};

const ESTADO_OPTIONS = [
  { value: 'em_analise', label: 'Em análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
];

export default function CandidatosPage() {
  const navigate = useNavigate();
  const { candidatos, updateEstado, updateCandidato } = useRecrutamentoSemanalStore();
  const [filtros, setFiltros] = useState({ estado: '', search: '' });
  const [criando, setCriando] = useState<CandidatoImportado | null>(null);
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);
  const [abrindoAdmissao, setAbrindoAdmissao] = useState<string | null>(null);

  async function iniciarAdmissao(c: CandidatoImportado) {
    if (c.admissao_id) {
      navigate(`/admissao/${c.admissao_id}`);
      return;
    }
    setAbrindoAdmissao(c.id);
    const data = c.data && /^\d{4}-\d{2}-\d{2}/.test(c.data) ? c.data.slice(0, 10) : null;
    try {
      const processo = await admissaoService.criar({
        candidato_ref: c.id,
        nome: c.nome,
        funcao: c.funcao,
        direccao: c.departamento,
        email: c.email,
        telefone: c.telefone,
        data_prevista_entrada: data,
      });
      updateCandidato(c.id, { admissao_id: processo.id });
      navigate(`/admissao/${processo.id}`);
    } catch (err) {
      const processoId = axios.isAxiosError(err) ? err.response?.data?.processo_id : null;
      if (typeof processoId === 'string') {
        updateCandidato(c.id, { admissao_id: processoId });
        navigate(`/admissao/${processoId}`);
        return;
      }
      toast.error('Erro', 'Não foi possível abrir a admissão.');
    } finally {
      setAbrindoAdmissao(null);
    }
  }

  const filtered = useMemo(() => {
    return candidatos.filter((c) => {
      if (filtros.estado && c.estado !== filtros.estado) return false;
      if (filtros.search) {
        const q = filtros.search.toLowerCase();
        return c.nome.toLowerCase().includes(q)
          || (c.funcao ?? '').toLowerCase().includes(q)
          || (c.departamento ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [candidatos, filtros]);

  const counters = useMemo(() => ({
    total: candidatos.length,
    em_analise: candidatos.filter((c) => c.estado === 'em_analise').length,
    aprovado: candidatos.filter((c) => c.estado === 'aprovado').length,
    rejeitado: candidatos.filter((c) => c.estado === 'rejeitado').length,
  }), [candidatos]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Candidatos</h1>
          <p className="text-navy-400 text-sm mt-1">Lista de candidatos importada via Dashboard Semanal</p>
        </div>
        <Button variant="secondary" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => navigate('/recrutamento/dashboard-semanal')}>
          Ver Dashboard Semanal
        </Button>
      </motion.div>

      {candidatos.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="Nenhum candidato importado"
          description="Importe um ficheiro Excel no Dashboard Semanal, incluindo uma aba chamada &quot;Candidatos&quot;, para popular esta lista."
          action={{ label: 'Ir para Dashboard Semanal', onClick: () => navigate('/recrutamento/dashboard-semanal') }}
        />
      ) : (
        <>
          <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-5 h-5" />} title="Total" value={counters.total} />
            <StatCard icon={<Users className="w-5 h-5" />} iconBg="bg-info-50 text-info-600" title="Em análise" value={counters.em_analise} />
            <StatCard icon={<Check className="w-5 h-5" />} iconBg="bg-success-50 text-success-600" title="Aprovados" value={counters.aprovado} />
            <StatCard icon={<X className="w-5 h-5" />} iconBg="bg-error-50 text-error-500" title="Rejeitados" value={counters.rejeitado} />
          </motion.div>

          <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <Input
                placeholder="Pesquisar por nome, função ou departamento…"
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
              className="w-full sm:w-48"
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="p-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-navy-700 text-white text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Nome</th>
                        <th className="text-left px-4 py-3 font-semibold">Função / Posição</th>
                        <th className="text-left px-4 py-3 font-semibold">Departamento</th>
                        <th className="text-left px-4 py-3 font-semibold">Contacto</th>
                        <th className="text-left px-4 py-3 font-semibold">Status</th>
                        <th className="text-left px-4 py-3 font-semibold">Data</th>
                        <th className="text-right px-4 py-3 font-semibold">Acções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-50">
                      {filtered.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-navy-400">Nenhum candidato corresponde aos filtros.</td></tr>
                      ) : filtered.map((c) => (
                        <tr key={c.id} className="hover:bg-navy-25">
                          <td className="px-4 py-3 font-medium text-navy-800">{c.nome}</td>
                          <td className="px-4 py-3 text-navy-600">{c.funcao ?? '—'}</td>
                          <td className="px-4 py-3 text-navy-600">{c.departamento ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-navy-500">
                            {c.email && <div>{c.email}</div>}
                            {c.telefone && <div>{c.telefone}</div>}
                            {!c.email && !c.telefone && '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={ESTADO_VARIANT[c.estado]} size="sm">{ESTADO_LABEL[c.estado]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-navy-500">{c.data ? new Date(c.data).toLocaleDateString('pt-AO') : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {c.estado === 'em_analise' && (
                                <>
                                  <button
                                    onClick={() => updateEstado(c.id, 'aprovado')}
                                    className="p-1.5 rounded-md text-success-600 hover:bg-success-50"
                                    title="Aprovar"
                                  ><Check className="w-4 h-4" /></button>
                                  <button
                                    onClick={() => updateEstado(c.id, 'rejeitado')}
                                    className="p-1.5 rounded-md text-error-500 hover:bg-error-50"
                                    title="Rejeitar"
                                  ><X className="w-4 h-4" /></button>
                                </>
                              )}
                              {c.estado === 'aprovado' && (
                                c.admissao_id ? (
                                  <Button variant="secondary" size="sm" onClick={() => navigate(`/admissao/${c.admissao_id}`)}>
                                    Ver admissão
                                  </Button>
                                ) : (
                                  <Button variant="secondary" size="sm" loading={abrindoAdmissao === c.id} onClick={() => iniciarAdmissao(c)}>
                                    Iniciar admissão
                                  </Button>
                                )
                              )}
                              {c.estado === 'aprovado' && !c.colaborador_id && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                                  onClick={() => setCriando(c)}
                                >
                                  Criar Colaborador
                                </Button>
                              )}
                              {c.estado === 'aprovado' && c.colaborador_id && (
                                <span className="text-xs text-success-600 px-2">Colaborador criado</span>
                              )}
                              {(c.estado === 'aprovado' || c.estado === 'rejeitado') && !c.colaborador_id && (
                                <button
                                  onClick={() => updateEstado(c.id, 'em_analise')}
                                  className="p-1.5 rounded-md text-navy-400 hover:bg-navy-50"
                                  title="Reverter para Em análise"
                                ><RotateCcw className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {criando && (
        <CriarColaboradorModal
          candidato={criando}
          onClose={() => setCriando(null)}
          onCreated={(cred) => {
            if (criando) updateCandidato(criando.id, { colaborador_id: 'created' });
            setCriando(null);
            setCredenciais(cred);
          }}
        />
      )}

      {credenciais && (
        <Dialog open onClose={() => setCredenciais(null)}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50">
              <KeyRound className="h-5 w-5 text-gold-600" />
            </div>
            <h2 className="text-lg font-semibold text-navy-800">Credenciais de acesso</h2>
          </div>
          <p className="mb-4 text-sm text-navy-500">Partilha estas credenciais com o colaborador. A password só é mostrada agora.</p>
          <div className="space-y-2 rounded-lg bg-navy-50 p-4 text-sm">
            <p><span className="text-navy-400">Email:</span> <strong className="text-navy-800">{credenciais.email}</strong></p>
            <p><span className="text-navy-400">Password:</span> <strong className="text-navy-800">{credenciais.password}</strong></p>
          </div>
          <div className="mt-6 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => setCredenciais(null)}>Fechar</Button>
            <Button variant="primary" onClick={() => { setCredenciais(null); navigate('/onboarding'); }}>
              Ir atribuir trilho
            </Button>
          </div>
        </Dialog>
      )}
    </motion.div>
  );
}

function CriarColaboradorModal({
  candidato, onClose, onCreated,
}: {
  candidato: CandidatoImportado;
  onClose: () => void;
  onCreated: (cred: Credenciais | null) => void;
}) {
  const { funcaoOptions, direccaoOptions, categoriaOptions } = useCatalogo();
  const [form, setForm] = useState({
    nome: candidato.nome,
    funcao: candidato.funcao ?? '',
    direccao: candidato.departamento ?? '',
    email: candidato.email ?? '',
    categoria: 'tecnicos',
    data_admissao: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = 'Obrigatório';
    if (!form.funcao.trim()) errs.funcao = 'Obrigatório';
    if (!form.direccao) errs.direccao = 'Obrigatório';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const { credenciais } = await colaboradoresService.create({
        nome: form.nome,
        funcao: form.funcao,
        direccao: form.direccao,
        email: form.email || undefined,
        categoria: form.categoria,
        data_admissao: form.data_admissao,
      });
      toast.success('Colaborador criado', `${form.nome} foi provisionado.`);
      onCreated(credenciais);
    } catch {
      toast.error('Erro', 'Não foi possível criar o colaborador.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">Criar Novo Colaborador</h2>
      <p className="mb-6 text-sm text-navy-400">Cria a conta de acesso e o registo do colaborador a partir do candidato aprovado.</p>
      <div className="space-y-4">
        <FormField label="Nome Completo" required error={errors.nome}>
          <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} error={errors.nome} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Função" required error={errors.funcao}>
            <Select
              options={form.funcao && !funcaoOptions.some((o) => o.value === form.funcao) ? [{ value: form.funcao, label: form.funcao }, ...funcaoOptions] : funcaoOptions}
              placeholder={funcaoOptions.length ? 'Seleccionar' : 'Sem funções — crie-as no menu'}
              value={form.funcao}
              onChange={(v) => setForm((f) => ({ ...f, funcao: v }))}
              error={errors.funcao}
            />
          </FormField>
          <FormField label="Direcção" required error={errors.direccao}>
            <Select
              options={form.direccao && !direccaoOptions.some((o) => o.value === form.direccao) ? [{ value: form.direccao, label: form.direccao }, ...direccaoOptions] : direccaoOptions}
              placeholder="Seleccionar"
              value={form.direccao}
              onChange={(v) => setForm((f) => ({ ...f, direccao: v }))}
              error={errors.direccao}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Categoria">
            <Select options={categoriaOptions} placeholder="Seleccionar" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))} />
          </FormField>
          <FormField label="Data de Admissão">
            <DateInput value={form.data_admissao} onChange={(v) => setForm((f) => ({ ...f, data_admissao: v }))} />
          </FormField>
        </div>
        <FormField label="Email (opcional)" hint={`Se vazio, é gerado a partir do nome (@${EMAIL_DOMINIO}).`}>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={saving}>Criar Colaborador</Button>
      </div>
    </Dialog>
  );
}
