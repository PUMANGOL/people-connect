import postgres, { type Sql } from 'postgres';

/**
 * Cliente Postgres lazy. Não liga no import se DATABASE_URL estiver ausente.
 * O esquema é o de Drizzle em db/schema.ts.
 */

let _sql: Sql | null = null;

function getSql(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL não configurada. Defina a connection string no ambiente (ficheiro .env ou variáveis do contentor).'
    );
  }
  _sql = postgres(url, {
    ssl: /sslmode=require/i.test(url) ? 'require' : false,
    max: 10,
    // Avisos informativos do Postgres (ex.: "already exists, skipping") não são erros:
    // por omissão o driver imprime-os todos na consola.
    onnotice: () => {},
  });
  return _sql;
}

export const sql = new Proxy((() => {
  throw new Error('use sql`...` template literal, not sql(...)');
}) as unknown as Sql, {
  apply(_target, thisArg, args) {
    return getSql().apply(thisArg, args as never);
  },
  get(_target, prop) {
    const client = getSql();
    const value = client[prop as keyof Sql];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: sanitizeErrorMessage(message) }, status);
}

const GENERIC_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

// Mensagens que expõem SQL / detalhes internos da BD nunca chegam ao cliente.
const SQL_LEAK = /\b(select\s.+\sfrom|insert\s+into|update\s+\S+\s+set|delete\s+from)\b|syntax error|violates|duplicate key|null value in column|invalid input (syntax|value)|relation "|column "|constraint "|could not determine data type|operator does not exist|function .+ does not exist|PostgresError|ECONNREFUSED|DATABASE_URL/i;

export function sanitizeErrorMessage(message: string): string {
  return SQL_LEAK.test(message) ? GENERIC_ERROR : message;
}

/** Mensagem segura para o utilizador a partir de um erro apanhado no catch. */
export function publicErrorMessage(err: unknown, fallback = GENERIC_ERROR): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    // Códigos SQLSTATE do Postgres
    switch (code) {
      case '23505': return 'Este registo já existe.';
      case '23503': return 'Operação não permitida: o registo está associado a outros dados.';
      case '23502': return 'Falta preencher um campo obrigatório.';
      case '22P02':
      case '22007':
      case '22008':
      case '23514': return 'Os dados enviados são inválidos.';
      default: return fallback;
    }
  }
  if (err instanceof Error && err.message) return sanitizeErrorMessage(err.message);
  return fallback;
}

export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  return null;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);
}
