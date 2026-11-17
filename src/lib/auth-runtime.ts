import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { Pool, type PoolClient } from 'pg';
import { sql } from '@/netlify/functions/_shared/db';
import { hashPassword, verifyPassword } from './password';
import { appBaseUrl } from './app-url';

const SESSION_SECONDS = 8 * 60 * 60;

type AuthInstance = ReturnType<typeof betterAuth>;

type AuthSync = {
  ensureConvitesTable: () => Promise<void>;
  ensureCredentialForEmail: (email: string) => Promise<void>;
};

let pool: Pool | null = null;
let auth: AuthInstance | null = null;
let ready: Promise<void> | null = null;
let authSync: AuthSync | null = null;

/** Registado por auth-sync, sem import circular. */
export function bindAuthSync(sync: AuthSync): void {
  authSync = sync;
}

function authDatabaseUrl(): string {
  const url = process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error('AUTH_DATABASE_URL não configurada');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('AUTH_DATABASE_URL inválida');
  }
  if (!parsed.username) {
    throw new Error(
      'AUTH_DATABASE_URL sem utilizador. Formato: postgresql://utilizador:password@host:5432/next_pumangol_auth',
    );
  }
  return url;
}

function sameDatabase(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.host === b.host && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

function getPool(): Pool {
  if (pool) return pool;
  const url = authDatabaseUrl();
  pool = new Pool({
    connectionString: url,
    max: 10,
    ssl: /sslmode=require/i.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

function buildOptions() {
  const baseURL = appBaseUrl();
  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET não configurado');
  return {
    appName: 'Pumangol People Connect',
    baseURL,
    secret,
    trustedOrigins: [baseURL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    database: getPool(),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    session: {
      expiresIn: SESSION_SECONDS,
      updateAge: 60 * 60,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string' as const,
          required: false,
          input: false,
          defaultValue: 'novo_colaborador',
        },
        departamento: {
          type: 'string' as const,
          required: false,
          input: false,
        },
      },
    },
    advanced: {
      database: {
        generateId: 'uuid' as const,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.includes('sign-in/email')) return;
        const body = ctx.body as { email?: unknown } | undefined;
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        if (!email || !authSync) return;
        await authSync.ensureCredentialForEmail(email);
      }),
    },
  };
}

type AppUser = {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  role: string | null;
  departamento: string | null;
};

type AppAccount = {
  id: string;
  account_id: string;
  provider_id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: Date | string | null;
  refresh_token_expires_at: Date | string | null;
  scope: string | null;
  password: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

/**
 * Copia as contas já gravadas na base do Onboarding para a base de identidade,
 * uma vez, com o mesmo id. As sessões não seguem: o login volta a criá-las.
 */
async function seedAuthFromApp(client: PoolClient): Promise<void> {
  const appUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || '';
  if (!appUrl || sameDatabase(appUrl, authDatabaseUrl())) return;

  const existing = await client.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM "user"');
  if (existing.rows[0]?.n) return;

  let users: AppUser[];
  try {
    users = await sql<AppUser[]>`
      SELECT id, name, email, "emailVerified" AS email_verified, image,
             "createdAt" AS created_at, "updatedAt" AS updated_at, role, departamento
      FROM "user"
    `;
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return;
    throw err;
  }
  if (!users.length) return;

  const accounts = await sql<AppAccount[]>`
    SELECT id, "accountId" AS account_id, "providerId" AS provider_id, "userId" AS user_id,
           "accessToken" AS access_token, "refreshToken" AS refresh_token, "idToken" AS id_token,
           "accessTokenExpiresAt" AS access_token_expires_at,
           "refreshTokenExpiresAt" AS refresh_token_expires_at,
           scope, password, "createdAt" AS created_at, "updatedAt" AS updated_at
    FROM account
  `;

  for (const user of users) {
    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, departamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.name, user.email, user.email_verified, user.image, user.created_at, user.updated_at, user.role, user.departamento],
    );
  }
  for (const account of accounts) {
    await client.query(
      `INSERT INTO account (
         id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
         "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        account.id, account.account_id, account.provider_id, account.user_id,
        account.access_token, account.refresh_token, account.id_token,
        account.access_token_expires_at, account.refresh_token_expires_at,
        account.scope, account.password, account.created_at, account.updated_at,
      ],
    );
  }
}

/** Cria as tabelas do better-auth e a instância, uma vez por processo. */
export function ensureAuthReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!authSync) throw new Error('Sincronização de credenciais não registada');
      const options = buildOptions();
      const { runMigrations } = await getMigrations(options);
      await runMigrations();
      await authSync.ensureConvitesTable();
      auth = betterAuth(options) as unknown as AuthInstance;
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        await seedAuthFromApp(client);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    })().catch((err) => {
      ready = null;
      auth = null;
      throw err;
    });
  }
  return ready;
}

export function getAuth(): AuthInstance {
  if (!auth) throw new Error('better-auth ainda não foi inicializado');
  return auth;
}
