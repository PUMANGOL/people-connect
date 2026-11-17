import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Textarea } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { ConfirmDialog, Dialog } from '@/src/components/ui/dialog';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { apiClient } from '@/src/services/api.client';
import {
  acessosService,
  type AcessoPainel,
  type PainelAcessos,
} from '@/src/services/acessos.service';
import { useAuthStore } from '@/src/store/auth.store';
import { toast } from '@/src/store/ui.store';
import type { AuthUser } from '@/lib/types';
import { cn } from '@/lib/utils';

const PERFIL: Record<string, string> = {
  rh_admin: 'Admin DPC',
  mentor: 'Mentor',
  novo_colaborador: 'Colaborador',
};

function mensagem(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
  return data?.error ?? data?.message ?? fallback;
}

export default function AcessosPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [painel, setPainel] = useState<PainelAcessos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [membros, setMembros] = useState<string[]>([]);
  const [paginasIds, setPaginasIds] = useState<string[]>([]);
  const [aGravar, setAGravar] = useState(false);
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [buscaPagina, setBuscaPagina] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [aCriar, setACriar] = useState(false);
  const [aApagar, setAApagar] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [aEntrar, setAEntrar] = useState(false);

  function preencher(origem: PainelAcessos, id: string | null) {
    const escolhido = id && origem.grupos.some((g) => g.id === id)
      ? id
      : origem.grupos.find((g) => g.chave === 'dev')?.id ?? origem.grupos[0]?.id ?? null;
    const grupo = origem.grupos.find((g) => g.id === escolhido);
    setPainel(origem);
    setGrupoId(escolhido);
    setNome(grupo?.nome ?? '');
    setDescricao(grupo?.descricao ?? '');
    setMembros(grupo?.membros.map((m) => m.id) ?? []);
    setPaginasIds(grupo?.acesso_ids ?? []);
  }

  async function refrescarMenu() {
    try {
      const res = await apiClient.get<{ data: AuthUser }>('/sessao', { silencioso: true, semAviso: true });
      const eu = useAuthStore.getState().user;
      if (!eu) return;
      const atual = { ...eu, ...res.data.data };
      setUser(atual);
      if (!atual.is_dev) navigate('/inicio', { replace: true });
    } catch {
      // O menu actualiza na próxima sessão.
    }
  }

  useEffect(() => {
    let activo = true;
    acessosService.painel()
      .then((data) => { if (activo) preencher(data, null); })
      .catch((err) => { if (activo) setErro(mensagem(err, 'Não foi possível carregar os acessos.')); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  const grupo = painel?.grupos.find((g) => g.id === grupoId) ?? null;
  const mesmoConjunto = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);
  const dirty = !!grupo && (
    nome !== grupo.nome
    || descricao !== (grupo.descricao ?? '')
    || !mesmoConjunto(membros, grupo.membros.map((m) => m.id))
    || !mesmoConjunto(paginasIds, grupo.acesso_ids)
  );
  const euNoDev = painel?.grupos.some((g) => g.chave === 'dev' && g.membros.some((m) => m.id === painel.eu_id)) ?? false;
  const devVazio = (painel?.grupos.find((g) => g.chave === 'dev')?.membros.length ?? 0) === 0;

  const pessoas = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase();
    const lista = painel?.utilizadores ?? [];
    const filtradas = q
      ? lista.filter((p) => p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      : lista;
    return [...filtradas].sort((a, b) => Number(membros.includes(b.id)) - Number(membros.includes(a.id)) || a.nome.localeCompare(b.nome, 'pt'));
  }, [painel, buscaPessoa, membros]);

  const modulos = useMemo(() => {
    const q = buscaPagina.trim().toLowerCase();
    const lista = (painel?.acessos ?? []).filter((pagina) => {
      if (pagina.sistema && grupo?.chave !== 'dev') return false;
      if (!q) return true;
      return pagina.nome.toLowerCase().includes(q) || pagina.rota.toLowerCase().includes(q) || pagina.modulo.toLowerCase().includes(q);
    });
    const ordem = new Map<string, { ordem: number; paginas: AcessoPainel[] }>();
    for (const pagina of lista) {
      const actual = ordem.get(pagina.modulo) ?? { ordem: pagina.ordem, paginas: [] };
      actual.paginas.push(pagina);
      actual.ordem = Math.min(actual.ordem, pagina.ordem);
      ordem.set(pagina.modulo, actual);
    }
    return [...ordem.entries()].sort((a, b) => a[1].ordem - b[1].ordem);
  }, [painel, buscaPagina, grupo?.chave]);

  function seleccionar(id: string) {
    if (!painel || id === grupoId) return;
    const seguinte = painel.grupos.find((g) => g.id === id);
    if (!seguinte) return;
    setGrupoId(id);
    setNome(seguinte.nome);
    setDescricao(seguinte.descricao ?? '');
    setMembros(seguinte.membros.map((m) => m.id));
    setPaginasIds(seguinte.acesso_ids);
    setBuscaPessoa('');
  }

  async function guardar() {
    if (!grupoId) return;
    setAGravar(true);
    try {
      const next = await acessosService.guardarGrupo(grupoId, {
        nome,
        descricao,
        utilizador_ids: membros,
        acesso_ids: paginasIds,
      });
      preencher(next, grupoId);
      toast.success('Grupo actualizado', 'Pessoas e páginas gravadas.');
      await refrescarMenu();
    } catch (err) {
      toast.error('Não foi possível gravar', mensagem(err, 'Tenta novamente.'));
    } finally {
      setAGravar(false);
    }
  }

  async function criar() {
    setACriar(true);
    try {
      const antes = new Set(painel?.grupos.map((g) => g.id) ?? []);
      const next = await acessosService.criarGrupo(novoNome.trim(), novoDescricao.trim());
      const criado = next.grupos.find((g) => !antes.has(g.id));
      preencher(next, criado?.id ?? grupoId);
      setNovoAberto(false);
      setNovoNome('');
      setNovoDescricao('');
      toast.success('Grupo criado', `${criado?.nome ?? 'O grupo'} já pode receber pessoas e páginas.`);
    } catch (err) {
      toast.error('Não foi possível criar o grupo', mensagem(err, 'Tenta novamente.'));
    } finally {
      setACriar(false);
    }
  }

  async function apagar() {
    if (!grupo) return;
    setAApagar(true);
    try {
      const next = await acessosService.apagarGrupo(grupo.id);
      preencher(next, null);
      setConfirmarApagar(false);
      toast.success('Grupo eliminado', `${grupo.nome} deixou de dar acesso às páginas.`);
    } catch (err) {
      toast.error('Não foi possível eliminar', mensagem(err, 'Tenta novamente.'));
    } finally {
      setAApagar(false);
    }
  }

  async function entrarNoDev() {
    const dev = painel?.grupos.find((g) => g.chave === 'dev');
    if (!dev || !painel) return;
    setAEntrar(true);
    try {
      const ids = [...new Set([...dev.membros.map((m) => m.id), painel.eu_id])];
      const next = await acessosService.guardarGrupo(dev.id, { utilizador_ids: ids });
      preencher(next, dev.id);
      toast.success('Conta DEV', 'A tua conta passou a gerir os acessos.');
      await refrescarMenu();
    } catch (err) {
      toast.error('Não foi possível entrar no grupo DEV', mensagem(err, 'Tenta novamente.'));
    } finally {
      setAEntrar(false);
    }
  }

  if (loading) return <SkeletonList rows={8} cols={2} />;

  if (!painel) {
    return (
      <EmptyState
        icon={<KeyRound className="h-8 w-8" />}
        title="Acessos indisponíveis"
        description={erro ?? 'Não foi possível carregar o controlo de acesso.'}
      />
    );
  }

  const porDefinir = painel.acessos.filter((p) => !p.sistema && !painel.grupos.some((g) => g.acesso_ids.includes(p.id))).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Acessos</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            O menu de cada pessoa é a soma das páginas dos grupos dela. Uma página nova
            não aparece a ninguém até ser marcada aqui.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Badge variant={porDefinir > 0 ? 'warning' : 'neutral'} size="sm">{porDefinir} por definir</Badge>
          <Badge variant="neutral" size="sm">{painel.grupos.length} grupos</Badge>
        </div>
      </div>

      {!euNoDev && devVazio && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3">
          <p className="text-sm text-gold-800">
            O grupo DEV ainda não tem contas. Adiciona a tua para ficares com a gestão — depois desta página deixa de aparecer aos outros administradores.
          </p>
          <Button size="sm" onClick={entrarNoDev} loading={aEntrar}>Adicionar-me ao DEV</Button>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Grupos</p>
            <Button variant="ghost" size="sm" onClick={() => setNovoAberto(true)} aria-label="Novo grupo">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="space-y-1">
            {painel.grupos.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => seleccionar(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    item.id === grupoId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span className="truncate font-medium">{item.nome}</span>
                  <span className={cn('text-xs', item.id === grupoId ? 'text-primary-foreground/80' : 'text-neutral-400')}>
                    {item.membros.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {grupo && (
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      aria-label="Nome do grupo"
                      className="max-w-sm font-semibold"
                    />
                    {grupo.sistema && <Badge variant="accent" size="sm">DEV</Badge>}
                  </div>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Para que serve este grupo"
                    rows={2}
                    aria-label="Descrição do grupo"
                  />
                </div>
                <div className="flex gap-2">
                  {!grupo.sistema && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmarApagar(true)} aria-label="Eliminar grupo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button onClick={guardar} loading={aGravar} disabled={!dirty}>Guardar</Button>
                </div>
              </div>
            </section>

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-400" />
                  <h2 className="text-sm font-semibold text-neutral-900">Pessoas</h2>
                  <span className="ml-auto text-xs text-neutral-500">{membros.length} neste grupo</span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={buscaPessoa}
                    onChange={(e) => setBuscaPessoa(e.target.value)}
                    placeholder="Procurar pessoa"
                    className="pl-9"
                    aria-label="Procurar pessoa"
                  />
                </div>
                <ul className="max-h-[420px] space-y-1 overflow-y-auto">
                  {pessoas.map((pessoa) => {
                    const activo = membros.includes(pessoa.id);
                    return (
                      <li key={pessoa.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={() => {
                              setMembros((prev) => activo ? prev.filter((id) => id !== pessoa.id) : [...prev, pessoa.id]);
                            }}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-neutral-900">{pessoa.nome}</span>
                            <span className="block truncate text-xs text-neutral-500">{pessoa.email}</span>
                          </span>
                          <Badge variant="neutral" size="sm" className="ml-auto shrink-0">{PERFIL[pessoa.perfil] ?? pessoa.perfil}</Badge>
                        </label>
                      </li>
                    );
                  })}
                  {pessoas.length === 0 && <li className="px-2 py-6 text-center text-sm text-neutral-500">Nenhuma pessoa encontrada.</li>}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-neutral-400" />
                  <h2 className="text-sm font-semibold text-neutral-900">Páginas</h2>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-neutral-500">
                  Marca as páginas que este grupo vê no menu. Sem nenhum grupo, a página fica fechada.
                </p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={buscaPagina}
                    onChange={(e) => setBuscaPagina(e.target.value)}
                    placeholder="Procurar página"
                    className="pl-9"
                    aria-label="Procurar página"
                  />
                </div>
                <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                  {modulos.map(([modulo, bloco]) => (
                    <div key={modulo}>
                      <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{modulo}</p>
                      <ul className="space-y-1">
                        {bloco.paginas.map((pagina) => {
                          const marcada = pagina.sistema || paginasIds.includes(pagina.id);
                          return (
                            <li key={pagina.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                              <input
                                type="checkbox"
                                checked={marcada}
                                disabled={pagina.sistema}
                                onChange={() => {
                                  setPaginasIds((prev) => marcada ? prev.filter((id) => id !== pagina.id) : [...prev, pagina.id]);
                                }}
                                aria-label={`${pagina.nome} neste grupo`}
                                className="h-4 w-4 accent-primary disabled:opacity-60"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-neutral-900">{pagina.nome}</span>
                                <span className="block truncate font-mono text-[11px] text-neutral-400">{pagina.rota}</span>
                              </span>
                              {pagina.sistema ? (
                                <Badge variant="accent" size="sm">só DEV</Badge>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <Dialog open={novoAberto} onClose={() => setNovoAberto(false)} className="max-w-md">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Novo grupo</h2>
        <p className="mb-4 text-sm text-muted-foreground">Um grupo junta pessoas que devem ver o mesmo conjunto de páginas.</p>
        <div className="space-y-3">
          <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome" aria-label="Nome do novo grupo" />
          <Textarea value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} placeholder="Descrição (opcional)" rows={2} aria-label="Descrição do novo grupo" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setNovoAberto(false)}>Cancelar</Button>
          <Button onClick={criar} loading={aCriar} disabled={novoNome.trim().length < 2}>Criar</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmarApagar}
        onClose={() => setConfirmarApagar(false)}
        onConfirm={apagar}
        title="Eliminar grupo"
        description={grupo ? `${grupo.nome} deixa de dar acesso às páginas que tinha. As pessoas mantêm a conta.` : ''}
        confirmLabel="Eliminar"
        destructive
        loading={aApagar}
      />
    </div>
  );
}
