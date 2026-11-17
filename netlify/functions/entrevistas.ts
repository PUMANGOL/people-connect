import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1] !== 'entrevistas' ? parts[parts.length - 1] : null;
  const method = req.method;

  try {
    if (method === 'GET' && !id) {
      const rows = await sql`
        SELECT e.*, c.nome as candidato_nome, c.email as candidato_email
        FROM entrevistas e
        LEFT JOIN candidatos c ON c.id = e.candidato_id
        ORDER BY e.data DESC LIMIT 200
      `;
      return jsonResponse({ data: rows });
    }

    if (method === 'POST') {
      const body = await req.json();
      const { candidato_id, fase, entrevistador, data } = body;
      const rows = await sql`
        INSERT INTO entrevistas (candidato_id, fase, entrevistador, data)
        VALUES (${candidato_id}, ${fase}::fase_entrevista, ${entrevistador}, ${data})
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    if (method === 'PATCH' && id) {
      const body = await req.json();
      const { avaliacao, parecer, recomendacao } = body;
      const rows = await sql`
        UPDATE entrevistas SET
          avaliacao = COALESCE(${avaliacao ? JSON.stringify(avaliacao) : null}::text::jsonb, avaliacao),
          parecer = COALESCE(${parecer}, parecer),
          recomendacao = COALESCE(${recomendacao}::recomendacao_entrevista, recomendacao)
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    console.error('entrevistas error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/entrevistas', '/api/entrevistas/:id'],
};
