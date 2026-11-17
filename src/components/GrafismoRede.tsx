import { cn } from '@/lib/utils';

/**
 * Grafismo de rede People Connect (do banner DPC): pessoas ligadas num hexágono
 * com anéis pontilhados. Decorativo e quase invisível — fundo do menu lateral e do conteúdo.
 *
 * `cor` = traço (aceita `currentColor`); `fundo` = cor por trás das pessoas (esconde as linhas
 * que passam por elas), deve ser a cor da superfície onde o grafismo assenta (aceita `var(--…)`).
 */
interface GrafismoRedeProps {
  cor: string;
  fundo: string;
  /** `rede` = hexágono + pessoas + anéis; `aneis` = só os anéis. */
  variante?: 'rede' | 'aneis';
  /** Acrescenta o arco exterior tracejado (fundo do conteúdo). */
  arcoExterior?: boolean;
  /** Raio dos marcadores de pessoa: maior no conteúdo, menor no menu. */
  escala?: 'menu' | 'conteudo';
  className?: string;
}

const VERTICES: Array<[number, number]> = [
  [150, 55], [232, 102], [232, 198], [150, 245], [68, 198], [68, 102],
];

function Pessoa({ x, y, r, fundo }: { x: number; y: number; r: number; fundo: string }) {
  // Proporções do artefacto: cabeça r/3.5, ombros um arco largo de r/2.
  const cabeca = r * (r >= 18 ? 0.28 : 0.29);
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* style (e não o atributo fill) para aceitar variáveis CSS, ex.: var(--background) */}
      <circle r={r} style={{ fill: fundo }} />
      <circle cy={-cabeca} r={cabeca} />
      <path d={`M${-r / 2} ${r * 0.58}a${r / 2} ${r * 0.42} 0 0 1 ${r} 0`} />
    </g>
  );
}

export function GrafismoRede({
  cor, fundo, variante = 'rede', arcoExterior = false, escala = 'conteudo', className,
}: GrafismoRedeProps) {
  const rPessoa = escala === 'menu' ? 12 : 14;
  const rCentro = escala === 'menu' ? 18 : 22;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 300"
      className={cn('pointer-events-none select-none', className)}
    >
      {arcoExterior && (
        <circle cx="150" cy="150" r="142" fill="none" stroke={cor} strokeOpacity="0.08" strokeWidth="1" strokeDasharray="260 140 120 372" />
      )}
      <circle
        cx="150" cy="150" r="126" fill="none" stroke={cor}
        strokeOpacity={escala === 'menu' ? 0.16 : 0.14}
        strokeWidth={escala === 'menu' ? 2.2 : 2.4}
        strokeLinecap="round" strokeDasharray="0.5 9"
      />
      {variante === 'rede' && (
        <>
          <g fill="none" stroke={cor} strokeOpacity="0.07" strokeWidth="0.8">
            <polygon points={VERTICES.map((v) => v.join(',')).join(' ')} />
            <polygon points="150,55 232,198 68,198" />
            <polygon points="150,245 68,102 232,102" />
          </g>
          <g fill="none" stroke={cor} strokeOpacity={escala === 'menu' ? 0.13 : 0.12} strokeWidth="1" strokeLinecap="round">
            {VERTICES.map(([x, y]) => <Pessoa key={`${x}-${y}`} x={x} y={y} r={rPessoa} fundo={fundo} />)}
            <Pessoa x={150} y={150} r={rCentro} fundo={fundo} />
          </g>
        </>
      )}
    </svg>
  );
}
