/**
 * Feriados nacionais de Angola (Lei n.º 11/18). Calculados no código — os móveis
 * (Carnaval e Sexta-feira Santa) a partir da data da Páscoa.
 */

export interface Feriado {
  data: Date;
  nome: string;
}

const FIXOS: Array<[mes: number, dia: number, nome: string]> = [
  [1, 1, 'Dia do Ano Novo'],
  [2, 4, 'Dia do Início da Luta Armada'],
  [3, 8, 'Dia Internacional da Mulher'],
  [3, 23, 'Dia da Libertação da África Austral'],
  [4, 4, 'Dia da Paz e da Reconciliação Nacional'],
  [5, 1, 'Dia Internacional do Trabalhador'],
  [9, 17, 'Dia do Fundador da Nação e do Herói Nacional'],
  [11, 2, 'Dia dos Finados'],
  [11, 11, 'Dia da Independência Nacional'],
  [12, 25, 'Dia de Natal e da Família'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function maisDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

export function feriadosDoAno(ano: number): Feriado[] {
  const p = pascoa(ano);
  return [
    ...FIXOS.map(([mes, dia, nome]) => ({ data: new Date(ano, mes - 1, dia), nome })),
    { data: maisDias(p, -47), nome: 'Carnaval' },
    { data: maisDias(p, -2), nome: 'Sexta-feira Santa' },
  ].sort((x, y) => x.data.getTime() - y.data.getTime());
}

/** Próximos feriados a partir de hoje (inclusive). */
export function proximosFeriados(quantos = 3, hoje = new Date()): Feriado[] {
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return [...feriadosDoAno(hoje.getFullYear()), ...feriadosDoAno(hoje.getFullYear() + 1)]
    .filter((f) => f.data >= inicioHoje)
    .slice(0, quantos);
}
