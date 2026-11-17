import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;
let bannerBuffer: Buffer | null | undefined;

function getTransport(): Transporter {
  if (transport) return transport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error('SMTP não configurado (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
  return transport;
}

async function loadBanner(): Promise<Buffer | null> {
  if (bannerBuffer !== undefined) return bannerBuffer;
  try {
    bannerBuffer = await readFile(path.join(process.cwd(), 'public', 'banner_email.jpg'));
  } catch {
    bannerBuffer = null;
  }
  return bannerBuffer;
}

/** Email parcialmente escondido para os logs (ex.: jo***@pumangol.co.ao). */
export function mascararEmail(email: string): string {
  const [utilizador, dominio] = email.split('@');
  if (!dominio) return '***';
  return `${utilizador.slice(0, 2)}***@${dominio}`;
}

/**
 * Envia um email por SMTP e regista o envio nos logs do servidor (Vercel → Runtime Logs).
 * Linhas com o prefixo `[mail]`: "a enviar", "enviado" ou "falhou" (com diagnóstico SMTP,
 * sem a palavra-passe). O `id` liga as linhas do mesmo envio.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Origem do envio, para os logs (ex.: 'recuperar-password'). */
  contexto?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<void> {
  const inicio = Date.now();
  const registo = {
    id: randomUUID().slice(0, 8),
    contexto: opts.contexto ?? null,
    para: mascararEmail(opts.to),
    assunto: opts.subject,
    ambiente: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local',
  };

  try {
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    if (!from) throw new Error('MAIL_FROM não configurado');
    const banner = await loadBanner();
    console.log('[mail] a enviar', JSON.stringify({
      ...registo,
      de: from,
      host: process.env.SMTP_HOST ?? '(em falta)',
      porta: process.env.SMTP_PORT || '587',
      banner: banner != null,
    }));

    const inline = banner
      ? [{
          filename: 'banner-email.jpg',
          content: banner,
          cid: 'pumangol-banner',
          contentType: 'image/jpeg',
          contentDisposition: 'inline' as const,
        }]
      : [];
    const ficheiros = (opts.attachments ?? []).map((anexo) => ({
      filename: anexo.filename,
      content: anexo.content,
      contentType: anexo.contentType ?? 'application/octet-stream',
      contentDisposition: 'attachment' as const,
    }));
    const info = await getTransport().sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: [...inline, ...ficheiros],
    });

    console.log('[mail] enviado', JSON.stringify({
      ...registo,
      duracaoMs: Date.now() - inicio,
      messageId: info.messageId ?? null,
      aceites: Array.isArray(info.accepted) ? info.accepted.length : null,
      rejeitados: Array.isArray(info.rejected) ? info.rejected.length : null,
      respostaServidor: info.response ?? null,
    }));
  } catch (err) {
    console.error('[mail] falhou', JSON.stringify({
      ...registo,
      duracaoMs: Date.now() - inicio,
      ...descreverFalhaSmtp(err),
    }));
    throw err;
  }
}

export async function mailHasBanner(): Promise<boolean> {
  return (await loadBanner()) != null;
}

/** Diagnóstico de SMTP para logs de servidor. Nunca inclui a palavra-passe. */
export function descreverFalhaSmtp(err: unknown) {
  const pass = process.env.SMTP_PASSWORD ?? '';
  const smtp = err as { code?: string; responseCode?: number; response?: string; command?: string; message?: string };
  const entreAspas = (pass.startsWith('"') && pass.endsWith('"')) || (pass.startsWith("'") && pass.endsWith("'"));
  const codigo = smtp.responseCode ?? null;
  return {
    ambiente: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local',
    host: process.env.SMTP_HOST ?? '(em falta)',
    porta: process.env.SMTP_PORT || '587',
    utilizador: process.env.SMTP_USER ?? '(em falta)',
    mailFrom: process.env.MAIL_FROM ?? '(em falta)',
    codigo: smtp.code ?? null,
    respostaSmtp: codigo,
    comando: smtp.command ?? null,
    mensagem: smtp.response ?? smtp.message ?? (err instanceof Error ? err.message : String(err)),
    palavraPasse: {
      definida: pass.length > 0,
      comprimento: pass.length,
      espacosNasPontas: pass.length > 0 && pass !== pass.trim(),
      entreAspas,
      terminaComExclamacao: pass.endsWith('!'),
    },
    leitura: leituraSmtp(codigo, smtp.command, entreAspas, pass),
  };
}

function leituraSmtp(codigo: number | null, comando: string | undefined, entreAspas: boolean, pass: string): string {
  if (codigo === 535 && comando === 'AUTH LOGIN') {
    const notas = ['O Office 365 recebeu o login e recusou-o. As variáveis existem.'];
    if (entreAspas) notas.push('A palavra-passe inclui aspas; na Vercel o valor não deve levar aspas.');
    if (pass !== pass.trim()) notas.push('A palavra-passe tem espaços ou quebras de linha nas pontas.');
    if (!pass.endsWith('!')) notas.push('A palavra-passe não termina com !. Confirma se esse carácter chegou à Vercel.');
    notas.push('Se o comprimento for igual ao do .env local, o bloqueio é da conta Microsoft (SMTP autenticado ou acesso condicional) para o IP da Vercel.');
    return notas.join(' ');
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !pass) {
    return 'Falta SMTP_HOST, SMTP_USER ou SMTP_PASSWORD neste ambiente.';
  }
  return 'Falha no envio SMTP. A mensagem acima é a resposta do servidor de correio.';
}
