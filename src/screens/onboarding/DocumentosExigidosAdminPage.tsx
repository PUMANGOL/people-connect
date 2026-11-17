import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { EmptyState } from '@/src/components/ui/card';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { documentosExigidosService, type DocumentoExigido } from '@/src/services/onboarding-v2.service';
import { Checkbox } from '@/components/ui/checkbox';

function empty(): Partial<DocumentoExigido> {
  return { nome: '', descricao: '', obrigatorio: true, ordem: 0 };
}

export default function DocumentosExigidosAdminPage() {
  const [docs, setDocs] = useState<DocumentoExigido[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<DocumentoExigido> | null>(null);

  function carregar() {
    documentosExigidosService.list().then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function guardar() {
    if (!editing?.nome?.trim()) return toast.error('Nome obrigatório');
    try {
      if (editing.id) await documentosExigidosService.update(editing.id, editing);
      else await documentosExigidosService.create(editing);
      toast.success('Documento exigido guardado');
      setEditing(null);
      carregar();
    } catch {
      toast.error('Erro ao guardar');
    }
  }

  async function remover(id: string) {
    try {
      await documentosExigidosService.remove(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl"><SkeletonList rows={5} cols={3} /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Documentos Exigidos</h1>
          <p className="mt-1 text-sm text-navy-400">Lista de documentos que cada colaborador deve submeter à DPC.</p>
        </div>
        <Button variant="accent" onClick={() => setEditing(empty())}>
          <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Novo</span>
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="Sem documentos exigidos" description="Define o primeiro documento a submeter." />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4">
              <span className="w-6 text-center text-xs font-semibold text-navy-300">{d.ordem}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy-800">{d.nome}</p>
                {d.descricao && <p className="truncate text-xs text-navy-400">{d.descricao}</p>}
              </div>
              <Badge variant={d.obrigatorio ? 'error' : 'neutral'} size="sm">{d.obrigatorio ? 'Obrigatório' : 'Opcional'}</Badge>
              <button onClick={() => setEditing(d)} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remover(d.id)} className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <h2 className="mb-4 text-lg font-semibold text-navy-800">{editing.id ? 'Editar' : 'Novo documento exigido'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Nome</label>
              <Input value={editing.nome ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, nome: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">Descrição</label>
              <Input value={editing.descricao ?? ''} onChange={(e) => setEditing((x) => ({ ...x!, descricao: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy-500">Ordem</label>
                <Input type="number" className="w-24" value={String(editing.ordem ?? 0)} onChange={(e) => setEditing((x) => ({ ...x!, ordem: Number(e.target.value) || 0 }))} />
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm text-navy-700">
                <Checkbox checked={editing.obrigatorio ?? true} onCheckedChange={(checked) => setEditing((x) => ({ ...x!, obrigatorio: checked }))} />
                Obrigatório
              </label>
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
