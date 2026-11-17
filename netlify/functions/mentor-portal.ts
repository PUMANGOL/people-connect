import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { invalidarColaboradores } from './_shared/cache-leitura';
import { emailComentarioMentor } from './_shared/email-templates';
import { mailHasBanner, sendMail } from './_shared/mail';

/**
 * Portal do Mentor — endpoints scoped ao mentor autenticado.
 *
 * GET /api/mentor/dashboard                  — KPIs do mentor
 * GET /api/mentor/mentorados                 — lista dos seus mentorados activos
 * GET /api/mentor/mentorados/:colaboradorId  — detalhe (colaborador + progresso + submissoes + comentarios)
 * PATCH /api/mentor/etapa/:progressoId       — alterar estado / observações / datas de início e fim
 * POST /api/mentor/etapa/:progressoId/concluir — concluir etapa
 * POST /api/mentor/checklist                 — { progresso_id, item_key, concluido } toggle
 * POST /api/mentor/comentarios               — { colaborador_id, texto, visivel_colaborador, etapa_progresso_id? }
 */

function dataIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function mentorIdDoUtilizador(utilizadorId: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM mentors WHERE utilizador_id = ${utilizadorId} AND activo = true`;
  return (rows[0]?.id as string) ?? null;
}

async function garanteMentorTemAcesso(mentorId: string, colaboradorId: string): Promise<boolean> {
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

  try {
    const user = await requireAuth(req);
    if (user.role !== 'mentor' && user.role !== 'rh_admin') {
      return errorResponse('Sem permissão', 403);
    }

    // Admin pode consultar como se fosse qualquer mentor via query ?mentor_id=;
    // por defeito usa o seu próprio perfil de mentor (admins que também são mentores).
    let mentorId: string | null = null;
    if (user.role === 'mentor') {
      mentorId = await mentorIdDoUtilizador(user.id);
      if (!mentorId) return errorResponse('Conta sem perfil de mentor', 400);
    } else {
      mentorId = url.searchParams.get('mentor_id') ?? (await mentorIdDoUtilizador(user.id));
    }

    // ============================================
    // GET /api/mentor/dashboard
    // ============================================
    if (req.method === 'GET' && last === 'dashboard') {
      if (!mentorId) return jsonResponse({ data: { mentorados: 0, concluidos: 0, em_atraso: 0, avaliacoes_pendentes: 0, checkpoints_proximos: [], progresso_medio: 0 } });

      const mentorados = await sql`
        SELECT c.id, c.nome, c.funcao, c.direccao, c.data_admissao, c.estado_onboarding,
               (SELECT COUNT(*) FROM progresso_onboarding p WHERE p.colaborador_id = c.id AND p.estado = 'concluida') AS etapas_concluidas,
               (SELECT COUNT(*) FROM progresso_onboarding p WHERE p.colaborador_id = c.id) AS etapas_total
        FROM mentor_assignments ma
        JOIN colaboradores c ON c.id = ma.colaborador_id
        WHERE ma.mentor_id = ${mentorId} AND ma.activo = true
      `;

      const total = mentorados.length;
      const concluidos = mentorados.filter((m) => m.estado_onboarding === 'concluido').length;
      const emAtraso = mentorados.filter((m) => {
        const totalE = Number(m.etapas_total) || 0;
        const feitas = Number(m.etapas_concluidas) || 0;
        const pct = totalE > 0 ? feitas / totalE : 0;
        const dias = Math.floor((Date.now() - new Date(m.data_admissao as string).getTime()) / (1000 * 60 * 60 * 24));
        return dias > 30 && pct < 0.5;
      }).length;
      const progressoMedio = total > 0
        ? Math.round(mentorados.reduce((s, m) => {
            const t = Number(m.etapas_total) || 0;
            const f = Number(m.etapas_concluidas) || 0;
            return s + (t > 0 ? (f / t) * 100 : 0);
          }, 0) / total)
        : 0;

      const avaliacoesPendentes = await sql`
        SELECT COUNT(*)::int AS n
        FROM colaboradores c
        JOIN mentor_assignments ma ON ma.colaborador_id = c.id AND ma.activo = true
        WHERE ma.mentor_id = ${mentorId}
          AND NOT EXISTS (
            SELECT 1 FROM mentor_avaliacoes a
             WHERE a.colaborador_id = c.id AND a.momento = 'dia_30' AND a.estado <> 'rascunho'
          )
      `;

      const checkpoints = await sql`
        SELECT p.id, p.etapa_id, e.nome AS etapa_nome, p.data_prevista, c.id AS colaborador_id, c.nome AS colaborador_nome
        FROM progresso_onboarding p
        JOIN etapas_trilho e ON e.id = p.etapa_id
        JOIN colaboradores c ON c.id = p.colaborador_id
        JOIN mentor_assignments ma ON ma.colaborador_id = c.id AND ma.activo = true
        WHERE ma.mentor_id = ${mentorId}
          AND p.estado IN ('em_curso', 'em_preparacao', 'aguardar_validacao')
          AND p.data_prevista IS NOT NULL
          AND p.data_prevista <= CURRENT_DATE + INTERVAL '14 days'
        ORDER BY p.data_prevista ASC LIMIT 10
      `;

      return jsonResponse({
        data: {
          mentorados: total,
          concluidos,
          em_atraso: emAtraso,
          progresso_medio: progressoMedio,
          avaliacoes_pendentes: avaliacoesPendentes[0].n,
          checkpoints_proximos: checkpoints,
        },
      });
    }

    // ============================================
    // GET /api/mentor/mentorados
    // ============================================
    if (req.method === 'GET' && last === 'mentorados') {
      if (!mentorId) return jsonResponse({ data: [] });
      const rows = await sql`
        SELECT c.id, c.nome, c.funcao, c.direccao, c.email, c.categoria, c.data_admissao,
               c.estado_onboarding, c.welcome_completed, c.trilho_id,
               (SELECT COUNT(*) FROM progresso_onboarding p WHERE p.colaborador_id = c.id AND p.estado = 'concluida') AS etapas_concluidas,
               (SELECT COUNT(*) FROM progresso_onboarding p WHERE p.colaborador_id = c.id) AS etapas_total,
               ma.atribuido_em
        FROM mentor_assignments ma
        JOIN colaboradores c ON c.id = ma.colaborador_id
        WHERE ma.mentor_id = ${mentorId} AND ma.activo = true
        ORDER BY c.data_admissao DESC
      `;
      return jsonResponse({ data: rows });
    }

    // GET /api/mentor/mentorados/:colaboradorId
    if (req.method === 'GET' && prev === 'mentorados') {
      const colaboradorId = last;
      if (mentorId && !(await garanteMentorTemAcesso(mentorId, colaboradorId)) && user.role !== 'rh_admin') {
        return errorResponse('Sem acesso a este colaborador', 403);
      }
      const colab = await sql`
        SELECT c.*,
               COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome
        FROM colaboradores c
        LEFT JOIN mentor_assignments ma ON ma.colaborador_id = c.id AND ma.activo = true
        LEFT JOIN mentors m ON m.id = ma.mentor_id
        LEFT JOIN utilizadores u ON u.id = m.utilizador_id
        WHERE c.id = ${colaboradorId}
      `;
      if (!colab.length) return errorResponse('Colaborador não encontrado', 404);
      const progresso = await sql`
        SELECT p.*, e.nome AS etapa_nome, e.tipo AS etapa_tipo, e.duracao_dias, e.descricao,
               e.ordem, e.fase, e.fase_nome, e.responsavel_default, e.checklist_items, e.obrigatoria, e.bloqueante,
               COALESCE(e.documentos_pedidos, '[]'::jsonb) AS documentos_pedidos
        FROM progresso_onboarding p
        LEFT JOIN etapas_trilho e ON e.id = p.etapa_id
        WHERE p.colaborador_id = ${colaboradorId}
        ORDER BY e.ordem ASC
      `;
      const checklistProgresso = await sql`
        SELECT cp.progresso_id, cp.item_key, cp.concluido, cp.concluido_em, cp.comentario
        FROM checklist_progresso cp
        JOIN progresso_onboarding p ON p.id = cp.progresso_id
        WHERE p.colaborador_id = ${colaboradorId}
      `;
      const comentarios = await sql`
        SELECT * FROM onboarding_comentarios
        WHERE colaborador_id = ${colaboradorId}
        ORDER BY created_at DESC LIMIT 50
      `;
      return jsonResponse({ data: { colaborador: colab[0], progresso, checklist_progresso: checklistProgresso, comentarios } });
    }

    // ============================================
    // PATCH /api/mentor/etapa/:progressoId
    // ============================================
    if (req.method === 'PATCH' && prev === 'etapa') {
      const progressoId = last;
      const body = await req.json();

      // Verifica ownership
      const check = await sql`
        SELECT p.id, p.colaborador_id
        FROM progresso_onboarding p
        JOIN mentor_assignments ma ON ma.colaborador_id = p.colaborador_id AND ma.activo = true
        WHERE p.id = ${progressoId} AND (${user.role === 'rh_admin'}::boolean OR ma.mentor_id = ${mentorId})
      `;
      if (!check.length) return errorResponse('Etapa não acessível', 403);

      const validStates = ['pendente','em_preparacao','em_curso','aguardar_validacao','concluida','reagendada','bloqueada','cancelada','atrasada'];
      const novoEstado = body.estado && validStates.includes(body.estado) ? body.estado : null;

      const atual = await sql`
        SELECT data_inicio, data_prevista FROM progresso_onboarding WHERE id = ${progressoId} LIMIT 1
      `;
      const inicioPedido = body.data_inicio !== undefined ? dataIso(body.data_inicio) : undefined;
      const fimPedido = body.data_prevista !== undefined ? dataIso(body.data_prevista) : undefined;
      if (body.data_inicio !== undefined && body.data_inicio && inicioPedido == null) {
        return errorResponse('Data de início inválida', 400);
      }
      if (body.data_prevista !== undefined && body.data_prevista && fimPedido == null) {
        return errorResponse('Data de fim inválida', 400);
      }
      const inicioEff = inicioPedido ?? dataIso(atual[0]?.data_inicio);
      const fimEff = fimPedido ?? dataIso(atual[0]?.data_prevista);
      if (inicioEff && fimEff && fimEff < inicioEff) {
        return errorResponse('A data de fim tem de ser igual ou posterior à data de início', 400);
      }

      const responsavelPedido = user.role === 'rh_admin' && body.responsavel !== undefined
        ? (typeof body.responsavel === 'string' ? body.responsavel.trim() : null)
        : null;

      const rows = await sql`
        UPDATE progresso_onboarding SET
          estado = COALESCE(${novoEstado}::estado_etapa, estado),
          data_inicio = COALESCE(${inicioPedido ?? null}::date, data_inicio),
          data_prevista = COALESCE(${fimPedido ?? null}::date, data_prevista),
          observacoes = COALESCE(${body.observacoes ?? null}, observacoes),
          responsavel = COALESCE(${responsavelPedido}, responsavel)
        WHERE id = ${progressoId}
        RETURNING id, estado, data_inicio, data_prevista, observacoes, responsavel, colaborador_id
      `;
      if (novoEstado) {
        await sql`
          INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao, meta)
          VALUES (${rows[0].colaborador_id}, 'etapa_estado_alterado', ${user.id}, ${user.email}, ${user.role},
                  ${'Etapa passou para: ' + novoEstado},
                  ${JSON.stringify({ progresso_id: progressoId, novo_estado: novoEstado })}::text::jsonb)
        `;
      }
      invalidarColaboradores();
      return jsonResponse({ data: rows[0] });
    }

    // POST /api/mentor/etapa/:progressoId/concluir
    if (req.method === 'POST' && prev === 'etapa' && parts[parts.length] === 'concluir') {
      // path style with concluir last
      return errorResponse('Rota mal formatada', 405);
    }
    if (req.method === 'POST' && last === 'concluir' && parts[parts.length - 3] === 'etapa') {
      const progressoId = parts[parts.length - 2];
      const check = await sql`
        SELECT p.id, p.colaborador_id, e.nome AS etapa_nome
        FROM progresso_onboarding p
        JOIN etapas_trilho e ON e.id = p.etapa_id
        JOIN mentor_assignments ma ON ma.colaborador_id = p.colaborador_id AND ma.activo = true
        WHERE p.id = ${progressoId} AND (${user.role === 'rh_admin'}::boolean OR ma.mentor_id = ${mentorId})
      `;
      if (!check.length) return errorResponse('Etapa não acessível', 403);

      await sql`
        UPDATE progresso_onboarding
           SET estado = 'concluida', data_conclusao = CURRENT_DATE,
               validado_por = ${user.id}, validado_em = NOW()
         WHERE id = ${progressoId}
      `;
      // Desbloqueia a seguinte
      const prox = await sql`
        SELECT p.id FROM progresso_onboarding p
        JOIN etapas_trilho e ON e.id = p.etapa_id
        WHERE p.colaborador_id = ${check[0].colaborador_id} AND p.estado = 'pendente'
        ORDER BY e.ordem LIMIT 1
      `;
      if (prox.length) {
        await sql`UPDATE progresso_onboarding SET estado = 'em_curso', data_inicio = COALESCE(data_inicio, CURRENT_DATE) WHERE id = ${prox[0].id}`;
      }
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
        VALUES (${check[0].colaborador_id}, 'etapa_concluida', ${user.id}, ${user.email}, ${user.role},
                ${'Etapa concluída: ' + check[0].etapa_nome})
      `;
      invalidarColaboradores();
      return jsonResponse({ data: { ok: true } });
    }

    // POST /api/mentor/checklist
    if (req.method === 'POST' && last === 'checklist') {
      const body = await req.json();
      const { progresso_id, item_key, concluido, comentario } = body;
      if (!progresso_id || !item_key) return errorResponse('progresso_id e item_key obrigatórios', 400);
      const check = await sql`
        SELECT p.id, p.colaborador_id FROM progresso_onboarding p
        JOIN mentor_assignments ma ON ma.colaborador_id = p.colaborador_id AND ma.activo = true
        WHERE p.id = ${progresso_id} AND (${user.role === 'rh_admin'}::boolean OR ma.mentor_id = ${mentorId})
      `;
      if (!check.length) return errorResponse('Etapa não acessível', 403);

      const rows = await sql`
        INSERT INTO checklist_progresso (progresso_id, item_key, concluido, concluido_em, concluido_por, comentario)
        VALUES (${progresso_id}, ${item_key}, ${concluido ?? true},
                ${concluido ? new Date().toISOString() : null}, ${user.id}, ${comentario ?? null})
        ON CONFLICT (progresso_id, item_key) DO UPDATE SET
          concluido = EXCLUDED.concluido,
          concluido_em = CASE WHEN EXCLUDED.concluido THEN NOW() ELSE NULL END,
          concluido_por = ${user.id},
          comentario = COALESCE(EXCLUDED.comentario, checklist_progresso.comentario)
        RETURNING *
      `;
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao, meta)
        VALUES (${check[0].colaborador_id}, 'checklist_item_concluido', ${user.id}, ${user.email}, ${user.role},
                ${'Item de checklist actualizado: ' + item_key},
                ${JSON.stringify({ item_key, concluido })}::text::jsonb)
      `;
      return jsonResponse({ data: rows[0] });
    }

    // POST /api/mentor/comentarios
    if (req.method === 'POST' && last === 'comentarios') {
      const body = await req.json();
      const { colaborador_id, texto, visivel_colaborador, etapa_progresso_id } = body;
      if (!colaborador_id || !texto) return errorResponse('colaborador_id e texto obrigatórios', 400);
      if (mentorId && !(await garanteMentorTemAcesso(mentorId, colaborador_id)) && user.role !== 'rh_admin') {
        return errorResponse('Sem acesso a este colaborador', 403);
      }
      const rows = await sql`
        INSERT INTO onboarding_comentarios
          (colaborador_id, etapa_progresso_id, autor_id, autor_nome, autor_role, visivel_colaborador, texto)
        VALUES (${colaborador_id}, ${etapa_progresso_id ?? null}, ${user.id}, ${user.email}, ${user.role},
                ${visivel_colaborador ?? true}, ${texto})
        RETURNING *
      `;
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
        VALUES (${colaborador_id}, 'comentario_mentor', ${user.id}, ${user.email}, ${user.role},
                ${'Novo comentário do mentor'})
      `;
      if (visivel_colaborador !== false) {
        const colabUser = await sql`
          SELECT c.nome, c.utilizador_id,
                 COALESCE(NULLIF(btrim(c.email), ''), u.email) AS email
          FROM colaboradores c
          LEFT JOIN utilizadores u ON u.id = c.utilizador_id
          WHERE c.id = ${colaborador_id}
          LIMIT 1
        `;
        const destinatario = colabUser[0];
        if (destinatario?.utilizador_id) {
          await sql`
            INSERT INTO onboarding_notificacoes
              (destinatario_id, destinatario_role, colaborador_id, tipo, titulo, mensagem, link_accao)
            VALUES (${destinatario.utilizador_id}, 'novo_colaborador', ${colaborador_id}, 'comentario_recebido',
                    'Novo comentário do seu mentor', ${texto.substring(0, 200)}, '/colaborador/comentarios')
          `;
        }
        const email = typeof destinatario?.email === 'string' ? destinatario.email.trim() : '';
        if (email) {
          try {
            const autor = await sql`
              SELECT COALESCE(NULLIF(btrim(m.nome), ''), ${user.nome}) AS nome
              FROM mentors m
              WHERE m.utilizador_id = ${user.id}
              LIMIT 1
            `;
            const autorNome = (autor[0]?.nome as string | undefined) || user.nome || 'O seu mentor';
            const hasBanner = await mailHasBanner();
            const message = emailComentarioMentor({
              mentoradoNome: (destinatario?.nome as string | undefined) || 'colega',
              autorNome,
              texto,
              hasBanner,
            });
            await sendMail({ to: email, ...message, contexto: 'comentario-mentor' });
          } catch (mailErr) {
            console.error('[mentor-portal] email de comentário', mailErr);
          }
        }
      }
      return jsonResponse({ data: rows[0] }, 201);
    }

    return errorResponse('Rota não encontrada', 404);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[mentor-portal]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/mentor/dashboard',
    '/api/mentor/mentorados',
    '/api/mentor/mentorados/:colaboradorId',
    '/api/mentor/etapa/:progressoId',
    '/api/mentor/etapa/:progressoId/concluir',
    '/api/mentor/checklist',
    '/api/mentor/comentarios',
  ],
};
