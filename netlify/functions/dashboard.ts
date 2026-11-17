import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const [vagasAbertas, candidatosActivos, onboardingCurso, interaccoes, escalacoes] = await Promise.all([
      sql`SELECT COUNT(*) as n FROM vagas WHERE estado = 'aberta'`,
      sql`SELECT COUNT(*) as n FROM candidatos WHERE estado_pipeline NOT IN ('contratacao', 'transicao_onboarding')`,
      sql`SELECT COUNT(*) as n FROM colaboradores WHERE estado_onboarding = 'em_curso'`,
      sql`SELECT COUNT(*) as n FROM chat_mensagens WHERE papel = 'user' AND created_at > NOW() - INTERVAL '30 days'`,
      sql`SELECT COUNT(*) as n FROM escalacoes WHERE criado_em > NOW() - INTERVAL '30 days'`,
    ]);

    const pipelineFases = await sql`
      SELECT estado_pipeline, COUNT(*) as n
      FROM candidatos
      GROUP BY estado_pipeline
      ORDER BY estado_pipeline
    `;

    const vagasDireccao = await sql`
      SELECT direccao, COUNT(*) as n
      FROM vagas
      WHERE estado = 'aberta'
      GROUP BY direccao
      ORDER BY n DESC
    `;

    const topPerguntas = await sql`
      SELECT conteudo as pergunta, COUNT(*) as vezes
      FROM chat_mensagens
      WHERE papel = 'user' AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY conteudo
      ORDER BY vezes DESC
      LIMIT 10
    `;

    const resolucaoIa = interaccoes[0].n > 0
      ? Math.round(((Number(interaccoes[0].n) - Number(escalacoes[0].n)) / Number(interaccoes[0].n)) * 100)
      : 0;

    return jsonResponse({
      data: {
        kpis: {
          vagas_abertas: Number(vagasAbertas[0].n),
          candidatos_activos: Number(candidatosActivos[0].n),
          colaboradores_onboarding: Number(onboardingCurso[0].n),
          interaccoes_ia: Number(interaccoes[0].n),
          escalacoes: Number(escalacoes[0].n),
          taxa_resolucao_ia: resolucaoIa,
        },
        pipeline_por_fase: pipelineFases,
        vagas_por_direccao: vagasDireccao,
        top_perguntas: topPerguntas,
      },
    });
  } catch (err) {
    console.error('dashboard error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: '/api/dashboard',
};
