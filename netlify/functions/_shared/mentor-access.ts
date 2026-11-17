import { sql } from './db';
import { invalidarMentores } from './cache-leitura';
import { appBaseUrl } from '@/src/lib/app-url';
import { criarConvitePassword } from '@/src/lib/auth-sync';
import { emailAcessoMentor } from './email-templates';
import { mailHasBanner, sendMail } from './mail';

export type ConviteMentor = 'enviado' | 'ja_tinha_acesso' | 'sem_email' | 'falhou';

function emailValido(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Se o mentor ainda não tem password, cria a conta e envia o link para a definir.
 * Quem já tem acesso não recebe este email.
 */
export async function garantirAcessoMentor(
  mentorId: string,
  colaboradorNome: string | null,
):Promise<{ utilizadorId: string | null; convite: ConviteMentor }> {
  try {
  const rows = await sql`
    SELECT m.id, m.utilizador_id, m.nome, m.email, m.departamento,
           u.id AS user_id, u.email AS user_email, u.password_hash, u.perfil::text AS perfil, u.nome AS user_nome
    FROM mentors m
    LEFT JOIN utilizadores u ON u.id = m.utilizador_id
    WHERE m.id = ${mentorId}
    LIMIT 1
  `;
  if (!rows.length) return { utilizadorId: null, convite: 'falhou' };

  const mentor = rows[0];
  const emailBruto = (mentor.user_email as string | null) || (mentor.email as string | null);
  const email = emailValido(emailBruto) ? emailBruto.trim().toLowerCase() : null;
  const nome = (mentor.nome as string | null)?.trim()
    || (mentor.user_nome as string | null)?.trim()
    || 'Mentor';

  if (mentor.password_hash) {
    return { utilizadorId: (mentor.user_id as string | null) ?? (mentor.utilizador_id as string | null), convite: 'ja_tinha_acesso' };
  }
  if (!email) return { utilizadorId: (mentor.user_id as string | null) ?? null, convite: 'sem_email' };

  let utilizadorId = (mentor.user_id as string | null) ?? (mentor.utilizador_id as string | null);

  if (!utilizadorId) {
    const byEmail = await sql`
      SELECT id, password_hash, perfil::text AS perfil
      FROM utilizadores
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    if (byEmail.length) {
      utilizadorId = byEmail[0].id as string;
      if (byEmail[0].password_hash) {
        await sql`UPDATE mentors SET utilizador_id = ${utilizadorId}, email = COALESCE(NULLIF(btrim(email), ''), ${email}) WHERE id = ${mentorId}`;
        invalidarMentores();
        if (byEmail[0].perfil !== 'rh_admin') {
          await sql`
            UPDATE utilizadores
               SET perfil = 'mentor'::perfil_utilizador, estado = 'activo'
             WHERE id = ${utilizadorId}
          `;
        }
        return { utilizadorId, convite: 'ja_tinha_acesso' };
      }
    } else {
      const created = await sql`
        INSERT INTO utilizadores (nome, email, perfil, departamento, estado)
        VALUES (${nome}, ${email}, 'mentor'::perfil_utilizador, ${mentor.departamento ?? null}, 'activo')
        RETURNING id
      `;
      utilizadorId = created[0].id as string;
    }
  }

  await sql`
    UPDATE mentors
       SET utilizador_id = ${utilizadorId},
           email = COALESCE(NULLIF(btrim(email), ''), ${email}),
           nome = COALESCE(NULLIF(btrim(nome), ''), ${nome})
     WHERE id = ${mentorId}
  `;
  invalidarMentores();
  await sql`
    UPDATE utilizadores
       SET perfil = CASE WHEN perfil = 'rh_admin'::perfil_utilizador THEN perfil ELSE 'mentor'::perfil_utilizador END,
           estado = 'activo',
           nome = COALESCE(NULLIF(btrim(nome), ''), ${nome})
     WHERE id = ${utilizadorId}
       AND password_hash IS NULL
  `;

  const aindaSemPassword = await sql`
    SELECT password_hash FROM utilizadores WHERE id = ${utilizadorId} LIMIT 1
  `;
  if (aindaSemPassword[0]?.password_hash) {
    return { utilizadorId, convite: 'ja_tinha_acesso' };
  }

  try {
    const token = await criarConvitePassword(utilizadorId);
    const href = `${appBaseUrl()}/definir-password?token=${encodeURIComponent(token)}`;
    const hasBanner = await mailHasBanner();
    const message = emailAcessoMentor({ mentorNome: nome, colaboradorNome, href, hasBanner });
    await sendMail({ to: email, ...message, contexto: 'convite-mentor' });
    return { utilizadorId, convite: 'enviado' };
  } catch (err) {
    console.error('[mentor-acesso] falha ao enviar convite', err);
    return { utilizadorId, convite: 'falhou' };
  }
  } catch (err) {
    console.error('[mentor-acesso]', err);
    return { utilizadorId: null, convite: 'falhou' };
  }
}

export async function notificarMentorAtribuido(opts: {
  mentorId: string;
  colaboradorId: string;
  colaboradorNome: string;
}): Promise<ConviteMentor> {
  const { utilizadorId, convite } = await garantirAcessoMentor(opts.mentorId, opts.colaboradorNome);
  if (utilizadorId) {
    await sql`
      INSERT INTO onboarding_notificacoes
        (destinatario_id, destinatario_role, colaborador_id, tipo, titulo, mensagem, link_accao)
      VALUES
        (${utilizadorId}, 'mentor', ${opts.colaboradorId}, 'colaborador_atribuido',
         ${'Novo mentorado atribuído: ' + opts.colaboradorNome},
         ${'Foi-lhe atribuído um novo mentorado para acompanhamento.'},
         ${'/mentor/mentorados/' + opts.colaboradorId})
    `;
  }
  return convite;
}
