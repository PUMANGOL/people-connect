import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardEdit, Plus, CheckCircle2, Clock, FileEdit, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/src/components/ui/button';
import { Badge, Avatar } from '@/src/components/ui/badge';
import { Card, EmptyState } from '@/src/components/ui/card';
import { Select } from '@/src/components/ui/input';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { mentorAvaliacoesService } from '@/src/services/mentoria.service';
import { MOMENTOS_AVALIACAO } from '@/lib/avaliacao-schemas';
import type { MentorAvaliacao, EstadoAvaliacao } from '@/lib/types';

const ESTADO_OPTIONS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'submetida', label: 'Submetida' },
  { value: 'validada', label: 'Validada' },
];

const MOMENTO_OPTIONS = MOMENTOS_AVALIACAO.map((m) => ({ value: m.value, label: m.label }));

function estadoInfo(estado: EstadoAvaliacao): {
  label: string;
  variant: 'success' | 'info' | 'warning' | 'neutral';
  icon: typeof CheckCircle2;
} {
  switch (estado) {
    case 'validada':
      return { label: 'Validada', variant: 'success', icon: CheckCircle2 };
    case 'submetida':
      return { label: 'Submetida', variant: 'info', icon: Clock };
    default:
      return { label: 'Rascunho', variant: 'warning', icon: FileEdit };
  }
}

function momentoLabel(m: string): string {
  return MOMENTOS_AVALIACAO.find((x) => x.value === m)?.label ?? m;
}

export default function AvaliacoesMentor() {
  const [rows, setRows] = useState<MentorAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [momento, setMomento] = useState('');

  useEffect(() => {
    // Portal do mentor: só as avaliações do próprio, mesmo quando é um admin.
    mentorAvaliacoesService
      .list(true)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (estado && r.estado !== estado) return false;
      if (momento && r.momento !== momento) return false;
      return true;
    });
  }, [rows, estado, momento]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Avaliações do Mentor</h1>
          <p className="mt-1 text-sm text-navy-500">
            Formulários oficiais Pumangol · Dia 15/30/60/90 e Final.
          </p>
        </div>
        <Link to="/mentor/avaliacoes/nova">
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            Nova avaliação
          </Button>
        </Link>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-white px-4 py-3"
      >
        <Filter className="h-4 w-4 text-navy-400" />
        <Select
          options={MOMENTO_OPTIONS}
          value={momento}
          onChange={setMomento}
          placeholder="Todos os momentos"
          className="w-full sm:w-44"
        />
        <Select
          options={ESTADO_OPTIONS}
          value={estado}
          onChange={setEstado}
          placeholder="Todos os estados"
          className="w-full sm:w-44"
        />
        {(estado || momento) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEstado('');
              setMomento('');
            }}
          >
            Limpar
          </Button>
        )}
        <span className="ml-auto text-xs text-navy-400">
          {filtradas.length} de {rows.length}
        </span>
      </motion.div>

      {loading ? (
        <SkeletonList rows={5} cols={4} />
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<ClipboardEdit className="h-8 w-8" />}
          title={rows.length === 0 ? 'Sem avaliações' : 'Sem resultados'}
          description={
            rows.length === 0
              ? 'Cria a primeira avaliação a partir do detalhe de um mentorado ou clicando em "Nova avaliação".'
              : 'Ajusta os filtros para veres mais registos.'
          }
        />
      ) : (
        <motion.div variants={staggerItem} className="space-y-2">
          {filtradas.map((av) => {
            const info = estadoInfo(av.estado);
            const Icon = info.icon;
            return (
              <Link
                key={av.id}
                to={`/mentor/avaliacoes/${av.id}`}
                className="group flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 transition hover:shadow-card hover:border-navy-200"
              >
                <Avatar name={av.colaborador_nome ?? '—'} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">
                    {av.colaborador_nome ?? 'Sem colaborador'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-navy-500">
                    <Badge variant="accent" size="sm">
                      {av.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos'}
                    </Badge>
                    <Badge variant="neutral" size="sm">{momentoLabel(av.momento)}</Badge>
                    {av.periodo_inicio && av.periodo_fim && (
                      <span>
                        {new Date(av.periodo_inicio).toLocaleDateString('pt-AO')} —{' '}
                        {new Date(av.periodo_fim).toLocaleDateString('pt-AO')}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={info.variant} size="md">
                  <Icon className="h-3 w-3" />
                  {info.label}
                </Badge>
              </Link>
            );
          })}
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <Card className="bg-gradient-to-r from-navy-25 to-white">
          <div className="flex items-start gap-3">
            <ClipboardEdit className="h-5 w-5 text-navy-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-navy-800">Sobre os formulários</p>
              <p className="mt-1 text-xs text-navy-500">
                Os formulários seguem o modelo oficial Pumangol — 10 critérios com escala de 1 a 5
                ou N/A, comentários por critério, plano de acção e classificação global.
                O rascunho é guardado automaticamente; só ao <em>submeter</em> fica visível para a DPC.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
