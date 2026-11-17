import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { EmptyState } from '@/src/components/ui/card';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { documentosEmpresaService, type DocumentoEmpresa } from '@/src/services/onboarding-v2.service';

const CAT_OPTIONS = [
  { value: 'politica', label: 'Política' },
  { value: 'regulamento', label: 'Regulamento' },
  { value: 'manual', label: 'Manual' },
  { value: 'guia', label: 'Guia' },
];

function empty(): Partial<DocumentoEmpresa> {
  return { nome: '', categoria: 'politica', url: '', descricao: '' };
}

export default function DocumentosEmpresaAdminPage() {
  const [docs, setDocs] = useState<DocumentoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<DocumentoEmpresa> | null>(null);

  function carregar() {
    documentosEmpresaService.list().then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function guardar() {
    if (!editing?.nome?.trim()) return toast.error('Nome obrigatório');
    try {
      if (editing.id) await documentosEmpresaService.update(editing.id, editing);
      else await documentosEmpresaService.create(editing);
      toast.success('Documento guardado');
      setEditing(null);
      carregar();
    } catch {
      toast.error('Erro ao guardar');
    }
  }

  async function remover(id: string) {
    try {
      await documentosEmpresaService.remove(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  }

  if (loading) {
    return <SkeletonList rows={5} cols={4} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Documentos da Empresa</h1>
          <p className="mt-1 text-sm text-navy-400">Documentos disponíveis para consulta pelos colaboradores.</p>
        </div>
        <Button variant="accent" onClick={() => setEditing(empty())}>
          <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Novo</span>
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Sem documentos" description="Adiciona o primeiro documento." />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy-800">{d.nome}</p>
                {d.descricao && <p className="truncate text-xs text-navy-400">{d.descricao}</p>}
              </div>
              <Badge variant="neutral" size="sm">{CAT_OPTIONS.find((c) => c.value === d.categoria)?.label ?? d.categoria}</Badge>
              <button onClick={() => setEditing(d)} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remover(d.id)} className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <h2 className="mb-4 text-lg font-semibold text-navy-800">{editing.id ? 'Editar documento' : 'Novo documento'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Nome</label>
              <Input value={editing.nome ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, nome: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Categoria</label>
              <Select options={CAT_OPTIONS} value={editing.categoria ?? 'politica'} onChange={(v) => setEditing((x) => ({ ...x!, categoria: v }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">URL / link do PDF</label>
              <Input value={editing.url ?? ''} placeholder="https://…" onChange={(e) => setEditing((x) => ({ ...x!, url: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Descrição</label>
              <Input value={editing.descricao ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, descricao: e.target.value }))} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="accent" onClick={guardar}>Guardar</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
