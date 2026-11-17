// ============================================================
// PDFs oficiais Pumangol — Mentoria (Fase 6)
// ============================================================
// Reutiliza generatePdfReport() para consistência visual: logo,
// cabeçalho, rodapé "CONFIDENCIAL", KPIs, tabelas.
// ============================================================

import { generatePdfReport } from './pdf-generator';
import type {
  MentorAvaliacao, ColaboradorFeedback, CategoriaTrilho,
} from '@/lib/types';
import {
  criteriosAvalMentor, MOMENTOS_AVALIACAO, CLASSIFICACOES_GLOBAIS_MENTOR,
  CLASSIFICACOES_GLOBAIS_FEEDBACK,
  ESCALA_QUALITATIVA_FEEDBACK, ESCALA_SIM_PARCIAL_NAO, ESCALA_ELEVADO_MEDIO_BAIXO,
  FEEDBACK_COORD_GERAL, FEEDBACK_COORD_CULTURA, FEEDBACK_COORD_MENTOR_GESTOR,
  FEEDBACK_COORD_INTEGRACAO_FUNCIONAL,
  FEEDBACK_DIR_GERAL, FEEDBACK_DIR_CULTURA_GOV, FEEDBACK_DIR_CE,
} from '@/lib/avaliacao-schemas';

function momentoLabel(m: string): string {
  return MOMENTOS_AVALIACAO.find((x) => x.value === m)?.label ?? m;
}

function classifLabel(c: string | null | undefined): string {
  if (!c) return '—';
  return CLASSIFICACOES_GLOBAIS_MENTOR.find((x) => x.value === c)?.label ?? c;
}

const VAZIO = 'não informado';

function texto(valor: string | null | undefined): string {
  const limpo = (valor ?? '').trim();
  return limpo && limpo !== '—' ? limpo : VAZIO;
}

function classifFeedbackLabel(c: string | null | undefined): string {
  if (!c) return VAZIO;
  return CLASSIFICACOES_GLOBAIS_FEEDBACK.find((x) => x.value === c)?.label ?? c;
}

function nivelLabel(valor: string | undefined): string {
  if (!valor) return VAZIO;
  const escala = [...ESCALA_QUALITATIVA_FEEDBACK, ...ESCALA_SIM_PARCIAL_NAO, ...ESCALA_ELEVADO_MEDIO_BAIXO];
  return escala.find((x) => x.value === valor)?.label ?? valor;
}

function safeName(nome: string | undefined): string {
  return (nome ?? 'colaborador').replace(/[^\w\-]+/g, '_');
}

// ---------------- Avaliação do Mentor ----------------
export async function exportarAvaliacaoMentorPDF(av: MentorAvaliacao): Promise<void> {
  const criterios = criteriosAvalMentor(av.categoria as CategoriaTrilho);
  const filas = criterios.map((c) => {
    const val = av.criterios?.[c.key];
    const obs = av.comentarios_criterios?.[c.key] ?? '';
    return [c.label, String(val ?? '—'), obs];
  });

  const media = (() => {
    const nums = criterios
      .map((c) => av.criterios?.[c.key])
      .filter((v) => typeof v === 'number') as number[];
    return nums.length ? (nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2) : '—';
  })();

  const planoRows =
    av.plano_accao && av.plano_accao.length > 0
      ? av.plano_accao.map((p, i) => [
          String(i + 1),
          p.acao || '—',
          p.responsavel || '—',
          p.prazo ? new Date(p.prazo).toLocaleDateString('pt-AO') : '—',
          p.estado,
        ])
      : [];

  await generatePdfReport({
    title: 'Formulário de Avaliação do Mentor',
    subtitle: `${av.categoria === 'gestao' ? 'Directores e Gestores' : 'Coordenadores, Técnicos, Assistentes e Operacionais'} · ${momentoLabel(av.momento)}`,
    period:
      av.periodo_inicio && av.periodo_fim
        ? `${new Date(av.periodo_inicio).toLocaleDateString('pt-AO')} — ${new Date(av.periodo_fim).toLocaleDateString('pt-AO')}`
        : undefined,
    filename: `avaliacao-mentor_${safeName(av.colaborador_nome)}_${av.momento}.pdf`,
    sections: [
      {
        title: '1. Identificação',
        table: {
          head: ['Campo', 'Preenchimento'],
          body: [
            ['Colaborador avaliado', av.colaborador_nome ?? '—'],
            ['Mentor', av.mentor_nome ?? '—'],
            [
              'Categoria',
              av.categoria === 'gestao' ? 'Direção / Gestão' : 'Coord. / Técnicos',
            ],
            ['Momento', momentoLabel(av.momento)],
            ['Estado', av.estado],
          ],
        },
      },
      {
        title: '2. Avaliação do Mentor',
        kpis: [
          { label: 'Média dos critérios', value: media },
          { label: 'Total critérios', value: criterios.length },
          { label: 'Classificação Global', value: classifLabel(av.classificacao_global) },
        ],
        table: {
          head: ['Critério', 'Nota', 'Comentários'],
          body: filas,
        },
      },
      {
        title: '3. Reflexão qualitativa',
        table: {
          head: ['Bloco', 'Conteúdo'],
          body: [
            ['Pontos fortes', av.pontos_fortes || '—'],
            ['Oportunidades de melhoria', av.oportunidades_melhoria || '—'],
            ['Situações de contributo', av.situacoes_contributo || '—'],
          ],
        },
      },
      {
        title: '4. Decisão e acompanhamento',
        table: {
          head: ['Campo', 'Valor'],
          body: [
            ['Classificação Global', classifLabel(av.classificacao_global)],
            ['Manter mentor', av.manter_mentor ?? '—'],
            ['Necessita orientação adicional', av.necessita_orientacao ? 'Sim' : 'Não'],
            ['Necessita clarificação', av.necessita_clarificacao ? 'Sim' : 'Não'],
            ['Observações DPC', av.observacoes_dpc || '—'],
          ],
        },
      },
      ...(planoRows.length > 0
        ? [
            {
              title: '5. Plano de acção',
              table: {
                head: ['#', 'Acção', 'Responsável', 'Prazo', 'Estado'],
                body: planoRows,
              },
            },
          ]
        : []),
    ],
  });
}

// ---------------- Feedback do Colaborador ----------------
function blocoFeedbackRows(
  bloco: readonly { key: string; label: string }[],
  fonte: Record<string, { valor: string; comentario?: string }> | undefined,
): (string | number)[][] {
  return bloco.map((b) => {
    const item = fonte?.[b.key];
    return [b.label, nivelLabel(item?.valor), texto(item?.comentario)];
  });
}

export async function exportarFeedbackColaboradorPDF(fb: ColaboradorFeedback): Promise<void> {
  const isGestao = fb.categoria === 'gestao';

  const geralRows = blocoFeedbackRows(
    isGestao ? FEEDBACK_DIR_GERAL : FEEDBACK_COORD_GERAL,
    fb.avaliacao_geral,
  );

  const culturaRows = blocoFeedbackRows(
    isGestao ? FEEDBACK_DIR_CULTURA_GOV : FEEDBACK_COORD_CULTURA,
    (fb.blocos_aprendizagem?.cultura as Record<string, { valor: string; comentario?: string }>) ?? {},
  );

  const mentorRows = blocoFeedbackRows(
    isGestao ? FEEDBACK_DIR_CE : FEEDBACK_COORD_MENTOR_GESTOR,
    fb.feedback_mentor_gestor,
  );

  const integracaoRows = !isGestao
    ? blocoFeedbackRows(
        FEEDBACK_COORD_INTEGRACAO_FUNCIONAL,
        (fb.blocos_aprendizagem?.integracao_funcional as Record<string, { valor: string; comentario?: string }>) ?? {},
      )
    : [];

  const planoRows =
    fb.plano_accao && fb.plano_accao.length > 0
      ? fb.plano_accao.map((p, i) => [
          String(i + 1),
          texto(p.acao),
          texto(p.responsavel),
          p.prazo ? new Date(p.prazo).toLocaleDateString('pt-AO') : VAZIO,
          texto(p.estado),
        ])
      : [];

  await generatePdfReport({
    title: 'Formulário de Feedback de Aprendizagem e Integração',
    subtitle: `${isGestao ? 'Directores e Gestores' : 'Coordenadores, Técnicos, Assistentes e Operacionais'} · ${momentoLabel(fb.momento)}`,
    period:
      fb.periodo_inicio && fb.periodo_fim
        ? `${new Date(fb.periodo_inicio).toLocaleDateString('pt-AO')} — ${new Date(fb.periodo_fim).toLocaleDateString('pt-AO')}`
        : undefined,
    filename: `feedback-colaborador_${safeName(fb.colaborador_nome)}_${fb.momento}.pdf`,
    sections: [
      {
        title: '1. Identificação',
        table: {
          head: ['Campo', 'Preenchimento'],
          body: [
            ['Colaborador', texto(fb.colaborador_nome)],
            ['Categoria', isGestao ? 'Director / Gestor' : 'Coord. / Técnico / Assist.'],
            ['Momento', momentoLabel(fb.momento)],
            ['Estado', fb.estado],
            ['Classificação global', classifFeedbackLabel(fb.classificacao_global)],
          ],
        },
      },
      {
        title: '2. Avaliação geral da experiência de indução',
        table: {
          head: ['Critério', 'Nível', 'Comentários'],
          body: geralRows,
        },
      },
      {
        title: '3. Cultura e valores',
        table: {
          head: ['Critério', 'Nível', 'Comentários'],
          body: culturaRows,
        },
      },
      ...(integracaoRows.length > 0
        ? [
            {
              title: '4. Integração funcional',
              table: {
                head: ['Critério', 'Nível', 'Comentários'],
                body: integracaoRows,
              },
            },
          ]
        : []),
      {
        title: '5. Feedback sobre o mentor / gestor',
        table: {
          head: ['Critério', 'Nível', 'Comentários'],
          body: mentorRows,
        },
      },
      {
        title: '6. Aprendizagens principais',
        text: texto(fb.principais_aprendizagens),
      },
      {
        title: '7. Comentários finais',
        text: texto(fb.comentarios_finais),
      },
      ...(planoRows.length > 0
        ? [
            {
              title: '8. Plano de acção',
              table: {
                head: ['#', 'Acção', 'Responsável', 'Prazo', 'Estado'],
                body: planoRows,
              },
            },
          ]
        : []),
    ],
  });
}

// ---------------- Relatório de Integração (Director) ----------------
export interface RelatorioIntegracaoInput {
  colaborador_nome: string;
  cargo: string;
  direccao: string;
  data_admissao: string;
  mentor_nome?: string | null;
  avaliacoes: MentorAvaliacao[];
  feedback?: ColaboradorFeedback | null;
  observacoes?: string;
}

function nomeMentorRelatorio(input: RelatorioIntegracaoInput): string {
  const directo = (input.mentor_nome ?? '').trim();
  if (directo && directo !== '—') return directo;
  const daAvaliacao = input.avaliacoes
    .map((a) => (a.mentor_nome ?? '').trim())
    .find((nome) => nome && nome !== '—');
  return daAvaliacao || '—';
}

export async function exportarRelatorioIntegracaoPDF(input: RelatorioIntegracaoInput): Promise<void> {
  const mentorNome = nomeMentorRelatorio(input);
  const avaliacoesRows = input.avaliacoes.map((a) => [
    momentoLabel(a.momento),
    a.mentor_nome ?? '—',
    classifLabel(a.classificacao_global),
    a.estado,
    a.preenchido_em ? new Date(a.preenchido_em).toLocaleDateString('pt-AO') : '—',
  ]);

  const sections = [
    {
      title: '1. Identificação do colaborador',
      table: {
        head: ['Campo', 'Preenchimento'],
        body: [
          ['Nome', input.colaborador_nome],
          ['Cargo', input.cargo],
          ['Direcção / Gabinete', input.direccao],
          ['Data de admissão', new Date(input.data_admissao).toLocaleDateString('pt-AO')],
          ['Mentor', mentorNome],
        ],
      },
    },
    {
      title: '2. Histórico de avaliações',
      table: {
        head: ['Momento', 'Mentor', 'Classificação Global', 'Estado', 'Submetido em'],
        body: avaliacoesRows.length > 0 ? avaliacoesRows : [['—', '—', '—', '—', '—']],
      },
    },
  ];

  if (input.feedback) {
    sections.push({
      title: '3. Feedback do colaborador',
      table: {
        head: ['Campo', 'Preenchimento'],
        body: [
          ['Momento', momentoLabel(input.feedback.momento)],
          ['Classificação global', classifLabel(input.feedback.classificacao_global)],
          ['Aprendizagens principais', input.feedback.principais_aprendizagens ?? '—'],
          ['Comentários finais', input.feedback.comentarios_finais ?? '—'],
        ],
      },
    });
  }

  if (input.observacoes) {
    sections.push({
      title: '4. Observações finais da DPC',
      table: { head: ['Campo', 'Preenchimento'], body: [['Observações', input.observacoes]] },
    });
  }

  await generatePdfReport({
    title: 'Relatório de Integração',
    subtitle: `${input.colaborador_nome} — ${input.cargo}`,
    filename: `relatorio-integracao_${safeName(input.colaborador_nome)}.pdf`,
    sections,
  });
}
