import type { Config } from './_shared/route-config';
import { createHash } from 'node:crypto';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { EMAIL_DOMINIO } from '@/lib/constants';
import { garantirAcessoMentor } from './_shared/mentor-access';
import { definirMembroGrupo } from './_shared/controlo-acesso';
import { emCache, invalidarMentores, TAG_MENTORES } from './_shared/cache-leitura';

/**
 * Mentores — CRUD (admin apenas) + listagem para dropdowns.
 *
 * GET    /api/mentors                          — lista mentores (admin/mentor podem consultar)
 * POST   /api/mentors                          — cria conta de utilizador com perfil mentor + linha em mentors
 * PATCH  /api/mentors/:id                      — actualiza mentor (activo/bio/categorias)
 * POST   /api/mentors/:id/acesso               — cria a conta (se faltar) e envia convite para definir password
 * DELETE /api/mentors/:id                      — desactiva mentor (soft — nunca apagar por integridade)
 */

function randomPassword(n = 12): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function slugEmail(nome: string): string {
  const norm = nome.normalize('NFKD').replace(/[^\p{L}\s]/gu, '').trim().toLowerCase();
  const parts = norm.split(/\s+/).filter(Boolean);
  const base = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'mentor';
  return `${base}@${EMAIL_DOMINIO}`;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];

  try {
    const user = await requireAuth(req);
    const method = req.method;

    // GET /api/mentors — lista (admin e mentor podem ver)
    if (method === 'GET' && last === 'mentors') {
      const rows = await emCache(['mentores-lista'], () => sql`
        SELECT m.id, m.utilizador_id, m.activo, m.bio, m.categorias_suportadas, m.created_at,
               COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS nome,
               COALESCE(NULLIF(btrim(m.email), ''), u.email) AS email,
               COALESCE(NULLIF(btrim(m.departamento), ''), u.departamento) AS departamento,
               m.area, m.funcao, m.data_inicio_contrato,
               (u.id IS NOT NULL) AS tem_conta,
               (u.password_hash IS NOT NULL) AS tem_password,
               (SELECT COUNT(*) FROM mentor_assignments ma
                WHERE ma.mentor_id = m.id AND ma.activo = true) AS mentorados_activos,
               (
                 EXISTS (
                   SELECT 1 FROM grupo_utilizador gu
                     JOIN grupo g ON g.id = gu.grupo_id
                    WHERE gu.utilizador_id = m.utilizador_id AND g.chave = 'mentores'
                 )
                 OR EXISTS (
                   SELECT 1 FROM mentor_assignments ma
                    WHERE ma.mentor_id = m.id AND ma.activo = true
                 )
               ) AS e_mentor
        FROM mentors m
        LEFT JOIN utilizadores u ON u.id = m.utilizador_id
        ORDER BY nome
      `, { revalidate: false, tags: [TAG_MENTORES] });
      return jsonResponse({ data: rows });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    // POST /api/mentors — cria mentor
    if (method === 'POST' && last === 'mentors') {
      const body = await req.json();
      const { nome, email: emailIn, departamento, categorias_suportadas, bio } = body;
      if (!nome || !departamento) return errorResponse('nome e departamento obrigatórios', 400);

      const email = (typeof emailIn === 'string' && emailIn.trim())
        ? emailIn.trim().toLowerCase()
        : slugEmail(nome);
      const password = randomPassword();

      // Verifica/cria utilizador
      const existente = await sql`SELECT id, password_hash FROM utilizadores WHERE email = ${email}`;
      let utilizadorId: string;
      // As credenciais são devolvidas quando o utilizador foi criado agora
      // OU quando um utilizador existente não tinha password_hash (ex.: veio
      // por MSAL) e precisamos de gerar um para o login local do mentor.
      let entregarCredenciais = false;
      if (existente.length) {
        utilizadorId = existente[0].id as string;
        const jaTemPassword = !!existente[0].password_hash;
        if (jaTemPassword) {
          await sql`
            UPDATE utilizadores
               SET perfil = CASE WHEN perfil = 'rh_admin'::perfil_utilizador THEN perfil ELSE 'mentor'::perfil_utilizador END,
                   departamento = COALESCE(NULLIF(departamento, ''), ${departamento}),
                   estado = 'activo'
             WHERE id = ${utilizadorId}
          `;
        } else {
          await sql`
            UPDATE utilizadores
               SET perfil = CASE WHEN perfil = 'rh_admin'::perfil_utilizador THEN perfil ELSE 'mentor'::perfil_utilizador END,
                   departamento = COALESCE(NULLIF(departamento, ''), ${departamento}),
                   estado = 'activo',
                   password_hash = crypt(${password}, gen_salt('bf'))
             WHERE id = ${utilizadorId}
          `;
          entregarCredenciais = true;
        }
      } else {
        const created = await sql`
          INSERT INTO utilizadores (nome, email, perfil, departamento, estado, password_hash)
          VALUES (${nome}, ${email}, 'mentor'::perfil_utilizador, ${departamento}, 'activo', crypt(${password}, gen_salt('bf')))
          RETURNING id
        `;
        utilizadorId = created[0].id as string;
        entregarCredenciais = true;
      }

      const cats = Array.isArray(categorias_suportadas) && categorias_suportadas.length
        ? categorias_suportadas
        : ['gestao', 'tecnicos'];

      const mentor = await sql`
        INSERT INTO mentors (utilizador_id, categorias_suportadas, bio, activo)
        VALUES (${utilizadorId}, ${cats}, ${bio ?? null}, true)
        ON CONFLICT (utilizador_id) DO UPDATE SET
          categorias_suportadas = EXCLUDED.categorias_suportadas,
          bio = COALESCE(EXCLUDED.bio, mentors.bio),
          activo = true
        RETURNING id, utilizador_id, activo, bio, categorias_suportadas
      `;

      // Auditoria
      await sql`
        INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_novo)
        VALUES (${user.id}, ${user.email}, ${user.role}, 'criar', 'mentor', ${mentor[0].id}, ${JSON.stringify({ nome, email, categorias: cats })}::text::jsonb)
      `;

      await definirMembroGrupo(utilizadorId, 'colaboradores', true);
      await definirMembroGrupo(utilizadorId, 'mentorados', false);
      if (body.como_mentor === true) await definirMembroGrupo(utilizadorId, 'mentores', true);

      invalidarMentores();
      return jsonResponse({
        data: {
          mentor: { ...mentor[0], nome, email },
          credenciais: entregarCredenciais ? { email, password } : null,
        },
      }, 201);
    }

    // POST /api/mentors/:id/acesso — cria/liga a conta e envia o convite para definir a password
    if (method === 'POST' && last === 'acesso' && parts[parts.length - 3] === 'mentors') {
      const id = parts[parts.length - 2];
      const existe = await sql`SELECT id FROM mentors WHERE id = ${id}`;
      if (!existe.length) return errorResponse('Mentor não encontrado', 404);
      const { utilizadorId, convite } = await garantirAcessoMentor(id, null);
      if (convite === 'sem_email') return errorResponse('O mentor não tem um email válido. Corrija o email antes de criar o acesso.', 400);
      if (convite === 'falhou') {
        return errorResponse(utilizadorId
          ? 'A conta foi criada, mas o email de convite não foi enviado. Tente novamente.'
          : 'Não foi possível criar o acesso.', 502);
      }
      await sql`
        INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_novo)
        VALUES (${user.id}, ${user.email}, ${user.role}, 'criar_acesso', 'mentor', ${id},
                ${JSON.stringify({ utilizador_id: utilizadorId, convite })}::text::jsonb)
      `;
      invalidarMentores();
      return jsonResponse({ data: { utilizador_id: utilizadorId, convite } });
    }

    // PATCH /api/mentors/:id
    if (method === 'PATCH' && parts[parts.length - 2] === 'mentors') {
      const id = last;
      const body = await req.json();
      const antes = await sql`SELECT activo, bio, categorias_suportadas FROM mentors WHERE id = ${id}`;
      if (!antes.length) return errorResponse('Mentor não encontrado', 404);
      const rows = await sql`
        UPDATE mentors SET
          activo = COALESCE(${body.activo ?? null}, activo),
          bio = COALESCE(${body.bio ?? null}, bio),
          categorias_suportadas = COALESCE(${body.categorias_suportadas ?? null}, categorias_suportadas)
        WHERE id = ${id}
        RETURNING id, utilizador_id, activo, bio, categorias_suportadas
      `;
      await sql`
        INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_anterior, valor_novo)
        VALUES (${user.id}, ${user.email}, ${user.role}, 'actualizar', 'mentor', ${id},
                ${JSON.stringify(antes[0])}::text::jsonb, ${JSON.stringify(rows[0])}::text::jsonb)
      `;
      invalidarMentores();
      return jsonResponse({ data: rows[0] });
    }

    // DELETE /api/mentors/:id — soft delete (activo=false)
    if (method === 'DELETE' && parts[parts.length - 2] === 'mentors') {
      const id = last;
      const activas = await sql`
        SELECT COUNT(*)::int AS n FROM mentor_assignments WHERE mentor_id = ${id} AND activo = true
      `;
      if ((activas[0].n as number) > 0) {
        return errorResponse('Mentor tem colaboradores activos atribuídos. Termine as atribuições primeiro.', 409);
      }
      await sql`UPDATE mentors SET activo = false WHERE id = ${id}`;
      await sql`
        INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_novo)
        VALUES (${user.id}, ${user.email}, ${user.role}, 'desactivar', 'mentor', ${id},
                ${JSON.stringify({ activo: false })}::text::jsonb)
      `;
      invalidarMentores();
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[mentors]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/mentors', '/api/mentors/:id', '/api/mentors/:id/acesso'],
};
