import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, ArrowRight, GraduationCap, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { EmptyState } from '@/src/components/ui/card';
import { Badge, ProgressBar, Avatar } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { mentorPortalService, type MentoradoRow } from '@/src/services/mentoria.service';
import { exportarMentoradosExcel } from '@/src/lib/excel-mentoria';

const CATEGORIA_OPTIONS = [
  { value: 'gestao', label: 'Direção / Gestão' },
  { value: 'tecnicos', label: 'Coord. / Técnicos' },
];

const ESTADO_OPTIONS = [
  { value: 'em_curso', label: 'Em curso' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'nao_iniciado', label: 'Não iniciado' },
];

function pct(row: MentoradoRow): number {
  const total = Number(row.etapas_total) || 0;
  const feitas = Number(row.etapas_concluidas) || 0;
  return total > 0 ? Math.round((feitas / total) * 100) : 0;
}

function estadoBadge(estado: string): { label: string; variant: 'success' | 'info' | 'neutral' } {
  if (estado === 'concluido') return { label: 'Concluído', variant: 'success' };
  if (estado === 'em_curso') return { label: 'Em curso', variant: 'info' };
  return { label: 'Não iniciado', variant: 'neutral' };
}

export default function MeusMentorados() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MentoradoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('');

  useEffect(() => {
    mentorPortalService
      .mentorados()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoria && r.categoria !== categoria) return false;
      if (estado && r.estado_onboarding !== estado) return false;
      if (!q) return true;
      return (
        r.nome.toLowerCase().includes(q) ||
        r.funcao.toLowerCase().includes(q) ||
        r.direccao.toLowerCase().includes(q)
      );
    });
  }, [rows, busca, categoria, estado]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={staggerItem} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Meus Mentorados</h1>
          <p className="mt-1 text-sm text-navy-500">
            {rows.length} atribuído(s) · {filtrados.length} a mostrar
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar por nome, função, direcção..."
              className="pl-9 sm:w-64"
            />
          </div>
          <Select
            options={CATEGORIA_OPTIONS}
            placeholder="Todas categorias"
            value={categoria}
            onChange={setCategoria}
            className="sm:w-48"
          />
          <Select
            options={ESTADO_OPTIONS}
            placeholder="Todos estados"
            value={estado}
            onChange={setEstado}
            className="sm:w-40"
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportarMentoradosExcel(filtrados)}
            disabled={filtrados.length === 0}
          >
            Excel
          </Button>
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        {loading ? (
          <SkeletonList rows={6} cols={4} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={rows.length === 0 ? 'Sem mentorados atribuídos' : 'Sem resultados'}
            description={
              rows.length === 0
                ? 'Assim que a DPC te atribuir mentorados, aparecem aqui com o respectivo trilho.'
                : 'Tenta ajustar os filtros ou a pesquisa.'
            }
          />
        ) : (
          <div className="space-y-2">
            {filtrados.map((r) => {
              const est = estadoBadge(r.estado_onboarding);
              const p = pct(r);
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(`/mentor/mentorados/${r.id}`)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 text-left transition hover:shadow-card hover:border-navy-200"
                >
                  <Avatar name={r.nome} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy-800">{r.nome}</p>
                    <p className="truncate text-xs text-navy-500">
                      {r.funcao} — {r.direccao}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {r.categoria && (
                        <Badge variant="accent" size="sm">
                          {r.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos'}
                        </Badge>
                      )}
                      <Badge variant={est.variant} size="sm">{est.label}</Badge>
                      <Badge variant={r.welcome_completed ? 'success' : 'warning'} size="sm">
                        {r.welcome_completed ? 'Welcome OK' : 'Welcome pendente'}
                      </Badge>
                    </div>
                  </div>

                  <div className="hidden w-40 sm:block">
                    <ProgressBar value={p} size="sm" />
                    <p className="mt-1 text-xs text-navy-400 text-right tabular-nums">
                      {Number(r.etapas_concluidas) || 0} / {Number(r.etapas_total) || 0} · {p}%
                    </p>
                  </div>

                  <div className="hidden text-xs text-navy-400 md:block">
                    <p>Admissão</p>
                    <p className="font-medium text-navy-700">
                      {new Date(r.data_admissao).toLocaleDateString('pt-AO')}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 text-navy-300 transition-colors group-hover:text-navy-600" />
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {!loading && rows.length > 0 && (
        <motion.div
          variants={staggerItem}
          className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-25 px-4 py-3"
        >
          <GraduationCap className="h-4 w-4 text-navy-500" />
          <p className="text-xs text-navy-500">
            Clica num mentorado para ver o trilho, checklist, comentários e submeter avaliações.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
