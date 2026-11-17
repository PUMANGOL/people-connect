import { apiClient } from './api.client';

/** Assistente Pumuki (Dify) — via proxy /api/dify. */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

export interface PumukiParametros {
  mensagem_abertura: string;
  perguntas_sugeridas: string[];
  sugestoes_apos_resposta: boolean;
}

export interface PumukiMensagemHistorico {
  id: string;
  pergunta: string;
  resposta: string;
  criada_em: number;
  avaliacao: 'like' | 'dislike' | null;
}

export interface PumukiConversa {
  id: string;
  nome: string;
  actualizada_em: number;
}

export interface StreamHandlers {
  /** Pedaço de texto da resposta (acumular). */
  onTexto: (pedaco: string) => void;
  /** Substitui todo o texto (moderação do Dify). */
  onSubstituir?: (texto: string) => void;
  /** Ids da conversa/mensagem/tarefa, assim que conhecidos. */
  onIds?: (ids: { conversationId?: string; messageId?: string; taskId?: string }) => void;
  onFim?: () => void;
  onErro: (mensagem: string) => void;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export type ResultadoEnvio = 'ok' | 'conversa_inexistente' | 'erro' | 'cancelado';

/** Envia a pergunta e lê a resposta em stream (Server-Sent Events do Dify). */
async function enviar(
  query: string,
  conversationId: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<ResultadoEnvio> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/dify/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, conversation_id: conversationId ?? '' }),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelado';
    handlers.onErro('Sem ligação ao assistente. Verifique a internet e tente novamente.');
    return 'erro';
  }

  if (!res.ok || !res.body) {
    // Conversa apagada/expirada no Dify: quem chama recomeça numa conversa nova.
    if (res.status === 404 && conversationId) return 'conversa_inexistente';
    const corpo = await res.json().catch(() => null) as { error?: string } | null;
    handlers.onErro(corpo?.error ?? 'O assistente não conseguiu responder. Tente novamente.');
    return 'erro';
  }

  let resultado: ResultadoEnvio = 'ok';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Eventos SSE separados por linha em branco; cada um com linhas "data: {json}"
      let fim: number;
      while ((fim = buffer.indexOf('\n\n')) >= 0) {
        const bloco = buffer.slice(0, fim);
        buffer = buffer.slice(fim + 2);
        for (const linha of bloco.split('\n')) {
          if (!linha.startsWith('data:')) continue;
          const json = linha.slice(5).trim();
          if (!json) continue;
          let ev: {
            event?: string; answer?: string; conversation_id?: string; message_id?: string;
            task_id?: string; message?: string; status?: number;
          };
          try { ev = JSON.parse(json); } catch { continue; }
          if (ev.conversation_id || ev.message_id || ev.task_id) {
            handlers.onIds?.({ conversationId: ev.conversation_id, messageId: ev.message_id, taskId: ev.task_id });
          }
          if ((ev.event === 'message' || ev.event === 'agent_message') && ev.answer) handlers.onTexto(ev.answer);
          else if (ev.event === 'message_replace' && typeof ev.answer === 'string') handlers.onSubstituir?.(ev.answer);
          else if (ev.event === 'error') {
            resultado = 'erro';
            handlers.onErro('O assistente encontrou um erro a responder. Tente novamente.');
          }
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      resultado = 'cancelado';
    } else {
      resultado = 'erro';
      handlers.onErro('A ligação ao assistente foi interrompida. Tente novamente.');
    }
  } finally {
    handlers.onFim?.();
  }
  return resultado;
}

// O chat (bolha e página) tem os seus próprios indicadores de carregamento.
const SILENCIOSO = { silencioso: true } as const;

export const pumukiService = {
  parametros: () => data<PumukiParametros>(apiClient.get('/dify/parametros', SILENCIOSO)),
  enviar,
  parar: (taskId: string) => data<{ ok: boolean }>(apiClient.post(`/dify/chat/${taskId}/parar`, {})),
  conversas: () => data<PumukiConversa[]>(apiClient.get('/dify/conversas', SILENCIOSO)),
  mensagens: (conversationId: string) =>
    data<PumukiMensagemHistorico[]>(apiClient.get(`/dify/conversas/${conversationId}/mensagens`, SILENCIOSO)),
  apagarConversa: (conversationId: string) => data<{ ok: boolean }>(apiClient.delete(`/dify/conversas/${conversationId}`)),
  avaliar: (messageId: string, rating: 'like' | 'dislike' | null) =>
    data<{ ok: boolean }>(apiClient.post(`/dify/mensagens/${messageId}/feedback`, { rating })),
};
