import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Users, ShieldAlert, ShieldCheck, ShieldOff, User, GraduationCap, UserCheck, Filter, UserCog } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { ConfirmDialog, Dialog } from '@/src/components/ui/dialog';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { toast } from '@/src/store/ui.store';
import { utilizadoresService, type OperacaoPapel, type UtilizadorRow } from '@/src/services/utilizadores.service';
import { useAuthStore } from '@/src/store/auth.store';
import { Paginacao, paginar } from '@/src/components/ui/paginacao';

const POR_PAGINA = 20;

const PERFIL_OPTIONS = [
  { value: 'rh_admin', label: 'Administrador DPC' },
  { value: 'mentor', label: 'Colaborador' },
  { value: 'novo_colaborador', label: 'Mentorado' },
];

const OPERACOES: { id: OperacaoPapel; label: string; descricao: string }[] = [
  {
    id: 'remover_mentor',
    label: 'Remover como mentor',
    descricao: 'Deixa de ver o portal de mentor. As atribuições activas terminam e a pessoa mantém a conta.',
  },
  {
    id: 'remover_mentorado',
    label: 'Remover como mentorado',
    descricao: 'Termina o mentor atribuído. A pessoa continua no grupo dos novos até passar a colaborador.',
  },
  {
    id: 'mentorado_para_colaborador',
    label: 'Passar a colaborador',
    descricao: 'Sai do grupo Mentorados e passa para Colaboradores. Deixa de estar em acompanhamento.',
  },
  {
    id: 'colaborador_para_mentor',
    label: 'Passar a mentor',
    descricao: 'Entra no grupo Mentores e passa a ver o portal, além do acesso de colaborador.',
  },
  {
    id: 'mentor_para_colaborador',
    label: 'Passar a colaborador simples',
    descricao: 'Sai do grupo Mentores, as atribuições terminam e fica só como colaborador.',
  },
];

function rotuloPerfil(perfil: string): string {
  if (perfil === 'rh_admin') return 'administrador';
  if (perfil === 'novo_colaborador') return 'mentorado';
  return 'colaborador';
}

function ligado(valor: unknown): boolean {
  return valor === true || valor === 't' || valor === 'true' || valor === 1;
}

function eMentor(pessoa: UtilizadorRow): boolean {
  return ligado(pessoa.no_grupo_mentores) || Number(pessoa.mentorados_activos) > 0;
}

function operacoesDe(pessoa: UtilizadorRow): OperacaoPapel[] {
  const mentor = eMentor(pessoa);
  const mentorado = pessoa.perfil === 'novo_colaborador';
  const ids: OperacaoPapel[] = [];
  if (mentor) ids.push('remover_mentor', 'mentor_para_colaborador');
  if (mentorado && ligado(pessoa.tem_mentor)) ids.push('remover_mentorado');
  if (mentorado) ids.push('mentorado_para_colaborador');
  if (!mentor && !mentorado) ids.push('colaborador_para_mentor');
  return ids;
}

export default function UtilizadoresPage() {
  const { user: currentUser } = useAuthStore();
  const [rows, setRows] = useState<UtilizadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [fPerfil, setFPerfil] = useState('');
  const [pagina, setPagina] = useState(0);
  const [toRemove, setToRemove] = useState<UtilizadorRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toToggleAdmin, setToToggleAdmin] = useState<UtilizadorRow | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState(false);
  const [papelDe, setPapelDe] = useState<UtilizadorRow | null>(null);
  const [operacao, setOperacao] = useState<OperacaoPapel | null>(null);
  const [aMudarPapel, setAMudarPapel] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const data = await utilizadoresService.list();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fPerfil && r.perfil !== fPerfil) return false;
      if (!q) return true;
      return (
        r.nome.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.departamento ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, busca, fPerfil]);
  const paginaLista = paginar(filtrados, pagina, POR_PAGINA);

  useEffect(() => { setPagina(0); }, [busca, fPerfil]);

  async function handleRemove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await utilizadoresService.remove(toRemove.id);
      toast.success('Utilizador eliminado', `${toRemove.nome} foi removido em cascata.`);
      setToRemove(null);
      carregar();
    } catch (err) {
      // Lê tanto {error} como {message} — o backend usa ambos.
      const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      const msg = resp?.data?.error ?? resp?.data?.message ?? null;
      toast.error(
        'Não foi possível eliminar',
        msg ?? 'Verifica as migrações 018, 019 e 020 no Neon (FK cascades).',
      );
      // Mantém a modal aberta para o utilizador ler a mensagem
    } finally {
      setRemoving(false);
    }
  }

  async function handleToggleAdmin() {
    if (!toToggleAdmin) return;
    const promover = toToggleAdmin.perfil !== 'rh_admin';
    setTogglingAdmin(true);
    try {
      const res = await utilizadoresService.setAdmin(toToggleAdmin.id, promover);
      setRows((prev) => prev.map((r) => (r.id === res.id ? { ...r, perfil: res.perfil } : r)));
      toast.success(
        promover ? 'Promovido a administrador' : 'Administrador removido',
        promover
          ? `${toToggleAdmin.nome} tem agora acesso total à plataforma.`
          : `${toToggleAdmin.nome} passou a ${rotuloPerfil(res.perfil)}.`,
      );
      setToToggleAdmin(null);
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      toast.error('Não foi possível alterar o perfil', resp?.data?.error ?? resp?.data?.message ?? 'Tenta novamente.');
    } finally {
      setTogglingAdmin(false);
    }
  }

  async function handlePapel() {
    if (!papelDe || !operacao) return;
    setAMudarPapel(true);
    try {
      await utilizadoresService.papel(papelDe.id, operacao);
      const texto = OPERACOES.find((item) => item.id === operacao)?.label ?? 'Papel actualizado';
      toast.success(texto, papelDe.nome);
      setOperacao(null);
      setPapelDe(null);
      carregar();
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
      toast.error('Não foi possível alterar o papel', resp?.data?.error ?? resp?.data?.message ?? 'Tenta novamente.');
    } finally {
      setAMudarPapel(false);
    }
  }

  const kpis = {
    total: rows.length,
    admins: rows.filter((r) => r.perfil === 'rh_admin').length,
    mentores: rows.filter((r) => eMentor(r)).length,
    colaboradores: rows.filter((r) => r.perfil === 'mentor').length,
    mentorados: rows.filter((r) => r.perfil === 'novo_colaborador').length,
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-neutral-900">Utilizadores</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Gestão administrativa das contas da plataforma. O ícone ao lado do escudo muda o papel
          (mentor, mentorado ou colaborador). Eliminar uma conta remove também o colaborador,
          o progresso, o feedback e as avaliações.
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile icon={<Users className="h-4 w-4" />} label="Total" value={kpis.total} />
        <KpiTile icon={<ShieldAlert className="h-4 w-4" />} label="Admins" value={kpis.admins} />
        <KpiTile icon={<GraduationCap className="h-4 w-4" />} label="Mentores" value={kpis.mentores} />
        <KpiTile icon={<UserCheck className="h-4 w-4" />} label="Colaboradores" value={kpis.colaboradores} />
        <KpiTile icon={<User className="h-4 w-4" />} label="Mentorados" value={kpis.mentorados} />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Filter className="h-4 w-4 text-neutral-400" />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome, email ou direcção..."
            className="pl-9"
          />
        </div>
        <Select
          options={PERFIL_OPTIONS}
          value={fPerfil}
          onChange={setFPerfil}
          placeholder="Todos os perfis"
          className="sm:w-52"
        />
        {(fPerfil || busca) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFPerfil(''); setBusca(''); }}
          >
            Limpar
          </Button>
        )}
        <span className="ml-auto text-xs text-neutral-500">
          {filtrados.length} de {rows.length}
        </span>
      </motion.div>

      {loading ? (
        <SkeletonList rows={6} cols={4} />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={<User className="h-8 w-8" />}
          title={rows.length === 0 ? 'Sem utilizadores' : 'Sem resultados'}
          description={
            rows.length === 0
              ? 'Ainda não há utilizadores registados na plataforma.'
              : 'Ajusta a pesquisa ou o filtro de perfil.'
          }
        />
      ) : (
        <motion.div variants={staggerItem} className="space-y-2">
          {paginaLista.visiveis.map((r) => {
            const isSelf = currentUser?.id === r.id;
            const mentor = eMentor(r);
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <Avatar name={r.nome} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-neutral-900">
                      {r.nome}
                    </p>
                    {isSelf && (
                      <Badge variant="warning" size="sm">Tu</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    {r.email} · {r.departamento || 'sem direcção'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {r.perfil === 'rh_admin' && (
                      <Badge variant="accent" size="sm"><ShieldAlert className="h-3 w-3" /> Admin DPC</Badge>
                    )}
                    {r.perfil === 'novo_colaborador' ? (
                      <Badge variant="neutral" size="sm"><User className="h-3 w-3" /> Mentorado</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm"><UserCheck className="h-3 w-3" /> Colaborador</Badge>
                    )}
                    {mentor && (
                      <Badge variant="info" size="sm"><GraduationCap className="h-3 w-3" /> Mentor</Badge>
                    )}
                    {ligado(r.tem_mentor) && (
                      <Badge variant="neutral" size="sm">Com mentor</Badge>
                    )}
                    <Badge variant={r.estado === 'activo' ? 'success' : 'neutral'} size="sm">
                      {r.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => { setPapelDe(r); setOperacao(null); }}
                  title="Mudar papel"
                  className="rounded-md p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                >
                  <UserCog className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setToToggleAdmin(r)}
                  disabled={isSelf}
                  title={
                    isSelf
                      ? 'Não podes alterar o teu próprio perfil'
                      : r.perfil === 'rh_admin' ? 'Retirar administrador' : 'Promover a administrador'
                  }
                  className="rounded-md p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  {r.perfil === 'rh_admin' ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setToRemove(r)}
                  disabled={isSelf}
                  title={isSelf ? 'Não podes eliminar a tua própria conta' : 'Eliminar utilizador'}
                  className="rounded-md p-2 text-brand-red-500 hover:bg-brand-red-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <Paginacao
            pagina={paginaLista.actual}
            totalPaginas={paginaLista.totalPaginas}
            total={paginaLista.total}
            tamanho={POR_PAGINA}
            onChange={setPagina}
          />
        </motion.div>
      )}

      <ConfirmDialog
        open={!!toToggleAdmin}
        onClose={() => setToToggleAdmin(null)}
        onConfirm={handleToggleAdmin}
        title={toToggleAdmin?.perfil === 'rh_admin' ? 'Retirar administrador?' : 'Promover a administrador?'}
        description={
          !toToggleAdmin
            ? ''
            : toToggleAdmin.perfil === 'rh_admin'
              ? `${toToggleAdmin.nome} perde o acesso de administrador. O papel de mentor ou de colaborador mantém-se.`
              : `${toToggleAdmin.nome} passa a ter acesso total à plataforma.${toToggleAdmin.is_mentor_activo > 0 ? ' Continua a ver e acompanhar os seus mentorados em «A Minha Mentoria».' : ''}`
        }
        confirmLabel={toToggleAdmin?.perfil === 'rh_admin' ? 'Sim, retirar' : 'Sim, promover'}
        destructive={toToggleAdmin?.perfil === 'rh_admin'}
        loading={togglingAdmin}
      />

      <Dialog open={!!papelDe} onClose={() => { if (!aMudarPapel) { setPapelDe(null); setOperacao(null); } }} className="max-w-lg">
        <h2 className="text-lg font-semibold text-foreground">Papel de {papelDe?.nome}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolhe o que muda. A conta e o histórico mantêm-se.
        </p>
        <div className="mt-4 space-y-2">
          {papelDe && operacoesDe(papelDe).map((id) => {
            const item = OPERACOES.find((op) => op.id === id);
            if (!item) return null;
            const escolhida = operacao === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setOperacao(id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${escolhida ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
              >
                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.descricao}</span>
              </button>
            );
          })}
          {papelDe && operacoesDe(papelDe).length === 0 && (
            <p className="text-sm text-muted-foreground">Não há mudanças de papel para esta conta.</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => { setPapelDe(null); setOperacao(null); }} disabled={aMudarPapel}>Cancelar</Button>
          <Button onClick={handlePapel} loading={aMudarPapel} disabled={!operacao}>Confirmar</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={handleRemove}
        title="Eliminar utilizador?"
        description={
          toRemove
            ? `Vais eliminar ${toRemove.nome} (${toRemove.email}). Esta acção é irreversível — o colaborador associado (se existir), progresso, submissões, feedbacks e avaliações são também eliminados em cascata. As entradas de auditoria e timeline mantêm-se com autor NULL.`
            : ''
        }
        confirmLabel="Sim, eliminar em cascata"
        destructive
        loading={removing}
      />
    </motion.div>
  );
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <span className="text-neutral-400">{icon}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">{value}</p>
    </div>
  );
}
