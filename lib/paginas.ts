import type { UserRole } from '@/lib/types';

/** Página da aplicação que pode ser atribuída a um grupo. */
export interface PaginaCatalogo {
  chave: string;
  nome: string;
  rota: string;
  modulo: string;
  /** Perfis da concessão inicial. Uma página nova não entra nessa concessão: fica fechada até ser marcada em Acessos. */
  perfis: UserRole[];
  ordem: number;
  /** Gestão de acessos: fica sempre reservada ao grupo DEV. */
  sistema?: boolean;
}

const todos: UserRole[] = ['rh_admin', 'mentor', 'novo_colaborador'];
const admin: UserRole[] = ['rh_admin'];
const mentor: UserRole[] = ['mentor', 'rh_admin'];
const colaborador: UserRole[] = ['novo_colaborador', 'rh_admin'];

/** Catálogo das páginas do menu. A sincronização na API faz o upsert para `acesso`. */
export const PAGINAS: PaginaCatalogo[] = [
  { chave: 'inicio', nome: 'Início', rota: '/inicio', modulo: 'Geral', perfis: todos, ordem: 10 },
  { chave: 'noticias', nome: 'Notícias', rota: '/noticias', modulo: 'Geral', perfis: todos, ordem: 15 },
  { chave: 'eventos', nome: 'Eventos', rota: '/eventos', modulo: 'Geral', perfis: todos, ordem: 20 },
  { chave: 'reconhecimento', nome: 'Reconhecimento', rota: '/reconhecimento', modulo: 'Geral', perfis: todos, ordem: 30 },
  { chave: 'meu-perfil', nome: 'O meu perfil', rota: '/meu-perfil', modulo: 'Geral', perfis: todos, ordem: 40 },
  { chave: 'dashboard', nome: 'Dashboard', rota: '/', modulo: 'Geral', perfis: admin, ordem: 50 },

  { chave: 'recrutamento-semanal', nome: 'Dashboard Semanal', rota: '/recrutamento/dashboard-semanal', modulo: 'Recrutamento', perfis: admin, ordem: 110 },
  { chave: 'candidatos', nome: 'Candidatos', rota: '/recrutamento/candidatos', modulo: 'Recrutamento', perfis: admin, ordem: 120 },

  { chave: 'admissao', nome: 'Processos', rota: '/admissao', modulo: 'Admissão', perfis: admin, ordem: 210 },

  { chave: 'onboarding', nome: 'Novos Colaboradores', rota: '/onboarding', modulo: 'Onboarding', perfis: admin, ordem: 310 },
  { chave: 'colaboradores', nome: 'Colaboradores', rota: '/colaboradores', modulo: 'Onboarding', perfis: admin, ordem: 315 },
  { chave: 'fichas', nome: 'Fichas do Colaborador', rota: '/onboarding/fichas', modulo: 'Onboarding', perfis: admin, ordem: 320 },
  { chave: 'trilhos', nome: 'Trilhos', rota: '/onboarding/trilhos', modulo: 'Onboarding', perfis: admin, ordem: 330 },
  { chave: 'catalogos', nome: 'Funções, direcções e categorias', rota: '/onboarding/catalogos', modulo: 'Onboarding', perfis: admin, ordem: 340 },
  { chave: 'quiz', nome: 'Quiz de Boas-Vindas', rota: '/onboarding/quiz', modulo: 'Onboarding', perfis: admin, ordem: 350 },
  { chave: 'videos', nome: 'Vídeos de Boas-Vindas', rota: '/onboarding/videos', modulo: 'Onboarding', perfis: admin, ordem: 360 },
  { chave: 'evolucao', nome: 'Dashboard de Evolução', rota: '/onboarding/evolucao', modulo: 'Onboarding', perfis: admin, ordem: 370 },
  { chave: 'documentos-empresa', nome: 'Documentos da Empresa', rota: '/onboarding/documentos', modulo: 'Onboarding', perfis: admin, ordem: 380 },
  { chave: 'documentos-exigidos', nome: 'Documentos Exigidos', rota: '/onboarding/documentos-exigidos', modulo: 'Onboarding', perfis: admin, ordem: 390 },

  { chave: 'mentores', nome: 'Mentores', rota: '/mentores', modulo: 'Mentoria', perfis: admin, ordem: 410 },
  { chave: 'centro-avaliacoes', nome: 'Centro de Avaliações', rota: '/avaliacoes', modulo: 'Mentoria', perfis: admin, ordem: 420 },
  { chave: 'comparacao-360', nome: 'Comparação 360°', rota: '/comparacao-360', modulo: 'Mentoria', perfis: admin, ordem: 430 },

  { chave: 'mentor', nome: 'Dashboard', rota: '/mentor', modulo: 'Mentoria', perfis: mentor, ordem: 610 },
  { chave: 'mentor-mentorados', nome: 'Meus Mentorados', rota: '/mentor/mentorados', modulo: 'Mentoria', perfis: mentor, ordem: 620 },
  { chave: 'mentor-avaliacoes', nome: 'Avaliações', rota: '/mentor/avaliacoes', modulo: 'Mentoria', perfis: mentor, ordem: 630 },
  { chave: 'mentor-notificacoes', nome: 'Notificações', rota: '/mentor/notificacoes', modulo: 'Mentoria', perfis: mentor, ordem: 640 },

  { chave: 'meu-trilho', nome: 'Meu Trilho', rota: '/onboarding/meu-trilho', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 710 },
  { chave: 'minha-ficha', nome: 'A Minha Ficha', rota: '/colaborador/ficha', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 720 },
  { chave: 'timeline', nome: 'Timeline', rota: '/colaborador/timeline', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 730 },
  { chave: 'comentarios-mentor', nome: 'Comentários do Mentor', rota: '/colaborador/comentarios', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 740 },
  { chave: 'feedback', nome: 'Feedback / Auto-avaliação', rota: '/colaborador/feedback', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 750 },
  { chave: 'meus-documentos', nome: 'Documentos da Empresa', rota: '/colaborador/documentos', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 760 },
  { chave: 'submissoes', nome: 'Submissão de Documentos', rota: '/colaborador/submissoes', modulo: 'O Meu Onboarding', perfis: colaborador, ordem: 770 },

  { chave: 'utilizadores', nome: 'Utilizadores', rota: '/utilizadores', modulo: 'Sistema', perfis: admin, ordem: 810 },
  { chave: 'audit', nome: 'Audit Log', rota: '/configuracoes/audit', modulo: 'Sistema', perfis: admin, ordem: 820 },
  { chave: 'definicoes', nome: 'Definições', rota: '/configuracoes', modulo: 'Sistema', perfis: admin, ordem: 830 },
  { chave: 'acessos', nome: 'Acessos', rota: '/acessos', modulo: 'Sistema', perfis: todos, ordem: 840, sistema: true },
  { chave: 'assistente', nome: 'Assistente Virtual', rota: '/assistente', modulo: 'Assistente IA', perfis: todos, ordem: 910 },
];

export interface PaginaVisivel {
  rota: string;
  visivel: boolean;
}

/** A rota do catálogo que melhor cobre o caminho (a mais específica). */
export function paginaMaisEspecifica<T extends { rota: string }>(pathname: string, paginas: T[]): T | undefined {
  let melhor: T | undefined;
  for (const pagina of paginas) {
    const cobre = pagina.rota === '/'
      ? pathname === '/'
      : pathname === pagina.rota || pathname.startsWith(`${pagina.rota}/`);
    if (!cobre) continue;
    if (!melhor || pagina.rota.length > melhor.rota.length) melhor = pagina;
  }
  return melhor;
}

/** Sem catálogo carregado, não esconde nada (sessão antiga ou migração por aplicar). */
export function podeVerRota(pathname: string, paginas: PaginaVisivel[] | undefined): boolean {
  if (!paginas?.length) return true;
  const pagina = paginaMaisEspecifica(pathname, paginas);
  return pagina ? pagina.visivel : true;
}

const DESTINOS = ['/inicio', '/meu-perfil', '/eventos', '/reconhecimento', '/'];

/** Caminho para onde mandar quem abriu uma página restrita. `null` se a rota é permitida. */
export function destinoQuandoBloqueado(pathname: string, paginas: PaginaVisivel[] | undefined): string | null {
  if (!paginas || podeVerRota(pathname, paginas)) return null;
  return DESTINOS.find((rota) => rota !== pathname && podeVerRota(rota, paginas)) ?? '/unauthorized';
}

/** Item do menu. A página de acessos só aparece a quem a tem visível. */
export function itemDeMenuVisivel(href: string, paginas: PaginaVisivel[] | undefined): boolean {
  if (href === '/acessos') return paginas?.some((p) => p.rota === '/acessos' && p.visivel) ?? false;
  if (!paginas) return true;
  const pagina = paginas.find((p) => p.rota === href);
  return pagina ? pagina.visivel : true;
}
