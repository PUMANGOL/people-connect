import { useEffect, useRef, type ReactNode } from 'react';
import { Cake, Megaphone } from 'lucide-react';

function IconeOrbita({ children }: { children: ReactNode }) {
  return (
    <g className="lp-up-a">
      <circle r="25" fill="#03351f" stroke="#7eecb6" strokeOpacity="0.55" strokeWidth="1.2" />
      <g className="lp-nic" transform="translate(-11 -11)">
        <svg width="22" height="22" viewBox="0 0 24 24">
          {children}
        </svg>
      </g>
    </g>
  );
}

export function LoginPalco() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ponteiro = window.matchMedia('(pointer: fine)');
    const largo = window.matchMedia('(min-width: 1024px)');
    if (reduzido.matches || !ponteiro.matches || !largo.matches) return;

    const cards = [...stage.querySelectorAll<HTMLElement>('[data-depth]')];
    let frame = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        for (const card of cards) {
          const profundidade = Number(card.dataset.depth) || 0;
          card.style.translate = `${(-x * profundidade).toFixed(1)}px ${(-y * profundidade).toFixed(1)}px`;
        }
      });
    };

    window.addEventListener('pointermove', mover, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', mover);
    };
  }, []);

  return (
    <div ref={stageRef} className="a-stage" aria-hidden>
      <svg className="lp-orbit" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="lp-hub" cx="42%" cy="35%" r="70%">
            <stop offset="0" stopColor="#9ff3c8" />
            <stop offset="0.5" stopColor="#2fb57a" />
            <stop offset="1" stopColor="#016a42" />
          </radialGradient>
          <radialGradient id="lp-halo">
            <stop offset="0" stopColor="#6fd3a3" stopOpacity="0.42" />
            <stop offset="1" stopColor="#6fd3a3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="196" fill="url(#lp-halo)" opacity="0.45" />
        <g className="lp-rot-d">
          <circle cx="200" cy="200" r="178" fill="none" stroke="#bff5d9" strokeOpacity="0.38" strokeWidth="1.6" strokeDasharray="1.5 8" strokeLinecap="round" />
        </g>
        <g className="lp-rot-c">
          <circle cx="200" cy="200" r="178" fill="none" stroke="#7eecb6" strokeWidth="2.4" strokeDasharray="90 1030" strokeLinecap="round" />
          <circle cx="200" cy="22" r="4" fill="#d2fae4" />
        </g>
        <circle className="lp-wave" cx="200" cy="200" r="70" fill="none" stroke="#9ff3c8" strokeOpacity="0.5" />
        <circle className="lp-wave lp-wave-2" cx="200" cy="200" r="70" fill="none" stroke="#9ff3c8" strokeOpacity="0.5" />

        <g className="lp-rot-a">
          <circle cx="200" cy="200" r="140" fill="none" stroke="#fff" strokeOpacity="0.14" />
          <path d="M200 200V60M200 200H340M200 200V340M200 200H60" stroke="#bff5d9" strokeOpacity="0.28" strokeDasharray="2 5" />
          <g transform="translate(200 60)">
            <IconeOrbita>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <path d="M16 3.128a4 4 0 0 1 0 7.744" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <circle cx="9" cy="7" r="4" />
            </IconeOrbita>
          </g>
          <g transform="translate(340 200)">
            <IconeOrbita>
              <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
              <path d="M20 2v4" />
              <path d="M22 4h-4" />
              <circle cx="4" cy="20" r="2" />
            </IconeOrbita>
          </g>
          <g transform="translate(200 340)">
            <IconeOrbita>
              <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              <path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
            </IconeOrbita>
          </g>
          <g transform="translate(60 200)">
            <IconeOrbita>
              <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
              <path d="M22 10v6" />
              <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
            </IconeOrbita>
          </g>
        </g>

        <g className="lp-rot-b">
          <circle cx="200" cy="200" r="88" fill="none" stroke="#fff" strokeOpacity="0.13" strokeDasharray="3 6" />
          <g transform="translate(276.2 156)">
            <g className="lp-up-b">
              <circle r="15" fill="#16865a" stroke="#013d25" strokeWidth="3" />
              <text>AM</text>
            </g>
          </g>
          <g transform="translate(256.6 267.4)">
            <g className="lp-up-b">
              <circle r="15" fill="#9a6a17" stroke="#013d25" strokeWidth="3" />
              <text>KN</text>
            </g>
          </g>
          <g transform="translate(143.4 267.4)">
            <g className="lp-up-b">
              <circle r="15" fill="#0f7a6e" stroke="#013d25" strokeWidth="3" />
              <text>LS</text>
            </g>
          </g>
          <g transform="translate(117.3 169.9)">
            <g className="lp-up-b">
              <circle r="15" fill="#4c7d68" stroke="#013d25" strokeWidth="3" />
              <text>EP</text>
            </g>
          </g>
          <g transform="translate(215.3 113.3)">
            <g className="lp-up-b">
              <circle r="15" fill="#127f52" stroke="#013d25" strokeWidth="3" />
              <text>JM</text>
            </g>
          </g>
        </g>

        <circle cx="200" cy="200" r="58" fill="url(#lp-halo)" />
        <circle cx="200" cy="200" r="40" fill="url(#lp-hub)" />
        <circle cx="200" cy="200" r="40" fill="none" stroke="#fff" strokeOpacity="0.35" />
        <g transform="translate(200 200)" fill="#fff">
          <path d="M0-17 14.72 8.5H-14.72Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cy="-17" r="4.6" />
          <circle cx="14.72" cy="8.5" r="4.6" />
          <circle cx="-14.72" cy="8.5" r="4.6" />
          <circle r="5.2" fill="#014a2d" />
        </g>
      </svg>

      <div className="lp-w lp-w1" data-depth="14">
        <div className="lp-w-head">
          <span className="lp-w-ic lp-w-ic-warm">
            <Cake className="h-[17px] w-[17px]" />
          </span>
          <div>
            <b>Aniversários hoje</b>
            <small>3 colegas celebram</small>
          </div>
        </div>
        <div className="lp-w-row">
          <span className="lp-stack">
            <i style={{ background: '#16865a' }}>AM</i>
            <i style={{ background: '#9a6a17' }}>KN</i>
            <i style={{ background: '#0f7a6e' }}>LS</i>
            <i style={{ background: 'rgba(255,255,255,.18)' }}>+2</i>
          </span>
          <span className="lp-pill">Dar os parabéns</span>
        </div>
      </div>

      <div className="lp-w lp-w2" data-depth="24">
        <div className="lp-w-head">
          <span className="lp-w-ic">
            <Megaphone className="h-[17px] w-[17px]" />
          </span>
          <div>
            <b>Comunicado</b>
            <small>Pessoas &amp; Cultura · há 2 h</small>
          </div>
          <span className="lp-badge">Novo</span>
        </div>
        <p className="lp-w-title">Semana da Saúde e Bem-estar</p>
        <span className="lp-skel" style={{ width: '94%' }} />
        <span className="lp-skel" style={{ width: '62%' }} />
      </div>

      <div className="lp-w lp-w3" data-depth="10">
        <div className="lp-ringbox">
          <svg viewBox="0 0 48 48">
            <circle className="lp-ring-bg" cx="24" cy="24" r="19" />
            <circle className="lp-ring-fg" cx="24" cy="24" r="19" pathLength="100" />
          </svg>
          <span>75%</span>
        </div>
        <div>
          <b>Plano de integração</b>
          <small>3 de 4 etapas concluídas</small>
        </div>
      </div>
    </div>
  );
}
