'use client';

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Side-effect: regista o token provider JWT no cliente HTTP
import './services/auth.service';
import { Layout } from './components/Layout';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppLoader } from './components/AppLoader';
import { GlobalRequestLoader, MudancaDePagina } from './components/GlobalRequestLoader';
import { WelcomeGuard } from './components/auth/WelcomeGuard';
import { StoreToaster, ToastProvider } from './components/ui/toast';

const Login = lazy(() => import('./screens/Login'));
const DefinirPassword = lazy(() => import('./screens/DefinirPassword'));
const RecuperarPassword = lazy(() => import('./screens/RecuperarPassword'));
const Dashboard = lazy(() => import('./screens/Dashboard'));
const ComunidadePage = lazy(() => import('./screens/comunidade/ComunidadePage'));
const PublicacaoPage = lazy(() => import('./screens/comunidade/PublicacaoPage'));
const EventosPage = lazy(() => import('./screens/eventos/EventosPage'));
const ReconhecimentoPage = lazy(() => import('./screens/comunidade/ReconhecimentoPage'));
const PerfilPage = lazy(() => import('./screens/pessoas/PerfilPage'));
const MeuPerfilPage = lazy(() => import('./screens/pessoas/MeuPerfilPage'));
const Onboarding = lazy(() => import('./screens/Onboarding'));
const Unauthorized = lazy(() => import('./screens/Unauthorized'));
const NotFound = lazy(() => import('./screens/NotFound'));

const CandidatosPage = lazy(() => import('./screens/recrutamento/CandidatosPage'));
const DashboardSemanalPage = lazy(() => import('./screens/recrutamento/DashboardSemanalPage'));
const AdmissaoListaPage = lazy(() => import('./screens/admissao/AdmissaoListaPage'));
const AdmissaoDetalhePage = lazy(() => import('./screens/admissao/AdmissaoDetalhePage'));
const CandidaturaDocumentosPage = lazy(() => import('./screens/admissao/CandidaturaDocumentosPage'));

const TrilhosPage = lazy(() => import('./screens/onboarding/TrilhosPage'));
const CatalogosPage = lazy(() => import('./screens/onboarding/CatalogosPage'));
const ColaboradorProgressoPage = lazy(() => import('./screens/onboarding/ColaboradorProgressoPage'));
const MeuTrilhoPage = lazy(() => import('./screens/onboarding/MeuTrilhoPage'));
const QuizAdminPage = lazy(() => import('./screens/onboarding/QuizAdminPage'));
const VideosAdminPage = lazy(() => import('./screens/onboarding/VideosAdminPage'));
const EvolucaoPage = lazy(() => import('./screens/onboarding/EvolucaoPage'));
const DocumentosEmpresaAdminPage = lazy(() => import('./screens/onboarding/DocumentosEmpresaAdminPage'));
const DocumentosExigidosAdminPage = lazy(() => import('./screens/onboarding/DocumentosExigidosAdminPage'));
const FichasTrabalhadorAdminPage = lazy(() => import('./screens/onboarding/FichasTrabalhadorAdminPage'));

const WelcomeFlow = lazy(() => import('./screens/welcome/WelcomeFlow'));
const DocumentosEmpresaPage = lazy(() => import('./screens/colaborador/DocumentosEmpresaPage'));
const SubmissoesPage = lazy(() => import('./screens/colaborador/SubmissoesPage'));
const TimelineColaboradorPage = lazy(() => import('./screens/colaborador/TimelineColaboradorPage'));
const FeedbackColaboradorPage = lazy(() => import('./screens/colaborador/FeedbackColaboradorPage'));
const FichaTrabalhadorPage = lazy(() => import('./screens/colaborador/FichaTrabalhadorPage'));

// Assistente Virtual = Pumuki (Dify). As páginas antigas do assistente interno (Base de
// Conhecimento, Documentos KB, Escalações) saíram do menu e redireccionam para aqui.
const AssistentePumukiPage = lazy(() => import('./screens/assistente/AssistentePumukiPage'));

const DefinicoesPage = lazy(() => import('./screens/configuracoes/DefinicoesPage'));
const AuditLogPage = lazy(() => import('./screens/configuracoes/AuditLogPage'));

// Admin — Utilizadores
const UtilizadoresPage = lazy(() => import('./screens/admin/UtilizadoresPage'));
const AcessosPage = lazy(() => import('./screens/dev/AcessosPage'));

// Admin — Mentoria (Fase 4)
const MentoresPage = lazy(() => import('./screens/admin/MentoresPage'));
const CentroAvaliacoesPage = lazy(() => import('./screens/admin/CentroAvaliacoesPage'));
const Comparacao360Page = lazy(() => import('./screens/admin/Comparacao360Page'));

// Portal do Mentor (Fase 3 — Master Prompt Enterprise)
const DashboardMentor = lazy(() => import('./screens/mentor/DashboardMentor'));
const MeusMentorados = lazy(() => import('./screens/mentor/MeusMentorados'));
const TimelineMentorado = lazy(() => import('./screens/mentor/TimelineMentorado'));
const AvaliacoesMentor = lazy(() => import('./screens/mentor/AvaliacoesMentor'));
const AvaliacaoMentor = lazy(() => import('./screens/mentor/AvaliacaoMentor'));
const NotificacoesMentor = lazy(() => import('./screens/mentor/NotificacoesMentor'));

/** Rota de módulo do novo colaborador: RoleGuard + Layout (Outlet). */
function ColaboradorRoute() {
  return (
    <RoleGuard roles={['novo_colaborador', 'rh_admin']}>
      <Layout />
    </RoleGuard>
  );
}

/** Rota do Portal do Mentor: RoleGuard + Layout (Outlet). */
function MentorRoute() {
  return (
    <RoleGuard roles={['mentor', 'rh_admin']}>
      <Layout />
    </RoleGuard>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreToaster />
      <GlobalRequestLoader />
      <BrowserRouter>
        <MudancaDePagina />
        <Suspense fallback={<AppLoader />}>
          <Routes>
            {/* Página inicial — Comunidade (todos os perfis) */}
            <Route
              path="/inicio"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><ComunidadePage /></WelcomeGuard>} />
              <Route path="publicacao/:id" element={<WelcomeGuard><PublicacaoPage /></WelcomeGuard>} />
            </Route>

            {/* Eventos e Agenda — todos os perfis (o admin regista) */}
            <Route
              path="/eventos"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><EventosPage /></WelcomeGuard>} />
            </Route>

            <Route
              path="/reconhecimento"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><ReconhecimentoPage /></WelcomeGuard>} />
            </Route>

            {/* Assistente Virtual (Pumuki) — todos os perfis */}
            <Route
              path="/assistente"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><AssistentePumukiPage /></WelcomeGuard>} />
            </Route>

            {/* Perfil de uma pessoa (colaborador, mentor ou admin) — todos os perfis */}
            <Route
              path="/perfil/:id"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><PerfilPage /></WelcomeGuard>} />
            </Route>

            {/* Gestão de grupos e páginas — só a conta DEV */}
            <Route
              path="/acessos"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<AcessosPage />} />
            </Route>

            {/* O meu perfil (foto, capa, contactos e interesses) — todos os perfis */}
            <Route
              path="/meu-perfil"
              element={
                <RoleGuard roles={['rh_admin', 'mentor', 'novo_colaborador']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<WelcomeGuard><MeuPerfilPage /></WelcomeGuard>} />
            </Route>

            {/* RH Admin — acesso total */}
            <Route
              path="/"
              element={
                <RoleGuard roles={['rh_admin']}>
                  <Layout />
                </RoleGuard>
              }
            >
              <Route index element={<Dashboard />} />

              {/* Recrutamento (v2.0 — apenas Dashboard Semanal e Candidatos) */}
              <Route path="recrutamento/dashboard-semanal" element={<DashboardSemanalPage />} />
              <Route path="recrutamento/candidatos" element={<CandidatosPage />} />
              <Route path="admissao" element={<AdmissaoListaPage />} />
              <Route path="admissao/:id" element={<AdmissaoDetalhePage />} />
              {/* Submódulos descontinuados — redireccionados */}
              <Route path="recrutamento/vagas" element={<Navigate to="/recrutamento/dashboard-semanal" replace />} />
              <Route path="recrutamento/pipeline" element={<Navigate to="/recrutamento/dashboard-semanal" replace />} />
              <Route path="recrutamento/entrevistas" element={<Navigate to="/recrutamento/dashboard-semanal" replace />} />

              {/* Onboarding (admin) */}
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="onboarding/trilhos" element={<TrilhosPage />} />
              <Route path="onboarding/catalogos" element={<CatalogosPage />} />
              <Route path="onboarding/quiz" element={<QuizAdminPage />} />
              <Route path="onboarding/videos" element={<VideosAdminPage />} />
              <Route path="onboarding/evolucao" element={<EvolucaoPage />} />
              <Route path="onboarding/documentos" element={<DocumentosEmpresaAdminPage />} />
              <Route path="onboarding/documentos-exigidos" element={<DocumentosExigidosAdminPage />} />
              <Route path="onboarding/fichas" element={<FichasTrabalhadorAdminPage />} />
              <Route path="onboarding/colaborador/:id" element={<ColaboradorProgressoPage />} />

              {/* Admin — Utilizadores */}
              <Route path="utilizadores" element={<UtilizadoresPage />} />

              {/* Admin — Mentoria (Fase 4) */}
              <Route path="mentores" element={<MentoresPage />} />
              <Route path="avaliacoes" element={<CentroAvaliacoesPage />} />
              <Route path="comparacao-360" element={<Comparacao360Page />} />

              {/* Assistente IA — páginas retiradas do menu: redireccionam para o Assistente Virtual */}
              <Route path="base-conhecimento" element={<Navigate to="/assistente" replace />} />
              <Route path="base-conhecimento/faqs" element={<Navigate to="/assistente" replace />} />
              <Route path="admin/kb-documentos" element={<Navigate to="/assistente" replace />} />
              <Route path="assistente/escalacoes" element={<Navigate to="/assistente" replace />} />

              {/* Analítica & Relatórios — descontinuados; redireccionados para o Dashboard */}
              <Route path="analitica" element={<Navigate to="/" replace />} />
              <Route path="relatorios" element={<Navigate to="/" replace />} />

              {/* Configurações */}
              <Route path="configuracoes" element={<DefinicoesPage />} />
              <Route path="configuracoes/audit" element={<AuditLogPage />} />
            </Route>

            {/* Portal do Mentor (Fase 3 — Master Prompt Enterprise) */}
            <Route path="/mentor" element={<MentorRoute />}>
              <Route index element={<DashboardMentor />} />
              <Route path="mentorados" element={<MeusMentorados />} />
              <Route path="mentorados/:colaboradorId" element={<TimelineMentorado />} />
              <Route path="avaliacoes" element={<AvaliacoesMentor />} />
              <Route path="avaliacoes/nova" element={<AvaliacaoMentor />} />
              <Route path="avaliacoes/:avaliacaoId" element={<AvaliacaoMentor />} />
              <Route path="notificacoes" element={<NotificacoesMentor />} />
            </Route>

            {/* Welcome Flow (novo colaborador) — ecrã completo, sem layout */}
            <Route
              path="/welcome"
              element={
                <RoleGuard roles={['novo_colaborador', 'rh_admin']}>
                  <WelcomeFlow />
                </RoleGuard>
              }
            />

            {/* Novo Colaborador — módulos (com guard de welcome) */}
            <Route path="/onboarding/meu-trilho" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><MeuTrilhoPage /></WelcomeGuard>} />
            </Route>
            <Route path="/assistente-colaborador" element={<Navigate to="/assistente" replace />} />
            <Route path="/colaborador/documentos" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><DocumentosEmpresaPage /></WelcomeGuard>} />
            </Route>
            <Route path="/colaborador/submissoes" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><SubmissoesPage /></WelcomeGuard>} />
            </Route>
            <Route path="/colaborador/timeline" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><TimelineColaboradorPage /></WelcomeGuard>} />
            </Route>
            <Route path="/colaborador/comentarios" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><TimelineColaboradorPage /></WelcomeGuard>} />
            </Route>
            <Route path="/colaborador/feedback" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><FeedbackColaboradorPage /></WelcomeGuard>} />
            </Route>
            <Route path="/colaborador/ficha" element={<ColaboradorRoute />}>
              <Route index element={<WelcomeGuard><FichaTrabalhadorPage /></WelcomeGuard>} />
            </Route>

            {/* Login */}
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-password" element={<RecuperarPassword />} />
            <Route path="/definir-password" element={<DefinirPassword />} />
            <Route path="/candidatura/:token" element={<CandidaturaDocumentosPage />} />

            {/* Redirects de retrocompatibilidade */}
            <Route path="/chat" element={<Navigate to="/login" replace />} />
            <Route path="/meu-onboarding/:token" element={<Navigate to="/onboarding/meu-trilho" replace />} />

            {/* Páginas de erro */}
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
