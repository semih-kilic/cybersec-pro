import { type ReactNode, useState, useMemo } from 'react';
import { cn } from '../../lib/cn';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** cell renderer */
  cell: (row: T, idx: number) => ReactNode;
  /** sort accessor (return primitive). If provided, header becomes clickable */
  sortAccessor?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

/**
 * DataTable — minimal, glass-themed, sortable table.
 *
 * Features:
 *   - Sticky header
 *   - Optional client-side sorting (supply `sortAccessor` per column)
 *   - Row hover highlight
 *   - Pluggable empty / loading states
 *
 * For very large datasets use virtualization separately
 * (e.g. @tanstack/react-virtual). This component intentionally stays simple.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  loading,
  loadingRows = 5,
  onRowClick,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, idx: number) => string;
  empty?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortAccessor) return rows;
    const acc = col.sortAccessor;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort(prev => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  return (
    <div
      className={cn(
        'vos-glass-2 rounded-vos-xl overflow-hidden',
        className,
      )}
    >
      <div className="overflow-x-auto vos-scrollbar">
        <table className="w-full text-vos-sm">
          <thead className="sticky top-0 z-10 backdrop-blur-vos-2">
            <tr className="text-vos-text-3 bg-vos-glass-1 border-b border-vos-border-2">
              {columns.map(col => {
                const sortable = !!col.sortAccessor;
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width, textAlign: col.align ?? 'left' }}
                    className={cn(
                      'px-vos-4 py-vos-3 font-medium text-vos-2xs uppercase tracking-[0.06em] whitespace-nowrap select-none',
                      sortable && 'cursor-pointer hover:text-vos-text-2',
                      col.className,
                    )}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {sortable && (
                        <span className={cn('text-vos-text-muted transition-opacity', isSorted ? 'opacity-100 text-vos-accent' : 'opacity-40')}>
                          {isSorted ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }).map((_, i) => (
                  <tr key={`s-${i}`} className="border-b border-vos-border-1">
                    {columns.map(col => (
                      <td key={col.key} className="px-vos-4 py-vos-4">
                        <div className="vos-skeleton h-3 w-2/3" />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} className="px-vos-4 py-vos-12 text-center">
                    {empty ?? <span className="text-vos-text-3">No data</span>}
                  </td>
                </tr>
              )
              : sorted.map((row, idx) => (
                  <tr
                    key={rowKey(row, idx)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-vos-border-1 transition-colors duration-vos-2 ease-vos-out last:border-b-0',
                      onRowClick ? 'cursor-pointer hover:bg-vos-glass-1' : 'hover:bg-vos-glass-1/60',
                    )}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align ?? 'left' }}
                        className={cn('px-vos-4 py-vos-3.5 text-vos-text-2 align-middle', col.className)}
                      >
                        {col.cell(row, idx)}
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
