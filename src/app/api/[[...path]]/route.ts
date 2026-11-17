import { dispatchApi } from '@/server/api-dispatch';
import { publicErrorMessage } from '@/netlify/functions/_shared/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(req: Request): Promise<Response> {
  try {
    return await dispatchApi(req);
  } catch (err) {
    console.error('[api]', err);
    return Response.json(
      { error: publicErrorMessage(err, 'Erro interno') },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
