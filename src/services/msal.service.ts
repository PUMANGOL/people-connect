import { PublicClientApplication, type Configuration, type AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import type { UserRole, AuthUser } from '@/lib/types';

const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;
const TENANT_ID = process.env.NEXT_PUBLIC_AZURE_TENANT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI
  ?? (typeof window !== 'undefined' ? window.location.origin : '');

export const MSAL_CONFIGURED = Boolean(CLIENT_ID && TENANT_ID);

const msalConfig: Configuration | null = MSAL_CONFIGURED ? {
  auth: {
    clientId: CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: `${REDIRECT_URI}/login`,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
} : null;

let msalInstance: PublicClientApplication | null = null;

export async function initMsal(): Promise<PublicClientApplication | null> {
  if (!msalConfig) return null;
  if (msalInstance) return msalInstance;
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();
  return msalInstance;
}

export async function loginWithMicrosoft(): Promise<AuthUser | null> {
  const instance = await initMsal();
  if (!instance) throw new Error('MSAL não configurado');

  try {
    const result = await instance.loginPopup({
      scopes: ['User.Read', 'openid', 'profile', 'email'],
      prompt: 'select_account',
    });
    return mapAccountToAuthUser(result.account);
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await instance.loginRedirect({
        scopes: ['User.Read', 'openid', 'profile', 'email'],
      });
      // loginRedirect não retorna aqui
      return null;
    }
    throw err;
  }
}

export async function logoutMsal(): Promise<void> {
  const instance = await initMsal();
  if (!instance) return;
  const account = instance.getAllAccounts()[0];
  if (account) {
    await instance.logoutPopup({ account });
  }
}

export function getCurrentAccount(): AccountInfo | null {
  if (!msalInstance) return null;
  return msalInstance.getAllAccounts()[0] ?? null;
}

// Mapeia conta Microsoft → AuthUser
// Regra provisória: emails do domínio pumangol.ao com grupo "dpc-admin" → rh_admin
// Todos os outros do domínio → novo_colaborador
// Em produção esta lógica deve consultar a Neon DB para verificar se o email existe na tabela utilizadores
function mapAccountToAuthUser(account: AccountInfo | null): AuthUser | null {
  if (!account) return null;
  const email = account.username;
  const name = account.name ?? email.split('@')[0];

  // Regra simples MVP — pode ser refinada consultando a DB
  const isAdmin = email.toLowerCase().includes('dpc') ||
                  email.toLowerCase().includes('admin') ||
                  email.toLowerCase().includes('rh@');
  const role: UserRole = isAdmin ? 'rh_admin' : 'novo_colaborador';

  return {
    id: account.homeAccountId,
    nome: name,
    email,
    role,
    departamento: isAdmin ? 'Direcção de Pessoas e Cultura' : '—',
  };
}
