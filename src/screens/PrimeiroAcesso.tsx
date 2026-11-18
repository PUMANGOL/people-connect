import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock, Inbox, Mail, MailCheck, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { Button } from '@/src/components/ui/button';
import { EMAIL_DOMINIO } from '@/lib/constants';
import { apiClient } from '@/src/services/api.client';

const ESPERA_REENVIO_S = 60;

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  async function enviar() {
    setSending(true);
    setError(null);
    try {
      await apiClient.post('/primeiro-acesso', { email: email.trim() });
      setEnviado(true);
      setEspera(ESPERA_REENVIO_S);
    } catch (err) {
      const axiosMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(axiosMsg ?? 'Não foi possível enviar o email. Tente mais tarde.');
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Indique o email da conta.');
      return;
    }
    void enviar();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white p-6">
      <ThemeToggle className="absolute top-4 right-4" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={enviado ? 'w-full max-w-md' : 'w-full max-w-sm'}
      >
        <img src="/people-connect-emblema.png" alt="Pumangol People Connect" className="mx-auto block w-32 h-auto mb-8" />

        {enviado ? (
          <div className="rounded-2xl border border-navy-100 bg-white p-7 shadow-card text-center">
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-gold-500/15 animate-ping [animation-duration:2.4s]" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 ring-1 ring-gold-500/30">
                <MailCheck className="h-7 w-7 text-gold-600" />
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-navy-900">Verifique o email</h2>
            <p className="mt-2 text-sm text-navy-400">Enviámos um link para definir a palavra-passe para</p>
            <p className="mt-1 break-all text-sm font-semibold text-navy-800">{email.trim()}</p>

            <ol className="mt-6 space-y-3 text-left">
              {[
                'Abra o email «Definir palavra-passe» da Pumangol.',
                'Clique no botão do email para abrir a página.',
                'Defina a palavra-passe e entre na plataforma.',
              ].map((passo, i) => (
                <li key={passo} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-600">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm text-navy-600">{passo}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 grid gap-2 rounded-xl bg-navy-50/60 p-3 text-left text-xs text-navy-500">
              <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" /> O link expira em 72 horas.</p>
              <p className="flex items-center gap-2"><Inbox className="h-3.5 w-3.5 shrink-0" /> Não encontra? Veja também a pasta de spam.</p>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-error-100 bg-error-50 p-3 text-left">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error-500" />
                <p className="text-xs text-error-700">{error}</p>
              </div>
            )}

            <Button
              variant="primary"
              className="mt-6 h-12 w-full rounded-xl text-base"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/login')}
            >
              Voltar ao login
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={espera > 0 || sending}
                className="inline-flex items-center gap-1.5 font-semibold text-gold-700 hover:underline disabled:cursor-not-allowed disabled:text-navy-300 disabled:no-underline"
              >
                <RotateCw className={sending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar email'}
              </button>
              <span aria-hidden="true" className="text-navy-200">|</span>
              <button
                type="button"
                onClick={() => { setEnviado(false); setError(null); }}
                className="text-navy-500 hover:text-navy-800"
              >
                Usar outro email
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-navy-900 tracking-tight">Primeiro Acesso</h2>
            <p className="text-sm text-navy-400 mt-1.5 mb-8">
              Indique o email da conta. Se ainda não tiver palavra-passe, enviamos um link para a definir.
            </p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-error-50 border border-error-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-error-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy-600 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`nome@${EMAIL_DOMINIO}`}
                    autoComplete="username"
                    className="w-full h-12 rounded-xl border border-navy-200 bg-white pl-10 pr-3 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-4 focus:ring-gold-500/15 focus:border-gold-500"
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" className="w-full h-12 text-base rounded-xl" loading={sending}>
                Enviar link
              </Button>
            </form>
            <p className="mt-6 text-center">
              <Link to="/login" className="text-sm text-navy-500 hover:text-navy-800">Voltar ao login</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
