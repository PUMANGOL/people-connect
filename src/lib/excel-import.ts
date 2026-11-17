import * as XLSX from 'xlsx';

export interface ParsedSheet {
  sheetName: string;
  rows: Record<string, unknown>[];
}

export interface ParsedWorkbook {
  sheetNames: string[];
  sheets: Record<string, Record<string, unknown>[]>;
}

/**
 * Lê um ficheiro .xlsx/.xls/.csv no browser e devolve todas as folhas do
 * workbook, indexadas por nome exacto.
 */
export function parseAllSheets(file: File): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Não foi possível ler o ficheiro.'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets: Record<string, Record<string, unknown>[]> = {};
        for (const name of workbook.SheetNames) {
          sheets[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: null, raw: true });
        }
        resolve({ sheetNames: workbook.SheetNames, sheets });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao processar o ficheiro Excel.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Encontra uma folha pelo nome (case-insensitive, ignora espaços) ou por
 * conter o nome como substring. Devolve o nome real da folha ou null.
 */
export function findSheetName(workbook: ParsedWorkbook, name: string): string | null {
  const target = name.trim().toLowerCase();
  const exact = workbook.sheetNames.find((n) => n.trim().toLowerCase() === target);
  if (exact) return exact;
  return workbook.sheetNames.find((n) => n.trim().toLowerCase().includes(target)) ?? null;
}

/**
 * Lê um ficheiro .xlsx/.xls/.csv no browser e devolve as linhas da folha
 * pedida (por nome) ou da primeira folha do workbook, como objectos
 * indexados pelo cabeçalho de cada coluna.
 */
export function parseWorkbook(file: File, sheetName?: string): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Não foi possível ler o ficheiro.'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const resolvedName = !sheetName
          ? workbook.SheetNames[0]
          : workbook.SheetNames.find((n) => n === sheetName) ?? workbook.SheetNames.find((n) => n.includes(sheetName)) ?? null;

        if (!resolvedName) {
          reject(new Error(`Folha "${sheetName}" não encontrada no ficheiro. Folhas disponíveis: ${workbook.SheetNames.join(', ')}.`));
          return;
        }

        const sheet = workbook.Sheets[resolvedName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
        resolve({ sheetName: resolvedName, rows });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao processar o ficheiro Excel.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Lê um valor de célula como texto limpo (trim), ou null se vazio. */
export function cellText(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
}

/** Lê um valor de célula como número, ou null se vazio/inválido. */
export function cellNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Interpreta valores booleanos "à excel": TRUE/VERDADEIRO/SIM/1. */
export function cellBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const str = cellText(value)?.toUpperCase();
  return str === 'TRUE' || str === 'VERDADEIRO' || str === 'SIM' || str === '1';
}

/** Interpreta uma célula de data (Date, número de série Excel, ou string) como ISO date, ou null. */
export function cellDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Lê o valor de uma linha por qualquer uma das variantes de nome de coluna dadas (case-insensitive). */
export function getField(row: Record<string, unknown>, ...names: string[]): unknown {
  const lowerMap = new Map(Object.keys(row).map((k) => [k.trim().toLowerCase(), k]));
  for (const name of names) {
    const key = lowerMap.get(name.trim().toLowerCase());
    if (key !== undefined) return row[key];
  }
  return undefined;
}
