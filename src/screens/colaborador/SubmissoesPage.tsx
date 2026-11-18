import { useEffect, useState } from 'react';
import { ClipboardCheck, CheckCircle2, Download, Info, Upload } from 'lucide-react';
import { Badge, ProgressBar } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { toast } from '@/src/store';
import { enviarFicheiro, REGRAS_FICHEIRO, validarFicheiro } from '@/src/services/ficheiros.service';
import { submissoesService, type SubmissaoItem } from '@/src/services/onboarding-v2.service';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { cn } from '@/lib/utils';

export default function SubmissoesPage() {
  const [itens, setItens] = useState<SubmissaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function carregar() {
    submissoesService
      .minhas()
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function toggle(item: SubmissaoItem) {
    setBusyId(item.documento_exigido_id);
    try {
      if (item.estado === 'pendente') {
        await submissoesService.confirmar(item.documento_exigido_id);
        toast.success('Confirmação registada', `"${item.nome}" marcado como submetido.`);
      } else if (item.submissao_id) {
        await submissoesService.desmarcar(item.submissao_id);
        toast.success('Confirmação removida', `"${item.nome}" volta a pendente.`);
      }
      carregar();
    } catch {
      toast.error('Erro', 'Não foi possível actualizar a confirmação.');
    } finally {
      setBusyId(null);
    }
  }

  async function carregarFicheiro(item: SubmissaoItem, ficheiro: File) {
    const invalido = validarFicheiro('submissao', ficheiro);
    if (invalido) {
      toast.error('Ficheiro não aceite', invalido);
      return;
    }
    setBusyId(item.documento_exigido_id);
    try {
      const enviado = await enviarFicheiro(ficheiro, { finalidade: 'submissao' });
      await submissoesService.confirmar(item.documento_exigido_id, { ficheiro_id: enviado.id, nome: ficheiro.name });
      toast.success('Ficheiro enviado', `"${item.nome}" ficou registado.`);
      carregar();
    } catch {
      toast.error('Erro', 'Não foi possível enviar o ficheiro.');
    } finally {
      setBusyId(null);
    }
  }

  const confirmados = itens.filter((i) => i.estado !== 'pendente').length;
  const pct = itens.length > 0 ? Math.round((confirmados / itens.length) * 100) : 0;
  const obrigatoriosPendentes = itens.filter((i) => i.obrigatorio && i.estado === 'pendente').length;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-navy-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Submissão de Documentos</h1>
        <p className="mt-1 text-sm text-navy-500">
          Confirma a entrega e, se quiseres, carrega o ficheiro de cada documento pedido.
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="rounded-xl border border-info-100 bg-info-50 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-info-700 leading-relaxed">
          <strong>Como funciona:</strong> marca a caixa quando já entregaste o documento, ou usa <em>Carregar</em> para
          enviar o ficheiro daqui. PDF, imagem, Word ou Excel até 15 MB.
        </div>
      </motion.div>

      {itens.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title="Nenhum documento pendente"
          description="A DPC ainda não definiu documentos exigidos, ou a tua conta não está associada a um registo de colaborador."
        />
      ) : (
        <>
          <motion.div variants={staggerItem} className="rounded-2xl border border-navy-100 bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-navy-700">{confirmados} de {itens.length} documentos confirmados</span>
              <span className="text-navy-500 tabular-nums">{pct}%</span>
            </div>
            <ProgressBar value={pct} size="md" />
            {obrigatoriosPendentes > 0 && (
              <p className="mt-3 text-xs text-warning-700">
                Ainda faltam <strong>{obrigatoriosPendentes}</strong> documento(s) obrigatório(s).
              </p>
            )}
          </motion.div>

          <motion.div variants={staggerItem} className="space-y-2">
            {itens.map((item) => {
              const confirmado = item.estado !== 'pendente';
              const busy = busyId === item.documento_exigido_id;
              const entrada = `ficheiro-${item.documento_exigido_id}`;
              return (
                <div
                  key={item.documento_exigido_id}
                  className={cn(
                    'flex items-start gap-4 rounded-2xl border p-4',
                    confirmado ? 'border-success-200 bg-success-50/50' : 'border-navy-100 bg-white',
                    busy && 'opacity-60',
                  )}
                >
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={confirmado}
                    onClick={() => toggle(item)}
                    className={cn(
                      'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all mt-0.5',
                      confirmado
                        ? 'border-success-600 bg-success-600 text-white scale-105'
                        : 'border-navy-300 bg-white',
                    )}
                  >
                    {confirmado && <CheckCircle2 className="w-4 h-4" strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn('font-medium', confirmado ? 'text-success-700' : 'text-navy-800')}>
                      {item.nome}
                      {item.obrigatorio && <span className="ml-1 text-error-500">*</span>}
                    </p>
                    {item.descricao && <p className="mt-0.5 text-xs text-navy-500">{item.descricao}</p>}
                    {item.ficheiro_nome && (
                      <p className="mt-1 text-xs text-navy-600">
                        Ficheiro: {item.ficheiro_nome}
                        {item.ficheiro_ref && (
                          <a
                            href={`/api/ficheiros?key=${encodeURIComponent(item.ficheiro_ref)}&descarregar=1`}
                            className="ml-2 inline-flex items-center gap-1 font-medium text-navy-800 underline"
                          >
                            <Download className="h-3 w-3" /> Descarregar
                          </a>
                        )}
                      </p>
                    )}
                    {confirmado && item.submetido_em && (
                      <p className="mt-1 text-xs text-success-600">
                        Confirmado em {new Date(item.submetido_em).toLocaleDateString('pt-AO')}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={confirmado ? 'success' : 'neutral'} size="sm">
                      {confirmado ? 'Confirmado' : 'Pendente'}
                    </Badge>
                    <input
                      id={entrada}
                      type="file"
                      className="sr-only"
                      accept={REGRAS_FICHEIRO.submissao.aceitar}
                      disabled={busy}
                      onChange={(e) => {
                        const ficheiro = e.target.files?.[0];
                        e.target.value = '';
                        if (ficheiro) void carregarFicheiro(item, ficheiro);
                      }}
                    />
                    <label
                      htmlFor={entrada}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-300 hover:bg-navy-50',
                        busy && 'pointer-events-none',
                      )}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {busy ? 'A enviar…' : 'Carregar'}
                    </label>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
