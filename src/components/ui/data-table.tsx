import { useState, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, MoreHorizontal, Check } from 'lucide-react';
import { Button } from './button';
import { Checkbox } from '@/components/ui/checkbox';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  rowActions?: (row: T) => { label: string; onClick: () => void; destructive?: boolean }[];
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  pageSize = 10,
  selectable,
  onSelectionChange,
  rowActions,
  emptyMessage = 'Sem dados para apresentar',
  loading,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const selectedSet = new Set(selectedIds);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null || bVal == null) return 0;
      const cmp = String(aVal).localeCompare(String(bVal), 'pt', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelect(id: string) {
    const next = selectedSet.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    onSelectionChange?.(next);
  }

  function toggleAll() {
    if (selectedIds.length === paged.length) {
      setSelectedIds([]);
      onSelectionChange?.([]);
    } else {
      const ids = paged.map((r) => String(r[keyField]));
      setSelectedIds(ids);
      onSelectionChange?.(ids);
    }
  }

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              {columns.map((_, j) => (
                <div key={j} className="flex-1 h-4 bg-navy-100 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border bg-card p-12 text-center', className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-700 text-white">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.length === paged.length && paged.length > 0}
                    onCheckedChange={() => toggleAll()}
                    aria-label="Seleccionar todos"
                    className="border-white/50 data-checked:border-white data-checked:bg-white data-checked:text-navy-800"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-wide text-white/90',
                    col.sortable && 'cursor-pointer select-none hover:text-white transition-colors',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key
                        ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)
                        : <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />
                    )}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-12 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {paged.map((row) => {
              const id = String(row[keyField]);
              return (
                <tr key={id} className="even:bg-surface-secondary/50 hover:bg-navy-50 transition-colors">
                  {selectable && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedSet.has(id)}
                        onCheckedChange={() => toggleSelect(id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-foreground', col.className)}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === id ? null : id)}
                        className="p-1 rounded-md hover:bg-navy-50 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {openMenu === id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-4 top-full mt-1 z-20 bg-white rounded-lg shadow-float border border-border py-1 min-w-[160px]">
                            {rowActions(row).map((action, i) => (
                              <button
                                key={i}
                                onClick={() => { action.onClick(); setOpenMenu(null); }}
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm hover:bg-navy-50 transition-colors',
                                  action.destructive && 'text-error-500 hover:bg-error-50'
                                )}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
export type { Column, DataTableProps };
