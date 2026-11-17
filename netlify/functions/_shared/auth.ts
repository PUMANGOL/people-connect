import { sql, errorResponse } from './db';
import { ensureAuthReady, getAuth } from '@/src/lib/auth';

/**
 * Sessão better-auth (cookie). A identidade da aplicação continua a ser
 * `utilizadores.id`, que é também o id da conta de autenticação.
 */

export type AuthRole = 'rh_admin' | 'mentor' | 'novo_colaborador';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: AuthRole;
  departamento?: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function asRole(value: unknown): AuthRole {
  if (value === 'rh_admin' || value === 'mentor') return value;
  return 'novo_colaborador';
}

/** Extrai a sessão. Lança AuthError se em falta, expirada ou inactiva. */
export async function requireAuth(req: Request): Promise<AuthUser> {
  await ensureAuthReady();
  const session = await getAuth().api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    throw new AuthError('Sessão expirada. Faça login novamente.');
  }

  let rows;
  try {
    rows = await sql`
      SELECT id, nome, email, perfil::text AS perfil, departamento
      FROM utilizadores
      WHERE id = ${session.user.id}::uuid
        AND estado = 'activo'
      LIMIT 1
    `;
  } catch {
    throw new AuthError('Sessão inválida. Faça login novamente.');
  }

  if (!rows.length) {
    throw new AuthError('Conta inactiva ou inexistente. Faça login novamente.');
  }

  const user = rows[0];
  return {
    id: user.id as string,
    nome: user.nome as string,
    email: user.email as string,
    role: asRole(user.perfil),
    departamento: (user.departamento as string | null) ?? undefined,
  };
}

export async function optionalAuth(req: Request): Promise<AuthUser | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

export function authErrorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return errorResponse(err.message, err.status);
  }
  return errorResponse('Erro de autenticação', 401);
}
