import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';
import { definirMembroGrupo } from './_shared/controlo-acesso';
import { invalidarMentores } from './_shared/cache-leitura';

/**
 * Utilizadores — gestão admin.
 *
 * GET    /api/utilizadores          — lista completa (admin)
 * PATCH  /api/utilizadores/:id      — { admin: boolean } promove a / retira de administrador
 * POST   /api/utilizadores/:id/papel — muda mentor, mentorado ou colaborador
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
               (SELECT COUNT(*)::int FROM mentors m WHERE m.utilizador_id = u.id AND m.activo = true) AS is_mentor_activo,
               (SELECT COUNT(*)::int FROM mentors m
                  JOIN mentor_assignments ma ON ma.mentor_id = m.id AND ma.activo = true
                 WHERE m.utilizador_id = u.id) AS mentorados_activos,
               EXISTS (
                 SELECT 1 FROM grupo_utilizador gu
                   JOIN grupo g ON g.id = gu.grupo_id
                  WHERE gu.utilizador_id = u.id AND g.chave = 'mentores'
               ) AS no_grupo_mentores,
               EXISTS (
                 SELECT 1 FROM colaboradores c
                   JOIN mentor_assignments ma ON ma.colaborador_id = c.id AND ma.activo = true
                  WHERE c.utilizador_id = u.id
               ) AS tem_mentor
          FROM utilizadores u
         ORDER BY u.created_at DESC
      `;
      return jsonResponse({ data: rows });
    }

    // POST /api/utilizadores/:id/papel — mentor, mentorado ou colaborador
    if (method === 'POST' && last === 'papel' && parts[parts.length - 3] === 'utilizadores') {
      const id = parts[parts.length - 2];
      const body = await req.json().catch(() => ({}));
      const operacao = body?.operacao;
      const permitidas = [
        'remover_mentor',
        'remover_mentorado',
        'mentorado_para_colaborador',
        'colaborador_para_mentor',
        'mentor_para_colaborador',
      ];
      if (!permitidas.includes(operacao)) return errorResponse('Operação de papel inválida', 400);

      const alvo = await sql`
        SELECT u.id, u.nome, u.email, u.perfil::text AS perfil, u.departamento,
               EXISTS (
                 SELECT 1 FROM grupo_utilizador gu
                   JOIN grupo g ON g.id = gu.grupo_id
                  WHERE gu.utilizador_id = u.id AND g.chave = 'mentores'
               ) AS no_grupo_mentores,
               EXISTS (
                 SELECT 1 FROM colaboradores c
                   JOIN mentor_assignments ma ON ma.colaborador_id = c.id AND ma.activo = true
                  WHERE c.utilizador_id = u.id
               ) AS tem_mentor,
               EXISTS (
                 SELECT 1 FROM mentors m
                   JOIN mentor_assignments ma ON ma.mentor_id = m.id AND ma.activo = true
                  WHERE m.utilizador_id = u.id
               ) AS tem_mentorados
          FROM utilizadores u
         WHERE u.id = ${id}
      `;
      if (!alvo.length) return errorResponse('Utilizador não encontrado', 404);
      const pessoa = alvo[0];
      const perfil = pessoa.perfil as string;
      const eMentor = ligado(pessoa.no_grupo_mentores) || ligado(pessoa.tem_mentorados);

      if (operacao === 'remover_mentor' || operacao === 'mentor_para_colaborador') {
        if (!eMentor) return errorResponse('Esta pessoa não é mentor.', 409);
      }
      if (operacao === 'remover_mentorado') {
        if (!ligado(pessoa.tem_mentor)) return errorResponse('Esta pessoa não tem mentor atribuído.', 409);
      }
      if (operacao === 'mentorado_para_colaborador' && perfil !== 'novo_colaborador') {
        return errorResponse('Só um mentorado pode passar a colaborador.', 409);
      }
      if (operacao === 'colaborador_para_mentor') {
        if (perfil === 'novo_colaborador') return errorResponse('Passa primeiro o mentorado a colaborador.', 409);
        if (eMentor) return errorResponse('Esta pessoa já é mentor.', 409);
      }

      if (operacao === 'remover_mentor' || operacao === 'mentor_para_colaborador') {
        await terminarAtribuicoesComoMentor(id, user, 'Deixou de ser mentor');
        await definirMembroGrupo(id, 'mentores', false);
      }
      if (operacao === 'remover_mentorado' || operacao === 'mentorado_para_colaborador') {
        await terminarAtribuicoesComoMentorado(id, user, operacao === 'mentorado_para_colaborador'
          ? 'Passou a colaborador'
          : 'Deixou de ter mentor');
      }
      if (operacao === 'mentorado_para_colaborador' || operacao === 'mentor_para_colaborador' || operacao === 'colaborador_para_mentor') {
        await garantirFichaMentor(id);
      }
      if (operacao === 'mentorado_para_colaborador' || operacao === 'mentor_para_colaborador') {
        if (perfil !== 'rh_admin') {
          await sql`UPDATE utilizadores SET perfil = 'mentor'::perfil_utilizador WHERE id = ${id}`;
        }
        await definirMembroGrupo(id, 'mentorados', false);
        await definirMembroGrupo(id, 'colaboradores', true);
      }
      if (operacao === 'colaborador_para_mentor') {
        await definirMembroGrupo(id, 'colaboradores', true);
        await definirMembroGrupo(id, 'mentores', true);
        await definirMembroGrupo(id, 'mentorados', false);
      }

      const actualizado = await sql`SELECT perfil::text AS perfil FROM utilizadores WHERE id = ${id}`;
      try {
        await sql`
          INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, valor_anterior, valor_novo)
          VALUES (${user.id}, ${user.email}, ${user.role}, 'alterar_papel', 'utilizador', ${id},
                  ${JSON.stringify({ perfil, operacao })}::text::jsonb,
                  ${JSON.stringify({ perfil: actualizado[0]?.perfil, operacao })}::text::jsonb)
        `;
      } catch {
        // a auditoria não bloqueia a alteração
      }
      invalidarMentores();
      return jsonResponse({ data: { id, perfil: actualizado[0]?.perfil, operacao } });
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

function ligado(valor: unknown): boolean {
  return valor === true || valor === 't' || valor === 'true' || valor === 1;
}

async function garantirFichaMentor(utilizadorId: string): Promise<void> {
  await sql`
    INSERT INTO mentors (utilizador_id, nome, email, departamento, activo)
    SELECT id, nome, email, departamento, true
      FROM utilizadores
     WHERE id = ${utilizadorId}
    ON CONFLICT (utilizador_id) DO UPDATE SET activo = true
  `;
}

async function terminarAtribuicoesComoMentor(utilizadorId: string, admin: AuthUser, motivo: string): Promise<void> {
  const fins = await sql`
    UPDATE mentor_assignments ma
       SET activo = false,
           terminado_em = now(),
           terminado_por = ${admin.id},
           motivo_termino = ${motivo}
      FROM mentors m
     WHERE ma.mentor_id = m.id
       AND m.utilizador_id = ${utilizadorId}
       AND ma.activo = true
    RETURNING ma.colaborador_id
  `;
  for (const linha of fins) {
    await sql`
      INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
      VALUES (${linha.colaborador_id}, 'mentor_removido', ${admin.id}, ${admin.nome}, ${admin.role}, ${motivo})
    `;
  }
}

async function terminarAtribuicoesComoMentorado(utilizadorId: string, admin: AuthUser, motivo: string): Promise<void> {
  const fins = await sql`
    UPDATE mentor_assignments ma
       SET activo = false,
           terminado_em = now(),
           terminado_por = ${admin.id},
           motivo_termino = ${motivo}
      FROM colaboradores c
     WHERE ma.colaborador_id = c.id
       AND c.utilizador_id = ${utilizadorId}
       AND ma.activo = true
    RETURNING ma.colaborador_id, ma.mentor_id
  `;
  for (const linha of fins) {
    await sql`
      INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
      VALUES (${linha.colaborador_id}, 'mentor_removido', ${admin.id}, ${admin.nome}, ${admin.role}, ${motivo})
    `;
  }
}

export const config: Config = {
  path: ['/api/utilizadores', '/api/utilizadores/:id', '/api/utilizadores/:id/papel'],
};
