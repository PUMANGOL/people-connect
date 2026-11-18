import { apiClient } from './api.client';
import { ErroVisivel } from '@/src/lib/erro-pedido';

export type FinalidadeFicheiro = 'foto' | 'capa' | 'documento' | 'publicacao';

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
  publicacao: { tipos: IMAGENS, max: 8 * MB, aceitar: IMAGENS.join(','), descricao: 'JPG, PNG ou WEBP até 8 MB' },
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

export interface FicheiroEnviado {
  id: string;
  publicUrl: string | null;
}

/** O serviço guarda o nome em ASCII. O nome original fica na base de dados da app. */
function nomeAscii(nome: string): string {
  const limpo = nome.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9._ -]/g, '_');
  return limpo.replace(/^\.+/, '') || 'ficheiro';
}

function detalheRecusa(corpo: string): string {
  const omissao = 'O armazenamento recusou o ficheiro. Confirma o formato e o tamanho.';
  try {
    const body = JSON.parse(corpo) as { detail?: string };
    const detalhe = body.detail?.trim() ?? '';
    if (detalhe && detalhe.length <= 180 && !/https?:|fsk_|api-key/i.test(detalhe)) return detalhe;
  } catch {
    // A resposta nem sempre é JSON.
  }
  return omissao;
}

/** Envia o ficheiro para um link assinado. Não definir Content-Type: o browser põe o boundary. */
export function enviarParaUrl(
  url: string,
  file: File,
  onProgresso?: (percentagem: number) => void,
): Promise<FicheiroEnviado> {
  const form = new FormData();
  form.append('file', file, nomeAscii(file.name));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ErroVisivel(detalheRecusa(xhr.responseText)));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as { id?: string; publicUrl?: string | null };
        if (!body.id) reject(new ErroVisivel('O serviço não devolveu o identificador do ficheiro.'));
        else resolve({ id: body.id, publicUrl: body.publicUrl ?? null });
      } catch {
        reject(new ErroVisivel('Resposta inválida do serviço de ficheiros.'));
      }
    };
    xhr.onerror = () => reject(new ErroVisivel('Sem ligação ao armazenamento de ficheiros. Tenta novamente.'));
    xhr.send(form);
  });
}

/**
 * Pede um link assinado à app e envia o ficheiro directamente para o serviço.
 * Devolve o id, que depois se confirma no endpoint da finalidade.
 */
export async function enviarFicheiro(
  file: File,
  opcoes: {
    finalidade: FinalidadeFicheiro;
    progressoId?: string;
    documentoChave?: string;
    onProgresso?: (percentagem: number) => void;
  },
): Promise<FicheiroEnviado> {
  const tipo = tipoDoFicheiro(file);
  const { data } = await apiClient.post<{ data: { url: string } }>('/ficheiros/envio', {
    finalidade: opcoes.finalidade,
    tipo,
    tamanho: file.size,
    progressoId: opcoes.progressoId,
    documentoChave: opcoes.documentoChave,
  });
  return enviarParaUrl(data.data.url, file, opcoes.onProgresso);
}
