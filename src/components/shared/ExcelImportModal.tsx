import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Dialog } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { validateExcelFile } from '@/lib/validators';
import { parseWorkbook } from '@/src/lib/excel-import';
import { toast } from '@/src/store';

export interface ImportSummary {
  criadas: number;
  rejeitadas: number;
  erros: string[];
}

interface ExcelImportModalProps {
  title: string;
  description?: string;
  templateColumns: string[];
  /** Se definido, procura uma folha com este nome exacto em vez da primeira folha. */
  sheetName?: string;
  onClose: () => void;
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportSummary>;
  onDone: () => void;
}

export function ExcelImportModal({ title, description, templateColumns, sheetName, onClose, onImport, onDone }: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleFile(f: File) {
    const validation = validateExcelFile(f);
    if (!validation.valid) {
      toast.error('Ficheiro inválido', validation.error!);
      return;
    }
    setFile(f);
    setParseError(null);
    setParsedRows(null);
    setSummary(null);
    setParsing(true);
    try {
      const { rows } = await parseWorkbook(f, sheetName);
      if (rows.length === 0) {
        setParseError('O ficheiro não contém linhas de dados.');
      } else {
        setParsedRows(rows);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao processar o ficheiro.');
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!parsedRows) return;
    setImporting(true);
    try {
      const result = await onImport(parsedRows);
      setSummary(result);
      if (result.criadas > 0) {
        toast.success(
          'Importação concluída',
          `${result.criadas} registo(s) importado(s)${result.rejeitadas > 0 ? `, ${result.rejeitadas} rejeitado(s)` : ''}.`
        );
        onDone();
      } else {
        toast.warning('Nada importado', 'Nenhuma linha válida foi encontrada no ficheiro.');
      }
    } catch (err) {
      toast.error('Erro na importação', err instanceof Error ? err.message : 'Não foi possível importar o ficheiro.');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setParsedRows(null);
    setParseError(null);
    setSummary(null);
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">{title}</h2>
      {description && <p className="text-sm text-navy-400 mb-4">{description}</p>}

      <div className="mb-4 p-3 bg-navy-25 border border-navy-100 rounded-lg">
        <p className="text-xs font-semibold text-navy-600 uppercase tracking-wide mb-1.5">Colunas esperadas</p>
        <div className="flex flex-wrap gap-1.5">
          {templateColumns.map((col) => (
            <span key={col} className="text-[11px] bg-white border border-navy-200 text-navy-600 rounded px-1.5 py-0.5">
              {col}
            </span>
          ))}
        </div>
        {sheetName && (
          <p className="text-xs text-navy-400 mt-2">
            Folha esperada: <strong className="text-navy-600">{sheetName}</strong>
          </p>
        )}
      </div>

      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-navy-200 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition-colors"
        >
          <Upload className="w-10 h-10 text-navy-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-navy-700">Arraste um ficheiro ou clique para escolher</p>
          <p className="text-xs text-navy-400 mt-1">.xlsx, .xls ou .csv, máximo 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-navy-25 border border-navy-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-navy-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800 truncate">{file.name}</p>
              <p className="text-xs text-navy-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            {!summary && (
              <Button variant="ghost" size="sm" onClick={reset}>Trocar</Button>
            )}
          </div>

          {parsing && (
            <p className="text-sm text-navy-500 flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              A processar ficheiro...
            </p>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-100 rounded-lg">
              <XCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-error-700">{parseError}</p>
            </div>
          )}

          {parsedRows && !summary && (
            <div className="flex items-start gap-2 p-3 bg-info-50 border border-info-100 rounded-lg">
              <FileSpreadsheet className="w-4 h-4 text-info-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-info-700">{parsedRows.length} linha(s) encontrada(s). Confirma para validar e importar.</p>
            </div>
          )}

          {summary && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-success-50 border border-success-100 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-success-700">{summary.criadas} registo(s) importado(s) com sucesso.</p>
              </div>
              {summary.rejeitadas > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning-50 border border-warning-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-warning-700">
                    <p className="font-medium">{summary.rejeitadas} linha(s) rejeitada(s):</p>
                    <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto">
                      {summary.erros.slice(0, 20).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <Button variant="ghost" onClick={onClose}>{summary ? 'Fechar' : 'Cancelar'}</Button>
        {!summary && (
          <Button variant="primary" onClick={handleConfirm} loading={importing} disabled={!parsedRows || parsing}>
            Confirmar Importação
          </Button>
        )}
      </div>
    </Dialog>
  );
}
