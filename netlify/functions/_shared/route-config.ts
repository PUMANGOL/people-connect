/**
 * Configuração de rota de cada handler da API: os caminhos que atende.
 * Lida por server/api-dispatch.ts (rota catch-all /api do Next.js na Vercel).
 */
export interface Config {
  path: string | string[];
}
