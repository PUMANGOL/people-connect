import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors } from './_shared/db';
import { appBaseUrl } from '@/src/lib/app-url';
import { criarConvitePassword } from '@/src/lib/auth-sync';
import { emailRecuperarPassword } from './_shared/email-templates';
import { mailHasBanner, mascararEmail, sendMail } from './_shared/mail';

const RESPOSTA = 'Enviámos um link para redefinir a palavra-passe.';
const SEM_CONTA = 'Não existe nenhuma conta activa com este email. Confirme o email ou contacte a Direcção de Pessoas e Cultura.';

/**
 * POST /api/recuperar-password — { email }.
 * Plataforma interna: indica ao utilizador quando o email não tem conta activa (404),
 * para poder corrigir o email em vez de esperar por uma mensagem que não chega.
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
      SELECT id, nome, email
      FROM utilizadores
      WHERE lower(email) = ${email} AND estado = 'activo'
      LIMIT 1
    `;

    console.log('[recuperar-password] pedido', JSON.stringify({
      para: mascararEmail(email),
      contaActiva: rows.length > 0,
      ...(rows.length ? {} : { nota: 'Sem conta activa com este email: nenhum email enviado.' }),
    }));

    if (!rows.length) return errorResponse(SEM_CONTA, 404);

    etapa = 'convite';
    const token = await criarConvitePassword(rows[0].id as string);
    const href = `${appBaseUrl()}/definir-password?token=${encodeURIComponent(token)}`;
    const hasBanner = await mailHasBanner();
    const message = emailRecuperarPassword({
      nome: (rows[0].nome as string) || 'colega',
      href,
      hasBanner,
    });
    etapa = 'email';
    await sendMail({ to: rows[0].email as string, ...message, contexto: 'recuperar-password' });

    return jsonResponse({ data: { ok: true, message: RESPOSTA } });
  } catch (err) {
    // Falhas de email já ficam detalhadas pelo sendMail ([mail] falhou); aqui diz-se só em que etapa parou.
    const e = err as { code?: string; message?: string };
    console.error('[recuperar-password] falhou', JSON.stringify({
      etapa,
      codigo: e?.code ?? null,
      mensagem: e?.message || String(err),
      ...(etapa === 'base-de-dados' ? { nota: 'Sem ligação à base de dados (DATABASE_URL).' } : {}),
    }));
    return errorResponse('Não foi possível enviar o email de recuperação. Tente mais tarde.', 500);
  }
};

export const config: Config = {
  path: '/api/recuperar-password',
};
