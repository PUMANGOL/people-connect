import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import {
  getDefaultAgentConfig,
  invalidateAgentConfigCache,
  loadAgentConfig,
  toAdminConfig,
  toPublicConfig,
  validateAgentConfigPatch,
} from './_shared/agent/config';

/**
 * GET  /api/agent-config          — autenticado; admin vê full, outros só public
 * GET  /api/agent-config?public=1 — só boas-vindas + email (qualquer autenticado)
 * PATCH /api/agent-config         — rh_admin only
 * POST /api/agent-config/reset    — rh_admin: restaura defaults de fábrica
 */

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await requireAuth(req);
    const url = new URL(req.url);
    const isReset = url.pathname.endsWith('/reset');
    const method = req.method;

    if (method === 'GET') {
      const cfg = await loadAgentConfig(true);
      if (url.searchParams.get('public') === '1' || user.role !== 'rh_admin') {
        return jsonResponse({ data: toPublicConfig(cfg) });
      }
      return jsonResponse({ data: toAdminConfig(cfg), defaults: toAdminConfig(getDefaultAgentConfig()) });
    }

    if (user.role !== 'rh_admin') {
      return errorResponse('Apenas administradores RH podem alterar a config do agente', 403);
    }

    if (!isDatabaseConfigured()) {
      return errorResponse('DATABASE_URL não configurada', 503);
    }

    if (method === 'POST' && isReset) {
      const defaults = getDefaultAgentConfig();
      const rows = await sql`
        INSERT INTO agent_config (
          chave, system_prompt, mensagem_boas_vindas, email_escalacao,
          temperature, max_tokens, top_k, min_relevance_score,
          max_tool_steps, reasoning_effort, actualizado_por, updated_at
        ) VALUES (
          'default',
          ${defaults.system_prompt},
          ${defaults.mensagem_boas_vindas},
          ${defaults.email_escalacao},
          ${defaults.temperature},
          ${defaults.max_tokens},
          ${defaults.top_k},
          ${defaults.min_relevance_score},
          ${defaults.max_tool_steps},
          ${defaults.reasoning_effort},
          ${user.id},
          NOW()
        )
        ON CONFLICT (chave) DO UPDATE SET
          system_prompt = EXCLUDED.system_prompt,
          mensagem_boas_vindas = EXCLUDED.mensagem_boas_vindas,
          email_escalacao = EXCLUDED.email_escalacao,
          temperature = EXCLUDED.temperature,
          max_tokens = EXCLUDED.max_tokens,
          top_k = EXCLUDED.top_k,
          min_relevance_score = EXCLUDED.min_relevance_score,
          max_tool_steps = EXCLUDED.max_tool_steps,
          reasoning_effort = EXCLUDED.reasoning_effort,
          actualizado_por = EXCLUDED.actualizado_por,
          updated_at = NOW()
        RETURNING *
      `;
      invalidateAgentConfigCache();
      try {
        await sql`
          INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
          VALUES (${user.id}, 'agent_config_reset', 'agent_config', ${rows[0].id}, ${JSON.stringify(toAdminConfig(getDefaultAgentConfig()))}::text::jsonb)
        `;
      } catch {
        /* audit optional */
      }
      return jsonResponse({ data: toAdminConfig(await loadAgentConfig(true)), message: 'Defaults restaurados' });
    }

    if (method === 'PATCH') {
      const body = (await req.json()) as Record<string, unknown>;
      const validated = validateAgentConfigPatch(body);
      if (validated.ok === false) return errorResponse(validated.error, 400);

      const d = validated.data;
      // Carregar actual e merge
      const current = await loadAgentConfig(true);
      const next = {
        system_prompt: d.system_prompt ?? current.system_prompt,
        mensagem_boas_vindas: d.mensagem_boas_vindas ?? current.mensagem_boas_vindas,
        email_escalacao: d.email_escalacao ?? current.email_escalacao,
        temperature: d.temperature ?? current.temperature,
        max_tokens: d.max_tokens ?? current.max_tokens,
        top_k: d.top_k ?? current.top_k,
        min_relevance_score: d.min_relevance_score ?? current.min_relevance_score,
        max_tool_steps: d.max_tool_steps ?? current.max_tool_steps,
        reasoning_effort: d.reasoning_effort ?? current.reasoning_effort,
      };

      const rows = await sql`
        INSERT INTO agent_config (
          chave, system_prompt, mensagem_boas_vindas, email_escalacao,
          temperature, max_tokens, top_k, min_relevance_score,
          max_tool_steps, reasoning_effort, actualizado_por, updated_at
        ) VALUES (
          'default',
          ${next.system_prompt},
          ${next.mensagem_boas_vindas},
          ${next.email_escalacao},
          ${next.temperature},
          ${next.max_tokens},
          ${next.top_k},
          ${next.min_relevance_score},
          ${next.max_tool_steps},
          ${next.reasoning_effort},
          ${user.id},
          NOW()
        )
        ON CONFLICT (chave) DO UPDATE SET
          system_prompt = EXCLUDED.system_prompt,
          mensagem_boas_vindas = EXCLUDED.mensagem_boas_vindas,
          email_escalacao = EXCLUDED.email_escalacao,
          temperature = EXCLUDED.temperature,
          max_tokens = EXCLUDED.max_tokens,
          top_k = EXCLUDED.top_k,
          min_relevance_score = EXCLUDED.min_relevance_score,
          max_tool_steps = EXCLUDED.max_tool_steps,
          reasoning_effort = EXCLUDED.reasoning_effort,
          actualizado_por = EXCLUDED.actualizado_por,
          updated_at = NOW()
        RETURNING *
      `;

      invalidateAgentConfigCache();

      try {
        await sql`
          INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_anteriores, dados_novos)
          VALUES (
            ${user.id},
            'agent_config_update',
            'agent_config',
            ${rows[0].id},
            ${JSON.stringify(toAdminConfig(current))}::text::jsonb,
            ${JSON.stringify(toAdminConfig(await loadAgentConfig(true)))}::text::jsonb
          )
        `;
      } catch {
        /* audit optional */
      }

      return jsonResponse({ data: toAdminConfig(await loadAgentConfig(true)) });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[agent-config]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/agent-config', '/api/agent-config/reset'],
};
