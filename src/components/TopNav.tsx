import { Bell, Menu, LogOut, CheckCheck, MessageCircleQuestion, Settings, Moon, Sun, Users, UserRound } from 'lucide-react';
import { Avatar, Badge } from '@/src/components/ui/badge';
import { useUIStore } from '@/src/store/ui.store';
import { useNotificationsStore } from '@/src/store/notifications.store';
import { useAuthStore } from '@/src/store/auth.store';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Notification, NotificacaoOnboarding } from '@/lib/types';
import { notificacoesOnboardingService } from '@/src/services/mentoria.service';
import { NotificacoesLista, useMarcarTodasLidas } from '@/src/components/NotificacoesLista';
import { PesquisaPessoas } from '@/src/components/PesquisaPessoas';
import { alternarTema, temaActual } from '@/src/lib/tema';
import { ROUTES } from '@/lib/constants';

const ROLE_LABEL: Record<string, string> = {
  rh_admin: 'Administrador DPC',
  mentor: 'Mentor',
  novo_colaborador: 'Colaborador',
};

/** Cor da barra de topo (verde Pumangol). */
export const TOPBAR_BG = '#1A5334';

// Intervalo de actualização do sino (novas publicações/comentários da comunidade).
const NOTIF_POLL_MS = 60_000;

// Adapta uma NotificacaoOnboarding (novo modelo v3) para o shape de Notification
// consumido pelo sino, preservando o mesmo comportamento visual.
function adaptOnboarding(n: NotificacaoOnboarding): Notification {
  return {
    id: n.id,
    destinatario_id: n.destinatario_id,
    tipo: n.tipo,
    canal: 'in_app',
    mensagem: n.mensagem ?? n.titulo,
    estado: n.lida ? 'lida' : 'pendente',
    link_accao: n.link_accao ?? null,
    enviada_em: n.created_at,
    lida_em: n.lida_em ?? null,
    created_at: n.created_at,
  };
}

const iconButton =
  'relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

export function TopNav() {
  const { sidebarMobileOpen, toggleSidebar, setSidebarMobileOpen } = useUIStore();
  const { unreadCount, setNotifications } = useNotificationsStore();
  const marcarTodasLidas = useMarcarTodasLidas();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(temaActual() === 'escuro');
  }, []);

  // Inbox de notificações (onboarding v3 + comunidade) — todos os perfis.
  // Sincroniza com o store partilhado para alimentar o sino do topbar.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const carregar = () => {
      if (document.visibilityState === 'hidden') return;
      notificacoesOnboardingService.inbox(true)
        .then((inbox) => {
          if (cancelled) return;
          setNotifications(inbox.items.map(adaptOnboarding));
        })
        .catch(() => { /* silencioso: sino simplesmente fica vazio */ });
    };
    carregar();
    const timer = window.setInterval(carregar, NOTIF_POLL_MS);
    document.addEventListener('visibilitychange', carregar);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', carregar);
    };
  }, [user?.id, setNotifications]);

  function alternarMenu() {
    // Desktop: recolhe/expande; mobile: abre/fecha o menu sobreposto.
    if (window.matchMedia('(min-width: 1024px)').matches) toggleSidebar();
    else setSidebarMobileOpen(!sidebarMobileOpen);
  }

  const userName = user?.nome ?? 'Admin DPC';
  const userEmail = user?.email ?? 'admin@pumangol.ao';
  const userRole = user?.role ?? 'rh_admin';
  const roleLabel = (ROLE_LABEL[userRole] ?? userRole)
    + (userRole === 'rh_admin' && user?.is_mentor ? ' · Mentor' : '')
    + (user?.is_dev ? ' · DEV' : '');
  const assistenteHref = ROUTES.ASSISTENTE;

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 h-16 flex items-center justify-between px-4 md:px-6 text-white shadow-md"
      style={{ background: TOPBAR_BG }}
    >
      {/* Assinatura verde-menta: filete de 3px colado por baixo da barra */}
      <div aria-hidden="true" className="absolute inset-x-0 top-full h-[3px] bg-[#3DD68C]" />
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <button type="button" onClick={() => navigate(ROUTES.HOME)} aria-label="Pumangol — página inicial" className="shrink-0 md:mr-4">
          <img src="/pumangol-logo-sidebar.png" alt="Pumangol" className="h-4 sm:h-5 w-auto object-contain" />
        </button>
        <button
          type="button"
          aria-label="Menu"
          onClick={alternarMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>
        {/* Marca da plataforma: People Connect · RH & Comunicação */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.HOME)}
          aria-label="People Connect — página inicial"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-full bg-black/[0.18] p-1.5 sm:pr-3.5 hover:bg-black/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3DD68C] text-[#0B3D24]">
            <Users className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="hidden sm:block truncate text-sm font-bold text-white">People Connect</span>
          <span className="hidden xl:block whitespace-nowrap border-l border-white/30 pl-2 text-[11px] font-semibold tracking-[0.1em] text-white/85">
            Pessoas &amp; Cultura
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 md:gap-2">
        <PesquisaPessoas className="hidden lg:block w-56 xl:w-72 mr-2 xl:mr-4" />
        {/* Notificações */}
        <div className="relative">
          <button
            type="button"
            aria-label="Notificações"
            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
            className={iconButton}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-error-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#1A5334]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 bg-white text-foreground rounded-xl shadow-float border border-border w-[380px] max-w-[calc(100vw-2rem)] max-h-[480px] flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                    {unreadCount > 0 && <Badge variant="error" size="sm">{unreadCount}</Badge>}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={marcarTodasLidas}
                      className="text-xs text-navy-500 hover:text-navy-700 flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  <NotificacoesLista onAbrir={() => setNotifOpen(false)} />
                </div>
              </div>
            </>
          )}
        </div>

        <button type="button" aria-label="Assistente Virtual" title="Assistente Virtual" onClick={() => navigate(assistenteHref)} className={cn(iconButton, 'hidden sm:block')}>
          <MessageCircleQuestion className="w-5 h-5" />
        </button>

        {userRole === 'rh_admin' && (
          <button type="button" aria-label="Definições" title="Definições" onClick={() => navigate(ROUTES.CONFIGURACOES)} className={iconButton}>
            <Settings className="w-5 h-5" />
          </button>
        )}

        {/* Menu da conta */}
        <div className="relative ml-1 md:ml-3">
          <button
            type="button"
            aria-label="Menu da conta"
            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 rounded-full p-0.5 pr-2 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Avatar name={userName} src={user?.foto_url} size="sm" />
            <span className="hidden xl:block text-left leading-tight">
              <span className="block text-sm font-bold text-white">{userName}</span>
              <span className="block text-xs text-white/80">{roleLabel}</span>
            </span>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 bg-white text-foreground rounded-xl shadow-float border border-border py-2 w-60">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                  <span className="inline-block mt-1 text-[11px] font-medium bg-navy-50 text-navy-700 rounded-full px-2 py-0.5">
                    {roleLabel}
                  </span>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate(ROUTES.MEU_PERFIL); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    <UserRound className="w-4 h-4" /> O meu perfil
                  </button>
                  <button
                    onClick={() => setEscuro(alternarTema() === 'escuro')}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    {escuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {escuro ? 'Tema claro' : 'Tema escuro'}
                  </button>
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
                      try {
                        const { logoutMsal, MSAL_CONFIGURED } = await import('@/src/services/msal.service');
                        if (MSAL_CONFIGURED) await logoutMsal();
                      } catch {
                        // ignore
                      }
                      logout();
                      navigate('/login');
                    }}
                    className={cn('w-full flex items-center gap-3 px-4 py-2 text-sm text-error-500 hover:bg-error-50 transition-colors')}
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
