import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  Edit,
  Archive,
  Eye,
  Tag,
  Filter,
  FileText,
  FlaskConical,
  Trash2,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input, FormField, Select, Textarea } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { EmptyState, StatCard } from '@/src/components/ui/card';
import { Dialog } from '@/src/components/ui/dialog';
import { PermissionGate } from '@/src/components/auth/PermissionGate';
import { toast } from '@/src/store';
import { DIRECCOES, CATEGORIAS_FAQ, ESTADO_FAQ_CONFIG } from '@/lib/constants';
import type { FAQ, EstadoFAQ } from '@/lib/types';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';
import { faqsService } from '@/src/services/faqs.service';
import { kbService, type KbTestResult } from '@/src/services/kb.service';
import KbDocumentosPage from '@/src/screens/admin/KbDocumentosPage';

type Tab = 'documentos' | 'faqs' | 'testar';

const DIRECCAO_OPTIONS = DIRECCOES.map((d) => ({ value: d, label: d }));
const CATEGORIA_OPTIONS = CATEGORIAS_FAQ.map((c) => ({ value: c.value, label: c.label }));
const ESTADO_OPTIONS = Object.entries(ESTADO_FAQ_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

export default function BaseConhecimentoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab =
    tabParam === 'faqs' || tabParam === 'testar' || tabParam === 'documentos'
      ? tabParam
      : 'documentos';

  function setTab(t: Tab) {
    setSearchParams(t === 'documentos' ? {} : { tab: t });
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gold-500" /> Base de Conhecimento
        </h1>
        <p className="text-navy-400 text-sm mt-1">
          Documentos indexados, FAQs curadas e diagnóstico RAG do Agente DPC
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="flex gap-1 border-b border-navy-100">
        {(
          [
            { value: 'documentos' as const, label: 'Documentos', icon: FileText },
            { value: 'faqs' as const, label: 'FAQs', icon: BookOpen },
            { value: 'testar' as const, label: 'Testar RAG', icon: FlaskConical },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.value
                ? 'border-gold-500 text-navy-800'
                : 'border-transparent text-navy-400 hover:text-navy-600'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </motion.div>

      {tab === 'documentos' && <KbDocumentosPage embedded />}
      {tab === 'faqs' && <FaqsPanel />}
      {tab === 'testar' && <TestarRagPanel />}
    </motion.div>
  );
}

/** Export legacy redirect target for /base-conhecimento/faqs */
export function FaqsOnlyRedirect() {
  return (
    <div className="p-6 text-sm text-navy-500">
      A redireccionar… <Link to="/base-conhecimento?tab=faqs" className="text-gold-700 underline">FAQs</Link>
    </div>
  );
}

function FaqsPanel() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editFaq, setEditFaq] = useState<FAQ | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ direccao: '', categoria: '', estado: '', search: '' });
  const [viewMode, setViewMode] = useState<'list' | 'direccao'>('list');
  const [reindexing, setReindexing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await faqsService.list();
      setFaqs(rows);
    } catch {
      setFaqs([]);
      toast.error('Erro', 'Não foi possível carregar FAQs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = faqs.filter((f) => {
    if (filters.direccao && f.direccao !== filters.direccao) return false;
    if (filters.categoria && f.categoria !== filters.categoria) return false;
    if (filters.estado && f.estado !== filters.estado) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      return (
        f.pergunta.toLowerCase().includes(term) ||
        f.resposta.toLowerCase().includes(term) ||
        (f.palavras_chave ?? []).some((p) => p.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const publicadas = faqs.filter((f) => f.estado === 'publicada').length;
  const rascunhos = faqs.filter((f) => f.estado === 'rascunho').length;
  const emRevisao = faqs.filter((f) => f.estado === 'em_revisao').length;

  const dirStats = DIRECCOES.map((dir) => {
    const dirFaqs = faqs.filter((f) => f.direccao === dir);
    const pub = dirFaqs.filter((f) => f.estado === 'publicada').length;
    const total = dirFaqs.length;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const updated = dirFaqs.filter((f) => new Date(f.data_actualizacao) > sixMonthsAgo).length;
    const pctUpdated = total > 0 ? Math.round((updated / total) * 100) : 0;
    const health: 'success' | 'warning' | 'error' =
      pub >= 15 && pctUpdated >= 70 ? 'success' : pub >= 5 ? 'warning' : 'error';
    return { dir, pub, total, pctUpdated, health };
  });

  async function handleEstado(faq: FAQ, estado: EstadoFAQ) {
    try {
      const updated = await faqsService.update(faq.id, { estado });
      setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, ...updated } : f)));
      toast.success(
        estado === 'publicada' ? 'FAQ publicada' : 'Estado actualizado',
        estado === 'publicada' ? 'Disponível para o Agente DPC (embedding em background).' : `Estado: ${estado}`
      );
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Falha ao actualizar');
    }
  }

  async function handleDelete(faq: FAQ) {
    if (!confirm(`Apagar a FAQ "${faq.pergunta.slice(0, 60)}…"?`)) return;
    try {
      await faqsService.delete(faq.id);
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
      toast.success('FAQ apagada', 'Removida da base de conhecimento.');
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Falha ao apagar');
    }
  }

  async function handleReindex() {
    setReindexing(true);
    try {
      const r = await faqsService.reindexEmbeddings();
      toast.success('Embeddings FAQs', `${r.processed} processadas${r.errors ? `, ${r.errors} erros` : ''}`);
      load();
    } catch (err) {
      toast.error('Reindex', err instanceof Error ? err.message : 'Falha (NVIDIA?)');
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-navy-500">FAQs que alimentam o Assistente IA (keyword + vectorial)</p>
        <div className="flex flex-wrap gap-2">
          <PermissionGate resource="base_conhecimento.editar" action="edit">
            <Button
              variant="secondary"
              leftIcon={<Sparkles className="w-4 h-4" />}
              onClick={handleReindex}
              loading={reindexing}
            >
              Reindexar embeddings
            </Button>
          </PermissionGate>
          <PermissionGate resource="base_conhecimento.editar" action="create">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Nova FAQ
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5" />} title="Total" value={faqs.length} />
        <StatCard icon={<Eye className="w-5 h-5" />} title="Publicadas" value={publicadas} />
        <StatCard icon={<Edit className="w-5 h-5" />} title="Rascunhos" value={rascunhos} />
        <StatCard icon={<Filter className="w-5 h-5" />} title="Em Revisão" value={emRevisao} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'list' ? 'bg-navy-100 text-navy-700' : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setViewMode('direccao')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'direccao' ? 'bg-navy-100 text-navy-700' : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          Por Direcção
        </button>
      </div>

      {viewMode === 'direccao' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dirStats.map((ds) => (
            <button
              key={ds.dir}
              type="button"
              onClick={() => {
                setFilters((f) => ({ ...f, direccao: ds.dir }));
                setViewMode('list');
              }}
              className="text-left bg-white border border-navy-100 rounded-xl p-5 hover:shadow-card transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-navy-800">{ds.dir}</h3>
                <Badge variant={ds.health} size="sm" dot>
                  {ds.health === 'success' ? 'Completa' : ds.health === 'warning' ? 'Parcial' : 'Atenção'}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-navy-400">Publicadas</span>
                  <span className="font-medium text-navy-700">
                    {ds.pub}/{ds.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-400">Actualizadas</span>
                  <span className="font-medium text-navy-700">{ds.pctUpdated}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <Input
                placeholder="Pesquisar FAQs..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select
              options={DIRECCAO_OPTIONS}
              placeholder="Direcção"
              value={filters.direccao}
              onChange={(v) => setFilters((f) => ({ ...f, direccao: v }))}
              className="w-full sm:w-40"
            />
            <Select
              options={CATEGORIA_OPTIONS}
              placeholder="Categoria"
              value={filters.categoria}
              onChange={(v) => setFilters((f) => ({ ...f, categoria: v }))}
              className="w-full sm:w-40"
            />
            <Select
              options={ESTADO_OPTIONS}
              placeholder="Estado"
              value={filters.estado}
              onChange={(v) => setFilters((f) => ({ ...f, estado: v }))}
              className="w-full sm:w-36"
            />
          </div>

          {loading ? (
            <div className="flex justify-center h-32 items-center">
              <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-8 h-8" />}
              title="Nenhuma FAQ encontrada"
              description="Ajuste os filtros ou crie uma nova FAQ."
              action={{ label: 'Criar FAQ', onClick: () => setShowCreateModal(true) }}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((faq) => {
                const isExpanded = expandedId === faq.id;
                const estadoConfig = ESTADO_FAQ_CONFIG[faq.estado];
                return (
                  <div key={faq.id} className="bg-white border border-navy-100 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-navy-25 transition-colors"
                    >
                      <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-4 h-4 text-navy-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-navy-800 truncate">{faq.pergunta}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={estadoConfig.variant} size="sm">
                            {estadoConfig.label}
                          </Badge>
                          <span className="text-xs text-navy-400">{faq.direccao}</span>
                          <span className="text-xs text-navy-300">•</span>
                          <span className="text-xs text-navy-400">
                            {CATEGORIAS_FAQ.find((c) => c.value === faq.categoria)?.label}
                          </span>
                          {faq.tem_embedding && (
                            <Badge variant="success" size="sm">
                              vector
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-navy-300 whitespace-nowrap">{faq.vezes_citada}× citada</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-navy-100 px-5 py-4">
                        <div className="prose prose-sm text-navy-600 mb-3 whitespace-pre-wrap">{faq.resposta}</div>
                        {(faq.variantes ?? []).length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-navy-500 mb-1">Variantes:</p>
                            <div className="flex flex-wrap gap-1">
                              {faq.variantes.map((v, i) => (
                                <span key={i} className="text-xs bg-navy-50 text-navy-500 px-2 py-0.5 rounded">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(faq.palavras_chave ?? []).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-3">
                            <Tag className="w-3 h-3 text-navy-400" />
                            {faq.palavras_chave.map((kw, i) => (
                              <Badge key={i} variant="accent" size="sm">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap justify-between items-center gap-2 mt-3 pt-3 border-t border-navy-50">
                          <span className="text-xs text-navy-300">
                            Actualizada {new Date(faq.data_actualizacao).toLocaleDateString('pt-AO')}
                          </span>
                          <PermissionGate resource="base_conhecimento.editar" action="edit">
                            <div className="flex flex-wrap gap-1">
                              {faq.estado !== 'publicada' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<CheckCircle className="w-3 h-3" />}
                                  onClick={() => handleEstado(faq, 'publicada')}
                                >
                                  Publicar
                                </Button>
                              )}
                              {faq.estado === 'publicada' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={<Archive className="w-3 h-3" />}
                                  onClick={() => handleEstado(faq, 'arquivada')}
                                >
                                  Arquivar
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Edit className="w-3 h-3" />}
                                onClick={() => setEditFaq(faq)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(faq)}
                              >
                                <Trash2 className="w-3 h-3 text-error-500" />
                              </Button>
                            </div>
                          </PermissionGate>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <FaqFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(faq) => {
            setFaqs((prev) => [faq, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}
      {editFaq && (
        <FaqFormModal
          faq={editFaq}
          onClose={() => setEditFaq(null)}
          onSaved={(faq) => {
            setFaqs((prev) => prev.map((f) => (f.id === faq.id ? faq : f)));
            setEditFaq(null);
          }}
        />
      )}
    </div>
  );
}

function FaqFormModal({
  faq,
  onClose,
  onSaved,
}: {
  faq?: FAQ;
  onClose: () => void;
  onSaved: (faq: FAQ) => void;
}) {
  const [form, setForm] = useState({
    pergunta: faq?.pergunta ?? '',
    resposta: faq?.resposta ?? '',
    direccao: faq?.direccao ?? '',
    categoria: (faq?.categoria as string) ?? '',
    palavras_chave: (faq?.palavras_chave ?? []).join(', '),
    variantes: (faq?.variantes ?? []).join('\n'),
    estado: (faq?.estado as string) ?? 'rascunho',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!form.pergunta.trim()) errs.pergunta = 'Pergunta é obrigatória';
    if (!form.resposta.trim()) errs.resposta = 'Resposta é obrigatória';
    if (!form.direccao) errs.direccao = 'Seleccione uma direcção';
    if (!form.categoria) errs.categoria = 'Seleccione uma categoria';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const body = {
      pergunta: form.pergunta.trim(),
      resposta: form.resposta.trim(),
      direccao: form.direccao,
      categoria: form.categoria,
      palavras_chave: form.palavras_chave
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      variantes: form.variantes
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      estado: form.estado,
    };

    setSaving(true);
    try {
      const saved = faq
        ? await faqsService.update(faq.id, body)
        : await faqsService.create(body);
      toast.success(faq ? 'FAQ actualizada' : 'FAQ criada', `Estado: ${saved.estado}`);
      onSaved(saved);
    } catch (err) {
      toast.error('Erro', err instanceof Error ? err.message : 'Falha ao guardar FAQ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-xl">
      <h2 className="text-lg font-semibold text-navy-800 mb-1">{faq ? 'Editar FAQ' : 'Nova FAQ'}</h2>
      <p className="text-sm text-navy-400 mb-6">
        FAQs publicadas entram no retrieval do Agente (keyword + embeddings).
      </p>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <FormField label="Pergunta" required error={errors.pergunta}>
          <Input
            value={form.pergunta}
            onChange={(e) => setForm((f) => ({ ...f, pergunta: e.target.value }))}
            placeholder="Ex: Como solicito acesso ao VPN?"
            error={errors.pergunta}
          />
        </FormField>

        <FormField label="Resposta" required error={errors.resposta}>
          <Textarea
            value={form.resposta}
            onChange={(e) => setForm((f) => ({ ...f, resposta: e.target.value }))}
            placeholder="Resposta detalhada..."
            maxLength={4000}
            showCount
            error={errors.resposta}
            className="min-h-[120px]"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Direcção" required error={errors.direccao}>
            <Select
              options={DIRECCAO_OPTIONS}
              placeholder="Seleccionar..."
              value={form.direccao}
              onChange={(v) => setForm((f) => ({ ...f, direccao: v }))}
              error={errors.direccao}
            />
          </FormField>
          <FormField label="Categoria" required error={errors.categoria}>
            <Select
              options={CATEGORIA_OPTIONS}
              placeholder="Seleccionar..."
              value={form.categoria}
              onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
              error={errors.categoria}
            />
          </FormField>
        </div>

        <FormField label="Estado">
          <Select
            options={ESTADO_OPTIONS}
            value={form.estado}
            onChange={(v) => setForm((f) => ({ ...f, estado: v }))}
          />
        </FormField>

        <FormField label="Variantes da Pergunta" hint="Uma por linha — formas alternativas de perguntar">
          <Textarea
            value={form.variantes}
            onChange={(e) => setForm((f) => ({ ...f, variantes: e.target.value }))}
            placeholder={'Como acedo ao VPN?\nPreciso de VPN, como faço?'}
          />
        </FormField>

        <FormField label="Palavras-chave" hint="Separadas por vírgula">
          <Input
            value={form.palavras_chave}
            onChange={(e) => setForm((f) => ({ ...f, palavras_chave: e.target.value }))}
            placeholder="vpn, acesso, rede, remoto"
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={saving}>
          {faq ? 'Guardar' : 'Criar FAQ'}
        </Button>
      </div>
    </Dialog>
  );
}

function TestarRagPanel() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KbTestResult | null>(null);

  useEffect(() => {
    kbService
      .test()
      .then(setResult)
      .catch(() => setResult(null));
  }, []);

  async function runTest() {
    if (!q.trim()) {
      toast.warning('Pergunta', 'Escreve uma pergunta para testar o retrieval');
      return;
    }
    setLoading(true);
    try {
      const r = await kbService.test(q.trim());
      setResult(r);
    } catch (err) {
      toast.error('Teste RAG', err instanceof Error ? err.message : 'Falha');
    } finally {
      setLoading(false);
    }
  }

  const stats = result?.stats;

  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-500">
        Diagnóstico do retrieval híbrido (documentos vectoriais + FAQs keyword/dense). Usa o threshold e top K
        configurados em Definições → Agente DPC.
      </p>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-navy-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-navy-800">{stats.documentos_indexados}</p>
            <p className="text-xs text-navy-400 uppercase tracking-wide">Docs indexados</p>
          </div>
          <div className="bg-white border border-navy-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-navy-800">{stats.total_chunks}</p>
            <p className="text-xs text-navy-400 uppercase tracking-wide">Chunks</p>
          </div>
          <div className="bg-white border border-navy-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-navy-800">
              {stats.faqs_com_embedding}/{stats.faqs_publicadas}
            </p>
            <p className="text-xs text-navy-400 uppercase tracking-wide">FAQs c/ embedding</p>
          </div>
          <div className="bg-white border border-navy-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-navy-800">{stats.threshold_relevancia}</p>
            <p className="text-xs text-navy-400 uppercase tracking-wide">
              Threshold · topK {stats.top_k}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Ex: Quantos dias de férias tenho?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTest()}
          className="flex-1"
        />
        <Button variant="primary" onClick={runTest} loading={loading} leftIcon={<FlaskConical className="w-4 h-4" />}>
          Testar
        </Button>
      </div>

      {result?.query && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.query.acima_do_threshold
              ? 'bg-success-50 border-success-100 text-success-800'
              : 'bg-warning-50 border-warning-100 text-warning-800'
          }`}
        >
          <p className="font-medium">
            Top score: {result.query.top_score.toFixed(3)} ·{' '}
            {result.query.acima_do_threshold ? 'Acima do threshold' : 'Abaixo do threshold (tende a escalar)'}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {result.query.hits} hits · {result.query.latencia_ms} ms · NVIDIA:{' '}
            {stats?.nvidia_ready ? 'ok' : 'offline'}
          </p>
        </div>
      )}

      {result?.hits && result.hits.length > 0 && (
        <div className="space-y-2">
          {result.hits.map((h, i) => (
            <div key={`${h.id}-${i}`} className="bg-white border border-navy-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={h.origem === 'faq' ? 'accent' : 'info'} size="sm">
                      {h.origem.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium text-navy-800 truncate">{h.titulo}</span>
                    {h.pagina != null && (
                      <span className="text-xs text-navy-400">p.{h.pagina}</span>
                    )}
                  </div>
                  <p className="text-xs text-navy-500 whitespace-pre-wrap">{h.excerpt}</p>
                </div>
                <span className="font-mono text-sm text-navy-700 shrink-0">{h.score.toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {result?.query && result.hits?.length === 0 && (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="Sem hits"
          description="Nenhum trecho encontrado. Adiciona documentos ou publica FAQs."
        />
      )}
    </div>
  );
}
