import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Lê DATABASE_URL do .env. Em BDs remotas (ex.: Neon) força SSL quando
 * a connection string não indica `sslmode`, senão a ligação falha em silêncio.
 */
function databaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? 'postgresql://pumangol:pumangol@localhost:5432/pumangol';
  const url = new URL(raw);
  if (url.pathname.includes('=')) {
    throw new Error(
      `DATABASE_URL mal formada: falta "?" antes dos parâmetros (ex.: .../neondb?sslmode=require). Recebido: ...${url.pathname}`,
    );
  }
  const local = ['localhost', '127.0.0.1', 'db'].includes(url.hostname);
  // `require` já é tratado pelo driver pg como `verify-full`; explicitar evita o aviso de segurança.
  if (!local && ['require', null].includes(url.searchParams.get('sslmode'))) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  console.log(`[drizzle] Base de dados: ${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`);
  return url.toString();
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl(),
  },
});
