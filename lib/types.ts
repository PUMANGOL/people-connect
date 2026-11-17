// Core domain types for the Pumangol DPC Platform

// === Auth & Roles ===
export type UserRole = 'rh_admin' | 'mentor' | 'novo_colaborador';

// === Recrutamento Enums ===
export type EstadoVaga = 'aberta' | 'em_triagem' | 'em_entrevistas' | 'em_proposta' | 'fechada' | 'cancelada';

export type EstadoPipeline =
  | 'pedido_director' | 'aprovacao_interna' | 'publicacao'
  | 'triagem_cvs' | 'primeira_entrevista_dpc' | 'segunda_entrevista_area'
  | 'proposta' | 'aceitacao' | 'contratacao' | 'transicao_onboarding';

export type OrigemCandidato = 'publicacao' | 'referenciacao' | 'headhunter' | 'candidatura_espontanea';

export type FaseEntrevista = 'primeira_entrevista_dpc' | 'segunda_entrevista_area' | 'entrevista_tecnica';

export type RecomendacaoEntrevista = 'avancar' | 'reserva' | 'rejeitar';

// === Onboarding Enums ===
export type EstadoOnboarding = 'nao_iniciado' | 'em_curso' | 'concluido';

export type TipoEtapa = 'documental' | 'conversacional' | 'formacao' | 'administrativo' | 'misto';

// Estados alargados (v3 — Master Prompt Enterprise): não_iniciado, em preparação,
// em curso, a aguardar validação, concluído, reagendado, bloqueado, cancelado.
// Mantemos 'pendente' e 'atrasada' por retrocompatibilidade com dados antigos.
export type EstadoEtapa =
  | 'pendente'
  | 'em_preparacao'
  | 'em_curso'
  | 'aguardar_validacao'
  | 'concluida'
  | 'reagendada'
  | 'bloqueada'
  | 'cancelada'
  | 'atrasada';

// === Mentoria (v3) ===
export type CategoriaTrilho = 'gestao' | 'tecnicos';
export type MomentoAvaliacao = 'dia_15' | 'dia_30' | 'dia_60' | 'dia_90' | 'final';
export type EstadoAvaliacao = 'rascunho' | 'submetida' | 'validada';
export type ClassificacaoGlobal =
  | 'muito_satisfatoria' | 'satisfatoria' | 'parcial_satisfatoria'
  | 'necessita_melhoria' | 'acompanhamento_adicional' | 'na';

export interface ChecklistItem {
  key: string;
  label: string;
  obrigatorio?: boolean;
  responsavel?: string | null;
}

export interface Mentor {
  id: string;
  /** Null quando o mentor veio da lista da empresa e ainda não tem conta. */
  utilizador_id: string | null;
  nome: string;
  email?: string | null;
  departamento?: string | null;
  area?: string | null;
  funcao?: string | null;
  data_inicio_contrato?: string | null;
  categorias_suportadas: CategoriaTrilho[];
  activo: boolean;
  bio?: string | null;
  mentorados_activos?: number;
  /** Tem conta em `utilizadores` (aparece na lista de Utilizadores). */
  tem_conta?: boolean;
  /** Já definiu password (consegue entrar). */
  tem_password?: boolean;
}

export interface MentorAssignment {
  id: string;
  colaborador_id: string;
  mentor_id: string;
  mentor_nome?: string;
  mentor_email?: string | null;
  mentor_departamento?: string | null;
  mentor_area?: string | null;
  mentor_funcao?: string | null;
  mentor_data_inicio_contrato?: string | null;
  atribuido_em: string;
  atribuido_por?: string | null;
  terminado_em?: string | null;
  activo: boolean;
}

export interface PlanoAccaoItem {
  acao: string;
  responsavel: string;
  prazo: string | null;
  estado: 'pendente' | 'em_curso' | 'concluido';
}

export interface MentorAvaliacao {
  id: string;
  colaborador_id: string;
  colaborador_nome?: string;
  mentor_id: string;
  mentor_nome?: string;
  categoria: CategoriaTrilho;
  momento: MomentoAvaliacao;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  criterios: Record<string, number | 'N/A'>;
  comentarios_criterios: Record<string, string>;
  pontos_fortes?: string | null;
  oportunidades_melhoria?: string | null;
  situacoes_contributo?: string | null;
  classificacao_global?: ClassificacaoGlobal | null;
  manter_mentor?: 'sim' | 'nao' | 'a_avaliar' | null;
  necessita_orientacao?: boolean | null;
  necessita_clarificacao?: boolean | null;
  observacoes_dpc?: string | null;
  plano_accao: PlanoAccaoItem[];
  estado: EstadoAvaliacao;
  preenchido_em?: string | null;
  validado_em?: string | null;
}

export interface ColaboradorFeedback {
  id: string;
  colaborador_id: string;
  colaborador_nome?: string;
  categoria: CategoriaTrilho;
  momento: MomentoAvaliacao;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  avaliacao_geral: Record<string, { valor: string; comentario?: string }>;
  blocos_aprendizagem: Record<string, unknown>;
  principais_aprendizagens?: string | null;
  duvidas_reforco: Record<string, { necessita: boolean; obs?: string }>;
  stakeholders: Array<{ nome: string; tipo?: string; relevancia?: string; accao?: string }>;
  oportunidades: Array<{ tipo: string; descricao: string; prioridade?: string; responsavel?: string }>;
  suporte_adicional: Record<string, { necessita: boolean; obs?: string }>;
  feedback_mentor_gestor: Record<string, { valor: string; comentario?: string }>;
  classificacao_global?: ClassificacaoGlobal | null;
  comentarios_finais?: string | null;
  plano_accao: PlanoAccaoItem[];
  estado: EstadoAvaliacao;
  desbloqueado: boolean;
  submetido_em?: string | null;
}

export type TipoEventoTimeline =
  | 'utilizador_criado' | 'mentor_atribuido' | 'mentor_removido'
  | 'roadmap_iniciado' | 'etapa_iniciada' | 'etapa_estado_alterado'
  | 'etapa_concluida' | 'checklist_item_concluido' | 'documento_confirmado'
  | 'avaliacao_preenchida' | 'feedback_submetido'
  | 'comentario_mentor' | 'prazo_alterado' | 'onboarding_concluido'
  | 'welcome_completed' | 'observacao';

export interface TimelineEvento {
  id: string;
  colaborador_id: string;
  tipo: TipoEventoTimeline;
  actor_id?: string | null;
  actor_nome?: string | null;
  actor_role?: string | null;
  descricao: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export type TipoNotificacaoOnboarding =
  | 'colaborador_atribuido' | 'etapa_prestes_expirar' | 'roadmap_atrasado'
  | 'avaliacao_pendente' | 'feedback_pendente' | 'documento_obrigatorio_falta'
  | 'onboarding_concluido' | 'comentario_recebido' | 'validacao_pendente'
  | 'comunidade_publicacao' | 'comunidade_comentario' | 'reconhecimento_director';

export interface NotificacaoOnboarding {
  id: string;
  destinatario_id: string;
  destinatario_role?: string | null;
  colaborador_id?: string | null;
  tipo: TipoNotificacaoOnboarding;
  titulo: string;
  mensagem?: string | null;
  link_accao?: string | null;
  lida: boolean;
  lida_em?: string | null;
  created_at: string;
}

export interface ComentarioMentor {
  id: string;
  colaborador_id: string;
  etapa_progresso_id?: string | null;
  autor_id: string;
  autor_nome?: string | null;
  autor_role?: string | null;
  visivel_colaborador: boolean;
  texto: string;
  created_at: string;
}

// === Base de Conhecimento Enums ===
export type EstadoFAQ = 'rascunho' | 'em_revisao' | 'publicada' | 'arquivada';

export type CategoriaFAQ = 'beneficios' | 'seguranca' | 'acessos' | 'formacao' | 'processos' | 'cultura' | 'it' | 'logistica';

// === Transversal Enums ===
export type NotificationChannel = 'email' | 'in_app' | 'ambos';
export type NotificationEstado = 'pendente' | 'enviada' | 'falha' | 'lida';

// === Entities ===
export interface Utilizador {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  departamento: string;
  estado: 'activo' | 'inactivo';
  created_at: string;
}

export interface Vaga {
  id: string;
  titulo: string;
  direccao: string;
  justificativa: string | null;
  numero_posicoes: number;
  estado: EstadoVaga;
  data_abertura: string;
  prazo_alvo: string | null;
  requisitos: string | null;
  owner: string | null;
  referencia_externa: string | null;
  created_at: string;
  updated_at: string;
  candidatos_count?: number;
}

export interface Candidato {
  id: string;
  vaga_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  contactos: Record<string, string> | null;
  cv_ref: string | null;
  origem: OrigemCandidato;
  estado_pipeline: EstadoPipeline;
  data_entrada: string;
  historico: HistoricoPipeline[];
  created_at: string;
  updated_at: string;
  vaga?: Vaga;
}

export interface HistoricoPipeline {
  de: EstadoPipeline;
  para: EstadoPipeline;
  data: string;
  motivo?: string;
  utilizador_id: string;
}

export interface Entrevista {
  id: string;
  candidato_id: string;
  fase: FaseEntrevista;
  entrevistador: string;
  data: string;
  avaliacao: AvaliacaoEntrevista | null;
  parecer: string | null;
  recomendacao: RecomendacaoEntrevista | null;
  created_at: string;
  candidato?: Candidato;
}

export interface AvaliacaoEntrevista {
  competencia_tecnica?: number;
  comunicacao?: number;
  adequacao_cultural?: number;
  experiencia?: number;
  notas?: string;
}

// === Onboarding Entities ===
export interface Colaborador {
  id: string;
  candidato_id_origem: string | null;
  nome: string;
  funcao: string;
  direccao: string;
  data_admissao: string;
  estado_onboarding: EstadoOnboarding;
  link_token: string;
  created_at: string;
  updated_at: string;
  progresso_pct?: number;
  trilho?: TrilhoOnboarding;
}

export interface TrilhoOnboarding {
  id: string;
  funcao: string;
  nome: string;
  duracao_estimada: number | null;
  versao: string;
  activo: boolean;
  created_at: string;
  etapas?: EtapaTrilho[];
}

export interface EtapaTrilho {
  id: string;
  trilho_id: string;
  ordem: number;
  nome: string;
  tipo: TipoEtapa;
  duracao_dias: number;
  descricao: string | null;
  conteudo_ref: string | null;
  criterio_conclusao: string | null;
}

export interface ProgressoOnboarding {
  id: string;
  colaborador_id: string;
  trilho_id: string;
  etapa_id: string;
  estado: EstadoEtapa;
  data_inicio: string | null;
  data_conclusao: string | null;
  responsavel: string | null;
  etapa?: EtapaTrilho;
}

// === Base de Conhecimento Entities ===
export interface FAQ {
  id: string;
  direccao: string;
  categoria: CategoriaFAQ;
  pergunta: string;
  variantes: string[];
  resposta: string;
  palavras_chave: string[];
  owner: string | null;
  estado: EstadoFAQ;
  vezes_citada: number;
  data_actualizacao: string;
  created_at: string;
  /** Presente quando a API devolve metadata de embedding (migração 008+) */
  tem_embedding?: boolean;
  embedding_actualizado_em?: string | null;
}

export interface InteraccaoChatbot {
  id: string;
  colaborador_id: string | null;
  sessao_id: string;
  pergunta: string;
  resposta: string;
  faqs_consultadas: string[];
  timestamp: string;
  satisfacao: number | null;
  escalada_para_dpc: boolean;
  feedback_texto: string | null;
}

// === Transversal Entities ===
export interface AuditLog {
  id: string;
  utilizador_id: string;
  accao: string;
  entidade: string;
  entidade_id: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  timestamp: string;
}

export interface Notificacao {
  id: string;
  destinatario_id: string;
  tipo: string;
  canal: NotificationChannel;
  mensagem: string;
  estado: NotificationEstado;
  link_accao: string | null;
  enviada_em: string | null;
  lida_em: string | null;
  created_at: string;
}

export interface Direccao {
  id: string;
  nome: string;
  sigla: string;
  responsavel_faq_owner: string | null;
}

// === API Response Wrappers ===
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// === Auth Context ===
export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  /** Função na empresa (cargo). O canto da conta mostra isto, não o papel de mentor. */
  funcao?: string | null;
  departamento?: string;
  processo_id?: string;
  /** Tem perfil de mentor activo (pode acontecer também com rh_admin). */
  is_mentor?: boolean;
  foto_url?: string | null;
  /** Pertence ao grupo DEV (ou é o administrador que ainda o vai criar). */
  is_dev?: boolean;
  /** Páginas do catálogo. `visivel: false` fica escondida no menu e na rota. */
  paginas?: { rota: string; visivel: boolean }[];
}

// === Chat Types ===
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fonte?: string;
  score_relevancia?: number;
  timestamp: string;
  isLoading?: boolean;
}

export interface ChatRequest {
  mensagem: string;
  sessao_id: string;
  modo: 'interno' | 'externo';
}

export interface ChatResponse {
  resposta: string;
  fonte_documento?: string;
  sessao_id: string;
  score_relevancia?: number;
}

// === Dashboard KPIs ===
export interface DashboardKPIs {
  vagas_abertas: number;
  candidatos_activos: number;
  colaboradores_onboarding: number;
  taxa_resolucao_ia: number;
  time_to_fill_medio: number;
  satisfacao_media: number;
}

// Legacy aliases for backward compatibility
export type Notification = Notificacao;
export type User = Utilizador;
export type OffboardingMotivo = 'rescisao' | 'reforma' | 'fim_contrato' | 'outro';
export type TarefaEstado = 'pendente' | 'concluida' | 'aguarda_validacao' | 'validada';

export interface OffboardingProcess {
  id: string;
  colaborador_id: string;
  colaborador?: Utilizador;
  criado_por_id: string;
  data_saida: string;
  motivo: OffboardingMotivo;
  estado: ProcessStatus;
  arquivado_em?: string;
  arquivado_por_id?: string;
  tarefas?: TarefaOffboarding[];
}

export interface TarefaOffboarding {
  id: string;
  processo_off_id: string;
  nome: string;
  categoria: 'documentacao' | 'equipamentos' | 'acessos_it' | 'passagem_pasta' | 'rh';
  responsavel: string;
  requer_validacao_rh: boolean;
  estado: TarefaEstado;
}
export type ProcessStatus = 'iniciado' | 'em_progresso' | 'em_atraso' | 'concluido' | 'arquivado';
export type EtapaEstado = ProcessStatus | 'aguarda_aprovacao';
export type EtapaTipo = 'documento' | 'formacao' | 'tarefa' | 'aprovacao';
export type DocumentStatus = 'pendente' | 'submetido' | 'em_revisao' | 'aprovado' | 'rejeitado';

export interface OnboardingProcess {
  id: string;
  colaborador_id: string;
  colaborador?: Utilizador;
  criado_por_id: string;
  estado: ProcessStatus;
  progresso_pct: number;
  link_token: string;
  link_url?: string;
  data_inicio: string;
  data_fim_prev: string;
  etapas?: Etapa[];
  documentos?: Documento[];
}

export interface Etapa {
  id: string;
  processo_id: string;
  fase: 1 | 2 | 3;
  nome: string;
  descricao?: string;
  tipo: EtapaTipo;
  prazo_dias: number;
  estado: EtapaEstado;
  concluida_em?: string;
  ultimo_alerta_em?: string;
  requer_aprovacao?: boolean;
}

export interface Documento {
  id: string;
  processo_id: string;
  colaborador_id: string;
  tipo: string;
  nome_ficheiro: string;
  url_sharepoint: string;
  tamanho_bytes: number;
  estado: DocumentStatus;
  criado_em: string;
}

export type DashboardSummary = DashboardKPIs;

export interface Alerta {
  id: string;
  tipo: 'etapa_atraso' | 'documento_pendente' | 'offboarding_critico' | 'aprovacao_pendente' | 'vaga_prazo' | 'faq_negativa' | 'chatbot_escalacao';
  prioridade: 'critico' | 'alto' | 'medio';
  colaborador_nome: string;
  colaborador_id: string;
  descricao: string;
  link: string;
  criado_em: string;
  dispensado?: boolean;
}

// Dashboard Semanal de Recrutamento — dataset importado via Excel (folha BD_Recrutamento)
export type StatusRegistoSemanal = 'Em Curso' | 'Em Atraso' | 'Fechado' | 'Cancelado';
export type PrioridadeRegistoSemanal = 'Alta' | 'Média' | 'Baixa';

export interface RegistoSemanal {
  referencia: string;
  funcao: string;
  direccao: string;
  departamento: string | null;
  tipo_vaga: string | null;
  orcamento: string | null;
  aprov_upst: string | null;
  aprov_fin: string | null;
  responsavel: string | null;
  status: StatusRegistoSemanal;
  prioridade: PrioridadeRegistoSemanal;
  critica: boolean;
  candidatos: number;
  dias_aberto: number | null;
  sem_candidatos: boolean;
  sem_orcamento: boolean;
  data_abertura: string | null;
  data_fecho: string | null;
}

// Candidato importado via aba "Candidatos" do Excel semanal
export type EstadoCandidatoImportado = 'em_analise' | 'aprovado' | 'rejeitado';

export interface CandidatoImportado {
  id: string;
  nome: string;
  funcao: string | null;
  departamento: string | null;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  data: string | null;
  estado: EstadoCandidatoImportado;
  colaborador_id?: string | null;
  admissao_id?: string | null;
  observacoes?: string | null;
}
