import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Briefcase, Camera, CalendarDays, ChevronDown, Eye, HandHeart, Mail, MapPin,
  Megaphone, MessageCircle, Network, Pencil, Phone, Route as RouteIcon, Share2, Sparkles, UserRound,
  Users, X,
} from 'lucide-react';
import { ArvoreEstrutura, ListaColegas, temEstrutura } from '@/src/components/EstruturaOrganica';
import { Button, buttonVariants } from '@/src/components/ui/button';
import { FormField, Input, Textarea } from '@/src/components/ui/input';
import { Skeleton } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { CAPA_PERFIL } from '@/lib/constants';
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils';
import { erroPedido } from '@/src/lib/erro-pedido';
import { PERFIL_LABEL } from '@/src/services/pessoas.service';
import { REGRAS_FICHEIRO, validarFicheiro } from '@/src/services/ficheiros.service';
import {
  DISPONIBILIDADE, perfilService, type ActividadePerfil, type Disponibilidade, type MeuPerfil, type PerfilEditavel,
} from '@/src/services/perfil.service';

type Separador = 'geral' | 'actividade' | 'reconhecimentos' | 'dados';

const SEPARADORES: { id: Separador; label: string }[] = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'actividade', label: 'Actividade' },
  { id: 'reconhecimentos', label: 'Reconhecimentos' },
  { id: 'dados', label: 'Dados e preferências' },
];

const VALORES: Record<string, { label: string; barra: string; suave: string }> = {
  seguranca: { label: 'Segurança em primeiro', barra: 'bg-navy-600', suave: 'bg-navy-50 text-navy-700' },
  cliente: { label: 'Foco no cliente', barra: 'bg-info-600', suave: 'bg-info-50 text-info-700' },
  equipa: { label: 'Espírito de equipa', barra: 'bg-gold-500', suave: 'bg-gold-50 text-gold-700' },
  inovacao: { label: 'Inovação', barra: 'bg-warning-500', suave: 'bg-warning-50 text-warning-700' },
  integridade: { label: 'Integridade', barra: 'bg-brand-red-500', suave: 'bg-brand-red-50 text-brand-red-600' },
};

const MAX_BIO = 600;
const MAX_ETIQUETAS = 10;

function editavelDe(p: MeuPerfil): PerfilEditavel {
  return {
    bio: p.bio ?? '',
    localizacao: p.localizacao ?? '',
    telefone: p.telefone ?? '',
    extensao: p.extensao ?? '',
    disponibilidade: p.disponibilidade,
    posso_ajudar: p.posso_ajudar,
    interesses: p.interesses,
  };
}

function textoSimples(html: string, max = 160): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const t = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export default function MeuPerfilPage() {
  const eu = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'erro'>('loading');
  const [separador, setSeparador] = useState<Separador>('geral');
  const [envio, setEnvio] = useState<{ pct: number } | null>(null);
  const [aRemover, setARemover] = useState(false);
  const [menuDisponibilidade, setMenuDisponibilidade] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function carregar() {
    setEstado('loading');
    try {
      setPerfil(await perfilService.meu());
      setEstado('ok');
    } catch (e) {
      setEstado('erro');
      const { jaNotificado } = erroPedido(e, '');
      if (!jaNotificado) toast.error('Perfil indisponível', 'Não foi possível carregar o teu perfil.');
    }
  }

  useEffect(() => { void carregar(); }, []);

  function sincronizarFoto(url: string | null) {
    if (eu) setUser({ ...eu, foto_url: url });
  }

  async function enviarFoto(file: File) {
    const invalido = validarFicheiro('foto', file);
    if (invalido) {
      toast.error('Imagem não aceite', invalido);
      return;
    }
    setEnvio({ pct: 0 });
    try {
      const url = await perfilService.enviarImagem('foto', file, (pct) => setEnvio({ pct }));
      setPerfil((p) => p && { ...p, foto_url: url });
      sincronizarFoto(url);
      toast.success('Foto actualizada');
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível guardar a imagem.');
      if (!jaNotificado) toast.error('Imagem por guardar', msg);
    } finally {
      setEnvio(null);
    }
  }

  async function removerFoto() {
    setARemover(true);
    try {
      await perfilService.removerImagem('foto');
      setPerfil((p) => p && { ...p, foto_url: null });
      sincronizarFoto(null);
      toast.success('Foto removida');
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível remover a imagem.');
      if (!jaNotificado) toast.error('Imagem por remover', msg);
    } finally {
      setARemover(false);
    }
  }

  async function mudarDisponibilidade(valor: Disponibilidade) {
    setMenuDisponibilidade(false);
    if (!perfil || perfil.disponibilidade === valor) return;
    const antes = perfil.disponibilidade;
    setPerfil({ ...perfil, disponibilidade: valor });
    try {
      await perfilService.actualizar({ disponibilidade: valor });
    } catch (e) {
      setPerfil((p) => p && { ...p, disponibilidade: antes });
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível mudar a disponibilidade.');
      if (!jaNotificado) toast.error('Disponibilidade por mudar', msg);
    }
  }

  async function partilhar() {
    if (!perfil) return;
    const url = `${window.location.origin}/perfil/${perfil.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link do cartão copiado', 'Cola-o numa mensagem para partilhar o teu perfil.');
    } catch {
      toast.info('Link do cartão', url);
    }
  }

  const completude = useMemo(() => {
    if (!perfil) return { pct: 0, falta: [] as string[] };
    const itens = [
      { ok: !!perfil.foto_url, label: 'foto' },
      { ok: !!perfil.bio, label: 'sobre mim' },
      { ok: !!perfil.localizacao, label: 'localização' },
      { ok: !!(perfil.telefone || perfil.extensao), label: 'contacto' },
      { ok: perfil.posso_ajudar.length > 0, label: 'em que podes ajudar' },
      { ok: perfil.interesses.length > 0, label: 'interesses' },
    ];
    const feitos = itens.filter((i) => i.ok).length;
    return { pct: Math.round((feitos / itens.length) * 100), falta: itens.filter((i) => !i.ok).map((i) => i.label) };
  }, [perfil]);

  if (estado === 'loading') return <PerfilEsqueleto />;

  if (estado === 'erro' || !perfil) {
    return (
      <div className="mx-auto max-w-5xl rounded-xl border border-navy-100 bg-white p-10 text-center">
        <UserRound className="mx-auto h-8 w-8 text-navy-300" />
        <p className="mt-3 text-sm font-medium text-navy-800">Não foi possível abrir o teu perfil.</p>
        <p className="mt-1 text-sm text-navy-500">Verifica a ligação e tenta outra vez.</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => void carregar()}>Tentar novamente</Button>
      </div>
    );
  }

  const disp = DISPONIBILIDADE[perfil.disponibilidade] ?? DISPONIBILIDADE.disponivel;
  const contacto = [perfil.extensao && `Ext. ${perfil.extensao}`, perfil.telefone].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <input
        ref={inputFoto}
        type="file"
        accept={REGRAS_FICHEIRO.foto.aceitar}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void enviarFoto(f); }}
      />

      <section className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-card">
        <div className="relative h-40 bg-navy-800 sm:h-52">
          <img src={CAPA_PERFIL} alt="" className="h-full w-full object-cover object-center" />
        </div>

        <div className="px-5 pb-5 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {/* Foto */}
              <div className="relative -mt-14 w-fit shrink-0 sm:-mt-16">
                <Retrato nome={perfil.nome} src={perfil.foto_url} className="h-28 w-28 text-3xl ring-4 ring-white sm:h-32 sm:w-32" />
                {envio && <ProgressoImagem pct={envio.pct} redondo />}
                <button
                  type="button"
                  onClick={() => inputFoto.current?.click()}
                  disabled={!!envio}
                  className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-white ring-4 ring-white transition-colors hover:bg-navy-900 disabled:opacity-60"
                  aria-label={perfil.foto_url ? 'Alterar foto' : 'Adicionar foto'}
                  title={perfil.foto_url ? 'Alterar foto' : 'Adicionar foto'}
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-navy-900">{perfil.nome}</h1>
                  <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
                    {PERFIL_LABEL[perfil.perfil] ?? perfil.perfil}
                  </span>
                  {perfil.mentorados > 0 && (
                    <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
                      Mentor de {perfil.mentorados} {perfil.mentorados === 1 ? 'colaborador' : 'colaboradores'}
                    </span>
                  )}
                  {perfil.onboarding && perfil.onboarding.total > perfil.onboarding.concluidas && (
                    <span className="rounded-full bg-info-50 px-2.5 py-0.5 text-xs font-semibold text-info-700">
                      Em integração
                    </span>
                  )}
                </div>
                {(perfil.funcao || perfil.direccao) && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-navy-600">
                    <Briefcase className="h-4 w-4 shrink-0 text-navy-400" />
                    {[perfil.funcao, perfil.direccao].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-navy-500">
                  {perfil.localizacao && (
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-navy-400" />{perfil.localizacao}</span>
                  )}
                  <a href={`mailto:${perfil.email}`} className="inline-flex items-center gap-1.5 hover:text-navy-800">
                    <Mail className="h-3.5 w-3.5 text-navy-400" />{perfil.email}
                  </a>
                  {contacto && (
                    <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-navy-400" />{contacto}</span>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuDisponibilidade((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-navy-50 hover:text-navy-800"
                      aria-haspopup="listbox"
                      aria-expanded={menuDisponibilidade}
                    >
                      <span className={cn('h-2 w-2 rounded-full', disp.ponto)} />
                      {disp.label}
                      <ChevronDown className="h-3.5 w-3.5 text-navy-400" />
                    </button>
                    {menuDisponibilidade && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuDisponibilidade(false)} />
                        <ul role="listbox" className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-navy-100 bg-white py-1 shadow-card-hover">
                          {(Object.keys(DISPONIBILIDADE) as Disponibilidade[]).map((d) => (
                            <li key={d}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={perfil.disponibilidade === d}
                                onClick={() => void mudarDisponibilidade(d)}
                                className={cn(
                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-navy-50',
                                  perfil.disponibilidade === d ? 'font-semibold text-navy-900' : 'text-navy-600',
                                )}
                              >
                                <span className={cn('h-2 w-2 rounded-full', DISPONIBILIDADE[d].ponto)} />
                                {DISPONIBILIDADE[d].label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:pb-1">
              <Button size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setSeparador('dados')}>
                Editar perfil
              </Button>
              <Link to={`/perfil/${perfil.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                <Eye className="h-3.5 w-3.5" /> Ver como colega
              </Link>
              <Button variant="secondary" size="sm" leftIcon={<Share2 className="h-3.5 w-3.5" />} onClick={() => void partilhar()}>
                Partilhar cartão
              </Button>
            </div>
          </div>

          {completude.pct < 100 && (
            <div className="mt-5 rounded-lg border border-navy-100 bg-surface-secondary px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="font-medium text-navy-800">O teu perfil está {completude.pct}% completo</p>
                <button type="button" onClick={() => setSeparador('dados')} className="text-xs font-semibold text-navy-600 hover:text-navy-900">
                  Completar perfil
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${completude.pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-navy-500">Falta: {completude.falta.join(', ')}.</p>
            </div>
          )}
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-navy-100 px-3 sm:px-6" aria-label="Secções do perfil">
          {SEPARADORES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeparador(s.id)}
              aria-current={separador === s.id ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                separador === s.id ? 'border-navy-700 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-800',
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </section>

      {separador === 'geral' && <VisaoGeral perfil={perfil} onEditar={() => setSeparador('dados')} />}
      {separador === 'actividade' && (
        <Cartao titulo="Actividade" icon={MessageCircle}>
          <ListaActividade itens={perfil.actividade} />
        </Cartao>
      )}
      {separador === 'reconhecimentos' && <Reconhecimentos perfil={perfil} />}
      {separador === 'dados' && (
        <DadosPreferencias
          perfil={perfil}
          envio={envio}
          aRemover={aRemover}
          onEscolher={() => inputFoto.current?.click()}
          onRemover={() => void removerFoto()}
          onGuardado={(dados) => setPerfil((p) => p && { ...p, ...dados })}
        />
      )}
    </div>
  );
}

function VisaoGeral({ perfil, onEditar }: { perfil: MeuPerfil; onEditar: () => void }) {
  const r = perfil.reconhecimentos;
  const maxValor = Math.max(1, ...r.por_valor.map((v) => v.total));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Cartao titulo="Sobre mim" icon={UserRound} accao={<BotaoTexto onClick={onEditar}>Editar</BotaoTexto>}>
          {perfil.bio ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-navy-700">{perfil.bio}</p>
          ) : (
            <p className="text-sm text-navy-500">
              Conta aos colegas o teu percurso e o que fazes no dia-a-dia.{' '}
              <button type="button" onClick={onEditar} className="font-semibold text-navy-700 hover:underline">Escrever agora</button>
            </p>
          )}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-500">
                <HandHeart className="h-3.5 w-3.5" /> Posso ajudar com
              </h3>
              <Etiquetas itens={perfil.posso_ajudar} tom="bg-navy-50 text-navy-700" vazio="Ainda sem temas." />
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-500">
                <Sparkles className="h-3.5 w-3.5" /> Interesses
              </h3>
              <Etiquetas itens={perfil.interesses} tom="bg-gold-50 text-gold-700" vazio="Ainda sem interesses." />
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Actividade recente" icon={MessageCircle}>
          <ListaActividade itens={perfil.actividade.slice(0, 5)} />
        </Cartao>
      </div>

      <div className="space-y-6">
        <Cartao titulo="Reconhecimentos" icon={Award} accao={<Link to="/reconhecimento" className="text-xs font-semibold text-navy-600 hover:text-navy-900">Mural</Link>}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Numero valor={r.recebidos} label="Recebidos" />
            <Numero valor={r.aplausos} label="Aplausos" />
            <Numero valor={r.dados} label="Dados" />
          </div>
          {r.por_valor.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {r.por_valor.map((v) => {
                const cfg = VALORES[v.valor] ?? VALORES.equipa;
                return (
                  <li key={v.valor}>
                    <div className="flex justify-between text-xs">
                      <span className="text-navy-700">{cfg.label}</span>
                      <span className="font-semibold text-navy-900">{v.total}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50">
                      <div className={cn('h-full rounded-full', cfg.barra)} style={{ width: `${(v.total / maxValor) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        {perfil.onboarding && (
          <Cartao titulo="O meu onboarding" icon={RouteIcon}>
            <p className="text-sm font-medium text-navy-800">{perfil.onboarding.trilho_nome}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-50">
                <div
                  className="h-full rounded-full bg-gold-500"
                  style={{ width: `${perfil.onboarding.total ? (perfil.onboarding.concluidas / perfil.onboarding.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-navy-700">{perfil.onboarding.concluidas}/{perfil.onboarding.total}</span>
            </div>
            <Link to="/onboarding/meu-trilho" className="mt-3 inline-block text-xs font-semibold text-navy-600 hover:text-navy-900">Ver trilho</Link>
            {perfil.mentor && (
              <div className="mt-4 flex items-center gap-3 border-t border-navy-50 pt-4">
                <Retrato nome={perfil.mentor.nome} className="h-9 w-9 text-xs" />
                <div className="min-w-0">
                  <p className="text-xs text-navy-400">O teu mentor</p>
                  {perfil.mentor.utilizador_id ? (
                    <Link to={`/perfil/${perfil.mentor.utilizador_id}`} className="text-sm font-medium text-navy-800 hover:underline">{perfil.mentor.nome}</Link>
                  ) : (
                    <p className="text-sm font-medium text-navy-800">{perfil.mentor.nome}</p>
                  )}
                </div>
              </div>
            )}
          </Cartao>
        )}

        {temEstrutura(perfil.estrutura) && (
          <Cartao titulo="Estrutura organizacional" icon={Network}>
            <ArvoreEstrutura estrutura={perfil.estrutura} nome={perfil.nome} fotoUrl={perfil.foto_url} proprio />
          </Cartao>
        )}

        <Cartao titulo="A minha equipa" icon={Users}>
          {perfil.estrutura.colegas.pessoas.length > 0 && (
            <p className="-mt-1 mb-3 text-xs text-navy-400">
              {perfil.estrutura.colegas.ambito === 'unidade' ? perfil.estrutura.unidade : perfil.estrutura.direccao}
            </p>
          )}
          <ListaColegas
            estrutura={perfil.estrutura}
            vazio={`Ainda sem colegas registados na tua ${perfil.estrutura.colegas.ambito === 'unidade' ? 'unidade' : 'direcção'}.`}
          />
        </Cartao>

        {(perfil.data_admissao || perfil.membro_desde) && (
          <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-5 py-4 text-sm">
            <CalendarDays className="h-4 w-4 text-navy-400" />
            <span className="text-navy-500">
              {perfil.data_admissao ? 'Na Pumangol desde' : 'Na plataforma desde'}{' '}
              <span className="font-medium text-navy-800">{formatDate(perfil.data_admissao ?? perfil.membro_desde)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Reconhecimentos({ perfil }: { perfil: MeuPerfil }) {
  const ultimos = perfil.reconhecimentos.ultimos;
  return (
    <Cartao titulo="Reconhecimentos recebidos" icon={Award} accao={<Link to="/reconhecimento" className="text-xs font-semibold text-navy-600 hover:text-navy-900">Abrir mural</Link>}>
      {ultimos.length === 0 ? (
        <p className="text-sm text-navy-500">Quando um colega te reconhecer no mural, aparece aqui.</p>
      ) : (
        <ul className="divide-y divide-navy-50">
          {ultimos.map((r) => {
            const cfg = VALORES[r.valor] ?? VALORES.equipa;
            return (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('rounded-full px-2 py-0.5 font-semibold', cfg.suave)}>{cfg.label}</span>
                  <span className="text-navy-500">de <span className="font-medium text-navy-700">{r.autor_nome}</span></span>
                  <span className="text-navy-300">·</span>
                  <span className="text-navy-400">{formatRelativeTime(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-navy-700">{r.mensagem}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

function DadosPreferencias({
  perfil, envio, aRemover, onEscolher, onRemover, onGuardado,
}: {
  perfil: MeuPerfil;
  envio: { pct: number } | null;
  aRemover: boolean;
  onEscolher: () => void;
  onRemover: () => void;
  onGuardado: (dados: PerfilEditavel) => void;
}) {
  const [form, setForm] = useState<PerfilEditavel>(() => editavelDe(perfil));
  const [aGuardar, setAGuardar] = useState(false);
  const original = useMemo(() => JSON.stringify(editavelDe(perfil)), [perfil]);
  const alterado = JSON.stringify(form) !== original;
  const telefoneInvalido = !!form.telefone && !/^[+\d][\d\s()-]{5,}$/.test(form.telefone);
  const extensaoInvalida = !!form.extensao && !/^\d{1,10}$/.test(form.extensao);

  async function guardar() {
    if (telefoneInvalido || extensaoInvalida) return;
    setAGuardar(true);
    try {
      const dados = await perfilService.actualizar(form);
      onGuardado(dados);
      setForm({
        ...dados,
        bio: dados.bio ?? '',
        localizacao: dados.localizacao ?? '',
        telefone: dados.telefone ?? '',
        extensao: dados.extensao ?? '',
      });
      toast.success('Perfil guardado');
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível guardar o perfil.');
      if (!jaNotificado) toast.error('Perfil por guardar', msg);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Cartao titulo="Sobre mim" icon={UserRound}>
          <div className="space-y-4">
            <FormField label="Apresentação" hint="Percurso, o que fazes e como gostas de trabalhar.">
              <Textarea
                value={form.bio ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                maxLength={MAX_BIO}
                showCount
                rows={5}
                placeholder="Ex.: Engenheira de processos há 8 anos, apaixonada por segurança operacional."
              />
            </FormField>
            <FormField label="Posso ajudar com" hint={`Temas em que os colegas te podem pedir ajuda. Até ${MAX_ETIQUETAS}.`}>
              <CampoEtiquetas
                valor={form.posso_ajudar}
                onChange={(posso_ajudar) => setForm((f) => ({ ...f, posso_ajudar }))}
                placeholder="Ex.: Excel avançado"
              />
            </FormField>
            <FormField label="Interesses" hint={`Fora do trabalho ou em temas da empresa. Até ${MAX_ETIQUETAS}.`}>
              <CampoEtiquetas
                valor={form.interesses}
                onChange={(interesses) => setForm((f) => ({ ...f, interesses }))}
                placeholder="Ex.: Corrida"
              />
            </FormField>
          </div>
        </Cartao>

        <Cartao titulo="Contactos e disponibilidade" icon={Phone}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Localização" hint="Edifício, piso ou posto.">
              <Input
                value={form.localizacao ?? ''}
                maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value }))}
                placeholder="Ex.: Sede, Talatona · Piso 3"
              />
            </FormField>
            <FormField label="Disponibilidade">
              <div className="grid grid-cols-3 gap-1 rounded-md border border-input p-1" role="radiogroup" aria-label="Disponibilidade">
                {(Object.keys(DISPONIBILIDADE) as Disponibilidade[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={form.disponibilidade === d}
                    onClick={() => setForm((f) => ({ ...f, disponibilidade: d }))}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                      form.disponibilidade === d ? 'bg-navy-700 text-white' : 'text-navy-600 hover:bg-navy-50',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', DISPONIBILIDADE[d].ponto)} />
                    {d === 'disponivel' ? 'Disponível' : DISPONIBILIDADE[d].label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Telefone" error={telefoneInvalido ? 'Usa só números, espaços e o indicativo.' : undefined}>
              <Input
                value={form.telefone ?? ''}
                maxLength={30}
                inputMode="tel"
                error={telefoneInvalido ? 'inválido' : undefined}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="Ex.: +244 923 000 000"
              />
            </FormField>
            <FormField label="Extensão" error={extensaoInvalida ? 'Só números.' : undefined}>
              <Input
                value={form.extensao ?? ''}
                maxLength={10}
                inputMode="numeric"
                error={extensaoInvalida ? 'inválido' : undefined}
                onChange={(e) => setForm((f) => ({ ...f, extensao: e.target.value }))}
                placeholder="Ex.: 2214"
              />
            </FormField>
          </div>
        </Cartao>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {alterado && <span className="mr-auto text-xs text-navy-500">Tens alterações por guardar.</span>}
          <Button variant="ghost" disabled={!alterado || aGuardar} onClick={() => setForm(editavelDe(perfil))}>Repor</Button>
          <Button loading={aGuardar} disabled={!alterado || telefoneInvalido || extensaoInvalida} onClick={() => void guardar()}>
            {aGuardar ? 'A guardar…' : 'Guardar alterações'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Cartao titulo="Foto de perfil" icon={Camera}>
          <LinhaImagem
            titulo="Foto"
            descricao={REGRAS_FICHEIRO.foto.descricao}
            preview={<Retrato nome={perfil.nome} src={perfil.foto_url} className="h-14 w-14 text-base" />}
            tem={!!perfil.foto_url}
            aEnviar={envio ? envio.pct : null}
            aRemover={aRemover}
            bloqueado={!!envio}
            onEscolher={onEscolher}
            onRemover={onRemover}
          />
        </Cartao>

        <Cartao titulo="Dados da DPC" icon={Briefcase}>
          <dl className="space-y-3 text-sm">
            <Dado label="Nome" valor={perfil.nome} />
            <Dado label="Email" valor={perfil.email} />
            <Dado label="Função" valor={perfil.funcao} />
            <Dado label="Direcção" valor={perfil.direccao} />
            {perfil.estrutura.unidade && <Dado label="Unidade" valor={perfil.estrutura.unidade} />}
            {perfil.estrutura.local_trabalho && (
              <Dado
                label="Local de trabalho"
                valor={[perfil.estrutura.local_trabalho, perfil.estrutura.cidade].filter(Boolean).join(' · ')}
              />
            )}
            {perfil.data_admissao && <Dado label="Data de admissão" valor={formatDate(perfil.data_admissao)} />}
          </dl>
          <p className="mt-4 text-xs text-navy-400">Para corrigir estes dados, fala com a Direcção de Pessoas e Cultura.</p>
        </Cartao>
      </div>
    </div>
  );
}

function LinhaImagem({
  titulo, descricao, preview, tem, aEnviar, aRemover, bloqueado, onEscolher, onRemover,
}: {
  titulo: string;
  descricao: string;
  preview: ReactNode;
  tem: boolean;
  aEnviar: number | null;
  aRemover: boolean;
  bloqueado: boolean;
  onEscolher: () => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {preview}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy-800">{titulo}</p>
        <p className="text-xs text-navy-400">{aEnviar != null ? `A enviar… ${aEnviar}%` : descricao}</p>
        <div className="mt-1.5 flex gap-3">
          <button type="button" disabled={bloqueado} onClick={onEscolher} className="text-xs font-semibold text-navy-700 hover:text-navy-900 disabled:opacity-50">
            {tem ? 'Alterar' : 'Carregar'}
          </button>
          {tem && (
            <button type="button" disabled={bloqueado || aRemover} onClick={onRemover} className="text-xs font-semibold text-error-600 hover:text-error-700 disabled:opacity-50">
              {aRemover ? 'A remover…' : 'Remover'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaActividade({ itens }: { itens: ActividadePerfil[] }) {
  if (!itens.length) return <p className="text-sm text-navy-500">Ainda sem actividade. As tuas publicações, comentários e reconhecimentos aparecem aqui.</p>;
  return (
    <ul className="divide-y divide-navy-50">
      {itens.map((a, i) => {
        const href = a.tipo === 'reconhecimento' || !a.post_id ? '/reconhecimento' : `/noticias/publicacao/${a.post_id}`;
        const Icone = a.tipo === 'publicacao' ? Megaphone : a.tipo === 'reconhecimento' ? Award : MessageCircle;
        const accao = a.tipo === 'publicacao'
          ? 'Publicaste'
          : a.tipo === 'reconhecimento'
            ? `Reconheceste ${a.titulo}`
            : `Comentaste${a.titulo ? ` em «${a.titulo}»` : ''}`;
        return (
          <li key={`${a.tipo}-${a.post_id ?? i}-${a.created_at}`}>
            <Link to={href} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-3 hover:bg-navy-50">
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', a.tipo === 'publicacao' ? 'text-gold-600' : 'text-navy-400')} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-navy-400">{accao} · {formatRelativeTime(a.created_at)}</p>
                <p className="mt-0.5 text-sm text-navy-700">
                  {a.tipo === 'publicacao' && a.titulo ? a.titulo : textoSimples(a.texto)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CampoEtiquetas({ valor, onChange, placeholder }: { valor: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [texto, setTexto] = useState('');
  const cheio = valor.length >= MAX_ETIQUETAS;

  function adicionar() {
    const limpo = texto.trim().replace(/\s+/g, ' ').slice(0, 40);
    setTexto('');
    if (!limpo || cheio || valor.some((v) => v.toLowerCase() === limpo.toLowerCase())) return;
    onChange([...valor, limpo]);
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      adicionar();
    } else if (e.key === 'Backspace' && !texto && valor.length) {
      onChange(valor.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1.5 focus-within:border-primary focus-within:shadow-focus">
      {valor.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-navy-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-navy-700">
          {v}
          <button
            type="button"
            onClick={() => onChange(valor.filter((x) => x !== v))}
            className="rounded-full p-0.5 text-navy-400 hover:bg-navy-100 hover:text-navy-700"
            aria-label={`Remover ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={tecla}
        onBlur={adicionar}
        disabled={cheio}
        maxLength={40}
        placeholder={cheio ? 'Limite atingido' : valor.length ? 'Adicionar…' : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Cartao({ titulo, icon: Icone, accao, children }: { titulo: string; icon: typeof Award; accao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-navy-100 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Icone className="h-4 w-4 text-navy-400" />
          {titulo}
        </h2>
        {accao}
      </div>
      {children}
    </section>
  );
}

function BotaoTexto({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-navy-600 hover:text-navy-900">
      {children}
    </button>
  );
}

function Etiquetas({ itens, tom, vazio }: { itens: string[]; tom: string; vazio: string }) {
  if (!itens.length) return <p className="text-sm text-navy-400">{vazio}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.map((i) => (
        <span key={i} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', tom)}>{i}</span>
      ))}
    </div>
  );
}

function Numero({ valor, label }: { valor: number; label: string }) {
  return (
    <div className="rounded-lg bg-surface-secondary px-2 py-3">
      <p className="text-xl font-bold text-navy-900">{valor}</p>
      <p className="text-[11px] text-navy-500">{label}</p>
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className="break-words text-navy-800">{valor || '—'}</dd>
    </div>
  );
}

function Retrato({ nome, src, className }: { nome: string; src?: string | null; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [src]);
  if (src && !falhou) {
    return <img src={src} alt={nome} onError={() => setFalhou(true)} className={cn('shrink-0 rounded-full bg-navy-100 object-cover', className)} />;
  }
  return (
    <div className={cn('avatar-iniciais flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-700', className)}>
      {getInitials(nome)}
    </div>
  );
}

function ProgressoImagem({ pct, redondo }: { pct: number; redondo?: boolean }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center bg-navy-900/55 text-white', redondo && 'rounded-full')}>
      <div className="text-center">
        <p className="text-sm font-semibold">{pct}%</p>
        <p className="text-[11px] text-white/80">A enviar</p>
      </div>
    </div>
  );
}

function PerfilEsqueleto() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="A carregar o perfil">
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
        <Skeleton className="h-40 w-full rounded-none sm:h-52" />
        <div className="flex items-end gap-4 px-5 pb-6 sm:px-8">
          <Skeleton className="-mt-14 h-28 w-28 rounded-full ring-4 ring-white sm:-mt-16 sm:h-32 sm:w-32" />
          <div className="flex-1 space-y-2 pb-1">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
