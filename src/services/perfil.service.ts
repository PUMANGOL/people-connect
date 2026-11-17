import { apiClient } from './api.client';
import { enviarFicheiro } from './ficheiros.service';
import type { Estrutura } from './pessoas.service';

export type Disponibilidade = 'disponivel' | 'ocupado' | 'ausente';

export const DISPONIBILIDADE: Record<Disponibilidade, { label: string; ponto: string }> = {
  disponivel: { label: 'Disponível para conversas', ponto: 'bg-success-500' },
  ocupado: { label: 'Ocupado', ponto: 'bg-warning-500' },
  ausente: { label: 'Ausente', ponto: 'bg-neutral-400' },
};

export interface ActividadePerfil {
  tipo: 'publicacao' | 'comentario' | 'reconhecimento';
  post_id: string | null;
  titulo: string;
  texto: string;
  created_at: string;
}

export interface MeuPerfil {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  funcao: string | null;
  direccao: string | null;
  area: string | null;
  categoria: string | null;
  data_admissao: string | null;
  membro_desde: string;
  foto_url: string | null;
  capa_url: string | null;
  bio: string | null;
  localizacao: string | null;
  telefone: string | null;
  extensao: string | null;
  disponibilidade: Disponibilidade;
  posso_ajudar: string[];
  interesses: string[];
  mentor: { nome: string; funcao: string | null; utilizador_id: string | null } | null;
  mentorados: number;
  onboarding: { trilho_nome: string; total: number; concluidas: number } | null;
  estrutura: Estrutura;
  estatisticas: { publicacoes: number; comentarios: number; gostos: number };
  reconhecimentos: {
    recebidos: number;
    dados: number;
    aplausos: number;
    por_valor: { valor: string; total: number }[];
    ultimos: { id: string; valor: string; mensagem: string; created_at: string; autor_nome: string }[];
  };
  actividade: ActividadePerfil[];
}

export type PerfilEditavel = Pick<
  MeuPerfil,
  'bio' | 'localizacao' | 'telefone' | 'extensao' | 'disponibilidade' | 'posso_ajudar' | 'interesses'
>;

function data<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  return p.then((r) => r.data.data);
}

export const perfilService = {
  meu: () => data<MeuPerfil>(apiClient.get('/perfil')),
  actualizar: (patch: Partial<PerfilEditavel>) => data<PerfilEditavel>(apiClient.patch('/perfil', patch)),
  /** Envia a imagem para o bucket e associa-a ao perfil. Devolve o URL da app. */
  async enviarImagem(tipo: 'foto' | 'capa', file: File, onProgresso?: (p: number) => void): Promise<string> {
    const key = await enviarFicheiro(file, { finalidade: tipo, onProgresso });
    const r = await data<{ url: string }>(apiClient.put('/perfil/imagem', { tipo, key }));
    return r.url;
  },
  removerImagem: (tipo: 'foto' | 'capa') => data<{ url: null }>(apiClient.delete('/perfil/imagem', { params: { tipo } })),
};
