import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, CalendarDays, Heart, HeartPulse, Newspaper, UserRound, Users, type LucideIcon,
} from 'lucide-react';
import { APP_NAME_TITLE, APP_SLOGAN } from '@/lib/constants';
import { podeVerRota } from '@/lib/paginas';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/src/store/auth.store';

type Tom = { icon: string; barra: string; hover: string; foco: string };

const PILARES: { titulo: string; texto: string; icon: LucideIcon; tom: Tom }[] = [
  {
    titulo: 'Pessoas',
    texto: 'Quem faz a Pumangol, no mesmo lugar.',
    icon: Users,
    tom: {
      icon: 'bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-200',
      barra: 'bg-info-600',
      hover: 'hover:border-info-300 dark:hover:border-info-500/40',
      foco: 'focus-visible:ring-info-600',
    },
  },
  {
    titulo: 'Cultura',
    texto: 'O que nos liga, para além da função.',
    icon: Heart,
    tom: {
      icon: 'bg-gold-50 text-gold-700 dark:bg-gold-500/15 dark:text-gold-200',
      barra: 'bg-gold-500',
      hover: 'hover:border-gold-300 dark:hover:border-gold-500/40',
      foco: 'focus-visible:ring-gold-500',
    },
  },
  {
    titulo: 'Saúde',
    texto: 'Cuidar de quem cuida do dia a dia.',
    icon: HeartPulse,
    tom: {
      icon: 'bg-[#DDF5E8] text-[#0B6B3A] dark:bg-[#0B6B3A]/25 dark:text-[#B6F5D4]',
      barra: 'bg-[#0B6B3A]',
      hover: 'hover:border-[#8ED9B0] dark:hover:border-[#0B6B3A]',
      foco: 'focus-visible:ring-[#0B6B3A]',
    },
  },
  {
    titulo: 'Desenvolvimento',
    texto: 'Aprender, crescer e acompanhar.',
    icon: Award,
    tom: {
      icon: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-100',
      barra: 'bg-warning-500',
      hover: 'hover:border-warning-300 dark:hover:border-warning-500/40',
      foco: 'focus-visible:ring-warning-500',
    },
  },
];

const ATALHOS: { href: string; titulo: string; texto: string; icon: LucideIcon; tom: Tom }[] = [
  {
    href: '/noticias',
    titulo: 'Notícias',
    texto: 'Publicações e comunicados da Pumangol.',
    icon: Newspaper,
    tom: PILARES[0].tom,
  },
  {
    href: '/eventos',
    titulo: 'Eventos',
    texto: 'Agenda de actividades, formações e encontros.',
    icon: CalendarDays,
    tom: PILARES[2].tom,
  },
  {
    href: '/reconhecimento',
    titulo: 'Reconhecimento',
    texto: 'Aplausos e os valores em prática.',
    icon: Award,
    tom: PILARES[1].tom,
  },
  {
    href: '/meu-perfil',
    titulo: 'O meu perfil',
    texto: 'A tua ficha e o teu percurso na empresa.',
    icon: UserRound,
    tom: PILARES[3].tom,
  },
];

export default function InicioPage() {
  const user = useAuthStore((s) => s.user);
  const primeiro = user?.nome?.trim().split(/\s+/)[0];
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite';
  const cargo = [user?.funcao, user?.departamento].filter(Boolean).join(' · ');
  const atalhos = ATALHOS.filter((atalho) => podeVerRota(atalho.href, user?.paginas));
  const diaSemana = agora.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
  const mes = agora.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#12343F] p-5 text-white shadow-card sm:p-6">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#1B4A4C]/70" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[#0B6B3A]/35" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-row items-center justify-center gap-3 rounded-xl bg-[#3DD68C] px-4 py-3 text-[#0B2A1C] sm:w-[88px] sm:flex-col sm:gap-0 sm:self-stretch sm:py-6">
            <span className="text-[11px] font-bold uppercase tracking-widest">{diaSemana}</span>
            <span className="text-3xl font-extrabold leading-none sm:mt-1 sm:text-4xl">{agora.getDate()}</span>
            <span className="text-xs font-bold uppercase tracking-widest sm:mt-1">{mes}</span>
          </div>

          <img
            src="/people-connect-emblema.png"
            alt=""
            className="h-24 w-24 shrink-0 object-contain sm:h-28 sm:w-28"
          />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3DD68C]">{APP_NAME_TITLE}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {saudacao}{primeiro ? `, ${primeiro}` : ''}
            </h1>
            {cargo ? <p className="mt-2 text-sm text-white/80">{cargo}</p> : null}
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90">
              Bem-vindo ao People Connect. {APP_SLOGAN}.
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              Daqui segues para as notícias, a agenda e o reconhecimento de quem faz a diferença.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-extrabold tracking-tight text-[#0A0A0A] dark:text-white">O que nos liga</h2>
        <p className="mt-1 text-sm text-navy-500">Quatro motivos para estar nesta plataforma.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PILARES.map((pilar) => {
            const Icone = pilar.icon;
            return (
              <li
                key={pilar.titulo}
                className="relative overflow-hidden rounded-xl border border-navy-100 bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy-900"
              >
                <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', pilar.tom.barra)} />
                <span className={cn('mt-1 flex h-10 w-10 items-center justify-center rounded-lg', pilar.tom.icon)}>
                  <Icone className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-navy-900 dark:text-white">{pilar.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-500 dark:text-navy-300">{pilar.texto}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {atalhos.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold tracking-tight text-[#0A0A0A] dark:text-white">Por onde começar</h2>
          <p className="mt-1 text-sm text-navy-500">Os caminhos mais usados, à mão.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {atalhos.map((atalho) => {
              const Icone = atalho.icon;
              return (
                <li key={atalho.href}>
                  <Link
                    to={atalho.href}
                    className={cn(
                      'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-navy-100 bg-white p-4 shadow-card transition duration-200 hover:shadow-card-hover',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      'dark:border-navy-800 dark:bg-navy-900',
                      atalho.tom.hover,
                      atalho.tom.foco,
                    )}
                  >
                    <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', atalho.tom.barra)} />
                    <span className="mt-1 flex items-start justify-between gap-3">
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', atalho.tom.icon)}>
                        <Icone className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-navy-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-navy-700 dark:text-navy-500 dark:group-hover:text-white" aria-hidden="true" />
                    </span>
                    <span className="mt-3 text-sm font-semibold text-navy-900 dark:text-white">{atalho.titulo}</span>
                    <span className="mt-1 text-sm leading-relaxed text-navy-500 dark:text-navy-300">{atalho.texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
