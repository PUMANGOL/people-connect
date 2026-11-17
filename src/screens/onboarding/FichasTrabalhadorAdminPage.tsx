import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Pencil, Search, IdCard, CheckCircle2, Clock, CircleDashed, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { StatCard } from '@/src/components/ui/card';
import { DataTable, type Column } from '@/src/components/ui/data-table';
import { toast } from '@/src/store';
import { FichaTrabalhadorForm } from '@/src/components/ficha/FichaTrabalhadorForm';
import { fichaTrabalhadorService, errosDaResposta, type FichaAdminRow } from '@/src/services/ficha-trabalhador.service';
import {
  ESTADOS_CIVIS,
  construirWorkbookFichas,
  estadoFichaLabel,
  nomeFicheiroFichas,
  type EstadoFicha,
  type FichaTrabalhador,
  type FichaTrabalhadorDados,
} from '@/lib/ficha-trabalhador';

const ESTADO_BADGE: Record<EstadoFicha, 'success' | 'warning' | 'neutral'> = {
  submetida: 'success',
  rascunho: 'warning',
  por_preencher: 'neutral',
};

const FILTROS_ESTADO = [
  { value: 'submetida', label: 'Submetidas' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'por_preencher', label: 'Por preencher' },
];

function dataPt(v: string | null | undefined): string {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(v).toLocaleDateString('pt-PT');
}

function dataHoraPt(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function dadosDe(f: FichaTrabalhador): FichaTrabalhadorDados {
  const { colaborador_id: _c, estado: _e, submetida_em: _s, updated_at: _u, ...dados } = f;
  return dados;
}

function exportar(rows: FichaAdminRow[]) {
  const itens = rows
    .filter((r) => r.ficha.estado !== 'por_preencher')
    .map((r) => ({ ficha: r.ficha, direccao: r.colaborador.direccao }));
  if (itens.length === 0) {
    toast.warning('Nada para exportar', 'Nenhuma das fichas seleccionadas foi preenchida.');
    return;
  }
  XLSX.writeFile(construirWorkbookFichas(itens), nomeFicheiroFichas(itens));
}

interface Linha extends Record<string, unknown> {
  id: string;
  nome: string;
  funcao: string;
  estado: EstadoFicha;
  submetida_em: string;
  row: FichaAdminRow;
}

export default function FichasTrabalhadorAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<FichaAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesquisa, setPesquisa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [aVer, setAVer] = useState<FichaAdminRow | null>(null);

  function carregar() {
    return fichaTrabalhadorService
      .listar()
      .then((r) => {
        setRows(r.fichas);
        return r.fichas;
      })
      .catch(() => [] as FichaAdminRow[])
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Link das notificações: /onboarding/fichas?colaborador=<id> abre logo a ficha.
    carregar().then((fichas) => {
      const id = searchParams.get('colaborador');
      const alvo = id ? fichas.find((r) => r.colaborador.id === id) : undefined;
      if (alvo) setAVer(alvo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fecharFicha() {
    setAVer(null);
    if (searchParams.has('colaborador')) {
      searchParams.delete('colaborador');
      setSearchParams(searchParams, { replace: true });
    }
  }

  const contagem = useMemo(() => ({
    total: rows.length,
    submetida: rows.filter((r) => r.ficha.estado === 'submetida').length,
    rascunho: rows.filter((r) => r.ficha.estado === 'rascunho').length,
    por_preencher: rows.filter((r) => r.ficha.estado === 'por_preencher').length,
  }), [rows]);

  const filtradas = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroEstado && r.ficha.estado !== filtroEstado) return false;
      if (!q) return true;
      return [r.ficha.nome, r.colaborador.nome, r.colaborador.funcao, r.colaborador.direccao, r.ficha.numero_bi]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, pesquisa, filtroEstado]);

  const linhas: Linha[] = filtradas.map((r) => ({
    id: r.colaborador.id,
    nome: r.ficha.nome || r.colaborador.nome,
    funcao: r.ficha.funcao || r.colaborador.funcao || '',
    estado: r.ficha.estado,
    submetida_em: r.ficha.submetida_em ?? '',
    row: r,
  }));

  const seleccao = rows.filter((r) => seleccionados.includes(r.colaborador.id));
  const alvoAccoes = seleccao.length > 0 ? seleccao : filtradas;

  const columns: Column<Linha>[] = [
    {
      key: 'nome',
      header: 'Colaborador',
      sortable: true,
      render: (l) => (
        <button className="text-left" onClick={() => setAVer(l.row)}>
          <p className="font-medium text-navy-800 hover:underline">{l.nome}</p>
          <p className="text-xs text-navy-400">{[l.funcao, l.row.colaborador.direccao].filter(Boolean).join(' · ') || '—'}</p>
        </button>
      ),
    },
    { key: 'admissao', header: 'Admissão', render: (l) => dataPt(l.row.colaborador.data_admissao) },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (l) => <Badge variant={ESTADO_BADGE[l.estado]} size="sm" dot>{estadoFichaLabel(l.estado)}</Badge>,
    },
    { key: 'submetida_em', header: 'Submetida em', sortable: true, render: (l) => dataHoraPt(l.row.ficha.submetida_em) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Fichas do Colaborador</h1>
          <p className="mt-1 text-sm text-navy-400">
            Dados pessoais preenchidos pelos colaboradores no primeiro acesso. Exporte para Excel para partilhar com os técnicos ou importar noutros sistemas.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() => exportar(alvoAccoes)}
          disabled={loading || !alvoAccoes.some((r) => r.ficha.estado !== 'por_preencher')}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel{seleccao.length > 0 ? ` (${seleccao.length})` : ''}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<IdCard className="h-5 w-5" />} title="Colaboradores" value={contagem.total} onClick={() => setFiltroEstado('')} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} title="Submetidas" value={contagem.submetida} onClick={() => setFiltroEstado('submetida')} />
        <StatCard icon={<Clock className="h-5 w-5" />} title="Em rascunho" value={contagem.rascunho} onClick={() => setFiltroEstado('rascunho')} />
        <StatCard icon={<CircleDashed className="h-5 w-5" />} title="Por preencher" value={contagem.por_preencher} onClick={() => setFiltroEstado('por_preencher')} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input className="pl-9" placeholder="Pesquisar por nome, função, direcção ou nº do BI" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
        </div>
        <Select className="sm:w-56" options={FILTROS_ESTADO} placeholder="Todos os estados" value={filtroEstado} onChange={setFiltroEstado} />
      </div>

      <DataTable
        // Nova pesquisa/filtro limpa a selecção (a tabela guarda-a internamente).
        key={`${pesquisa}|${filtroEstado}`}
        columns={columns}
        data={linhas}
        keyField="id"
        pageSize={15}
        selectable
        onSelectionChange={setSeleccionados}
        loading={loading}
        emptyMessage="Sem colaboradores para este filtro"
        rowActions={(l) => [
          { label: 'Ver / editar ficha', onClick: () => setAVer(l.row) },
          ...(l.estado !== 'por_preencher' ? [{ label: 'Exportar Excel', onClick: () => exportar([l.row]) }] : []),
        ]}
      />

      {aVer && (
        <FichaDialog
          row={aVer}
          onClose={fecharFicha}
          onGuardada={(ficha) => {
            const actualizada = { ...aVer, ficha };
            setAVer(actualizada);
            setRows((prev) => prev.map((r) => (r.colaborador.id === ficha.colaborador_id ? actualizada : r)));
          }}
        />
      )}

    </div>
  );
}

// ===== Consulta / edição de uma ficha =====

function Campo({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : undefined}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy-800">{children || '—'}</dd>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy-100 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-600">{titulo}</h3>
      {children}
    </section>
  );
}

function FichaDialog({ row, onClose, onGuardada }: {
  row: FichaAdminRow;
  onClose: () => void;
  onGuardada: (ficha: FichaTrabalhador) => void;
}) {
  const f = row.ficha;
  const [editar, setEditar] = useState<FichaTrabalhadorDados | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aGuardar, setAGuardar] = useState(false);
  const preenchida = f.estado !== 'por_preencher';

  async function guardar() {
    if (!editar) return;
    setAGuardar(true);
    try {
      const nova = await fichaTrabalhadorService.guardar(row.colaborador.id, editar);
      toast.success('Ficha actualizada');
      onGuardada(nova);
      setEditar(null);
      setErros({});
    } catch (err) {
      const e = errosDaResposta(err);
      if (e) setErros(e);
      toast.error('Não foi possível guardar a ficha');
    } finally {
      setAGuardar(false);
    }
  }

  const estadoCivil = ESTADOS_CIVIS.find((e) => e.value === f.estado_civil)?.label ?? f.estado_civil;

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 pr-6">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">{f.nome || row.colaborador.nome}</h2>
          <p className="text-sm text-navy-400">{[f.funcao || row.colaborador.funcao, row.colaborador.direccao].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-navy-400">
            <Badge variant={ESTADO_BADGE[f.estado]} size="sm" dot>{estadoFichaLabel(f.estado)}</Badge>
            {f.submetida_em && <span>Submetida em {dataHoraPt(f.submetida_em)}</span>}
          </div>
        </div>
      </div>

      {editar ? (
        <>
          <FichaTrabalhadorForm value={editar} onChange={setEditar} erros={erros} disabled={aGuardar} />
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setEditar(null); setErros({}); }} disabled={aGuardar}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button variant="accent" onClick={guardar} loading={aGuardar}>Guardar alterações</Button>
          </div>
        </>
      ) : !preenchida ? (
        <div className="rounded-xl border border-dashed border-navy-200 p-8 text-center text-sm text-navy-500">
          O colaborador ainda não preencheu a ficha. É-lhe pedida no primeiro acesso à plataforma (Welcome Flow).
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setEditar(dadosDe(f))}>
              <Pencil className="h-4 w-4" /> Preencher em nome do colaborador
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Bloco titulo="Informação pessoal">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome" span>{f.nome}</Campo>
              <Campo label="Data de início">{dataPt(f.data_inicio)}</Campo>
              <Campo label="Número do BI">{f.numero_bi}</Campo>
              <Campo label="Função">{f.funcao}</Campo>
              <Campo label="Sexo">{f.sexo === 'M' ? 'Masculino' : f.sexo === 'F' ? 'Feminino' : ''}</Campo>
              <Campo label="Data de nascimento">{dataPt(f.data_nascimento)}</Campo>
              <Campo label="Local de nascimento">{f.local_nascimento}</Campo>
              <Campo label="Estado civil">{estadoCivil}</Campo>
              <Campo label="Província">{f.provincia}</Campo>
              <Campo label="Morada" span>{f.morada}</Campo>
              <Campo label="Telemóvel">{f.telemovel}</Campo>
              <Campo label="Telefone alternativo">{f.telefone}</Campo>
              <Campo label="Email" span>{f.email}</Campo>
            </dl>
          </Bloco>

          {f.conjuge && (
            <Bloco titulo="Cônjuge">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Campo label="Nome" span>{f.conjuge.nome}</Campo>
                <Campo label="Data de nascimento">{dataPt(f.conjuge.data_nascimento)}</Campo>
                <Campo label="Local de nascimento">{f.conjuge.local_nascimento}</Campo>
                <Campo label="Endereço">{f.conjuge.endereco}</Campo>
                <Campo label="Província">{f.conjuge.provincia}</Campo>
                <Campo label="Telemóvel">{f.conjuge.telemovel}</Campo>
                <Campo label="Telefone alternativo">{f.conjuge.telefone}</Campo>
              </dl>
            </Bloco>
          )}

          <Bloco titulo={`Filhos (${f.filhos.length})`}>
            {f.filhos.length === 0 ? (
              <p className="text-sm text-navy-400">Sem filhos registados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-navy-400">
                    <th className="pb-2 font-medium">Nº</th>
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Data de nascimento</th>
                    <th className="pb-2 font-medium">Telefone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {f.filhos.map((filho, i) => (
                    <tr key={i}>
                      <td className="py-2 text-navy-400">{i + 1}º</td>
                      <td className="py-2 text-navy-800">{filho.nome}</td>
                      <td className="py-2">{dataPt(filho.data_nascimento)}</td>
                      <td className="py-2">{filho.telefone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Bloco>

          <Bloco titulo="Contactos em caso de emergência">
            <div className="grid gap-4 sm:grid-cols-2">
              {f.contactos_emergencia.filter((c) => c.nome || c.telefones).map((c, i) => (
                <dl key={i} className="space-y-2 rounded-lg bg-navy-50/50 p-3">
                  <Campo label={`Contacto ${i + 1}`}>{c.nome}{c.parentesco ? ` (${c.parentesco})` : ''}</Campo>
                  <Campo label="Endereço">{c.endereco}</Campo>
                  <Campo label="Telefones">{c.telefones}</Campo>
                  <Campo label="Email">{c.email}</Campo>
                </dl>
              ))}
            </div>
          </Bloco>
        </div>
      )}

      {!editar && preenchida && (
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setEditar(dadosDe(f))}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="accent" onClick={() => exportar([{ ...row, ficha: f }])}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      )}
    </Dialog>
  );
}
