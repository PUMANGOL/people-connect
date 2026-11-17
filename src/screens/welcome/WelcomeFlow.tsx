import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, Sparkles, Check, IdCard } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { VideoGate } from '@/src/components/welcome/VideoGate';
import { QuizEngine } from '@/src/components/welcome/QuizEngine';
import { Confetti } from '@/src/components/welcome/Confetti';
import { MinhaFichaEditor } from '@/src/components/ficha/MinhaFichaEditor';
import { welcomeService, type WelcomeEstado, type QuizResultadoDetalhe } from '@/src/services/onboarding-v2.service';
import { useAuthStore } from '@/src/store/auth.store';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { APP_NAME, APP_SLOGAN } from '@/lib/constants';

type Step =
  | 'loading'
  // Ficha do Trabalhador — dados pessoais pedidos no 1º dia (substitui o formulário em papel)
  | 'ficha'
  // Um passo por vídeo activo, pela ordem definida no admin.
  | `video:${string}`
  | 'quiz'
  | 'result'
  | 'error';

interface StepDef {
  key: Step;
  label: string;
  short: string;
}

// Rótulos do stepper para os slots oficiais; os restantes usam o título do vídeo.
const SLOT_STEP: Record<string, { label: string; short: string }> = {
  institucional:      { label: 'Mensagem do PCE',         short: 'PCE' },
  hse:                { label: 'HSE — Segurança',         short: 'HSE' },
  saude_seguranca:    { label: 'HSE — Segurança',         short: 'HSE' },
  dpc_beneficios:     { label: 'DPC · Benefícios',        short: 'Benef.' },
  dpc_avaliacao:      { label: 'DPC · Avaliação',         short: 'Aval.' },
  dpc_saude_bemestar: { label: 'DPC · Saúde e Bem-Estar', short: 'Saúde' },
  dpc_formacao:       { label: 'DPC · Formação',          short: 'Formação' },
};

/** Sequência: ficha do trabalhador (se por submeter) → vídeos activos (ordem do admin) → quiz (se activo) → conclusão. */
function montarSteps(estado: WelcomeEstado | null): StepDef[] {
  if (!estado) return [];
  const videos: StepDef[] = estado.videos.map((v) => ({
    key: `video:${v.slot}`,
    label: SLOT_STEP[v.slot]?.label ?? v.titulo,
    short: SLOT_STEP[v.slot]?.short ?? (v.titulo.length > 12 ? `${v.titulo.slice(0, 11)}…` : v.titulo),
  }));
  return [
    ...(estado.ficha_submetida === false ? [{ key: 'ficha' as const, label: 'Ficha do Trabalhador', short: 'Ficha' }] : []),
    ...videos,
    ...(estado.quiz_ativo !== false ? [{ key: 'quiz' as const, label: 'Quiz de Boas-Vindas', short: 'Quiz' }] : []),
    { key: 'result', label: 'Conclusão', short: 'Fim' },
  ];
}

export default function WelcomeFlow() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('loading');
  const [estado, setEstado] = useState<WelcomeEstado | null>(null);
  const [resultado, setResultado] = useState<{ total: number; acertos: number; percentagem: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    welcomeService
      .estado()
      .then((e) => {
        if (cancelled) return;
        if (e.welcome_completed) {
          navigate('/onboarding/meu-trilho', { replace: true });
          return;
        }
        setEstado(e);
        const primeiro = montarSteps(e)[0].key;
        // Sem vídeos activos nem quiz: conclui directamente.
        if (primeiro === 'result') concluirQuiz({ total: 0, acertos: 0, detalhes: [] });
        else setStep(primeiro);
      })
      .catch(() => !cancelled && setStep('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const primeiroNome = user?.nome?.split(' ')[0] ?? '';

  const videoAtual = step.startsWith('video:')
    ? estado?.videos.find((v) => `video:${v.slot}` === step)
    : undefined;

  const steps = useMemo(() => montarSteps(estado), [estado]);
  const stepIndex = useMemo(() => steps.findIndex((s) => s.key === step), [steps, step]);

  const proximo = (from: Step): Step => steps[steps.findIndex((s) => s.key === from) + 1]?.key ?? 'result';
  // Com o quiz desactivado, o último vídeo conclui o Welcome Flow.
  const avancar = (from: Step) => () => {
    const next = proximo(from);
    if (next === 'result') concluirQuiz({ total: 0, acertos: 0, detalhes: [] });
    else setStep(next);
  };
  const cta = (from: Step) => {
    const next = proximo(from);
    if (next === 'quiz') return 'Ir para o quiz';
    if (next === 'result') return 'Concluir boas-vindas';
    return `Seguinte: ${steps.find((s) => s.key === next)?.label ?? ''}`;
  };

  async function concluirQuiz(r: { total: number; acertos: number; detalhes: QuizResultadoDetalhe[] }) {
    const percentagem = r.total > 0 ? Math.round((r.acertos / r.total) * 100) : 100;
    setResultado({ total: r.total, acertos: r.acertos, percentagem });
    setStep('result');
    try {
      await welcomeService.completar({ total: r.total, acertos: r.acertos, detalhes: r.detalhes });
    } catch {
      /* resultado guardado no ecrã; retry manual ao entrar */
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-800">
      {/* === Fundo dinâmico — mesh gradient + orbes desfocadas === */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradiente base */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700" />
        {/* Orbes verdes desfocadas — profundidade */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-gold-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-navy-500/30 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-gold-600/15 blur-[130px]" />
        {/* Grid pattern muito subtil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* === Top bar — logo + stepper === */}
        <header className="border-b border-white/10 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4">
            <div className="flex shrink-0 items-center gap-4">
              <img src="/pumangol-logo-sidebar.png" alt="Pumangol" className="h-4 sm:h-5 w-auto object-contain" />
              <span aria-hidden="true" className="hidden h-6 w-px bg-white/20 sm:block" />
              <p className="hidden whitespace-nowrap text-[10px] uppercase tracking-widest text-gold-300 sm:block">Bem-vindo · Onboarding</p>
            </div>

            {/* Stepper — só visível em desktop */}
            {step !== 'loading' && step !== 'error' && (
              <ol className="hidden min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-2 md:flex">
                {steps.map((s, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <li key={s.key} className="flex items-center gap-2">
                      <div className={cn(
                        'flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-all',
                        active && 'bg-white text-navy-800 shadow-lg shadow-black/20',
                        done && 'bg-gold-500/20 text-gold-200',
                        !active && !done && 'text-white/40',
                      )}>
                        <span className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                          active && 'bg-navy-800 text-white',
                          done && 'bg-gold-500 text-navy-900',
                          !active && !done && 'bg-white/10',
                        )}>
                          {done ? <Check className="w-3 h-3" /> : i + 1}
                        </span>
                        <span className="text-xs font-medium">{s.short}</span>
                      </div>
                      {i < steps.length - 1 && <div className="w-3 h-px bg-white/20" />}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </header>

        {/* === Content === */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-400/40 border-t-gold-400" />
              <p className="text-sm text-white/60">A carregar as boas-vindas…</p>
            </div>
          )}

          {step === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-8 text-center text-white"
            >
              <p className="text-white/80">Não foi possível carregar as boas-vindas.</p>
              <Button variant="accent" className="mt-4" onClick={() => navigate('/onboarding/meu-trilho')}>
                Ir para o meu trilho
              </Button>
            </motion.div>
          )}

          {step === 'ficha' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              // Mesma largura do conteúdo da barra do topo (max-w-6xl px-6 = px-4 do main + px-2)
              className="w-full max-w-6xl sm:px-2"
            >
              <div className="mb-6 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500/20 text-gold-300">
                  <IdCard className="h-6 w-6" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {primeiroNome ? `${primeiroNome}, antes` : 'Antes'} de começarmos, a sua ficha de trabalhador
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-sm text-white/70">
                  Precisamos dos seus dados pessoais, dos dependentes e de um contacto de emergência para concluir a sua admissão.
                  Leva cerca de 5 minutos e pode guardar e continuar mais tarde.
                </p>
              </div>
              <div className="rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-black/30 border border-white/30 p-4 sm:p-6">
                <MinhaFichaEditor submitLabel="Submeter e continuar" onSubmetida={avancar('ficha')} largo />
              </div>
            </motion.div>
          )}

          {videoAtual && (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-4xl"
            >
              {/* Card centrado com efeito glass */}
              <div className="rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-black/30 border border-white/30 p-8 sm:p-10">
                {videoAtual.url ? (
                  <VideoGate key={step} video={videoAtual} ctaLabel={cta(step)} onComplete={avancar(step)} />
                ) : (
                  // Vídeo ainda sem URL no admin: permite saltar sem bloquear o fluxo.
                  <SkipVideoCard titulo={steps[stepIndex]?.label ?? videoAtual.titulo} onSkip={avancar(step)} />
                )}
              </div>
            </motion.div>
          )}

          {step === 'quiz' && estado && estado.quiz.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl"
            >
              <div className="mb-6 text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Quiz de Boas-Vindas</h1>
                <p className="mt-2 text-sm text-white/70">Umas perguntas rápidas sobre a Pumangol. Não é eliminatório.</p>
              </div>
              <div className="rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-black/30 border border-white/30 p-6 sm:p-8">
                <QuizEngine perguntas={estado.quiz} onFinish={concluirQuiz} />
              </div>
            </motion.div>
          )}

          {step === 'quiz' && estado && estado.quiz.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-black/30 border border-white/30 p-8 text-center"
            >
              <p className="text-navy-700 mb-4">Não há quiz configurado. Estás quase a chegar!</p>
              <Button variant="accent" onClick={() => concluirQuiz({ total: 0, acertos: 0, detalhes: [] })}>
                Concluir boas-vindas
              </Button>
            </motion.div>
          )}

          {step === 'result' && resultado && <Confetti />}

          {step === 'result' && resultado && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-lg"
            >
              <div className="rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-black/30 border border-white/30 p-8 sm:p-10 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30"
                >
                  <PartyPopper className="h-10 w-10 text-white" />
                </motion.div>
                <h1 className="text-2xl sm:text-3xl font-bold text-navy-800">
                  Bem-vind{primeiroNome ? 'o' : 'o(a)'} à Pumangol{primeiroNome ? `, ${primeiroNome}` : ''}!
                </h1>
                {resultado.total > 0 ? (
                  <div className="mt-4 rounded-xl bg-navy-50 p-4">
                    <p className="text-4xl font-bold text-navy-800 tabular-nums">
                      {resultado.acertos}<span className="text-navy-400">/{resultado.total}</span>
                    </p>
                    <p className="text-sm text-navy-500 mt-1">
                      Acertaste <strong className="text-success-600">{resultado.percentagem}%</strong> das perguntas
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-navy-500">A tua jornada de integração começa agora.</p>
                )}
                <Button
                  variant="accent"
                  size="lg"
                  className="mt-6 w-full"
                  onClick={() => navigate('/onboarding/meu-trilho', { replace: true })}
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Começar a minha jornada
                  </span>
                </Button>
              </div>
            </motion.div>
          )}
        </main>

        {/* === Footer discreto === */}
        <footer className="px-6 py-4 text-center">
          <p className="text-[11px] uppercase tracking-widest text-white/40">
            {APP_NAME} · {APP_SLOGAN}
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Placeholder para quando um vídeo ainda não tem URL configurado pelo
 *  admin — não bloqueia o fluxo do colaborador. */
function SkipVideoCard({ titulo, onSkip }: { titulo: string; onSkip: () => void }) {
  return (
    <div className="text-center py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-navy-500 mb-2">
        {titulo}
      </p>
      <h3 className="text-xl font-bold text-navy-800 mb-3">
        Vídeo ainda não disponível
      </h3>
      <p className="mx-auto max-w-md text-sm text-navy-500 mb-6">
        A DPC ainda não publicou este vídeo. Podes continuar — ficará disponível
        na Base de Conhecimento assim que estiver pronto.
      </p>
      <Button variant="accent" onClick={onSkip}>
        Continuar
      </Button>
    </div>
  );
}
