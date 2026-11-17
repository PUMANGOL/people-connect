import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, BookOpen, MessageSquare, GraduationCap, Settings, Layers, Bot, Sparkles, TrendingUp, Lock } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { EmptyState } from '@/src/components/ui/card';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { colaboradoresService, type MeuTrilho, type EtapaProgresso } from '@/src/services/onboarding-v2.service';
import type { EtapaAnexo } from '@/src/services/anexos.service';
import { DocumentosEtapa, documentosEmFalta } from '@/src/components/onboarding/DocumentosEtapa';
import { erroPedido } from '@/src/lib/erro-pedido';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { formatarData } from '@/src/lib/datas';

const TIPO_ICONS: Record<string, typeof BookOpen> = {
  documental: BookOpen,
  conversacional: MessageSquare,
  formacao: GraduationCap,
  administrativo: Settings,
  misto: Layers,
};

const ESTADO_CFG: Record<string, { label: string; bgColor: string; badge: 'success' | 'info' | 'error' | 'neutral' }> = {
  pendente: { label: 'Bloqueada', bgColor: 'bg-navy-100', badge: 'neutral' },
  em_curso: { label: 'Em Curso', bgColor: 'bg-info-100', badge: 'info' },
  concluida: { label: 'Concluída', bgColor: 'bg-success-100', badge: 'success' },
  atrasada: { label: 'Atrasada', bgColor: 'bg-error-100', badge: 'error' },
};

export default function MeuTrilhoPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dados, setDados] = useState<MeuTrilho | null>(null);
  const [loading, setLoading] = useState(true);
  const [completeModal, setCompleteModal] = useState<EtapaProgresso | null>(null);

  const carregar = useCallback(() => {
    colaboradoresService
      .meuTrilho()
      .then(setDados)
      .catch(() => setDados({ colaborador: null, trilho: null, progresso: [] }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(carregar, [carregar]);

  async function handleComplete(prog: EtapaProgresso) {
    setCompleteModal(null);
    try {
      await colaboradoresService.concluirEtapa(prog.id);
      toast.success('Etapa concluída!', 'Estás um passo mais perto de completar o teu onboarding.');
      carregar();
    } catch (e) {
      const { msg, jaNotificado } = erroPedido(e, 'Não foi possível concluir a etapa.');
      if (!jaNotificado) toast.error('Etapa por concluir', msg);
    }
  }

  function actualizarAnexos(progressoId: string, anexos: EtapaAnexo[]) {
    setDados((d) => d && { ...d, progresso: d.progresso.map((p) => (p.id === progressoId ? { ...p, anexos } : p)) });
  }

  function emFalta(prog: EtapaProgresso) {
    return documentosEmFalta(prog.documentos_pedidos ?? [], prog.anexos ?? []);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  const progresso = dados?.progresso ?? [];
  const concluidas = progresso.filter((p) => p.estado === 'concluida').length;
  const pct = progresso.length > 0 ? Math.round((concluidas / progresso.length) * 100) : 0;
  const proxima = progresso.find((p) => p.estado === 'em_curso' || p.estado === 'atrasada');
  const primeiroNome = (dados?.colaborador?.nome ?? user?.nome ?? '').split(' ')[0];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">
      {/* Hero */}
      <motion.div variants={staggerItem} className="rounded-2xl border border-gold-100 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gold-500">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium uppercase tracking-wider text-gold-600">Bem-vind@ à Pumangol</p>
            <h1 className="mt-1 text-2xl font-bold text-navy-800 md:text-3xl">Olá, {primeiroNome}!</h1>
            <p className="mt-2 max-w-2xl text-navy-500">
              Este é o teu trilho de integração. Acompanha as etapas e fala com o assistente virtual sempre que precisares.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gold-100 pt-6 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gold-700">Progresso</p>
            <p className="mt-1 text-3xl font-bold text-navy-800">{pct}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gold-100">
              <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gold-700">Etapas Concluídas</p>
            <p className="mt-1 text-3xl font-bold text-navy-800">{concluidas} <span className="text-lg text-gold-600">/ {progresso.length}</span></p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gold-700">Trilho</p>
            <p className="mt-1 text-lg font-semibold text-navy-800">{dados?.trilho?.nome ?? 'Sem trilho atribuído'}</p>
            <p className="mt-0.5 text-xs text-navy-400">{dados?.colaborador?.funcao}</p>
          </div>
        </div>
      </motion.div>

      {!dados?.trilho || progresso.length === 0 ? (
        <motion.div variants={staggerItem}>
          <EmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title="Ainda sem trilho atribuído"
            description="A DPC vai atribuir-te um trilho de onboarding em breve. Entretanto, podes falar com o Assistente Virtual."
            action={{ label: 'Abrir Assistente', onClick: () => navigate('/assistente') }}
          />
        </motion.div>
      ) : (
        <>
          {proxima && (
            <motion.div variants={staggerItem} className="rounded-xl border border-gold-200 bg-gold-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold-500">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gold-700">Próxima etapa</p>
                  <h3 className="mt-1 text-lg font-semibold text-navy-800">{proxima.etapa_nome}</h3>
                  {proxima.etapa_descricao && <p className="mt-1 text-sm text-navy-600">{proxima.etapa_descricao}</p>}
                  {emFalta(proxima).length > 0 && (
                    <p className="mt-2 text-sm text-gold-800">
                      Anexa {emFalta(proxima).map((d) => d.nome).join(', ')} para concluir esta etapa.
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="accent" size="sm" disabled={emFalta(proxima).length > 0} onClick={() => setCompleteModal(proxima)}>
                      Marcar como concluída
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/assistente')}>
                      <Bot className="mr-1 h-4 w-4" /> Perguntar ao assistente
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Timeline */}
          <motion.div variants={staggerItem} className="rounded-xl border border-navy-100 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-navy-800">Etapas do Trilho</h2>
            <div className="space-y-1">
              {progresso.map((prog, idx) => {
                const cfg = ESTADO_CFG[prog.estado] ?? ESTADO_CFG.pendente;
                const Icon = TIPO_ICONS[prog.etapa_tipo] ?? BookOpen;
                const isLast = idx === progresso.length - 1;
                return (
                  <div key={prog.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bgColor}`}>
                        {prog.estado === 'concluida' ? <CheckCircle className="h-5 w-5 text-success-500" />
                          : prog.estado === 'atrasada' ? <AlertTriangle className="h-5 w-5 text-error-500" />
                          : prog.estado === 'em_curso' ? <Clock className="h-5 w-5 text-info-500" />
                          : <Lock className="h-5 w-5 text-navy-400" />}
                      </div>
                      {!isLast && <div className="my-1 w-px flex-1 bg-navy-100" />}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-navy-400" />
                            <p className="font-medium text-navy-800">{prog.etapa_nome}</p>
                          </div>
                          {prog.etapa_descricao && <p className="mt-0.5 text-xs text-navy-400">{prog.etapa_descricao}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={cfg.badge} size="sm">{cfg.label}</Badge>
                            <span className="text-xs text-navy-300">{prog.duracao_dias} dia{prog.duracao_dias > 1 ? 's' : ''}</span>
                            {(prog.data_inicio || prog.data_prevista) && (
                              <span className="text-xs text-navy-400">
                                {prog.data_inicio ? formatarData(prog.data_inicio) : '—'}
                                {' – '}
                                {prog.data_prevista ? formatarData(prog.data_prevista) : '—'}
                              </span>
                            )}
                            {prog.data_conclusao && (
                              <span className="text-xs text-success-500">Concluída {new Date(prog.data_conclusao).toLocaleDateString('pt-AO')}</span>
                            )}
                          </div>
                        </div>
                        {(prog.estado === 'em_curso' || prog.estado === 'atrasada') && (
                          <Button
                            variant="accent"
                            size="sm"
                            disabled={emFalta(prog).length > 0}
                            title={emFalta(prog).length ? 'Anexa primeiro os documentos obrigatórios' : undefined}
                            onClick={() => setCompleteModal(prog)}
                          >
                            Concluir
                          </Button>
                        )}
                      </div>
                      <DocumentosEtapa
                        progressoId={prog.id}
                        documentos={prog.documentos_pedidos ?? []}
                        anexos={prog.anexos ?? []}
                        editavel={prog.estado === 'em_curso' || prog.estado === 'atrasada'}
                        avisoBloqueado={prog.estado === 'pendente' ? 'Podes anexar quando esta etapa começar.' : undefined}
                        onAnexosChange={(anexos) => actualizarAnexos(prog.id, anexos)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}

      {completeModal && (
        <Dialog open onClose={() => setCompleteModal(null)}>
          <h2 className="mb-2 text-lg font-semibold text-navy-800">Concluir Etapa</h2>
          <p className="mb-4 text-sm text-navy-500">
            Confirmas que já completaste a etapa <strong>"{completeModal.etapa_nome}"</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCompleteModal(null)}>Cancelar</Button>
            <Button variant="accent" onClick={() => handleComplete(completeModal)}>Sim, concluída</Button>
          </div>
        </Dialog>
      )}
    </motion.div>
  );
}
