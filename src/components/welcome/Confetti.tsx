import { useEffect, useRef } from 'react';

// Verdes da marca + dourado e branco para contraste sobre o fundo escuro.
const CORES = ['#3DD68C', '#10B981', '#01613F', '#A8D6B8', '#F5C542', '#FFFFFF'];

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  cor: string;
  oscila: number;
}

/**
 * Chuva de confetes em canvas (sem dependências), disparada uma vez ao montar.
 * Duas rajadas laterais seguidas de uma queda do topo; termina sozinha.
 * Respeita `prefers-reduced-motion`.
 */
export function Confetti({ duracaoMs = 4500 }: { duracaoMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const redimensionar = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redimensionar();
    window.addEventListener('resize', redimensionar);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const nova = (x: number, y: number, angulo: number, velocidade: number): Particula => ({
      x,
      y,
      vx: Math.cos(angulo) * velocidade,
      vy: Math.sin(angulo) * velocidade,
      rot: rand(0, Math.PI * 2),
      vrot: rand(-0.2, 0.2),
      w: rand(6, 11),
      h: rand(8, 16),
      cor: CORES[Math.floor(Math.random() * CORES.length)],
      oscila: rand(0, Math.PI * 2),
    });

    const particulas: Particula[] = [];
    // Rajadas dos cantos inferiores, apontadas para o centro.
    for (let i = 0; i < 90; i++) {
      particulas.push(nova(0, H() * 0.85, rand(-Math.PI * 0.45, -Math.PI * 0.2), rand(9, 17)));
      particulas.push(nova(W(), H() * 0.85, rand(-Math.PI * 0.8, -Math.PI * 0.55), rand(9, 17)));
    }
    // Queda suave do topo, um pouco depois.
    const timer = window.setTimeout(() => {
      for (let i = 0; i < 120; i++) particulas.push(nova(rand(0, W()), rand(-H() * 0.3, -10), Math.PI / 2, rand(1, 3)));
    }, 350);

    const inicio = performance.now();
    let raf = 0;
    const desenhar = (agora: number) => {
      const t = agora - inicio;
      // Desvanece no último segundo.
      const alpha = Math.max(0, Math.min(1, (duracaoMs - t) / 1000));
      ctx.clearRect(0, 0, W(), H());
      for (const p of particulas) {
        p.vy += 0.25; // gravidade
        p.vx *= 0.985; // resistência do ar
        p.vy *= 0.985;
        p.oscila += 0.1;
        p.x += p.vx + Math.sin(p.oscila) * 0.6;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > H() + 20) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.oscila)); // efeito de papel a rodar
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < duracaoMs) raf = requestAnimationFrame(desenhar);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('resize', redimensionar);
    };
  }, [duracaoMs]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
