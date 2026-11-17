import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, BookOpen, MessageSquare, GraduationCap, Settings, Layers, ChevronRight, Pencil, Copy, Trash2, ArrowUp, ArrowDown, Paperclip, X } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, FormField, Select } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { toast } from '@/src/store';
import type { TipoEtapa } from '@/lib/types';
import { trilhosService, type Trilho, type TrilhoEtapaInput } from '@/src/services/onboarding-v2.service';
import type { DocumentoPedido } from '@/src/services/anexos.service';
import { useCatalogo } from '@/src/hooks/use-catalogo';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

const TIPO_CONFIG: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  documental: { label: 'Documental', icon: BookOpen, color: 'text-info-500' },
  conversacional: { label: 'Conversacional', icon: MessageSquare, color: 'text-gold-600' },
  formacao: { label: 'Formação', icon: GraduationCap, color: 'text-success-500' },
  administrativo: { label: 'Administrativo', icon: Settings, color: 'text-navy-500' },
  misto: { label: 'Misto', icon: Layers, color: 'text-navy-700' },
};
const TIPO_OPTIONS = Object.entries(TIPO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

export default function TrilhosPage() {
  const { categoriaOptions } = useCatalogo();
  const [trilhos, setTrilhos] = useState<Trilho[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Trilho | 'novo' | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    trilhosService.list().then(setTrilhos).catch(() => setTrilhos([])).finally(() => setLoading(false));
  }, []);
  useEffect(carregar, [carregar]);

  async function duplicar(id: string) {
    try {
      await trilhosService.duplicar(id);
      toast.success('Trilho duplicado');
      carregar();
    } catch { toast.error('Erro ao duplicar'); }
  }

  async function remover(id: string, nome: string) {
    if (!window.confirm(`Remover o trilho "${nome}"? As instâncias já atribuídas não são afectadas.`)) return;
    try {
      await trilhosService.remove(id);
      toast.success('Trilho removido');
      carregar();
    } catch { toast.error('Erro ao remover'); }
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Trilhos de Onboarding</h1>
          <p className="mt-1 text-sm text-navy-400">Templates de integração por categoria</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('novo')}>Novo Trilho</Button>
      </motion.div>

      {loading ? (
        <SkeletonList rows={4} cols={4} />
      ) : trilhos.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="Cria o teu primeiro trilho" description="Define trilhos por categoria para padronizar a integração." action={{ label: 'Criar Trilho', onClick: () => setEditing('novo') }} />
      ) : (
        <motion.div variants={staggerItem} className="space-y-4">
          {trilhos.map((trilho) => {
            const isExpanded = expandedId === trilho.id;
            return (
              <div key={trilho.id} className="overflow-hidden rounded-xl border border-navy-100 bg-white">
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => setExpandedId(isExpanded ? null : trilho.id)} className="flex flex-1 items-center gap-4 text-left">
                    <ChevronRight className={`h-4 w-4 text-navy-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy-800">{trilho.nome}</span>
                        <Badge variant={trilho.activo ? 'success' : 'neutral'} size="sm">{trilho.activo ? 'Activo' : 'Inactivo'}</Badge>
                        <Badge variant="accent" size="sm">{categoriaOptions.find((c) => c.value === trilho.categoria)?.label ?? trilho.categoria}</Badge>
                      </div>
                      <p className="text-sm text-navy-400">
                        {trilho.funcao || '—'} — {trilho.num_etapas ?? trilho.etapas?.length ?? 0} etapas
                        {trilho.duracao_estimada ? ` — ${trilho.duracao_estimada} dias` : ''}
                      </p>
                    </div>
                  </button>
                  <button onClick={() => setEditing(trilho)} title="Editar" className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => duplicar(trilho.id)} title="Duplicar" className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => remover(trilho.id, trilho.nome)} title="Remover" className="rounded-md p-1.5 text-error-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                {isExpanded && (
                  <div className="border-t border-navy-100 px-5 py-4">
                    <div className="space-y-2">
                      {(trilho.etapas ?? []).map((etapa, idx) => {
                        const cfg = TIPO_CONFIG[etapa.tipo ?? 'documental'] ?? TIPO_CONFIG.documental;
                        const Icon = cfg.icon;
                        return (
                          <div key={etapa.id ?? idx} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-navy-50">
                            <span className="w-6 text-right font-mono text-xs text-navy-300">{idx + 1}</span>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 ${cfg.color}`}><Icon className="h-4 w-4" /></div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-navy-700">{etapa.nome}</span>
                              {etapa.descricao && <p className="text-xs text-navy-400">{etapa.descricao}</p>}
                            </div>
                            {(etapa.documentos_pedidos?.length ?? 0) > 0 && (
                              <Badge variant="neutral" size="sm">
                                <Paperclip className="mr-1 h-3 w-3" />
                                {etapa.documentos_pedidos!.length} doc{etapa.documentos_pedidos!.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                            {etapa.responsavel_default && <Badge variant="neutral" size="sm">{etapa.responsavel_default}</Badge>}
                            {etapa.obrigatoria && <Badge variant="neutral" size="sm">Obrigatória</Badge>}
                            {etapa.bloqueante && <Badge variant="info" size="sm">Bloqueante</Badge>}
                            <span className="text-xs text-navy-400">{etapa.duracao_dias ?? 1}d</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      )}

      {editing && (
        <TrilhoModal
          trilho={editing === 'novo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); carregar(); }}
        />
      )}
    </motion.div>
  );
}

function TrilhoModal({ trilho, onClose, onSaved }: { trilho: Trilho | null; onClose: () => void; onSaved: () => void }) {
  const { funcaoOptions, categoriaOptions } = useCatalogo();
  const [form, setForm] = useState({
    nome: trilho?.nome ?? '',
    funcao: trilho?.funcao ?? '',
    categoria: trilho?.categoria ?? 'tecnicos',
    duracao_estimada: trilho?.duracao_estimada ?? 90,
  });
  const [etapas, setEtapas] = useState<TrilhoEtapaInput[]>(
    trilho?.etapas?.map((e) => ({ nome: e.nome, tipo: e.tipo ?? 'documental', duracao_dias: e.duracao_dias ?? 1, descricao: e.descricao ?? '', obrigatoria: e.obrigatoria ?? true, bloqueante: e.bloqueante ?? false, responsavel_default: e.responsavel_default ?? '', documentos_pedidos: e.documentos_pedidos ?? [] })) ?? []
  );
  const [saving, setSaving] = useState(false);

  function addEtapa() {
    setEtapas((p) => [...p, { nome: '', tipo: 'documental', duracao_dias: 1, descricao: '', obrigatoria: true, bloqueante: false, responsavel_default: '', documentos_pedidos: [] }]);
  }
  function setDocumentos(idx: number, fn: (docs: DocumentoPedido[]) => DocumentoPedido[]) {
    setEtapas((p) => p.map((e, i) => (i === idx ? { ...e, documentos_pedidos: fn(e.documentos_pedidos ?? []) } : e)));
  }
  function move(idx: number, dir: -1 | 1) {
    setEtapas((p) => {
      const n = [...p];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return p;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  }
  function setEtapa(idx: number, patch: Partial<TrilhoEtapaInput>) {
    setEtapas((p) => p.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  async function submit() {
    if (!form.nome.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    const payload = {
      ...form,
      etapas: etapas.map((e, i) => ({
        ...e,
        ordem: i + 1,
        documentos_pedidos: (e.documentos_pedidos ?? []).filter((d) => d.nome.trim()),
      })),
    };
    try {
      if (trilho) await trilhosService.update(trilho.id, payload);
      else await trilhosService.create(payload);
      toast.success('Trilho guardado');
      onSaved();
    } catch {
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold text-navy-800">{trilho ? 'Editar Trilho' : 'Novo Trilho'}</h2>
      <p className="mb-6 text-sm text-navy-400">Define o template de integração e as suas etapas.</p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome" required>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Trilho Técnicos 90 dias" />
          </FormField>
          <FormField label="Categoria">
            <Select options={categoriaOptions} placeholder="Seleccionar" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Função associada">
            <Select
              options={form.funcao && !funcaoOptions.some((o) => o.value === form.funcao) ? [{ value: form.funcao, label: form.funcao }, ...funcaoOptions] : funcaoOptions}
              placeholder={funcaoOptions.length ? 'Seleccionar' : 'Sem funções — crie-as no menu'}
              value={form.funcao}
              onChange={(v) => setForm((f) => ({ ...f, funcao: v }))}
            />
          </FormField>
          <FormField label="Duração estimada (dias)">
            <Input type="number" min={1} value={String(form.duracao_estimada)} onChange={(e) => setForm((f) => ({ ...f, duracao_estimada: parseInt(e.target.value) || 90 }))} placeholder="Nº de dias do trilho completo" />
          </FormField>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-navy-700">Etapas ({etapas.length})</p>
            <Button variant="ghost" size="sm" onClick={addEtapa} leftIcon={<Plus className="h-3 w-3" />}>Adicionar Etapa</Button>
          </div>
          <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {etapas.map((etapa, idx) => (
              <div key={idx} className="rounded-lg bg-navy-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-7">
                    <button type="button" onClick={() => move(idx, -1)} className="text-navy-300 hover:text-navy-700" aria-label="Subir etapa"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <span title="Ordem da etapa" className="text-center font-mono text-xs text-navy-300">{idx + 1}</span>
                    <button type="button" onClick={() => move(idx, 1)} className="text-navy-300 hover:text-navy-700" aria-label="Descer etapa"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <FormField label="Nome da etapa">
                      <Input value={etapa.nome} onChange={(e) => setEtapa(idx, { nome: e.target.value })} placeholder="Ex: Entrega de documentos" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Tipo">
                        <Select options={TIPO_OPTIONS} value={etapa.tipo ?? 'documental'} onChange={(v) => setEtapa(idx, { tipo: v as TipoEtapa })} />
                      </FormField>
                      <FormField label="Duração (dias)">
                        <Input
                          type="number"
                          min={1}
                          value={String(etapa.duracao_dias ?? 1)}
                          onChange={(e) => setEtapa(idx, { duracao_dias: parseInt(e.target.value) || 1 })}
                          placeholder="Ex: 1"
                        />
                      </FormField>
                    </div>
                    <FormField label="Responsável" hint="Quem trata esta etapa. Ex.: DPC, Mentor, Área.">
                      <Input
                        value={etapa.responsavel_default ?? ''}
                        onChange={(e) => setEtapa(idx, { responsavel_default: e.target.value })}
                        placeholder="Ex: DPC"
                      />
                    </FormField>
                    <div className="rounded-md border border-navy-100 bg-white p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-navy-700">
                          <Paperclip className="h-3.5 w-3.5 text-navy-400" />
                          Documentos a anexar pelo colaborador
                        </p>
                        <button
                          type="button"
                          onClick={() => setDocumentos(idx, (docs) => [...docs, { chave: crypto.randomUUID(), nome: '', obrigatorio: true }])}
                          className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-900"
                        >
                          <Plus className="h-3 w-3" /> Documento
                        </button>
                      </div>
                      {(etapa.documentos_pedidos ?? []).length === 0 ? (
                        <p className="mt-1.5 text-[11px] text-navy-400">Sem documentos. O colaborador conclui a etapa sem anexar ficheiros.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {(etapa.documentos_pedidos ?? []).map((doc, dIdx) => (
                            <li key={doc.chave} className="flex items-center gap-2">
                              <Input
                                value={doc.nome}
                                onChange={(e) => setDocumentos(idx, (docs) => docs.map((d, j) => (j === dIdx ? { ...d, nome: e.target.value } : d)))}
                                placeholder="Ex: Cópia do BI"
                                className="h-8 flex-1 text-sm"
                                aria-label="Nome do documento"
                              />
                              <label className="flex shrink-0 items-center gap-1.5 text-xs text-navy-600">
                                <Checkbox
                                  checked={doc.obrigatorio}
                                  onCheckedChange={(checked) => setDocumentos(idx, (docs) => docs.map((d, j) => (j === dIdx ? { ...d, obrigatorio: checked } : d)))}
                                />
                                Obrigatório
                              </label>
                              <button
                                type="button"
                                onClick={() => setDocumentos(idx, (docs) => docs.filter((_, j) => j !== dIdx))}
                                className="shrink-0 text-error-400 hover:text-error-600"
                                aria-label="Remover documento"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-navy-600">
                      <label className="flex items-center gap-1.5">
                        <Checkbox checked={etapa.obrigatoria ?? true} onCheckedChange={(checked) => setEtapa(idx, { obrigatoria: checked })} />
                        Obrigatória
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Checkbox checked={etapa.bloqueante ?? false} onCheckedChange={(checked) => setEtapa(idx, { bloqueante: checked })} />
                        Bloqueante
                      </label>
                      <button onClick={() => setEtapas((p) => p.filter((_, i) => i !== idx))} className="ml-auto text-error-400 hover:text-error-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-navy-100 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} loading={saving}>Guardar</Button>
      </div>
    </Dialog>
  );
}
