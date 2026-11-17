import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { useAuthStore } from '@/src/store';
import { loginLocal } from '@/src/services/auth.service';
import { authClient } from '@/src/lib/auth-client';
import { apiClient } from '@/src/services/api.client';
import type { AuthUser, UserRole } from '@/lib/types';
import { homeForRole, APP_NAME, APP_SLOGAN, EMAIL_DOMINIO } from '@/lib/constants';

const campoClass =
  'flex h-11 items-center overflow-hidden rounded-md border border-input bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-focus';
const inputClass =
  'login-input h-full min-w-0 w-full appearance-none border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-neutral-400';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [params] = useSearchParams();

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Preenche o email e a password.');
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
      setError(axiosMsg ?? 'Não foi possível iniciar sessão. Verifica as credenciais.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Painel de marca — dinâmico, visível a partir de lg */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] login-brand-panel">
        <div className="login-brand-mesh" />
        <div className="login-brand-grid" />
        <div className="login-brand-particles" />
        <div className="login-brand-vignette" />

        <div className="relative z-10 flex flex-col h-full w-full p-12 xl:p-16">
          <div className="flex-1 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <motion.img
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.25 }}
                src="/people-connect-emblema.png"
                alt="Pumangol People Connect"
                className="w-48 xl:w-60 h-auto mb-8 drop-shadow-[0_0_24px_rgba(63,206,124,0.25)]"
              />
              <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.22em] mb-5">
                {APP_NAME}
              </p>
              <h1 className="text-3xl xl:text-[2.75rem] font-bold text-white leading-[1.15] tracking-tight max-w-lg">
                {APP_SLOGAN}
              </h1>
              <p className="text-navy-200 mt-6 text-base leading-relaxed max-w-md">
                Na Pumangol, cuidamos de cada pessoa desde o primeiro contacto — porque acreditamos
                que é nas pessoas que construímos o nosso futuro.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-surface-secondary px-5 py-12 sm:px-10">
        <ThemeToggle className="absolute top-5 right-5" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <img src="/people-connect-emblema.png" alt="Pumangol People Connect" className="mb-3 h-auto w-28" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-800">{APP_NAME}</p>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 py-7 shadow-card sm:px-8 sm:py-8">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-navy-900">Iniciar sessão</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Entra com o email corporativo Pumangol.
            </p>

            {notice && !error && (
              <div className="mt-5 rounded-md border border-gold-200 bg-gold-50 px-3.5 py-3">
                <p className="text-sm text-navy-800">{notice}</p>
              </div>
            )}

            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-md border border-error-100 bg-error-50 px-3.5 py-3" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                <p className="text-sm text-error-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-navy-800">
                  Email corporativo
                </label>
                <div className={campoClass}>
                  <span className="flex w-10 shrink-0 items-center justify-center text-navy-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                    placeholder={`nome@${EMAIL_DOMINIO}`}
                    autoComplete="username"
                    className={`${inputClass} pr-3`}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor="login-password" className="text-sm font-medium text-navy-800">
                    Password
                  </label>
                  <Link
                    to="/recuperar-password"
                    className="text-xs font-medium text-navy-600 underline-offset-4 hover:text-navy-800 hover:underline"
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
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                    placeholder="A tua password"
                    autoComplete="current-password"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                    aria-label={showPassword ? 'Esconder password' : 'Mostrar password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="primary" className="mt-2 h-11 w-full" loading={isLoggingIn}>
                {isLoggingIn ? 'A entrar…' : 'Entrar'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-relaxed text-navy-400">
              Sem acesso? Contacta a Direcção de Pessoas e Cultura.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
