/**
 * Cliente do Serviço de Ficheiros Pumangol.
 * A chave fica só no servidor (FILE_SERVICE_APP_ID / FILE_SERVICE_API_KEY).
 * O browser recebe apenas links assinados de curta duração, nunca a chave.
 */

const URL_OMISSAO = 'https://portal.pumangol.co.ao/ficheiros';
const INDISPONIVEL = 'O serviço de ficheiros não está disponível. Tenta dentro de alguns minutos.';

const MENSAGENS: Record<number, string> = {
  401: 'Não foi possível autenticar no serviço de ficheiros.',
  403: 'O serviço de ficheiros recusou este pedido.',
  404: 'Ficheiro não encontrado.',
  413: 'O ficheiro é demasiado grande.',
  415: 'Tipo de ficheiro não permitido.',
};

export type Visibilidade = 'PUBLIC' | 'PRIVATE';

export interface FicheiroGuardado {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  visibility: Visibilidade;
  folder: string | null;
  uploadedBy: string | null;
  publicUrl: string | null;
}

export interface LinkFicheiro {
  url: string;
  expiresAt: string;
}

export class ErroServicoFicheiros extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ErroServicoFicheiros';
    this.status = status;
    this.code = code;
  }
}

function configuracao(): { base: string; appId: string; apiKey: string } {
  const base = (process.env.FILE_SERVICE_URL || URL_OMISSAO).replace(/\/+$/, '');
  const appId = process.env.FILE_SERVICE_APP_ID ?? '';
  const apiKey = process.env.FILE_SERVICE_API_KEY ?? '';
  if (!appId || !apiKey) {
    throw new ErroServicoFicheiros(503, 'O serviço de ficheiros não está configurado.');
  }
  return { base, appId, apiKey };
}

async function chamar<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, appId, apiKey } = configuracao();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'X-App-Id': appId,
        'X-Api-Key': apiKey,
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ErroServicoFicheiros(503, INDISPONIVEL);
  }

  if (!res.ok) {
    const problem = await res.json().catch(() => ({})) as { code?: string };
    if (res.status === 401 || res.status === 403) {
      console.error('[ficheiros-servico]', res.status, problem.code ?? '');
    }
    const message = MENSAGENS[res.status] ?? (res.status >= 500 ? INDISPONIVEL : 'Não foi possível guardar o ficheiro.');
    throw new ErroServicoFicheiros(res.status, message, problem.code);
  }
  if (res.status === 204) return undefined as T;
  return await res.json() as T;
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** Link de upload (5 min por omissão). O browser envia o ficheiro para este URL, sem a chave. */
export function criarLinkUpload(
  folder: string,
  uploadedBy: string,
  visibility: Visibilidade = 'PRIVATE',
  expiresInSeconds = 300,
) {
  return chamar<LinkFicheiro>('/api/v1/upload-urls', json({ folder, visibility, uploadedBy, expiresInSeconds }));
}

export function informacaoFicheiro(id: string) {
  return chamar<FicheiroGuardado>(`/api/v1/files/${id}`);
}

/** Link de leitura temporário. Não registar o URL: dá acesso ao ficheiro até expirar. */
export function linkLeitura(id: string, expiresInSeconds = 300) {
  return chamar<LinkFicheiro>(`/api/v1/files/${id}/signed-url`, json({ expiresInSeconds }));
}

/** Apaga no serviço. Uma falha fica no log e não desfaz a operação já gravada na base de dados. */
export async function apagarNoServico(id: string): Promise<void> {
  try {
    await chamar<void>(`/api/v1/files/${id}`, { method: 'DELETE' });
  } catch (err) {
    const estado = err instanceof ErroServicoFicheiros ? err.status : 0;
    if (estado !== 404) console.error('[ficheiros-servico] apagar', estado || 'sem resposta');
  }
}
