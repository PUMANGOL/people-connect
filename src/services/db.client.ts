import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEXT_PUBLIC_NEON_DATABASE_URL;

if (!databaseUrl) {
  console.warn('NEXT_PUBLIC_NEON_DATABASE_URL not set — database queries will fail');
}

export const sql = neon(databaseUrl || '');
