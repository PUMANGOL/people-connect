import { useState, useMemo, useRef, type ReactNode } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  Users, ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, EmptyState } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Select } from '@/src/components/ui/input';
import { Dialog } from '@/src/components/ui/dialog';
import { normalizeBDRecrutamentoRows } from '@/src/lib/recrutamento-semanal-import';
import { normalizeCandidatosRows } from '@/src/lib/candidatos-import';
import { parseAllSheets, findSheetName, type ParsedWorkbook } from '@/src/lib/excel-import';
import { validateExcelFile } from '@/lib/validators';
import { useRecrutamentoSemanalStore } from '@/src/store/recrutamento-semanal.store';
import { toast } from '@/src/store';
import type { RegistoSemanal } from '@/lib/types';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { useNavigate } from 'react-router-dom';

const SHEET_BD = 'BD_Recrutamento';
const SHEET_CANDIDATOS = 'Candidatos';

const ACTIVOS: RegistoSemanal['status'][] = ['Em Curso', 'Em Atraso'];

const PRIORIDADE_COLOR: Record<RegistoSemanal['prioridade'], string> = {
  Alta: '#D15B5B',
  Média: '#F5C518',
  Baixa: '#9CA3AF',
};

const STATUS_TONE: Record<RegistoSemanal['status'], { bg: string; text: string; dot: string }> = {
  'Fechado':   { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' },
  'Em Curso':  { bg: 'bg-info-50',    text: 'text-info-700',    dot: 'bg-info-500' },
  'Em Atraso': { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' },
  'Cancelado': { bg: 'bg-navy-50',    text: 'text-navy-600',    dot: 'bg-navy-400' },
};

const KPI_BORDER: Record<string, string> = {
  primary: 'border-t-navy-700',
  success: 'border-t-gold-500',
  info: 'border-t-navy-500',
  danger: 'border-t-error-500',
  warning: 'border-t-warning-500',
  accent: 'border-t-success-500',
};

export default function DashboardSemanalPage() {
  const navigate = useNavigate();
  const { registos, candidatos, importadoEm, setRegistos, setCandidatos } = useRecrutamentoSemanalStore();
  const [showImportModal, setShowImportModal] = useState(false);
  const [filtroDireccao, setFiltroDireccao] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // === KPIs ===
  const kpis = useMemo(() => {
    const total = registos.length;
    const fechadas = registos.filter((r) => r.status === 'Fechado').length;
    const activas = registos.filter((r) => ACTIVOS.includes(r.status)).length;
    const criticas = registos.filter((r) => r.critica).length;
    const naoOrcamentadas = registos.filter((r) => (r.tipo_vaga ?? '').toLowerCase().includes('não orça') || (r.orcamento ?? '').toLowerCase().includes('não')).length;
    const taxaFecho = total > 0 ? Math.round((fechadas / total) * 100) : 0;
    return { total, fechadas, activas, criticas, naoOrcamentadas, taxaFecho };
  }, [registos]);

  // === Tipos de vaga ===
  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registos) {
      const t = r.tipo_vaga ?? '—';
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [registos]);

  // === Status distribution ===
  const porStatus = useMemo(() => {
    const map = new Map<RegistoSemanal['status'], number>();
    for (const r of registos) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return (['Fechado', 'Em Curso', 'Em Atraso', 'Cancelado'] as const).map((s) => ({ status: s, count: map.get(s) ?? 0 }));
  }, [registos]);

  // === Aprovações ===
  const aprovacoes = useMemo(() => {
    const isYes = (v: string | null) => (v ?? '').trim().toLowerCase() === 'sim';
    const isNo = (v: string | null) => (v ?? '').trim().toLowerCase() === 'não' || (v ?? '').trim().toLowerCase() === 'nao';
    const upstAprov = registos.filter((r) => isYes(r.aprov_upst)).length;
    const upstPend = registos.filter((r) => isNo(r.aprov_upst)).length;
    const finAprov = registos.filter((r) => isYes(r.aprov_fin)).length;
    const finPend = registos.filter((r) => isNo(r.aprov_fin)).length;
    return { upstAprov, upstPend, finAprov, finPend };
  }, [registos]);

  // === Vagas activas por direcção ===
  const porDireccao = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registos.filter((x) => ACTIVOS.includes(x.status))) {
      map.set(r.direccao, (map.get(r.direccao) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [registos]);
  const maxDireccao = Math.max(...porDireccao.map(([, c]) => c), 1);

  // === Prioridades ===
  const porPrioridade = useMemo(() => {
    const activos = registos.filter((r) => ACTIVOS.includes(r.status));
    const total = activos.length;
    return (['Alta', 'Média', 'Baixa'] as const).map((p) => {
      const count = activos.filter((r) => r.prioridade === p).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { prioridade: p, count, pct };
    });
  }, [registos]);

  // === Vagas críticas ===
  const criticas = useMemo(
    () => registos.filter((r) => r.critica).sort((a, b) => (b.dias_aberto ?? 0) - (a.dias_aberto ?? 0)),
    [registos]
  );

  // === Alertas & Próximos passos ===
  const alertas = useMemo(() => {
    const items: { tone: 'error' | 'warning' | 'info'; text: ReactNode }[] = [];
    if (kpis.criticas > 0) items.push({ tone: 'error', text: <><strong>{kpis.criticas} vagas críticas</strong> com prioridade Alta e sem fecho.</> });
    if (kpis.naoOrcamentadas > 0) items.push({ tone: 'warning', text: <><strong>{kpis.naoOrcamentadas} vagas não orçamentadas</strong> — requerem validação financeira.</> });
    if (aprovacoes.finPend > 0) items.push({ tone: 'warning', text: <><strong>{aprovacoes.finPend} vagas</strong> com aprovação financeira pendente.</> });
    if (aprovacoes.upstPend > 0) items.push({ tone: 'warning', text: <><strong>{aprovacoes.upstPend} vagas</strong> com aprovação UPST pendente.</> });
    items.push({ tone: 'info', text: <>Taxa de fecho do período: <strong>{kpis.taxaFecho}%</strong> — meta é 70%.</> });
    return items;
  }, [kpis, aprovacoes]);

  const proximosPassos = useMemo(() => {
    const passos: string[] = [];
    if (aprovacoes.finPend > 0) passos.push(`Priorizar aprovação financeira das ${aprovacoes.finPend} vagas pendentes.`);
    if (kpis.criticas > 0) passos.push(`Resolver as ${kpis.criticas} vagas críticas com prioridade Alta.`);
    if (kpis.naoOrcamentadas > 0) passos.push(`Regularizar as ${kpis.naoOrcamentadas} vagas não orçamentadas junto da Direcção Financeira.`);
    if (aprovacoes.upstPend > 0) passos.push(`Concluir aprovação UPST para ${aprovacoes.upstPend} vagas em revisão.`);
    return passos;
  }, [aprovacoes, kpis]);

  // === Filtros para tabela detalhada ===
  const direccaoOptions = useMemo(
    () => [...new Set(registos.map((r) => r.direccao))].sort().map((d) => ({ value: d, label: d })),
    [registos]
  );
  const tipoOptions = useMemo(
    () => [...new Set(registos.map((r) => r.tipo_vaga).filter((t): t is string => !!t))].sort().map((t) => ({ value: t, label: t })),
    [registos]
  );

  const registosFiltrados = useMemo(() => {
    return registos.filter((r) =>
      (!filtroDireccao || r.direccao === filtroDireccao) &&
      (!filtroStatus || r.status === filtroStatus) &&
      (!filtroPrioridade || r.prioridade === filtroPrioridade) &&
      (!filtroTipo || r.tipo_vaga === filtroTipo)
    );
  }, [registos, filtroDireccao, filtroStatus, filtroPrioridade, filtroTipo]);

  const grupos = useMemo(() => {
    const map = new Map<string, RegistoSemanal[]>();
    for (const r of registosFiltrados) {
      const list = map.get(r.direccao) ?? [];
      list.push(r);
      map.set(r.direccao, list);
    }
    return [...map.entries()].sort(([, a], [, b]) => b.length - a.length);
  }, [registosFiltrados]);

  const criticasCountByDireccao = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registos.filter((x) => x.critica)) {
      map.set(r.direccao, (map.get(r.direccao) ?? 0) + 1);
    }
    return map;
  }, [registos]);

  async function handleImport(workbook: ParsedWorkbook): Promise<{ criadas: number; ignoradas: number; candidatos: number; erros: string[] }> {
    const erros: string[] = [];

    const bdName = findSheetName(workbook, SHEET_BD);
    if (!bdName) {
      erros.push(`Folha "${SHEET_BD}" não encontrada. Folhas disponíveis: ${workbook.sheetNames.join(', ')}.`);
      return { criadas: 0, ignoradas: 0, candidatos: 0, erros };
    }

    const { registos: novos, ignoradas } = normalizeBDRecrutamentoRows(workbook.sheets[bdName]);
    setRegistos(novos, new Date().toISOString());

    let candidatosCount = 0;
    const candName = findSheetName(workbook, SHEET_CANDIDATOS);
    if (candName) {
      const { candidatos: novosCandidatos, ignoradas: candIgn } = normalizeCandidatosRows(workbook.sheets[candName]);
      setCandidatos(novosCandidatos);
      candidatosCount = novosCandidatos.length;
      if (candIgn > 0) erros.push(`${candIgn} linha(s) da aba "Candidatos" ignoradas (sem nome).`);
    } else {
      setCandidatos([]);
    }

    if (ignoradas > 0) erros.push(`${ignoradas} linha(s) sem "Referência da Vaga" ignoradas.`);
    return { criadas: novos.length, ignoradas, candidatos: candidatosCount, erros };
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-700 tracking-tight uppercase">
            Recrutamento — Painel Executivo
          </h1>
          <p className="text-xs uppercase tracking-[0.15em] text-navy-400 mt-1">
            Dashboard Executivo · Pumangol · People Intelligence
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 text-white text-[11px] font-semibold uppercase tracking-wider px-2 py-1">
              Resumo Geral
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {importadoEm && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs text-navy-600">
              Actualizado em {new Date(importadoEm).toLocaleDateString('pt-AO')}
            </span>
          )}
          <Button
            variant="primary"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setShowImportModal(true)}
          >
            {registos.length > 0 ? 'Actualizar Excel' : 'Importar Excel'}
          </Button>
        </div>
      </motion.div>

      {registos.length === 0 ? (
        <motion.div variants={staggerItem}>
          <EmptyState
            icon={<FileSpreadsheet className="w-8 h-8" />}
            title="Importe um ficheiro Excel para visualizar o dashboard"
            description={`O ficheiro deve conter a folha "${SHEET_BD}". Se incluir também uma folha "${SHEET_CANDIDATOS}", os candidatos ficam automaticamente disponíveis no submódulo Candidatos.`}
            action={{ label: 'Importar Excel', onClick: () => setShowImportModal(true) }}
          />
        </motion.div>
      ) : (
        <>
          {/* Linha de KPIs — 6 cards com borda esquerda colorida */}
          <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard tone="primary" label="Total de Recrutamentos" value={kpis.total} subtitle="Vagas registadas" />
            <KpiCard tone="success" label="Vagas Fechadas" value={kpis.fechadas} subtitle={`${kpis.taxaFecho}% taxa de conversão`} subtitleTone={kpis.taxaFecho >= 70 ? 'success' : 'warning'} subtitleBadge={kpis.taxaFecho < 70 ? 'Abaixo meta' : undefined} />
            <KpiCard tone="info" label="Vagas Activas" value={kpis.activas} subtitle={`${kpis.criticas} críticas`} />
            <KpiCard tone="danger" label="Vagas Críticas" value={kpis.criticas} subtitle="Prioridade Alta" subtitleBadge={kpis.criticas > 0 ? 'Acção imediata' : undefined} subtitleTone="danger" />
            <KpiCard tone="warning" label="Não Orçamentadas" value={kpis.naoOrcamentadas} subtitle={`${kpis.total > 0 ? Math.round((kpis.naoOrcamentadas / kpis.total) * 100) : 0}% do total`} subtitleBadge={kpis.naoOrcamentadas > 0 ? 'Validar' : undefined} subtitleTone="warning" />
            <KpiCard tone="accent" label="Taxa de Fecho" value={`${kpis.taxaFecho}%`} subtitle={`${kpis.fechadas} de ${kpis.total} vagas`} />
          </motion.div>

          {/* Card de Candidatos (aparece após import) */}
          {candidatos.length > 0 && (
            <motion.div variants={staggerItem}>
              <div className="rounded-xl border border-info-100 bg-info-50 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white text-info-600 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-3xl font-bold text-navy-800 leading-none">{candidatos.length}</p>
                  <p className="text-sm font-medium text-info-700 mt-1">Candidatos importados</p>
                  <p className="text-xs text-info-600 mt-0.5">
                    {candidatos.filter((c) => c.estado === 'em_analise').length} em análise ·{' '}
                    {candidatos.filter((c) => c.estado === 'aprovado').length} aprovados ·{' '}
                    {candidatos.filter((c) => c.estado === 'rejeitado').length} rejeitados
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => navigate('/recrutamento/candidatos')}
                >
                  Ver Candidatos
                </Button>
              </div>
            </motion.div>
          )}

          {/* Grid principal — Tipos de Vaga · Funil · Status */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Tipos de Vaga */}
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Tipos de Vaga</CardTitle></CardHeader>
                <CardContent>
                  {porTipo.length === 0 ? (
                    <p className="text-sm text-navy-400">Sem dados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {porTipo.map(([tipo, count]) => {
                        const pct = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0;
                        const color = tipo.toLowerCase().includes('não orça') ? '#D15B5B'
                          : tipo.toLowerCase().includes('substitui') ? '#F5C518'
                          : tipo.toLowerCase().includes('temporária') ? '#9CA3AF'
                          : '#1B6B3A';
                        return (
                          <li key={tipo} className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="flex-1 min-w-0 truncate text-navy-600">{tipo}</span>
                            <span className="tabular-nums font-medium text-navy-800">{count}</span>
                            <span className="tabular-nums text-xs text-navy-400 w-10 text-right">{pct}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Funil do Processo */}
            <motion.div variants={staggerItem} className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Funil do Processo de Recrutamento</CardTitle>
                  <span className="text-xs text-navy-400">Aprov. Financeira = Propostas</span>
                </CardHeader>
                <CardContent>
                  <FunilRow label="Vagas Aprovadas UPST" value={aprovacoes.upstAprov} max={kpis.total} color="bg-success-600" />
                  <FunilRow label="Propostas / Ofertas" value={aprovacoes.finAprov} max={kpis.total} color="bg-success-500" />
                  <FunilRow label="Fechadas / Concluídas" value={kpis.fechadas} max={kpis.total} color="bg-success-400" />
                  <p className="text-xs text-navy-400 mt-4 leading-relaxed">
                    Propostas/Ofertas = vagas com Aprovação Financeira = Sim.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Status do Processo */}
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Status do Processo (Total)</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {porStatus.map(({ status, count }) => (
                      <li key={status} className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_TONE[status].dot}`} />
                        <span className="flex-1 text-sm text-navy-600">{status}</span>
                        <span className="text-lg font-bold text-navy-800 tabular-nums">{count}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Grid secundário — Direcções · Prioridades · Aprovações · Indicadores */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Vagas Activas por Direcção</CardTitle></CardHeader>
                <CardContent>
                  {porDireccao.length === 0 ? (
                    <p className="text-sm text-navy-400">Sem vagas activas.</p>
                  ) : (
                    <div className="space-y-2">
                      {porDireccao.map(([direccao, count]) => (
                        <div key={direccao} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 min-w-0 truncate text-navy-600">{direccao}</span>
                          <div className="w-24 h-4 rounded overflow-hidden bg-navy-50">
                            <div className="h-full bg-success-500" style={{ width: `${(count / maxDireccao) * 100}%` }} />
                          </div>
                          <span className="tabular-nums font-medium text-navy-800 w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Vagas por Prioridade</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {porPrioridade.map(({ prioridade, count, pct }) => (
                      <li key={prioridade} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORIDADE_COLOR[prioridade] }} />
                        <span className="flex-1 text-sm text-navy-600">{prioridade}</span>
                        <span className="tabular-nums text-lg font-bold text-navy-800">{count}</span>
                        <span className="tabular-nums text-xs text-navy-400 w-10 text-right">{pct}%</span>
                      </li>
                    ))}
                  </ul>
                  {porPrioridade.every((p) => p.count === 0) && (
                    <p className="text-xs text-navy-400 mt-2">Vagas activas</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Aprovações</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400 mb-2">Aprovação UPST</p>
                      <div className="grid grid-cols-2 gap-2">
                        <ApprovalTile label="Aprovadas" value={aprovacoes.upstAprov} total={aprovacoes.upstAprov + aprovacoes.upstPend} tone="success" />
                        <ApprovalTile label="Pendentes" value={aprovacoes.upstPend} total={aprovacoes.upstAprov + aprovacoes.upstPend} tone="warning" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400 mb-2">Aprovação Financeira</p>
                      <div className="grid grid-cols-2 gap-2">
                        <ApprovalTile label="Aprovadas" value={aprovacoes.finAprov} total={aprovacoes.finAprov + aprovacoes.finPend} tone="success" />
                        <ApprovalTile label="Pendentes" value={aprovacoes.finPend} total={aprovacoes.finAprov + aprovacoes.finPend} tone="warning" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Indicadores de Desempenho</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-warning-50 p-4 text-center">
                      <p className={`text-3xl font-bold ${kpis.taxaFecho >= 70 ? 'text-success-600' : 'text-error-600'} tabular-nums`}>{kpis.taxaFecho}%</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500 mt-1">Taxa de Conversão</p>
                      <p className="text-xs text-navy-400 mt-1">Meta: 70%</p>
                    </div>
                    <div className="rounded-xl bg-error-50 p-4 text-center">
                      <p className="text-3xl font-bold text-error-600 tabular-nums">{kpis.criticas}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500 mt-1">Vagas Críticas</p>
                      <p className="text-xs text-navy-400 mt-1">Acção imediata</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Alertas · Próximos passos · Vagas Críticas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Alertas e Pontos de Atenção</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {alertas.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                          a.tone === 'error' ? 'bg-error-500' :
                          a.tone === 'warning' ? 'bg-warning-500' :
                          'bg-info-500'
                        }`} />
                        <p className="text-sm text-navy-700 leading-snug">{a.text}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader><CardTitle>Próximos Passos</CardTitle></CardHeader>
                <CardContent>
                  {proximosPassos.length === 0 ? (
                    <p className="text-sm text-navy-400">Nenhuma acção pendente identificada.</p>
                  ) : (
                    <ol className="space-y-3">
                      {proximosPassos.map((passo, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-success-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                          <p className="text-sm text-navy-700 leading-snug">{passo}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Vagas Críticas (Prioridade Alta)</CardTitle>
                  <span className="text-xs text-navy-400">{criticas.length} vagas</span>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto">
                  {criticas.length === 0 ? (
                    <p className="text-sm text-navy-400">Sem vagas críticas.</p>
                  ) : (
                    <ul className="divide-y divide-navy-50 -mx-6">
                      {criticas.slice(0, 12).map((r) => (
                        <li key={r.referencia} className="px-6 py-2 flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-navy-700 truncate">{r.funcao}</p>
                            <p className="text-xs text-navy-400 truncate">{r.direccao}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-error-600 font-bold tabular-nums">{r.dias_aberto ?? '—'}</p>
                            <p className="text-xs text-navy-400 truncate">{r.responsavel ?? '—'}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Destaques do Período */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader><CardTitle>Destaques do Período</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-navy-700">
                  <li>+ <strong>{kpis.fechadas} vagas fechadas</strong> no período — taxa de conversão de {kpis.taxaFecho}%.</li>
                  {kpis.criticas > 0 && (
                    <li>! <strong>{kpis.criticas} vagas críticas</strong> com prioridade Alta necessitam acção imediata.</li>
                  )}
                  {candidatos.length > 0 && (
                    <li>+ <strong>{candidatos.length} candidatos</strong> importados nesta sessão.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* Detalhe das Vagas por Direcção */}
          <motion.div variants={staggerItem} className="space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 self-start">
                Detalhe das Vagas por Direcção
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-navy-400">Filtrar:</span>
                <Select options={direccaoOptions} placeholder="Todas as Direcções" value={filtroDireccao} onChange={setFiltroDireccao} className="w-44" />
                <Select
                  options={[{ value: 'Em Curso', label: 'Em Curso' }, { value: 'Em Atraso', label: 'Em Atraso' }, { value: 'Fechado', label: 'Fechado' }, { value: 'Cancelado', label: 'Cancelado' }]}
                  placeholder="Todos os Status" value={filtroStatus} onChange={setFiltroStatus} className="w-40"
                />
                <Select
                  options={[{ value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }]}
                  placeholder="Todas as Prioridades" value={filtroPrioridade} onChange={setFiltroPrioridade} className="w-44"
                />
                <Select options={tipoOptions} placeholder="Todos os Tipos" value={filtroTipo} onChange={setFiltroTipo} className="w-40" />
                <span className="text-xs text-navy-500 whitespace-nowrap">{registosFiltrados.length} vagas</span>
              </div>
            </div>

            {grupos.length === 0 ? (
              <p className="text-sm text-navy-400 py-4">Nenhum registo corresponde aos filtros.</p>
            ) : grupos.map(([direccao, items]) => (
              <div key={direccao} className="rounded-xl border border-navy-100 overflow-hidden bg-white">
                <div className="bg-navy-700 text-white px-4 py-2.5 flex items-center gap-2 text-sm font-semibold">
                  <span>Direcção: {direccao}</span>
                  <span className="bg-white/15 rounded-full px-2 py-0.5 text-xs font-bold">{items.length} vagas</span>
                  {(criticasCountByDireccao.get(direccao) ?? 0) > 0 && (
                    <span className="ml-2 bg-error-500 rounded-full px-2 py-0.5 text-xs font-bold">
                      {criticasCountByDireccao.get(direccao)} crítica{criticasCountByDireccao.get(direccao) === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-navy-50 text-navy-500 text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2 font-semibold">Referência da Vaga</th>
                        <th className="text-left px-4 py-2 font-semibold">Função</th>
                        <th className="text-left px-4 py-2 font-semibold">Departamento</th>
                        <th className="text-left px-4 py-2 font-semibold">Tipo_Vaga</th>
                        <th className="text-left px-4 py-2 font-semibold">Orçamento</th>
                        <th className="text-left px-4 py-2 font-semibold">Responsável</th>
                        <th className="text-left px-4 py-2 font-semibold">Status_Original</th>
                        <th className="text-right px-4 py-2 font-semibold">Dias em Aberto</th>
                        <th className="text-left px-4 py-2 font-semibold">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-50">
                      {items.map((r) => {
                        const naoOrc = (r.orcamento ?? '').toLowerCase().includes('não') || (r.tipo_vaga ?? '').toLowerCase().includes('não orça');
                        const dias = r.dias_aberto ?? 0;
                        return (
                          <tr key={r.referencia} className="hover:bg-navy-25">
                            <td className="px-4 py-2 font-medium text-navy-700 whitespace-nowrap">{r.referencia}</td>
                            <td className="px-4 py-2 text-navy-700">{r.funcao}</td>
                            <td className="px-4 py-2 text-navy-500">{r.departamento ?? '—'}</td>
                            <td className="px-4 py-2 text-navy-500">{r.tipo_vaga ?? '—'}</td>
                            <td className={`px-4 py-2 font-medium ${naoOrc ? 'text-error-600' : 'text-success-600'}`}>{r.orcamento ?? (naoOrc ? 'Não Orçamentada' : 'Orçamentada')}</td>
                            <td className="px-4 py-2 text-navy-500">{r.responsavel ?? '—'}</td>
                            <td className="px-4 py-2 text-navy-500">{r.status}</td>
                            <td className={`px-4 py-2 text-right font-semibold tabular-nums ${dias > 30 ? 'text-error-600' : 'text-navy-600'}`}>{r.dias_aberto ?? '—'}</td>
                            <td className={`px-4 py-2 font-medium ${r.prioridade === 'Alta' ? 'text-error-600' : r.prioridade === 'Média' ? 'text-warning-600' : 'text-success-600'}`}>{r.prioridade}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </motion.div>
        </>
      )}

      {showImportModal && (
        <MultiSheetImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          onDone={() => setShowImportModal(false)}
        />
      )}
    </motion.div>
  );
}

// === Sub-componentes ===

interface KpiCardProps {
  tone: 'primary' | 'success' | 'info' | 'danger' | 'warning' | 'accent';
  label: string;
  value: string | number;
  subtitle?: string;
  subtitleBadge?: string;
  subtitleTone?: 'success' | 'warning' | 'danger';
}

function KpiCard({ tone, label, value, subtitle, subtitleBadge, subtitleTone }: KpiCardProps) {
  const valueColor = tone === 'danger' ? 'text-error-600' : tone === 'warning' ? 'text-warning-600' : tone === 'success' ? 'text-success-600' : tone === 'accent' ? 'text-gold-600' : tone === 'info' ? 'text-info-600' : 'text-navy-800';
  const badgeBg = subtitleTone === 'danger' ? 'bg-error-100 text-error-700' : subtitleTone === 'warning' ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700';
  return (
    <div className={`rounded-xl border border-navy-100 border-t-4 ${KPI_BORDER[tone]} bg-white p-4 shadow-sm`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400">{label}</p>
      <p className={`text-[40px] leading-none font-bold tabular-nums mt-1 ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className={`text-xs mt-2 ${subtitleTone === 'danger' ? 'text-error-600' : subtitleTone === 'warning' ? 'text-warning-600' : 'text-navy-500'}`}>
          {subtitle}
        </p>
      )}
      {subtitleBadge && (
        <span className={`inline-block mt-1 text-[10px] font-semibold rounded px-1.5 py-0.5 ${badgeBg}`}>{subtitleBadge}</span>
      )}
    </div>
  );
}

function FunilRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-navy-600 w-44 flex-shrink-0">{label}</span>
      <div className="flex-1 h-6 rounded bg-navy-50 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums font-bold text-navy-800 w-8 text-right">{value}</span>
    </div>
  );
}

function ApprovalTile({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'success' | 'warning' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const bg = tone === 'success' ? 'bg-success-50' : 'bg-warning-50';
  const valueColor = tone === 'success' ? 'text-success-700' : 'text-warning-700';
  return (
    <div className={`rounded-lg ${bg} p-3 text-center`}>
      <p className={`text-2xl font-bold ${valueColor} tabular-nums`}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-navy-500 mt-1">{label}</p>
      <p className="text-[10px] text-navy-400 mt-0.5">{pct}%</p>
    </div>
  );
}

// === Modal de import de múltiplas folhas ===

interface MultiSheetImportModalProps {
  onClose: () => void;
  onImport: (workbook: ParsedWorkbook) => Promise<{ criadas: number; ignoradas: number; candidatos: number; erros: string[] }>;
  onDone: () => void;
}

function MultiSheetImportModal({ onClose, onImport, onDone }: MultiSheetImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ criadas: number; ignoradas: number; candidatos: number; erros: string[] } | null>(null);

  async function handleFile(f: File) {
    const v = validateExcelFile(f);
    if (!v.valid) {
      toast.error('Ficheiro inválido', v.error!);
      return;
    }
    setFile(f);
    setParseError(null);
    setWorkbook(null);
    setSummary(null);
    setParsing(true);
    try {
      const wb = await parseAllSheets(f);
      setWorkbook(wb);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao processar o ficheiro.');
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!workbook) return;
    setImporting(true);
    try {
      const result = await onImport(workbook);
      setSummary(result);
      if (result.criadas > 0) {
        toast.success('Importação concluída', `${result.criadas} vaga(s)${result.candidatos > 0 ? ` e ${result.candidatos} candidato(s)` : ''} importados.`);
        onDone();
      } else {
        toast.warning('Nada importado', 'Nenhuma vaga válida foi encontrada.');
      }
    } catch (err) {
      toast.error('Erro na importação', err instanceof Error ? err.message : 'Não foi possível importar o ficheiro.');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setWorkbook(null);
    setParseError(null);
    setSummary(null);
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">Actualizar Excel</h2>
      <p className="text-sm text-navy-400 mb-4">
        O ficheiro deve conter a folha <strong>{SHEET_BD}</strong>. Se incluir também <strong>{SHEET_CANDIDATOS}</strong>, os candidatos ficam disponíveis no submódulo Candidatos.
      </p>

      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-navy-200 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition-colors"
        >
          <Upload className="w-10 h-10 text-navy-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-navy-700">Arraste um ficheiro ou clique para escolher</p>
          <p className="text-xs text-navy-400 mt-1">.xlsx, .xls ou .csv, máximo 10 MB</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-navy-25 border border-navy-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-navy-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800 truncate">{file.name}</p>
              <p className="text-xs text-navy-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            {!summary && (<Button variant="ghost" size="sm" onClick={reset}>Trocar</Button>)}
          </div>

          {parsing && (
            <p className="text-sm text-navy-500 flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /> A processar…
            </p>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-100 rounded-lg">
              <XCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-error-700">{parseError}</p>
            </div>
          )}

          {workbook && !summary && (
            <div className="flex items-start gap-2 p-3 bg-info-50 border border-info-100 rounded-lg">
              <FileSpreadsheet className="w-4 h-4 text-info-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-info-700">
                <p className="font-medium">Folhas detectadas:</p>
                <ul className="mt-1 space-y-0.5">
                  {workbook.sheetNames.map((n) => (
                    <li key={n}>· <strong>{n}</strong> ({workbook.sheets[n].length} linha(s))</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {summary && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-success-50 border border-success-100 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-success-700">
                  {summary.criadas} vaga(s) importada(s){summary.candidatos > 0 ? `, ${summary.candidatos} candidato(s)` : ''}.
                </p>
              </div>
              {summary.erros.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning-50 border border-warning-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                  <ul className="text-xs text-warning-700 list-disc list-inside space-y-0.5">
                    {summary.erros.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <Button variant="ghost" onClick={onClose}>{summary ? 'Fechar' : 'Cancelar'}</Button>
        {!summary && (
          <Button variant="primary" onClick={handleConfirm} loading={importing} disabled={!workbook || parsing}>
            Confirmar Importação
          </Button>
        )}
      </div>
    </Dialog>
  );
}
