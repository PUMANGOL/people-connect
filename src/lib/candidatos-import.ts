import { cellText, cellDate, getField } from './excel-import';
import type { CandidatoImportado, EstadoCandidatoImportado } from '@/lib/types';

export interface CandidatosImportResult {
  candidatos: CandidatoImportado[];
  totalLinhas: number;
  ignoradas: number;
}

function normalizeEstado(raw: string | null): EstadoCandidatoImportado {
  const t = (raw ?? '').trim().toLowerCase();
  if (t.startsWith('aprov')) return 'aprovado';
  if (t.startsWith('rejeit') || t.startsWith('recus')) return 'rejeitado';
  return 'em_analise';
}

/**
 * Normaliza linhas da folha "Candidatos" do Excel semanal. Aceita variantes
 * comuns de cabeçalho (Nome / Candidato, Função / Posição / Cargo, etc.).
 */
export function normalizeCandidatosRows(rows: Record<string, unknown>[]): CandidatosImportResult {
  let ignoradas = 0;
  const candidatos: CandidatoImportado[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nome = cellText(getField(row, 'Nome', 'Candidato', 'Nome do Candidato'));
    if (!nome) {
      ignoradas++;
      continue;
    }
    candidatos.push({
      id: `import-${i}-${nome.toLowerCase().replace(/\s+/g, '-')}`,
      nome,
      funcao: cellText(getField(row, 'Função', 'Funcao', 'Posição', 'Posicao', 'Cargo', 'Vaga')),
      departamento: cellText(getField(row, 'Departamento', 'Direcção', 'Direccao', 'Área', 'Area')),
      email: cellText(getField(row, 'Email', 'E-mail')),
      telefone: cellText(getField(row, 'Telefone', 'Contacto', 'Telemóvel')),
      origem: cellText(getField(row, 'Origem', 'Fonte', 'Canal')),
      data: cellDate(getField(row, 'Data', 'Data de Entrada', 'Data_Entrada', 'Data de Candidatura')),
      estado: normalizeEstado(cellText(getField(row, 'Status', 'Estado', 'Situação'))),
      observacoes: cellText(getField(row, 'Observações', 'Observacoes', 'Notas', 'Comentários')),
    });
  }

  return { candidatos, totalLinhas: rows.length, ignoradas };
}
