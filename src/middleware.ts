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
 * Proxy de sessão: antes de entregar a página ou a API, pergunta ao
 * better-auth se o cookie ainda corresponde a uma sessão válida.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method === 'OPTIONS' || isPublicApi(pathname) || isPublicPage(pathname)) {
    return NextResponse.next();
  }

  const sessionUrl = new URL('/api/auth/get-session', request.nextUrl.origin);
  let valid = false;
  try {
    const res = await fetch(sessionUrl, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status >= 500) return NextResponse.next();
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { session?: unknown; user?: unknown } | null;
      valid = Boolean(data?.session && data?.user);
    }
  } catch {
    return NextResponse.next();
  }

  if (valid) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Sessão expirada. Inicia sessão novamente.' },
      { status: 401 },
    );
  }

  const login = new URL('/login', request.url);
  const hadSessionCookie = (request.headers.get('cookie') ?? '').includes('session_token');
  if (hadSessionCookie) login.searchParams.set('expired', '1');
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
