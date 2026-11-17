import { apiClient } from './api.client';
import type { DocumentoPedido, EtapaAnexo } from './anexos.service';

// ===== Tipos partilhados =====

export type QuizTipo = 'verdadeiro_falso' | 'escolha_multipla' | 'informativa';

export interface QuizPergunta {
  id: string;
  tipo: QuizTipo;
  pergunta: string;
  opcoes: string[];
  resposta_correcta: number | null;
  explicacao: string | null;
  activa?: boolean;
  created_at?: string;
}

export interface WelcomeVideo {
  slot: 'institucional' | 'saude_seguranca' | string;
  titulo: string;
  url: string | null;
  descricao: string | null;
  duracao_minima_segundos?: number | null;
  ativo?: boolean;
  ordem?: number;
  updated_at?: string;
}

export interface WelcomeEstado {
  welcome_completed: boolean;
  colaborador_id: string | null;
  /** Ficha do Trabalhador já submetida (senão, é o primeiro passo do Welcome Flow). */
  ficha_submetida: boolean;
  /** Só os vídeos activos, pela ordem definida no admin. */
  videos: WelcomeVideo[];
  quiz_ativo: boolean;
  quiz: QuizPergunta[];
}

export interface QuizResultadoDetalhe {
  pergunta_id: string;
  escolha: number | null;
  correcta: boolean;
}

export interface QuizResultadoAdmin {
  id: string;
  total: number;
  acertos: number;
  percentagem: number;
  created_at: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
}

export interface DocumentoEmpresa {
  id: string;
  nome: string;
  categoria: 'politica' | 'regulamento' | 'manual' | 'guia' | string;
  url: string | null;
  ficheiro_ref: string | null;
  descricao: string | null;
  created_at?: string;
}

export interface DocumentoExigido {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  categoria: string | null;
  ordem: number;
  activo?: boolean;
}

export type EstadoSubmissao = 'pendente' | 'submetido' | 'aprovado' | 'rejeitado';

export interface SubmissaoItem {
  documento_exigido_id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  ordem: number;
  submissao_id: string | null;
  estado: EstadoSubmissao;
  ficheiro_nome: string | null;
  motivo_rejeicao: string | null;
  submetido_em: string | null;
  avaliado_em: string | null;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

// ===== Welcome Flow (colaborador) =====

export const welcomeService = {
  estado: () => data<WelcomeEstado>(apiClient.get('/welcome/estado')),
  completar: (payload: { total: number; acertos: number; detalhes: QuizResultadoDetalhe[] }) =>
    data<{ ok: boolean; welcome_completed: boolean; percentagem?: number }>(
      apiClient.post('/welcome/completar', payload)
    ),
};

// ===== Vídeos de boas-vindas (admin) =====

export const welcomeVideosService = {
  list: () => data<WelcomeVideo[]>(apiClient.get('/welcome-videos')),
  update: (slot: string, payload: Partial<WelcomeVideo>) =>
    data<WelcomeVideo>(apiClient.patch(`/welcome-videos/${slot}`, payload)),
  create: (payload: Partial<WelcomeVideo>) => data<WelcomeVideo>(apiClient.post('/welcome-videos', payload)),
  remove: (slot: string) => data<{ ok: boolean }>(apiClient.delete(`/welcome-videos/${slot}`)),
  reordenar: (slots: string[]) => data<{ ok: boolean }>(apiClient.post('/welcome-videos/reordenar', { slots })),
};

export interface QuizConfig {
  perguntas_por_sessao: number;
  ordem_aleatoria: boolean;
  quiz_ativo: boolean;
}

// ===== Quiz (admin) =====

export const quizService = {
  listPerguntas: () => data<QuizPergunta[]>(apiClient.get('/quiz-perguntas')),
  createPergunta: (p: Partial<QuizPergunta>) => data<QuizPergunta>(apiClient.post('/quiz-perguntas', p)),
  updatePergunta: (id: string, p: Partial<QuizPergunta>) =>
    data<QuizPergunta>(apiClient.patch(`/quiz-perguntas/${id}`, p)),
  deletePergunta: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/quiz-perguntas/${id}`)),
  getConfig: () => data<QuizConfig>(apiClient.get('/quiz-config')),
  updateConfig: (p: Partial<QuizConfig>) => data<QuizConfig>(apiClient.patch('/quiz-config', p)),
  resultados: () => data<QuizResultadoAdmin[]>(apiClient.get('/quiz-resultados')),
};

// ===== Documentos da Empresa =====

export const documentosEmpresaService = {
  list: () => data<DocumentoEmpresa[]>(apiClient.get('/documentos-empresa')),
  create: (p: Partial<DocumentoEmpresa>) => data<DocumentoEmpresa>(apiClient.post('/documentos-empresa', p)),
  update: (id: string, p: Partial<DocumentoEmpresa>) =>
    data<DocumentoEmpresa>(apiClient.patch(`/documentos-empresa/${id}`, p)),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/documentos-empresa/${id}`)),
};

// ===== Documentos Exigidos =====

export const documentosExigidosService = {
  list: () => data<DocumentoExigido[]>(apiClient.get('/documentos-exigidos')),
  create: (p: Partial<DocumentoExigido>) => data<DocumentoExigido>(apiClient.post('/documentos-exigidos', p)),
  update: (id: string, p: Partial<DocumentoExigido>) =>
    data<DocumentoExigido>(apiClient.patch(`/documentos-exigidos/${id}`, p)),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/documentos-exigidos/${id}`)),
};

// ===== Colaboradores (admin) =====

export interface ColaboradorRow {
  id: string;
  nome: string;
  funcao: string;
  direccao: string;
  email: string | null;
  categoria: string | null;
  data_admissao: string;
  estado_onboarding: string;
  welcome_completed: boolean;
  trilho_id: string | null;
  etapas_concluidas: number | string;
  etapas_total: number | string;
  etapas_atrasadas?: number | string;
}

export interface Credenciais {
  email: string;
  password: string;
}

export interface EtapaProgresso {
  id: string;
  estado: 'pendente' | 'em_curso' | 'concluida' | 'atrasada';
  data_inicio: string | null;
  data_conclusao: string | null;
  data_prevista: string | null;
  etapa_id: string;
  trilho_id: string;
  colaborador_id: string;
  etapa_nome: string;
  etapa_descricao: string | null;
  etapa_tipo: string;
  duracao_dias: number;
  ordem: number;
  obrigatoria: boolean;
  bloqueante: boolean;
  documentos_pedidos: DocumentoPedido[];
  anexos: EtapaAnexo[];
}

export interface MeuTrilho {
  colaborador: { id: string; nome: string; funcao: string; trilho_id: string | null } | null;
  trilho: { id: string; nome: string; funcao: string; duracao_estimada: number | null } | null;
  progresso: EtapaProgresso[];
}

export interface TrilhoEtapaInput {
  nome: string;
  tipo?: string;
  duracao_dias?: number;
  descricao?: string | null;
  obrigatoria?: boolean;
  bloqueante?: boolean;
  ordem?: number;
  responsavel_default?: string | null;
  documentos_pedidos?: DocumentoPedido[];
}

export interface Trilho {
  id: string;
  nome: string;
  funcao: string;
  categoria: string | null;
  descricao: string | null;
  duracao_estimada: number | null;
  versao: string;
  activo: boolean;
  is_template?: boolean;
  num_etapas?: number;
  etapas: (TrilhoEtapaInput & { id?: string })[];
}

export interface ColaboradoresPagina {
  items: ColaboradorRow[];
  total: number;
  pagina: number;
  tamanho: number;
  resumo: {
    em_onboarding: number;
    concluidos: number;
    progresso_medio: number;
    atrasados: number;
    funcoes: string[];
    direccoes: string[];
    categorias: string[];
  };
}

export const colaboradoresService = {
  list: () => data<ColaboradorRow[]>(apiClient.get('/colaboradores')),
  /** Uma página da lista. O servidor cacheia a leitura; não traz os restantes. */
  listar: (
    params: { pagina: number; tamanho: number; q?: string; direccao?: string; funcao?: string; categoria?: string; estado?: string },
    silencioso = false,
  ) => data<ColaboradoresPagina>(apiClient.get('/colaboradores', { params, silencioso })),
  getById: (id: string) => data<{ colaborador: ColaboradorRow; progresso: unknown[] }>(apiClient.get(`/colaboradores/${id}`)),
  create: (p: { nome: string; funcao: string; direccao: string; data_admissao: string; categoria?: string; email?: string; candidato_id_origem?: string; mentor_id?: string }) =>
    data<{ colaborador: ColaboradorRow; credenciais: Credenciais | null }>(apiClient.post('/colaboradores', p)),
  update: (id: string, p: Partial<{ nome: string; funcao: string; direccao: string; categoria: string; email: string; estado_onboarding: string }>) =>
    data<ColaboradorRow>(apiClient.patch(`/colaboradores/${id}`, p)),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/colaboradores/${id}`)),
  atribuirTrilho: (id: string, trilhoId: string, etapas?: Array<{ ordem: number; data_inicio: string; data_fim: string }>) =>
    data<{ ok: boolean; trilho_id: string; etapas: number }>(apiClient.post(`/colaboradores/${id}/atribuir-trilho`, { trilho_id: trilhoId, etapas })),
  meuTrilho: () => data<MeuTrilho>(apiClient.get('/colaboradores/meu-trilho')),
  concluirEtapa: (progressoId: string) =>
    data<{ ok: boolean }>(apiClient.patch(`/colaboradores/etapa/${progressoId}/concluir`, {})),
};

export const trilhosService = {
  list: () => data<Trilho[]>(apiClient.get('/trilhos')),
  get: (id: string) => data<Trilho>(apiClient.get(`/trilhos/${id}`)),
  create: (p: Partial<Trilho>) => data<Trilho>(apiClient.post('/trilhos', p)),
  update: (id: string, p: Partial<Trilho>) => data<Trilho>(apiClient.patch(`/trilhos/${id}`, p)),
  duplicar: (id: string) => data<Trilho>(apiClient.post(`/trilhos/${id}/duplicar`, {})),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/trilhos/${id}`)),
};

// ===== Submissões (colaborador + admin) =====

export const submissoesService = {
  minhas: () => data<SubmissaoItem[]>(apiClient.get('/submissoes')),
  confirmar: (documento_exigido_id: string) =>
    data<unknown>(apiClient.post('/submissoes', { documento_exigido_id })),
  desmarcar: (submissaoId: string) =>
    data<unknown>(apiClient.delete(`/submissoes/${submissaoId}`)),
  doColaborador: (colaboradorId: string) =>
    data<SubmissaoItem[]>(apiClient.get(`/submissoes/colaborador/${colaboradorId}`)),
  avaliar: (submissaoId: string, payload: { estado: EstadoSubmissao; motivo_rejeicao?: string }) =>
    data<unknown>(apiClient.patch(`/submissoes/${submissaoId}`, payload)),
};
