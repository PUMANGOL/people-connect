import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PAGES = [
  /^\/login\/?$/,
  /^\/recuperar-password\/?$/,
  /^\/definir-password\/?$/,
  /^\/unauthorized\/?$/,
  /^\/link-invalido\/?$/,
  /^\/candidatura\/[^/]+\/?$/,
];

const PUBLIC_API = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/auth-login\/?$/,
  /^\/api\/definir-password\/?$/,
  /^\/api\/recuperar-password\/?$/,
  /^\/api\/ping\/?$/,
  /^\/api\/health\/?$/,
  /^\/api\/candidatura\/[^/]+\/?$/,
  /^\/api\/candidatura\/[^/]+\/submeter\/?$/,
];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((pattern) => pattern.test(pathname));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API.some((pattern) => pattern.test(pathname));
}

/**
 * Em desenvolvimento o middleware não pode fazer fetch ao próprio Next:
 * a rota /api/auth ainda não está compilada, o pedido fica à espera dela
 * e a compilação fica à espera do pedido. Aí a página gira sem logs.
 * Fora de dev, confirma a sessão no better-auth.
 */
async function sessaoValida(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') {
    return Boolean(getSessionCookie(request));
  }

  const sessionUrl = new URL('/api/auth/get-session', request.nextUrl.origin);
  try {
    const res = await fetch(sessionUrl, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status >= 500) return true;
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { session?: unknown; user?: unknown } | null;
    return Boolean(data?.session && data?.user);
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method === 'OPTIONS' || isPublicApi(pathname) || isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (await sessaoValida(request)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Sessão expirada. Inicia sessão novamente.' },
      { status: 401 },
    );
  }

  const login = new URL('/login', request.url);
  if (getSessionCookie(request)) login.searchParams.set('expired', '1');
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
