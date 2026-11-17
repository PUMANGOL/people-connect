import { apiClient } from './api.client';
import type { EstadoAdmissao, EstadoEtapaAdmissao, ResultadoEtapa, SemaforoAdmissao } from '@/src/lib/admissao-fluxo';

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export interface ProcessoAdmissao {
  id: string;
  candidato_ref: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  funcao: string | null;
  direccao: string | null;
  empresa: string | null;
  gestor: string | null;
  local_trabalho: string | null;
  categoria: string | null;
  tipo_contrato: string | null;
  data_prevista_entrada: string | null;
  estado: EstadoAdmissao;
  etapa_actual: string;
  etapa_nome: string;
  fase: string;
  semaforo: SemaforoAdmissao;
  bloqueado: boolean;
  bloqueio_motivo: string | null;
  motivo_cancelamento: string | null;
  oferta_validade: string | null;
  oferta_condicoes: string | null;
  oferta_enviada_em: string | null;
  oferta_destinatario: string | null;
  colaborador_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EtapaAdmissao {
  id: string;
  codigo: string;
  ordem: number;
  estado: EstadoEtapaAdmissao;
  resultado: ResultadoEtapa | null;
  observacao: string | null;
  concluida_em: string | null;
  nome: string;
  fase: string;
  responsavel: string;
  descricao: string;
  decisao: boolean;
  sim_etiqueta: string;
  nao_etiqueta: string | null;
}

export interface AuditoriaAdmissao {
  id: string;
  accao: string;
  dados_anteriores: { resumo?: string; estado?: string; etapa?: string } | null;
  dados_novos: { resumo?: string; estado?: string; etapa?: string } | null;
  timestamp: string;
  utilizador_nome: string | null;
}

export interface AdmissaoDetalhe {
  processo: ProcessoAdmissao;
  etapas: EtapaAdmissao[];
  auditoria: AuditoriaAdmissao[];
}

export interface ChecklistItem {
  id: string;
  documento_exigido_id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  obrigatorio: boolean;
  ordem: number;
  submissao: {
    estado: 'submetido' | 'validado' | 'rejeitado';
    ficheiro_nome: string | null;
    motivo: string | null;
    submetido_em: string | null;
    avaliado_em: string | null;
  } | null;
}

export interface ChecklistAdmissao {
  enviado_em: string | null;
  link: string | null;
  itens: ChecklistItem[];
}

export interface NovaAdmissao {
  nome: string;
  candidato_ref?: string | null;
  email?: string | null;
  telefone?: string | null;
  funcao?: string | null;
  direccao?: string | null;
  empresa?: string | null;
  gestor?: string | null;
  local_trabalho?: string | null;
  categoria?: string | null;
  tipo_contrato?: string | null;
  data_prevista_entrada?: string | null;
}

export const admissaoService = {
  list: () => data<ProcessoAdmissao[]>(apiClient.get('/admissao')),
  get: (id: string) => data<AdmissaoDetalhe>(apiClient.get(`/admissao/${id}`)),
  criar: (payload: NovaAdmissao) => data<ProcessoAdmissao>(apiClient.post('/admissao', payload)),
  actualizar: (id: string, payload: Partial<NovaAdmissao>) =>
    data<ProcessoAdmissao>(apiClient.patch(`/admissao/${id}`, payload)),
  accao: (id: string, payload: { accao: 'avancar' | 'recusar' | 'cancelar'; observacao?: string; motivo?: string }) =>
    data<AdmissaoDetalhe>(apiClient.post(`/admissao/${id}/accao`, payload)),
  documentos: (id: string) => data<ChecklistAdmissao>(apiClient.get(`/admissao/${id}/documentos`)),
  adicionarDocumento: (id: string, payload: { documento_exigido_id: string; obrigatorio: boolean }) =>
    data<ChecklistAdmissao>(apiClient.post(`/admissao/${id}/documentos`, payload)),
  actualizarDocumento: (id: string, docId: string, obrigatorio: boolean) =>
    data<ChecklistAdmissao>(apiClient.patch(`/admissao/${id}/documentos/${docId}`, { obrigatorio })),
  removerDocumento: (id: string, docId: string) =>
    data<ChecklistAdmissao>(apiClient.delete(`/admissao/${id}/documentos/${docId}`)),
  enviarChecklist: (id: string) => data<ChecklistAdmissao>(apiClient.post(`/admissao/${id}/documentos/enviar`)),
  avaliarDocumento: (id: string, docId: string, payload: { accao: 'validado' | 'rejeitado'; motivo?: string }) =>
    data<ChecklistAdmissao>(apiClient.post(`/admissao/${id}/documentos/${docId}/avaliar`, payload)),
  enviarCarta: (id: string, payload: {
    validade: string;
    assunto: string;
    corpoHtml: string;
    anexoNome: string;
    anexoBase64: string;
    observacao?: string;
  }) => data<AdmissaoDetalhe>(apiClient.post(`/admissao/${id}/carta`, payload)),
};
