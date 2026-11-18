import acessos, { config as acessosConfig } from '@/netlify/functions/acessos';
import admissao, { config as admissaoConfig } from '@/netlify/functions/admissao';
import admissaoDocumentos, { config as admissaoDocumentosConfig } from '@/netlify/functions/admissao-documentos';
import agentConfig, { config as agentConfigConfig } from '@/netlify/functions/agent-config';
import agentTurn, { config as agentTurnConfig } from '@/netlify/functions/agent-turn';
import authLogin, { config as authLoginConfig } from '@/netlify/functions/auth-login';
import definirPassword, { config as definirPasswordConfig } from '@/netlify/functions/definir-password';
import sessao, { config as sessaoConfig } from '@/netlify/functions/sessao';
import avaliacoes, { config as avaliacoesConfig } from '@/netlify/functions/avaliacoes';
import azureOpenAiChat, { config as azureOpenAiChatConfig } from '@/netlify/functions/azure-openai-chat';
import candidatos, { config as candidatosConfig } from '@/netlify/functions/candidatos';
import catalogos, { config as catalogosConfig } from '@/netlify/functions/catalogos';
import chatMensagens, { config as chatMensagensConfig } from '@/netlify/functions/chat-mensagens';
import chatSessoes, { config as chatSessoesConfig } from '@/netlify/functions/chat-sessoes';
import colaboradores, { config as colaboradoresConfig } from '@/netlify/functions/colaboradores';
import copilotToken, { config as copilotTokenConfig } from '@/netlify/functions/copilot-token';
import dashboard, { config as dashboardConfig } from '@/netlify/functions/dashboard';
import documentosEmpresa, { config as documentosEmpresaConfig } from '@/netlify/functions/documentos-empresa';
import documentosExigidos, { config as documentosExigidosConfig } from '@/netlify/functions/documentos-exigidos';
import entrevistas, { config as entrevistasConfig } from '@/netlify/functions/entrevistas';
import escalacoes, { config as escalacoesConfig } from '@/netlify/functions/escalacoes';
import faqs, { config as faqsConfig } from '@/netlify/functions/faqs';
import fichasTrabalhador, { config as fichasTrabalhadorConfig } from '@/netlify/functions/fichas-trabalhador';
import healthNvidia, { config as healthNvidiaConfig } from '@/netlify/functions/health-nvidia';
import health, { config as healthConfig } from '@/netlify/functions/health';
import kbDebug, { config as kbDebugConfig } from '@/netlify/functions/kb-debug';
import kbDocumentos, { config as kbDocumentosConfig } from '@/netlify/functions/kb-documentos';
import kbManual, { config as kbManualConfig } from '@/netlify/functions/kb-manual';
import kbReindex, { config as kbReindexConfig } from '@/netlify/functions/kb-reindex';
import kbTest, { config as kbTestConfig } from '@/netlify/functions/kb-test';
import kbUpload, { config as kbUploadConfig } from '@/netlify/functions/kb-upload';
import mentorAssignments, { config as mentorAssignmentsConfig } from '@/netlify/functions/mentor-assignments';
import mentorPortal, { config as mentorPortalConfig } from '@/netlify/functions/mentor-portal';
import mentors, { config as mentorsConfig } from '@/netlify/functions/mentors';
import onboardingEvents, { config as onboardingEventsConfig } from '@/netlify/functions/onboarding-events';
import ping, { config as pingConfig } from '@/netlify/functions/ping';
import primeiroAcesso, { config as primeiroAcessoConfig } from '@/netlify/functions/primeiro-acesso';
import quizPerguntas, { config as quizPerguntasConfig } from '@/netlify/functions/quiz-perguntas';
import reconhecimentos, { config as reconhecimentosConfig } from '@/netlify/functions/reconhecimentos';
import recuperarPassword, { config as recuperarPasswordConfig } from '@/netlify/functions/recuperar-password';
import submissoes, { config as submissoesConfig } from '@/netlify/functions/submissoes';
import trilhos, { config as trilhosConfig } from '@/netlify/functions/trilhos';
import utilizadores, { config as utilizadoresConfig } from '@/netlify/functions/utilizadores';
import vagas, { config as vagasConfig } from '@/netlify/functions/vagas';
import welcomeVideos, { config as welcomeVideosConfig } from '@/netlify/functions/welcome-videos';
import welcome, { config as welcomeConfig } from '@/netlify/functions/welcome';
import comunidade, { config as comunidadeConfig } from '@/netlify/functions/comunidade';
import eventos, { config as eventosConfig } from '@/netlify/functions/eventos';
import pessoas, { config as pessoasConfig } from '@/netlify/functions/pessoas';
import dify, { config as difyConfig } from '@/netlify/functions/dify';
import ficheiros, { config as ficheirosConfig } from '@/netlify/functions/ficheiros';
import perfil, { config as perfilConfig } from '@/netlify/functions/perfil';
import etapaAnexos, { config as etapaAnexosConfig } from '@/netlify/functions/etapa-anexos';

type Handler = (req: Request) => Promise<Response>;

interface Route {
  pattern: string;
  handler: Handler;
  score: number;
}

function specificity(pattern: string): number {
  const segments = pattern.split('/').filter(Boolean);
  let literals = 0;
  let params = 0;
  for (const segment of segments) {
    if (segment.startsWith(':')) params += 1;
    else literals += 1;
  }
  return literals * 1000 + segments.length * 10 - params;
}

function matches(pattern: string, pathname: string): boolean {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => segment.startsWith(':') || segment === actual[index]);
}

function register(routes: Route[], handler: Handler, path: string | string[] | undefined) {
  const patterns = !path ? [] : Array.isArray(path) ? path : [path];
  for (const pattern of patterns) {
    routes.push({ pattern, handler, score: specificity(pattern) });
  }
}

const routes: Route[] = [];

register(routes, acessos, acessosConfig.path);
register(routes, admissao, admissaoConfig.path);
register(routes, admissaoDocumentos, admissaoDocumentosConfig.path);
register(routes, agentConfig, agentConfigConfig.path);
register(routes, agentTurn, agentTurnConfig.path);
register(routes, authLogin, authLoginConfig.path);
register(routes, definirPassword, definirPasswordConfig.path);
register(routes, sessao, sessaoConfig.path);
register(routes, avaliacoes, avaliacoesConfig.path);
register(routes, azureOpenAiChat, azureOpenAiChatConfig.path);
register(routes, candidatos, candidatosConfig.path);
register(routes, catalogos, catalogosConfig.path);
register(routes, chatMensagens, chatMensagensConfig.path);
register(routes, chatSessoes, chatSessoesConfig.path);
register(routes, colaboradores, colaboradoresConfig.path);
register(routes, copilotToken, copilotTokenConfig.path);
register(routes, dashboard, dashboardConfig.path);
register(routes, documentosEmpresa, documentosEmpresaConfig.path);
register(routes, documentosExigidos, documentosExigidosConfig.path);
register(routes, entrevistas, entrevistasConfig.path);
register(routes, escalacoes, escalacoesConfig.path);
register(routes, faqs, faqsConfig.path);
register(routes, fichasTrabalhador, fichasTrabalhadorConfig.path);
register(routes, healthNvidia, healthNvidiaConfig.path);
register(routes, health, healthConfig.path);
register(routes, kbDebug, kbDebugConfig.path);
register(routes, kbDocumentos, kbDocumentosConfig.path);
register(routes, kbManual, kbManualConfig.path);
register(routes, kbReindex, kbReindexConfig.path);
register(routes, kbTest, kbTestConfig.path);
register(routes, kbUpload, kbUploadConfig.path);
register(routes, mentorAssignments, mentorAssignmentsConfig.path);
register(routes, mentorPortal, mentorPortalConfig.path);
register(routes, mentors, mentorsConfig.path);
register(routes, onboardingEvents, onboardingEventsConfig.path);
register(routes, ping, pingConfig.path);
register(routes, primeiroAcesso, primeiroAcessoConfig.path);
register(routes, quizPerguntas, quizPerguntasConfig.path);
register(routes, reconhecimentos, reconhecimentosConfig.path);
register(routes, recuperarPassword, recuperarPasswordConfig.path);
register(routes, submissoes, submissoesConfig.path);
register(routes, trilhos, trilhosConfig.path);
register(routes, utilizadores, utilizadoresConfig.path);
register(routes, vagas, vagasConfig.path);
register(routes, welcomeVideos, welcomeVideosConfig.path);
register(routes, welcome, welcomeConfig.path);
register(routes, comunidade, comunidadeConfig.path);
register(routes, eventos, eventosConfig.path);
register(routes, pessoas, pessoasConfig.path);
register(routes, dify, difyConfig.path);
register(routes, ficheiros, ficheirosConfig.path);
register(routes, perfil, perfilConfig.path);
register(routes, etapaAnexos, etapaAnexosConfig.path);

routes.sort((a, b) => b.score - a.score);

function notFound(): Response {
  return Response.json({ error: 'Rota não encontrada' }, { status: 404 });
}

export async function dispatchApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    const { ensureAuthReady, getAuth } = await import('@/src/lib/auth');
    await ensureAuthReady();
    return getAuth().handler(req);
  }
  const route = routes.find((candidate) => matches(candidate.pattern, pathname));
  if (!route) return notFound();
  return route.handler(req);
}
