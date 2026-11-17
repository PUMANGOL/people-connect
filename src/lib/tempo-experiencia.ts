/** Tempo desde a data de início do contrato até hoje, em anos e meses. */
export function tempoExperiencia(iso: string | null | undefined, agora = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  if (!ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  let meses = (agora.getFullYear() - ano) * 12 + (agora.getMonth() + 1 - mes);
  if (agora.getDate() < dia) meses -= 1;
  if (meses < 0) return null;
  if (meses === 0) return 'Menos de 1 mês';

  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes: string[] = [];
  if (anos === 1) partes.push('1 ano');
  else if (anos > 1) partes.push(`${anos} anos`);
  if (resto === 1) partes.push('1 mês');
  else if (resto > 1) partes.push(`${resto} meses`);
  return partes.join(' e ');
}
