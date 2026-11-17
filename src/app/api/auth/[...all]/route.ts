import { ensureAuthReady, getAuth } from '@/src/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request): Promise<Response> {
  await ensureAuthReady();
  return getAuth().handler(req);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
