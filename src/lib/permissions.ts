import type { UserRole } from '@/lib/types';

type Resource =
  | 'dashboard'
  | 'recrutamento'
  | 'recrutamento.vagas'
  | 'recrutamento.candidatos'
  | 'recrutamento.entrevistas'
  | 'admissao'
  | 'onboarding'
  | 'onboarding.trilhos'
  | 'onboarding.colaboradores'
  | 'onboarding.meu_trilho'
  | 'assistente'
  | 'assistente.escalacoes'
  | 'base_conhecimento'
  | 'base_conhecimento.editar'
  | 'analitica'
  | 'relatorios'
  | 'configuracoes'
  | 'audit_log'
  | 'mentor.portal'
  | 'mentor.mentorados'
  | 'mentor.avaliacoes'
  | 'mentor.notificacoes'
  | 'mentoria.mentores'
  | 'mentoria.centro_avaliacoes'
  | 'mentoria.comparacao_360'
  | 'colaborador.meu_trilho'
  | 'colaborador.feedback'
  | 'colaborador.timeline'
  | 'colaborador.comentarios';

type Action = 'view' | 'create' | 'edit' | 'delete';

type PermissionMap = Record<UserRole, Partial<Record<Resource, Action[]>>>;

const PERMISSIONS: PermissionMap = {
  rh_admin: {
    dashboard: ['view'],
    recrutamento: ['view', 'create', 'edit', 'delete'],
    'recrutamento.vagas': ['view', 'create', 'edit', 'delete'],
    'recrutamento.candidatos': ['view', 'create', 'edit', 'delete'],
    'recrutamento.entrevistas': ['view', 'create', 'edit', 'delete'],
    admissao: ['view', 'create', 'edit', 'delete'],
    onboarding: ['view', 'create', 'edit', 'delete'],
    'onboarding.trilhos': ['view', 'create', 'edit', 'delete'],
    'onboarding.colaboradores': ['view', 'create', 'edit', 'delete'],
    assistente: ['view'],
    'assistente.escalacoes': ['view', 'create', 'edit', 'delete'],
    base_conhecimento: ['view', 'create', 'edit', 'delete'],
    'base_conhecimento.editar': ['view', 'create', 'edit', 'delete'],
    analitica: ['view'],
    relatorios: ['view', 'create'],
    configuracoes: ['view', 'edit'],
    audit_log: ['view'],
    'mentoria.mentores': ['view', 'create', 'edit', 'delete'],
    'mentoria.centro_avaliacoes': ['view', 'edit'],
    'mentoria.comparacao_360': ['view'],
  },
  mentor: {
    'mentor.portal': ['view'],
    'mentor.mentorados': ['view', 'edit'],
    'mentor.avaliacoes': ['view', 'create', 'edit'],
    'mentor.notificacoes': ['view', 'edit'],
    assistente: ['view'],
  },
  novo_colaborador: {
    'onboarding.meu_trilho': ['view'],
    assistente: ['view'],
    'colaborador.meu_trilho': ['view'],
    'colaborador.feedback': ['view', 'create', 'edit'],
    'colaborador.timeline': ['view'],
    'colaborador.comentarios': ['view'],
  },
};

export function hasPermission(role: UserRole | null, resource: Resource, action: Action = 'view'): boolean {
  if (!role) return false;
  const resourcePermissions = PERMISSIONS[role]?.[resource];
  if (!resourcePermissions) return false;
  return resourcePermissions.includes(action);
}

export type { Resource, Action };
