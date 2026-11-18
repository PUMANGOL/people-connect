import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { Button } from '@/src/components/ui/button';
import { apiClient } from '@/src/services/api.client';
import { authClient } from '@/src/lib/auth-client';
import { useAuthStore } from '@/src/store';
import { homeForRole } from '@/lib/constants';
import type { AuthUser } from '@/lib/types';

export default function DefinirPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const primeiro = params.get('primeiro') === '1';
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError(primeiro
        ? 'Este link está incompleto. Peça um novo em Primeiro Acesso.'
        : 'Este link está incompleto. Peça um novo link de redefinição.');
      return;
    }
    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As passwords não coincidem.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: { email: string } }>('/definir-password', { token, password });
      const email = res.data.data.email;
      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.error) {
        setDone(true);
        return;
      }
      const me = await apiClient.get<{ data: AuthUser }>('/sessao', { silencioso: true });
      setUser(me.data.data);
      navigate(homeForRole(me.data.data.role), { replace: true });
    } catch (err) {
      const axiosMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(axiosMsg ?? 'Não foi possível definir a password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] login-brand-panel">
        <div className="login-brand-mesh" />
        <div className="login-brand-grid" />
        <div className="login-brand-particles" />
        <div className="login-brand-vignette" />
        <div className="relative z-10 flex flex-col h-full w-full p-12 xl:p-16">
          <div className="flex-1 flex flex-col justify-center">
            <img src="/people-connect-emblema.png" alt="Pumangol People Connect" className="w-48 xl:w-60 h-auto self-start mb-8 drop-shadow-[0_0_24px_rgba(63,206,124,0.25)]" />
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.22em] mb-5">
              Acesso à plataforma
            </p>
            <h1 className="text-3xl xl:text-[2.75rem] font-bold text-white leading-[1.15] tracking-tight max-w-lg">
              Defina a sua palavra-passe para entrar.
            </h1>
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center bg-white p-6 sm:p-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img src="/people-connect-emblema.png" alt="Pumangol People Connect" className="w-32 h-auto mb-4" />
          </div>

          {done ? (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-gold-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-navy-900">Password definida</h2>
              <p className="text-sm text-navy-400 mt-2 mb-6">Já pode entrar na plataforma.</p>
              <Link to="/login" className="text-sm font-semibold text-gold-700 hover:underline">Ir para o login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-navy-900 tracking-tight">
                {primeiro ? 'Definir palavra-passe' : 'Nova palavra-passe'}
              </h2>
              <p className="text-sm text-navy-400 mt-1.5 mb-8">
                {primeiro
                  ? 'Escolha a palavra-passe da sua conta. Pelo menos 8 caracteres.'
                  : 'Escolha uma palavra-passe com pelo menos 8 caracteres.'}
              </p>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-error-50 border border-error-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-error-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-navy-600 mb-1.5">
                    {primeiro ? 'Palavra-passe' : 'Nova palavra-passe'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full h-12 rounded-xl border border-navy-200 bg-white pl-10 pr-10 text-sm text-navy-800 focus:outline-none focus:ring-4 focus:ring-gold-500/15 focus:border-gold-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500"
                      aria-label={showPassword ? 'Esconder password' : 'Mostrar password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy-600 mb-1.5">Confirmar palavra-passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      className="w-full h-12 rounded-xl border border-navy-200 bg-white pl-10 pr-3 text-sm text-navy-800 focus:outline-none focus:ring-4 focus:ring-gold-500/15 focus:border-gold-500"
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary" className="w-full h-12 text-base rounded-xl" loading={saving}>
                  Guardar e entrar
                </Button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
