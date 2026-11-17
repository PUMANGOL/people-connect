import type { Config } from './_shared/route-config';

/**
 * Endpoint de diagnóstico mínimo — sem dependências externas.
 * Se este responder mas /api/health-nvidia não, o problema é na
 * dependência (openai, pdf-parse, etc.).
 */

export default async (): Promise<Response> => {
  return new Response(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
      node_version: process.version,
      env_has_nvidia: Boolean(process.env.NVIDIA_API_KEY),
      env_has_database: Boolean(process.env.DATABASE_URL),
      env_has_base_url: Boolean(process.env.NVIDIA_BASE_URL),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};

export const config: Config = {
  path: '/api/ping',
};
