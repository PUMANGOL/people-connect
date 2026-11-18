import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  apagarNoServico,
  criarLinkUpload,
  ErroServicoFicheiros,
  informacaoFicheiro,
  linkLeitura,
  type Visibilidade,
} from './servico-ficheiros';

/**
 * Ficheiros novos vão para o Serviço de Ficheiros Pumangol. Na base de dados fica só o id.
 * O browser pede um link assinado à app e envia o ficheiro directamente para o serviço.
 * Chaves antigas (com "/") continuam a ser lidas no bucket S3, quando estiver configurado.
 */

const MB = 1024 * 1024;

const IMAGENS = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENTOS = [
  ...IMAGENS,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export type Finalidade = 'foto' | 'capa' | 'documento' | 'publicacao' | 'admissao';

export const ID_FICHEIRO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REGRAS: Record<Finalidade, { tipos: string[]; max: number; descricao: string }> = {
  foto: { tipos: IMAGENS, max: 5 * MB, descricao: 'JPG, PNG ou WEBP até 5 MB' },
  capa: { tipos: IMAGENS, max: 8 * MB, descricao: 'JPG, PNG ou WEBP até 8 MB' },
  publicacao: { tipos: IMAGENS, max: 8 * MB, descricao: 'JPG, PNG ou WEBP até 8 MB' },
  admissao: { tipos: [...IMAGENS, 'application/pdf'], max: 8 * MB, descricao: 'PDF, JPG, PNG ou WEBP até 8 MB' },
  documento: { tipos: DOCUMENTOS, max: 15 * MB, descricao: 'PDF, imagem, Word ou Excel até 15 MB' },
};

export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StorageError';
    this.status = status;
  }
}

interface Configuracao {
  bucket: string;
  interno: S3Client;
  publico: S3Client;
}

let _cfg: Configuracao | null = null;

function criarCliente(endpoint: string | undefined): S3Client {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    // Sem chaves no ambiente, o SDK usa a cadeia por omissão (ex.: papel IAM em PROD).
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function cfg(): Configuracao {
  if (_cfg) return _cfg;
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new StorageError('Este ficheiro antigo não está no serviço de ficheiros.', 404);
  const endpoint = process.env.S3_ENDPOINT;
  const endpointPublico = process.env.S3_PUBLIC_ENDPOINT || endpoint;
  const interno = criarCliente(endpoint);
  _cfg = { bucket, interno, publico: endpointPublico === endpoint ? interno : criarCliente(endpointPublico) };
  return _cfg;
}

/** Endereço da app que valida a sessão e redirecciona para o URL assinado. */
export function urlFicheiro(key: string | null | undefined): string | null {
  return key ? `/api/ficheiros?key=${encodeURIComponent(key)}` : null;
}

/** Valida tipo e tamanho declarados pelo browser antes de assinar o envio. */
export function validarFicheiro(finalidade: Finalidade, tipo: string, tamanho: number): void {
  const regra = REGRAS[finalidade];
  if (!regra.tipos.includes(tipo)) throw new StorageError(`Formato não suportado. Usa ${regra.descricao}.`);
  if (!Number.isFinite(tamanho) || tamanho <= 0) throw new StorageError('O ficheiro está vazio.');
  if (tamanho > regra.max) throw new StorageError(`O ficheiro excede o limite. Usa ${regra.descricao}.`);
}

function erroDeServico(err: unknown): never {
  if (err instanceof ErroServicoFicheiros) throw new StorageError(err.message, err.status);
  throw err;
}

/** Link assinado (5 min) para o browser enviar o ficheiro sem passar pela app. */
export async function linkEnvio(folder: string, uploadedBy: string, visibility: Visibilidade = 'PRIVATE') {
  try {
    const link = await criarLinkUpload(folder, uploadedBy, visibility, 300);
    return { url: link.url };
  } catch (err) {
    erroDeServico(err);
  }
}

/**
 * Confirma um id vindo do browser: a pasta, o autor e a visibilidade têm de ser os esperados.
 * Se o conteúdo não cumprir as regras, o ficheiro é apagado no serviço.
 */
export async function confirmarEnvio(
  finalidade: Finalidade,
  key: string,
  folder: string,
  uploadedBy: string,
  visibility: Visibilidade = 'PRIVATE',
) {
  if (!ID_FICHEIRO.test(key)) throw new StorageError('Ficheiro inválido.');
  let info;
  try {
    info = await informacaoFicheiro(key);
  } catch (err) {
    if (err instanceof ErroServicoFicheiros && err.status === 404) {
      throw new StorageError('O envio do ficheiro não terminou. Tenta novamente.');
    }
    erroDeServico(err);
  }
  if (info.folder !== folder || info.uploadedBy !== uploadedBy || info.visibility !== visibility) {
    throw new StorageError('Ficheiro inválido.');
  }
  try {
    validarFicheiro(finalidade, info.contentType, info.sizeBytes);
  } catch (err) {
    await apagarNoServico(key);
    throw err;
  }
  return { tipo: info.contentType, tamanho: info.sizeBytes, publicUrl: info.publicUrl };
}

/** Apaga um envio que a app não vai guardar, só se a pasta e o autor coincidirem. */
export async function descartarEnvio(key: string, folder: string, uploadedBy: string): Promise<void> {
  if (!ID_FICHEIRO.test(key)) return;
  try {
    const info = await informacaoFicheiro(key);
    if (info.folder !== folder || info.uploadedBy !== uploadedBy) return;
    await apagarNoServico(key);
  } catch (err) {
    const estado = err instanceof ErroServicoFicheiros ? err.status : 0;
    if (estado !== 404) console.error('[ficheiros] descartar', estado || 'sem resposta');
  }
}

/** Imagem de publicação ainda não gravada: só o autor a pode pré-visualizar. */
export async function imagemPorConfirmar(key: string, userId: string): Promise<boolean> {
  try {
    const info = await informacaoFicheiro(key);
    return info.folder === `comunidade/${userId}` && info.uploadedBy === userId && info.visibility === 'PRIVATE';
  } catch (err) {
    if (err instanceof ErroServicoFicheiros && err.status === 404) return false;
    erroDeServico(err);
  }
}

/** URL de leitura assinado (5 min no serviço, 10 min no S3 antigo). */
export async function urlLeitura(key: string, opcoes: { nome?: string; descarregar?: boolean } = {}): Promise<string> {
  if (ID_FICHEIRO.test(key)) {
    try {
      const link = await linkLeitura(key, 300);
      return opcoes.descarregar ? `${link.url}${link.url.includes('?') ? '&' : '?'}download=true` : link.url;
    } catch (err) {
      erroDeServico(err);
    }
  }
  const { bucket, publico } = cfg();
  const nomeSeguro = opcoes.nome?.replace(/["\\\r\n]/g, '_');
  const disposition = nomeSeguro
    ? `${opcoes.descarregar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nomeSeguro)}`
    : undefined;
  return getSignedUrl(
    publico,
    new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: disposition }),
    { expiresIn: 600 },
  );
}

/** Remove o objecto; falhas ficam no log para não bloquear a operação na BD. */
export async function apagarObjecto(key: string | null | undefined): Promise<void> {
  if (!key) return;
  if (ID_FICHEIRO.test(key)) {
    await apagarNoServico(key);
    return;
  }
  try {
    const { bucket, interno } = cfg();
    await interno.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error('[storage] apagar', key, err);
  }
}

