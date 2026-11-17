import { urlFicheiro } from './storage';

/** Documento que o colaborador anexa numa etapa (etapas_trilho.documentos_pedidos). */
export type DocumentoPedido = {
  chave: string;
  nome: string;
  obrigatorio: boolean;
};

export function lerDocumentosPedidos(valor: unknown): DocumentoPedido[] {
  if (typeof valor === 'string') {
    try {
      valor = JSON.parse(valor);
    } catch {
      return [];
    }
  }
  return Array.isArray(valor) ? (valor as DocumentoPedido[]) : [];
}

/** Limpa a lista vinda do editor de trilhos: nomes preenchidos, chaves únicas, máx. 20. */
export function normalizarDocumentosPedidos(valor: unknown): DocumentoPedido[] {
  if (!Array.isArray(valor)) return [];
  const chaves = new Set<string>();
  const lista: DocumentoPedido[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const nome = typeof d.nome === 'string' ? d.nome.trim().slice(0, 120) : '';
    if (!nome) continue;
    let chave = typeof d.chave === 'string' ? d.chave.trim().slice(0, 64) : '';
    if (!chave || chaves.has(chave)) chave = crypto.randomUUID();
    chaves.add(chave);
    lista.push({ chave, nome, obrigatorio: d.obrigatorio !== false });
    if (lista.length >= 20) break;
  }
  return lista;
}

export function formatarAnexo(a: Record<string, unknown>) {
  return {
    id: a.id,
    progresso_id: a.progresso_id,
    documento_chave: a.documento_chave,
    ficheiro_nome: a.ficheiro_nome,
    ficheiro_tipo: a.ficheiro_tipo,
    tamanho: a.tamanho,
    created_at: a.created_at,
    url: urlFicheiro(a.ficheiro_key as string),
  };
}
