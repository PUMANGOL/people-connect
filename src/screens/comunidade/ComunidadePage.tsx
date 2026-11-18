import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck, Megaphone, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Dialog, ConfirmDialog } from '@/src/components/ui/dialog';
import { SkeletonCard } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { useNotificationsStore } from '@/src/store/notifications.store';
import { NotificacoesLista, useMarcarTodasLidas } from '@/src/components/NotificacoesLista';
import {
  comunidadeService, type ComunidadePost, type Reacao,
} from '@/src/services/comunidade.service';
import { NoticiaCartao, NoticiaDestaque, PostForm } from './noticias';

const PAGE_SIZE = 20;


export default function ComunidadePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'rh_admin';
  // ?post=<id> — vindo de uma notificação do sino
  const [searchParams] = useSearchParams();
  const postAlvo = searchParams.get('post');

  const [posts, setPosts] = useState<ComunidadePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const pedidoActual = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [criar, setCriar] = useState(false);
  const [editar, setEditar] = useState<ComunidadePost | null>(null);
  const [confirmar, setConfirmar] = useState<ComunidadePost | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const abrir = (post: ComunidadePost) => navigate(`/noticias/publicacao/${post.id}`);

  async function carregar() {
    const pedido = ++pedidoActual.current;
    const tinhaPosts = posts.length > 0;
    setLoading(true);
    setErro(false);
    try {
      const r = await comunidadeService.feed(0, PAGE_SIZE);
      if (pedido !== pedidoActual.current) return;
      setPosts(Array.isArray(r?.data) ? r.data : []);
      setHasMore(Boolean(r?.has_more));
    } catch {
      if (pedido !== pedidoActual.current) return;
      if (tinhaPosts) toast.error('Não foi possível actualizar as publicações', 'Continuas a ver a última versão carregada.');
      else setErro(true);
    } finally {
      if (pedido === pedidoActual.current) setLoading(false);
    }
  }

  useEffect(() => {
    // Vindo de uma notificação (?post=<id>): abre directamente a página da publicação.
    if (postAlvo) {
      navigate(`/noticias/publicacao/${postAlvo}`, { replace: true });
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postAlvo]);

  async function carregarMais() {
    setLoadingMore(true);
    try {
      const r = await comunidadeService.feed(posts.length, PAGE_SIZE);
      const mais = Array.isArray(r?.data) ? r.data : [];
      setPosts((prev) => [...prev, ...mais.filter((p) => !prev.some((x) => x.id === p.id))]);
      setHasMore(Boolean(r?.has_more));
    } catch {
      toast.error('Erro', 'Não foi possível carregar mais publicações.');
    } finally {
      setLoadingMore(false);
    }
  }

  function patchPost(id: string, patch: Partial<ComunidadePost>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function gostar(post: ComunidadePost) {
    const novo: Reacao | null = post.minha_reacao === 'like' ? null : 'like';
    // Actualização optimista
    const anterior = { likes: post.likes, minha_reacao: post.minha_reacao };
    patchPost(post.id, { likes: post.likes + (novo ? 1 : -1), minha_reacao: novo });
    try {
      const r = await comunidadeService.reagir(post.id, novo);
      patchPost(post.id, r);
    } catch {
      patchPost(post.id, anterior);
      toast.error('Erro', 'Não foi possível registar a reacção.');
    }
  }

  async function alternarFixado(post: ComunidadePost) {
    try {
      await comunidadeService.actualizar(post.id, { fixado: !post.fixado });
      toast.success(post.fixado ? 'Publicação desafixada' : 'Publicação fixada');
      carregar();
    } catch {
      toast.error('Erro', 'Não foi possível actualizar a publicação.');
    }
  }

  async function confirmarRemocao() {
    if (!confirmar) return;
    setRemovendo(true);
    try {
      await comunidadeService.remover(confirmar.id);
      setPosts((prev) => prev.filter((p) => p.id !== confirmar.id));
      toast.success('Publicação removida');
      setConfirmar(null);
    } catch {
      toast.error('Erro ao remover', 'Tenta novamente.');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Coluna das publicações (esquerda) */}
      <div className="min-w-0 space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setCriar(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Adicionar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : erro ? (
        <div className="rounded-xl border border-navy-100 bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm font-medium text-navy-800">Não foi possível carregar as publicações.</p>
          <p className="mt-1 text-sm text-navy-500">Verifica a ligação e tenta outra vez.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void carregar()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm text-navy-500">Ainda não há publicações na comunidade.</p>
          {isAdmin && <p className="mt-1 text-xs text-navy-400">Usa Adicionar para criar a primeira publicação.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {/* A primeira (fixada ou mais recente) em destaque; as restantes na grelha. */}
          <NoticiaDestaque
            post={posts[0]}
            isAdmin={isAdmin}
            onAbrir={() => abrir(posts[0])}
            onGostar={() => gostar(posts[0])}
            onEditar={() => setEditar(posts[0])}
            onFixar={() => alternarFixado(posts[0])}
            onRemover={() => setConfirmar(posts[0])}
          />
          {posts.length > 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {posts.slice(1).map((post) => (
                <NoticiaCartao
                  key={post.id}
                  post={post}
                  isAdmin={isAdmin}
                  onAbrir={() => abrir(post)}
                  onGostar={() => gostar(post)}
                  onEditar={() => setEditar(post)}
                  onFixar={() => alternarFixado(post)}
                  onRemover={() => setConfirmar(post)}
                />
              ))}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={loadingMore} onClick={carregarMais}>
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Notificações (direita) */}
      <NotificacoesCard />

      {criar && (
        <Dialog open onClose={() => setCriar(false)} className="max-w-4xl">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Nova publicação</h2>
          <PostForm
            onCancel={() => setCriar(false)}
            onSaved={() => {
              setCriar(false);
              carregar();
            }}
          />
        </Dialog>
      )}

      {editar && (
        <Dialog open onClose={() => setEditar(null)} className="max-w-4xl">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Editar publicação</h2>
          <PostForm
            post={editar}
            onCancel={() => setEditar(null)}
            onSaved={() => {
              setEditar(null);
              carregar();
            }}
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        onConfirm={confirmarRemocao}
        title="Remover publicação?"
        description="A publicação, as reacções e os comentários serão removidos permanentemente."
        confirmLabel="Sim, remover"
        destructive
        loading={removendo}
      />
    </div>
  );
}

// ===== Cartão de notificações (coluna direita) =====

function NotificacoesCard() {
  const unreadCount = useNotificationsStore((st) => st.unreadCount);
  const marcarTodasLidas = useMarcarTodasLidas();

  return (
    <aside className="hidden lg:flex sticky top-[99px] max-h-[calc(100vh-8rem)] flex-col rounded-xl border border-navy-100 bg-white">
      <div className="flex items-center justify-between border-b border-navy-50 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-navy-500" />
          <h2 className="text-sm font-semibold text-navy-800">Notificações</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={marcarTodasLidas}
            className="flex items-center gap-1 text-xs text-navy-500 transition-colors hover:text-navy-700"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NotificacoesLista limite={15} />
      </div>
    </aside>
  );
}
