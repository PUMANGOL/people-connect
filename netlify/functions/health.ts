import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, publicErrorMessage } from './_shared/db';

export default async (): Promise<Response> => {
  try {
    const result = await sql`SELECT NOW() as ts, current_database() as db`;
    return jsonResponse({
      status: 'ok',
      timestamp: result[0].ts,
      database: result[0].db,
      env: {
        has_database_url: Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL),
      },
    });
  } catch (err) {
    return errorResponse(publicErrorMessage(err, 'DB unreachable'), 503);
  }
};

export const config: Config = {
  path: '/api/health',
};
