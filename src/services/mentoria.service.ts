import { apiClient } from './api.client';
import type { DocumentoPedido } from './anexos.service';
import type {
  Mentor, MentorAssignment, MentorAvaliacao, ColaboradorFeedback,
  TimelineEvento, NotificacaoOnboarding, ComentarioMentor,
  CategoriaTrilho, MomentoAvaliacao,
} from '@/lib/types';

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

// === Mentores ===
export const mentorsService = {
  /** `silencioso`: usado em dropdowns de modais — não mostra o loader global. */
  list: (silencioso = false) => data<Array<Mentor & { nome: string; email: string; departamento: string }>>(
    apiClient.get('/mentors', { silencioso }),
  ),
  create: (p: { nome: string; email?: string; departamento: string; categorias_suportadas?: CategoriaTrilho[]; bio?: string }) =>
    data<{ mentor: Mentor; credenciais: { email: string; password: string } | null }>(
      apiClient.post('/mentors', p),
    ),
  update: (id: string, p: Partial<Mentor>) => data<Mentor>(apiClient.patch(`/mentors/${id}`, p)),
  remove: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/mentors/${id}`)),
  /** Cria a conta (se faltar) e envia o convite para definir a password. */
  criarAcesso: (id: string) =>
    data<{ utilizador_id: string | null; convite: 'enviado' | 'ja_tinha_acesso' }>(apiClient.post(`/mentors/${id}/acesso`)),
};

// === Atribuições ===
export const assignmentsService = {
  list: (colaboradorId: string) =>
    data<MentorAssignment[]>(apiClient.get(`/mentor-assignments/${colaboradorId}`)),
  create: (payload: { colaborador_id: string; mentor_id: string }) =>
    data<MentorAssignment & { convite_mentor?: 'enviado' | 'ja_tinha_acesso' | 'sem_email' | 'falhou' }>(
      apiClient.post('/mentor-assignments', payload),
    ),
  terminar: (id: string) => data<{ ok: boolean }>(apiClient.delete(`/mentor-assignments/${id}`)),
};

// === Portal do Mentor ===
export interface MentorDashboard {
  mentorados: number;
  concluidos: number;
  em_atraso: number;
  progresso_medio: number;
  avaliacoes_pendentes: number;
  checkpoints_proximos: Array<{
    id: string;
    etapa_id: string;
    etapa_nome: string;
    data_prevista: string;
    colaborador_id: string;
    colaborador_nome: string;
  }>;
}

export interface MentoradoRow {
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
  atribuido_em: string;
  /** Mentor da atribuição activa. Só vem no detalhe do mentorado. */
  mentor_nome?: string | null;
}

export interface EtapaMentor {
  id: string;
  colaborador_id: string;
  etapa_id: string;
  estado: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  data_prevista: string | null;
  observacoes: string | null;
  responsavel: string | null;
  etapa_nome: string;
  etapa_tipo: string;
  duracao_dias: number;
  descricao: string | null;
  ordem: number;
  fase: number;
  fase_nome: string | null;
  responsavel_default: string | null;
  checklist_items: Array<{ key: string; label: string; obrigatorio?: boolean; responsavel?: string }>;
  obrigatoria: boolean;
  bloqueante: boolean;
  documentos_pedidos?: DocumentoPedido[];
}

export interface ChecklistItemProgresso {
  progresso_id: string;
  item_key: string;
  concluido: boolean;
  concluido_em: string | null;
  comentario: string | null;
}

export const mentorPortalService = {
  dashboard: () => data<MentorDashboard>(apiClient.get('/mentor/dashboard')),
  mentorados: () => data<MentoradoRow[]>(apiClient.get('/mentor/mentorados')),
  detalhe: (colaboradorId: string) => data<{
    colaborador: MentoradoRow;
    progresso: EtapaMentor[];
    checklist_progresso: ChecklistItemProgresso[];
    comentarios: ComentarioMentor[];
  }>(apiClient.get(`/mentor/mentorados/${colaboradorId}`)),
  atualizarEtapa: (progressoId: string, p: Partial<{ estado: string; data_inicio: string; data_prevista: string; observacoes: string; responsavel: string }>) =>
    data<EtapaMentor>(apiClient.patch(`/mentor/etapa/${progressoId}`, p)),
  concluirEtapa: (progressoId: string) =>
    data<{ ok: boolean }>(apiClient.post(`/mentor/etapa/${progressoId}/concluir`, {})),
  toggleChecklist: (p: { progresso_id: string; item_key: string; concluido: boolean; comentario?: string }) =>
    data<ChecklistItemProgresso>(apiClient.post('/mentor/checklist', p)),
  comentar: (p: { colaborador_id: string; texto: string; visivel_colaborador?: boolean; etapa_progresso_id?: string }) =>
    data<ComentarioMentor>(apiClient.post('/mentor/comentarios', p)),
};

// === Avaliações do Mentor ===
export const mentorAvaliacoesService = {
  listPorColaborador: (colaboradorId: string) =>
    data<MentorAvaliacao[]>(apiClient.get(`/mentor-avaliacoes/colaborador/${colaboradorId}`)),
  /** `soMeus`: só as do mentor autenticado (relevante para admins que também são mentores). */
  list: (soMeus = false) =>
    data<MentorAvaliacao[]>(apiClient.get('/mentor-avaliacoes', { params: soMeus ? { meus: 1 } : undefined })),
  get: (id: string) => data<MentorAvaliacao>(apiClient.get(`/mentor-avaliacoes/${id}`)),
  create: (p: { colaborador_id: string; momento: MomentoAvaliacao; categoria: CategoriaTrilho; periodo_inicio?: string; periodo_fim?: string }) =>
    data<MentorAvaliacao>(apiClient.post('/mentor-avaliacoes', p)),
  update: (id: string, p: Partial<MentorAvaliacao> & { submeter?: boolean; validar?: boolean }) =>
    data<MentorAvaliacao>(apiClient.patch(`/mentor-avaliacoes/${id}`, p)),
};

// === Feedback do Colaborador ===
export const colaboradorFeedbackService = {
  meus: () => data<ColaboradorFeedback[]>(apiClient.get('/colaborador-feedback')),
  porColaborador: (colaboradorId: string) =>
    data<ColaboradorFeedback[]>(apiClient.get(`/colaborador-feedback/colaborador/${colaboradorId}`)),
  create: (p: { momento: MomentoAvaliacao; categoria: CategoriaTrilho; colaborador_id?: string }) =>
    data<ColaboradorFeedback>(apiClient.post('/colaborador-feedback', p)),
  update: (id: string, p: Partial<ColaboradorFeedback> & { submeter?: boolean }) =>
    data<ColaboradorFeedback>(apiClient.patch(`/colaborador-feedback/${id}`, p)),
};

// === Timeline / Notificações / Comentários ===
export const timelineService = {
  porColaborador: (colaboradorId: string) =>
    data<TimelineEvento[]>(apiClient.get(`/onboarding-timeline/${colaboradorId}`)),
};

export const notificacoesOnboardingService = {
  /** `silencioso`: polling do sino no topo — não mostra o loader global. */
  inbox: (silencioso = false) => data<{ items: NotificacaoOnboarding[]; nao_lidas: number }>(
    apiClient.get('/onboarding-notificacoes', { silencioso }),
  ),
  marcarLida: (id: string) => data<{ ok: boolean }>(apiClient.patch(`/onboarding-notificacoes/${id}`, {})),
  marcarTodasLidas: () => data<{ ok: boolean }>(apiClient.post('/onboarding-notificacoes/mark-all-read', {})),
};

export const comentariosService = {
  porColaborador: (colaboradorId: string) =>
    data<ComentarioMentor[]>(apiClient.get(`/onboarding-comentarios/${colaboradorId}`)),
};
