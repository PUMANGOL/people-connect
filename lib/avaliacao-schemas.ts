// ============================================================
// Schemas dos formulários oficiais (Master Prompt Enterprise)
// ============================================================
// Cada schema espelha 100% do documento correspondente. Nenhum
// critério pode ser removido; o Master Prompt é explícito neste
// ponto. Ordem preserva a do documento oficial.
// ============================================================

import type { CategoriaTrilho, MomentoAvaliacao } from './types';

export interface CriterioAvaliacaoMentor {
  key: string;
  label: string;
}

export const MOMENTOS_AVALIACAO: { value: MomentoAvaliacao; label: string }[] = [
  { value: 'dia_15', label: 'Dia 15' },
  { value: 'dia_30', label: 'Dia 30' },
  { value: 'dia_60', label: 'Dia 60' },
  { value: 'dia_90', label: 'Dia 90' },
  { value: 'final',  label: 'Final' },
];

export const ESCALA_AVALIACAO_MENTOR: { value: number | 'N/A'; label: string; descricao: string }[] = [
  { value: 5,     label: '5', descricao: 'Excelente — excedeu as expectativas' },
  { value: 4,     label: '4', descricao: 'Bom — correspondeu plenamente às expectativas' },
  { value: 3,     label: '3', descricao: 'Regular — correspondeu parcialmente às expectativas' },
  { value: 2,     label: '2', descricao: 'A melhorar — apoio insuficiente em alguns aspectos' },
  { value: 1,     label: '1', descricao: 'Insatisfatório — não correspondeu às expectativas' },
  { value: 'N/A', label: 'N/A', descricao: 'Não aplicável' },
];

// === Avaliação do Mentor — Directores/Gestores (10 critérios) ===
export const CRITERIOS_AVAL_MENTOR_DIRECTORES: CriterioAvaliacaoMentor[] = [
  { key: 'disponibilidade',    label: 'Disponibilidade do mentor para apoiar o colaborador' },
  { key: 'clareza',            label: 'Clareza das orientações transmitidas' },
  { key: 'primeiros_dias',     label: 'Acompanhamento nos primeiros dias de integração' },
  { key: 'cultura',            label: 'Apoio na compreensão da cultura e valores da Pumangol' },
  { key: 'integracao_equipa',  label: 'Facilitação da integração com a equipa e stakeholders internos' },
  { key: 'encaminhamento',     label: 'Encaminhamento adequado em caso de dúvidas ou dificuldades' },
  { key: 'cumprimento',        label: 'Cumprimento dos momentos de acompanhamento previstos' },
  { key: 'governo',            label: 'Apoio na compreensão do modelo de governo e interfaces estratégicas' },
  { key: 'networking',         label: 'Facilitação de networking com Direcções, Gabinetes e Comissão Executiva' },
  { key: 'prioridades',        label: 'Contributo para clarificar prioridades, riscos e expectativas da função' },
];

// === Avaliação do Mentor — Coordenadores/Técnicos (10 critérios) ===
export const CRITERIOS_AVAL_MENTOR_TECNICOS: CriterioAvaliacaoMentor[] = [
  { key: 'disponibilidade',    label: 'Disponibilidade do mentor para apoiar o colaborador' },
  { key: 'clareza',            label: 'Clareza das orientações transmitidas' },
  { key: 'primeiros_dias',     label: 'Acompanhamento nos primeiros dias de integração' },
  { key: 'cultura',            label: 'Apoio na compreensão da cultura e valores da Pumangol' },
  { key: 'integracao_equipa',  label: 'Facilitação da integração com a equipa e stakeholders internos' },
  { key: 'encaminhamento',     label: 'Encaminhamento adequado em caso de dúvidas ou dificuldades' },
  { key: 'cumprimento',        label: 'Cumprimento dos momentos de acompanhamento previstos' },
  { key: 'procedimentos',      label: 'Apoio na compreensão dos procedimentos da área' },
  { key: 'sistemas',           label: 'Apoio na utilização dos sistemas e ferramentas de trabalho' },
  { key: 'rotinas',            label: 'Acompanhamento prático nas rotinas e actividades iniciais da função' },
];

export const CLASSIFICACOES_GLOBAIS_MENTOR: { value: string; label: string }[] = [
  { value: 'muito_satisfatoria',   label: 'Muito satisfatória' },
  { value: 'satisfatoria',         label: 'Satisfatória' },
  { value: 'parcial_satisfatoria', label: 'Parcialmente satisfatória' },
  { value: 'necessita_melhoria',   label: 'Necessita de melhoria' },
  { value: 'na',                   label: 'Não aplicável / sem informação suficiente' },
];

export function criteriosAvalMentor(categoria: CategoriaTrilho): CriterioAvaliacaoMentor[] {
  return categoria === 'gestao' ? CRITERIOS_AVAL_MENTOR_DIRECTORES : CRITERIOS_AVAL_MENTOR_TECNICOS;
}

// === Feedback de Aprendizagem — Coordenadores/Técnicos ===
export const FEEDBACK_COORD_GERAL = [
  { key: 'acolhimento_dia1',      label: 'Acolhimento no Dia 1' },
  { key: 'clareza_info',          label: 'Clareza das informações recebidas' },
  { key: 'utilidade_videos',      label: 'Utilidade dos vídeos institucionais/DPC' },
  { key: 'qualidade_inducoes',    label: 'Qualidade das induções obrigatórias' },
  { key: 'apoio_mentor',          label: 'Apoio do mentor' },
  { key: 'integracao_equipa',     label: 'Integração com a equipa' },
  { key: 'acesso_ferramentas',    label: 'Acesso a ferramentas e equipamentos' },
  { key: 'programa_onboarding',   label: 'Programa de onboarding em geral' },
];

export const FEEDBACK_COORD_CULTURA = [
  { key: 'historia',              label: 'Compreendi a história e ADN da Pumangol' },
  { key: 'valores',               label: 'Compreendi os valores e comportamentos esperados' },
  { key: 'modelo_organizacao',    label: 'Compreendi o modelo geral da organização' },
  { key: 'politicas',             label: 'Sei onde consultar políticas e procedimentos' },
];

export const FEEDBACK_COORD_INDUCOES_OBRIGATORIAS = [
  { key: 'dpc',        label: 'DPC' },
  { key: 'marketing',  label: 'Marketing e Comunicação' },
  { key: 'auditoria',  label: 'Auditoria Interna' },
  { key: 'compliance', label: 'Compliance / Jurídico' },
  { key: 'hse',        label: 'HSE' },
  { key: 'seguranca',  label: 'Segurança Patrimonial' },
  { key: 'it',         label: 'IT' },
];

export const FEEDBACK_COORD_VISITAS_OPERACIONAIS = [
  { key: 'tcpl',       label: 'Terminal TCPL' },
  { key: 'aviacao',    label: 'Terminal de Aviação' },
  { key: 'armazem',    label: 'Armazém de Viana' },
  { key: 'academia',   label: 'Academia Pumangol' },
  { key: 'outro',      label: 'Outro site aplicável' },
];

export const FEEDBACK_COORD_INTEGRACAO_FUNCIONAL = [
  { key: 'responsabilidades', label: 'Conheço as responsabilidades principais da minha função' },
  { key: 'procedimentos',     label: 'Compreendi os procedimentos internos da área' },
  { key: 'sistemas',          label: 'Recebi orientação sobre os sistemas utilizados' },
  { key: 'contactos',         label: 'Conheço os principais contactos internos para a minha função' },
  { key: 'preparado',         label: 'Sinto-me preparado para executar as actividades iniciais' },
];

export const FEEDBACK_COORD_DUVIDAS = [
  { key: 'beneficios',    label: 'Benefícios / DPC' },
  { key: 'compliance',    label: 'Código de Conduta / Compliance' },
  { key: 'hse',           label: 'HSE / Segurança' },
  { key: 'it',            label: 'IT / Sistemas' },
  { key: 'procedimentos', label: 'Procedimentos da função' },
  { key: 'processos',     label: 'Processos da área' },
  { key: 'outros',        label: 'Outros' },
];

export const FEEDBACK_COORD_MENTOR_GESTOR = [
  { key: 'disponibilidade',   label: 'Disponibilidade do mentor' },
  { key: 'clareza',           label: 'Clareza das orientações recebidas' },
  { key: 'gestor_directo',    label: 'Apoio do gestor directo' },
  { key: 'integracao_equipa', label: 'Facilidade de integração na equipa' },
];

// === Feedback de Aprendizagem — Directores/Gestores ===
export const FEEDBACK_DIR_GERAL = [
  { key: 'acolhimento_inicial',  label: 'Acolhimento inicial' },
  { key: 'clareza_agenda',       label: 'Clareza da agenda de indução' },
  { key: 'qualidade_sessoes',    label: 'Qualidade das sessões realizadas' },
  { key: 'disponibilidade_fac',  label: 'Disponibilidade dos facilitadores' },
  { key: 'relevancia_conteudos', label: 'Relevância dos conteúdos apresentados' },
  { key: 'conhecimento_negocio', label: 'Conhecimento adquirido sobre o negócio' },
  { key: 'integracao_stakeholders', label: 'Integração com stakeholders internos' },
];

export const FEEDBACK_DIR_CULTURA_GOV = [
  { key: 'cultura',       label: 'Compreensão da cultura e valores da Pumangol' },
  { key: 'governo',       label: 'Compreensão do modelo de governo e estrutura organizacional' },
  { key: 'interfaces',    label: 'Compreensão das principais responsabilidades e interfaces corporativas' },
];

export const FEEDBACK_DIR_NEGOCIO_OPS = [
  { key: 'tcpl',              label: 'Terminal TCPL' },
  { key: 'aviacao',           label: 'Terminal de Aviação' },
  { key: 'armazem',           label: 'Armazém de Viana' },
  { key: 'academia',          label: 'Academia Pumangol' },
  { key: 'cadeia_valor',      label: 'Cadeia de valor do negócio' },
  { key: 'riscos_operacionais', label: 'Riscos operacionais identificados' },
];

export const FEEDBACK_DIR_CE = [
  { key: 'prioridades',   label: 'Compreendeu as prioridades estratégicas do negócio' },
  { key: 'decisao',       label: 'Compreendeu o modelo de tomada de decisão' },
  { key: 'expectativas',  label: 'Compreendeu as expectativas da função' },
  { key: 'interfaces_ce', label: 'Identificou interfaces críticas com a Comissão Executiva' },
];

export const FEEDBACK_DIR_DIRECCOES = [
  { key: 'marketing',    label: 'Marketing e Comunicação' },
  { key: 'auditoria',    label: 'Auditoria Interna' },
  { key: 'riscos',       label: 'Riscos e Compliance' },
  { key: 'juridico',     label: 'Jurídico' },
  { key: 'financas',     label: 'Finanças' },
  { key: 'compras',      label: 'Compras e Aprovisionamento' },
  { key: 'comercial',    label: 'Comercial' },
  { key: 'dblt',         label: 'DBLT' },
  { key: 'retalho',      label: 'Retalho e Manutenção' },
  { key: 'conveniencia', label: 'Conveniência' },
  { key: 'projectos',    label: 'Projectos e Investimentos' },
  { key: 'gabinetes',    label: 'Gabinetes de suporte' },
];

export const FEEDBACK_DIR_SUPORTE = [
  { key: 'operacoes',     label: 'Operações' },
  { key: 'financas',      label: 'Finanças' },
  { key: 'comercial',     label: 'Comercial' },
  { key: 'projectos',     label: 'Projectos' },
  { key: 'compliance',    label: 'Compliance / Jurídico' },
  { key: 'auditoria',     label: 'Auditoria / Controlo Interno' },
  { key: 'hse',           label: 'HSE' },
  { key: 'sistemas',      label: 'Sistemas e Tecnologia' },
  { key: 'outros',        label: 'Outros' },
];

export const CLASSIFICACOES_GLOBAIS_FEEDBACK: { value: string; label: string }[] = [
  { value: 'muito_satisfatoria',   label: 'Muito satisfatória' },
  { value: 'satisfatoria',         label: 'Satisfatória' },
  { value: 'parcial_satisfatoria', label: 'Parcialmente satisfatória' },
  { value: 'acompanhamento_adicional', label: 'Necessita de acompanhamento adicional' },
];

export const ESCALA_QUALITATIVA_FEEDBACK: { value: string; label: string }[] = [
  { value: 'excelente', label: 'Excelente' },
  { value: 'bom',       label: 'Bom' },
  { value: 'regular',   label: 'Regular' },
  { value: 'melhorar',  label: 'A melhorar' },
];

export const ESCALA_SIM_PARCIAL_NAO: { value: string; label: string }[] = [
  { value: 'sim',     label: 'Sim' },
  { value: 'parcial', label: 'Parcialmente' },
  { value: 'nao',     label: 'Não' },
];

export const ESCALA_ELEVADO_MEDIO_BAIXO: { value: string; label: string }[] = [
  { value: 'elevado', label: 'Elevado' },
  { value: 'medio',   label: 'Médio' },
  { value: 'baixo',   label: 'Baixo' },
];

export const ESTADOS_ETAPA_V3 = [
  { value: 'nao_iniciada',      label: 'Não iniciado',        variant: 'neutral' as const },
  { value: 'em_preparacao',     label: 'Em preparação',       variant: 'info' as const    },
  { value: 'em_curso',          label: 'Em curso',            variant: 'info' as const    },
  { value: 'aguardar_validacao',label: 'A aguardar validação', variant: 'warning' as const },
  { value: 'concluida',         label: 'Concluído',           variant: 'success' as const },
  { value: 'reagendada',        label: 'Reagendado',          variant: 'warning' as const },
  { value: 'bloqueada',         label: 'Bloqueado',           variant: 'error' as const   },
  { value: 'cancelada',         label: 'Cancelado',           variant: 'neutral' as const },
];
