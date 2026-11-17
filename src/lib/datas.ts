/** Data de calendário YYYY-MM-DD, sem deslocar o dia por fuso horário. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(iso);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Hoje no calendário local, em YYYY-MM-DD. */
export function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** Etapa por concluir cuja data de fim já passou, ou marcada explicitamente como atrasada. */
export function etapaEmAtraso(estado: string, dataPrevista: string | null | undefined, hoje = hojeIso()): boolean {
  if (estado === 'concluida' || estado === 'cancelada') return false;
  if (estado === 'atrasada') return true;
  const fim = (dataPrevista ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fim) && fim < hoje;
}

export function somarDias(iso: string, dias: number): string {
  const match = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso.slice(0, 10);
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}
