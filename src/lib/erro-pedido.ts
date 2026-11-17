/** Erro com mensagem já pronta para o utilizador (ex.: falha no envio para o bucket). */
export class ErroVisivel extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroVisivel';
  }
}

/**
 * Mensagem para mostrar a partir de um erro de pedido.
 * `jaNotificado`: o interceptor do apiClient já mostrou toast (403, 429, 5xx).
 */
export function erroPedido(e: unknown, fallback: string): { msg: string; jaNotificado: boolean } {
  if (e instanceof ErroVisivel) return { msg: e.message, jaNotificado: false };
  const err = e as { response?: { status?: number; data?: { error?: string; message?: string } } };
  const status = err.response?.status;
  const msg = err.response?.data?.error || err.response?.data?.message || fallback;
  return { msg, jaNotificado: status === 403 || status === 429 || (status != null && status >= 500) };
}
