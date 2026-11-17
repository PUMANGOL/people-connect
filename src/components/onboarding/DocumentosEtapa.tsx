import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, Download, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/store';
import { cn } from '@/lib/utils';
import { erroPedido } from '@/src/lib/erro-pedido';
import { anexosService, urlDescarregar, type DocumentoPedido, type EtapaAnexo } from '@/src/services/anexos.service';
import { REGRAS_FICHEIRO, formatarTamanho, validarFicheiro } from '@/src/services/ficheiros.service';

interface Props {
  progressoId: string;
  documentos: DocumentoPedido[];
  anexos: EtapaAnexo[];
  /** Pode anexar e remover (colaborador com a etapa em curso). */
  editavel: boolean;
  /** Mensagem quando não é editável e ainda não há ficheiros. */
  avisoBloqueado?: string;
  onAnexosChange?: (anexos: EtapaAnexo[]) => void;
}

export function documentosEmFalta(documentos: DocumentoPedido[], anexos: EtapaAnexo[]): DocumentoPedido[] {
  const enviados = new Set(anexos.map((a) => a.documento_chave));
  return documentos.filter((d) => d.obrigatorio && !enviados.has(d.chave));
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
}

export function DocumentosEtapa({ progressoId, documentos, anexos, editavel, avisoBloqueado, onAnexosChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const alvo = useRef<string | null>(null);
  const [envio, setEnvio] = useState<{ chave: string; nome: string; pct: number } | null>(null);
  const [aRemover, setARemover] = useState<string | null>(null);
  const [arrastar, setArrastar] = useState<string | null>(null);

  if (!documentos.length) return null;
  const enviados = documentos.filter((d) => anexos.some((a) => a.documento_chave === d.chave)).length;

  function escolher(chave: string) {
    if (envio) return;
    alvo.current = chave;
    input.current?.click();
  }

  async function enviar(chave: string, file: File) {
    const invalido = validarFicheiro('documento', file);
    if (invalido) {
      toast.error('Ficheiro não aceite', invalido);
      return;
    }
    setEnvio({ chave, nome: file.name, pct: 0 });
    try {
      const anexo = await anexosService.anexar(progressoId, chave, file, (pct) =>
        setEnvio((e) => (e ? { ...e, pct } : e)),
      );
      onAnexosChange?.([...anexos, anexo]);
      toast.success('Documento anexado', file.name);
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível anexar o documento.');
      if (!jaNotificado) toast.error('Documento não anexado', msg);
    } finally {
      setEnvio(null);
    }
  }

  async function remover(anexo: EtapaAnexo) {
    if (!window.confirm(`Remover "${anexo.ficheiro_nome}"?`)) return;
    setARemover(anexo.id);
    try {
      await anexosService.remover(anexo.id);
      onAnexosChange?.(anexos.filter((a) => a.id !== anexo.id));
      toast.success('Documento removido');
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível remover o documento.');
      if (!jaNotificado) toast.error('Documento não removido', msg);
    } finally {
      setARemover(null);
    }
  }

  function largar(e: DragEvent, chave: string) {
    e.preventDefault();
    setArrastar(null);
    const file = e.dataTransfer.files?.[0];
    if (file && editavel && !envio) void enviar(chave, file);
  }

  return (
    <div className="mt-3 rounded-lg border border-navy-100 bg-surface-secondary p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
          <Paperclip className="h-3.5 w-3.5 text-navy-400" />
          Documentos a anexar
        </p>
        <span className={cn('text-xs font-medium', enviados === documentos.length ? 'text-success-600' : 'text-navy-400')}>
          {enviados} de {documentos.length}
        </span>
      </div>

      <input
        ref={input}
        type="file"
        className="hidden"
        accept={REGRAS_FICHEIRO.documento.aceitar}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && alvo.current) void enviar(alvo.current, file);
        }}
      />

      <ul className="space-y-2">
        {documentos.map((doc) => {
          const meus = anexos.filter((a) => a.documento_chave === doc.chave);
          const aEnviar = envio?.chave === doc.chave;
          return (
            <li
              key={doc.chave}
              onDragOver={editavel ? (e) => { e.preventDefault(); setArrastar(doc.chave); } : undefined}
              onDragLeave={editavel ? () => setArrastar((c) => (c === doc.chave ? null : c)) : undefined}
              onDrop={editavel ? (e) => largar(e, doc.chave) : undefined}
              className={cn(
                'rounded-md border bg-white px-3 py-2.5 transition-colors',
                arrastar === doc.chave ? 'border-navy-400 bg-navy-50' : 'border-navy-100',
              )}
            >
              <div className="flex items-center gap-3">
                {meus.length ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-navy-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-800">{doc.nome}</p>
                  <p className="text-xs text-navy-400">
                    {meus.length
                      ? `${meus.length} ficheiro${meus.length > 1 ? 's' : ''} enviado${meus.length > 1 ? 's' : ''}`
                      : doc.obrigatorio ? 'Obrigatório' : 'Opcional'}
                  </p>
                </div>
                {editavel && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={aEnviar}
                    disabled={!!envio && !aEnviar}
                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                    onClick={() => escolher(doc.chave)}
                  >
                    {meus.length ? 'Adicionar' : 'Anexar'}
                  </Button>
                )}
              </div>

              {aEnviar && envio && (
                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] text-navy-500">
                    <span className="truncate pr-2">{envio.nome}</span>
                    <span>{envio.pct}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-navy-100">
                    <div className="h-full rounded-full bg-navy-600 transition-all" style={{ width: `${envio.pct}%` }} />
                  </div>
                </div>
              )}

              {meus.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-navy-50 pt-2">
                  {meus.map((a) => {
                    const Icone = a.ficheiro_tipo.startsWith('image/') ? ImageIcon : FileText;
                    return (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <Icone className="h-3.5 w-3.5 shrink-0 text-navy-400" />
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate font-medium text-navy-700 hover:text-navy-900 hover:underline"
                          title={a.ficheiro_nome}
                        >
                          {a.ficheiro_nome}
                        </a>
                        <span className="shrink-0 text-navy-400">{formatarTamanho(a.tamanho)} · {dataCurta(a.created_at)}</span>
                        <a
                          href={urlDescarregar(a)}
                          className="rounded p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                          aria-label={`Descarregar ${a.ficheiro_nome}`}
                          title="Descarregar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        {editavel && (
                          <button
                            type="button"
                            onClick={() => remover(a)}
                            disabled={aRemover === a.id}
                            className="rounded p-1 text-navy-400 hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
                            aria-label={`Remover ${a.ficheiro_nome}`}
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {editavel ? (
        <p className="mt-2 text-[11px] text-navy-400">{REGRAS_FICHEIRO.documento.descricao}. Podes arrastar o ficheiro para o documento.</p>
      ) : (
        avisoBloqueado && !anexos.length && <p className="mt-2 text-[11px] text-navy-400">{avisoBloqueado}</p>
      )}
    </div>
  );
}
