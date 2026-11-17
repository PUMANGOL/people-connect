import { useEffect, useRef, useState } from 'react';
import { Video, Save, ExternalLink, Trash2, Plus, GripVertical, ChevronUp, ChevronDown, ListChecks, PartyPopper } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { toast } from '@/src/store';
import { welcomeVideosService, quizService, type WelcomeVideo } from '@/src/services/onboarding-v2.service';
import { SkeletonCard } from '@/src/components/ui/skeleton';
import { ConfirmDialog, Dialog } from '@/src/components/ui/dialog';
import { cn } from '@/lib/utils';

const SLOT_LABEL: Record<string, string> = {
  institucional:       'Vídeo Institucional Pumangol (PCE)',
  hse:                 'HSE — Segurança, Higiene e Ambiente',
  dpc_beneficios:      'DPC · Benefícios e Compensação',
  dpc_avaliacao:       'DPC · Avaliação de Desempenho',
  dpc_saude_bemestar:  'DPC · Saúde e Bem-Estar',
  dpc_formacao:        'DPC · Formação e Desenvolvimento',
  // Compat: se o slot antigo ainda estiver na BD por algum motivo,
  // ainda mostra um label legível até a migração 017 correr.
  saude_seguranca:     'Vídeo de Saúde e Segurança (antigo)',
};

/** Nome a mostrar: rótulo fixo dos slots oficiais ou o título dos vídeos adicionados. */
function nomeVideo(v: WelcomeVideo): string {
  return SLOT_LABEL[v.slot] ?? v.titulo ?? v.slot;
}

const NOVO_VIDEO = { titulo: '', url: '', descricao: '', duracao_minima_segundos: 20 };

/** Interruptor activo/desactivado de um passo. */
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? 'Activo — clica para desactivar' : 'Desactivado — clica para activar'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-success-500' : 'bg-navy-200',
      )}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

/** Move `slot` para a posição `destino`, devolvendo uma nova lista. */
function moverPara(lista: WelcomeVideo[], slot: string, destino: number): WelcomeVideo[] {
  const origem = lista.findIndex((v) => v.slot === slot);
  if (origem === -1 || destino < 0 || origem === destino) return lista;
  const nova = [...lista];
  const [item] = nova.splice(origem, 1);
  nova.splice(destino, 0, item);
  return nova;
}

export default function VideosAdminPage() {
  const [videos, setVideos] = useState<WelcomeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  const [removeVideo, setRemoveVideo] = useState<WelcomeVideo | null>(null);
  const [removing, setRemoving] = useState(false);
  const [novo, setNovo] = useState<typeof NOVO_VIDEO | null>(null);
  const [criando, setCriando] = useState(false);
  const [quizAtivo, setQuizAtivo] = useState(true);
  // Slot (ou 'quiz') cujo interruptor está a ser guardado.
  const [aAlternar, setAAlternar] = useState<string | null>(null);
  // Arrastar e soltar: slot arrastado e ordem antes de começar (para reverter em caso de erro).
  const [dragSlot, setDragSlot] = useState<string | null>(null);
  const ordemAntesDrag = useRef<WelcomeVideo[] | null>(null);

  useEffect(() => {
    Promise.all([
      welcomeVideosService.list().catch(() => [] as WelcomeVideo[]),
      quizService.getConfig().catch(() => null),
    ])
      .then(([rows, cfg]) => {
        // A API já devolve pela ordem do Welcome Flow.
        setVideos(rows);
        setQuizAtivo(cfg?.quiz_ativo ?? true);
      })
      .finally(() => setLoading(false));
  }, []);

  function setField(slot: string, field: keyof WelcomeVideo, value: string | number | boolean) {
    setVideos((prev) => prev.map((v) => (v.slot === slot ? { ...v, [field]: value } : v)));
  }

  async function guardarOrdem(nova: WelcomeVideo[], anterior: WelcomeVideo[]) {
    try {
      await welcomeVideosService.reordenar(nova.map((v) => v.slot));
      toast.success('Ordem actualizada');
    } catch {
      setVideos(anterior);
      toast.error('Erro ao guardar a ordem', 'Tenta novamente.');
    }
  }

  function mover(slot: string, delta: -1 | 1) {
    const destino = videos.findIndex((v) => v.slot === slot) + delta;
    if (destino < 0 || destino >= videos.length) return;
    const nova = moverPara(videos, slot, destino);
    setVideos(nova);
    guardarOrdem(nova, videos);
  }

  function onDragStart(e: React.DragEvent, slot: string) {
    e.dataTransfer.effectAllowed = 'move';
    setDragSlot(slot);
    ordemAntesDrag.current = videos;
  }

  function onDragOver(e: React.DragEvent, slotAlvo: string) {
    e.preventDefault();
    if (!dragSlot || dragSlot === slotAlvo) return;
    setVideos((prev) => moverPara(prev, dragSlot, prev.findIndex((v) => v.slot === slotAlvo)));
  }

  function onDragEnd() {
    const anterior = ordemAntesDrag.current;
    setDragSlot(null);
    ordemAntesDrag.current = null;
    if (!anterior || anterior.every((v, i) => v.slot === videos[i]?.slot)) return;
    guardarOrdem(videos, anterior);
  }

  async function alternarAtivo(v: WelcomeVideo, ativo: boolean) {
    setAAlternar(v.slot);
    setField(v.slot, 'ativo', ativo);
    try {
      await welcomeVideosService.update(v.slot, { ativo });
      toast.success(ativo ? 'Passo activado' : 'Passo desactivado', nomeVideo(v));
    } catch {
      setField(v.slot, 'ativo', !ativo);
      toast.error('Erro ao guardar', 'Tenta novamente.');
    } finally {
      setAAlternar(null);
    }
  }

  async function alternarQuiz(ativo: boolean) {
    setAAlternar('quiz');
    setQuizAtivo(ativo);
    try {
      await quizService.updateConfig({ quiz_ativo: ativo });
      toast.success(ativo ? 'Quiz activado' : 'Quiz desactivado');
    } catch {
      setQuizAtivo(!ativo);
      toast.error('Erro ao guardar', 'Tenta novamente.');
    } finally {
      setAAlternar(null);
    }
  }

  async function guardar(v: WelcomeVideo) {
    setSavingSlot(v.slot);
    try {
      await welcomeVideosService.update(v.slot, {
        titulo: v.titulo,
        url: v.url ?? '',
        descricao: v.descricao ?? '',
        duracao_minima_segundos: v.duracao_minima_segundos ?? 20,
      });
      toast.success('Vídeo guardado', nomeVideo(v));
    } catch {
      toast.error('Erro ao guardar', 'Tenta novamente.');
    } finally {
      setSavingSlot(null);
    }
  }

  async function handleCreate() {
    if (!novo) return;
    if (!novo.titulo.trim()) {
      toast.error('Indica o título do vídeo');
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(novo.url.trim())) {
      toast.error('URL inválido', 'Usa um endereço que comece por http:// ou https://');
      return;
    }
    setCriando(true);
    try {
      const criado = await welcomeVideosService.create({
        titulo: novo.titulo.trim(),
        url: novo.url.trim(),
        descricao: novo.descricao.trim(),
        duracao_minima_segundos: novo.duracao_minima_segundos,
      });
      setVideos((prev) => [...prev, criado]);
      toast.success('Vídeo adicionado', criado.titulo);
      setNovo(null);
    } catch {
      toast.error('Erro ao adicionar', 'Tenta novamente.');
    } finally {
      setCriando(false);
    }
  }

  async function handleRemove() {
    if (!removeVideo) return;
    setRemoving(true);
    try {
      await welcomeVideosService.remove(removeVideo.slot);
      setVideos((prev) => prev.filter((v) => v.slot !== removeVideo.slot));
      toast.success('Vídeo removido', nomeVideo(removeVideo));
      setRemoveVideo(null);
    } catch {
      toast.error('Erro ao remover', 'Tenta novamente.');
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-navy-800">Vídeos de Boas-Vindas</h1>
          <p className="mt-1 text-sm text-navy-400">Configura os vídeos apresentados no Welcome Flow. Aceita YouTube, Vimeo, Google Drive (link de partilha) ou URL directa (.mp4).</p>
        </div>
        <Button variant="accent" onClick={() => setNovo({ ...NOVO_VIDEO })} leftIcon={<Plus className="h-4 w-4" />}>
          Adicionar vídeo
        </Button>
      </div>

      {/* === Sequência do Welcome Flow — arrastar e soltar + activar/desactivar === */}
      <div className="rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Sequência do Welcome Flow</h2>
        <p className="mt-1 mb-4 text-xs text-navy-400">
          Arrasta os vídeos para mudar a ordem. Os passos desactivados não são apresentados ao colaborador, mas mantêm a configuração.
        </p>
        <ol className="space-y-2">
          {videos.map((v, i) => {
            const ativo = v.ativo !== false;
            return (
              <li
                key={v.slot}
                draggable
                onDragStart={(e) => onDragStart(e, v.slot)}
                onDragOver={(e) => onDragOver(e, v.slot)}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={onDragEnd}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                  dragSlot === v.slot ? 'border-gold-400 bg-gold-50' : 'border-navy-100 bg-white hover:bg-navy-50/50',
                  !ativo && 'opacity-60',
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-navy-300 active:cursor-grabbing" aria-hidden="true" />
                <span className="w-5 text-center text-xs font-semibold tabular-nums text-navy-400">{i + 1}</span>
                <Video className="h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                <span className={cn('min-w-0 flex-1 truncate text-sm text-navy-800', !ativo && 'line-through decoration-navy-300')}>
                  {nomeVideo(v)}
                </span>
                {!v.url && <span className="hidden sm:inline text-[11px] text-navy-400">Sem URL</span>}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => mover(v.slot, -1)}
                    disabled={i === 0}
                    aria-label="Mover para cima"
                    className="rounded p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(v.slot, 1)}
                    disabled={i === videos.length - 1}
                    aria-label="Mover para baixo"
                    className="rounded p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <Toggle
                  checked={ativo}
                  disabled={aAlternar === v.slot}
                  onChange={(val) => alternarAtivo(v, val)}
                  label={`Activar ${nomeVideo(v)}`}
                />
              </li>
            );
          })}

          {/* Passos fixos no fim da sequência */}
          <li className={cn('flex items-center gap-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-3 py-2', !quizAtivo && 'opacity-60')}>
            <span className="w-4 shrink-0" />
            <span className="w-5 text-center text-xs font-semibold tabular-nums text-navy-400">{videos.length + 1}</span>
            <ListChecks className="h-4 w-4 shrink-0 text-navy-500" aria-hidden="true" />
            <span className={cn('flex-1 text-sm text-navy-800', !quizAtivo && 'line-through decoration-navy-300')}>Quiz de Boas-Vindas</span>
            <span className="hidden sm:inline text-[11px] text-navy-400">Sempre depois dos vídeos</span>
            <Toggle checked={quizAtivo} disabled={aAlternar === 'quiz'} onChange={alternarQuiz} label="Activar quiz" />
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-3 py-2">
            <span className="w-4 shrink-0" />
            <span className="w-5 text-center text-xs font-semibold tabular-nums text-navy-400">{videos.length + 2}</span>
            <PartyPopper className="h-4 w-4 shrink-0 text-navy-500" aria-hidden="true" />
            <span className="flex-1 text-sm text-navy-800">Conclusão</span>
            <span className="text-[11px] text-navy-400">Sempre apresentada</span>
          </li>
        </ol>
      </div>

      {videos.map((v) => (
        <div key={v.slot} className={cn('rounded-xl border border-navy-100 bg-white p-5 space-y-4', v.ativo === false && 'opacity-75')}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50">
              <Video className="h-5 w-5 text-gold-600" />
            </div>
            <h2 className="flex-1 font-semibold text-navy-800">
              {nomeVideo(v)}
              {v.ativo === false && (
                <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 align-middle text-[11px] font-medium text-navy-500">Desactivado</span>
              )}
            </h2>
            <button
              onClick={() => setRemoveVideo(v)}
              title="Remover"
              className="rounded-md p-1.5 text-error-400 transition-colors hover:bg-error-50 hover:text-error-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">Título</label>
            <Input value={v.titulo} onChange={(e) => setField(v.slot, 'titulo', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">URL do vídeo</label>
            <Input value={v.url ?? ''} placeholder="https://www.youtube.com/watch?v=…  ou  https://drive.google.com/file/d/.../view" onChange={(e) => setField(v.slot, 'url', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">Descrição</label>
            <Input value={v.descricao ?? ''} onChange={(e) => setField(v.slot, 'descricao', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">
              Duração mínima de visualização (segundos)
            </label>
            <Input
              type="number"
              min={0}
              max={600}
              value={String(v.duracao_minima_segundos ?? 20)}
              onChange={(e) => setField(v.slot, 'duracao_minima_segundos', Math.max(0, Math.min(600, Number(e.target.value) || 0)))}
              className="w-40"
            />
            <p className="mt-1 text-xs text-navy-400">
              Tempo antes de o botão "Continuar" activar em vídeos embebidos (Google Drive/YouTube não expõem progresso).
            </p>
          </div>

          <div className="flex items-center justify-between">
            {v.url ? (
              <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-gold-600 hover:underline">
                Pré-visualizar <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : <span />}
            <Button variant="accent" size="sm" disabled={savingSlot === v.slot} onClick={() => guardar(v)}>
              <span className="inline-flex items-center gap-1.5"><Save className="h-4 w-4" /> Guardar</span>
            </Button>
          </div>
        </div>
      ))}

      {videos.length === 0 && (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-8 text-center text-sm text-navy-400">
          Nenhum vídeo configurado. O Welcome Flow segue directamente para o quiz. Usa «Adicionar vídeo» para criar um.
        </div>
      )}

      {novo && (
        <Dialog open onClose={() => setNovo(null)} className="max-w-xl">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Adicionar vídeo</h2>
          <p className="mb-5 text-sm text-navy-400">Entra no fim da sequência de vídeos, antes do quiz. Podes reordená-lo depois.</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Título *</label>
              <Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={150} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">URL do vídeo *</label>
              <Input value={novo.url} placeholder="https://www.youtube.com/watch?v=…  ou  https://drive.google.com/file/d/.../view" onChange={(e) => setNovo({ ...novo, url: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Descrição</label>
              <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Duração mínima de visualização (segundos)</label>
              <Input
                type="number"
                min={0}
                max={600}
                value={String(novo.duracao_minima_segundos)}
                onChange={(e) => setNovo({ ...novo, duracao_minima_segundos: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })}
                className="w-40"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button>
            <Button variant="accent" loading={criando} onClick={handleCreate}>Adicionar</Button>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!removeVideo}
        onClose={() => setRemoveVideo(null)}
        onConfirm={handleRemove}
        title="Remover vídeo?"
        description={
          removeVideo
            ? `O vídeo "${nomeVideo(removeVideo)}" é apagado com toda a configuração. Esta acção é irreversível — para o esconder temporariamente, desactiva-o na sequência.`
            : ''
        }
        confirmLabel="Sim, remover"
        destructive
        loading={removing}
      />
    </div>
  );
}
