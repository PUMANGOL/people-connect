import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  X,
  Search,
  Eye,
  Archive,
  FilePlus2,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, FormField, Select, Textarea } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { PermissionGate } from '@/src/components/auth/PermissionGate';
import { toast } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { kbService, type KbDocumento, type KbChunkPreview } from '@/src/services/kb.service';
import { DIRECCOES } from '@/lib/constants';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
const CATEGORIAS = [
  { value: 'beneficios', label: 'Benefícios' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'acessos', label: 'Acessos' },
  { value: 'formacao', label: 'Formação' },
  { value: 'processos', label: 'Processos' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'it', label: 'IT' },
  { value: 'logistica', label: 'Logística' },
];

const ESTADO_CONFIG: Record<string, { label: string; variant: 'info' | 'success' | 'error' | 'neutral' }> = {
  processando: { label: 'A processar', variant: 'info' },
  indexado: { label: 'Indexado', variant: 'success' },
  falha: { label: 'Falha', variant: 'error' },
  arquivado: { label: 'Arquivado', variant: 'neutral' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function KbDocumentosPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuthStore();
  const [documentos, setDocumentos] = useState<KbDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [filters, setFilters] = useState({ estado: '', direccao: '', search: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<KbDocumento | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await kbService.list({
        estado: filters.estado || undefined,
        direccao: filters.direccao || undefined,
      });
      setDocumentos(rows);
    } catch (err) {
      toast.error('Erro ao carregar', err instanceof Error ? err.message : 'Falha na API');
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, [filters.estado, filters.direccao]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any doc is processing
  useEffect(() => {
    const hasProcessing = documentos.some((d) => d.estado === 'processando');
    if (!hasProcessing) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [documentos, load]);

  const filtered = filters.search
    ? documentos.filter((d) => d.titulo.toLowerCase().includes(filters.search.toLowerCase()))
    : documentos;

  const stats = {
    total: documentos.length,
    indexados: documentos.filter((d) => d.estado === 'indexado').length,
    processando: documentos.filter((d) => d.estado === 'processando').length,
    falhas: documentos.filter((d) => d.estado === 'falha').length,
  };

  async function handleDelete(doc: KbDocumento) {
    try {
      await kbService.delete(doc.id);
      toast.success('Documento apagado', `"${doc.titulo}" removido da base de conhecimento.`);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Não foi possível apagar');
    }
  }

  async function handleReindex(doc: KbDocumento) {
    setReindexingId(doc.id);
    try {
      const r = await kbService.reindex(doc.id);
      toast.success('Reindexado', `${r.chunks} chunks · modo ${r.modo}`);
      load();
    } catch (err) {
      toast.error('Reindex', err instanceof Error ? err.message : 'Falha');
      load();
    } finally {
      setReindexingId(null);
    }
  }

  async function handleArquivar(doc: KbDocumento) {
    try {
      await kbService.update(doc.id, { estado: 'arquivado' });
      toast.success('Arquivado', doc.titulo);
      load();
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Falha');
    }
  }

  const body = (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-gold-500" /> Base de Conhecimento
            </h1>
            <p className="text-navy-400 text-sm mt-1">
              Documentos indexados (PDF/DOCX/texto) usados pelo Assistente Virtual
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGate resource="base_conhecimento" action="create">
              <Button
                variant="secondary"
                leftIcon={<FilePlus2 className="w-4 h-4" />}
                onClick={() => setShowManualModal(true)}
              >
                Colar texto
              </Button>
              <Button
                variant="primary"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowUploadModal(true)}
              >
                Adicionar Documento
              </Button>
            </PermissionGate>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-navy-500">
            PDF/DOCX e texto manual vectorizados com bge-m3 para o Agente DPC
          </p>
          <PermissionGate resource="base_conhecimento" action="create">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FilePlus2 className="w-4 h-4" />}
                onClick={() => setShowManualModal(true)}
              >
                Colar texto
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowUploadModal(true)}
              >
                Adicionar Documento
              </Button>
            </div>
          </PermissionGate>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-navy-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-navy-800">{stats.total}</p>
          <p className="text-xs text-navy-400 uppercase tracking-wide">Total</p>
        </div>
        <div className="bg-white border border-success-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-success-600">{stats.indexados}</p>
          <p className="text-xs text-success-600 uppercase tracking-wide">Indexados</p>
        </div>
        <div className="bg-white border border-info-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-info-600">{stats.processando}</p>
          <p className="text-xs text-info-600 uppercase tracking-wide">A processar</p>
        </div>
        <div className="bg-white border border-error-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-error-600">{stats.falhas}</p>
          <p className="text-xs text-error-600 uppercase tracking-wide">Falhas</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <Input
            placeholder="Pesquisar por título..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          options={Object.entries(ESTADO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
          placeholder="Todos os estados"
          value={filters.estado}
          onChange={(v) => setFilters((f) => ({ ...f, estado: v }))}
          className="w-full sm:w-44"
        />
        <Select
          options={DIRECCOES.map((d) => ({ value: d, label: d }))}
          placeholder="Todas as direcções"
          value={filters.direccao}
          onChange={(v) => setFilters((f) => ({ ...f, direccao: v }))}
          className="w-full sm:w-44"
        />
        <Button variant="ghost" onClick={load} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8" />}
          title="Sem documentos"
          description="Adiciona o primeiro documento (PDF, DOCX ou texto) para alimentar o Assistente Virtual."
          action={{ label: 'Adicionar Documento', onClick: () => setShowUploadModal(true) }}
        />
      ) : (
        <div className="bg-white border border-navy-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-25">
                  <th className="text-left px-4 py-3 font-medium text-navy-500">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-navy-500">Direcção</th>
                  <th className="text-left px-4 py-3 font-medium text-navy-500">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-navy-500">Chunks</th>
                  <th className="text-left px-4 py-3 font-medium text-navy-500">Tamanho</th>
                  <th className="text-right px-4 py-3 font-medium text-navy-500">Acções</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const config = ESTADO_CONFIG[doc.estado] ?? ESTADO_CONFIG.processando;
                  return (
                    <tr key={doc.id} className="border-b border-navy-50 hover:bg-navy-25 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-navy-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-navy-800 truncate max-w-xs">{doc.titulo}</p>
                            <p className="text-xs text-navy-400">
                              {(doc.tipo_ficheiro || 'doc').toUpperCase()} · {doc.categoria}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="accent" size="sm">
                          {doc.direccao}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={config.variant} size="sm" dot>
                          {config.label}
                        </Badge>
                        {doc.estado === 'falha' && doc.erro_processamento && (
                          <p
                            className="text-xs text-error-600 mt-1 max-w-xs truncate"
                            title={doc.erro_processamento}
                          >
                            {doc.erro_processamento}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-navy-600 font-mono">{doc.chunks_total}</td>
                      <td className="px-4 py-3 text-navy-500 text-xs">{formatBytes(doc.tamanho_bytes)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(doc.id)} title="Ver">
                            <Eye className="w-4 h-4 text-navy-500" />
                          </Button>
                          <PermissionGate resource="base_conhecimento" action="edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReindex(doc)}
                              disabled={reindexingId === doc.id}
                              title="Reindexar"
                            >
                              <RefreshCw
                                className={`w-4 h-4 text-navy-500 ${reindexingId === doc.id ? 'animate-spin' : ''}`}
                              />
                            </Button>
                            {doc.estado !== 'arquivado' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArquivar(doc)}
                                title="Arquivar"
                              >
                                <Archive className="w-4 h-4 text-navy-500" />
                              </Button>
                            )}
                          </PermissionGate>
                          <PermissionGate resource="base_conhecimento" action="delete">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(doc)}>
                              <Trash2 className="w-4 h-4 text-error-500" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setShowUploadModal(false);
            load();
          }}
          userId={user?.id}
        />
      )}

      {showManualModal && (
        <ManualModal
          onClose={() => setShowManualModal(false)}
          onSaved={() => {
            setShowManualModal(false);
            load();
          }}
        />
      )}

      {detailId && (
        <DetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onReindex={async () => {
            const doc = documentos.find((d) => d.id === detailId);
            if (doc) await handleReindex(doc);
          }}
        />
      )}

      {deleteConfirm && (
        <Dialog open onClose={() => setDeleteConfirm(null)}>
          <h2 className="text-lg font-semibold text-navy-800 mb-2">Apagar Documento</h2>
          <p className="text-sm text-navy-500 mb-4">
            Tens a certeza que queres apagar <strong>&quot;{deleteConfirm.titulo}&quot;</strong>? Todos os{' '}
            {deleteConfirm.chunks_total} chunks serão removidos e o Assistente deixará de usar este documento.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
              Apagar
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={staggerItem}>{body}</motion.div>
    </motion.div>
  );
}

function DetailModal({
  id,
  onClose,
  onReindex,
}: {
  id: string;
  onClose: () => void;
  onReindex: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<KbDocumento | null>(null);
  const [chunks, setChunks] = useState<KbChunkPreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await kbService.get(id);
        if (!cancelled) {
          setDoc(data.documento);
          setChunks(data.chunks_preview);
        }
      } catch (err) {
        toast.error('Detalhe', err instanceof Error ? err.message : 'Falha');
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, onClose]);

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">Detalhe do documento</h2>
      {loading || !doc ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-sm text-navy-500 mb-4">
            {doc.titulo} · {(doc.tipo_ficheiro || 'doc').toUpperCase()} · {doc.chunks_total} chunks
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="accent" size="sm">
              {doc.direccao}
            </Badge>
            <Badge variant={ESTADO_CONFIG[doc.estado]?.variant ?? 'neutral'} size="sm" dot>
              {ESTADO_CONFIG[doc.estado]?.label ?? doc.estado}
            </Badge>
            <span className="text-xs text-navy-400">{doc.embedding_model}</span>
          </div>
          {doc.erro_processamento && (
            <div className="mb-4 p-3 bg-error-50 border border-error-100 rounded-lg text-sm text-error-700">
              {doc.erro_processamento}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto space-y-2 border border-navy-100 rounded-xl p-3 bg-navy-25">
            {chunks.length === 0 ? (
              <p className="text-sm text-navy-400">Sem chunks para pré-visualizar.</p>
            ) : (
              chunks.map((c) => (
                <div key={c.id} className="bg-white border border-navy-50 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-navy-400 mb-1">
                    <span>
                      #{c.ordem}
                      {c.metadata?.pagina != null ? ` · p.${c.metadata.pagina}` : ''}
                    </span>
                    <span>{c.tokens} tok</span>
                  </div>
                  <p className="text-xs text-navy-600 whitespace-pre-wrap line-clamp-6">{c.conteudo}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <PermissionGate resource="base_conhecimento" action="edit">
              <Button variant="primary" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => onReindex()}>
                Reindexar
              </Button>
            </PermissionGate>
          </div>
        </>
      )}
    </Dialog>
  );
}

function ManualModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('processos');
  const [direccao, setDireccao] = useState<string>(DIRECCOES[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!titulo.trim() || texto.trim().length < 40) {
      toast.warning('Campos', 'Título e texto (mín. 40 caracteres) são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const r = await kbService.createManual({
        titulo: titulo.trim(),
        texto: texto.trim(),
        categoria,
        direccao,
      });
      toast.success('Texto indexado', `"${r.titulo}" · ${r.chunks} chunks`);
      onSaved();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">Colar texto / política</h2>
      <p className="text-sm text-navy-400 mb-6">
        Sem ficheiro — o texto é segmentado e vectorizado para o Agente DPC.
      </p>
      <div className="space-y-4">
        <FormField label="Título" required>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Política de teletrabalho 2026" />
        </FormField>
        <FormField label="Texto" required>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-[180px]"
            placeholder="Cola aqui o conteúdo da política ou procedimento…"
            maxLength={200000}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Categoria">
            <Select options={CATEGORIAS} value={categoria} onChange={setCategoria} />
          </FormField>
          <FormField label="Direcção">
            <Select
              options={DIRECCOES.map((d) => ({ value: d, label: d }))}
              value={direccao}
              onChange={setDireccao}
            />
          </FormField>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Indexar texto
        </Button>
      </div>
    </Dialog>
  );
}

function UploadModal({
  onClose,
  onUploaded,
  userId,
}: {
  onClose: () => void;
  onUploaded: () => void;
  userId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('processos');
  const [direccao, setDireccao] = useState<string>(DIRECCOES[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  function handleFile(f: File) {
    if (!ACCEPTED_TYPES.includes(f.type) && !/\.(pdf|docx)$/i.test(f.name)) {
      toast.error('Tipo inválido', 'Apenas PDF ou DOCX');
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error('Ficheiro grande', `Máximo ${MAX_SIZE / 1024 / 1024} MB`);
      return;
    }
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.(pdf|docx)$/i, ''));
  }

  async function handleUpload() {
    if (!file || !titulo.trim()) {
      toast.warning('Campos obrigatórios', 'Selecciona um ficheiro e define um título');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress('A extrair texto e gerar embeddings... (pode demorar até 30s)');
    try {
      const result = await kbService.upload({
        file,
        titulo: titulo.trim(),
        categoria,
        direccao,
        criado_por: userId,
      });
      toast.success('Documento indexado', `"${result.titulo}" · ${result.chunks} chunks criados`);
      onUploaded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido no upload';
      setUploadError(msg);
      toast.error('Falha no upload', msg);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">Adicionar Documento à Base de Conhecimento</h2>
      <p className="text-sm text-navy-400 mb-6">
        O ficheiro será processado, dividido em chunks e vectorizado com{' '}
        <code className="bg-navy-50 px-1 rounded">baai/bge-m3</code>.
      </p>

      <div className="space-y-4">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-navy-200 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition-colors"
          >
            <Upload className="w-10 h-10 text-navy-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-navy-700">Arraste um ficheiro ou clique para escolher</p>
            <p className="text-xs text-navy-400 mt-1">PDF ou DOCX, máximo 10 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-navy-25 border border-navy-100 rounded-lg">
            <FileText className="w-5 h-5 text-navy-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-800 truncate">{file.name}</p>
              <p className="text-xs text-navy-400">{formatBytes(file.size)}</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="text-navy-400 hover:text-navy-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <FormField label="Título" required>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Manual de Benefícios 2026"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Categoria" required>
            <Select options={CATEGORIAS} value={categoria} onChange={setCategoria} />
          </FormField>
          <FormField label="Direcção" required>
            <Select
              options={DIRECCOES.map((d) => ({ value: d, label: d }))}
              value={direccao}
              onChange={setDireccao}
            />
          </FormField>
        </div>

        {uploadProgress && (
          <div className="flex items-center gap-2 p-3 bg-info-50 border border-info-100 rounded-lg text-sm text-info-700">
            <Clock className="w-4 h-4 animate-spin" />
            {uploadProgress}
          </div>
        )}

        {uploadError && (
          <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Falha no processamento</p>
              <p className="text-xs mt-1">{uploadError}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <Button variant="ghost" onClick={onClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={!file || !titulo.trim()}
        >
          Fazer Upload e Indexar
        </Button>
      </div>
    </Dialog>
  );
}
