import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Pin, PinOff, Pencil, Trash2, Link2, Send, ImagePlus } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { RichTextEditor, textoParaHtml } from '@/src/components/ui/rich-text-editor';
import { Avatar } from '@/src/components/ui/badge';
import { toast } from '@/src/store';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  comunidadeService, type ComunidadePost, type ComunidadeComentario, type PostPayload,
} from '@/src/services/comunidade.service';
import { Checkbox } from '@/components/ui/checkbox';
import { erroPedido } from '@/src/lib/erro-pedido';
import { enviarFicheiro, REGRAS_FICHEIRO, validarFicheiro } from '@/src/services/ficheiros.service';

/**
 * Notícias da Comunidade — peças partilhadas pelo feed (ComunidadePage)
 * e pela página de leitura (PublicacaoPage).
 */

const MAX_CONTEUDO = 5000;
const MAX_COMENTARIO = 1000;
const PERFIL_LABEL: Record<string, string> = {
  rh_admin: 'DPC',
  mentor: 'Mentor',
  novo_colaborador: 'Colaborador',
};

const IMAGEM_APP = /^\/api\/ficheiros\?key=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function linkImagemValido(url: string): boolean {
  const valor = url.trim();
  return /^https?:\/\/\S+$/i.test(valor) || IMAGEM_APP.test(valor);
}

/** Liga ao perfil da pessoa; sem id (conta removida) mostra só o conteúdo. */
export function PerfilLink({ id, className, children }: { id: string | null; className?: string; children: ReactNode }) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to={`/perfil/${id}`} className={cn('shrink-0', className)}>
      {children}
    </Link>
  );
}

// ===== Formulário de publicação (criar / editar) =====

export function PostForm({ post, onSaved, onCancel }: { post?: ComunidadePost; onSaved: () => void; onCancel?: () => void }) {
  const [titulo, setTitulo] = useState(post?.titulo ?? '');
  const [conteudo, setConteudo] = useState(post?.conteudo ?? '');
  const [imagem, setImagem] = useState(post?.imagem ?? '');
  const [fixado, setFixado] = useState(post?.fixado ?? false);
  const [saving, setSaving] = useState(false);
  const [imagemErro, setImagemErro] = useState(false);
  const [aEnviarImagem, setAEnviarImagem] = useState(false);
  const [pctImagem, setPctImagem] = useState(0);
  const inputImagem = useRef<HTMLInputElement>(null);
  const linkImagem = imagem.trim();
  const imagemCarregada = IMAGEM_APP.test(linkImagem);
  const linkInvalido = !!linkImagem && !linkImagemValido(linkImagem);

  async function carregarImagem(file: File) {
    const invalido = validarFicheiro('publicacao', file);
    if (invalido) {
      toast.error('Imagem não aceite', invalido);
      return;
    }
    setAEnviarImagem(true);
    setPctImagem(0);
    try {
      const enviado = await enviarFicheiro(file, { finalidade: 'publicacao', onProgresso: setPctImagem });
      setImagem(`/api/ficheiros?key=${enviado.id}`);
      setImagemErro(false);
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível enviar a imagem.');
      if (!jaNotificado) toast.error('Imagem não enviada', msg);
    } finally {
      setAEnviarImagem(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (aEnviarImagem) return;
    if (!conteudo) {
      toast.error('Escreve o conteúdo da publicação');
      return;
    }
    if (linkInvalido) {
      toast.error('Link da imagem inválido', 'Usa um endereço que comece por http:// ou https://');
      return;
    }
    const payload: PostPayload = { titulo: titulo.trim() || null, conteudo, imagem: linkImagem || null, fixado };
    setSaving(true);
    try {
      if (post) {
        await comunidadeService.actualizar(post.id, payload);
        toast.success('Publicação actualizada');
      } else {
        await comunidadeService.criar(payload);
        toast.success('Publicado na comunidade');
        setTitulo('');
        setConteudo('');
        setImagem('');
        setFixado(false);
      }
      onSaved();
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Tenta novamente.');
      if (!jaNotificado) toast.error('Erro ao publicar', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn('space-y-3', !post && 'rounded-xl border border-navy-100 bg-white p-6')}
    >
      {!post && <p className="text-sm font-semibold text-navy-800">Nova publicação</p>}
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" maxLength={200} />
      <RichTextEditor
        value={conteudo}
        onChange={setConteudo}
        placeholder="Partilha uma novidade com a comunidade…"
        maxLength={MAX_CONTEUDO}
        conteudoClassName="rich-text-preto"
      />

      <div>
        <input
          ref={inputImagem}
          type="file"
          accept={REGRAS_FICHEIRO.publicacao.aceitar}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void carregarImagem(file);
          }}
        />
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input
            value={imagemCarregada ? '' : imagem}
            onChange={(e) => {
              setImagem(e.target.value);
              setImagemErro(false);
            }}
            placeholder={imagemCarregada ? 'Imagem carregada — cola um link para a substituir' : 'Link da imagem (opcional) — https://…'}
            maxLength={2000}
            className="pl-9"
            error={linkInvalido ? 'inválido' : undefined}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={aEnviarImagem}
            disabled={saving}
            leftIcon={<ImagePlus className="h-3.5 w-3.5" />}
            onClick={() => inputImagem.current?.click()}
          >
            {aEnviarImagem ? `A enviar ${pctImagem}%` : 'Carregar imagem'}
          </Button>
          {linkImagem && (
            <Button type="button" variant="ghost" size="sm" disabled={aEnviarImagem} onClick={() => { setImagem(''); setImagemErro(false); }}>
              Remover
            </Button>
          )}
          <span className="text-xs text-navy-400">{REGRAS_FICHEIRO.publicacao.descricao}</span>
        </div>
        {linkInvalido && (
          <p className="mt-1.5 text-xs text-error-600">O link tem de começar por http:// ou https://</p>
        )}
        {linkImagem && !linkInvalido && (
          imagemErro ? (
            <p className="mt-1.5 text-xs text-warning-600">Não foi possível pré-visualizar a imagem. Confirma se o link é público e aponta para uma imagem.</p>
          ) : (
            <img
              src={linkImagem}
              alt=""
              onError={() => setImagemErro(true)}
              className="mt-2 max-h-96 w-full rounded-lg object-cover"
            />
          )
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-navy-600">
          <Checkbox checked={fixado} onCheckedChange={(checked) => setFixado(checked)} />
          Fixar no topo
        </label>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="accent" loading={saving} disabled={aEnviarImagem}>
            {post ? 'Guardar' : 'Publicar'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ===== Notícias: destaque + grelha + página de leitura =====

const PALAVRAS_POR_MINUTO = 200;

/** Texto simples do conteúdo (HTML sanitizado) para o resumo dos cartões. */
export function textoSimples(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(textoParaHtml(html), 'text/html');
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function minutosLeitura(texto: string): number {
  return Math.max(1, Math.round(texto.split(' ').filter(Boolean).length / PALAVRAS_POR_MINUTO));
}

/** "21 Out 2026" (destaque) ou "21 Out" (cartões). */
export function dataNoticia(iso: string, comAno = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mes = d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
  const nome = `${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
  return `${d.getDate()} ${nome}${comAno ? ` ${d.getFullYear()}` : ''}`;
}

export function autorDe(post: ComunidadePost): string {
  return post.autor_nome ?? 'Direcção de Pessoas e Cultura';
}

// Capas decorativas (fallback sem imagem), como no modelo: fundo + duas manchas ovais.
// Sorteadas a partir do id: aleatórias entre publicações, mas estáveis
// (a mesma publicação tem sempre a mesma capa, no feed e na página de leitura).
const CAPAS = [
  { fundo: 'bg-[#12343F]', direita: 'bg-[#1B4A4C]', esquerda: 'bg-[#1A4555]' }, // verde-petróleo
  { fundo: 'bg-[#E8F1EC]', direita: 'bg-[#D6ECD3]', esquerda: 'bg-[#D3EAE0]' }, // verde-claro
  { fundo: 'bg-[#FDF1DC]', direita: 'bg-[#FBE3B8]', esquerda: 'bg-[#F8DA9E]' }, // creme
];

/** Hash simples e estável de uma string (FNV-1a de 32 bits). */
function hash(texto: string): number {
  const s = typeof texto === 'string' ? texto : '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function Etiquetas({ post }: { post: ComunidadePost }) {
  if (!post.fixado) return null;
  return (
    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        <Pin className="h-3 w-3" /> Fixado
      </span>
    </div>
  );
}

/** Capa da notícia: a imagem da publicação ou, sem imagem, uma capa decorativa. */
export function CapaNoticia({ post, destaque = false }: { post: ComunidadePost; destaque?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  const altura = destaque ? 'h-48 sm:h-56' : 'h-32';
  const h = hash(post.id);

  if (post.imagem && !falhou) {
    return (
      <div className={cn('relative overflow-hidden', altura)}>
        <img
          src={post.imagem}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <Etiquetas post={post} />
      </div>
    );
  }

  const tema = CAPAS[h % CAPAS.length];
  return (
    <div className={cn('relative overflow-hidden', altura, tema.fundo)} aria-hidden={!post.fixado}>
      <div className={cn('absolute -top-[15%] right-[8%] h-[125%] w-[34%] rounded-[50%]', tema.direita)} />
      <div className={cn('absolute -bottom-[40%] -left-[3%] h-[85%] w-[32%] rounded-[50%]', tema.esquerda)} />
      <Etiquetas post={post} />
    </div>
  );
}

export const BOTAO_CONTADOR =
  'inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD68C]/60';

export function BotaoGosto({ post, onGostar }: { post: ComunidadePost; onGostar: () => void }) {
  const gostei = post.minha_reacao === 'like';
  return (
    <button
      type="button"
      onClick={onGostar}
      title="Gosto"
      aria-pressed={gostei}
      className={cn(
        BOTAO_CONTADOR,
        gostei
          ? 'text-[#0B5E35] hover:bg-[#DDF5E8] dark:text-[#5EE6A8] dark:hover:bg-[rgba(94,230,168,0.12)]'
          : 'text-navy-600 hover:bg-navy-50',
      )}
    >
      <ThumbsUp className="h-4 w-4" fill={gostei ? 'currentColor' : 'none'} />
      <span className="tabular-nums">{post.likes}</span>
    </button>
  );
}

export function AccoesAdmin({ post, onFixar, onEditar, onRemover, className }: {
  post: ComunidadePost;
  onFixar: () => void;
  onEditar: () => void;
  onRemover: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center', className)}>
      <button onClick={onFixar} title={post.fixado ? 'Desafixar' : 'Fixar'} className="rounded-md p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
        {post.fixado ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </button>
      <button onClick={onEditar} title="Editar" className="rounded-md p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onRemover} title="Remover" className="rounded-md p-2 text-error-400 transition-colors hover:bg-error-50 hover:text-error-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface NoticiaProps {
  post: ComunidadePost;
  isAdmin: boolean;
  onAbrir: () => void;
  onGostar: () => void;
  onEditar: () => void;
  onFixar: () => void;
  onRemover: () => void;
}

/** Notícia em destaque (a primeira do feed: fixada ou a mais recente). */
export function NoticiaDestaque({ post, isAdmin, onAbrir, onGostar, onEditar, onFixar, onRemover }: NoticiaProps) {
  const texto = useMemo(() => textoSimples(post.conteudo), [post.conteudo]);
  return (
    <article id={`post-${post.id}`} className="scroll-mt-20 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <CapaNoticia post={post} destaque />
      <div className="p-6 sm:p-7">
        {post.titulo && (
          <h2 className="text-xl font-extrabold leading-tight tracking-tight text-[#0A0A0A] dark:text-white sm:text-2xl">{post.titulo}</h2>
        )}
        <p className={cn('line-clamp-3 text-[15px] leading-relaxed text-[#0A0A0A] dark:text-white', post.titulo && 'mt-3')}>{texto}</p>

        <div className="mt-5 flex items-center gap-3">
          <PerfilLink id={post.autor_id}>
            <Avatar name={autorDe(post)} size="md" />
          </PerfilLink>
          <p className="min-w-0 text-xs text-navy-400">
            <PerfilLink id={post.autor_id} className="font-semibold text-navy-800 hover:underline">{autorDe(post)}</PerfilLink>
            {' · '}{dataNoticia(post.created_at, true)} · {minutosLeitura(texto)} min de leitura
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-navy-50 pt-5">
          <Button variant="primary" onClick={onAbrir}>Ler publicação</Button>
          <BotaoGosto post={post} onGostar={onGostar} />
          <button type="button" onClick={onAbrir} title="Comentários" className={cn(BOTAO_CONTADOR, 'text-navy-600 hover:bg-navy-50')}>
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">{post.total_comentarios}</span>
          </button>
          {isAdmin && <AccoesAdmin post={post} onFixar={onFixar} onEditar={onEditar} onRemover={onRemover} className="ml-auto" />}
        </div>
      </div>
    </article>
  );
}

/** Cartão compacto da grelha. Clicar abre a publicação; o gosto funciona sem abrir. */
export function NoticiaCartao({ post, isAdmin, onAbrir, onGostar, onEditar, onFixar, onRemover }: NoticiaProps) {
  const texto = useMemo(() => textoSimples(post.conteudo), [post.conteudo]);
  return (
    <article id={`post-${post.id}`} className="group flex scroll-mt-20 flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white transition hover:shadow-card">
      <button
        type="button"
        onClick={onAbrir}
        className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3DD68C]/60"
      >
        <CapaNoticia post={post} />
        <div className="flex flex-1 flex-col px-5 pt-5">
          {post.titulo && (
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-[#0A0A0A] dark:text-white group-hover:underline">{post.titulo}</h3>
          )}
          <p className={cn('text-sm leading-relaxed text-[#0A0A0A] dark:text-white', post.titulo ? 'mt-2 line-clamp-3' : 'line-clamp-5')}>{texto}</p>
          <p className="mt-auto truncate pt-4 text-xs text-navy-400">
            {autorDe(post)} · {dataNoticia(post.created_at)} · {minutosLeitura(texto)} min
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 px-3 pb-2 pt-1">
        <BotaoGosto post={post} onGostar={onGostar} />
        <button type="button" onClick={onAbrir} title="Comentários" className={cn(BOTAO_CONTADOR, 'text-navy-600 hover:bg-navy-50')}>
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{post.total_comentarios}</span>
        </button>
        {isAdmin && <AccoesAdmin post={post} onFixar={onFixar} onEditar={onEditar} onRemover={onRemover} className="ml-auto" />}
      </div>
    </article>
  );
}

interface NoticiaLeituraProps {
  post: ComunidadePost;
  isAdmin: boolean;
  userId: string | null;
  comentarioRemovido: string | null;
  onGostar: () => void;
  onEditar: () => void;
  onFixar: () => void;
  onRemover: () => void;
  onRemoverComentario: (c: ComunidadeComentario) => void;
  onComentado: () => void;
}

/** Publicação completa (página de leitura): capa, conteúdo, gostos e comentários. */
export function NoticiaLeitura({
  post, isAdmin, userId, comentarioRemovido,
  onGostar, onEditar, onFixar, onRemover, onRemoverComentario, onComentado,
}: NoticiaLeituraProps) {
  const [comentarios, setComentarios] = useState<ComunidadeComentario[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const minutos = useMemo(() => minutosLeitura(textoSimples(post.conteudo)), [post.conteudo]);

  useEffect(() => {
    let cancelado = false;
    comunidadeService
      .comentarios(post.id)
      .then((c) => !cancelado && setComentarios(c))
      .catch(() => {
        if (cancelado) return;
        setComentarios([]);
        toast.error('Erro', 'Não foi possível carregar os comentários.');
      });
    return () => { cancelado = true; };
  }, [post.id]);

  useEffect(() => {
    if (comentarioRemovido) {
      setComentarios((prev) => prev?.filter((c) => c.id !== comentarioRemovido) ?? prev);
    }
  }, [comentarioRemovido]);

  async function comentar(e: FormEvent) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) return;
    setEnviando(true);
    try {
      const novo = await comunidadeService.comentar(post.id, conteudo);
      setComentarios((prev) => [...(prev ?? []), novo]);
      setTexto('');
      onComentado();
    } catch {
      toast.error('Erro', 'Não foi possível publicar o comentário.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
      <CapaNoticia post={post} destaque />

      <div className="p-6 sm:p-8">
        {post.titulo && (
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-[#0A0A0A] dark:text-white sm:text-3xl">{post.titulo}</h1>
        )}

        <div className={cn('flex items-center gap-3', post.titulo && 'mt-4')}>
          <PerfilLink id={post.autor_id}>
            <Avatar name={autorDe(post)} size="md" />
          </PerfilLink>
          <p className="min-w-0 text-xs text-navy-400">
            <PerfilLink id={post.autor_id} className="font-semibold text-navy-800 hover:underline">{autorDe(post)}</PerfilLink>
            {' · '}{dataNoticia(post.created_at, true)} · {minutos} min de leitura
            {post.updated_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000 && ' · editado'}
          </p>
        </div>

        {/* HTML sanitizado no servidor (sanitize-html) antes de ser guardado */}
        <div
          className="rich-text rich-text-preto mt-6 text-base"
          dangerouslySetInnerHTML={{ __html: textoParaHtml(post.conteudo) }}
        />

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-navy-50 pt-4">
          <BotaoGosto post={post} onGostar={onGostar} />
          <span className={cn(BOTAO_CONTADOR, 'cursor-default text-navy-600')}>
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">{post.total_comentarios}</span>
          </span>
          {isAdmin && <AccoesAdmin post={post} onFixar={onFixar} onEditar={onEditar} onRemover={onRemover} className="ml-auto" />}
        </div>
      </div>

      <section aria-label="Comentários" className="space-y-3 border-t border-navy-50 bg-navy-50/40 px-6 py-5 sm:px-8">
        <h2 className="text-sm font-semibold text-navy-800">Comentários</h2>
        {comentarios === null ? (
          <p className="text-xs text-navy-400">A carregar comentários…</p>
        ) : comentarios.length === 0 ? (
          <p className="text-xs text-navy-400">Sê o primeiro a comentar.</p>
        ) : (
          comentarios.map((c) => (
            <div key={c.id} className="group flex items-start gap-2.5">
              <PerfilLink id={c.autor_id}>
                <Avatar name={c.autor_nome ?? '?'} size="sm" />
              </PerfilLink>
              <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <PerfilLink id={c.autor_id} className="text-xs font-semibold text-navy-800 hover:underline">
                    {c.autor_nome ?? 'Utilizador removido'}
                  </PerfilLink>
                  {c.autor_perfil && PERFIL_LABEL[c.autor_perfil] && (
                    <span className="text-[10px] text-navy-400">{PERFIL_LABEL[c.autor_perfil]}</span>
                  )}
                  <span className="text-[10px] text-navy-300">· {formatRelativeTime(c.created_at)}</span>
                  {(isAdmin || (userId && c.autor_id === userId)) && (
                    <button
                      onClick={() => onRemoverComentario(c)}
                      title="Remover comentário"
                      className="ml-auto rounded p-0.5 text-error-400 opacity-0 transition-opacity hover:text-error-600 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-navy-700">{c.conteudo}</p>
              </div>
            </div>
          ))
        )}

        <form onSubmit={comentar} className="flex items-center gap-2 pt-1">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreve um comentário…"
            maxLength={MAX_COMENTARIO}
            className="flex-1"
          />
          <Button type="submit" variant="primary" size="icon" loading={enviando} disabled={!texto.trim()} aria-label="Enviar comentário">
            {!enviando && <Send className="h-4 w-4" />}
          </Button>
        </form>
      </section>
    </article>
  );
}
