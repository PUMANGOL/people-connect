// ============================================================
// Excel exports — Mentoria (Fase 6)
// ============================================================

import * as XLSX from 'xlsx';
import type { MentorAvaliacao } from '@/lib/types';
import { MOMENTOS_AVALIACAO } from '@/lib/avaliacao-schemas';
import type { MentoradoRow } from '@/src/services/mentoria.service';

function momentoLabel(m: string): string {
  return MOMENTOS_AVALIACAO.find((x) => x.value === m)?.label ?? m;
}

function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function exportarCentroAvaliacoesExcel(avals: MentorAvaliacao[]): void {
  const rows = avals.map((a) => {
    const nums = Object.values(a.criterios ?? {}).filter((v) => typeof v === 'number') as number[];
    const media = nums.length > 0 ? +(nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2) : null;
    return {
      Colaborador: a.colaborador_nome ?? '',
      Mentor: a.mentor_nome ?? '',
      Categoria: a.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos',
      Momento: momentoLabel(a.momento),
      Estado: a.estado,
      'Média critérios': media,
      'Classificação Global': a.classificacao_global ?? '',
      'Manter mentor': a.manter_mentor ?? '',
      'Necessita orientação': a.necessita_orientacao ? 'Sim' : 'Não',
      'Necessita clarificação': a.necessita_clarificacao ? 'Sim' : 'Não',
      'Período início': a.periodo_inicio ?? '',
      'Período fim': a.periodo_fim ?? '',
      'Submetida em': a.preenchido_em ?? '',
      'Validada em': a.validado_em ?? '',
      'Observações DPC': a.observacoes_dpc ?? '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Avaliações');

  const today = new Date().toISOString().slice(0, 10);
  saveWorkbook(wb, `centro-avaliacoes_${today}.xlsx`);
}

export function exportarMentoradosExcel(rows: MentoradoRow[]): void {
  const data = rows.map((r) => ({
    Nome: r.nome,
    Função: r.funcao,
    Direcção: r.direccao,
    Email: r.email ?? '',
    Categoria: r.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos',
    'Data admissão': r.data_admissao,
    'Estado onboarding': r.estado_onboarding,
    'Welcome concluído': r.welcome_completed ? 'Sim' : 'Não',
    'Etapas concluídas': Number(r.etapas_concluidas) || 0,
    'Etapas total': Number(r.etapas_total) || 0,
    'Atribuído em': r.atribuido_em,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Mentorados');
  const today = new Date().toISOString().slice(0, 10);
  saveWorkbook(wb, `mentorados_${today}.xlsx`);
}
