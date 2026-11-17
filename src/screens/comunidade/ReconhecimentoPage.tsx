import { useEffect, useMemo, useState } from 'react';
import {
  Award, ChevronLeft, ChevronRight, Eye, EyeOff, Heart, Lightbulb, Lock, MessageSquare, Scale, Send, ShieldCheck, Smile, Trophy, Users,
  type LucideIcon,
} from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import { useAuthStore } from '@/src/store/auth.store';
import { toast } from '@/src/store/ui.store';
import { mentorsService } from '@/src/services/mentoria.service';
import type { Mentor } from '@/lib/types';
import {
  reconhecimentosService,
  type ReconhecimentoItem,
  type ReconhecimentoPainel,
  type ValorId,
} from '@/src/services/reconhecimentos.service';
import { Button } from '@/src/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { Input, Textarea } from '@/src/components/ui/input';
import { SearchableSelect } from '@/src/components/ui/searchable-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Palmas } from './palmas';

type FiltroMural = 'todos' | 'direccao' | 'postos' | 'semana';

const VALORES: {
  id: ValorId;
  label: string;
  curto: string;
  cor: string;
  suave: string;
  activo: string;
  Icon: LucideIcon;
}[] = [
  { id: 'seguranca', label: 'Segurança em primeiro', curto: 'Segurança', cor: 'bg-navy-600', suave: 'bg-navy-50 text-navy-700', activo: 'border-navy-600 bg-navy-50 ring-navy-600', Icon: ShieldCheck },
  { id: 'cliente', label: 'Foco no cliente', curto: 'Cliente', cor: 'bg-info-600', suave: 'bg-info-50 text-info-700', activo: 'border-info-600 bg-info-50 ring-info-600', Icon: Smile },
  { id: 'equipa', label: 'Espírito de equipa', curto: 'Equipa', cor: 'bg-gold-500', suave: 'bg-gold-50 text-gold-700', activo: 'border-gold-500 bg-gold-50 ring-gold-500', Icon: Users },
  { id: 'inovacao', label: 'Inovação', curto: 'Inovação', cor: 'bg-warning-500', suave: 'bg-warning-50 text-warning-700', activo: 'border-warning-500 bg-warning-50 ring-warning-500', Icon: Lightbulb },
  { id: 'integridade', label: 'Integridade', curto: 'Integridade', cor: 'bg-brand-red-500', suave: 'bg-brand-red-50 text-brand-red-600', activo: 'border-brand-red-500 bg-brand-red-50 ring-brand-red-500', Icon: Scale },
];

const TONS_AVATAR = [
  'bg-navy-100 text-navy-800',
  'bg-gold-100 text-gold-800',
  'bg-info-100 text-info-700',
  'bg-warning-100 text-warning-700',
  'bg-brand-red-100 text-brand-red-700',
];

function tomAvatar(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONS_AVATAR[h % TONS_AVATAR.length];
}

const FILTROS: [FiltroMural, string][] = [
  ['todos', 'Todos'],
  ['direccao', 'A minha direcção'],
  ['postos', 'Postos'],
  ['semana', 'Esta semana'],
];

const MIN_MENSAGEM = 12;
const MAX_MENSAGEM = 2000;

function quando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 6e4);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function variacao(actual: number, anterior: number): { texto: string; tom: 'sobe' | 'desce' | 'neutro' } {
  if (!anterior) {
    return actual
      ? { texto: 'Primeiro mês com registos', tom: 'sobe' }
      : { texto: 'Sem registos no mês anterior', tom: 'neutro' };
  }
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return {
    texto: `${pct > 0 ? '+' : ''}${pct}% face ao mês anterior`,
    tom: pct > 0 ? 'sobe' : pct < 0 ? 'desce' : 'neutro',
  };
}

function erroPedido(e: unknown, fallback: string): { msg: string; jaNotificado: boolean } {
  const err = e as { response?: { status?: number; data?: { error?: string; message?: string } } };
  const status = err.response?.status;
  const msg = err.response?.data?.error || err.response?.data?.message || fallback;
  return { msg, jaNotificado: status === 403 || status === 429 || (status != null && status >= 500) };
}

function valorDe(id: ValorId) {
  return VALORES.find((v) => v.id === id) ?? VALORES[2];
}

export default function ReconhecimentoPage() {
  const eu = useAuthStore((s) => s.user);
  const [separador, setSeparador] = useState<'meus' | 'dar'>('dar');
  const [painel, setPainel] = useState<ReconhecimentoPainel | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [filtro, setFiltro] = useState<FiltroMural>('todos');
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [colaboradores, setColaboradores] = useState<Mentor[]>([]);
  const [aCarregarPessoas, setACarregarPessoas] = useState(true);
  const [destinatario, setDestinatario] = useState('');
  const [valor, setValor] = useState<ValorId>('equipa');
  const [mensagem, setMensagem] = useState('');
  const [visibilidade, setVisibilidade] = useState<'publico' | 'privado'>('publico');
  const [informarChefe, setInformarChefe] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aPublicar, setAPublicar] = useState(false);
  const [aComentar, setAComentar] = useState<string | null>(null);
  const [aEnviarComentario, setAEnviarComentario] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [verMais, setVerMais] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [aplausosPendentes, setAplausosPendentes] = useState<Set<string>>(new Set());

  async function carregar(silencioso = false) {
    if (!silencioso) setACarregar(true);
    try {
      setPainel(await reconhecimentosService.painel());
      setFalha(null);
      return true;
    } catch (e) {
      setFalha('Não foi possível carregar o mural.');
      const { jaNotificado } = erroPedido(e, '');
      if (!jaNotificado) toast.error('Mural indisponível', 'Não foi possível carregar os reconhecimentos.');
      return false;
    } finally {
      setACarregar(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  useEffect(() => {
    let vivo = true;
    mentorsService.list(true)
      .then((rows) => { if (vivo) setColaboradores(rows.filter((m) => m.activo !== false && m.nome)); })
      .catch((e) => {
        if (!vivo) return;
        setColaboradores([]);
        const { jaNotificado } = erroPedido(e, '');
        if (!jaNotificado) toast.error('Colaboradores indisponíveis', 'Não foi possível carregar a lista para reconhecer.');
      })
      .finally(() => { if (vivo) setACarregarPessoas(false); });
    return () => { vivo = false; };
  }, []);

  const lista = painel?.itens ?? [];
  const meus = useMemo(() => {
    if (!eu) return [];
    return lista.filter((r) => r.deId === eu.id || r.paraId === eu.id);
  }, [lista, eu]);

  const base = separador === 'meus' ? meus : lista;
  const mural = useMemo(() => {
    const semana = Date.now() - 7 * 864e5;
    return base.filter((r) => {
      if (filtro === 'direccao') return eu?.departamento ? r.direccao === eu.departamento : true;
      if (filtro === 'postos') return r.posto;
      if (filtro === 'semana') return new Date(r.createdAt).getTime() >= semana;
      return true;
    });
  }, [base, filtro, eu]);

  const contagemFiltro = useMemo(() => {
    const semana = Date.now() - 7 * 864e5;
    return {
      todos: base.length,
      direccao: base.filter((r) => (eu?.departamento ? r.direccao === eu.departamento : true)).length,
      postos: base.filter((r) => r.posto).length,
      semana: base.filter((r) => new Date(r.createdAt).getTime() >= semana).length,
    };
  }, [base, eu]);

  const visiveis = verMais ? mural : mural.slice(0, 4);
  const mes = new Date().toLocaleDateString('pt-PT', { month: 'long' });
  const contagem = VALORES.map((v) => ({ ...v, n: painel?.porValor.find((p) => p.valor === v.id)?.n ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const maisCelebrado = contagem[0];
  const vezes = (id: ValorId) => painel?.badges.find((b) => b.valor === id)?.vezes ?? 0;
  const badgesGanhos = VALORES.filter((v) => vezes(v.id) > 0).length + (eu?.is_mentor ? 1 : 0);
  const delta = variacao(painel?.totalMes ?? 0, painel?.mesAnterior ?? 0);
  const pessoa = colaboradores.find((c) => c.id === destinatario);
  const caracteres = mensagem.trim().length;
  const carrossel = useMemo(() => lista.filter((r) => r.visibilidade === 'publico').slice(0, 10), [lista]);
  const slideActual = carrossel.length ? Math.min(slide, carrossel.length - 1) : 0;
  const destaqueSlide = carrossel[slideActual] ?? null;

  function detalheDe(r: ReconhecimentoItem) {
    const pessoaSlide = r.paraId ? colaboradores.find((c) => c.utilizador_id === r.paraId) : undefined;
    return [pessoaSlide?.funcao, pessoaSlide?.departamento].filter(Boolean).join(', ');
  }

  const sugestoes = (painel?.sugestoes ?? []).flatMap((s) => {
    const mentor = colaboradores.find((c) => c.utilizador_id === s.id);
    return mentor ? [mentor] : [];
  });

  function mudarSeparador(id: 'meus' | 'dar') {
    setSeparador(id);
    setVerMais(false);
  }

  function mudarFiltro(id: FiltroMural) {
    setFiltro(id);
    setVerMais(false);
  }

  async function publicar() {
    if (aCarregarPessoas) {
      toast.info('Ainda a carregar', 'A lista de colaboradores está a chegar.');
      return;
    }
    if (!pessoa) {
      setErro('Escolha o colaborador a reconhecer.');
      return;
    }
    if (caracteres < MIN_MENSAGEM) {
      setErro('Conte o que aconteceu. Uma frase concreta chega.');
      return;
    }
    if (caracteres > MAX_MENSAGEM) {
      setErro(`A mensagem pode ter até ${MAX_MENSAGEM} caracteres.`);
      return;
    }
    setAPublicar(true);
    setErro(null);
    const pedirDirector = informarChefe && visibilidade === 'publico';
    try {
      const { directoresInformados } = await reconhecimentosService.publicar({
        destinatarioId: pessoa.utilizador_id,
        destinatarioNome: pessoa.nome,
        valor,
        mensagem: mensagem.trim(),
        visibilidade,
        informarChefe: pedirDirector,
      });
      setMensagem('');
      setDestinatario('');
      const avisoDirector = directoresInformados > 1
        ? ' Os directores da direcção foram notificados.'
        : directoresInformados === 1 ? ' O director foi notificado.' : '';
      toast.success(
        'Reconhecimento publicado',
        visibilidade === 'publico'
          ? `${pessoa.nome} já aparece no mural.${avisoDirector}`
          : `Só ${pessoa.nome} vai ver esta mensagem.`,
      );
      if (pedirDirector && !directoresInformados) {
        toast.info('Director por informar', `Não há outro director identificado na direcção de ${pessoa.nome}.`);
      }
      const fresco = await carregar(true);
      if (!fresco) toast.warning('Mural por actualizar', 'O reconhecimento ficou gravado. Actualize a página para o ver.');
      setFormularioAberto(false);
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível publicar o reconhecimento.');
      setErro(msg);
      if (!jaNotificado) toast.error('Não foi possível publicar', msg);
    } finally {
      setAPublicar(false);
    }
  }

  async function aplaudir(item: ReconhecimentoItem) {
    if (aplausosPendentes.has(item.id)) return;
    const antes = painel;
    const vaiAplaudir = !item.aplaudi;
    setAplausosPendentes((actual) => new Set(actual).add(item.id));
    setPainel((actual) => actual && ({
      ...actual,
      itens: actual.itens.map((r) => r.id === item.id
        ? { ...r, aplaudi: !r.aplaudi, aplausos: r.aplausos + (r.aplaudi ? -1 : 1) }
        : r),
    }));
    try {
      const res = await reconhecimentosService.aplaudir(item.id);
      setPainel((actual) => actual && ({
        ...actual,
        itens: actual.itens.map((r) => r.id === item.id ? { ...r, aplausos: res.aplausos, aplaudi: res.aplaudi } : r),
      }));
    } catch (e) {
      setPainel(antes);
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível registar o aplauso.');
      if (!jaNotificado) toast.error(vaiAplaudir ? 'Aplauso não registado' : 'Não foi possível retirar o aplauso', msg);
    } finally {
      setAplausosPendentes((actual) => {
        const seguinte = new Set(actual);
        seguinte.delete(item.id);
        return seguinte;
      });
    }
  }

  async function comentar(id: string) {
    const texto = textoComentario.trim();
    if (!texto) return;
    setAEnviarComentario(true);
    try {
      const res = await reconhecimentosService.comentar(id, texto);
      setPainel((actual) => actual && ({
        ...actual,
        itens: actual.itens.map((r) => r.id === id ? { ...r, comentarios: res.comentarios } : r),
      }));
      setTextoComentario('');
      setAComentar(null);
      toast.success('Comentário enviado');
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível enviar o comentário.');
      if (!jaNotificado) toast.error('Comentário não enviado', msg);
    } finally {
      setAEnviarComentario(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-navy-800 px-6 py-6 text-white sm:px-8">
        <Award className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-white/[0.06]" strokeWidth={1.25} />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold tracking-tight">Reconhecimento</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              Agradeça a quem fez a diferença no seu dia. Publique no mural para toda a empresa ver,
              ou envie só à pessoa.
            </p>
          </div>
          <div className="flex rounded-lg bg-white/10 p-1 text-sm" role="tablist" aria-label="Vista">
            {([['dar', 'Dar reconhecimento'], ['meus', 'Os meus']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={separador === id}
                onClick={() => mudarSeparador(id)}
                className={cn(
                  'rounded-md px-3.5 py-1.5 font-medium transition-colors',
                  separador === id ? 'bg-white text-navy-900 shadow-sm' : 'text-white/80 hover:text-white',
                )}
              >
                {label}
                {id === 'meus' && painel && (
                  <span className={cn('ml-1.5 tabular-nums', separador === id ? 'text-navy-400' : 'text-white/50')}>{meus.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {aCarregar && !painel ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-navy-100 bg-white p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : (
          <>
            <Numero
              Icon={Award}
              tom="bg-gold-50 text-gold-700"
              titulo={`Reconhecimentos em ${mes}`}
              valor={String(painel?.totalMes ?? 0)}
              nota={delta.texto}
              notaTom={delta.tom}
            />
            <Numero
              Icon={Heart}
              tom="bg-brand-red-50 text-brand-red-600"
              titulo="Recebidos por si"
              valor={String(painel?.recebidos ?? 0)}
              nota={`${painel?.dados ?? 0} dados por si`}
            />
            <Numero
              Icon={maisCelebrado && maisCelebrado.n > 0 ? maisCelebrado.Icon : Scale}
              tom={maisCelebrado && maisCelebrado.n > 0 ? maisCelebrado.suave : 'bg-navy-50 text-navy-600'}
              titulo="Valor mais celebrado"
              valor={maisCelebrado && maisCelebrado.n > 0 ? maisCelebrado.label : '0'}
              nota={`${maisCelebrado?.n ?? 0} este mês`}
              pequeno={Boolean(maisCelebrado && maisCelebrado.n > 0)}
            />
            <Numero
              Icon={Users}
              tom="bg-info-50 text-info-700"
              titulo="Equipa em destaque"
              valor={painel?.equipa?.nome ?? '0'}
              nota={`${painel?.equipa?.aplausos ?? 0} aplausos`}
              pequeno={Boolean(painel?.equipa)}
            />
          </>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Dialog
            open={formularioAberto}
            onClose={() => { if (!aPublicar) setFormularioAberto(false); }}
            className="max-w-3xl"
          >
            <h2 className="pr-8 font-heading text-xl font-semibold tracking-tight text-foreground">Novo reconhecimento</h2>
            <p className="mt-1 text-sm text-muted-foreground">Publique no mural para a empresa ver, ou envie só à pessoa.</p>

            <div className="mt-6 space-y-6">
                <div>
                  <p className="mb-2 text-sm font-medium text-navy-800">Para quem</p>
                  {pessoa ? (
                    <div className="flex items-center gap-3 rounded-lg border border-navy-100 bg-surface-secondary px-3 py-2.5">
                      <Avatar nome={pessoa.nome} tamanho="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy-900">{pessoa.nome}</p>
                        <p className="truncate text-xs text-navy-500">
                          {[pessoa.funcao, pessoa.departamento].filter(Boolean).join(', ') || 'Colaborador Pumangol'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={aPublicar}
                        onClick={() => setDestinatario('')}
                        className="text-xs font-medium text-navy-600 hover:text-navy-900"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <>
                      <SearchableSelect
                        options={colaboradores.map((c) => ({
                          value: c.id,
                          label: c.nome,
                          hint: [c.funcao, c.departamento].filter(Boolean).join(', '),
                        }))}
                        value={destinatario}
                        onChange={(v) => { setDestinatario(v); setErro(null); }}
                        placeholder={aCarregarPessoas ? 'A carregar colaboradores…' : 'Procure pelo nome'}
                        searchPlaceholder="Nome do colaborador"
                        emptyLabel={aCarregarPessoas ? 'A carregar colaboradores…' : 'Ninguém com esse nome'}
                        disabled={aCarregarPessoas || aPublicar}
                        menuClassName="max-h-56"
                      />
                      {sugestoes.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-navy-400">Recentes:</span>
                          {sugestoes.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setDestinatario(m.id); setErro(null); }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white py-0.5 pl-0.5 pr-2.5 text-xs text-navy-700 transition-colors hover:border-navy-300"
                            >
                              <Avatar nome={m.nome} tamanho="xs" />
                              {m.nome.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-navy-800">Que valor demonstrou</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Valor">
                    {VALORES.map((v) => {
                      const escolhido = valor === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={escolhido}
                          disabled={aPublicar}
                          onClick={() => setValor(v.id)}
                          className={cn(
                            'flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-all',
                            escolhido ? cn('ring-1', v.activo) : 'border-navy-100 bg-white hover:border-navy-200 hover:bg-neutral-50',
                          )}
                        >
                          <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', escolhido ? 'bg-white' : v.suave, escolhido && v.suave.split(' ')[1])}>
                            <v.Icon className="h-4 w-4" />
                          </span>
                          <span className="text-xs font-medium leading-snug text-navy-800">{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-navy-800" htmlFor="reconhecimento-mensagem">O que aconteceu</label>
                    {caracteres > MAX_MENSAGEM - 200 && (
                      <span className={cn('text-xs tabular-nums', caracteres > MAX_MENSAGEM ? 'text-error-600' : 'text-navy-400')}>
                        {MAX_MENSAGEM - caracteres}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="reconhecimento-mensagem"
                    value={mensagem}
                    disabled={aPublicar}
                    onChange={(e) => { setMensagem(e.target.value); if (erro) setErro(null); }}
                    rows={4}
                    maxLength={MAX_MENSAGEM}
                    placeholder={pessoa
                      ? `Conte o que ${pessoa.nome.split(' ')[0]} fez e porque fez a diferença.`
                      : 'Conte o que a pessoa fez e porque fez a diferença.'}
                  />
                  {erro && <p className="mt-2 text-sm text-error-600" role="alert">{erro}</p>}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4">
                <div className="flex rounded-md border border-navy-100 bg-white p-0.5 text-xs" role="radiogroup" aria-label="Quem vê">
                  {([
                    ['publico', 'Mural', Eye],
                    ['privado', 'Só a pessoa', EyeOff],
                  ] as const).map(([id, label, Icone]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={visibilidade === id}
                      disabled={aPublicar}
                      onClick={() => setVisibilidade(id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors',
                        visibilidade === id ? 'bg-navy-700 text-white' : 'text-navy-600 hover:text-navy-900',
                      )}
                    >
                      <Icone className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                {visibilidade === 'publico' && (
                  <label className="flex items-center gap-2 text-sm text-navy-600">
                    <Checkbox checked={informarChefe} disabled={aPublicar} onCheckedChange={(v) => setInformarChefe(v === true)} />
                    Informar o director
                  </label>
                )}
                <Button
                  type="button"
                  variant="accent"
                  className="ml-auto"
                  loading={aPublicar}
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={() => void publicar()}
                >
                  {aPublicar ? 'A publicar…' : 'Publicar'}
                </Button>
              </div>
          </Dialog>

          <section aria-busy={aCarregar && !painel}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
              <div>
                <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {separador === 'meus' ? 'Os seus reconhecimentos' : 'Mural'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {separador === 'meus' ? 'O que deu e o que recebeu.' : 'O que a equipa está a reconhecer.'}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setFormularioAberto(true)}
                leftIcon={<Award className="h-4 w-4" />}
              >
                Novo reconhecimento
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar o mural">
                {FILTROS.map(([id, label]) => {
                  const activo = filtro === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => mudarFiltro(id)}
                      className={cn(
                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-200',
                        activo
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-neutral-300 hover:text-foreground',
                      )}
                    >
                      {label}
                      {painel && (
                        <span className={cn('font-mono text-[11px] tabular-nums', activo ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                          {contagemFiltro[id]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

            {aCarregar && !painel ? (
              <div className="space-y-3">
                <CartaoEsqueleto />
                <CartaoEsqueleto />
              </div>
            ) : falha && !painel ? (
              <div className="rounded-xl border border-navy-100 bg-white px-6 py-8 text-center">
                <p className="text-sm text-navy-700">{falha}</p>
                <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void carregar()}>
                  Tentar novamente
                </Button>
              </div>
            ) : visiveis.length === 0 ? (
              <div className="rounded-xl border border-dashed border-navy-200 bg-white px-6 py-10 text-center">
                <p className="text-sm font-medium text-navy-800">
                  {separador === 'meus' ? 'Ainda não deu nem recebeu reconhecimentos' : 'Nada por aqui com este filtro'}
                </p>
                <p className="mt-1 text-sm text-navy-500">
                  {separador === 'meus'
                    ? 'Comece por agradecer a um colega. Fica registado aqui.'
                    : 'Experimente outro filtro ou seja o primeiro a reconhecer alguém.'}
                </p>
                {separador === 'meus' && (
                  <Button type="button" variant="accent" size="sm" className="mt-4" onClick={() => mudarSeparador('dar')}>
                    Reconhecer alguém
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {visiveis.map((r) => {
                  const v = valorDe(r.valor);
                  const paraMim = eu ? r.paraId === eu.id : false;
                  const meu = eu ? r.deId === eu.id : false;
                  const pendente = aplausosPendentes.has(r.id);
                  return (
                    <article key={r.id} className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-[box-shadow,border-color] duration-200 ease-interaction hover:border-[var(--lift-border)] hover:shadow-hover">
                      <span className={cn('absolute inset-y-5 left-0 w-1 rounded-r-full', v.cor)} aria-hidden="true" />
                      <div className="flex items-start gap-4 px-5 pt-5 sm:px-6">
                        <Avatar nome={r.paraNome} tamanho="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                            <div className="min-w-0">
                              <p className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
                                {paraMim ? 'Você' : r.paraNome}
                              </p>
                              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                                Reconhecido por <span className="font-medium text-foreground">{meu ? 'si' : r.deNome}</span>
                                <span aria-hidden="true"> · </span>
                                <time dateTime={r.createdAt}>{quando(r.createdAt)}</time>
                                {r.direccao && <><span aria-hidden="true"> · </span>{r.direccao}</>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {r.visibilidade === 'privado' && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground" title="Só a pessoa vê">
                                  <Lock className="h-3 w-3" aria-hidden="true" /> Privado
                                </span>
                              )}
                              <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium', v.suave)}>
                                <v.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {v.label}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3.5 whitespace-pre-line text-base leading-relaxed text-foreground">
                            {r.mensagem}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-1 border-t border-border px-3 py-2 sm:px-4">
                        <BotaoPalmas item={r} pendente={pendente} onAplaudir={() => void aplaudir(r)} />
                        <button
                          type="button"
                          onClick={() => { setAComentar(aComentar === r.id ? null : r.id); setTextoComentario(''); }}
                          className={cn(
                            'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors duration-200',
                            aComentar === r.id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          Comentar
                          {r.comentarios > 0 && <span className="font-mono text-xs tabular-nums">{r.comentarios}</span>}
                        </button>
                        {r.informarChefe && (
                          <span className="ml-auto inline-flex items-center gap-1.5 pr-2 text-xs text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Director informado
                          </span>
                        )}
                      </div>

                      {aComentar === r.id && (
                        <form
                          className="flex gap-2 border-t border-border bg-muted/60 px-5 py-3 sm:px-6"
                          onSubmit={(e) => { e.preventDefault(); void comentar(r.id); }}
                        >
                          <Input
                            autoFocus
                            value={textoComentario}
                            disabled={aEnviarComentario}
                            onChange={(e) => setTextoComentario(e.target.value)}
                            placeholder="Deixe um comentário"
                            aria-label="Comentário"
                          />
                          <Button type="submit" disabled={!textoComentario.trim()} loading={aEnviarComentario}>
                            Enviar
                          </Button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {painel && mural.length > 4 && !verMais && (
              <div className="mt-4 text-center">
                <Button type="button" variant="secondary" onClick={() => setVerMais(true)}>
                  Mostrar mais {mural.length - 4}
                </Button>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {aCarregar && !painel ? (
            <>
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </>
          ) : (
            <>
              <section className="overflow-hidden rounded-xl bg-navy-900 text-white shadow-card" aria-roledescription="carrossel">
                <div className="flex items-center justify-between gap-2 px-5 pt-4">
                  <span className="flex items-center gap-2 text-sm font-medium text-gold-300">
                    <Trophy className="h-4 w-4" /> Reconhecidos recentemente
                  </span>
                  {carrossel.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSlide((slideActual - 1 + carrossel.length) % carrossel.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-white/55">
                        {slideActual + 1} de {carrossel.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSlide((slideActual + 1) % carrossel.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Seguinte"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {destaqueSlide ? (
                  <div key={destaqueSlide.id} className="px-5 pb-5 animate-in fade-in duration-300">
                    <div className="mt-4 flex flex-col items-center text-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-400 text-lg font-bold text-navy-900 ring-4 ring-gold-400/20">
                        {getInitials(destaqueSlide.paraNome)}
                      </span>
                      <p className="mt-3 font-semibold">{destaqueSlide.paraNome}</p>
                      <p className="text-xs text-white/60">
                        {detalheDe(destaqueSlide) || `Reconhecido por ${destaqueSlide.deNome}`}
                      </p>
                    </div>
                    <p className="mt-4 line-clamp-4 text-center text-sm leading-relaxed text-white/80">{destaqueSlide.mensagem}</p>
                    <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 rounded-lg bg-white/5 py-2.5 text-center">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{destaqueSlide.aplausos}</p>
                        <p className="text-[11px] text-white/55">aplausos</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{destaqueSlide.comentarios}</p>
                        <p className="text-[11px] text-white/55">comentários</p>
                      </div>
                    </div>
                    <BotaoPalmasDestaque
                      item={destaqueSlide}
                      pendente={aplausosPendentes.has(destaqueSlide.id)}
                      onAplaudir={() => void aplaudir(destaqueSlide)}
                    />
                  </div>
                ) : (
                  <p className="px-5 pb-5 pt-2 text-sm leading-relaxed text-white/70">
                    Ainda não há reconhecimentos públicos. O primeiro aparece aqui.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-card">
                <h3 className="text-sm font-semibold text-navy-900">Valores em {mes}</h3>
                <ul className="mt-4 space-y-3.5">
                  {contagem.map((v) => (
                    <li key={v.id} className="flex items-center gap-3">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', v.suave)}>
                        <v.Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="truncate font-medium text-navy-700">{v.label}</span>
                          <span className="ml-2 tabular-nums text-navy-500">{v.n}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={cn('h-full rounded-full transition-[width] duration-500', v.cor)}
                            style={{ width: v.n && contagem[0]?.n ? `${(v.n / contagem[0].n) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-card">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-navy-900">Os seus badges</h3>
                  <span className="text-xs tabular-nums text-navy-400">{badgesGanhos} de {VALORES.length + 1}</span>
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {VALORES.map((v) => {
                    const n = vezes(v.id);
                    return <Badge key={v.id} nome={v.curto} Icon={v.Icon} tom={v.suave} ganho={n > 0} vezes={n} />;
                  })}
                  <Badge nome="Mentor" Icon={Award} tom="bg-navy-50 text-navy-700" ganho={Boolean(eu?.is_mentor)} />
                </ul>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Numero({
  Icon,
  tom,
  titulo,
  valor,
  nota,
  notaTom = 'neutro',
  pequeno,
}: {
  Icon: LucideIcon;
  tom: string;
  titulo: string;
  valor: string;
  nota: string;
  notaTom?: 'sobe' | 'desce' | 'neutro';
  pequeno?: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-navy-100 bg-white p-4 shadow-card">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tom)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-navy-500">{titulo}</p>
        <p className={cn('truncate font-semibold tabular-nums tracking-tight text-navy-900', pequeno ? 'text-base leading-7' : 'text-2xl leading-7')}>
          {valor}
        </p>
        <p className={cn(
          'text-xs',
          notaTom === 'sobe' && 'text-gold-700',
          notaTom === 'desce' && 'text-error-600',
          notaTom === 'neutro' && 'text-navy-400',
        )}>
          {nota}
        </p>
      </div>
    </div>
  );
}

interface PropsPalmas {
  item: ReconhecimentoItem;
  pendente: boolean;
  onAplaudir: () => void;
}

function usePalmas({ item, pendente, onAplaudir }: PropsPalmas) {
  const [disparo, setDisparo] = useState(0);
  function clicar() {
    if (pendente) return;
    if (!item.aplaudi) setDisparo((n) => n + 1);
    onAplaudir();
  }
  return { disparo, clicar };
}

function BotaoPalmas(props: PropsPalmas) {
  const { item, pendente } = props;
  const { disparo, clicar } = usePalmas(props);
  return (
    <button
      type="button"
      aria-pressed={item.aplaudi}
      aria-busy={pendente}
      onClick={clicar}
      className={cn(
        'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors duration-200',
        item.aplaudi ? 'bg-primary-tint-8 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Palmas disparo={disparo} />
      Aplaudir
      {item.aplausos > 0 && <span className="font-mono text-xs tabular-nums">{item.aplausos}</span>}
    </button>
  );
}

function BotaoPalmasDestaque(props: PropsPalmas) {
  const { item, pendente } = props;
  const { disparo, clicar } = usePalmas(props);
  return (
    <Button
      type="button"
      variant={item.aplaudi ? 'secondary' : 'accent'}
      className="mt-4 w-full"
      aria-pressed={item.aplaudi}
      aria-busy={pendente}
      leftIcon={<Palmas disparo={disparo} />}
      onClick={clicar}
    >
      {item.aplaudi ? 'Aplaudiu. Retirar aplauso' : `Aplaudir ${item.paraNome.split(' ')[0]}`}
    </Button>
  );
}

function Badge({ nome, Icon, tom, ganho, vezes }: { nome: string; Icon: LucideIcon; tom?: string; ganho: boolean; vezes?: number }) {
  return (
    <li
      title={ganho ? undefined : 'Ainda por ganhar'}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-center',
        ganho ? 'border-navy-100 bg-white' : 'border-dashed border-navy-100 bg-neutral-50',
      )}
    >
      <span className={cn('relative flex h-9 w-9 items-center justify-center rounded-full', ganho ? tom : 'bg-white text-navy-200')}>
        <Icon className="h-4 w-4" />
        {vezes && vezes > 1 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy-800 px-1 text-[9px] font-semibold text-white">
            {vezes}
          </span>
        ) : null}
      </span>
      <span className={cn('text-[11px] font-medium leading-tight', ganho ? 'text-navy-800' : 'text-navy-300')}>{nome}</span>
    </li>
  );
}

function Avatar({ nome, tamanho }: { nome: string; tamanho: 'xs' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        tomAvatar(nome),
        tamanho === 'xs' && 'h-5 w-5 text-[9px]',
        tamanho === 'md' && 'h-9 w-9 text-xs',
        tamanho === 'lg' && 'h-11 w-11 text-sm shadow-sm ring-2 ring-card',
      )}
    >
      {getInitials(nome)}
    </span>
  );
}

function CartaoEsqueleto() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex gap-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}
