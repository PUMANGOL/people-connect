import { createHash, randomBytes } from 'node:crypto';
import { sql } from '@/netlify/functions/_shared/db';
import { invalidarMentores } from '@/netlify/functions/_shared/cache-leitura';
import { bindAuthSync, ensureAuthReady, getAuth } from './auth-runtime';
import { hashPassword } from './password';

const CONVITE_TTL_MS = 72 * 60 * 60 * 1000;

type UtilizadorRow = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  departamento: string | null;
  password_hash: string | null;
};

export async function ensureConvitesTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS acesso_convites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      utilizador_id uuid NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function loadActivo(email: string): Promise<UtilizadorRow | null> {
  const rows = await sql`
    SELECT id, nome, email, perfil::text AS perfil, departamento, password_hash
    FROM utilizadores
    WHERE lower(email) = lower(${email})
      AND estado = 'activo'
    LIMIT 1
  `;
  return (rows[0] as UtilizadorRow | undefined) ?? null;
}

/**
 * Garante a conta na base de identidade (`AUTH_DATABASE_URL`) com o mesmo id
 * de `utilizadores` na base do Onboarding. A password já gravada (bcrypt)
 * é reutilizada — não volta a ser cifrada. O perfil lê-se sempre de `utilizadores`.
 */
export async function ensureCredentialForEmail(email: string): Promise<void> {
  await ensureAuthReady();
  const user = await loadActivo(email);
  if (!user?.password_hash) return;

  const ctx = await getAuth().$context;
  let existing = await ctx.internalAdapter.findUserByEmail(user.email, { includeAccounts: true });
  if (existing && existing.user.id !== user.id) {
    await ctx.internalAdapter.deleteUser(existing.user.id);
    existing = null;
  }

  if (!existing) {
    const byId = await ctx.internalAdapter.findUserById(user.id);
    if (byId) {
      await ctx.internalAdapter.updateUser(user.id, {
        name: user.nome,
        email: user.email,
        role: user.perfil,
        departamento: user.departamento,
      });
      existing = { user: byId, accounts: [] };
    }
  }

  if (!existing) {
    try {
      await ctx.internalAdapter.createUser({
        id: user.id,
        name: user.nome,
        email: user.email,
        emailVerified: true,
        role: user.perfil,
        departamento: user.departamento,
      }, { method: 'admin' });
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: user.password_hash,
      });
    } catch (err) {
      const again = await ctx.internalAdapter.findUserByEmail(user.email);
      if (again?.user.id === user.id) return;
      const sameId = await ctx.internalAdapter.findUserById(user.id);
      if (!sameId) throw err;
      await ctx.internalAdapter.updateUser(user.id, {
        name: user.nome,
        email: user.email,
        role: user.perfil,
        departamento: user.departamento,
      });
    }
    return;
  }

  await ctx.internalAdapter.updateUser(user.id, {
    name: user.nome,
    role: user.perfil,
    departamento: user.departamento,
  });
  const credential = await ctx.internalAdapter.findCredentialAccount(user.id);
  if (!credential) {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: user.password_hash,
    });
    return;
  }
  if (credential.password !== user.password_hash) {
    await ctx.internalAdapter.updatePassword(user.id, user.password_hash);
  }
}

/** Grava a password nova no utilizador e na conta better-auth. */
export async function setPasswordForUtilizador(utilizadorId: string, password: string): Promise<string> {
  await ensureAuthReady();
  const rows = await sql`
    SELECT email FROM utilizadores WHERE id = ${utilizadorId}::uuid AND estado = 'activo' LIMIT 1
  `;
  const email = rows[0]?.email as string | undefined;
  if (!email) throw new Error('Utilizador não encontrado');

  const passwordHash = await hashPassword(password);
  await sql`
    UPDATE utilizadores
       SET password_hash = ${passwordHash}
     WHERE id = ${utilizadorId}::uuid
  `;
  invalidarMentores();
  await ensureCredentialForEmail(email);
  return email;
}

export async function criarConvitePassword(utilizadorId: string): Promise<string> {
  await ensureAuthReady();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + CONVITE_TTL_MS).toISOString();

  await sql`
    UPDATE acesso_convites
       SET used_at = now()
     WHERE utilizador_id = ${utilizadorId}::uuid
       AND used_at IS NULL
  `;
  await sql`
    INSERT INTO acesso_convites (utilizador_id, token_hash, expires_at)
    VALUES (${utilizadorId}::uuid, ${tokenHash}, ${expires})
  `;
  return token;
}

export async function consumirConvitePassword(token: string, password: string): Promise<string> {
  if (!token || password.length < 8) {
    throw new Error('Dados inválidos');
  }
  await ensureAuthReady();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const rows = await sql`
    SELECT id, utilizador_id
    FROM acesso_convites
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;
  if (!rows.length) throw new Error('Link inválido ou expirado');

  const email = await setPasswordForUtilizador(rows[0].utilizador_id as string, password);
  await sql`
    UPDATE acesso_convites SET used_at = now() WHERE id = ${rows[0].id}
  `;
  return email;
}

bindAuthSync({ ensureConvitesTable, ensureCredentialForEmail });
