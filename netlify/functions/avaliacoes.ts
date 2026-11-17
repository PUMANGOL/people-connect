import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';

/**
 * Avaliações do Mentor + Feedback do Colaborador.
 *
 * === Avaliações do Mentor (feitas pelo mentor sobre o colaborador) ===
 * GET   /api/mentor-avaliacoes                     — admin: lista todas
 * GET   /api/mentor-avaliacoes/colaborador/:id     — todas de um colaborador
 * GET   /api/mentor-avaliacoes/:id                 — detalhe
 * POST  /api/mentor-avaliacoes                     — cria (draft)
 * PATCH /api/mentor-avaliacoes/:id                 — actualiza / submete / valida
 *
 * === Feedback do Colaborador (auto-avaliação) ===
 * GET   /api/colaborador-feedback                  — lista da conta autenticada
 * GET   /api/colaborador-feedback/colaborador/:id  — admin/mentor: por colaborador
 * PATCH /api/colaborador-feedback/:id              — actualiza / submete
 */

async function colaboradorIdDoUtilizador(uid: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM colaboradores WHERE utilizador_id = ${uid} LIMIT 1`;
  return (rows[0]?.id as string) ?? null;
}

async function mentorIdDoUtilizador(uid: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM mentors WHERE utilizador_id = ${uid} AND activo = true`;
  return (rows[0]?.id as string) ?? null;
}

async function mentorTemAcesso(mentorId: string, colaboradorId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM mentor_assignments
     WHERE mentor_id = ${mentorId} AND colaborador_id = ${colaboradorId} AND activo = true
  `;
  return rows.length > 0;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  const isMentorAval = parts.some((p) => p === 'mentor-avaliacoes');
  const isColabFeedback = parts.some((p) => p === 'colaborador-feedback');

  try {
    const user = await requireAuth(req);
    const method = req.method;

    // =========================================================
    // MENTOR-AVALIACOES
    // =========================================================
    if (isMentorAval) {
      // GET colaborador/:id
      if (method === 'GET' && prev === 'colaborador') {
        const colabId = last;
        if (user.role === 'mentor') {
          const mid = await mentorIdDoUtilizador(user.id);
          if (!mid || !(await mentorTemAcesso(mid, colabId))) return errorResponse('Sem acesso', 403);
        }
        const rows = await sql`
          SELECT a.*, COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome, c.nome AS colaborador_nome
          FROM mentor_avaliacoes a
          JOIN mentors m ON m.id = a.mentor_id
          LEFT JOIN utilizadores u ON u.id = m.utilizador_id
          JOIN colaboradores c ON c.id = a.colaborador_id
          WHERE a.colaborador_id = ${colabId}
          ORDER BY a.momento
        `;
        return jsonResponse({ data: rows });
      }

      // GET /:id
      if (method === 'GET' && prev === 'mentor-avaliacoes') {
        const rows = await sql`
          SELECT a.*, COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome, c.nome AS colaborador_nome
          FROM mentor_avaliacoes a
          JOIN mentors m ON m.id = a.mentor_id
          LEFT JOIN utilizadores u ON u.id = m.utilizador_id
          JOIN colaboradores c ON c.id = a.colaborador_id
          WHERE a.id = ${last}
        `;
        if (!rows.length) return errorResponse('Avaliação não encontrada', 404);
        return jsonResponse({ data: rows[0] });
      }

      // GET lista
      if (method === 'GET' && last === 'mentor-avaliacoes') {
        if (user.role === 'novo_colaborador') return errorResponse('Sem permissão', 403);
        let rows;
        // ?meus=1 — portal do mentor aberto por um admin que também é mentor: só as suas.
        const soMeus = user.role === 'mentor' || url.searchParams.get('meus') === '1';
        if (soMeus) {
          const mid = await mentorIdDoUtilizador(user.id);
          rows = await sql`
            SELECT a.*, COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome, c.nome AS colaborador_nome
            FROM mentor_avaliacoes a
            JOIN mentors m ON m.id = a.mentor_id
            LEFT JOIN utilizadores u ON u.id = m.utilizador_id
            JOIN colaboradores c ON c.id = a.colaborador_id
            WHERE a.mentor_id = ${mid}
            ORDER BY a.created_at DESC
          `;
        } else {
          rows = await sql`
            SELECT a.*, COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome, c.nome AS colaborador_nome
            FROM mentor_avaliacoes a
            JOIN mentors m ON m.id = a.mentor_id
            LEFT JOIN utilizadores u ON u.id = m.utilizador_id
            JOIN colaboradores c ON c.id = a.colaborador_id
            ORDER BY a.created_at DESC LIMIT 500
          `;
        }
        return jsonResponse({ data: rows });
      }

      // POST criar
      if (method === 'POST' && last === 'mentor-avaliacoes') {
        if (user.role === 'novo_colaborador') return errorResponse('Sem permissão', 403);
        const body = await req.json();
        const { colaborador_id, momento, categoria, periodo_inicio, periodo_fim } = body;
        if (!colaborador_id || !momento || !categoria) {
          return errorResponse('colaborador_id, momento e categoria obrigatórios', 400);
        }
        // Resolve mentor: da atribuição activa
        const ass = await sql`
          SELECT mentor_id FROM mentor_assignments
          WHERE colaborador_id = ${colaborador_id} AND activo = true LIMIT 1
        `;
        if (!ass.length) return errorResponse('Colaborador sem mentor atribuído', 400);
        const mentorId = ass[0].mentor_id as string;
        if (user.role === 'mentor') {
          const mid = await mentorIdDoUtilizador(user.id);
          if (mid !== mentorId) return errorResponse('Sem acesso a este colaborador', 403);
        }
        const rows = await sql`
          INSERT INTO mentor_avaliacoes
            (colaborador_id, mentor_id, categoria, momento, periodo_inicio, periodo_fim, estado, preenchido_por)
          VALUES
            (${colaborador_id}, ${mentorId}, ${categoria}, ${momento}::momento_avaliacao,
             ${periodo_inicio ?? null}, ${periodo_fim ?? null}, 'rascunho', ${user.id})
          ON CONFLICT (colaborador_id, momento) DO UPDATE SET
            categoria = EXCLUDED.categoria,
            periodo_inicio = COALESCE(EXCLUDED.periodo_inicio, mentor_avaliacoes.periodo_inicio),
            periodo_fim = COALESCE(EXCLUDED.periodo_fim, mentor_avaliacoes.periodo_fim)
          RETURNING *
        `;
        return jsonResponse({ data: rows[0] }, 201);
      }

      // PATCH /:id
      if (method === 'PATCH' && prev === 'mentor-avaliacoes') {
        const id = last;
        const body = await req.json();
        const current = await sql`SELECT * FROM mentor_avaliacoes WHERE id = ${id}`;
        if (!current.length) return errorResponse('Avaliação não encontrada', 404);
        if (user.role === 'mentor') {
          const mid = await mentorIdDoUtilizador(user.id);
          if (current[0].mentor_id !== mid) return errorResponse('Sem acesso', 403);
        }
        const submeter = body.submeter === true;
        const validar = body.validar === true && user.role === 'rh_admin';

        const rows = await sql`
          UPDATE mentor_avaliacoes SET
            criterios = COALESCE(${body.criterios ?? null}::jsonb, criterios),
            comentarios_criterios = COALESCE(${body.comentarios_criterios ?? null}::jsonb, comentarios_criterios),
            pontos_fortes = COALESCE(${body.pontos_fortes ?? null}, pontos_fortes),
            oportunidades_melhoria = COALESCE(${body.oportunidades_melhoria ?? null}, oportunidades_melhoria),
            situacoes_contributo = COALESCE(${body.situacoes_contributo ?? null}, situacoes_contributo),
            classificacao_global = COALESCE(${body.classificacao_global ?? null}, classificacao_global),
            manter_mentor = COALESCE(${body.manter_mentor ?? null}, manter_mentor),
            necessita_orientacao = COALESCE(${body.necessita_orientacao ?? null}, necessita_orientacao),
            necessita_clarificacao = COALESCE(${body.necessita_clarificacao ?? null}, necessita_clarificacao),
            observacoes_dpc = COALESCE(${body.observacoes_dpc ?? null}, observacoes_dpc),
            plano_accao = COALESCE(${body.plano_accao ?? null}::jsonb, plano_accao),
            estado = CASE
              WHEN ${validar}::boolean THEN 'validada'::estado_avaliacao
              WHEN ${submeter}::boolean THEN 'submetida'::estado_avaliacao
              ELSE estado END,
            preenchido_em = CASE WHEN ${submeter}::boolean THEN NOW() ELSE preenchido_em END,
            validado_em = CASE WHEN ${validar}::boolean THEN NOW() ELSE validado_em END,
            validado_por = CASE WHEN ${validar}::boolean THEN ${user.id}::uuid ELSE validado_por END,
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
        if (submeter) {
          await sql`
            INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
            VALUES (${rows[0].colaborador_id}, 'avaliacao_preenchida', ${user.id}, ${user.email}, ${user.role},
                    ${'Avaliação submetida: ' + rows[0].momento})
          `;
          await sql`
            INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, colaborador_id, valor_novo)
            VALUES (${user.id}, ${user.email}, ${user.role}, 'submeter', 'mentor_avaliacao', ${id},
                    ${rows[0].colaborador_id}, ${JSON.stringify({ momento: rows[0].momento, categoria: rows[0].categoria })}::text::jsonb)
          `;
        }
        if (validar) {
          await sql`
            INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, colaborador_id, valor_novo)
            VALUES (${user.id}, ${user.email}, ${user.role}, 'validar', 'mentor_avaliacao', ${id},
                    ${rows[0].colaborador_id}, ${JSON.stringify({ momento: rows[0].momento, observacoes_dpc: rows[0].observacoes_dpc })}::text::jsonb)
          `;
        }
        return jsonResponse({ data: rows[0] });
      }
    }

    // =========================================================
    // COLABORADOR-FEEDBACK
    // =========================================================
    if (isColabFeedback) {
      // GET lista do próprio (novo_colaborador)
      if (method === 'GET' && last === 'colaborador-feedback') {
        if (user.role === 'novo_colaborador') {
          const cid = await colaboradorIdDoUtilizador(user.id);
          if (!cid) return jsonResponse({ data: [] });
          const rows = await sql`
            SELECT * FROM colaborador_feedback WHERE colaborador_id = ${cid} ORDER BY momento
          `;
          return jsonResponse({ data: rows });
        }
        // Admin/mentor: precisa de query ?colaborador_id=
        const cid = url.searchParams.get('colaborador_id');
        if (!cid) return errorResponse('colaborador_id em falta', 400);
        const rows = await sql`
          SELECT * FROM colaborador_feedback WHERE colaborador_id = ${cid} ORDER BY momento
        `;
        return jsonResponse({ data: rows });
      }

      // GET /colaborador/:id
      if (method === 'GET' && prev === 'colaborador') {
        const cid = last;
        if (user.role === 'mentor') {
          const mid = await mentorIdDoUtilizador(user.id);
          if (!mid || !(await mentorTemAcesso(mid, cid))) return errorResponse('Sem acesso', 403);
        }
        const rows = await sql`
          SELECT * FROM colaborador_feedback WHERE colaborador_id = ${cid} ORDER BY momento
        `;
        return jsonResponse({ data: rows });
      }

      // POST criar (só colaborador para si)
      if (method === 'POST' && last === 'colaborador-feedback') {
        const body = await req.json();
        let colaboradorId: string | null = null;
        if (user.role === 'novo_colaborador') {
          colaboradorId = await colaboradorIdDoUtilizador(user.id);
        } else if (user.role === 'rh_admin' && body.colaborador_id) {
          colaboradorId = body.colaborador_id;
        }
        if (!colaboradorId) return errorResponse('Colaborador não identificado', 400);
        const { momento, categoria } = body;
        if (!momento || !categoria) return errorResponse('momento e categoria obrigatórios', 400);
        const rows = await sql`
          INSERT INTO colaborador_feedback (colaborador_id, categoria, momento, desbloqueado, estado)
          VALUES (${colaboradorId}, ${categoria}, ${momento}::momento_avaliacao, true, 'rascunho')
          ON CONFLICT (colaborador_id, momento) DO UPDATE SET desbloqueado = true
          RETURNING *
        `;
        return jsonResponse({ data: rows[0] }, 201);
      }

      // PATCH /:id
      if (method === 'PATCH' && prev === 'colaborador-feedback') {
        const id = last;
        const current = await sql`SELECT * FROM colaborador_feedback WHERE id = ${id}`;
        if (!current.length) return errorResponse('Feedback não encontrado', 404);
        if (user.role === 'novo_colaborador') {
          const cid = await colaboradorIdDoUtilizador(user.id);
          if (cid !== current[0].colaborador_id) return errorResponse('Sem acesso', 403);
        }
        const body = await req.json();
        const submeter = body.submeter === true;
        const rows = await sql`
          UPDATE colaborador_feedback SET
            avaliacao_geral = COALESCE(${body.avaliacao_geral ?? null}::jsonb, avaliacao_geral),
            blocos_aprendizagem = COALESCE(${body.blocos_aprendizagem ?? null}::jsonb, blocos_aprendizagem),
            principais_aprendizagens = COALESCE(${body.principais_aprendizagens ?? null}, principais_aprendizagens),
            duvidas_reforco = COALESCE(${body.duvidas_reforco ?? null}::jsonb, duvidas_reforco),
            stakeholders = COALESCE(${body.stakeholders ?? null}::jsonb, stakeholders),
            oportunidades = COALESCE(${body.oportunidades ?? null}::jsonb, oportunidades),
            suporte_adicional = COALESCE(${body.suporte_adicional ?? null}::jsonb, suporte_adicional),
            feedback_mentor_gestor = COALESCE(${body.feedback_mentor_gestor ?? null}::jsonb, feedback_mentor_gestor),
            classificacao_global = COALESCE(${body.classificacao_global ?? null}, classificacao_global),
            comentarios_finais = COALESCE(${body.comentarios_finais ?? null}, comentarios_finais),
            plano_accao = COALESCE(${body.plano_accao ?? null}::jsonb, plano_accao),
            estado = CASE WHEN ${submeter}::boolean THEN 'submetida'::estado_avaliacao ELSE estado END,
            submetido_em = CASE WHEN ${submeter}::boolean THEN NOW() ELSE submetido_em END,
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
        if (submeter) {
          await sql`
            INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
            VALUES (${rows[0].colaborador_id}, 'feedback_submetido', ${user.id}, ${user.email}, ${user.role},
                    ${'Feedback do colaborador submetido: ' + rows[0].momento})
          `;
          await sql`
            INSERT INTO onboarding_audit (utilizador_id, utilizador_nome, utilizador_role, operacao, entidade, entidade_id, colaborador_id, valor_novo)
            VALUES (${user.id}, ${user.email}, ${user.role}, 'submeter', 'colaborador_feedback', ${id},
                    ${rows[0].colaborador_id}, ${JSON.stringify({ momento: rows[0].momento, categoria: rows[0].categoria })}::text::jsonb)
          `;
        }
        return jsonResponse({ data: rows[0] });
      }
    }

    return errorResponse('Rota não encontrada', 404);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[avaliacoes]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/mentor-avaliacoes',
    '/api/mentor-avaliacoes/:id',
    '/api/mentor-avaliacoes/colaborador/:id',
    '/api/colaborador-feedback',
    '/api/colaborador-feedback/:id',
    '/api/colaborador-feedback/colaborador/:id',
  ],
};
