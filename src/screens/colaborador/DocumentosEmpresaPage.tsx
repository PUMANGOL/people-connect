import { useEffect, useState } from 'react';
import { FileText, ExternalLink, FolderOpen } from 'lucide-react';
import { EmptyState } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { documentosEmpresaService, type DocumentoEmpresa } from '@/src/services/onboarding-v2.service';
import { motion } from 'motion/react';
import { staggerContainer, staggerItem } from '@/src/lib/animations';

const CATEGORIA_LABEL: Record<string, string> = {
  politica: 'Políticas',
  regulamento: 'Regulamentos',
  manual: 'Manuais',
  guia: 'Guias',
};

export default function DocumentosEmpresaPage() {
  const [docs, setDocs] = useState<DocumentoEmpresa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    documentosEmpresaService
      .list()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const grupos = docs.reduce<Record<string, DocumentoEmpresa[]>>((acc, d) => {
    (acc[d.categoria] ??= []).push(d);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-full max-w-2xl space-y-3">
          <div className="h-24 bg-navy-100 animate-pulse rounded-2xl" />
          <div className="h-24 bg-navy-100 animate-pulse rounded-2xl" />
          <div className="h-24 bg-navy-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold text-navy-800">Documentos da Empresa</h1>
        <p className="mt-1 text-sm text-navy-400">Consulta as políticas, regulamentos, manuais e guias da Pumangol.</p>
      </motion.div>

      {docs.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="Sem documentos disponíveis" description="A DPC ainda não publicou documentos." />
      ) : (
        Object.entries(grupos).map(([cat, lista]) => (
          <motion.div key={cat} variants={staggerItem}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-500">
              {CATEGORIA_LABEL[cat] ?? cat}
            </h2>
            <div className="space-y-2">
              {lista.map((doc) => {
                const link = doc.url ?? doc.ficheiro_ref ?? '';
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4 transition hover:shadow-card">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-error-50">
                      <FileText className="h-5 w-5 text-error-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy-800">{doc.nome}</p>
                      {doc.descricao && <p className="truncate text-xs text-navy-400">{doc.descricao}</p>}
                    </div>
                    <Badge variant="neutral" size="sm">{CATEGORIA_LABEL[cat] ?? cat}</Badge>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:border-gold-300 hover:bg-gold-50"
                      >
                        Abrir <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-navy-300">Indisponível</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );
}
