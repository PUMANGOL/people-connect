import type { Config } from './_shared/route-config';
import { errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { ensureAuthReady, getAuth } from '@/src/lib/auth';

/**
 * POST /api/auth-login
 * Compatibilidade: inicia sessão no better-auth e devolve o cookie de sessão.
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return errorResponse('Email e password são obrigatórios', 400);

    await ensureAuthReady();
    const headers = new Headers({ 'content-type': 'application/json' });
    const origin = req.headers.get('origin');
    if (origin) headers.set('origin', origin);
    const cookie = req.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);

    const url = new URL('/api/auth/sign-in/email', req.url);
    return getAuth().handler(new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    }));
  } catch (err) {
    console.error('[auth-login]', err);
    return errorResponse(publicErrorMessage(err, 'Erro na autenticação'), 500);
  }
};

export const config: Config = {
  path: '/api/auth-login',
};
