/**
 * ScansPage — Security scan management with React Query caching
 *
 * Features:
 * - 15s stale-while-revalidate cache via useScans()
 * - Auto-refetch running scans
 * - Mutation-based cancel/rerun with instant cache invalidation
 * - List + Live view modes
 * - Skeleton loading
 * - Full accessibility (aria-labels, keyboard nav, focus management)
 * - Framer Motion micro-interactions
 */
import { useState, useRef, useCallback, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useTranslation } from 'react-i18next';
import { ScansPageSkeleton } from '../../components/ui/Skeleton';
import { PageTransition } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useScans, useCancelScan, useRerunScan, useDeleteScan, type Scan } from '../../hooks/useApiQueries';
import { motion, AnimatePresence } from 'framer-motion';

// ---- Helpers ----
const getToolName = (scan: Scan): string =>
  scan.tool?.name || scan.tool_name || 'Unknown';

const getFindings = (scan: Scan) => {
  if (scan.findings_summary) return scan.findings_summary;
  return {
    total: scan.findings_count || 0,
    critical: scan.critical || 0,
    high: scan.high || 0,
    medium: scan.medium || 0,
    low: scan.low || 0,
  };
};

const statusColors: Record<string, string> = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  queued: 'bg-yellow-500',
  cancelled: 'bg-gray-500',
  pending: 'bg-gray-500',
  timeout: 'bg-orange-500',
};

const statusLabels: Record<string, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  queued: 'Queued',
  cancelled: 'Cancelled',
  pending: 'Pending',
  timeout: 'Timeout',
};

function formatDuration(scan: Scan): string {
  if (scan.duration) return scan.duration;
  if (scan.duration_seconds) {
    const s = scan.duration_seconds;
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }
  if (scan.started_at && scan.completed_at) {
    const s = (new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000;
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }
  return '-';
}

function formatDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---- Status Icon ----
const StatusIcon = memo(({ status }: { status: string }) => {
  const icons: Record<string, React.ReactNode> = {
    running: (
      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    completed: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    failed: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };
  return <>{icons[status] || <span className="w-4 h-4 inline-block rounded-full bg-current" />}</>;
});
StatusIcon.displayName = 'StatusIcon';

// ---- Findings Badges ----
const FindingsBadges = memo(({ scan }: { scan: Scan }) => {
  const f = getFindings(scan);
  if (!(f.total || 0) && !(f.open_ports || 0)) return <span className="text-gray-500">-</span>;
  return (
    <div className="flex items-center gap-1" role="list" aria-label="Findings summary">
      {(f.critical || 0) > 0 && <span role="listitem" className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded" aria-label={`${f.critical} critical`}>{f.critical}C</span>}
      {(f.high || 0) > 0 && <span role="listitem" className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded" aria-label={`${f.high} high`}>{f.high}H</span>}
      {(f.medium || 0) > 0 && <span role="listitem" className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" aria-label={`${f.medium} medium`}>{f.medium}M</span>}
      {(f.low || 0) > 0 && <span role="listitem" className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded" aria-label={`${f.low} low`}>{f.low}L</span>}
      {(f.open_ports || 0) > 0 && !(f.critical || f.high || f.medium || f.low) && (
        <span role="listitem" className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">{f.open_ports} ports</span>
      )}
    </div>
  );
});
FindingsBadges.displayName = 'FindingsBadges';

// ========================
// MAIN COMPONENT
// ========================
export function ScansPage() {
  const { t: _t } = useTranslation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // --- React Query hooks (cached, auto-refetching) ---
  const { data: scans = [], isLoading, isFetching } = useScans();
  const cancelMutation = useCancelScan();
  const rerunMutation = useRerunScan();
  const deleteMutation = useDeleteScan();

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // --- Local UI state ---
  const [filter, setFilter] = useState(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'live'>('list');
  const outputRef = useRef<HTMLPreElement>(null);

  // --- Actions ---
  const handleCancel = useCallback(async (scanId: string) => {
    try {
      await cancelMutation.mutateAsync(scanId);
      toast.success('Scan cancelled');
    } catch {
      toast.error('Failed to cancel scan');
    }
  }, [cancelMutation, toast]);

  const handleRerun = useCallback(async (scan: Scan) => {
    try {
      const data = await rerunMutation.mutateAsync(scan.id);
      toast.success(`Scan restarted on ${data.target || scan.target}`);
      setSelectedScan(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rerun scan');
    }
  }, [rerunMutation, toast]);

  const handleDelete = useCallback(async (scanId: string) => {
    try {
      await deleteMutation.mutateAsync(scanId);
      toast.success('Scan deleted');
      setDeleteConfirm(null);
      setSelectedScan(null);
    } catch {
      toast.error('Failed to delete scan');
    }
  }, [deleteMutation, toast]);

  // --- Filtering ---
  const filteredScans = scans.filter((scan: Scan) => {
    const matchesFilter = filter === 'all' || scan.status === filter;
    const name = getToolName(scan).toLowerCase();
    const q = searchQuery.toLowerCase();
    return matchesFilter && (name.includes(q) || (scan.target || '').toLowerCase().includes(q));
  });

  const runningScans = scans.filter((s: Scan) => s.status === 'running');
  const completedScans = scans.filter((s: Scan) => s.status === 'completed');
  const failedScans = scans.filter((s: Scan) => ['failed', 'timeout'].includes(s.status));

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Header />
        <ScansPageSkeleton />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950" role="main" aria-label="Scans management">
      <Header title="Scans" subtitle="View and manage your security scans" />

      <div className="p-4 sm:p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" role="region" aria-label="Scan statistics">
          {[
            { label: 'Total Scans', value: scans.length, color: 'text-white', bg: 'bg-gray-800', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { label: 'Running', value: runningScans.length, color: 'text-blue-400', bg: 'bg-blue-500/20', spin: true, icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
            { label: 'Completed', value: completedScans.length, color: 'text-green-400', bg: 'bg-green-500/20', icon: 'M5 13l4 4L19 7' },
            { label: 'Failed', value: failedScans.length, color: 'text-red-400', bg: 'bg-red-500/20', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-gray-900 rounded-xl border border-gray-800 p-4"
              role="status"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <svg className={`w-5 h-5 ${stat.color} ${stat.spin ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Background refetch indicator */}
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-500" role="status" aria-live="polite">
            <div className="w-3 h-3 border-2 border-kali-blue border-t-transparent rounded-full animate-spin" />
            <span>Refreshing...</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6" role="toolbar" aria-label="Scan filters">
          {/* Search */}
          <div className="relative flex-1">
            <label htmlFor="scan-search" className="sr-only">Search scans</label>
            <input
              id="scan-search"
              type="text"
              placeholder="Search by tool or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue focus:ring-2 focus:ring-kali-blue/20 transition"
              aria-label="Search scans by tool name or target"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Filter by status">
            {['all', 'running', 'completed', 'failed', 'queued'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                role="radio"
                aria-checked={filter === status}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition focus:outline-none focus:ring-2 focus:ring-kali-blue/50 ${
                  filter === status
                    ? 'bg-kali-blue text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-800 p-1 rounded-lg" role="radiogroup" aria-label="View mode">
            {(['list', 'live'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                role="radio"
                aria-checked={viewMode === mode}
                className={`px-4 py-2 rounded text-sm capitalize focus:outline-none focus:ring-2 focus:ring-kali-blue/50 ${
                  viewMode === mode ? 'bg-gray-700 text-white' : 'text-gray-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* New Scan */}
          <Link
            to="/dashboard/scans/new"
            className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-lg hover:opacity-90 transition flex items-center gap-2 justify-center focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
            aria-label="Start a new scan"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scan
          </Link>
        </div>

        {/* Scans View */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden" role="region" aria-label="Scans table">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full" role="table">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                        <th className="px-5 py-3 font-medium" scope="col">Status</th>
                        <th className="px-5 py-3 font-medium" scope="col">Tool</th>
                        <th className="px-5 py-3 font-medium" scope="col">Target</th>
                        <th className="px-5 py-3 font-medium" scope="col">Started</th>
                        <th className="px-5 py-3 font-medium" scope="col">Duration</th>
                        <th className="px-5 py-3 font-medium" scope="col">Findings</th>
                        <th className="px-5 py-3 font-medium" scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScans.map((scan: Scan, index: number) => (
                        <motion.tr
                          key={scan.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.3) }}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer focus-within:bg-gray-800/40"
                          onClick={() => setSelectedScan(scan)}
                          tabIndex={0}
                          role="row"
                          aria-label={`${getToolName(scan)} scan on ${scan.target}, status: ${scan.status}`}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedScan(scan); } }}
                        >
                          <td className="px-5 py-4">
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusColors[scan.status] || 'bg-gray-500'}`}>
                              <StatusIcon status={scan.status} />
                              <span>{statusLabels[scan.status] || scan.status}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-white font-medium">{getToolName(scan)}</td>
                          <td className="px-5 py-4 text-gray-300 font-mono text-sm">{scan.target}</td>
                          <td className="px-5 py-4 text-sm text-gray-400">
                            <time dateTime={scan.started_at || scan.created_at}>
                              {formatDate(scan.started_at || scan.created_at || '')}
                            </time>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-400">
                            {scan.status === 'running' ? (
                              <span className="text-blue-400 animate-pulse">In progress...</span>
                            ) : formatDuration(scan)}
                          </td>
                          <td className="px-5 py-4"><FindingsBadges scan={scan} /></td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              {scan.status === 'running' ? (
                                <button
                                  onClick={() => handleCancel(scan.id)}
                                  disabled={cancelMutation.isPending}
                                  className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition focus:outline-none focus:ring-2 focus:ring-red-400/50 disabled:opacity-50"
                                  aria-label={`Cancel ${getToolName(scan)} scan`}
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRerun(scan)}
                                  disabled={rerunMutation.isPending}
                                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition focus:outline-none focus:ring-2 focus:ring-kali-blue/50 disabled:opacity-50 disabled:cursor-wait"
                                  aria-label={`Rerun ${getToolName(scan)} scan`}
                                >
                                  {rerunMutation.isPending ? 'Starting...' : 'Rerun'}
                                </button>
                              )}
                              <Link
                                to={`/dashboard/scans/${scan.id}`}
                                className="px-3 py-1.5 bg-kali-blue/20 text-kali-blue hover:bg-kali-blue/30 rounded text-sm transition focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
                                aria-label={`View details for ${getToolName(scan)} scan`}
                              >
                                View
                              </Link>
                              {deleteConfirm === scan.id ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleDelete(scan.id)}
                                    disabled={deleteMutation.isPending}
                                    className="px-2 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded text-xs font-medium transition disabled:opacity-50"
                                  >
                                    {deleteMutation.isPending ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-2 py-1.5 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded text-xs transition"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(scan.id)}
                                  className="px-2 py-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded text-sm transition focus:outline-none"
                                  aria-label={`Delete ${getToolName(scan)} scan`}
                                  title="Delete scan"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card view */}
                <div className="md:hidden divide-y divide-gray-800">
                  {filteredScans.map((scan: Scan) => (
                    <button
                      key={scan.id}
                      onClick={() => setSelectedScan(scan)}
                      className="w-full text-left p-4 hover:bg-gray-800/30 transition focus:outline-none focus:bg-gray-800/40"
                      aria-label={`${getToolName(scan)} scan on ${scan.target}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[scan.status] || 'bg-gray-500'}`}>
                          <StatusIcon status={scan.status} />
                          <span>{statusLabels[scan.status] || scan.status}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(scan.started_at || scan.created_at || '')}</span>
                      </div>
                      <p className="text-white font-medium text-sm">{getToolName(scan)}</p>
                      <p className="text-gray-400 font-mono text-xs mt-1 truncate">{scan.target}</p>
                    </button>
                  ))}
                </div>

                {filteredScans.length === 0 && (
                  <div className="text-center py-16" role="status">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No scans found</h3>
                    <p className="text-gray-400 mb-4">Start your first security scan to see results here.</p>
                    <Link
                      to="/dashboard/scans/new"
                      className="inline-flex items-center gap-2 px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
                    >
                      New Scan
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Live View — Real-time monitoring */
            <motion.div
              key="live-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {runningScans.length > 0 ? (
                runningScans.map((scan: Scan) => (
                  <motion.div
                    key={scan.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                    role="article"
                    aria-label={`Live scan: ${getToolName(scan)} on ${scan.target}`}
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" aria-hidden="true" />
                        <div>
                          <h3 className="text-white font-medium">{getToolName(scan)}</h3>
                          <p className="text-sm text-gray-400">{scan.target}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancel(scan.id)}
                        disabled={cancelMutation.isPending}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition focus:outline-none focus:ring-2 focus:ring-red-400/50"
                        aria-label={`Stop ${getToolName(scan)} scan`}
                      >
                        Stop
                      </button>
                    </div>
                    <div className="h-64 bg-gray-950 p-4 overflow-auto font-mono text-sm" role="log" aria-label="Scan output" aria-live="polite">
                      <pre ref={outputRef} className="text-green-400 whitespace-pre-wrap">
                        {`$ ${scan.command || getToolName(scan)}\n`}
                        {`[*] Starting scan on ${scan.target}...\n`}
                        {`[*] Initializing modules...\n`}
                        {`[+] Connection established\n`}
                        {`[*] Scanning in progress...\n`}
                        <span className="animate-pulse">█</span>
                      </pre>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="lg:col-span-2 text-center py-16 bg-gray-900 rounded-xl border border-gray-800" role="status">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No running scans</h3>
                  <p className="text-gray-400">Start a new scan to see live output here.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan Detail Modal */}
        <AnimatePresence>
          {selectedScan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedScan(null)}
              role="dialog"
              aria-modal="true"
              aria-label={`Scan details: ${getToolName(selectedScan)}`}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{getToolName(selectedScan)} Scan</h2>
                    <p className="text-sm text-gray-400">{selectedScan.target}</p>
                  </div>
                  <button
                    onClick={() => setSelectedScan(null)}
                    className="text-gray-400 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-kali-blue/50 rounded-lg p-1"
                    aria-label="Close scan details"
                    autoFocus
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-200px)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-1">Status</p>
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusColors[selectedScan.status]}`}>
                        <StatusIcon status={selectedScan.status} />
                        <span className="capitalize">{selectedScan.status}</span>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-1">Started</p>
                      <p className="text-white text-sm">{new Date(selectedScan.started_at).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-white">{formatDuration(selectedScan)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-1">Findings</p>
                      <p className="text-white">{selectedScan.findings_count || 0}</p>
                    </div>
                  </div>

                  {selectedScan.command && (
                    <div className="mb-6">
                      <h4 className="text-sm text-gray-400 mb-2">Command</h4>
                      <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
                        <code className="text-green-400 font-mono text-sm">{selectedScan.command}</code>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm text-gray-400 mb-2">Output</h4>
                    <div className="bg-gray-950 rounded-lg p-4 h-64 overflow-auto" role="log" aria-label="Scan output">
                      <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                        {selectedScan.output || 'Scan output will appear here when available...'}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-800">
                  <button
                    onClick={() => {
                      if (deleteConfirm === selectedScan.id) {
                        handleDelete(selectedScan.id);
                      } else {
                        setDeleteConfirm(selectedScan.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className={`px-4 py-2 rounded-lg transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
                      deleteConfirm === selectedScan.id
                        ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400/50'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 focus:ring-red-400/50'
                    }`}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : deleteConfirm === selectedScan.id ? 'Confirm Delete' : 'Delete'}
                  </button>
                  <button
                    onClick={() => handleRerun(selectedScan)}
                    disabled={rerunMutation.isPending}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
                  >
                    {rerunMutation.isPending ? 'Starting...' : 'Rerun Scan'}
                  </button>
                  <Link
                    to={`/dashboard/reports/new?scan=${selectedScan.id}`}
                    className="px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition text-center focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
                  >
                    Generate Report
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </PageTransition>
  );
}

export default ScansPage;
