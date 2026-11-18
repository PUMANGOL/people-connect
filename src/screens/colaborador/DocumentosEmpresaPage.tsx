import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { Input, Select } from '@/src/components/ui/input';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { enviarFicheiro, REGRAS_FICHEIRO, validarFicheiro } from '@/src/services/ficheiros.service';
import { documentosEmpresaService, type DocumentoEmpresa } from '@/src/services/onboarding-v2.service';

const CATEGORIA_LABEL: Record<string, string> = {
  politica: 'Políticas',
  regulamento: 'Regulamentos',
  manual: 'Manuais',
  guia: 'Guias',
};

const CAT_OPTIONS = [
  { value: 'politica', label: 'Política' },
  { value: 'regulamento', label: 'Regulamento' },
  { value: 'manual', label: 'Manual' },
  { value: 'guia', label: 'Guia' },
];

function endereco(doc: DocumentoEmpresa, descarregar = false): string {
  if (doc.ficheiro_ref && !doc.ficheiro_ref.includes('/')) {
    const base = `/api/ficheiros?key=${encodeURIComponent(doc.ficheiro_ref)}`;
    return descarregar ? `${base}&descarregar=1` : base;
  }
  return doc.url ?? '';
}

export default function DocumentosEmpresaPage() {
  const admin = useAuthStore((s) => s.user?.role === 'rh_admin');
  const [docs, setDocs] = useState<DocumentoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('politica');
  const [descricao, setDescricao] = useState('');
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  function carregar() {
    documentosEmpresaService.list().then(setDocs).catch(() => setDocs([])).finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  function fechar() {
    if (aGuardar) return;
    setAberto(false);
    setNome('');
    setCategoria('politica');
    setDescricao('');
    setFicheiro(null);
  }

  async function guardar() {
    if (nome.trim().length < 2) {
      toast.error('Nome em falta', 'Indica o nome do documento.');
      return;
    }
    if (!ficheiro) {
      toast.error('Ficheiro em falta', 'Escolhe o documento para carregar.');
      return;
    }
    const invalido = validarFicheiro('empresa', ficheiro);
    if (invalido) {
      toast.error('Ficheiro não aceite', invalido);
      return;
    }
    setAGuardar(true);
    try {
      const enviado = await enviarFicheiro(ficheiro, { finalidade: 'empresa' });
      await documentosEmpresaService.create({
        nome: nome.trim(),
        categoria,
        descricao: descricao.trim() || null,
        ficheiro_id: enviado.id,
      } as Partial<DocumentoEmpresa> & { ficheiro_id: string });
      toast.success('Documento publicado', 'Já pode ser visto e descarregado.');
      setAberto(false);
      setNome('');
      setCategoria('politica');
      setDescricao('');
      setFicheiro(null);
      carregar();
    } catch {
      toast.error('Erro ao publicar', 'Não foi possível carregar o documento.');
    } finally {
      setAGuardar(false);
    }
  }

  async function remover(doc: DocumentoEmpresa) {
    try {
      await documentosEmpresaService.remove(doc.id);
      setDocs((lista) => lista.filter((d) => d.id !== doc.id));
      toast.success('Documento removido', doc.nome);
    } catch {
      toast.error('Erro ao remover', 'Tenta novamente.');
    }
  }

  const grupos = docs.reduce<Record<string, DocumentoEmpresa[]>>((acc, d) => {
    (acc[d.categoria] ??= []).push(d);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-navy-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-navy-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Políticas e Procedimentos</h1>
          <p className="mt-1 text-sm text-navy-400">Consulta e descarrega as políticas, regulamentos, manuais e guias da Pumangol.</p>
        </div>
        {admin && (
          <Button variant="accent" onClick={() => setAberto(true)}>
            <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Carregar documento</span>
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="Sem documentos disponíveis" description="Ainda não há políticas ou procedimentos publicados." />
      ) : (
        Object.entries(grupos).map(([cat, lista]) => (
          <section key={cat}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">
              {CATEGORIA_LABEL[cat] ?? cat}
            </h2>
            <div className="space-y-2">
              {lista.map((doc) => {
                const ver = endereco(doc);
                const baixar = endereco(doc, true);
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-50">
                      <FileText className="h-5 w-5 text-error-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy-800">{doc.nome}</p>
                      {doc.descricao && <p className="truncate text-xs text-navy-400">{doc.descricao}</p>}
                    </div>
                    <Badge variant="neutral" size="sm">{CATEGORIA_LABEL[cat] ?? cat}</Badge>
                    {ver ? (
                      <a href={ver} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300 hover:bg-navy-50">
                        Ver <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-navy-300">Indisponível</span>
                    )}
                    {baixar && (
                      <a href={baixar} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300 hover:bg-navy-50">
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </a>
                    )}
                    {admin && (
                      <button type="button" onClick={() => void remover(doc)} className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600" aria-label={`Remover ${doc.nome}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Dialog open={aberto} onClose={fechar} className="max-w-md">
        <h2 className="pr-8 font-heading text-xl font-semibold text-navy-900">Carregar documento</h2>
        <p className="mt-1 text-sm text-navy-500">Fica disponível para toda a gente ver e descarregar.</p>
        <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800" htmlFor="politica-nome">Nome</label>
            <Input id="politica-nome" value={nome} disabled={aGuardar} maxLength={120} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">Categoria</label>
            <Select options={CAT_OPTIONS} value={categoria} onChange={setCategoria} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800" htmlFor="politica-descricao">Descrição</label>
            <Input id="politica-descricao" value={descricao} disabled={aGuardar} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800" htmlFor="politica-ficheiro">Ficheiro</label>
            <input
              id="politica-ficheiro"
              type="file"
              disabled={aGuardar}
              accept={REGRAS_FICHEIRO.empresa.aceitar}
              onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-navy-700 file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-800"
            />
            <p className="mt-1 text-xs text-navy-400">{REGRAS_FICHEIRO.empresa.descricao}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" disabled={aGuardar} onClick={fechar}>Cancelar</Button>
            <Button type="submit" variant="accent" disabled={aGuardar}>{aGuardar ? 'A publicar…' : 'Publicar'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
