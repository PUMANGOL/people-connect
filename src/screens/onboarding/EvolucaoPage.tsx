import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatCard, EmptyState } from '@/src/components/ui/card';
import { Badge, ProgressBar, Avatar } from '@/src/components/ui/badge';
import { Select } from '@/src/components/ui/input';
import { colaboradoresService, type ColaboradorRow } from '@/src/services/onboarding-v2.service';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { SkeletonStatCard, SkeletonList } from '@/src/components/ui/skeleton';

function pct(row: ColaboradorRow): number {
  const total = Number(row.etapas_total) || 0;
  const feitas = Number(row.etapas_concluidas) || 0;
  return total > 0 ? Math.round((feitas / total) * 100) : 0;
}

export default function EvolucaoPage() {
  const navigate = useNavigate();
  const { categoriaOptions } = useCatalogo();
  const [rows, setRows] = useState<ColaboradorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    colaboradoresService.list().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(
    () => (categoria ? rows.filter((r) => r.categoria === categoria) : rows),
    [rows, categoria]
  );

  const ranking = useMemo(() => [...filtrados].sort((a, b) => pct(b) - pct(a)), [filtrados]);

  const total = filtrados.length;
  const progressoMedio = total > 0 ? Math.round(filtrados.reduce((s, r) => s + pct(r), 0) / total) : 0;
  const welcomeCompletos = filtrados.filter((r) => r.welcome_completed).length;
  const atrasados = filtrados.filter((r) => pct(r) < 40 && r.estado_onboarding !== 'concluido').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonList rows={6} cols={4} />
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Dashboard de Evolução</h1>
          <p className="mt-1 text-sm text-navy-400">Acompanhamento do onboarding dos novos colaboradores.</p>
        </div>
        <Select options={categoriaOptions} placeholder="Todas as categorias" value={categoria} onChange={setCategoria} className="w-full sm:w-56" />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} title="Em Onboarding" value={total} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} title="Progresso Médio" value={`${progressoMedio}%`} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} title="Welcome Concluído" value={`${welcomeCompletos}/${total}`} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} title="Em Atraso" value={atrasados} />
      </motion.div>

      <motion.div variants={staggerItem}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">Ranking de Progresso</h2>
        {ranking.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="Sem colaboradores" description="Ainda não há colaboradores em onboarding." />
        ) : (
          <div className="space-y-2">
            {ranking.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/onboarding/colaborador/${r.id}`)}
                className="flex w-full items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 text-left transition hover:shadow-card"
              >
                <Avatar name={r.nome} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">{r.nome}</p>
                  <p className="truncate text-xs text-navy-400">{r.funcao} — {r.direccao}</p>
                </div>
                <div className="w-32">
                  <ProgressBar value={pct(r)} size="sm" />
                  <p className="mt-1 text-xs text-navy-400">{pct(r)}%</p>
                </div>
                <Badge variant={r.welcome_completed ? 'success' : 'neutral'} size="sm">
                  {r.welcome_completed ? 'Welcome OK' : 'Welcome pendente'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
