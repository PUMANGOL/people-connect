import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors } from './_shared/db';
import { appBaseUrl } from '@/src/lib/app-url';
import { criarConvitePassword } from '@/src/lib/auth-sync';
import { emailPrimeiroAcesso } from './_shared/email-templates';
import { mailHasBanner, mascararEmail, sendMail } from './_shared/mail';

const RESPOSTA = 'Enviámos um link para definir a palavra-passe.';
const SEM_CONTA = 'Não existe nenhuma conta activa com este email. Confirme o email ou contacte a Direcção de Pessoas e Cultura.';
const JA_TEM = 'Esta conta já tem palavra-passe. Entre com ela ou use «Esqueci-me» para a redefinir.';

/**
 * POST /api/primeiro-acesso — { email }.
 * Só envia o link quando a conta está activa e ainda não tem palavra-passe.
 */
export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  let etapa: 'pedido' | 'base-de-dados' | 'convite' | 'email' = 'pedido';
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Indique um email válido', 400);
    }

    etapa = 'base-de-dados';
    const rows = await sql`
      SELECT id, nome, email, password_hash
      FROM utilizadores
      WHERE lower(email) = ${email} AND estado = 'activo'
      LIMIT 1
    `;

    console.log('[primeiro-acesso] pedido', JSON.stringify({
      para: mascararEmail(email),
      contaActiva: rows.length > 0,
      semPassword: rows.length > 0 && !rows[0].password_hash,
    }));

    if (!rows.length) return errorResponse(SEM_CONTA, 404);
    if (rows[0].password_hash) return errorResponse(JA_TEM, 409);

    etapa = 'convite';
    const token = await criarConvitePassword(rows[0].id as string);
    const href = `${appBaseUrl()}/definir-password?token=${encodeURIComponent(token)}&primeiro=1`;
    const hasBanner = await mailHasBanner();
    const message = emailPrimeiroAcesso({
      nome: (rows[0].nome as string) || 'colega',
      href,
      hasBanner,
    });
    etapa = 'email';
    await sendMail({ to: rows[0].email as string, ...message, contexto: 'primeiro-acesso' });

    return jsonResponse({ data: { ok: true, message: RESPOSTA } });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error('[primeiro-acesso] falhou', JSON.stringify({
      etapa,
      codigo: e?.code ?? null,
      mensagem: e?.message || String(err),
    }));
    return errorResponse('Não foi possível enviar o email. Tente mais tarde.', 500);
  }
};

export const config: Config = {
  path: '/api/primeiro-acesso',
};
