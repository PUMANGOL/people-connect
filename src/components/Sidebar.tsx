import { useEffect, useState, type ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus,
  UserCheck, ClipboardList, LayoutPanelTop,
  Bot, Settings, FileText,
  Route,
  HelpCircle, Video, TrendingUp, FolderOpen, ClipboardCheck, UploadCloud,
  ClipboardEdit, Bell, Activity, MessageSquare, LineChart,
  BookOpen, GraduationCap, Tags, Home, ChevronDown, CalendarDays, IdCard, Award, UserRound, KeyRound, Newspaper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGINAS, type PaginaVisivel } from '@/lib/paginas';
import { useUIStore } from '@/src/store/ui.store';
import { useAuthStore } from '@/src/store/auth.store';
import type { UserRole } from '@/lib/types';

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Geral',
    items: [
      { name: 'Início', href: '/inicio', icon: Home },
      { name: 'Notícias', href: '/noticias', icon: Newspaper },
      { name: 'Eventos', href: '/eventos', icon: CalendarDays },
      { name: 'Reconhecimento', href: '/reconhecimento', icon: Award },
      { name: 'O meu perfil', href: '/meu-perfil', icon: UserRound },
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Recrutamento',
    items: [
      { name: 'Dashboard Semanal', href: '/recrutamento/dashboard-semanal', icon: LayoutPanelTop },
      { name: 'Candidatos', href: '/recrutamento/candidatos', icon: Users },
    ],
  },
  {
    label: 'Admissão',
    items: [
      { name: 'Processos', href: '/admissao', icon: UserPlus },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { name: 'Novos Colaboradores', href: '/onboarding', icon: UserCheck },
      { name: 'Colaboradores', href: '/colaboradores', icon: Users },
      { name: 'Fichas do Colaborador', href: '/onboarding/fichas', icon: IdCard },
      { name: 'Trilhos', href: '/onboarding/trilhos', icon: ClipboardList },
      { name: 'Funções, direcções e categorias', href: '/onboarding/catalogos', icon: Tags },
      { name: 'Quiz de Boas-Vindas', href: '/onboarding/quiz', icon: HelpCircle },
      { name: 'Vídeos de Boas-Vindas', href: '/onboarding/videos', icon: Video },
      { name: 'Dashboard de Evolução', href: '/onboarding/evolucao', icon: TrendingUp },
      { name: 'Documentos da Empresa', href: '/onboarding/documentos', icon: FolderOpen },
      { name: 'Documentos Exigidos', href: '/onboarding/documentos-exigidos', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Mentoria',
    items: [
      { name: 'Mentores', href: '/mentores', icon: GraduationCap },
      { name: 'Centro de Avaliações', href: '/avaliacoes', icon: ClipboardEdit },
      { name: 'Comparação 360°', href: '/comparacao-360', icon: LineChart },
    ],
  },
  {
    label: 'Assistente IA',
    items: [
      { name: 'Assistente Virtual', href: '/assistente', icon: Bot },
    ],
  },
];

const MENTOR_NAV: NavGroup[] = [
  {
    label: 'Geral',
    items: [
      { name: 'Início', href: '/inicio', icon: Home },
      { name: 'Notícias', href: '/noticias', icon: Newspaper },
      { name: 'Eventos', href: '/eventos', icon: CalendarDays },
      { name: 'Reconhecimento', href: '/reconhecimento', icon: Award },
      { name: 'O meu perfil', href: '/meu-perfil', icon: UserRound },
    ],
  },
  {
    label: 'Mentoria',
    items: [
      { name: 'Dashboard', href: '/mentor', icon: LayoutDashboard },
      { name: 'Meus Mentorados', href: '/mentor/mentorados', icon: UserCheck },
      { name: 'Avaliações', href: '/mentor/avaliacoes', icon: ClipboardEdit },
      { name: 'Notificações', href: '/mentor/notificacoes', icon: Bell },
    ],
  },
];

// Admin que também é mentor: acesso ao seu portal de mentor, além do menu de admin.
const ADMIN_MENTOR_GROUP: NavGroup = {
  label: 'A Minha Mentoria',
  items: [
    { name: 'Painel do Mentor', href: '/mentor', icon: LayoutDashboard },
    { name: 'Meus Mentorados', href: '/mentor/mentorados', icon: UserCheck },
    { name: 'As Minhas Avaliações', href: '/mentor/avaliacoes', icon: ClipboardEdit },
    { name: 'Notificações', href: '/mentor/notificacoes', icon: Bell },
  ],
};

const COLABORADOR_NAV: NavGroup[] = [
  {
    label: 'Geral',
    items: [
      { name: 'Início', href: '/inicio', icon: Home },
      { name: 'Notícias', href: '/noticias', icon: Newspaper },
      { name: 'Eventos', href: '/eventos', icon: CalendarDays },
      { name: 'Reconhecimento', href: '/reconhecimento', icon: Award },
      { name: 'O meu perfil', href: '/meu-perfil', icon: UserRound },
    ],
  },
  {
    label: 'O Meu Onboarding',
    items: [
      { name: 'Meu Trilho', href: '/onboarding/meu-trilho', icon: Route },
      { name: 'A Minha Ficha', href: '/colaborador/ficha', icon: IdCard },
      { name: 'Timeline', href: '/colaborador/timeline', icon: Activity },
      { name: 'Assistente Virtual', href: '/assistente', icon: Bot },
      { name: 'Comentários do Mentor', href: '/colaborador/comentarios', icon: MessageSquare },
      { name: 'Feedback / Auto-avaliação', href: '/colaborador/feedback', icon: ClipboardEdit },
      { name: 'Documentos da Empresa', href: '/colaborador/documentos', icon: FolderOpen },
      { name: 'Submissão de Documentos', href: '/colaborador/submissoes', icon: UploadCloud },
    ],
  },
];

const ITEM_ACESSOS: NavItem = { name: 'Acessos', href: '/acessos', icon: KeyRound };

const ADMIN_BOTTOM: NavItem[] = [
  { name: 'Utilizadores', href: '/utilizadores', icon: Users },
  { name: 'Audit Log', href: '/configuracoes/audit', icon: FileText },
  { name: 'Definições', href: '/configuracoes', icon: Settings },
];

const ICONE_POR_ROTA = new Map<string, NavItem['icon']>(
  [...ADMIN_NAV, ...MENTOR_NAV, ...COLABORADOR_NAV, ADMIN_MENTOR_GROUP]
    .flatMap((grupo) => grupo.items)
    .concat(ADMIN_BOTTOM, [{ name: 'Assistente Virtual', href: '/assistente', icon: Bot }, ITEM_ACESSOS])
    .map((item) => [item.href, item.icon]),
);

/** Menu do que os grupos da pessoa têm atribuído, pela ordem do catálogo. */
function menuDosGrupos(paginas: PaginaVisivel[] | undefined): NavGroup[] {
  const visiveis = new Set((paginas ?? []).filter((pagina) => pagina.visivel).map((pagina) => pagina.rota));
  const porModulo = new Map<string, { ordem: number; items: NavItem[] }>();
  for (const pagina of PAGINAS) {
    if (!visiveis.has(pagina.rota)) continue;
    const actual = porModulo.get(pagina.modulo) ?? { ordem: pagina.ordem, items: [] };
    actual.ordem = Math.min(actual.ordem, pagina.ordem);
    actual.items.push({
      name: pagina.nome,
      href: pagina.rota,
      icon: ICONE_POR_ROTA.get(pagina.rota) ?? KeyRound,
    });
    porModulo.set(pagina.modulo, actual);
  }
  return [...porModulo.entries()]
    .sort((a, b) => a[1].ordem - b[1].ordem)
    .map(([label, grupo]) => ({ label, items: grupo.items }));
}

export function getNavEntries(role: UserRole | null, isMentor = false): Array<NavItem & { group: string }> {
  const { groups, bottom } = getNavForRole(role, isMentor);
  return [
    ...groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    ...bottom.map((item) => ({ ...item, group: 'Sistema' })),
  ];
}

function getNavForRole(role: UserRole | null, isMentor = false): { groups: NavGroup[]; bottom: NavItem[] } {
  if (role === 'rh_admin') {
    if (!isMentor) return { groups: ADMIN_NAV, bottom: ADMIN_BOTTOM };
    // A seguir ao "Geral", para os mentorados ficarem à mão.
    return { groups: [ADMIN_NAV[0], ADMIN_MENTOR_GROUP, ...ADMIN_NAV.slice(1)], bottom: ADMIN_BOTTOM };
  }
  if (role === 'mentor') return { groups: MENTOR_NAV, bottom: [{ name: 'Assistente Virtual', href: '/assistente', icon: Bot }] };
  if (role === 'novo_colaborador') return { groups: COLABORADOR_NAV, bottom: [] };
  return { groups: [], bottom: [] };
}

// Menu lateral "Petróleo" com acentos menta (artefacto People Connect · RH & Comunicação).
const MENU = {
  bg: '#12343F',
  menta: '#5EE6A8',
};

// Grupos do menu abertos pelo utilizador (persistido no browser).
// Por omissão vêm todos abertos, para o menu do grupo (incluindo Acessos) aparecer logo.
// (v5: descarta as preferências guardadas pelas versões anteriores.)
const GRUPOS_ABERTOS_KEY = 'pumangol-sidebar-grupos-abertos-v5';

function lerGruposAbertos(): string[] | null {
  try {
    const raw = localStorage.getItem(GRUPOS_ABERTOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === 'string') : null;
  } catch {
    return null;
  }
}

export function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore();
  const { user } = useAuthStore();

  const paginas = user?.paginas;
  const NAV_GROUPS = menuDosGrupos(paginas);
  const BOTTOM_ITEMS: NavItem[] = [];
  const allHrefs = [...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)), ...BOTTOM_ITEMS.map((item) => item.href)];

  const gruposPorOmissao = NAV_GROUPS.map((g) => g.label);
  const chaveOmissao = gruposPorOmissao.join('|');
  const [gruposAbertos, setGruposAbertos] = useState<string[]>(gruposPorOmissao);

  function guardarGruposAbertos(next: string[]) {
    setGruposAbertos(next);
    try {
      localStorage.setItem(GRUPOS_ABERTOS_KEY, JSON.stringify(next));
    } catch { /* storage indisponível */ }
  }

  function alternarGrupo(label: string) {
    guardarGruposAbertos(
      gruposAbertos.includes(label) ? gruposAbertos.filter((g) => g !== label) : [...gruposAbertos, label],
    );
  }

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/';
    const path = location.pathname;
    const matches = path === href || path.startsWith(`${href}/`);
    if (!matches) return false;
    return !allHrefs.some((other) =>
      other !== href &&
      other.length > href.length &&
      other.startsWith(`${href}/`) &&
      (path === other || path.startsWith(`${other}/`)),
    );
  }

  // Grupo da página actual (abre-se sozinho se estiver recolhido).
  const grupoActivo = NAV_GROUPS.find((group) => group.items.some((item) => isActive(item.href)))?.label;

  // Repõe os grupos guardados (ou os por omissão) quando o menu do perfil fica disponível.
  // Inclui sempre o grupo da página actual: sem isto, esta reposição podia fechar o grupo
  // que o efeito seguinte acabou de abrir (ex.: entrar directamente em /assistente).
  useEffect(() => {
    const base = lerGruposAbertos() ?? gruposPorOmissao;
    setGruposAbertos(grupoActivo && !base.includes(grupoActivo) ? [...base, grupoActivo] : base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveOmissao]);

  // Ao navegar para uma página de um grupo recolhido, abre esse grupo.
  useEffect(() => {
    if (grupoActivo && !gruposAbertos.includes(grupoActivo)) {
      setGruposAbertos((prev) => (prev.includes(grupoActivo) ? prev : [...prev, grupoActivo]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoActivo, location.pathname]);

  const sidebarContent = (
    <div className={cn(
      'h-[calc(100vh-67px)] flex flex-col bg-sidebar text-sidebar-foreground transition-colors duration-200 relative isolate overflow-hidden',
      sidebarCollapsed ? 'w-[64px]' : 'w-[240px]',
    )}>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto py-4 px-2', sidebarCollapsed ? 'space-y-4' : 'space-y-2')} aria-label="Principal">
        {NAV_GROUPS.map((group) => {
          // Com o menu em modo ícones, os grupos ficam sempre abertos.
          const aberto = sidebarCollapsed || gruposAbertos.includes(group.label);
          const grupoId = `nav-grupo-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
          return (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => alternarGrupo(group.label)}
                aria-expanded={aberto}
                aria-controls={grupoId}
                className="w-full flex items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              >
                <span>{group.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', !aberto && '-rotate-90')} />
              </button>
            )}
            <div
              id={grupoId}
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
            <div className={cn('overflow-hidden space-y-0.5', !sidebarCollapsed && 'mt-0.5')} inert={!aberto ? true : undefined}>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarMobileOpen(false)}
                    title={item.name}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md text-[13px] transition-colors duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                      sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2',
                      active
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'font-medium text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    <item.icon className={cn(
                      'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                      active ? 'text-primary-foreground' : 'opacity-80',
                    )} />
                    {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                    {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                      <span className="ml-auto text-[10px] font-semibold bg-brand-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            </div>
          </div>
          );
        })}
      </nav>

      {/* Bottom */}
      {BOTTOM_ITEMS.length > 0 && (
        <div className="border-t border-white/[0.06] p-2 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2',
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'font-medium text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
              )}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive(item.href) ? 'text-primary-foreground' : 'opacity-80')} />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-[67px] z-30">
        {sidebarContent}
      </aside>

      {sidebarMobileOpen && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 top-[67px] z-30">
          <div className="fixed inset-x-0 bottom-0 top-[67px] bg-black/50" onClick={() => setSidebarMobileOpen(false)} />
          <aside className="relative z-40">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
