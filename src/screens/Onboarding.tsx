import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, UserCheck, AlertTriangle, TrendingUp, Plus, Route as RouteIcon, Trash2 } from 'lucide-react';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { Button } from '@/src/components/ui/button';
import { Input, Select, FormField } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { Badge, ProgressBar, Avatar } from '@/src/components/ui/badge';
import { StatCard, EmptyState } from '@/src/components/ui/card';
import { Dialog, ConfirmDialog } from '@/src/components/ui/dialog';
import { toast } from '@/src/store';
import { EMAIL_DOMINIO, ESTADO_ONBOARDING_CONFIG } from '@/lib/constants';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import { somarDias } from '@/src/lib/datas';
import type { Colaborador } from '@/lib/types';
import { colaboradoresService, trilhosService, type Trilho, type Credenciais } from '@/src/services/onboarding-v2.service';
import { mentorsService } from '@/src/services/mentoria.service';
import { MentorFichaCampos } from '@/src/components/MentorFichaCampos';
import { CredenciaisDialog } from '@/src/components/shared/CredenciaisDialog';
import { SearchableSelect } from '@/src/components/ui/searchable-select';
import { tempoExperiencia } from '@/src/lib/tempo-experiencia';
import type { Mentor } from '@/lib/types';
import { ITENS_POR_PAGINA, Paginacao, juntarOpcoes } from '@/src/components/ui/paginacao';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';

const ESTADO_OPTIONS = Object.entries(ESTADO_ONBOARDING_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

type LinhaColaborador = Colaborador & { categoria: string | null; etapas_atrasadas?: number };
type ResumoLista = { em_onboarding: number; concluidos: number; progresso_medio: number; atrasados: number };
type OpcoesLista = { funcoes: string[]; direccoes: string[]; categorias: string[] };
type VistaLista = {
  chave: string;
  colaboradores: LinhaColaborador[];
  total: number;
  resumo: ResumoLista;
  opcoesLista: OpcoesLista;
};

/** Última lista já mostrada. O cache do Next não evita o pedido HTTP; isto evita o skeleton ao voltar. */
let vistaLista: VistaLista | null = null;

function chaveLista(pagina: number, q: string, filters: { direccao: string; funcao: string; categoria: string; estado: string }) {
  return JSON.stringify({ pagina, q, ...filters });
}

function getStatusIndicator(emAtraso: boolean, progresso: number): { color: string } {
  if (progresso >= 100) return { color: 'text-success-500' };
  if (emAtraso) return { color: 'text-error-500' };
  return { color: 'text-navy-400' };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { direccaoOptions, funcaoOptions, categoriaOptions } = useCatalogo();
  const [filters, setFilters] = useState({ direccao: '', funcao: '', categoria: '', estado: '' });
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(0);
  const vistaInicial = vistaLista?.chave === chaveLista(0, '', { direccao: '', funcao: '', categoria: '', estado: '' }) ? vistaLista : null;
  const [colaboradores, setColaboradores] = useState<LinhaColaborador[]>(vistaInicial?.colaboradores ?? []);
  const [loading, setLoading] = useState(!vistaInicial);
  const [total, setTotal] = useState(vistaInicial?.total ?? 0);
  const [resumo, setResumo] = useState<ResumoLista>(vistaInicial?.resumo ?? { em_onboarding: 0, concluidos: 0, progresso_medio: 0, atrasados: 0 });
  const [opcoesLista, setOpcoesLista] = useState<OpcoesLista>(vistaInicial?.opcoesLista ?? { funcoes: [], direccoes: [], categorias: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [atribuir, setAtribuir] = useState<Colaborador | null>(null);
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);
  const [aRemover, setARemover] = useState<{ id: string; nome: string } | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const proximo = search.trim();
      setQ((actual) => {
        if (actual === proximo) return actual;
        setPagina(0);
        return proximo;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const carregar = useCallback(() => {
    let activo = true;
    const chave = chaveLista(pagina, q, filters);
    if (vistaLista?.chave !== chave) setLoading(true);
    colaboradoresService
      .listar({
        pagina,
        tamanho: ITENS_POR_PAGINA,
        q,
        direccao: filters.direccao,
        funcao: filters.funcao,
        categoria: filters.categoria,
        estado: filters.estado,
      }, true)
      .then((pag) => {
        if (!activo) return;
        if (pag.items.length === 0 && pag.total > 0 && pagina > 0) {
          setPagina(pagina - 1);
          return;
        }
        const linhas = pag.items.map((r) => {
          const etapas = Number(r.etapas_total) || 0;
          const feitas = Number(r.etapas_concluidas) || 0;
          return {
            id: r.id,
            candidato_id_origem: null,
            nome: r.nome,
            funcao: r.funcao,
            direccao: r.direccao,
            categoria: r.categoria,
            data_admissao: r.data_admissao,
            estado_onboarding: r.estado_onboarding as Colaborador['estado_onboarding'],
            link_token: '',
            created_at: r.data_admissao,
            updated_at: r.data_admissao,
            progresso_pct: etapas > 0 ? Math.round((feitas / etapas) * 100) : 0,
            etapas_atrasadas: Number(r.etapas_atrasadas) || 0,
          };
        });
        const opcoes = {
          funcoes: pag.resumo.funcoes ?? [],
          direccoes: pag.resumo.direccoes ?? [],
          categorias: pag.resumo.categorias ?? [],
        };
        vistaLista = { chave, colaboradores: linhas, total: pag.total, resumo: pag.resumo, opcoesLista: opcoes };
        setTotal(pag.total);
        setResumo(pag.resumo);
        setOpcoesLista(opcoes);
        setColaboradores(linhas);
      })
      .catch(() => {
        if (!activo || vistaLista?.chave === chave) return;
        setColaboradores([]);
        setTotal(0);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => { activo = false; };
  }, [pagina, q, filters]);

  useEffect(() => {
    const cancelar = carregar();
    return cancelar;
  }, [carregar]);

  async function remover() {
    if (!aRemover) return;
    setRemovendo(true);
    try {
      await colaboradoresService.remove(aRemover.id);
      toast.success('Colaborador removido');
      setARemover(null);
      carregar();
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setRemovendo(false);
    }
  }

  const opcoesFuncao = useMemo(() => juntarOpcoes(funcaoOptions, opcoesLista.funcoes), [funcaoOptions, opcoesLista.funcoes]);
  const opcoesDireccao = useMemo(() => juntarOpcoes(direccaoOptions, opcoesLista.direccoes), [direccaoOptions, opcoesLista.direccoes]);
  const opcoesCategoria = useMemo(() => juntarOpcoes(categoriaOptions, opcoesLista.categorias), [categoriaOptions, opcoesLista.categorias]);
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const haFiltros = Boolean(q || filters.direccao || filters.funcao || filters.categoria || filters.estado);

  function filtrar(parcial: Partial<typeof filters>) {
    setFilters((actual) => ({ ...actual, ...parcial }));
    setPagina(0);
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Novos Colaboradores</h1>
          <p className="mt-1 text-sm text-navy-400">Gestão e acompanhamento da integração</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
          Novo Colaborador
        </Button>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-info-50 text-info-600"
          title="Em Onboarding"
          value={resumo.em_onboarding}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          iconBg="bg-success-50 text-success-600"
          title="Concluídos"
          value={resumo.concluidos}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-gold-50 text-gold-700"
          title="Progresso Médio"
          value={`${resumo.progresso_medio}%`}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="bg-error-50 text-error-500"
          title="Atrasados"
          value={resumo.atrasados}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input placeholder="Pesquisar colaborador..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select options={opcoesFuncao} placeholder="Todas as funções" value={filters.funcao} onChange={(v) => filtrar({ funcao: v })} className="w-full sm:w-44" />
        <Select options={opcoesDireccao} placeholder="Todas as direcções" value={filters.direccao} onChange={(v) => filtrar({ direccao: v })} className="w-full sm:w-48" />
        <Select options={opcoesCategoria} placeholder="Todas as categorias" value={filters.categoria} onChange={(v) => filtrar({ categoria: v })} className="w-full sm:w-44" />
        <Select options={ESTADO_OPTIONS} placeholder="Todos os estados" value={filters.estado} onChange={(v) => filtrar({ estado: v })} className="w-full sm:w-44" />
      </motion.div>

      <motion.div variants={staggerItem}>
        {loading ? (
          <SkeletonList rows={5} cols={5} />
        ) : total === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-8 w-8" />}
            title={haFiltros ? 'Sem resultados' : 'Sem colaboradores'}
            description={haFiltros ? 'Ajuste os filtros para ver outros colaboradores.' : 'Cria um colaborador ou aprova um candidato no Recrutamento.'}
            action={haFiltros ? undefined : { label: 'Novo Colaborador', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="space-y-3">
            {colaboradores.map((col) => {
              const progresso = col.progresso_pct ?? 0;
              const status = getStatusIndicator((col.etapas_atrasadas ?? 0) > 0, progresso);
              const estadoConfig = ESTADO_ONBOARDING_CONFIG[col.estado_onboarding];
              return (
                <div key={col.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4 transition hover:shadow-card">
                  <button onClick={() => navigate(`/onboarding/colaborador/${col.id}`)} className="flex flex-1 items-center gap-3 text-left">
                    <Avatar name={col.nome} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-navy-800">{col.nome}</p>
                      <p className="truncate text-xs text-navy-400">{col.funcao} — {col.direccao}</p>
                    </div>
                  </button>
                  <div className="hidden w-32 sm:block">
                    <ProgressBar value={progresso} size="sm" />
                    <p className={`mt-1 text-xs ${status.color}`}>{progresso}% concluído</p>
                  </div>
                  <Badge variant={estadoConfig.variant} size="sm">{estadoConfig.label}</Badge>
                  <button onClick={() => setAtribuir(col)} title="Atribuir trilho" className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
                    <RouteIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => setARemover({ id: col.id, nome: col.nome })} title="Remover" className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <Paginacao
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={total}
              onChange={setPagina}
            />
          </div>
        )}
      </motion.div>

      {showCreate && (
        <CreateColaboradorModal
          onClose={() => setShowCreate(false)}
          onCreated={(cred) => { setShowCreate(false); setCredenciais(cred); carregar(); }}
        />
      )}
      {atribuir && (
        <AtribuirTrilhoModal colaborador={atribuir} onClose={() => setAtribuir(null)} onDone={() => { setAtribuir(null); carregar(); }} />
      )}
      {credenciais && (
        <CredenciaisDialog
          titulo="Credenciais de acesso"
          descricao="Partilha estas credenciais com o colaborador. A password só é mostrada agora."
          credenciais={credenciais}
          onClose={() => setCredenciais(null)}
        />
      )}
      <ConfirmDialog
        open={aRemover !== null}
        onClose={() => !removendo && setARemover(null)}
        onConfirm={remover}
        title="Remover colaborador"
        description={`Remover o colaborador "${aRemover?.nome ?? ''}"? Esta acção é irreversível: o progresso, as avaliações e a ficha do trabalhador são apagados.`}
        confirmLabel="Remover"
        destructive
        loading={removendo}
      />
    </motion.div>
  );
}

function CreateColaboradorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (cred: Credenciais | null) => void }) {
  const { funcaoOptions, direccaoOptions, categoriaOptions } = useCatalogo();
  const [form, setForm] = useState({ nome: '', funcao: '', direccao: '', categoria: 'tecnicos', data_admissao: new Date().toISOString().slice(0, 10), email: '', mentor_id: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mentores, setMentores] = useState<Mentor[]>([]);
  const [loadingMentores, setLoadingMentores] = useState(true);

  useEffect(() => {
    mentorsService.list(true)
      .then((rows) => setMentores(rows.filter((m) => m.activo && m.nome)))
      .catch(() => setMentores([]))
      .finally(() => setLoadingMentores(false));
  }, []);

  const mentorEscolhido = mentores.find((m) => m.id === form.mentor_id);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = 'Obrigatório';
    if (!form.funcao.trim()) errs.funcao = 'Obrigatório';
    if (!form.direccao) errs.direccao = 'Obrigatório';
    if (!form.mentor_id) errs.mentor_id = 'Obrigatório — a mentoria é parte do processo Pumangol';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const { credenciais } = await colaboradoresService.create({
        nome: form.nome, funcao: form.funcao, direccao: form.direccao,
        data_admissao: form.data_admissao, categoria: form.categoria, email: form.email || undefined,
        mentor_id: form.mentor_id,
      });
      toast.success('Colaborador criado', 'Mentor atribuído em simultâneo.');
      onCreated(credenciais);
    } catch {
      toast.error('Erro ao criar colaborador');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">Novo Colaborador</h2>
      <p className="mb-6 text-sm text-navy-400">Cria o registo, a conta de acesso e atribui o mentor.</p>
      <div className="space-y-4">
        <FormField label="Nome Completo" required error={errors.nome}>
          <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} error={errors.nome} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Função" required error={errors.funcao}>
            <Select
              options={funcaoOptions}
              placeholder={funcaoOptions.length ? 'Seleccionar' : 'Sem funções — crie-as no menu'}
              value={form.funcao}
              onChange={(v) => setForm((f) => ({ ...f, funcao: v }))}
              error={errors.funcao}
            />
          </FormField>
          <FormField label="Direcção" required error={errors.direccao}>
            <Select options={direccaoOptions} placeholder="Seleccionar" value={form.direccao} onChange={(v) => setForm((f) => ({ ...f, direccao: v }))} error={errors.direccao} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Categoria">
            <Select
              options={categoriaOptions}
              placeholder="Seleccionar"
              value={form.categoria}
              onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            />
          </FormField>
          <FormField label="Data de Admissão">
            <DateInput value={form.data_admissao} onChange={(v) => setForm((f) => ({ ...f, data_admissao: v }))} />
          </FormField>
        </div>

        <FormField
          label="Mentor"
          required
          error={errors.mentor_id}
          hint={
            loadingMentores
              ? 'A carregar mentores...'
              : mentores.length === 0
                ? 'Ainda não há nomes na tabela de mentores.'
                : undefined
          }
        >
          <SearchableSelect
            options={mentores.map((m) => ({
              value: m.id,
              label: m.nome,
              hint: tempoExperiencia(m.data_inicio_contrato) ?? undefined,
            }))}
            placeholder={loadingMentores ? 'A carregar...' : 'Seleccionar mentor'}
            searchPlaceholder="Pesquisar nome..."
            value={form.mentor_id}
            onChange={(v) => setForm((f) => ({ ...f, mentor_id: v }))}
            error={errors.mentor_id}
            disabled={loadingMentores || mentores.length === 0}
          />
        </FormField>
        {mentorEscolhido && (
          <MentorFichaCampos
            email={mentorEscolhido.email}
            departamento={mentorEscolhido.departamento}
            funcao={mentorEscolhido.funcao}
            dataInicioContrato={mentorEscolhido.data_inicio_contrato}
          />
        )}

        <FormField label="Email (opcional)" hint={`Se vazio, é gerado a partir do nome (@${EMAIL_DOMINIO})`}>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder={`nome.apelido@${EMAIL_DOMINIO}`} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={saving}>Criar</Button>
      </div>
    </Dialog>
  );
}

function AtribuirTrilhoModal({ colaborador, onClose, onDone }: { colaborador: Colaborador; onClose: () => void; onDone: () => void }) {
  const [trilhos, setTrilhos] = useState<Trilho[]>([]);
  const [trilhoId, setTrilhoId] = useState('');
  const [datas, setDatas] = useState<Array<{ ordem: number; nome: string; data_inicio: string; data_fim: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    trilhosService.list().then(setTrilhos).catch(() => setTrilhos([]));
  }, []);

  useEffect(() => {
    const trilho = trilhos.find((t) => t.id === trilhoId);
    const etapas = [...(trilho?.etapas ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    let cursor = (colaborador.data_admissao || new Date().toISOString()).slice(0, 10);
    setDatas(etapas.map((etapa, i) => {
      const inicio = cursor;
      const dias = Math.max(1, Number(etapa.duracao_dias) || 1);
      const fim = somarDias(inicio, dias - 1);
      cursor = somarDias(fim, 1);
      return { ordem: etapa.ordem ?? i + 1, nome: etapa.nome, data_inicio: inicio, data_fim: fim };
    }));
  }, [trilhoId, trilhos, colaborador.data_admissao]);

  function setData(idx: number, campo: 'data_inicio' | 'data_fim', valor: string) {
    setDatas((prev) => prev.map((linha, i) => (i === idx ? { ...linha, [campo]: valor } : linha)));
  }

  async function submit() {
    if (!trilhoId) return toast.error('Seleccione um trilho');
    if (datas.some((d) => !d.data_inicio || !d.data_fim)) return toast.error('Indique início e fim de cada etapa');
    if (datas.some((d) => d.data_fim < d.data_inicio)) return toast.error('O fim de cada etapa tem de ser igual ou posterior ao início');
    setSaving(true);
    try {
      await colaboradoresService.atribuirTrilho(
        colaborador.id,
        trilhoId,
        datas.map((d) => ({ ordem: d.ordem, data_inicio: d.data_inicio, data_fim: d.data_fim })),
      );
      toast.success('Trilho atribuído', `${colaborador.nome} passou a ter o trilho no "Meu Trilho".`);
      onDone();
    } catch {
      toast.error('Erro ao atribuir trilho');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">Atribuir Trilho</h2>
      <p className="mb-6 text-sm text-navy-400">Selecciona um trilho para <strong>{colaborador.nome}</strong> e define o início e o fim de cada etapa. O mentor pode alterar estas datas depois.</p>
      <Select
        options={trilhos.map((t) => ({ value: t.id, label: `${t.nome} (${t.num_etapas ?? t.etapas?.length ?? 0} etapas)` }))}
        placeholder={trilhos.length ? 'Seleccionar trilho' : 'Sem trilhos disponíveis'}
        value={trilhoId}
        onChange={setTrilhoId}
      />
      {datas.length > 0 && (
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {datas.map((linha, idx) => (
            <div key={`${linha.ordem}-${idx}`} className="rounded-lg border border-navy-100 p-3">
              <p className="mb-2 text-sm font-medium text-navy-800">{idx + 1}. {linha.nome}</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Início">
                  <DateInput value={linha.data_inicio} onChange={(v) => setData(idx, 'data_inicio', v)} />
                </FormField>
                <FormField label="Fim">
                  <DateInput value={linha.data_fim} onChange={(v) => setData(idx, 'data_fim', v)} />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="accent" onClick={submit} loading={saving} disabled={!trilhoId || datas.length === 0}>Atribuir</Button>
      </div>
    </Dialog>
  );
}
