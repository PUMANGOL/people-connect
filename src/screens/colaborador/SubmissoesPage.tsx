import { useEffect, useState } from 'react';
import { ClipboardCheck, CheckCircle2, Info } from 'lucide-react';
import { Badge, ProgressBar } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { toast } from '@/src/store';
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
          Marca a caixa dos documentos que já entregaste à DPC (por email ou fisicamente).
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="rounded-xl border border-info-100 bg-info-50 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-info-700 leading-relaxed">
          <strong>Como funciona:</strong> aqui apenas <em>confirmas</em> a entrega. Os documentos continuam a ser enviados
          pelos canais habituais (email para <strong>dpc@pumangol.ao</strong> ou entrega directa à DPC).
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
              return (
                <button
                  key={item.documento_exigido_id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(item)}
                  className={cn(
                    'w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition-all',
                    'hover:border-navy-300 hover:shadow-sm',
                    confirmado ? 'border-success-200 bg-success-50/50' : 'border-navy-100 bg-white',
                    busy && 'opacity-60 cursor-wait',
                  )}
                >
                  {/* Checkbox visual */}
                  <div
                    className={cn(
                      'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all mt-0.5',
                      confirmado
                        ? 'border-success-600 bg-success-600 text-white scale-105'
                        : 'border-navy-300 bg-white',
                    )}
                  >
                    {confirmado && <CheckCircle2 className="w-4 h-4" strokeWidth={3} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'font-medium',
                      confirmado ? 'text-success-700' : 'text-navy-800',
                    )}>
                      {item.nome}
                      {item.obrigatorio && <span className="ml-1 text-error-500">*</span>}
                    </p>
                    {item.descricao && (
                      <p className="text-xs text-navy-500 mt-0.5">{item.descricao}</p>
                    )}
                    {confirmado && item.submetido_em && (
                      <p className="text-xs text-success-600 mt-1">
                        Confirmado em {new Date(item.submetido_em).toLocaleDateString('pt-AO')}
                      </p>
                    )}
                  </div>

                  <Badge variant={confirmado ? 'success' : 'neutral'} size="sm">
                    {confirmado ? 'Confirmado' : 'Pendente'}
                  </Badge>
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
