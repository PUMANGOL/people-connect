import { appBaseUrl } from '@/src/lib/app-url';
import { APP_NAME_TITLE } from '@/lib/constants';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(opts: {
  preheader: string;
  title: string;
  paragraphs: string[];
  /** HTML já sanitizado, usado no lugar dos parágrafos. */
  html?: string;
  quote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  footnote: string;
  rodape?: string;
  hasBanner: boolean;
}): { html: string; text: string } {
  const header = opts.hasBanner
    ? `<img src="cid:pumangol-banner" width="600" alt="Pumangol — Direcção de Pessoas e Cultura" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<div style="padding:22px 28px 16px;"><p style="margin:0;font-size:22px;line-height:1;font-weight:800;letter-spacing:0.08em;color:#0C2A1B;">PUMANGOL</p><p style="margin:14px 0 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#216A41;font-weight:600;">Direcção de Pessoas e Cultura</p></div>`;

  const quote = opts.quote
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 22px;">
        <tr>
          <td style="border-left:4px solid #17B85F;background:#F5F9F6;padding:14px 16px;border-radius:0 10px 10px 0;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#133D27;">${opts.quote}</p>
          </td>
        </tr>
      </table>`
    : '';

  const paragraphs = opts.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1A1A2E;">${p}</p>`)
    .join('');

  const cta = opts.ctaLabel && opts.ctaHref
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 22px;">
                <tr>
                  <td style="border-radius:10px;background:#109A4E;">
                    <a href="${opts.ctaHref}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 22px;font-size:12px;line-height:1.5;color:#9CA3AF;word-break:break-all;">${escapeHtml(opts.ctaHref)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F6F9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
          <tr>
            <td style="${opts.hasBanner ? 'padding:0;line-height:0;font-size:0;background:#0C2A1B;' : 'padding:0;background:#ffffff;'}">
              ${header}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0C2A1B;font-weight:700;">${escapeHtml(opts.title)}</h1>
              ${opts.html ?? paragraphs}
              ${quote}
              ${cta}
              <p style="margin:0 0 22px;font-size:12px;line-height:1.5;color:#6B7280;">${opts.footnote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;background:#F5F9F6;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#4E7D63;">${opts.rodape ?? `${APP_NAME_TITLE} · Mensagem automática, não responda a este email.`}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    opts.title,
    '',
    opts.html
      ? opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : opts.paragraphs.map((p) => p.replace(/<[^>]+>/g, '')).join('\n'),
    opts.quote ? opts.quote.replace(/<[^>]+>/g, '') : '',
    opts.ctaLabel && opts.ctaHref ? `${opts.ctaLabel}: ${opts.ctaHref}` : '',
    '',
    opts.footnote.replace(/<[^>]+>/g, ''),
    opts.rodape ?? '',
  ].filter(Boolean).join('\n');

  return { html, text };
}

export function emailComentarioMentor(opts: {
  mentoradoNome: string;
  autorNome: string;
  texto: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const href = `${appBaseUrl()}/colaborador/comentarios`;
  const excerpt = opts.texto.trim().slice(0, 2000);
  const rendered = layout({
    preheader: `${opts.autorNome} deixou um comentário no seu onboarding.`,
    title: 'Novo comentário no seu onboarding',
    paragraphs: [
      `Olá ${escapeHtml(opts.mentoradoNome)},`,
      `<strong>${escapeHtml(opts.autorNome)}</strong> deixou um comentário sobre o seu percurso de integração.`,
    ],
    quote: escapeHtml(excerpt).replace(/\n/g, '<br />'),
    ctaLabel: 'Ver comentário',
    ctaHref: href,
    footnote: 'O comentário também fica disponível no painel, em Comentários.',
    hasBanner: opts.hasBanner,
  });
  return { subject: `Novo comentário do seu mentor — ${APP_NAME_TITLE}`, ...rendered };
}

export function emailRecuperarPassword(opts: {
  nome: string;
  href: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const rendered = layout({
    preheader: 'Link para redefinir a sua palavra-passe.',
    title: 'Redefinir palavra-passe',
    paragraphs: [
      `Olá ${escapeHtml(opts.nome)},`,
      'Recebemos um pedido para redefinir a palavra-passe da sua conta na plataforma de onboarding da Pumangol.',
      'Use o botão abaixo para escolher uma nova palavra-passe.',
    ],
    ctaLabel: 'Redefinir palavra-passe',
    ctaHref: opts.href,
    footnote: 'Este link é pessoal e expira em 72 horas. Se não pediu esta redefinição, ignore este email.',
    hasBanner: opts.hasBanner,
  });
  return { subject: `Redefinir palavra-passe — ${APP_NAME_TITLE}`, ...rendered };
}

export function emailPrimeiroAcesso(opts: {
  nome: string;
  href: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const rendered = layout({
    preheader: 'Link para definir a palavra-passe da sua conta.',
    title: 'Definir palavra-passe',
    paragraphs: [
      `Olá ${escapeHtml(opts.nome)},`,
      'Recebemos um pedido de primeiro acesso à sua conta no People Connect. Ainda não tem palavra-passe.',
      'Use o botão abaixo para a definir e entrar.',
    ],
    ctaLabel: 'Definir palavra-passe',
    ctaHref: opts.href,
    footnote: 'Este link é pessoal e expira em 72 horas. Se não pediu este acesso, ignore este email.',
    hasBanner: opts.hasBanner,
  });
  return { subject: `Definir palavra-passe — ${APP_NAME_TITLE}`, ...rendered };
}

export function emailCartaOferta(opts: {
  assunto: string;
  corpoHtml: string;
  nomeAnexo: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const rendered = layout({
    preheader: 'A carta de oferta segue em anexo.',
    title: 'A sua carta de oferta',
    paragraphs: [],
    html: opts.corpoHtml,
    footnote: `O documento <strong>${escapeHtml(opts.nomeAnexo)}</strong> segue anexo a esta mensagem.`,
    rodape: `${APP_NAME_TITLE} · Pode responder a este email para aceitar ou recusar a oferta.`,
    hasBanner: opts.hasBanner,
  });
  return { subject: opts.assunto, ...rendered };
}

export function emailAcessoColaborador(opts: {
  nome: string;
  href: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const rendered = layout({
    preheader: 'Defina a palavra-passe para entrar no People Connect.',
    title: 'O seu acesso ao People Connect',
    paragraphs: [
      `Olá ${escapeHtml(opts.nome)},`,
      'A sua admissão foi concluída. Já tem uma conta no People Connect para acompanhar o onboarding.',
      'Use o botão abaixo para definir a palavra-passe e entrar.',
    ],
    ctaLabel: 'Definir palavra-passe',
    ctaHref: opts.href,
    footnote: 'Este link é pessoal e expira em 72 horas. Se não esperava esta mensagem, ignore-a.',
    hasBanner: opts.hasBanner,
  });
  return { subject: `Acesso ao People Connect — ${APP_NAME_TITLE}`, ...rendered };
}

export function emailChecklistDocumentos(opts: {
  nome: string;
  documentos: Array<{ nome: string; obrigatorio: boolean }>;
  href: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const lista = opts.documentos
    .map((doc) => `<li style="margin:0 0 6px;">${escapeHtml(doc.nome)}${doc.obrigatorio ? '' : ' <span style="color:#6B7280;">(opcional)</span>'}</li>`)
    .join('');
  const html = [
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1A1A2E;">Olá ${escapeHtml(opts.nome)},</p>`,
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1A1A2E;">Para continuar a admissão, entregue os documentos desta lista. O botão abre uma página só sua, sem precisar de criar conta.</p>`,
    `<ul style="margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;color:#1A1A2E;">${lista}</ul>`,
  ].join('');
  const rendered = layout({
    preheader: 'Entregue os documentos pedidos para a admissão.',
    title: 'Documentos para a admissão',
    paragraphs: [],
    html,
    ctaLabel: 'Entregar documentos',
    ctaHref: opts.href,
    footnote: 'Formatos aceites: PDF, JPG, PNG ou WEBP, até 8 MB por ficheiro. Pode voltar ao mesmo link para substituir um documento rejeitado.',
    rodape: `${APP_NAME_TITLE} · Este link é pessoal. Não o partilhe.`,
    hasBanner: opts.hasBanner,
  });
  return { subject: `Documentos para a admissão — ${APP_NAME_TITLE}`, ...rendered };
}

export function emailAcessoMentor(opts: {
  mentorNome: string;
  /** Null quando o acesso é criado pelo admin, sem mentorado associado. */
  colaboradorNome: string | null;
  href: string;
  hasBanner: boolean;
}): { subject: string; html: string; text: string } {
  const rendered = layout({
    preheader: opts.colaboradorNome
      ? `Defina a sua password para acompanhar ${opts.colaboradorNome}.`
      : 'Defina a sua password para aceder ao painel de mentor.',
    title: 'O seu acesso ao painel de mentor',
    paragraphs: [
      `Olá ${escapeHtml(opts.mentorNome)},`,
      opts.colaboradorNome
        ? `Foi-lhe atribuído o acompanhamento de <strong>${escapeHtml(opts.colaboradorNome)}</strong> no onboarding da Pumangol.`
        : 'Foi registado como mentor no onboarding da Pumangol.',
      'Ainda não tem uma password de acesso. Use o botão abaixo para a definir e entrar no painel de mentor.',
    ],
    ctaLabel: 'Definir password',
    ctaHref: opts.href,
    footnote: 'Este link é pessoal e expira em 72 horas. Se não esperava esta mensagem, ignore-a.',
    hasBanner: opts.hasBanner,
  });
  return { subject: `Acesso ao painel de mentor — ${APP_NAME_TITLE}`, ...rendered };
}
