import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  GraduationCap,
  HeartPulse,
  Palmtree,
  BarChart3,
  Plus,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/src/store/auth.store';
import { agentService } from '@/src/services/agent.service';
import { agentConfigService } from '@/src/services/agent-config.service';
import {
  extractInlineFontes,
  renderUiBlock,
  stripInlineFontes,
} from '@/src/components/assistente/genui/blocks';
import { MessageBubble, ThinkingIndicator } from '@/src/components/assistente/MessageBubble';
import type { UiBlock, ChatFonte } from '@/src/components/assistente/genui/types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  { label: 'Férias', prompt: 'Quantos dias de férias tenho?', icon: Palmtree },
  { label: 'Seguro de saúde', prompt: 'Como funciona o seguro de saúde?', icon: HeartPulse },
  { label: 'Avaliação', prompt: 'Qual é o processo de avaliação de desempenho?', icon: BarChart3 },
  { label: 'Formação', prompt: 'Como peço formação na Academia Pumangol?', icon: GraduationCap },
  { label: 'Base de conhecimento', prompt: 'Que documentos tens na base de conhecimento?', icon: BookOpen },
];

const SESSION_KEY_PREFIX = 'pumangol_chat_sessao_id';

function getSessionKey(userId: string): string {
  return `${SESSION_KEY_PREFIX}:${userId}`;
}

function safeUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  markdown?: string;
  ui_blocks?: UiBlock[];
  fontes?: ChatFonte[];
  precisa_escalar?: boolean;
  latencia_ms?: number;
  timestamp: string;
  satisfacao?: 1 | 0 | null;
}

function cleanBlocks(
  blocks: UiBlock[] | undefined,
  markdown: string,
  fontes?: ChatFonte[]
): UiBlock[] {
  const cleanMd = stripInlineFontes(
    markdown
      .replace(/\n*---\n\*Modo demo[\s\S]*$/i, '')
      .replace(/\n*\*Modo demo[\s\S]*$/i, '')
      .trim()
  );

  // Fontes: API + citadas no texto, sem duplicados
  const mergedFontes = (() => {
    const seen = new Set<string>();
    const out: ChatFonte[] = [];
    for (const f of [...(fontes ?? []), ...extractInlineFontes(markdown)]) {
      const key = `${f.origem ?? ''}|${f.titulo.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  })();

  let list = (blocks?.length ? blocks : [{ component: 'MarkdownBody' as const, props: { markdown: cleanMd } }])
    .filter((b) => b.component !== 'ContactDpc' && b.component !== 'EscalationConfirm')
    .map((b) => {
      if (b.component === 'MarkdownBody') {
        return {
          ...b,
          props: {
            markdown: stripInlineFontes(
              b.props.markdown
                .replace(/\n*---\n\*Modo demo[\s\S]*$/i, '')
                .replace(/\n*\*Modo demo[\s\S]*$/i, '')
                .trim() || cleanMd
            ),
          },
        };
      }
      if (b.component === 'SourceList') {
        return { ...b, props: { fontes: mergedFontes.length ? mergedFontes : b.props.fontes } };
      }
      return b;
    });

  // Garantir um único SourceList no fim
  list = list.filter((b) => b.component !== 'SourceList');
  if (mergedFontes.length) {
    list = [...list, { component: 'SourceList', props: { fontes: mergedFontes } }];
  } else if (!list.some((b) => b.component === 'MarkdownBody')) {
    list = [{ component: 'MarkdownBody', props: { markdown: cleanMd } }, ...list];
  }

  return list;
}

export default function AiAssistant() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isColaborador = user?.role === 'novo_colaborador';
  const primeiroNome = user?.nome?.split(' ')[0] ?? '';

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [boasVindas, setBoasVindas] = useState(
    'Políticas, benefícios, onboarding e documentos oficiais — com respostas da base de conhecimento Pumangol.'
  );
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUp = useRef(false);

  const isEmpty = messages.length === 0 && !isTyping;

  useEffect(() => {
    let cancelled = false;
    agentConfigService
      .getPublic()
      .then((cfg) => {
        if (!cancelled && cfg.mensagem_boas_vindas?.trim()) {
          setBoasVindas(cfg.mensagem_boas_vindas.trim());
        }
      })
      .catch(() => {
        /* defaults ok */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset in-memory messages before loading the session for a different account.
  useEffect(() => {
    setMessages([]);
    setInput('');
    setSessaoId(null);

    if (!user?.id) return;
    try {
      setSessaoId(sessionStorage.getItem(getSessionKey(user.id)));
    } catch {
      // sessionStorage unavailable: start a new conversation.
    }
  }, [user?.id]);
  const scrollToBottom = useCallback((force = false) => {
    if (force || !userScrolledUp.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUp.current = dist > 100;
      setShowScrollBtn(dist > 200);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (!isTyping) {
      setThinkingStage(0);
      return;
    }
    const t1 = setTimeout(() => setThinkingStage(1), 2200);
    const t2 = setTimeout(() => setThinkingStage(2), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isTyping]);

  useEffect(() => {
    if (!sessaoId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const msgs = await agentService.obterMensagens(sessaoId);
        if (cancelled || !msgs.length) return;
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: (m.papel === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.conteudo,
            markdown:
              m.papel === 'assistant'
                ? m.conteudo.replace(/\n*---\n\*Modo demo[\s\S]*$/i, '')
                : undefined,
            ui_blocks:
              m.papel === 'assistant'
                ? cleanBlocks(
                    undefined,
                    m.conteudo
                      .replace(/\n*---\n\*Modo demo[\s\S]*$/i, '')
                      .replace(/\n*\*Modo demo[\s\S]*$/i, ''),
                    extractInlineFontes(m.conteudo)
                  )
                : undefined,
            precisa_escalar: m.escalada_para_dpc ?? false,
            latencia_ms: m.latencia_ms ?? undefined,
            satisfacao: (m.satisfacao === 1 || m.satisfacao === 0 ? m.satisfacao : null) as
              | 0
              | 1
              | null,
            timestamp: m.created_at,
          }))
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId, user?.id]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;

    userScrolledUp.current = false;
    setMessages((prev) => [
      ...prev,
      { id: safeUuid(), role: 'user', content: msg, timestamp: new Date().toISOString() },
    ]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const result = await agentService.turn({
        pergunta: msg,
        sessao_id: sessaoId ?? undefined,
      });

      if (result.sessao_id !== sessaoId) {
        setSessaoId(result.sessao_id);
        try {
          if (user?.id) sessionStorage.setItem(getSessionKey(user.id), result.sessao_id);
        } catch {
          /* noop */
        }
      }

      const md = (result.markdown || result.resposta || '')
        .replace(/\n*---\n\*Modo demo[\s\S]*$/i, '')
        .replace(/\n*\*Modo demo[\s\S]*$/i, '')
        .trim();

      const blocks = cleanBlocks(result.ui_blocks, md, result.fontes);

      setMessages((prev) => [
        ...prev,
        {
          id: result.mensagem_id,
          role: 'assistant',
          content: result.resposta,
          markdown: md,
          ui_blocks: blocks,
          fontes: result.fontes,
          precisa_escalar: result.precisa_escalar,
          latencia_ms: result.latencia_ms,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      console.error('agent turn error', err);
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number; data?: { error?: string } } }).response?.status
          : undefined;
      const apiMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      const msgText =
        status === 401
          ? 'Sessão expirada. Faz login novamente.'
          : status === 500 || status === 504
            ? 'O agente demorou demasiado ou falhou no servidor. Tenta de novo.'
            : apiMsg ||
              (err instanceof Error ? err.message : 'Não consegui processar a pergunta. Tenta de novo.');
      setMessages((prev) => [
        ...prev,
        {
          id: safeUuid(),
          role: 'assistant',
          content: msgText,
          markdown: msgText,
          ui_blocks: [{ component: 'MarkdownBody', props: { markdown: msgText } }],
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  function novaConversa() {
    try {
      if (user?.id) sessionStorage.removeItem(getSessionKey(user.id));
    } catch {
      /* noop */
    }
    setSessaoId(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  }

  async function feedback(id: string, positive: boolean) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, satisfacao: positive ? 1 : 0 } : m))
    );
    try {
      await agentService.feedback(id, positive);
    } catch {
      /* ignore */
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  const thinkingLabels = [
    'A pensar…',
    'A consultar a base de conhecimento…',
    'A compor a resposta…',
  ];

  return (
    <div className="agent-shell -m-4 flex h-[calc(100vh-4.5rem)] flex-col md:-m-6 lg:-m-8 lg:h-[calc(100vh-5rem)]">
      {/* Soft brand background */}
      <div className="agent-shell-bg" aria-hidden />

      {/* Header */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-navy-100/60 bg-white/55 px-3 backdrop-blur-xl sm:px-5">
        {isColaborador && (
          <button
            type="button"
            onClick={() => navigate('/onboarding/meu-trilho')}
            className="rounded-xl p-2 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, #3FCE7C 0%, #17B85F 50%, #1A5334 160%)',
              boxShadow: '0 2px 10px rgba(23,184,95,0.35)',
            }}
          >
            <span className="text-[11px] font-bold text-white">DPC</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-tight text-navy-900">Agente DPC</p>
            <p className="text-[11px] text-navy-400">Pumangol People Connect</p>
          </div>
        </div>
        <button
          type="button"
          onClick={novaConversa}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-navy-600 shadow-sm transition hover:border-gold-300 hover:text-navy-900"
        >
          <SquarePen className="h-3.5 w-3.5 text-gold-600" />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="agent-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-3 sm:px-6">
        {showScrollBtn && (
          <button
            type="button"
            onClick={() => {
              userScrolledUp.current = false;
              scrollToBottom(true);
            }}
            className="fixed bottom-28 right-5 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 text-navy-900 shadow-lg transition hover:bg-gold-600"
            aria-label="Ir para o final"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}

        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col pb-36 pt-6">
          {/* Empty hero — Lweji-inspired */}
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-200/60 bg-white/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-800 shadow-sm backdrop-blur-md">
                Direcção de Pessoas e Culturas
              </div>
              <h1 className="max-w-lg text-[28px] font-semibold tracking-tight text-navy-900 sm:text-[34px]">
                {primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
              </h1>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-navy-500">
                {boasVindas}
              </p>

              <div className="mt-10 flex flex-wrap justify-center gap-2.5">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.label}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => handleSend(s.prompt)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-4 py-2.5 text-[13px] font-medium text-navy-700 shadow-[0_4px_16px_rgba(27,43,75,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-[0_12px_28px_rgba(200,169,81,0.12)]"
                  >
                    <s.icon className="h-3.5 w-3.5 text-gold-600" />
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          <div className="space-y-7">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
                  >
                    {isUser ? (
                      <MessageBubble role="user">{msg.content}</MessageBubble>
                    ) : (
                      <div className="w-full max-w-[min(100%,40rem)]">
                        <MessageBubble role="assistant">
                          {msg.ui_blocks?.length
                            ? msg.ui_blocks.map((block, i) => (
                                <div key={`${msg.id}-b-${i}`} className={i > 0 ? 'mt-1' : ''}>
                                  {renderUiBlock(block, { onPrompt: handleSend })}
                                </div>
                              ))
                            : renderUiBlock({
                                component: 'MarkdownBody',
                                props: { markdown: msg.markdown || msg.content },
                              })}
                        </MessageBubble>

                        <div className="mt-1.5 ml-11 flex items-center gap-0.5 opacity-0 transition-opacity [.w-full:hover_&]:opacity-100">
                          <button
                            type="button"
                            onClick={() => feedback(msg.id, true)}
                            className={cn(
                              'rounded-md p-1.5 text-navy-300 transition hover:bg-navy-50 hover:text-navy-600',
                              msg.satisfacao === 1 && 'text-success-600'
                            )}
                            aria-label="Útil"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => feedback(msg.id, false)}
                            className={cn(
                              'rounded-md p-1.5 text-navy-300 transition hover:bg-navy-50 hover:text-navy-600',
                              msg.satisfacao === 0 && 'text-error-500'
                            )}
                            aria-label="Não útil"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          {msg.latencia_ms != null && (
                            <span className="ml-1 text-[10.5px] text-navy-300">
                              {(msg.latencia_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <MessageBubble role="assistant">
                  <ThinkingIndicator label={thinkingLabels[thinkingStage] ?? thinkingLabels[0]} />
                </MessageBubble>
              </motion.div>
            )}

            <div ref={endRef} />
          </div>
        </div>
      </div>

      {/* Composer — Lweji frosted style */}
      <div className="relative z-20 shrink-0 px-3 pb-4 pt-1 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="agent-composer mx-auto w-full max-w-3xl"
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={onKey}
            placeholder="Pergunta sobre políticas, benefícios, onboarding…"
            disabled={isTyping}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-navy-800 placeholder:text-navy-300 focus:outline-none disabled:opacity-50"
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={novaConversa}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova</span>
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full transition',
                input.trim() && !isTyping
                  ? 'bg-gold-500 text-navy-900 shadow-[0_4px_14px_rgba(23,184,95,0.4)] hover:bg-gold-600'
                  : 'bg-navy-100 text-navy-300'
              )}
              aria-label="Enviar"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-navy-300">
          Respostas com base em documentos e FAQs oficiais da DPC.
        </p>
      </div>
    </div>
  );
}
