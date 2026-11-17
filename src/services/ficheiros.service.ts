import { apiClient } from './api.client';
import { ErroVisivel } from '@/src/lib/erro-pedido';

export type FinalidadeFicheiro = 'foto' | 'capa' | 'documento';

const MB = 1024 * 1024;
const IMAGENS = ['image/jpeg', 'image/png', 'image/webp'];

const TIPO_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Espelha as regras do servidor (netlify/functions/_shared/storage.ts). */
export const REGRAS_FICHEIRO: Record<FinalidadeFicheiro, { tipos: string[]; max: number; aceitar: string; descricao: string }> = {
  foto: { tipos: IMAGENS, max: 5 * MB, aceitar: IMAGENS.join(','), descricao: 'JPG, PNG ou WEBP até 5 MB' },
  capa: { tipos: IMAGENS, max: 8 * MB, aceitar: IMAGENS.join(','), descricao: 'JPG, PNG ou WEBP até 8 MB' },
  documento: {
    tipos: Object.values(TIPO_POR_EXTENSAO),
    max: 15 * MB,
    aceitar: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx',
    descricao: 'PDF, imagem, Word ou Excel até 15 MB',
  },
};

/** Alguns browsers não indicam o tipo de .docx/.xlsx; usa a extensão. */
export function tipoDoFicheiro(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TIPO_POR_EXTENSAO[ext] ?? '';
}

/** Mensagem de erro se o ficheiro não cumpre as regras; null se está tudo bem. */
export function validarFicheiro(finalidade: FinalidadeFicheiro, file: File): string | null {
  const regra = REGRAS_FICHEIRO[finalidade];
  if (!regra.tipos.includes(tipoDoFicheiro(file))) return `Formato não suportado. Usa ${regra.descricao}.`;
  if (file.size <= 0) return 'O ficheiro está vazio.';
  if (file.size > regra.max) return `O ficheiro excede o limite. Usa ${regra.descricao}.`;
  return null;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

interface EnvioAssinado {
  url: string;
  fields: Record<string, string>;
  key: string;
}

/**
 * Envia o ficheiro directamente para o bucket com o POST assinado pela API.
 * Devolve a chave do objecto, que depois se confirma no endpoint da finalidade.
 */
export async function enviarFicheiro(
  file: File,
  opcoes: {
    finalidade: FinalidadeFicheiro;
    progressoId?: string;
    documentoChave?: string;
    onProgresso?: (percentagem: number) => void;
  },
): Promise<string> {
  const tipo = tipoDoFicheiro(file);
  const { data } = await apiClient.post<{ data: EnvioAssinado }>('/ficheiros/envio', {
    finalidade: opcoes.finalidade,
    tipo,
    tamanho: file.size,
    progressoId: opcoes.progressoId,
    documentoChave: opcoes.documentoChave,
  });
  const { url, fields, key } = data.data;

  const form = new FormData();
  for (const [campo, valor] of Object.entries(fields)) form.append(campo, valor);
  // O S3 exige o ficheiro como último campo do formulário.
  form.append('file', file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opcoes.onProgresso?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ErroVisivel('O armazenamento recusou o ficheiro. Confirma o formato e o tamanho.'));
    };
    xhr.onerror = () => reject(new ErroVisivel('Sem ligação ao armazenamento de ficheiros. Tenta novamente.'));
    xhr.send(form);
  });
  return key;
}
