import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Mail,
  Route,
  Sparkles,
} from 'lucide-react';
import type { ChatFonte, UiBlock } from './types';
import { cn } from '@/lib/utils';

const mdComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 text-lg font-semibold text-navy-900">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold text-navy-900">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1.5 mt-2.5 text-[15px] font-semibold text-navy-800">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2.5 text-[15px] leading-[1.7] text-navy-700 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 marker:text-gold-500">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-navy-700">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-[15px] leading-[1.65] text-navy-700">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-navy-900">{children}</strong>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-gold-700 underline underline-offset-2 hover:text-gold-800"
    >
      {children}
    </a>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[12px] text-navy-800">
      {children}
    </code>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-navy-100">
      <table className="min-w-full text-left text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="bg-navy-50 px-3 py-2 font-semibold text-navy-800">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-t border-navy-50 px-3 py-2 text-navy-700">{children}</td>
  ),
};

/** Remove citações inline [Fonte: …] — as fontes vão só no bloco visual no fim. */
export function stripInlineFontes(markdown: string): string {
  return markdown
    .replace(/\s*\[Fonte:[^\]]*\]\s*/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dedupeFontes(fontes: ChatFonte[]): ChatFonte[] {
  const seen = new Set<string>();
  const out: ChatFonte[] = [];
  for (const f of fontes) {
    const key = `${f.origem ?? ''}|${(f.titulo || '').toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Extrai títulos de [Fonte: …] do markdown para complementar a lista visual. */
export function extractInlineFontes(markdown: string): ChatFonte[] {
  const re = /\[Fonte:\s*([^\]]+)\]/gi;
  const found: ChatFonte[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const titulo = m[1].trim();
    if (!titulo) continue;
    const isFaq = /^faq/i.test(titulo);
    found.push({
      titulo,
      pagina: null,
      documento_id: `inline-${titulo}`,
      score: 1,
      origem: isFaq ? 'faq' : 'kb',
    });
  }
  return dedupeFontes(found);
}

export function MarkdownBody({ markdown }: { markdown: string }) {
  const clean = stripInlineFontes(markdown);
  return (
    <div className="agent-md min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {clean}
      </ReactMarkdown>
    </div>
  );
}

export function SourceList({ fontes }: { fontes: ChatFonte[] }) {
  const list = dedupeFontes(fontes).slice(0, 4);
  if (!list.length) return null;

  return (
    <div className="mt-4 border-t border-navy-100/80 pt-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold-200/60 bg-gold-50">
          <BookOpen className="h-3.5 w-3.5 text-gold-700" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-navy-800">Fontes oficiais</p>
          <p className="text-[11px] text-navy-400">
            {list.length} {list.length === 1 ? 'referência' : 'referências'} da base de conhecimento
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {list.map((f, i) => {
          const isFaq = f.origem === 'faq' || /^faq/i.test(f.titulo);
          // Título limpo: "FAQ · DPC — beneficios" → partes
          const raw = f.titulo.replace(/^FAQ\s*[·•\-–]\s*/i, '').trim();
          const parts = raw.split(/\s*[—–\-]\s*/);
          const primary = parts[0] || f.titulo;
          const secondary = parts.slice(1).join(' · ');

          return (
            <div
              key={`${f.documento_id}-${i}`}
              className="group flex items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 shadow-[0_4px_16px_rgba(27,43,75,0.04),inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-gold-300/50 hover:shadow-[0_10px_28px_rgba(200,169,81,0.1)]"
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                  isFaq
                    ? 'bg-gold-50 text-gold-700 ring-gold-200/70'
                    : 'bg-navy-50 text-navy-700 ring-navy-100'
                )}
              >
                {isFaq ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      isFaq
                        ? 'bg-gold-500/12 text-gold-800'
                        : 'bg-navy-800/8 text-navy-700'
                    )}
                  >
                    {isFaq ? 'FAQ' : 'Documento'}
                  </span>
                  {f.pagina != null && (
                    <span className="text-[10px] text-navy-400">p. {f.pagina}</span>
                  )}
                  {typeof f.score === 'number' && f.score > 0 && f.score < 1 && (
                    <span className="text-[10px] tabular-nums text-navy-300">
                      {Math.round(f.score * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-[13.5px] font-semibold leading-snug text-navy-900">{primary}</p>
                {secondary ? (
                  <p className="mt-0.5 text-[11.5px] capitalize text-navy-400">{secondary}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FaqCard({
  pergunta,
  resposta,
  direccao,
  categoria,
}: {
  pergunta: string;
  resposta: string;
  direccao: string;
  categoria?: string;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/60 bg-white/50 p-4 shadow-[0_8px_28px_rgba(27,43,75,0.05)] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-navy-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-300">
          {direccao}
          {categoria ? ` · ${categoria}` : ''}
        </span>
        <Sparkles className="ml-auto h-3.5 w-3.5 text-gold-500" />
      </div>
      <p className="text-[14px] font-semibold text-navy-900">{pergunta}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-navy-600">{resposta}</p>
    </div>
  );
}

export function KbDocumentList({
  documentos,
  resumo,
}: {
  documentos: {
    titulo: string;
    estado: string;
    chunks_total?: number;
    direccao?: string;
    tipo_ficheiro?: string | null;
  }[];
  resumo?: { indexados?: number; faqs_publicadas?: number; chunks_total?: number };
}) {
  return (
    <div className="mt-3 space-y-3">
      {resumo && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Indexados', value: resumo.indexados ?? 0 },
            { label: 'Chunks', value: resumo.chunks_total ?? 0 },
            { label: 'FAQs', value: resumo.faqs_publicadas ?? 0 },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-navy-100/80 bg-white/70 px-3 py-2.5 text-center shadow-sm"
            >
              <p className="text-lg font-semibold tabular-nums text-navy-900">{k.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-navy-400">
                {k.label}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {documentos.map((d, i) => (
          <div
            key={`${d.titulo}-${i}`}
            className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/55 p-3.5 shadow-[0_4px_16px_rgba(27,43,75,0.04)] backdrop-blur-xl"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 ring-1 ring-gold-200/60">
              <FileText className="h-4 w-4 text-gold-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-navy-900">{d.titulo}</p>
              <p className="mt-0.5 text-[11.5px] text-navy-400">
                {(d.tipo_ficheiro ?? 'doc').toUpperCase()}
                {d.direccao ? ` · ${d.direccao}` : ''}
                {d.chunks_total != null ? ` · ${d.chunks_total} chunks` : ''}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                d.estado === 'indexado'
                  ? 'bg-success-50 text-success-700'
                  : 'bg-navy-50 text-navy-500'
              )}
            >
              {d.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiGrid({
  items,
}: {
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl border border-white/70 bg-gradient-to-br from-white/80 to-navy-50/40 p-3.5 shadow-sm backdrop-blur-xl"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-navy-400">
            {it.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy-900">{it.value}</p>
          {it.hint && <p className="mt-0.5 text-[11px] text-navy-400">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function DataTableCard({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/70 bg-white/55 shadow-[0_8px_28px_rgba(27,43,75,0.05)] backdrop-blur-xl">
      <div className="border-b border-navy-50 px-4 py-2.5">
        <p className="text-[13px] font-semibold text-navy-800">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[12.5px]">
          <thead>
            <tr className="bg-navy-50/60">
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold text-navy-600">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row, i) => (
              <tr key={i} className="border-t border-navy-50/80">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-navy-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TrilhoProgressCard({
  percent,
  etapas,
  colaborador_nome,
}: {
  percent: number;
  etapas: { nome: string; estado: string }[];
  colaborador_nome?: string;
}) {
  const safe = Math.min(100, Math.max(0, percent));
  return (
    <div className="mt-3 rounded-2xl border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-800 text-gold-300">
          <Route className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-navy-800">
            Progresso do trilho
            {colaborador_nome ? (
              <span className="font-normal text-navy-400"> · {colaborador_nome}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-navy-400">{safe}% concluído</p>
        </div>
        <span className="text-lg font-bold tabular-nums text-navy-900">{safe}%</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-navy-50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
          style={{ width: `${safe}%` }}
        />
      </div>
      <ul className="max-h-40 space-y-1.5 overflow-y-auto">
        {etapas.map((e, i) => (
          <li key={i} className="flex items-center gap-2 text-[12.5px] text-navy-600">
            {e.estado === 'concluida' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-navy-200" />
            )}
            <span className={e.estado === 'concluida' ? 'text-navy-400 line-through' : ''}>
              {e.nome}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/onboarding/meu-trilho"
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-gold-700 hover:text-gold-800"
      >
        Abrir trilho <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Removido da UI — escalações continuam no backend se necessário. */
export function EscalationConfirm(_props: {
  pergunta: string;
  escalacao_id?: string;
  mensagem?: string;
}) {
  return null;
}

export function ContactDpc({ email }: { email: string; motivo?: string }) {
  return (
    <p className="mt-2 text-[13px] text-navy-500">
      <Mail className="mr-1 inline h-3.5 w-3.5 text-gold-600" />
      Contacto:{' '}
      <a href={`mailto:${email}`} className="font-medium text-navy-800 hover:text-gold-700">
        {email}
      </a>
    </p>
  );
}

export function ActionChips({
  actions,
  onPrompt,
}: {
  actions: { label: string; href?: string; prompt?: string }[];
  onPrompt?: (prompt: string) => void;
}) {
  const navigate = useNavigate();
  if (!actions?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.slice(0, 6).map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => {
            if (a.href) navigate(a.href);
            else if (a.prompt && onPrompt) onPrompt(a.prompt);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3.5 py-2 text-[12px] font-medium text-navy-700 shadow-[0_2px_8px_rgba(27,43,75,0.04)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-[0_8px_20px_rgba(200,169,81,0.12)]"
        >
          {a.label}
          {a.href ? <ArrowUpRight className="h-3 w-3 text-gold-600" /> : null}
        </button>
      ))}
    </div>
  );
}

export function ToolStatus({
  tool,
  label,
  state = 'running',
}: {
  tool: string;
  label: string;
  state?: 'running' | 'done' | 'error';
}) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-gold-200/50 bg-white/50 px-3 py-2.5 backdrop-blur-sm">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          state === 'running' && 'bg-gold-50 animate-pulse',
          state === 'done' && 'bg-success-50',
          state === 'error' && 'bg-error-50'
        )}
      >
        <Sparkles
          className={cn(
            'h-4 w-4',
            state === 'running' && 'text-gold-600',
            state === 'done' && 'text-success-600',
            state === 'error' && 'text-error-500'
          )}
        />
      </div>
      <div>
        <p className="text-[13px] font-medium text-navy-800">{label}</p>
        <p className="text-[11px] text-navy-400">{tool}</p>
      </div>
    </div>
  );
}

export function renderUiBlock(
  block: UiBlock,
  opts?: { onPrompt?: (p: string) => void }
): ReactNode {
  switch (block.component) {
    case 'MarkdownBody':
      return <MarkdownBody {...block.props} />;
    case 'SourceList':
      return <SourceList {...block.props} />;
    case 'FaqCard':
      return <FaqCard {...block.props} />;
    case 'KbDocumentList':
      return <KbDocumentList {...block.props} />;
    case 'KpiGrid':
      return <KpiGrid {...block.props} />;
    case 'DataTableCard':
      return <DataTableCard {...block.props} />;
    case 'TrilhoProgressCard':
      return <TrilhoProgressCard {...block.props} />;
    case 'EscalationConfirm':
      return <EscalationConfirm {...block.props} />;
    case 'ContactDpc':
      return <ContactDpc {...block.props} />;
    case 'ActionChips':
      return <ActionChips {...block.props} onPrompt={opts?.onPrompt} />;
    case 'ToolStatus':
      return <ToolStatus {...block.props} />;
    default:
      return null;
  }
}
