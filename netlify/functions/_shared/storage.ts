import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Ficheiros num bucket S3 (MinIO em desenvolvimento, S3 em PROD).
 * O browser envia directamente para o bucket com um POST assinado (tamanho e tipo
 * validados pelo próprio S3) e lê através de URLs assinados de curta duração.
 * O bucket é privado: a app decide quem pode ler antes de assinar.
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

export type Finalidade = 'foto' | 'capa' | 'documento';

export const REGRAS: Record<Finalidade, { tipos: string[]; max: number; descricao: string }> = {
  foto: { tipos: IMAGENS, max: 5 * MB, descricao: 'JPG, PNG ou WEBP até 5 MB' },
  capa: { tipos: IMAGENS, max: 8 * MB, descricao: 'JPG, PNG ou WEBP até 8 MB' },
  documento: { tipos: DOCUMENTOS, max: 15 * MB, descricao: 'PDF, imagem, Word ou Excel até 15 MB' },
};

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
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
  if (!bucket) throw new StorageError('O armazenamento de ficheiros não está configurado.', 503);
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

/** Chave única no bucket: `${prefixo}/${uuid}.${ext}`. O nome original fica na BD. */
export function novaChave(prefixo: string, tipo: string): string {
  return `${prefixo}/${randomUUID()}.${EXTENSOES[tipo] ?? 'bin'}`;
}

/** POST assinado (5 min) que só aceita esta chave, este tipo e até ao tamanho máximo da finalidade. */
export async function prepararEnvio(finalidade: Finalidade, key: string, tipo: string) {
  const { bucket, publico } = cfg();
  const { url, fields } = await createPresignedPost(publico, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, REGRAS[finalidade].max],
      ['eq', '$Content-Type', tipo],
    ],
    Fields: { 'Content-Type': tipo },
    Expires: 300,
  });
  return { url, fields, key };
}

/** Confirma que o objecto chegou ao bucket e devolve o tipo e o tamanho reais. */
export async function lerMetadados(key: string): Promise<{ tipo: string; tamanho: number } | null> {
  const { bucket, interno } = cfg();
  try {
    const r = await interno.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { tipo: r.ContentType ?? 'application/octet-stream', tamanho: Number(r.ContentLength ?? 0) };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (err as Error).name === 'NotFound') return null;
    throw err;
  }
}

/** URL de leitura assinado (10 min). Com `nome`, o browser descarrega com esse nome. */
export async function urlLeitura(key: string, opcoes: { nome?: string; descarregar?: boolean } = {}): Promise<string> {
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
  try {
    const { bucket, interno } = cfg();
    await interno.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error('[storage] apagar', key, err);
  }
}

/** Valida um objecto acabado de enviar: existe, está dentro do prefixo esperado e cumpre as regras. */
export async function confirmarEnvio(finalidade: Finalidade, key: string, prefixo: string) {
  if (typeof key !== 'string' || !key.startsWith(`${prefixo}/`) || key.includes('..')) {
    throw new StorageError('Ficheiro inválido.');
  }
  const meta = await lerMetadados(key);
  if (!meta) throw new StorageError('O envio do ficheiro não terminou. Tenta novamente.');
  try {
    validarFicheiro(finalidade, meta.tipo, meta.tamanho);
  } catch (err) {
    await apagarObjecto(key);
    throw err;
  }
  return meta;
}
