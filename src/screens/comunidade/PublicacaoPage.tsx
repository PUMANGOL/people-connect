import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Dialog, ConfirmDialog } from '@/src/components/ui/dialog';
import { SkeletonCard } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import {
  comunidadeService, type ComunidadePost, type ComunidadeComentario, type Reacao,
} from '@/src/services/comunidade.service';
import { NoticiaLeitura, PostForm } from './noticias';

type Confirmacao = { tipo: 'post' } | { tipo: 'comentario'; comentario: ComunidadeComentario };

/** Página de leitura de uma publicação (/noticias/publicacao/:id). */
export default function PublicacaoPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'rh_admin';

  const [post, setPost] = useState<ComunidadePost | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'erro'>('loading');
  const [editar, setEditar] = useState(false);
  const [confirmar, setConfirmar] = useState<Confirmacao | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [comentarioRemovido, setComentarioRemovido] = useState<string | null>(null);

  async function carregar() {
    try {
      setPost(await comunidadeService.obter(id));
      setEstado('ok');
    } catch {
      setEstado('erro');
    }
  }

  useEffect(() => {
    setEstado('loading');
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const voltar = () => navigate('/noticias');

  async function gostar() {
    if (!post) return;
    const novo: Reacao | null = post.minha_reacao === 'like' ? null : 'like';
    const anterior = post;
    setPost({ ...post, likes: post.likes + (novo ? 1 : -1), minha_reacao: novo });
    try {
      const r = await comunidadeService.reagir(post.id, novo);
      setPost((p) => (p ? { ...p, ...r } : p));
    } catch {
      setPost(anterior);
      toast.error('Erro', 'Não foi possível registar a reacção.');
    }
  }

  async function alternarFixado() {
    if (!post) return;
    try {
      await comunidadeService.actualizar(post.id, { fixado: !post.fixado });
      toast.success(post.fixado ? 'Publicação desafixada' : 'Publicação fixada');
      setPost({ ...post, fixado: !post.fixado });
    } catch {
      toast.error('Erro', 'Não foi possível actualizar a publicação.');
    }
  }

  async function confirmarRemocao() {
    if (!confirmar || !post) return;
    setRemovendo(true);
    try {
      if (confirmar.tipo === 'post') {
        await comunidadeService.remover(post.id);
        toast.success('Publicação removida');
        setConfirmar(null);
        voltar();
        return;
      }
      await comunidadeService.removerComentario(confirmar.comentario.id);
      setComentarioRemovido(confirmar.comentario.id);
      setPost({ ...post, total_comentarios: Math.max(0, post.total_comentarios - 1) });
      toast.success('Comentário removido');
      setConfirmar(null);
    } catch {
      toast.error('Erro ao remover', 'Tenta novamente.');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={voltar} leftIcon={<ArrowLeft className="h-4 w-4" />}>
        Voltar às notícias
      </Button>

      {estado === 'loading' && <SkeletonCard />}

      {estado === 'erro' && (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm text-navy-500">Esta publicação não existe ou foi removida.</p>
          <Button variant="secondary" className="mt-4" onClick={voltar}>Ver todas as notícias</Button>
        </div>
      )}

      {estado === 'ok' && post && (
        <NoticiaLeitura
          post={post}
          isAdmin={isAdmin}
          userId={user?.id ?? null}
          comentarioRemovido={comentarioRemovido}
          onGostar={gostar}
          onEditar={() => setEditar(true)}
          onFixar={alternarFixado}
          onRemover={() => setConfirmar({ tipo: 'post' })}
          onRemoverComentario={(comentario) => setConfirmar({ tipo: 'comentario', comentario })}
          onComentado={() => setPost((p) => (p ? { ...p, total_comentarios: p.total_comentarios + 1 } : p))}
        />
      )}

      {editar && post && (
        <Dialog open onClose={() => setEditar(false)} className="max-w-4xl">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Editar publicação</h2>
          <PostForm
            post={post}
            onCancel={() => setEditar(false)}
            onSaved={() => {
              setEditar(false);
              carregar();
            }}
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        onConfirm={confirmarRemocao}
        title={confirmar?.tipo === 'comentario' ? 'Remover comentário?' : 'Remover publicação?'}
        description={
          confirmar?.tipo === 'comentario'
            ? 'O comentário será removido permanentemente.'
            : 'A publicação, as reacções e os comentários serão removidos permanentemente.'
        }
        confirmLabel="Sim, remover"
        destructive
        loading={removendo}
      />
    </div>
  );
}
