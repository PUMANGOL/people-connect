import { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle, Clock, AlertTriangle, MessageSquare, Eye, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select, Textarea } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { StatCard, EmptyState } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { PermissionGate } from '@/src/components/auth/PermissionGate';
import { toast } from '@/src/store';
import { escalacoesService, type EscalacaoApi } from '@/src/services/escalacoes.service';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';

type EstadoEscalacao = 'pendente' | 'em_analise' | 'respondida' | 'adicionada_kb';

interface Escalacao {
  id: string;
  pergunta: string;
  estado_escalacao: EstadoEscalacao;
  resposta_dpc: string | null;
  respondido_por: string | null;
  respondido_em: string | null;
  timestamp: string;
  utilizador_nome?: string | null;
  resposta?: string | null;
}

function mapApi(e: EscalacaoApi): Escalacao {
  const estado = (e.estado || 'pendente') as EstadoEscalacao;
  return {
    id: e.id,
    pergunta: e.pergunta,
    estado_escalacao: estado === 'adicionada_kb' ? 'respondida' : estado,
    resposta_dpc: e.resposta_dpc,
    respondido_por: null,
    respondido_em: e.respondida_em,
    timestamp: e.criado_em,
    utilizador_nome: e.utilizador_nome,
  };
}

const ESTADO_CONFIG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  em_analise: { label: 'Em Análise', variant: 'info' },
  respondida: { label: 'Respondida', variant: 'success' },
  adicionada_kb: { label: 'Na KB', variant: 'success' },
};

export default function EscalacoesPage() {
  const [escalacoes, setEscalacoes] = useState<Escalacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', search: '' });
  const [selectedEscalacao, setSelectedEscalacao] = useState<Escalacao | null>(null);
  const [respostaText, setRespostaText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await escalacoesService.list();
      setEscalacoes(rows.map(mapApi));
    } catch {
      setEscalacoes([]);
      toast.error('Erro', 'Não foi possível carregar escalações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = escalacoes.filter((e) => {
    if (filters.estado && e.estado_escalacao !== filters.estado) return false;
    if (filters.search && !e.pergunta.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const pendentes = escalacoes.filter((e) => e.estado_escalacao === 'pendente').length;
  const emAnalise = escalacoes.filter((e) => e.estado_escalacao === 'em_analise').length;
  const respondidas = escalacoes.filter((e) => e.estado_escalacao === 'respondida').length;

  async function handleResponder() {
    if (!selectedEscalacao || !respostaText.trim()) return;
    try {
      await escalacoesService.update(selectedEscalacao.id, {
        estado: 'respondida',
        resposta_dpc: respostaText,
      });
      toast.success('Escalação respondida', 'A resposta foi registada.');
      setSelectedEscalacao(null);
      setRespostaText('');
      await load();
    } catch {
      toast.error('Erro', 'Não foi possível gravar a resposta.');
    }
  }

  async function handleMarcarEmAnalise(esc: Escalacao) {
    try {
      await escalacoesService.update(esc.id, { estado: 'em_analise' });
      await load();
    } catch {
      toast.error('Erro', 'Não foi possível actualizar o estado.');
    }
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Escalações</h1>
        <p className="text-navy-400 text-sm mt-1">Perguntas que o assistente não conseguiu responder e foram escaladas para a DPC</p>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-warning-50 text-warning-600" title="Pendentes" value={pendentes} />
        <StatCard icon={<Clock className="w-5 h-5" />} iconBg="bg-info-50 text-info-600" title="Em Análise" value={emAnalise} />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} iconBg="bg-success-50 text-success-600" title="Respondidas" value={respondidas} />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <Input
            placeholder="Pesquisar pergunta..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
          placeholder="Todos os estados"
          value={filters.estado}
          onChange={(v) => setFilters((f) => ({ ...f, estado: v }))}
          className="w-full sm:w-44"
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-8 h-8" />}
            title="Sem escalações"
            description="As perguntas que o chatbot não conseguir responder aparecerão aqui para revisão."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((esc) => {
              const config = ESTADO_CONFIG[esc.estado_escalacao];
              return (
                <div key={esc.id} className="bg-white border border-navy-100 rounded-xl p-4 hover:shadow-card transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={config.variant} size="sm" dot>{config.label}</Badge>
                        <span className="text-xs text-navy-300">
                          {new Date(esc.timestamp).toLocaleDateString('pt-AO')} — {new Date(esc.timestamp).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-medium text-navy-800 text-sm">{esc.pergunta}</p>
                      {esc.utilizador_nome && (
                        <p className="text-xs text-navy-400 mt-1">De: {esc.utilizador_nome}</p>
                      )}
                      {esc.resposta_dpc && (
                        <div className="mt-2 bg-success-50 border border-success-100 rounded-lg px-3 py-2">
                          <p className="text-xs text-success-700">
                            <strong>Resposta DPC:</strong> {esc.resposta_dpc}
                          </p>
                          <p className="text-[10px] text-success-500 mt-1">
                            Por {esc.respondido_por} — {esc.respondido_em && new Date(esc.respondido_em).toLocaleDateString('pt-AO')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {esc.estado_escalacao === 'pendente' && (
                        <PermissionGate resource="assistente.escalacoes" action="edit">
                          <Button variant="ghost" size="sm" onClick={() => handleMarcarEmAnalise(esc)}>
                            <Eye className="w-4 h-4 mr-1" /> Analisar
                          </Button>
                        </PermissionGate>
                      )}
                      {esc.estado_escalacao !== 'respondida' && (
                        <PermissionGate resource="assistente.escalacoes" action="edit">
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => { setSelectedEscalacao(esc); setRespostaText(''); }}
                          >
                            <ArrowRight className="w-4 h-4 mr-1" /> Responder
                          </Button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {selectedEscalacao && (
        <Dialog open onClose={() => setSelectedEscalacao(null)} className="max-w-lg">
          <h2 className="text-lg font-semibold text-navy-800 mb-1">Responder à Escalação</h2>
          <div className="bg-navy-25 rounded-lg p-3 mb-4">
            <p className="text-xs text-navy-400 mb-1">Pergunta do utilizador:</p>
            <p className="text-sm font-medium text-navy-700">{selectedEscalacao.pergunta}</p>
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-navy-700 mb-1.5 block">Resposta oficial da DPC</label>
            <Textarea
              value={respostaText}
              onChange={(e) => setRespostaText(e.target.value)}
              placeholder="Escreva a resposta oficial..."
              rows={4}
            />
            <p className="text-xs text-navy-400 mt-1">Esta resposta pode ser adicionada à base de conhecimento.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSelectedEscalacao(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleResponder} disabled={!respostaText.trim()}>
              <Mail className="w-4 h-4 mr-1" /> Enviar Resposta
            </Button>
          </div>
        </Dialog>
      )}
    </motion.div>
  );
}
