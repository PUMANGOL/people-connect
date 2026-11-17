import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { notificarMentorAtribuido } from './_shared/mentor-access';
import { reflectirGrupoDoMentor } from './_shared/controlo-acesso';
import { invalidarMentores } from './_shared/cache-leitura';

/**
 * Atribuições Mentor ↔ Colaborador (admin apenas).
 *
 * POST /api/mentor-assignments             — { colaborador_id, mentor_id }
 * GET  /api/mentor-assignments/:colaboradorId — histórico + atribuição activa
 * DELETE /api/mentor-assignments/:id        — termina a atribuição activa (soft)
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
    const method = req.method;

    // GET /api/mentor-assignments/:colaboradorId
    if (method === 'GET' && prev === 'mentor-assignments') {
      const colaboradorId = last;
      const rows = await sql`
        SELECT ma.id, ma.colaborador_id, ma.mentor_id, ma.activo,
               ma.atribuido_em, ma.atribuido_por, ma.terminado_em, ma.motivo_termino,
               COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome,
               COALESCE(NULLIF(btrim(m.email), ''), u.email) AS mentor_email,
               COALESCE(NULLIF(btrim(m.departamento), ''), u.departamento) AS mentor_departamento,
               m.area AS mentor_area,
               m.funcao AS mentor_funcao,
               m.data_inicio_contrato AS mentor_data_inicio_contrato
        FROM mentor_assignments ma
        JOIN mentors m ON m.id = ma.mentor_id
        LEFT JOIN utilizadores u ON u.id = m.utilizador_id
        WHERE ma.colaborador_id = ${colaboradorId}
        ORDER BY ma.atribuido_em DESC
      `;
      return jsonResponse({ data: rows });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    // POST /api/mentor-assignments
    if (method === 'POST' && last === 'mentor-assignments') {
      const body = await req.json();
      const { colaborador_id, mentor_id } = body;
      if (!colaborador_id || !mentor_id) {
        return errorResponse('colaborador_id e mentor_id obrigatórios', 400);
      }

      // Verifica que o mentor existe e está activo
      const mentor = await sql`
        SELECT m.id, m.utilizador_id,
               COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome
        FROM mentors m
        LEFT JOIN utilizadores u ON u.id = m.utilizador_id
        WHERE m.id = ${mentor_id} AND m.activo = true
      `;
      if (!mentor.length) return errorResponse('Mentor não encontrado ou inactivo', 404);

      // Termina atribuição activa anterior (se houver)
      const anteriores = await sql`
        SELECT mentor_id FROM mentor_assignments
         WHERE colaborador_id = ${colaborador_id} AND activo = true
      `;
      await sql`
        UPDATE mentor_assignments
           SET activo = false, terminado_em = NOW(), terminado_por = ${user.id},
               motivo_termino = 'Reatribuição de mentor'
         WHERE colaborador_id = ${colaborador_id} AND activo = true
      `;

      const rows = await sql`
        INSERT INTO mentor_assignments (colaborador_id, mentor_id, atribuido_por, activo)
        VALUES (${colaborador_id}, ${mentor_id}, ${user.id}, true)
        RETURNING id, atribuido_em, mentor_id
      `;

      // Timeline + audit + notificação para o mentor
      const mentorNome = mentor[0].mentor_nome as string;
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao, meta)
        VALUES (${colaborador_id}, 'mentor_atribuido', ${user.id}, ${user.email}, ${user.role},
                ${'Mentor atribuído: ' + mentorNome},
                ${JSON.stringify({ mentor_id, mentor_nome: mentorNome })}::text::jsonb)
      `;
      await sql`
        INSERT INTO onboarding_audit
          (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, colaborador_id, valor_novo)
        VALUES
          (${user.id}, ${user.email}, ${user.role}, 'atribuir_mentor', 'mentor_assignment',
           ${rows[0].id}, ${colaborador_id}, ${JSON.stringify({ mentor_id, mentor_nome: mentorNome })}::text::jsonb)
      `;

      const colaborador = await sql`SELECT nome FROM colaboradores WHERE id = ${colaborador_id}`;
      const conviteMentor = await notificarMentorAtribuido({
        mentorId: mentor_id,
        colaboradorId: colaborador_id,
        colaboradorNome: (colaborador[0]?.nome as string | undefined) ?? 'colaborador',
      });
      invalidarMentores();
      await reflectirGrupoDoMentor(mentor_id);
      for (const anterior of anteriores) {
        if (anterior.mentor_id !== mentor_id) await reflectirGrupoDoMentor(anterior.mentor_id as string);
      }

      return jsonResponse({ data: { ...rows[0], convite_mentor: conviteMentor } }, 201);
    }

    // DELETE /api/mentor-assignments/:id — termina atribuição
    if (method === 'DELETE' && prev === 'mentor-assignments') {
      const id = last;
      const rows = await sql`
        UPDATE mentor_assignments
           SET activo = false, terminado_em = NOW(), terminado_por = ${user.id},
               motivo_termino = COALESCE(motivo_termino, 'Terminada por admin')
         WHERE id = ${id}
        RETURNING id, colaborador_id, mentor_id
      `;
      if (!rows.length) return errorResponse('Atribuição não encontrada', 404);

      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
        VALUES (${rows[0].colaborador_id}, 'mentor_removido', ${user.id}, ${user.email}, ${user.role},
                ${'Mentor removido'})
      `;
      invalidarMentores();
      await reflectirGrupoDoMentor(rows[0].mentor_id as string);
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[mentor-assignments]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/mentor-assignments', '/api/mentor-assignments/:id'],
};
