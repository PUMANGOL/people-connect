import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1] !== 'candidatos' ? parts[parts.length - 1] : null;
  const method = req.method;
  const vagaId = url.searchParams.get('vaga_id');

  try {
    if (method === 'GET' && !id) {
      const rows = vagaId
        ? await sql`SELECT * FROM candidatos WHERE vaga_id = ${vagaId} ORDER BY created_at DESC`
        : await sql`SELECT * FROM candidatos ORDER BY created_at DESC LIMIT 200`;
      return jsonResponse({ data: rows });
    }

    if (method === 'POST') {
      const body = await req.json();
      const { vaga_id, nome, email, telefone, origem, estado_pipeline } = body;
      const rows = await sql`
        INSERT INTO candidatos (vaga_id, nome, email, telefone, origem, estado_pipeline)
        VALUES (${vaga_id}, ${nome}, ${email ?? null}, ${telefone ?? null}, ${origem ?? 'candidatura_espontanea'}::origem_candidato, ${estado_pipeline ?? 'triagem_cvs'}::estado_pipeline)
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    if (method === 'PATCH' && id) {
      const body = await req.json();
      const { estado_pipeline, nome, email, telefone } = body;
      const rows = await sql`
        UPDATE candidatos SET
          estado_pipeline = COALESCE(${estado_pipeline}::estado_pipeline, estado_pipeline),
          nome = COALESCE(${nome}, nome),
          email = COALESCE(${email}, email),
          telefone = COALESCE(${telefone}, telefone),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    console.error('candidatos error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/candidatos', '/api/candidatos/:id'],
};
