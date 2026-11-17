import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

const CORES_CONFETTI = ['bg-gold-400', 'bg-brand-red-500', 'bg-navy-600', 'bg-info-500', 'bg-warning-400'];
const N_CONFETTI = 12;

function gerarConfetti() {
  return Array.from({ length: N_CONFETTI }, (_, i) => {
    const graus = -165 + (150 * i) / (N_CONFETTI - 1) + (Math.random() - 0.5) * 16;
    const angulo = (graus * Math.PI) / 180;
    const distancia = 14 + Math.random() * 14;
    return {
      x: Math.cos(angulo) * distancia,
      y: Math.sin(angulo) * distancia,
      queda: 8 + Math.random() * 10,
      rotacao: (Math.random() - 0.5) * 540,
      cor: CORES_CONFETTI[i % CORES_CONFETTI.length],
      redondo: i % 3 === 0,
      atraso: Math.random() * 0.08,
    };
  });
}

function Confetti() {
  const [particulas] = useState(gerarConfetti);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {particulas.map((p, i) => (
        <motion.span
          key={i}
          className={cn(
            'absolute left-1/2 top-1/2',
            p.redondo ? '-ml-0.5 -mt-0.5 h-1 w-1 rounded-full' : '-ml-0.5 -mt-[3px] h-1.5 w-1 rounded-[1px]',
            p.cor,
          )}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{
            x: [0, p.x, p.x * 1.15],
            y: [0, p.y, p.y + p.queda],
            opacity: [1, 1, 0],
            scale: [0.4, 1, 0.8],
            rotate: [0, p.rotacao * 0.6, p.rotacao],
          }}
          transition={{ duration: 0.85, delay: 0.08 + p.atraso, ease: 'easeOut', times: [0, 0.4, 1] }}
        />
      ))}
    </span>
  );
}

/**
 * Ícone de palmas que bate e lança confetti sempre que `disparo` aumenta.
 * Desenho do ícone "hands-clapping" do Phosphor Icons (MIT).
 */
export function Palmas({ disparo, className }: { disparo: number; className?: string }) {
  const reduzir = useReducedMotion();
  const animar = disparo > 0 && !reduzir;
  return (
    <span className="relative inline-flex shrink-0">
      <svg
        viewBox="0 0 256 256"
        fill="none"
        stroke="currentColor"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn('h-4 w-4 overflow-visible', className)}
      >
        <motion.g
          key={`impacto-${disparo}`}
          style={{ originX: 0, originY: 1 }}
          animate={animar ? { scale: [0.4, 0.4, 1.35, 1], opacity: [0, 0, 1, 1] } : undefined}
          transition={{ duration: 0.45, times: [0, 0.3, 0.6, 1], ease: 'easeOut' }}
        >
          <line x1="168" y1="8" x2="168" y2="24" />
          <line x1="208" y1="21.02" x2="200" y2="34.13" />
          <line x1="235.66" y1="56" x2="220.62" y2="60.85" />
        </motion.g>
        <motion.g
          key={`maos-${disparo}`}
          style={{ originX: 0.45, originY: 0.9 }}
          animate={animar ? { rotate: [0, -12, 5, -9, 3, 0], scale: [1, 0.84, 1.12, 0.9, 1.06, 1] } : undefined}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <path d="M83.54,99,77.81,89a18,18,0,1,0-31.18,18l19,32.91" />
          <path d="M109.55,144l-26-45a18,18,0,1,1,31.17-18l36.45,63" />
          <path d="M102,59,96.28,49A18,18,0,1,0,65.1,67L77.81,89" />
          <path d="M114.71,81,102,59a18,18,0,1,1,31.17-18l37,64" />
          <path d="M199,187.76a72,72,0,0,0,10.7-86.19L188.61,65a18,18,0,0,0-31.18,18" />
          <path d="M81.81,168,61.59,133a18,18,0,0,0-31.18,18L40,167.59,65.63,212a72,72,0,0,0,124.71-72l-20.2-35A18,18,0,1,0,139,123" />
        </motion.g>
      </svg>
      {animar && <Confetti key={disparo} />}
    </span>
  );
}
