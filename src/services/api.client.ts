import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/lib/types';
import { toast, useAuthStore } from '@/src/store';
import { useLoadingStore } from '@/src/store/loading.store';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Pedido em segundo plano (polling, pesquisa ao escrever…): não mostra o loader global. */
    silencioso?: boolean;
    /** O ecrã mostra o erro no próprio sítio: sem toast de 403, 429 ou 5xx. */
    semAviso?: boolean;
    /** Interno: este pedido foi contado no loader global. */
    _contaLoader?: boolean;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  // 45s default — endpoints de agente/RAG usam timeout próprio (90s)
  timeout: 45_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Token getter — replaced by MSAL implementation in EPIC-02
let getAccessToken: (() => Promise<string | null>) | null = null;

export function setTokenProvider(provider: () => Promise<string | null>) {
  getAccessToken = provider;
}

// For onboarding token (UUID link-based access)
let onboardingToken: string | null = null;

export function setOnboardingToken(token: string | null) {
  onboardingToken = token;
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (getAccessToken) {
    try {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Silent — will be caught by 401 response interceptor
    }
  }

  if (onboardingToken) {
    config.headers['X-Onboarding-Token'] = onboardingToken;
  }

  // Loader global: só os GET que carregam a página na mudança de página.
  // Recargas, filtros e gravações (POST/PATCH/DELETE) têm o seu próprio estado na página.
  if (
    (config.method ?? 'get').toLowerCase() === 'get'
    && !config.silencioso
    && useLoadingStore.getState().emMudancaDePagina()
  ) {
    config._contaLoader = true;
    useLoadingStore.getState().iniciar();
  }

  return config;
});

function terminarLoader(config: InternalAxiosRequestConfig | undefined) {
  if (config?._contaLoader) {
    config._contaLoader = false;
    useLoadingStore.getState().terminar();
  }
}

let authRedirecting = false;

const GENERIC_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';
const SQL_LEAK = /\b(select\s.+\sfrom|insert\s+into|update\s+\S+\s+set|delete\s+from)\b|syntax error|violates|duplicate key|null value in column|invalid input (syntax|value)|relation "|column "|constraint "|could not determine data type|operator does not exist|function .+ does not exist|PostgresError/i;

apiClient.interceptors.response.use(
  (response) => {
    terminarLoader(response.config);
    // Rejeita respostas HTML: quando /api/* não corresponde a nenhuma function,
    // o SPA rewrite devolve index.html com 200 — isso não é uma resposta útil.
    const contentType = String(response.headers?.['content-type'] ?? '');
    if (typeof response.data === 'string' && contentType.includes('text/html')) {
      return Promise.reject(new Error('API não disponível (fallback SPA)'));
    }
    return response;
  },
  (error: AxiosError<ApiError & { error?: string }>) => {
    terminarLoader(error.config);
    const status = error.response?.status;
    // Backend usa 2 shapes: { message } e { error }. Lemos ambos.
    const raw = error.response?.data?.message ?? error.response?.data?.error;
    // Nunca mostrar SQL / detalhes da BD ao utilizador (nem nos ecrãs que leem data.error).
    const message = typeof raw === 'string' && SQL_LEAK.test(raw) ? GENERIC_ERROR : raw;
    if (message !== raw && error.response?.data && typeof error.response.data === 'object') {
      error.response.data = { ...error.response.data, message, error: message };
    }

    if (status === 401) {
      const path = window.location.pathname;
      const onPublicPage = path === '/login'
        || path.startsWith('/definir-password')
        || path.startsWith('/recuperar-password')
        || path.startsWith('/primeiro-acesso')
        || path === '/unauthorized'
        || path === '/link-invalido';
      if (!onPublicPage && !authRedirecting) {
        authRedirecting = true;
        useAuthStore.getState().clearUser();
        window.location.replace('/login?expired=1');
      }
      return Promise.reject(error);
    }

    if (error.config?.semAviso) return Promise.reject(error);

    if (status === 403) {
      toast.error('Sem permissão', message ?? 'Não tem acesso a este recurso.');
      return Promise.reject(error);
    }

    if (status === 429) {
      toast.warning('Demasiados pedidos', 'Aguarde um momento e tente novamente.');
      return Promise.reject(error);
    }

    if (status && status >= 500) {
      toast.error('Erro de servidor', message ?? 'Ocorreu um erro. Tente novamente.');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

/** Sem resposta (rede, timeout, servidor a recompilar) ou 5xx: costuma passar ao repetir. */
function erroTransitorio(e: unknown): boolean {
  if (!axios.isAxiosError(e) || axios.isCancel(e)) return false;
  const status = e.response?.status;
  return !status || status >= 500;
}

/** Repete o pedido após cada espera (ms) enquanto o erro for transitório. */
export async function comRepeticao<T>(pedido: () => Promise<T>, esperas = [1_000, 3_000]): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await pedido();
    } catch (e) {
      if (tentativa >= esperas.length || !erroTransitorio(e)) throw e;
      await new Promise((r) => setTimeout(r, esperas[tentativa]));
    }
  }
}
