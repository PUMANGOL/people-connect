import { sql } from './db';
import type { AuthUser } from './auth';

/** Admin RH, o próprio colaborador ou o mentor com atribuição activa. */
export async function podeVerColaborador(user: AuthUser, colaboradorId: string): Promise<boolean> {
  if (user.role === 'rh_admin') return true;
  const rows = await sql`
    SELECT 1
      FROM colaboradores c
     WHERE c.id = ${colaboradorId}
       AND (c.utilizador_id = ${user.id}
            OR EXISTS (
              SELECT 1 FROM mentor_assignments ma
                JOIN mentors m ON m.id = ma.mentor_id
               WHERE ma.colaborador_id = c.id AND ma.activo AND m.utilizador_id = ${user.id}
            ))
     LIMIT 1
  `;
  return rows.length > 0;
}
