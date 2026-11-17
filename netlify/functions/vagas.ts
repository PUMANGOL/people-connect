import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = url.pathname.split('/').filter(Boolean).pop();
  const method = req.method;

  try {
    // GET /vagas — list
    if (method === 'GET' && (id === 'vagas' || !id)) {
      const rows = await sql`SELECT * FROM vagas ORDER BY created_at DESC LIMIT 100`;
      return jsonResponse({ data: rows });
    }

    // GET /vagas/:id
    if (method === 'GET' && id) {
      const rows = await sql`SELECT * FROM vagas WHERE id = ${id}`;
      if (rows.length === 0) return errorResponse('Vaga não encontrada', 404);
      return jsonResponse({ data: rows[0] });
    }

    // POST /vagas
    if (method === 'POST') {
      const body = await req.json();
      const { titulo, direccao, justificativa, numero_posicoes, prazo_alvo, requisitos, owner, referencia_externa } = body;
      const rows = await sql`
        INSERT INTO vagas (titulo, direccao, justificativa, numero_posicoes, prazo_alvo, requisitos, owner, referencia_externa)
        VALUES (${titulo}, ${direccao}, ${justificativa ?? null}, ${numero_posicoes ?? 1}, ${prazo_alvo ?? null}, ${requisitos ?? null}, ${owner ?? null}, ${referencia_externa ?? null})
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] }, 201);
    }

    // PATCH /vagas/:id
    if (method === 'PATCH' && id) {
      const body = await req.json();
      const { titulo, direccao, estado, prazo_alvo, requisitos, referencia_externa } = body;
      const rows = await sql`
        UPDATE vagas SET
          titulo = COALESCE(${titulo}, titulo),
          direccao = COALESCE(${direccao}, direccao),
          estado = COALESCE(${estado}::estado_vaga, estado),
          prazo_alvo = COALESCE(${prazo_alvo}, prazo_alvo),
          requisitos = COALESCE(${requisitos}, requisitos),
          referencia_externa = COALESCE(${referencia_externa}, referencia_externa),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return jsonResponse({ data: rows[0] });
    }

    // DELETE /vagas/:id
    if (method === 'DELETE' && id) {
      await sql`DELETE FROM vagas WHERE id = ${id}`;
      return jsonResponse({ ok: true });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    console.error('vagas error:', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/vagas', '/api/vagas/:id'],
};
