// Marca da plataforma — fonte única para títulos, emails e PDFs.
export const APP_NAME = 'PUMANGOL PEOPLE CONNECT';
export const APP_NAME_TITLE = 'Pumangol People Connect';
export const APP_SLOGAN = 'Conectando pessoas, Cultura, Saúde e Desenvolvimento';

// Home por perfil — usar sempre esta função em vez de hardcodar '/'.
// Todos os perfis aterram na página de boas-vindas. As publicações ficam em Notícias.
export function homeForRole(_role?: string | null): string {
  return ROUTES.HOME;
}

/** Domínio dos emails gerados automaticamente a partir do nome. */
export const EMAIL_DOMINIO = 'pumangol.co.ao';

/** Capa igual em todos os perfis. Não há upload de capa. */
export const CAPA_PERFIL = '/capa-perfil.jpg';

// Routes
export const ROUTES = {
  LOGIN: '/login',
  HOME: '/inicio',
  DASHBOARD: '/',
  UNAUTHORIZED: '/unauthorized',
  INVALID_LINK: '/link-invalido',
  MEU_PERFIL: '/meu-perfil',

  // Recrutamento
  VAGAS: '/recrutamento/vagas',
  VAGA_DETALHE: (id: string) => `/recrutamento/vagas/${id}`,
  PIPELINE: '/recrutamento/pipeline',
  CANDIDATOS: '/recrutamento/candidatos',
  ENTREVISTAS: '/recrutamento/entrevistas',
  DASHBOARD_SEMANAL: '/recrutamento/dashboard-semanal',

  // Onboarding
  ONBOARDING: '/onboarding',
  TRILHOS: '/onboarding/trilhos',
  TRILHO_DETALHE: (id: string) => `/onboarding/trilhos/${id}`,
  COLABORADOR_PROGRESSO: (id: string) => `/onboarding/colaborador/${id}`,

  // Assistente IA
  ASSISTENTE: '/assistente',
  BASE_CONHECIMENTO: '/base-conhecimento',
  BASE_CONHECIMENTO_DIR: (dir: string) => `/base-conhecimento/${dir}`,
  ESCALACOES: '/assistente/escalacoes',

  // Relatórios
  ANALITICA: '/analitica',

  // Configurações
  CONFIGURACOES: '/configuracoes',
  AUDIT_LOG: '/configuracoes/audit',

  // Portal colaborador
  MEU_ONBOARDING: (token: string) => `/meu-onboarding/${token}`,
  MEU_ONBOARDING_ASSISTENTE: (token: string) => `/meu-onboarding/${token}/assistente`,

  // Público
  CHAT_PUBLICO: '/chat',
} as const;

// Pipeline phases in order
export const PIPELINE_PHASES = [
  { key: 'pedido_director', label: 'Pedido Director', color: 'bg-navy-200' },
  { key: 'aprovacao_interna', label: 'Aprovação Interna', color: 'bg-navy-300' },
  { key: 'publicacao', label: 'Publicação', color: 'bg-navy-400' },
  { key: 'triagem_cvs', label: 'Triagem CVs', color: 'bg-navy-500' },
  { key: 'primeira_entrevista_dpc', label: '1ª Entrevista DPC', color: 'bg-navy-600' },
  { key: 'segunda_entrevista_area', label: '2ª Entrevista Área', color: 'bg-navy-700' },
  { key: 'proposta', label: 'Proposta', color: 'bg-gold-400' },
  { key: 'aceitacao', label: 'Aceitação', color: 'bg-gold-500' },
  { key: 'contratacao', label: 'Contratação', color: 'bg-success-500' },
  { key: 'transicao_onboarding', label: 'Transição Onboarding', color: 'bg-success-600' },
] as const;

// Direcções / Gabinetes oficiais Pumangol (fonte de verdade)
export const DIRECCOES = [
  'Comissão Executiva',
  'Direcção Comercial',
  'Direcção de Auditoria',
  'Direcção de BLT – BSM, Logística e Transportes',
  'Direcção de Compras & Aprovisionamento',
  'Direcção de Conveniência',
  'Direcção de Marketing e Comunicação',
  'Direcção de Operações de Terminais',
  'Direcção de Pessoas e Cultura',
  'Direcção de Retalho & Manutenção',
  'Direcção de Segurança Patrimonial',
  'Direcção Financeira',
  'Direcção Jurídica',
  'Gabinete de Activos e Protocolo',
  'Gabinete de Construção',
  'Gabinete do PCE',
  'Gabinete Técnico',
] as const;

// FAQ categories
export const CATEGORIAS_FAQ = [
  { value: 'beneficios', label: 'Benefícios' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'acessos', label: 'Acessos' },
  { value: 'formacao', label: 'Formação' },
  { value: 'processos', label: 'Processos' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'it', label: 'IT' },
  { value: 'logistica', label: 'Logística' },
] as const;

// Estado labels and colors
export const ESTADO_VAGA_CONFIG = {
  aberta: { label: 'Aberta', variant: 'success' as const },
  em_triagem: { label: 'Em Triagem', variant: 'info' as const },
  em_entrevistas: { label: 'Em Entrevistas', variant: 'info' as const },
  em_proposta: { label: 'Em Proposta', variant: 'warning' as const },
  fechada: { label: 'Fechada', variant: 'neutral' as const },
  cancelada: { label: 'Cancelada', variant: 'error' as const },
} as const;

export const ESTADO_ONBOARDING_CONFIG = {
  nao_iniciado: { label: 'Não Iniciado', variant: 'neutral' as const },
  em_curso: { label: 'Em Curso', variant: 'info' as const },
  concluido: { label: 'Concluído', variant: 'success' as const },
} as const;

export const ESTADO_FAQ_CONFIG = {
  rascunho: { label: 'Rascunho', variant: 'neutral' as const },
  em_revisao: { label: 'Em Revisão', variant: 'warning' as const },
  publicada: { label: 'Publicada', variant: 'success' as const },
  arquivada: { label: 'Arquivada', variant: 'neutral' as const },
} as const;

// Pipeline transition rules
export const PIPELINE_TRANSITIONS: Record<string, string[]> = {
  pedido_director: ['aprovacao_interna'],
  aprovacao_interna: ['publicacao'],
  publicacao: ['triagem_cvs'],
  triagem_cvs: ['primeira_entrevista_dpc'],
  primeira_entrevista_dpc: ['segunda_entrevista_area'],
  segunda_entrevista_area: ['proposta'],
  proposta: ['aceitacao'],
  aceitacao: ['contratacao'],
  contratacao: ['transicao_onboarding'],
};

export const ORIGEM_CANDIDATO_CONFIG = {
  publicacao: { label: 'Publicação' },
  referenciacao: { label: 'Referenciação' },
  headhunter: { label: 'Headhunter' },
  candidatura_espontanea: { label: 'Candidatura Espontânea' },
} as const;

// Kanban pipeline columns (recruiter-facing subset)
export const KANBAN_COLUMNS = [
  { key: 'triagem_cvs', label: 'Triagem CVs', color: 'bg-navy-500' },
  { key: 'primeira_entrevista_dpc', label: '1ª Entrevista DPC', color: 'bg-navy-600' },
  { key: 'segunda_entrevista_area', label: '2ª Entrevista Área', color: 'bg-navy-700' },
  { key: 'proposta', label: 'Proposta', color: 'bg-gold-400' },
  { key: 'aceitacao', label: 'Aceitação', color: 'bg-gold-500' },
  { key: 'contratacao', label: 'Contratação', color: 'bg-success-500' },
] as const;

// Limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const CHATBOT_MAX_MESSAGE_LENGTH = 500;
export const CHATBOT_MAX_MESSAGES_PER_SESSION = 50;
export const DEBOUNCE_MS = 300;
export const PAGINATION_DEFAULT_LIMIT = 20;
