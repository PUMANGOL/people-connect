import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowBigUp,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  GraduationCap,
  HeartPulse,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Users,
} from 'lucide-react';
import { LoginPalco } from '@/src/components/login/LoginPalco';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { useAuthStore } from '@/src/store';
import { loginLocal } from '@/src/services/auth.service';
import { authClient } from '@/src/lib/auth-client';
import { apiClient } from '@/src/services/api.client';
import type { AuthUser } from '@/lib/types';
import { homeForRole, APP_SLOGAN, EMAIL_DOMINIO } from '@/lib/constants';

const PILARES = [
  { nome: 'Pessoas', Icone: Users },
  { nome: 'Cultura', Icone: Sparkles },
  { nome: 'Saúde', Icone: HeartPulse },
  { nome: 'Desenvolvimento', Icone: GraduationCap },
] as const;

const ZONA = 'Africa/Luanda';
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Tempo do ecrã «Sessão iniciada» antes de entrar (o anel demora ~1,2 s a fechar). */
const DURACAO_SUCESSO_MS = 1100;

type Periodo = 'manha' | 'tarde' | 'noite';
type Campo = 'email' | 'password';

const SAUDACOES: Record<Periodo, { texto: string; Icone: typeof Sun }> = {
  manha: { texto: 'Bom dia', Icone: Sunrise },
  tarde: { texto: 'Boa tarde', Icone: Sun },
  noite: { texto: 'Boa noite', Icone: MoonStar },
};

function agoraEmLuanda(agora = new Date()) {
  const p: Record<string, string> = {};
  for (const parte of new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(agora)) {
    p[parte.type] = parte.value;
  }
  const hora = Number(p.hour) % 24;
  const periodo: Periodo = hora >= 5 && hora < 12 ? 'manha' : hora >= 12 && hora < 19 ? 'tarde' : 'noite';
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { periodo, data: `${DIAS[dia]}, ${p.day} de ${MESES[Number(p.month) - 1]}` };
}

/** Resto do domínio corporativo a sugerir enquanto se escreve o email. */
function restoDoDominio(valor: string) {
  if (!valor || /\s/.test(valor)) return '';
  const arroba = valor.indexOf('@');
  if (arroba < 0) return `@${EMAIL_DOMINIO}`;
  if (valor.indexOf('@', arroba + 1) >= 0) return '';
  const dominio = valor.slice(arroba + 1).toLowerCase();
  if (dominio.length >= EMAIL_DOMINIO.length) return '';
  return EMAIL_DOMINIO.startsWith(dominio) ? EMAIL_DOMINIO.slice(dominio.length) : '';
}

function iniciais(nome: string | undefined, email: string) {
  const partes = (nome?.trim() ? nome.trim().split(/\s+/) : email.split('@')[0].split(/[._-]+/)).filter(Boolean);
  if (!partes.length) return 'PC';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0][1] ?? '');
  return (partes[0][0] + ultima).toUpperCase();
}

function destaquePessoas(slogan: string) {
  const marca = 'pessoas';
  const idx = slogan.toLowerCase().indexOf(marca);
  if (idx < 0) return slogan;
  return (
    <>
      {slogan.slice(0, idx)}
      <span className="a-hl">{slogan.slice(idx, idx + marca.length)}</span>
      {slogan.slice(idx + marca.length)}
    </>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [manterSessao, setManterSessao] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [aEntrar, setAEntrar] = useState(false);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [momento, setMomento] = useState<ReturnType<typeof agoraEmLuanda> | null>(null);
  const [sugerir, setSugerir] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const timerSucesso = useRef<number | undefined>(undefined);

  const [params] = useSearchParams();
  const sugestao = sugerir ? restoDoDominio(email) : '';
  const ano = new Date().getFullYear();
  const saudacao = momento ? SAUDACOES[momento.periodo] : null;

  useEffect(() => {
    const actualizar = () => setMomento(agoraEmLuanda());
    actualizar();
    const id = window.setInterval(actualizar, 20_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(timerSucesso.current);
    };
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

  function abanar() {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove('lp-shake');
    void el.offsetWidth;
    el.classList.add('lp-shake');
  }

  function limparErro(campo: Campo) {
    setErros((actual) => (actual[campo] ? { ...actual, [campo]: undefined } : actual));
    setAlerta(null);
  }

  function lerSugestao(el: HTMLInputElement) {
    const noFim = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    const cabe = el.scrollWidth <= el.clientWidth + 1;
    setSugerir(document.activeElement === el && noFim && cabe);
  }

  function completarDominio(e: KeyboardEvent<HTMLInputElement>) {
    if (!sugestao) return;
    if (!((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowRight')) return;
    const el = e.currentTarget;
    if (el.selectionStart !== email.length || el.selectionEnd !== email.length) return;
    e.preventDefault();
    setEmail(email + sugestao);
    limparErro('email');
  }

  function lerCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  function alternarPassword() {
    setMostrarPassword((s) => !s);
    const el = passwordRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {
        /* alguns browsers não deixam posicionar o cursor neste tipo de campo */
      }
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);

    let valor = email.trim();
    if (valor && !valor.includes('@')) valor += `@${EMAIL_DOMINIO}`;
    if (valor !== email) setEmail(valor);

    const erroEmail = !valor
      ? 'Indica o teu email corporativo.'
      : !EMAIL_RE.test(valor)
        ? `Usa o teu email corporativo @${EMAIL_DOMINIO}.`
        : undefined;
    const erroPassword = password ? undefined : 'Indica a tua password.';
    setErros({ email: erroEmail, password: erroPassword });
    if (erroEmail || erroPassword) {
      (erroEmail ? emailRef : passwordRef).current?.focus();
      abanar();
      return;
    }

    setAEntrar(true);
    try {
      const { user } = await loginLocal(valor, password, manterSessao);
      setUser(user);
      setSucesso(iniciais(user.nome, valor));
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      timerSucesso.current = window.setTimeout(
        () => navigate(homeForRole(user.role)),
        reduzido ? 0 : DURACAO_SUCESSO_MS,
      );
    } catch (err) {
      const axiosMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAlerta(axiosMsg ?? 'Não foi possível iniciar sessão. Verifica os dados e tenta novamente.');
      abanar();
      passwordRef.current?.focus();
      passwordRef.current?.select();
    } finally {
      setAEntrar(false);
    }
  }

  const descricaoPassword = [capsLock && 'login-caps', erros.password && 'login-password-erro']
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="pc-login a-shell">
      {/* ============ Painel de marca ============ */}
      <aside className="a-brand" aria-label="Pumangol People Connect">
        <header className="a-top">
          <div className="pc-lockup">
            <img src="/people-connect-emblema.png" alt="" className="pc-mark" />
            <span className="pc-lockup-text">
              <span className="pc-lockup-eyebrow">Pumangol</span>
              <span className="pc-lockup-name">People Connect</span>
            </span>
          </div>
          <span className="a-chip">
            <span className="lp-live" aria-hidden />
            Pessoas &amp; Cultura
          </span>
        </header>

        <LoginPalco />

        <div className="a-copy">
          <p className="a-headline">{destaquePessoas(APP_SLOGAN)}</p>
          <p className="a-lede">
            Na Pumangol, cuidamos de cada pessoa desde o primeiro contacto — porque acreditamos que é nas
            pessoas que construímos o nosso futuro.
          </p>
          <ul className="a-pillars" aria-label="Pilares">
            {PILARES.map(({ nome, Icone }) => (
              <li key={nome}>
                <Icone aria-hidden />
                {nome}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ============ Formulário ============ */}
      <main className="a-main">
        <div className="a-toolbar">
          <ThemeToggle className="pc-theme-btn" />
        </div>

        <div className="a-form">
          <div className="pc-card">
            {sucesso ? (
              <section className="pc-view pc-success lp-in" role="status" aria-live="polite">
                <div className="pc-avatar-xl">
                  <span>{sucesso}</span>
                  <svg className="pc-ring" viewBox="0 0 100 100" aria-hidden>
                    <circle cx="50" cy="50" r="46" />
                  </svg>
                </div>
                <h1 className="pc-title">Sessão iniciada</h1>
                <p className="pc-sub">A preparar o teu espaço…</p>
                <div className="pc-progress" aria-hidden>
                  <span />
                </div>
              </section>
            ) : (
              <section className="pc-view lp-in" aria-labelledby="login-titulo">
                <p className="pc-greet">
                  {saudacao && momento && (
                    <>
                      <saudacao.Icone aria-hidden />
                      <strong>{saudacao.texto}</strong>
                      <span className="pc-dot" aria-hidden>·</span>
                      <span>{momento.data}</span>
                    </>
                  )}
                </p>
                <h1 className="pc-title" id="login-titulo">Iniciar sessão</h1>
                <p className="pc-sub">Entra com o email corporativo Pumangol.</p>

                <form
                  ref={formRef}
                  className="pc-form"
                  onSubmit={handleSubmit}
                  onAnimationEnd={(e) => {
                    if (e.target === e.currentTarget) e.currentTarget.classList.remove('lp-shake');
                  }}
                  noValidate
                >
                  {notice && !alerta && <p className="pc-notice" role="status">{notice}</p>}

                  {alerta && (
                    <div className="pc-alert" role="alert">
                      <CircleAlert aria-hidden />
                      <span>{alerta}</span>
                    </div>
                  )}

                  <div className="pc-field" data-invalid={erros.email ? '' : undefined}>
                    <label className="pc-label" htmlFor="login-email">Email corporativo</label>
                    <div className="pc-control pc-control-email" data-suggest={sugestao ? '' : undefined}>
                      <Mail className="pc-lead" aria-hidden />
                      <input
                        ref={emailRef}
                        id="login-email"
                        name="email"
                        type="text"
                        inputMode="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          limparErro('email');
                          lerSugestao(e.currentTarget);
                        }}
                        onKeyDown={completarDominio}
                        onSelect={(e) => lerSugestao(e.currentTarget)}
                        onFocus={(e) => lerSugestao(e.currentTarget)}
                        onBlur={() => setSugerir(false)}
                        placeholder={`nome.apelido@${EMAIL_DOMINIO}`}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-invalid={erros.email ? true : undefined}
                        aria-describedby={erros.email ? 'login-email-erro' : undefined}
                        className="pc-input login-input"
                      />
                      {sugestao && (
                        <>
                          <span className="pc-ghost" aria-hidden>
                            <span className="pc-ghost-typed">{email}</span>
                            <span className="pc-ghost-rest">{sugestao}</span>
                          </span>
                          <kbd className="pc-kbd" aria-hidden>Tab</kbd>
                        </>
                      )}
                    </div>
                    {erros.email && (
                      <p className="pc-error" id="login-email-erro">
                        <CircleAlert aria-hidden />
                        <span>{erros.email}</span>
                      </p>
                    )}
                  </div>

                  <div className="pc-field" data-invalid={erros.password ? '' : undefined}>
                    <div className="pc-label-row">
                      <label className="pc-label" htmlFor="login-password">Password</label>
                      <Link className="pc-link" to="/recuperar-password">Esqueci-me</Link>
                    </div>
                    <div className="pc-control">
                      <Lock className="pc-lead" aria-hidden />
                      <input
                        ref={passwordRef}
                        id="login-password"
                        name="password"
                        type={mostrarPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          limparErro('password');
                        }}
                        onKeyDown={lerCapsLock}
                        onKeyUp={lerCapsLock}
                        onBlur={() => setCapsLock(false)}
                        autoComplete="current-password"
                        aria-invalid={erros.password ? true : undefined}
                        aria-describedby={descricaoPassword}
                        className="pc-input login-input"
                      />
                      <button
                        type="button"
                        className="pc-icon-btn"
                        onClick={alternarPassword}
                        aria-label={mostrarPassword ? 'Ocultar password' : 'Mostrar password'}
                        aria-pressed={mostrarPassword}
                      >
                        {mostrarPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      </button>
                    </div>
                    {capsLock && (
                      <p className="pc-caps" id="login-caps">
                        <ArrowBigUp aria-hidden />
                        Caps Lock activo
                      </p>
                    )}
                    {erros.password && (
                      <p className="pc-error" id="login-password-erro">
                        <CircleAlert aria-hidden />
                        <span>{erros.password}</span>
                      </p>
                    )}
                  </div>

                  <div className="pc-row">
                    <label className="pc-switch">
                      <input
                        type="checkbox"
                        name="remember"
                        checked={manterSessao}
                        onChange={(e) => setManterSessao(e.target.checked)}
                      />
                      <span className="pc-track" aria-hidden>
                        <span className="pc-thumb" />
                      </span>
                      Manter sessão iniciada
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="pc-btn pc-btn-primary"
                    disabled={aEntrar}
                    data-state={aEntrar ? 'loading' : undefined}
                    aria-busy={aEntrar || undefined}
                  >
                    <span>{aEntrar ? 'A entrar…' : 'Entrar'}</span>
                    {aEntrar ? <LoaderCircle className="ic-spin" aria-hidden /> : <ArrowRight className="ic-arrow" aria-hidden />}
                  </button>
                </form>

                <p className="pc-divider">Primeira vez?</p>
                <Link to="/primeiro-acesso" className="pc-first">
                  <span className="pc-first-ic">
                    <KeyRound aria-hidden />
                  </span>
                  <span className="pc-first-text">
                    <b>Primeiro acesso</b>
                    <span>Recebe no email corporativo um link para definires a tua password.</span>
                  </span>
                  <ArrowRight className="pc-first-arrow" aria-hidden />
                </Link>

                <p className="pc-help">
                  Sem acesso? Contacta a <strong>Direcção de Pessoas e Cultura</strong>.
                </p>
              </section>
            )}
          </div>
        </div>

        <footer className="a-foot">
          <span>
            <ShieldCheck aria-hidden />
            <span>Ligação segura · Acesso reservado a colaboradores</span>
          </span>
          <span>© {ano} Pumangol · Apoio técnico: DSI</span>
        </footer>
      </main>
    </div>
  );
}
