import type { AuthUser } from '@/lib/types';
import { apiClient } from './api.client';
import { authClient } from '@/src/lib/auth-client';

/**
 * Sessão better-auth em cookie httpOnly. O cliente não guarda password nem JWT.
 */

const LEGACY_TOKEN_KEY = 'pumangol-auth-token';

if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // sessionStorage indisponível
  }
  window.addEventListener('auth:logout', () => {
    void authClient.signOut({}).catch(() => undefined);
  });
}

export async function loginLocal(email: string, password: string): Promise<{ user: AuthUser }> {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) {
    const status = result.error.status;
    const message = status === 401 || /invalid|credential/i.test(result.error.message || '')
      ? 'Email ou password inválidos.'
      : (result.error.message || 'Não foi possível iniciar sessão.');
    const err = new Error(message) as Error & { response?: { data?: { error?: string } } };
    err.response = { data: { error: message } };
    throw err;
  }

  const res = await apiClient.get<{ data: AuthUser }>('/sessao', { silencioso: true });
  return { user: res.data.data };
}

export async function logoutLocal(): Promise<void> {
  await authClient.signOut({}).catch(() => undefined);
}
