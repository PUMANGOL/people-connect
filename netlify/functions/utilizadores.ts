import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Utilizadores — gestão admin.
 *
 * GET    /api/utilizadores          — lista completa (admin)
 * PATCH  /api/utilizadores/:id      — { admin: boolean } promove a / retira de administrador
 * DELETE /api/utilizadores/:id      — elimina utilizador
 *
 * A eliminação depende dos FKs configurados como CASCADE / SET NULL
 * (migrações 018 e 019). Sem essas migrações aplicadas, o Postgres
 * bloqueia com "violates foreign key constraint".
 *
 * Regras de segurança:
 *   - Só rh_admin pode listar/eliminar
 *   - Um admin nunca se pode auto-eliminar
 *   - O último rh_admin activo é protegido (não pode ser eliminado)
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    const method = req.method;

    // GET /api/utilizadores — lista
    if (method === 'GET' && last === 'utilizadores') {
      const rows = await sql`
        SELECT u.id, u.nome, u.email, u.perfil, u.departamento, u.estado, u.created_at,
               (SELECT COUNT(*)::int FROM colaboradores c WHERE c.utilizador_id = u.id) AS is_colaborador,
               (SELECT COUNT(*)::int FROM mentors m WHERE m.utilizador_id = u.id AND m.activo = true) AS is_mentor_activo
          FROM utilizadores u
         ORDER BY u.created_at DESC
      `;
      return jsonResponse({ data: rows });
    }

    // PATCH /api/utilizadores/:id — { admin: boolean } — promove a / retira de administrador
    if (method === 'PATCH' && prev === 'utilizadores') {
      const id = last;
      const body = await req.json().catch(() => ({}));
      if (typeof body?.admin !== 'boolean') return errorResponse('Indique se o utilizador deve ser administrador', 400);
      if (id === user.id) return errorResponse('Não podes alterar o teu próprio perfil.', 400);

      const alvo = await sql`
        SELECT u.id, u.nome, u.email, u.perfil::text AS perfil,
               EXISTS (SELECT 1 FROM mentors m WHERE m.utilizador_id = u.id AND m.activo = true) AS is_mentor,
               EXISTS (SELECT 1 FROM colaboradores c WHERE c.utilizador_id = u.id) AS is_colaborador
          FROM utilizadores u
         WHERE u.id = ${id}
      `;
      if (!alvo.length) return errorResponse('Utilizador não encontrado', 404);
      const anterior = alvo[0].perfil as string;

      // Ao retirar o admin, volta ao perfil que a conta tem por natureza:
      // mentor (se tiver perfil de mentor activo), senão novo colaborador.
      const novo = body.admin
        ? 'rh_admin'
        : alvo[0].is_mentor ? 'mentor' : 'novo_colaborador';
      if (novo === anterior) return jsonResponse({ data: { id, perfil: novo } });

      if (anterior === 'rh_admin') {
        const outrosAdmins = await sql`
          SELECT COUNT(*)::int AS n FROM utilizadores
           WHERE perfil = 'rh_admin' AND estado = 'activo' AND id <> ${id}
        `;
        if ((outrosAdmins[0].n as number) === 0) {
          return errorResponse('Este é o último administrador activo.', 409);
        }
      }

      const rows = await sql`
        UPDATE utilizadores SET perfil = ${novo}::perfil_utilizador
         WHERE id = ${id}
         RETURNING id, perfil::text AS perfil
      `;
      try {
        await sql`
          INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_anterior, valor_novo)
          VALUES (${user.id}, ${user.email}, ${user.role}, 'alterar_perfil', 'utilizador', ${id},
                  ${JSON.stringify({ perfil: anterior })}::text::jsonb, ${JSON.stringify({ perfil: novo })}::text::jsonb)
        `;
      } catch {
        // audit_log é opcional — não bloqueia a alteração se falhar
      }
      return jsonResponse({ data: rows[0] });
    }

    // DELETE /api/utilizadores/:id
    if (method === 'DELETE' && prev === 'utilizadores') {
      const id = last;
      if (!id) return errorResponse('ID em falta', 400);

      // Regras de protecção
      if (id === user.id) {
        return errorResponse('Não podes eliminar a tua própria conta.', 400);
      }

      const alvo = await sql`SELECT id, nome, email, perfil FROM utilizadores WHERE id = ${id}`;
      if (!alvo.length) return errorResponse('Utilizador não encontrado', 404);

      if (alvo[0].perfil === 'rh_admin') {
        // Verifica se é o último admin activo
        const outrosAdmins = await sql`
          SELECT COUNT(*)::int AS n
            FROM utilizadores
           WHERE perfil = 'rh_admin'
             AND estado = 'activo'
             AND id <> ${id}
        `;
        if ((outrosAdmins[0].n as number) === 0) {
          return errorResponse('Este é o último administrador activo. Cria outro admin antes de eliminares este.', 409);
        }
      }

      try {
        // Auditoria antes de apagar (para preservar o "quem foi eliminado" — o
        // audit_log fica com o snapshot; o utilizador_id do audit_log é NULL
        // depois do DELETE pelo ON DELETE SET NULL da migração 018).
        await sql`
          INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_anterior)
          VALUES (${user.id}, ${user.email}, ${user.role}, 'eliminar', 'utilizador', ${id},
                  ${JSON.stringify({ nome: alvo[0].nome, email: alvo[0].email, perfil: alvo[0].perfil })}::text::jsonb)
        `;
      } catch {
        // audit_log é opcional — não bloqueia a eliminação se falhar
      }

      try {
        await sql`DELETE FROM utilizadores WHERE id = ${id}`;
      } catch (err) {
        // Erros típicos: FK ainda não migrado. Devolver mensagem clara.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('foreign key')) {
          return errorResponse(
            'Não foi possível eliminar: existem referências à conta que ainda não foram configuradas para cascata. Contacte o administrador do sistema.',
            409,
          );
        }
        throw err;
      }

      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[utilizadores]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/utilizadores', '/api/utilizadores/:id'],
};
