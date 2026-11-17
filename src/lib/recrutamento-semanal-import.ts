import { parseWorkbook, cellText, cellNumber, cellDate, cellBoolean, getField } from './excel-import';
import type { RegistoSemanal, StatusRegistoSemanal, PrioridadeRegistoSemanal } from '@/lib/types';

export interface BDRecrutamentoResult {
  registos: RegistoSemanal[];
  totalLinhas: number;
  ignoradas: number;
}

const SHEET_NAME = 'BD_Recrutamento';

/**
 * Normaliza linhas já lidas (objectos indexados por cabeçalho) da folha
 * BD_Recrutamento, replicando exactamente as regras de normalização do
 * painel executivo de referência (painel_executivo_-Recrutamento_Pumangol.html).
 */
export function normalizeBDRecrutamentoRows(rows: Record<string, unknown>[]): BDRecrutamentoResult {
  let ignoradas = 0;
  const registos: RegistoSemanal[] = [];

  for (const row of rows) {
    const referencia = cellText(getField(row, 'Referência da Vaga'));
    if (!referencia) {
      ignoradas++;
      continue;
    }

    const statusOrig = cellText(getField(row, 'Status_Original'));
    let status = cellText(getField(row, 'Status_Inteligente'));
    if (status === 'Fechada' || status === 'Concluído') status = 'Fechado';
    if (!status || status === '#VALUE!') status = 'Em Curso';
    if (statusOrig === 'Cancelada' || statusOrig === 'Cancelado') status = 'Cancelado';

    let prioridade = cellText(getField(row, 'Prioridade'));
    if (!prioridade || prioridade === '#VALUE!') prioridade = 'Baixa';
    if (status === 'Cancelado') prioridade = 'Baixa';

    const daRaw = getField(row, 'Data de Abertura', 'Data_Abertura');
    const dfRaw = getField(row, 'Data de Fecho', 'Data_Fecho');
    const dataAbertura = cellDate(daRaw);
    const dataFecho = cellDate(dfRaw);
    let diasAberto: number | null = null;
    if (dataAbertura) {
      const inicio = new Date(dataAbertura);
      const fim = dataFecho ? new Date(dataFecho) : new Date();
      if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fim.getTime())) {
        diasAberto = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const flagCritica = cellBoolean(getField(row, 'Flag_Crítica'));
    const alertaSemCandidatos = cellBoolean(getField(row, 'Alerta_Sem_Candidatos'));
    const alertaSemOrcamento = cellBoolean(getField(row, 'Alerta_Sem_Orçamento'));

    registos.push({
      referencia,
      funcao: cellText(getField(row, 'Função')) ?? '—',
      direccao: cellText(getField(row, 'Direcção')) ?? '—',
      departamento: cellText(getField(row, 'Departamento')),
      tipo_vaga: cellText(getField(row, 'Tipo_Vaga')),
      orcamento: cellText(getField(row, 'Orçamento')),
      aprov_upst: cellText(getField(row, 'Aprovação_UPST')),
      aprov_fin: cellText(getField(row, 'Aprovação_Financeira')),
      responsavel: cellText(getField(row, 'Responsável')),
      status: status as StatusRegistoSemanal,
      prioridade: prioridade as PrioridadeRegistoSemanal,
      critica: flagCritica && status !== 'Cancelado',
      candidatos: cellNumber(getField(row, 'Nº_Candidatos')) ?? 0,
      dias_aberto: diasAberto,
      sem_candidatos: alertaSemCandidatos && status !== 'Cancelado',
      sem_orcamento: alertaSemOrcamento && status !== 'Cancelado',
      data_abertura: dataAbertura,
      data_fecho: dataFecho,
    });
  }

  return { registos, totalLinhas: rows.length, ignoradas };
}

/** Lê o ficheiro directamente (procura a folha BD_Recrutamento) e normaliza. */
export async function parseBDRecrutamento(file: File): Promise<BDRecrutamentoResult> {
  const { rows } = await parseWorkbook(file, SHEET_NAME);
  return normalizeBDRecrutamentoRows(rows);
}
