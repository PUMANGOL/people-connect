import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Send, Square, RotateCcw, ThumbsUp, ThumbsDown, Minus, MessageCircleQuestion, ChevronRight, ChevronUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/src/store/auth.store';
import { useLoadingStore } from '@/src/store/loading.store';
import { pumukiService, type PumukiParametros } from '@/src/services/pumuki.service';
import { SUGESTOES_INICIAIS, PERGUNTAS_FREQUENTES, marcadorAPreencher } from './pumuki-perguntas';

/**
 * Assistente Pumuki — chat próprio sobre a API do Dify (via /api/dify).
 * - `PumukiConversa`: a conversa (cabeçalho, mensagens, caixa de texto), reutilizada
 *   na bolha flutuante e na página Assistente Virtual.
 * - `PumukiChat`: bolha flutuante (cara do Pumuki com ondas verdes) + janela.
 */

interface Mensagem {
  id: string;
  papel: 'utilizador' | 'pumuki';
  texto: string;
  messageId?: string;
  avaliacao?: 'like' | 'dislike' | null;
  erro?: boolean;
}

const AVATAR = '/pumuki-bolha.png';
let seq = 0;
const novoId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

interface PumukiConversaProps {
  /** `flutuante` = janela da bolha (com botão minimizar); `pagina` = página Assistente Virtual. */
  variante: 'flutuante' | 'pagina';
  onMinimizar?: () => void;
  className?: string;
}

export function PumukiConversa({ variante, onMinimizar, className }: PumukiConversaProps) {
  const { user } = useAuthStore();
  const chaveConversa = user?.id ? `pumuki-conversa-${user.id}` : null;

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [parametros, setParametros] = useState<PumukiParametros | null>(null);
  const [texto, setTexto] = useState('');
  const [aResponder, setAResponder] = useState(false);
  const [aCarregar, setACarregar] = useState(false);
  const [inicializado, setInicializado] = useState(false);
  const [mostrarFaq, setMostrarFaq] = useState(false);

  const taskIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const guardarConversa = useCallback((id: string | null) => {
    setConversationId(id);
    if (!chaveConversa) return;
    try {
      if (id) localStorage.setItem(chaveConversa, id);
      else localStorage.removeItem(chaveConversa);
    } catch { /* storage indisponível */ }
  }, [chaveConversa]);

  // Ao montar (abrir a janela ou a página): parâmetros da app + histórico da última conversa
  useEffect(() => {
    if (inicializado || !chaveConversa) return;
    setInicializado(true);
    pumukiService.parametros().then(setParametros).catch(() => setParametros(null));
    let guardada: string | null = null;
    try { guardada = localStorage.getItem(chaveConversa); } catch { /* ignore */ }
    if (!guardada) return;
    setConversationId(guardada);
    setACarregar(true);
    pumukiService
      .mensagens(guardada)
      .then((hist) => {
        const ordenadas = [...hist].sort((a, b) => a.criada_em - b.criada_em);
        setMensagens(ordenadas.flatMap((m) => [
          { id: `${m.id}-p`, papel: 'utilizador' as const, texto: m.pergunta },
          { id: `${m.id}-r`, papel: 'pumuki' as const, texto: m.resposta, messageId: m.id, avaliacao: m.avaliacao },
        ]));
      })
      .catch(() => guardarConversa(null)) // conversa expirada: começa do zero
      .finally(() => setACarregar(false));
  }, [inicializado, chaveConversa, guardarConversa]);

  // Rolar para a última mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens]);

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Ao desmontar (ex.: terminar sessão) cancela a resposta em curso
  useEffect(() => () => abortRef.current?.abort(), []);

  function actualizar(id: string, patch: Partial<Mensagem> | ((m: Mensagem) => Partial<Mensagem>)) {
    setMensagens((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));
  }

  async function perguntar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || aResponder) return;
    setTexto('');
    const idResposta = novoId();
    setMensagens((prev) => [
      ...prev,
      { id: novoId(), papel: 'utilizador', texto: q },
      { id: idResposta, papel: 'pumuki', texto: '' },
    ]);
    setAResponder(true);
    taskIdRef.current = null;

    const executar = async (conversa: string | null) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return pumukiService.enviar(q, conversa, {
        onTexto: (pedaco) => actualizar(idResposta, (m) => ({ texto: m.texto + pedaco })),
        onSubstituir: (t) => actualizar(idResposta, { texto: t }),
        onIds: ({ conversationId: c, messageId, taskId }) => {
          if (c && c !== conversa) guardarConversa(c);
          if (messageId) actualizar(idResposta, { messageId });
          if (taskId) taskIdRef.current = taskId;
        },
        onErro: (msg) => actualizar(idResposta, { texto: msg, erro: true }),
      }, controller.signal);
    };

    let resultado = await executar(conversationId);
    if (resultado === 'conversa_inexistente') {
      // A conversa guardada já não existe no Dify: recomeça numa nova, com a mesma pergunta.
      guardarConversa(null);
      resultado = await executar(null);
    }
    if (resultado === 'cancelado') {
      actualizar(idResposta, (m) => ({ texto: m.texto || '_Resposta interrompida._' }));
    }
    abortRef.current = null;
    taskIdRef.current = null;
    setAResponder(false);
    inputRef.current?.focus();
  }

  function parar() {
    const taskId = taskIdRef.current;
    abortRef.current?.abort();
    if (taskId) pumukiService.parar(taskId).catch(() => { /* já terminou */ });
  }

  function novaConversa() {
    if (aResponder) parar();
    guardarConversa(null);
    setMensagens([]);
    inputRef.current?.focus();
  }

  async function avaliar(m: Mensagem, rating: 'like' | 'dislike') {
    if (!m.messageId) return;
    const novo = m.avaliacao === rating ? null : rating;
    actualizar(m.id, { avaliacao: novo });
    try {
      await pumukiService.avaliar(m.messageId, novo);
    } catch {
      actualizar(m.id, { avaliacao: m.avaliacao ?? null });
    }
  }

  /** Pergunta da lista: envia logo; se for um modelo ("posto X", "[nome]"), põe-na na caixa com o marcador seleccionado. */
  function escolherPergunta(q: string) {
    setMostrarFaq(false);
    const marcador = marcadorAPreencher(q);
    if (!marcador) {
      perguntar(q);
      return;
    }
    setTexto(q);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(marcador.inicio, marcador.fim);
    }, 30);
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    perguntar(texto);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      perguntar(texto);
    }
  }

  const pagina = variante === 'pagina';
  const primeiroNome = user?.nome?.split(' ')[0] ?? '';
  const abertura = parametros?.mensagem_abertura?.trim()
    || `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Sou o **Pumuki**, o assistente virtual da Pumangol. Em que posso ajudar?`;
  // Sugestões do ecrã inicial: as nossas perguntas frequentes; as do Dify (se existirem) entram no fim.
  const sugestoes = [
    ...SUGESTOES_INICIAIS,
    ...(parametros?.perguntas_sugeridas ?? []).filter((q) => !SUGESTOES_INICIAIS.includes(q)),
  ];

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* Na página não há cartão: cabeçalho e conversa assentam directamente no fundo da página. */}
      {/* Cabeçalho */}
      <header
        className={cn(
          'flex items-center gap-3',
          pagina ? 'border-b border-[#E2E6EB] pb-4 dark:border-white/10' : 'bg-[#006341] px-4 py-3 text-white',
        )}
      >
        <img
          src={AVATAR}
          alt=""
          className={cn('shrink-0 rounded-full bg-white object-cover ring-2 ring-[#3DD68C]', pagina ? 'h-12 w-12' : 'h-10 w-10')}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cn('font-bold', pagina ? 'text-xl text-navy-900' : 'text-sm')}>Pumuki</p>
          <p className={cn('flex items-center gap-1.5 text-xs', pagina ? 'text-navy-500' : 'text-white/80')}>
            <span className="h-2 w-2 rounded-full bg-[#3DD68C]" /> Assistente Virtual
          </p>
        </div>
        <button
          type="button"
          onClick={novaConversa}
          title="Nova conversa"
          aria-label="Nova conversa"
          className={cn(
            'rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
            pagina
              ? 'inline-flex items-center gap-2 border border-[#D5DBE2] bg-white px-4 text-sm font-semibold text-navy-700 hover:bg-[#F3F5F7] focus-visible:ring-[#3DD68C]/60 dark:border-white/15'
              : 'text-white/85 hover:bg-white/10 hover:text-white focus-visible:ring-white/60',
          )}
        >
          <RotateCcw className="h-4 w-4" />
          {pagina && 'Nova conversa'}
        </button>
        {variante === 'flutuante' && onMinimizar && (
          <button
            type="button"
            onClick={onMinimizar}
            title="Minimizar (Esc)"
            aria-label="Minimizar"
            className="rounded-full p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Mensagens */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          'flex-1 space-y-4 overflow-y-auto',
          pagina ? 'py-6' : 'bg-[#F3F5F7] px-4 py-4 dark:bg-white/[0.02]',
        )}
        aria-live="polite"
      >
        {aCarregar ? (
          <p className="py-8 text-center text-sm text-navy-400">A carregar a conversa…</p>
        ) : (
          <>
            <BalaoPumuki>
              <Markdown texto={abertura} />
            </BalaoPumuki>

            {mensagens.length === 0 && sugestoes.length > 0 && (
              <div className="space-y-2 pl-10">
              <p className="text-xs font-semibold text-navy-500">Perguntas rápidas</p>
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => escolherPergunta(s)}
                    className="rounded-full border border-[#006341]/25 bg-white px-3 py-1.5 text-left text-xs font-semibold text-[#006341] transition-colors hover:bg-[#DDF5E8] dark:text-[#5EE6A8]"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMostrarFaq(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006341] hover:underline dark:text-[#5EE6A8]"
              >
                <MessageCircleQuestion className="h-3.5 w-3.5" /> Ver todas as perguntas frequentes
              </button>
              </div>
            )}

            {mensagens.map((m) =>
              m.papel === 'utilizador' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#006341] px-3.5 py-2.5 text-sm text-white">
                    {m.texto}
                  </p>
                </div>
              ) : (
                <div key={m.id}>
                  <BalaoPumuki erro={m.erro}>
                    {m.texto ? <Markdown texto={m.texto} /> : <AEscrever />}
                  </BalaoPumuki>
                  {m.messageId && m.texto && !m.erro && !(aResponder && m.id === mensagens[mensagens.length - 1]?.id) && (
                    <div className="mt-1 flex gap-1 pl-10">
                      <BotaoAvaliar activo={m.avaliacao === 'like'} onClick={() => avaliar(m, 'like')} label="Resposta útil">
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </BotaoAvaliar>
                      <BotaoAvaliar activo={m.avaliacao === 'dislike'} onClick={() => avaliar(m, 'dislike')} label="Resposta pouco útil">
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </BotaoAvaliar>
                    </div>
                  )}
                </div>
              ),
            )}
          </>
        )}
        <div ref={fimRef} />
      </div>
      </div>

      {/* Escrever */}
      <form
        onSubmit={submeter}
        className={cn('relative', pagina ? 'pt-2' : 'border-t border-[#EDF0F3] bg-white p-3 dark:border-white/10')}
      >
        {/* Perguntas frequentes: botão por cima da caixa de texto; menu com submenus ao passar o rato */}
        <div className="mb-2">
          <FaqMenu
            aberto={mostrarFaq}
            pagina={pagina}
            onAlternar={() => setMostrarFaq((v) => !v)}
            onFechar={() => setMostrarFaq(false)}
            onEscolher={escolherPergunta}
          />
        </div>
        <div className="flex items-end gap-1.5 rounded-lg border border-input bg-white py-1 pl-3 pr-1 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-focus dark:bg-card">
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={4000}
            placeholder="Escreva a sua pergunta…"
            aria-label="Pergunta para o Pumuki"
            className="max-h-32 min-h-[24px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-foreground shadow-none outline-none placeholder:text-neutral-400 focus-visible:shadow-none [field-sizing:content]"
          />
          {aResponder ? (
            <button
              type="button"
              onClick={parar}
              title="Parar resposta"
              aria-label="Parar resposta"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-white hover:bg-neutral-900 dark:bg-neutral-200 dark:text-neutral-900"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!texto.trim()}
              title="Enviar"
              aria-label="Enviar"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-navy-800 disabled:bg-neutral-200 disabled:text-neutral-500 dark:hover:bg-gold-600 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-neutral-400">
          O Pumuki pode cometer erros. Confirme informações importantes com a DPC.
        </p>
      </form>
    </div>
  );
}

/** Bolha flutuante + janela. Escondida na própria página do Assistente Virtual. */
export function PumukiChat() {
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  // Escondido (sem desmontar — a conversa mantém-se) enquanto o loader global estiver no ecrã.
  const comLoader = useLoadingStore((s) => s.loadersVisiveis > 0);

  // Esc fecha a janela
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  if (pathname === '/assistente' || pathname.startsWith('/assistente/')) return null;

  return (
    <div className={cn(comLoader && 'hidden')} aria-hidden={comLoader || undefined}>
      {aberto && (
        <section
          role="dialog"
          aria-label="Pumuki, assistente virtual"
          className={cn(
            'fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-[#E2E6EB] bg-white shadow-[0_24px_48px_rgba(18,52,63,0.22)]',
            'dark:border-white/10 dark:shadow-[0_24px_48px_rgba(0,0,0,0.5)]',
            // Desktop: acima da bolha. Mobile: quase ecrã inteiro, por baixo da barra de topo.
            'inset-x-2 top-[75px] bottom-[84px] sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-[calc(1.5rem+52px+12px)] sm:h-[40rem] sm:max-h-[calc(100vh-67px-1.5rem-64px-1rem)] sm:w-[24rem]',
          )}
        >
          <PumukiConversa variante="flutuante" onMinimizar={() => setAberto(false)} className="h-full" />
        </section>
      )}
      {/* Bolha */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title={aberto ? 'Fechar o Pumuki (Esc)' : 'Falar com o Pumuki'}
        aria-label={aberto ? 'Fechar o Pumuki' : 'Abrir o Pumuki, assistente virtual'}
        aria-expanded={aberto}
        className={cn(
          'fixed bottom-6 right-6 z-[60] flex h-[52px] w-[52px] items-center justify-center rounded-full transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5EE6A8] focus-visible:ring-offset-2',
          aberto
            ? 'bg-[#006341] text-white shadow-[0_8px_20px_rgba(0,99,65,0.35)] hover:bg-[#01754D]'
            : 'pumuki-bolha bg-[#FFFFFF] shadow-[0_0_0_2px_#006341,0_8px_20px_rgba(0,99,65,0.35)]',
        )}
      >
        {aberto ? <X className="h-6 w-6" /> : <img src={AVATAR} alt="" className="h-[92%] w-[92%] rounded-full object-cover" />}
      </button>
    </div>
  );
}

/**
 * Menu de perguntas frequentes (abre para cima, por cima da caixa de texto).
 * Temas com ">"; ao passar o rato (ou tocar) num tema abre o submenu com as perguntas.
 * Fecha ao escolher, ao clicar fora ou com Esc.
 *
 * O painel é desenhado num portal (no <body>) com posição fixa calculada a partir do botão:
 * fica sempre por cima de tudo (cabeçalho do chat, barra de topo) e não é cortado pela
 * janela da bolha. A altura ajusta-se ao espaço disponível acima do botão.
 */
function FaqMenu({
  aberto, pagina, onAlternar, onFechar, onEscolher,
}: {
  aberto: boolean;
  pagina: boolean;
  onAlternar: () => void;
  onFechar: () => void;
  onEscolher: (q: string) => void;
}) {
  const [tema, setTema] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ left: number; bottom: number; alturaMax: number } | null>(null);
  const categoria = PERGUNTAS_FREQUENTES.find((c) => c.titulo === tema) ?? null;

  // Posição do painel: logo acima do botão, alinhado à esquerda, sem passar por baixo da barra de topo.
  useEffect(() => {
    if (!aberto) {
      setPosicao(null);
      return;
    }
    const calcular = () => {
      const r = botaoRef.current?.getBoundingClientRect();
      if (!r) return;
      const MARGEM = 8;
      const TOPO = 67 + MARGEM; // barra de topo fixa (64px) + filete menta (3px)
      setPosicao({
        left: Math.max(MARGEM, r.left),
        bottom: window.innerHeight - r.top + MARGEM,
        alturaMax: Math.max(160, Math.min(352, r.top - MARGEM - TOPO)),
      });
    };
    calcular();
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);
    return () => {
      window.removeEventListener('resize', calcular);
      window.removeEventListener('scroll', calcular, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) {
      setTema(null);
      return;
    }
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (raizRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      onFechar();
    };
    // Esc fecha só o menu (não a janela do chat)
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onFechar();
      }
    };
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc, true);
    };
  }, [aberto, onFechar]);

  return (
    <div ref={raizRef} className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={onAlternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD68C]/60',
          aberto
            ? 'border-[#006341] bg-[#DDF5E8] text-[#0B5E35] dark:bg-[rgba(94,230,168,0.16)] dark:text-[#5EE6A8]'
            : 'border-[#D5DBE2] bg-white text-navy-700 hover:border-[#006341] hover:text-[#006341] dark:border-white/15',
        )}
      >
        <MessageCircleQuestion className="h-3.5 w-3.5" />
        Perguntas frequentes
        <ChevronUp className={cn('h-3.5 w-3.5 transition-transform', !aberto && 'rotate-180')} />
      </button>

      {aberto && posicao && createPortal(
        <div
          ref={painelRef}
          className="fixed z-[80] flex items-end gap-1.5"
          style={{ left: posicao.left, bottom: posicao.bottom }}
        >
          {/* Temas */}
          <ul
            role="menu"
            aria-label="Temas das perguntas frequentes"
            className={cn(
              'overflow-y-auto rounded-xl border border-[#E2E6EB] bg-white py-1.5 shadow-[0_12px_32px_rgba(18,52,63,0.18)] dark:border-white/10',
              pagina ? 'w-60' : 'w-40',
            )}
            style={{ maxHeight: posicao.alturaMax }}
          >
            {PERGUNTAS_FREQUENTES.map((c) => {
              const activo = c.titulo === tema;
              return (
                <li key={c.titulo} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={activo}
                    onMouseEnter={() => setTema(c.titulo)}
                    onFocus={() => setTema(c.titulo)}
                    onClick={() => setTema(c.titulo)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors',
                      activo
                        ? 'bg-[#DDF5E8] font-semibold text-[#0B5E35] dark:bg-[rgba(94,230,168,0.14)] dark:text-[#5EE6A8]'
                        : 'text-navy-700 hover:bg-[#F3F5F7] dark:hover:bg-white/5',
                    )}
                  >
                    <span className="min-w-0">{c.titulo}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Submenu com as perguntas do tema */}
          {categoria && (
            <ul
              role="menu"
              aria-label={categoria.titulo}
              className={cn(
                'overflow-y-auto rounded-xl border border-[#E2E6EB] bg-white py-1.5 shadow-[0_12px_32px_rgba(18,52,63,0.18)] dark:border-white/10',
                pagina ? 'w-[26rem]' : 'w-[14rem]',
              )}
              style={{ maxHeight: posicao.alturaMax }}
            >
              <li role="none" className="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-navy-400">
                {categoria.titulo}
              </li>
              {categoria.perguntas.map((q) => (
                <li key={q} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => onEscolher(q)}
                    className="w-full px-3 py-2 text-left text-[13px] leading-snug text-navy-700 transition-colors hover:bg-[#DDF5E8] hover:text-[#0B5E35] focus-visible:bg-[#DDF5E8] focus-visible:outline-none dark:hover:bg-[rgba(94,230,168,0.12)] dark:hover:text-[#5EE6A8]"
                  >
                    {q}
                    {marcadorAPreencher(q) && <span className="ml-1.5 text-[11px] text-navy-400">(completar)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function BalaoPumuki({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <img src={AVATAR} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-white object-cover ring-1 ring-[#E2E6EB]" />
      <div
        className={cn(
          'max-w-[85%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm shadow-sm',
          erro
            ? 'border border-error-100 bg-error-50 text-error-700'
            : 'border border-[#E2E6EB] bg-white text-navy-800 dark:border-white/10',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Markdown({ texto }: { texto: string }) {
  return (
    <div className="rich-text text-sm [&>*+*]:mt-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}

function AEscrever() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="O Pumuki está a escrever">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#3DD68C]" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function BotaoAvaliar({
  activo, onClick, label, children,
}: { activo: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={activo}
      className={cn(
        'rounded-full p-1.5 transition-colors',
        activo ? 'bg-[#DDF5E8] text-[#0B5E35] dark:bg-[rgba(94,230,168,0.16)] dark:text-[#5EE6A8]' : 'text-neutral-400 hover:bg-white hover:text-navy-700',
      )}
    >
      {children}
    </button>
  );
}
