import { useState, useEffect } from 'react';
import { Search, FileText, Download, User, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { PermissionGate } from '@/src/components/auth/PermissionGate';
import { toast } from '@/src/store';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';

const ACCAO_CONFIG: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'accent' }> = {
  criar: { label: 'Criação', variant: 'success' },
  editar: { label: 'Edição', variant: 'info' },
  cancelar: { label: 'Cancelamento', variant: 'error' },
  mover: { label: 'Movimentação', variant: 'accent' },
  publicar: { label: 'Publicação', variant: 'success' },
  arquivar: { label: 'Arquivo', variant: 'neutral' },
  login: { label: 'Login', variant: 'info' },
  logout: { label: 'Logout', variant: 'neutral' },
  concluir: { label: 'Conclusão', variant: 'success' },
};

const ACCAO_OPTIONS = Object.entries(ACCAO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

const ENTIDADE_OPTIONS = [
  { value: 'vaga', label: 'Vaga' },
  { value: 'candidato', label: 'Candidato' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'trilho', label: 'Trilho' },
  { value: 'faq', label: 'FAQ' },
  { value: 'sessao', label: 'Sessão' },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ accao: '', entidade: '', search: '' });

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setLogs([]);
      setLoading(false);
    }, 300);
  }, []);

  const filtered = logs.filter((log) => {
    if (filters.accao && log.accao !== filters.accao) return false;
    if (filters.entidade && log.entidade !== filters.entidade) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return log.utilizador_nome.toLowerCase().includes(q) || log.entidade_id.toLowerCase().includes(q) || log.accao.includes(q);
    }
    return true;
  });

  function handleExportCSV() {
    const header = 'Timestamp,Utilizador,Acção,Entidade,ID Entidade,Detalhes\n';
    const rows = filtered.map((log) =>
      `${log.timestamp},"${log.utilizador_nome}",${log.accao},${log.entidade},${log.entidade_id},"${log.detalhes ?? ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exportação concluída', 'O ficheiro CSV foi descarregado.');
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Audit Log</h1>
          <p className="text-navy-400 text-sm mt-1">Registo de todas as acções realizadas na plataforma</p>
        </div>
        <PermissionGate resource="audit_log" action="view">
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleExportCSV}>
            Exportar CSV
          </Button>
        </PermissionGate>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <Input
            placeholder="Pesquisar por utilizador ou ID..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          options={ACCAO_OPTIONS}
          placeholder="Todas as acções"
          value={filters.accao}
          onChange={(v) => setFilters((f) => ({ ...f, accao: v }))}
          className="w-full sm:w-40"
        />
        <Select
          options={ENTIDADE_OPTIONS}
          placeholder="Todas as entidades"
          value={filters.entidade}
          onChange={(v) => setFilters((f) => ({ ...f, entidade: v }))}
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
            icon={<FileText className="w-8 h-8" />}
            title="Sem registos"
            description="Não existem registos de auditoria com os filtros seleccionados."
          />
        ) : (
          <div className="bg-white border border-navy-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-25">
                    <th className="text-left px-4 py-3 font-medium text-navy-500">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-medium text-navy-500">Utilizador</th>
                    <th className="text-left px-4 py-3 font-medium text-navy-500">Acção</th>
                    <th className="text-left px-4 py-3 font-medium text-navy-500">Entidade</th>
                    <th className="text-left px-4 py-3 font-medium text-navy-500">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const config = ACCAO_CONFIG[log.accao] ?? { label: log.accao, variant: 'neutral' as const };
                    return (
                      <tr key={log.id} className="border-b border-navy-50 hover:bg-navy-25 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-navy-500">
                            <Clock className="w-3.5 h-3.5 text-navy-300" />
                            <span className="text-xs font-mono">
                              {new Date(log.timestamp).toLocaleDateString('pt-AO')}{' '}
                              {new Date(log.timestamp).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-navy-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-navy-500" />
                            </div>
                            <span className="text-navy-700 font-medium">{log.utilizador_nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={config.variant} size="sm">{config.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-navy-600">{log.entidade}</span>
                          <span className="text-navy-300 text-xs ml-1 font-mono">#{log.entidade_id.slice(0, 6)}</span>
                        </td>
                        <td className="px-4 py-3 text-navy-500 max-w-[250px] truncate">
                          {log.detalhes ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-navy-100 bg-navy-25 text-xs text-navy-400">
              {filtered.length} registo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

interface AuditLogEntry {
  id: string;
  utilizador_id: string;
  utilizador_nome: string;
  accao: string;
  entidade: string;
  entidade_id: string;
  timestamp: string;
  detalhes: string | null;
}

