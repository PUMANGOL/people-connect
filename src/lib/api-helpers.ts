/**
 * Helpers defensivos para respostas de API.
 *
 * As Netlify Functions devolvem `{ data: [...] }` mas em caso de fallback SPA
 * o axios pode receber HTML. Estes helpers garantem que o consumidor recebe
 * sempre um array (nunca undefined).
 */

interface AxiosLikeResponse<T> {
  data?: {
    data?: T[];
    total?: number;
  } | T[] | unknown;
}

/**
 * Extrai um array da resposta da API, aceitando várias formas:
 * - { data: { data: [...] } } (PaginatedResponse embutido)
 * - { data: [...] } (resposta directa)
 * - fallback: []
 */
export function extractList<T>(res: AxiosLikeResponse<T>): { data: T[]; total: number } {
  const body = res?.data;

  if (Array.isArray(body)) {
    return { data: body as T[], total: (body as T[]).length };
  }

  if (body && typeof body === 'object' && 'data' in body) {
    const inner = (body as { data?: unknown; total?: number }).data;
    if (Array.isArray(inner)) {
      return {
        data: inner as T[],
        total: (body as { total?: number }).total ?? inner.length,
      };
    }
  }

  return { data: [], total: 0 };
}

/**
 * Extrai um item único da resposta da API.
 */
export function extractItem<T>(res: AxiosLikeResponse<T>): T | null {
  const body = res?.data;

  if (body && typeof body === 'object' && 'data' in body) {
    const inner = (body as { data?: unknown }).data;
    if (inner !== undefined && inner !== null && !Array.isArray(inner)) {
      return inner as T;
    }
  }

  return null;
}
