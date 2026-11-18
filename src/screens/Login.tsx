import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { LoginPalco } from '@/src/components/login/LoginPalco';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { Button } from '@/src/components/ui/button';
import { useAuthStore } from '@/src/store';
import { loginLocal } from '@/src/services/auth.service';
import { authClient } from '@/src/lib/auth-client';
import { apiClient } from '@/src/services/api.client';
import type { AuthUser, UserRole } from '@/lib/types';
import { homeForRole, APP_SLOGAN, EMAIL_DOMINIO } from '@/lib/constants';

const PILARES = ['Pessoas', 'Cultura', 'Saúde', 'Desenvolvimento'] as const;

const campoClass =
  'flex h-11 items-center overflow-hidden rounded-md border border-input bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-focus';
const inputClass =
  'login-input h-full min-w-0 w-full appearance-none border-0 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-neutral-400';

function destaquePessoas(slogan: string) {
  const marca = 'pessoas';
  const idx = slogan.toLowerCase().indexOf(marca);
  if (idx < 0) return slogan;
  return (
    <>
      {slogan.slice(0, idx)}
      <span className="text-navy-200">{slogan.slice(idx, idx + marca.length)}</span>
      {slogan.slice(idx + marca.length)}
    </>
  );
}

function linhaDeLuanda(agora = new Date()) {
  const zona = 'Africa/Luanda';
  const hora = Number(
    new Intl.DateTimeFormat('pt-PT', { timeZone: zona, hour: 'numeric', hourCycle: 'h23' }).format(agora),
  );
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite';
  const data = new Intl.DateTimeFormat('pt-PT', {
    timeZone: zona,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(agora);
  return `${saudacao} · ${data.charAt(0).toUpperCase()}${data.slice(1)}`;
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroTick, setErroTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [saudacao, setSaudacao] = useState<string | null>(null);

  const [params] = useSearchParams();
  const sugestao = /^[^\s@]{1,64}$/.test(email) ? `@${EMAIL_DOMINIO}` : '';
  const ano = new Date().getFullYear();

  useEffect(() => {
    setSaudacao(linhaDeLuanda());
  }, []);

  useEffect(() => {
    if (params.get('expired') === '1') {
      useAuthStore.getState().clearUser();
      setNotice('A sessão expirou. Inicia sessão novamente.');
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await authClient.getSession({ query: {} });
      if (cancelled) return;
      if (error && error.status && error.status !== 401) return;
      if (error || !data?.session) {
        if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().clearUser();
        return;
      }
      try {
        const res = await apiClient.get<{ data: AuthUser }>('/sessao', { silencioso: true });
        if (cancelled) return;
        setUser(res.data.data);
        navigate(homeForRole(res.data.data.role), { replace: true });
      } catch {
        if (!cancelled) useAuthStore.getState().clearUser();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, params, setUser]);

  function redirectByRole(role: UserRole) {
    navigate(homeForRole(role));
  }

  function falhar(mensagem: string) {
    setError(mensagem);
    setErroTick((n) => n + 1);
  }

  function completarDominio(e: KeyboardEvent<HTMLInputElement>) {
    if (!sugestao || e.shiftKey) return;
    if (e.key !== 'Tab' && e.key !== 'ArrowRight') return;
    const el = e.currentTarget;
    if (el.selectionStart !== email.length || el.selectionEnd !== email.length) return;
    e.preventDefault();
    setEmail(email + sugestao);
    if (error) setError(null);
  }

  function lerCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      falhar('Preenche o email e a password.');
      return;
    }
    if (!email.includes('@')) {
      falhar(`Usa o email corporativo @${EMAIL_DOMINIO}.`);
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      const { user } = await loginLocal(email.trim(), password);
      setUser(user);
      redirectByRole(user.role);
    } catch (err) {
      const axiosMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      falhar(axiosMsg ?? 'Não foi possível iniciar sessão. Verifica as credenciais.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="relative flex flex-col overflow-hidden bg-navy-900 text-white lg:w-[52%] xl:w-[50%]" aria-label="Pumangol People Connect">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_0%_100%,rgba(33,106,65,0.55),transparent_62%)]"
        />

        <header className="relative flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12 lg:pt-10">
          <div className="flex items-center gap-3">
            <img src="/people-connect-emblema.png" alt="" className="h-11 w-auto sm:h-12" />
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-white/60">Pumangol</p>
              <p className="text-xl font-semibold leading-[1.3] tracking-[-0.02em]">People Connect</p>
            </div>
          </div>
          <p className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-[0.04em] text-white/90 lg:inline-flex">
            <span className="lp-live" aria-hidden />
            Pessoas e Cultura
          </p>
        </header>

        <div className="relative hidden min-h-0 lg:flex lg:flex-1">
          <LoginPalco />
        </div>

        <div className="relative hidden px-12 pb-8 pt-2 lg:block xl:px-16">
          <p className="max-w-xl text-[2rem] font-bold leading-[1.15] tracking-[-0.02em]">
            {destaquePessoas(APP_SLOGAN)}
          </p>
          <p className="lp-lede mt-4 max-w-md text-[0.9375rem] font-normal leading-[1.6] text-white/75">
            Na Pumangol, cuidamos de cada pessoa desde o primeiro contacto — porque acreditamos
            que é nas pessoas que construímos o nosso futuro.
          </p>
          <p className="mt-6 text-[0.9375rem] leading-[1.6] text-white/80">
            {PILARES.map((pilar, i) => (
              <span key={pilar}>
                {i > 0 && <span className="mx-2.5 text-white/35">·</span>}
                {pilar}
              </span>
            ))}
          </p>
        </div>

        <div
          aria-hidden
          className="relative mt-auto h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, #009845 0 62%, #ffffff 62% 66%, #E30613 66% 100%)' }}
        />
      </aside>

      <main className="relative flex min-h-0 flex-1 flex-col bg-surface-secondary">
        <div className="flex justify-end px-5 pt-4 sm:px-8">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="lp-in w-full max-w-[400px]">
            <p className="mb-3 min-h-5 text-[0.8125rem] leading-[1.45] text-muted-foreground">{saudacao}</p>
            <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">Iniciar sessão</h1>
            <p className="mt-1.5 text-[0.9375rem] font-normal leading-[1.5] text-muted-foreground">
              Entra com o email corporativo Pumangol.
            </p>

            {notice && !error && (
              <p className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-navy-800">
                {notice}
              </p>
            )}

            {error && (
              <div key={erroTick} className="lp-shake mt-5 flex items-start gap-2.5 rounded-md border border-error-100 bg-error-50 px-3.5 py-3" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                <p className="text-sm text-error-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[0.9375rem] font-semibold leading-[1.4] text-navy-800">
                  Email corporativo
                </label>
                <div className={campoClass}>
                  <span className="flex w-10 shrink-0 items-center justify-center text-navy-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="relative min-w-0 flex-1 self-stretch">
                    {sugestao && (
                      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden pr-3 text-[0.9375rem]">
                        <span className="invisible whitespace-pre">{email}</span>
                        <span className="whitespace-pre text-neutral-400">{sugestao}</span>
                      </span>
                    )}
                    <input
                      id="login-email"
                      name="email"
                      type="text"
                      inputMode="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                      onKeyDown={completarDominio}
                      placeholder={`nome@${EMAIL_DOMINIO}`}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={error ? true : undefined}
                      className={`${inputClass} relative z-10 pr-3`}
                    />
                  </div>
                  {sugestao && (
                    <span className="mr-3 shrink-0 text-[11px] text-neutral-400">Tab</span>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor="login-password" className="text-[0.9375rem] font-semibold leading-[1.4] text-navy-800">
                    Password
                  </label>
                  <Link
                    to="/recuperar-password"
                    className="text-[0.8125rem] font-semibold leading-[1.45] text-neutral-600 underline-offset-4 hover:text-navy-800 hover:underline"
                  >
                    Esqueci-me
                  </Link>
                </div>
                <div className={campoClass}>
                  <span className="flex w-10 shrink-0 items-center justify-center text-navy-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                    onKeyDown={lerCapsLock}
                    onKeyUp={lerCapsLock}
                    onBlur={() => setCapsLock(false)}
                    placeholder="A tua password"
                    autoComplete="current-password"
                    aria-invalid={error ? true : undefined}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                    aria-label={showPassword ? 'Esconder password' : 'Mostrar password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {capsLock && (
                  <p className="mt-1.5 text-xs font-medium text-warning-700">Caps Lock activo</p>
                )}
              </div>

              <Button type="submit" variant="primary" className="lp-submit mt-1 h-11 w-full" loading={isLoggingIn}>
                {isLoggingIn ? 'A entrar…' : 'Entrar'}
              </Button>
            </form>

            <p className="mt-4 text-center text-[0.8125rem] leading-[1.45] text-muted-foreground">
              Ainda sem palavra-passe?{' '}
              <Link to="/primeiro-acesso" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
                Primeiro Acesso
              </Link>
            </p>

            <p className="mt-6 text-center text-[0.8125rem] leading-[1.45] text-muted-foreground">
              Sem acesso? Contacta a <span className="font-medium text-neutral-700">Direcção de Pessoas e Cultura</span>.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-neutral-200 px-5 py-4 text-xs font-medium tracking-[0.04em] text-neutral-500 sm:px-8">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
            Ligação segura · Acesso reservado a colaboradores
          </span>
          <span>© {ano} Pumangol · Apoio técnico: DSI</span>
        </footer>
      </main>
    </div>
  );
}
