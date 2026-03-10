/**
 * 🐉 CyberSec Pro — DataTable Component
 * Full-featured table with sorting, pagination, row selection, and responsive design
 */
import { useState, useMemo, memo, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  pagination?: { page: number; perPage: number; total: number; onPageChange: (page: number) => void };
  className?: string;
  compact?: boolean;
}

type SortDir = 'asc' | 'desc';

interface DataTableRowProps<T> {
  row: T;
  rowKey: string;
  columns: Column<T>[];
  cellPad: string;
  isSelected?: boolean;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
  onToggleRow?: (key: string) => void;
}

const DataTableRow = memo(function DataTableRow<T>({
  row,
  rowKey,
  columns,
  cellPad,
  isSelected,
  selectable,
  onRowClick,
  onToggleRow,
}: DataTableRowProps<T>) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={`
        transition-colors
        ${onRowClick ? 'cursor-pointer hover:bg-gray-700/30' : ''}
        ${isSelected ? 'bg-cyan-500/5' : 'hover:bg-gray-800/40'}
      `.trim()}
    >
      {selectable && (
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={() => onToggleRow?.(rowKey)}
            className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-0"
          />
        </td>
      )}
      {columns.map(col => (
        <td key={col.key} className={`${cellPad} text-gray-300 ${col.className || ''}`}>
          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
        </td>
      ))}
    </motion.tr>
  );
}) as <T>(props: DataTableRowProps<T>) => React.ReactElement;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyState,
  onRowClick,
  selectable,
  selectedKeys,
  onSelectionChange,
  pagination,
  className = '',
  compact,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const allSelected = data.length > 0 && data.every(row => selectedKeys?.has(keyExtractor(row)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(keyExtractor)));
    }
  };

  const toggleRow = useCallback((key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  }, [onSelectionChange, selectedKeys]);

  // Pagination
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.perPage) : 0;

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/30 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-gray-700/50 bg-gray-800/50">
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-0"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${cellPad} text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none hover:text-gray-200 transition-colors' : ''} ${col.headerClassName || ''}`}
                  style={col.width ? { width: col.width } : {}}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      <svg className={`w-3.5 h-3.5 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="px-3 py-3"><div className="w-4 h-4 rounded bg-gray-700 animate-pulse" /></td>}
                  {columns.map(col => (
                    <td key={col.key} className={cellPad}>
                      <div className="h-4 rounded bg-gray-700/60 animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center">
                  {emptyState || <span className="text-gray-500">No data</span>}
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {sortedData.map((row) => {
                  const key = keyExtractor(row);
                  return (
                    <DataTableRow
                      key={key}
                      row={row}
                      rowKey={key}
                      columns={columns}
                      cellPad={cellPad}
                      isSelected={selectedKeys?.has(key)}
                      selectable={selectable}
                      onRowClick={onRowClick}
                      onToggleRow={toggleRow}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50 bg-gray-800/30">
          <p className="text-xs text-gray-500">
            Showing {(pagination.page - 1) * pagination.perPage + 1}–{Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="px-2.5 py-1 text-xs rounded-md text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => pagination.onPageChange(pageNum)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    pageNum === pagination.page
                      ? 'bg-cyan-600/20 text-cyan-400 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="px-2.5 py-1 text-xs rounded-md text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
