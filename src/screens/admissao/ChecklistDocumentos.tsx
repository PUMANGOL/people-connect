import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Copy, Download, Send, Trash2, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/input';
import { toast } from '@/src/store';
import { documentosExigidosService, type DocumentoExigido } from '@/src/services/onboarding-v2.service';
import {
  admissaoService,
  type ChecklistAdmissao,
  type ChecklistItem,
} from '@/src/services/admissao.service';

function mensagemErro(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message || fallback;
}

function MenuAccoes({
  item,
  fechado,
  ocupado,
  onDescarregar,
  onValidar,
  onRejeitar,
  onRetirar,
}: {
  item: ChecklistItem;
  fechado: boolean;
  ocupado: boolean;
  onDescarregar: () => void;
  onValidar: () => void;
  onRejeitar: () => void;
  onRetirar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const opcoes: Array<{ label: string; icon: LucideIcon; className?: string; onClick: () => void }> = [];
  if (item.submissao) {
    opcoes.push({ label: 'Descarregar', icon: Download, onClick: onDescarregar });
  }
  if (item.submissao && !fechado && item.submissao.estado !== 'validado') {
    opcoes.push({ label: 'Validar', icon: Check, className: 'text-success-700', onClick: onValidar });
  }
  if (item.submissao && !fechado) {
    opcoes.push({ label: 'Rejeitar', icon: X, className: 'text-error-600', onClick: onRejeitar });
  }
  if (!item.submissao && !fechado) {
    opcoes.push({ label: 'Retirar', icon: Trash2, onClick: onRetirar });
  }
  if (!opcoes.length) return <span className="text-navy-300">—</span>;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        aria-label={`Opções de ${item.nome}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-navy-600 hover:bg-navy-50"
      >
        Opções
        <ChevronDown className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 gap-0.5 p-1">
        {opcoes.map((opcao) => {
          const Icone = opcao.icon;
          return (
            <button
              key={opcao.label}
              type="button"
              disabled={ocupado}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-navy-700 hover:bg-navy-50 disabled:opacity-50',
                opcao.className,
              )}
              onClick={() => {
                setAberto(false);
                opcao.onClick();
              }}
            >
              <Icone className="h-4 w-4 shrink-0" />
              {opcao.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function estadoItem(item: ChecklistItem): { label: string; variant: 'neutral' | 'info' | 'success' | 'error' } {
  if (!item.submissao) return { label: 'Por entregar', variant: 'neutral' };
  if (item.submissao.estado === 'validado') return { label: 'Validado', variant: 'success' };
  if (item.submissao.estado === 'rejeitado') return { label: 'Rejeitado', variant: 'error' };
  return { label: 'Submetido', variant: 'info' };
}

export function ChecklistDocumentos({
  processoId,
  etapa,
  fechado,
  onEnviada,
}: {
  processoId: string;
  etapa: string;
  fechado: boolean;
  onEnviada: () => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistAdmissao | null>(null);
  const [catalogo, setCatalogo] = useState<DocumentoExigido[]>([]);
  const [escolhido, setEscolhido] = useState('');
  const [obrigatorio, setObrigatorio] = useState(true);
  const [aEnviar, setAEnviar] = useState(false);
  const [aRejeitar, setARejeitar] = useState<ChecklistItem | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([admissaoService.documentos(processoId), documentosExigidosService.list()])
      .then(([lista, docs]) => {
        if (!activo) return;
        setChecklist(lista);
        setCatalogo(docs);
      })
      .catch(() => toast.error('Erro', 'Não foi possível carregar a checklist.'));
    return () => { activo = false; };
  }, [processoId]);

  const usados = new Set(checklist?.itens.map((item) => item.documento_exigido_id));
  const opcoes = catalogo
    .filter((doc) => !usados.has(doc.id))
    .map((doc) => ({ value: doc.id, label: doc.categoria ? `${doc.nome} · ${doc.categoria}` : doc.nome }));

  function aplicar(seguinte: ChecklistAdmissao) {
    setChecklist(seguinte);
  }

  async function adicionar() {
    const doc = catalogo.find((item) => item.id === escolhido);
    if (!doc) return;
    setOcupado(true);
    try {
      aplicar(await admissaoService.adicionarDocumento(processoId, {
        documento_exigido_id: doc.id,
        obrigatorio,
      }));
      setEscolhido('');
      setObrigatorio(true);
    } catch (err) {
      toast.error('Erro', mensagemErro(err, 'Não foi possível adicionar o documento.'));
    } finally {
      setOcupado(false);
    }
  }

  async function alternar(item: ChecklistItem, valor: boolean) {
    try {
      aplicar(await admissaoService.actualizarDocumento(processoId, item.id, valor));
    } catch (err) {
      toast.error('Erro', mensagemErro(err, 'Não foi possível actualizar a obrigatoriedade.'));
    }
  }

  async function remover(item: ChecklistItem) {
    setOcupado(true);
    try {
      aplicar(await admissaoService.removerDocumento(processoId, item.id));
    } catch (err) {
      toast.error('Erro', mensagemErro(err, 'Não foi possível retirar o documento.'));
    } finally {
      setOcupado(false);
    }
  }

  async function enviar() {
    setOcupado(true);
    try {
      aplicar(await admissaoService.enviarChecklist(processoId));
      setAEnviar(false);
      onEnviada();
      toast.success(etapa === 'ADM-006' ? 'Checklist enviada' : 'Link reenviado');
    } catch (err) {
      toast.error('Erro', mensagemErro(err, 'Não foi possível enviar a checklist.'));
    } finally {
      setOcupado(false);
    }
  }

  async function avaliar(item: ChecklistItem, accao: 'validado' | 'rejeitado', motivoRejeicao?: string) {
    setOcupado(true);
    try {
      aplicar(await admissaoService.avaliarDocumento(processoId, item.id, { accao, motivo: motivoRejeicao }));
      setARejeitar(null);
      setMotivo('');
    } catch (err) {
      toast.error('Erro', mensagemErro(err, 'Não foi possível avaliar o documento.'));
    } finally {
      setOcupado(false);
    }
  }

  async function descarregar(item: ChecklistItem) {
    try {
      const res = await fetch(`/api/admissao/${processoId}/documentos/${item.id}/ficheiro`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        toast.error('Erro', body?.error || 'Não foi possível descarregar o ficheiro.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ancora = document.createElement('a');
      ancora.href = url;
      ancora.download = item.submissao?.ficheiro_nome || item.nome;
      ancora.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro', 'Não foi possível descarregar o ficheiro.');
    }
  }

  async function copiarLink() {
    if (!checklist?.link) return;
    try {
      await navigator.clipboard.writeText(checklist.link);
      toast.success('Link copiado');
    } catch {
      toast.error('Erro', 'Não foi possível copiar o link.');
    }
  }

  const enviada = Boolean(checklist?.enviado_em);

  return (
    <section className="rounded-xl border border-navy-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">Checklist de documentos</h2>
          <p className="mt-1 text-sm text-navy-500">
            Os documentos vêm do catálogo. Cada linha diz se a entrega é obrigatória para este processo.
          </p>
        </div>
        {enviada && (
          <Badge variant="success">
            Enviada {new Date(checklist!.enviado_em!).toLocaleString('pt-AO')}
          </Badge>
        )}
      </div>

      {!fechado && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Select
              aria-label="Documento do catálogo"
              placeholder={opcoes.length ? 'Escolher documento' : 'Catálogo sem documentos por adicionar'}
              options={opcoes}
              value={escolhido}
              disabled={!opcoes.length || ocupado}
              onChange={(valor) => {
                setEscolhido(valor);
                const doc = catalogo.find((item) => item.id === valor);
                setObrigatorio(doc ? doc.obrigatorio : true);
              }}
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              className="size-4 accent-[#109A4E]"
              checked={obrigatorio}
              onChange={(e) => setObrigatorio(e.target.checked)}
            />
            Obrigatório
          </label>
          <Button variant="secondary" disabled={!escolhido || ocupado} onClick={adicionar}>Adicionar</Button>
        </div>
      )}

      {!catalogo.length && (
        <p className="mt-3 text-sm text-navy-500">
          O catálogo está vazio. Crie os documentos em{' '}
          <Link to="/onboarding/documentos-exigidos" className="font-medium text-navy-800 underline">Documentos exigidos</Link>.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-400">
              <th className="py-2 pr-3 font-semibold">Documento</th>
              <th className="py-2 pr-3 font-semibold">Obrigatório</th>
              <th className="py-2 pr-3 font-semibold">Estado</th>
              <th className="py-2 pr-3 font-semibold">Ficheiro</th>
              <th className="py-2 font-semibold">Acções</th>
            </tr>
          </thead>
          <tbody>
            {checklist?.itens.map((item) => {
              const estado = estadoItem(item);
              return (
                <tr key={item.id} className="border-b border-navy-50 align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-navy-800">{item.nome}</p>
                    {item.descricao && <p className="mt-0.5 text-xs text-navy-400">{item.descricao}</p>}
                    {item.submissao?.motivo && (
                      <p className="mt-1 text-xs text-error-700">Motivo: {item.submissao.motivo}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#109A4E]"
                      checked={item.obrigatorio}
                      disabled={fechado}
                      aria-label={`Obrigatoriedade de ${item.nome}`}
                      onChange={(e) => alternar(item, e.target.checked)}
                    />
                  </td>
                  <td className="py-3 pr-3"><Badge variant={estado.variant}>{estado.label}</Badge></td>
                  <td className="py-3 pr-3 text-navy-600">
                    {item.submissao?.ficheiro_nome ?? '—'}
                    {item.submissao?.submetido_em && (
                      <p className="mt-0.5 text-xs text-navy-400">{new Date(item.submissao.submetido_em).toLocaleString('pt-AO')}</p>
                    )}
                  </td>
                  <td className="py-3">
                    <MenuAccoes
                      item={item}
                      fechado={fechado}
                      ocupado={ocupado}
                      onDescarregar={() => descarregar(item)}
                      onValidar={() => avaliar(item, 'validado')}
                      onRejeitar={() => { setARejeitar(item); setMotivo(item.submissao?.motivo ?? ''); }}
                      onRetirar={() => remover(item)}
                    />
                  </td>
                </tr>
              );
            })}
            {checklist && !checklist.itens.length && (
              <tr>
                <td colSpan={5} className="py-6 text-navy-400">Ainda não há documentos nesta checklist.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!fechado && (
          <Button
            variant="primary"
            disabled={!checklist?.itens.length || ocupado}
            leftIcon={<Send className="h-4 w-4" />}
            onClick={() => setAEnviar(true)}
          >
            {etapa === 'ADM-006' ? 'Enviar checklist ao candidato' : 'Reenviar link'}
          </Button>
        )}
        {checklist?.link && (
          <Button variant="secondary" onClick={copiarLink} leftIcon={<Copy className="h-4 w-4" />}>Copiar link</Button>
        )}
      </div>

      {aEnviar && (
        <Dialog open onClose={() => setAEnviar(false)} className="max-w-md">
          <h2 className="text-lg font-semibold text-navy-800">
            {etapa === 'ADM-006' ? 'Enviar checklist ao candidato' : 'Reenviar o link'}
          </h2>
          <p className="mt-2 text-sm text-navy-500">
            {etapa === 'ADM-006'
              ? 'O candidato recebe um email com o link para entregar estes documentos. Esta etapa fica concluída.'
              : 'O mesmo link volta a ser enviado. O processo não muda de etapa.'}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAEnviar(false)}>Voltar</Button>
            <Button variant="primary" loading={ocupado} onClick={enviar}>Enviar</Button>
          </div>
        </Dialog>
      )}

      {aRejeitar && (
        <Dialog open onClose={() => setARejeitar(null)} className="max-w-md">
          <h2 className="text-lg font-semibold text-navy-800">Rejeitar {aRejeitar.nome}</h2>
          <p className="mt-2 text-sm text-navy-500">O candidato vê este motivo no link e pode substituir o ficheiro.</p>
          <Textarea className="mt-3" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da rejeição" />
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setARejeitar(null)}>Voltar</Button>
            <Button
              variant="primary"
              loading={ocupado}
              onClick={() => {
                if (!motivo.trim()) {
                  toast.error('Indique o motivo da rejeição');
                  return;
                }
                avaliar(aRejeitar, 'rejeitado', motivo.trim());
              }}
            >
              Rejeitar
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
