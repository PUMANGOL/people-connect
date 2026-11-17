import { apiClient } from './api.client';
import { enviarFicheiro } from './ficheiros.service';

/** Documento que o colaborador anexa numa etapa do trilho. */
export interface DocumentoPedido {
  chave: string;
  nome: string;
  obrigatorio: boolean;
}

export interface EtapaAnexo {
  id: string;
  progresso_id: string;
  documento_chave: string;
  ficheiro_nome: string;
  ficheiro_tipo: string;
  tamanho: number;
  created_at: string;
  /** Endereço da app; redirecciona para o ficheiro depois de validar a sessão. */
  url: string;
}

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const anexosService = {
  doColaborador: (colaboradorId: string) =>
    data<EtapaAnexo[]>(apiClient.get('/etapa-anexos', { params: { colaboradorId }, silencioso: true })),
  async anexar(
    progressoId: string,
    documentoChave: string,
    file: File,
    onProgresso?: (p: number) => void,
  ): Promise<EtapaAnexo> {
    const key = await enviarFicheiro(file, { finalidade: 'documento', progressoId, documentoChave, onProgresso });
    return data<EtapaAnexo>(apiClient.post('/etapa-anexos', { progressoId, documentoChave, key, nome: file.name }));
  },
  remover: (id: string) => data<{ id: string }>(apiClient.delete(`/etapa-anexos/${id}`)),
};

export function urlDescarregar(anexo: EtapaAnexo): string {
  return `${anexo.url}&descarregar=1`;
}
