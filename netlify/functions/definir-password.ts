import type { Config } from './_shared/route-config';
import { jsonResponse, errorResponse, handleCors } from './_shared/db';
import { consumirConvitePassword } from '@/src/lib/auth-sync';

/** POST /api/definir-password — { token, password } */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!token || password.length < 8) {
      return errorResponse('O link e uma password com pelo menos 8 caracteres são obrigatórios', 400);
    }
    const email = await consumirConvitePassword(token, password);
    return jsonResponse({ data: { email } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível definir a password';
    const status = message.includes('inválido') || message.includes('expirado') ? 400 : 500;
    if (status === 500) console.error('[definir-password]', err);
    return errorResponse(
      status === 400 ? 'Este link já foi utilizado ou expirou. Peça um novo link de redefinição.' : message,
      status,
    );
  }
};

export const config: Config = {
  path: '/api/definir-password',
};
