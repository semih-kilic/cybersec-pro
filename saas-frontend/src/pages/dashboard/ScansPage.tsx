/**
 * 🛡️ Scans — V20 "Onyx" rewrite
 *
 * Apple-grade SOC view for security scans.
 * - PageHeader + StatCard summary strip
 * - FilterChip toolbar (status) + SearchField
 * - DenseTable list with StatusPill + SeverityHeatmap
 * - Live-monitor split with terminal panel
 * - Detail modal with KeyValueGrid + command + output
 *
 * Business logic preserved verbatim (React Query hooks, mutations,
 * filtering, delete-confirm, plan-usage banner).
 */
import { useState, useRef, useCallback, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Plus,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Trash2,
  Square,
  Eye,
  ListChecks,
  Crown,
  Loader2,
  Terminal,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { ScansPageSkeleton } from '../../components/ui/Skeleton';
import { PageTransition } from '../../components/ui';
import { StatCard } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import {
  useScans,
  useCancelScan,
  useRerunScan,
  useDeleteScan,
  usePlanInfo,
  type Scan,
} from '../../hooks/useApiQueries';
import {
  PageHeader,
  StatusPill,
  FilterChip,
  SeverityHeatmap,
  DenseTable,
  DenseTableHead,
  DenseTH,
  DenseTR,
  DenseTD,
  KeyValueGrid,
} from '../../components/vos';
import type { Severity } from '../../components/vos';

/* ───────── Helpers ───────── */
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

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'> = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  queued: 'warning',
  cancelled: 'neutral',
  pending: 'neutral',
  timeout: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
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
  return '–';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '–';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/* ───────── Compact severity counts (for table cell) ───────── */
const SeverityCounts = memo(({ scan }: { scan: Scan }) => {
  const f = getFindings(scan);
  const counts: Record<Severity, number> = {
    critical: f.critical || 0,
    high: f.high || 0,
    medium: f.medium || 0,
    low: f.low || 0,
    info: 0,
  };
  const total = SEVERITY_ORDER.reduce((s, k) => s + counts[k], 0);
  if (!total) {
    if ((f.open_ports || 0) > 0) {
      return (
        <span className="text-vos-xs text-vos-success tabular-nums">
          {f.open_ports} ports
        </span>
      );
    }
    return <span className="text-vos-xs text-vos-text-muted">–</span>;
  }
  return <SeverityHeatmap counts={counts} compact total={total} />;
});
SeverityCounts.displayName = 'SeverityCounts';

/* ════════════════════════════════════════════════════════════════════ *
 *  ScansPage
 * ════════════════════════════════════════════════════════════════════ */

export function ScansPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('scans.title', 'Scans')} — CyberSec Pro`);
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const { data: scans = [], isLoading, isFetching } = useScans();
  const { data: planInfo } = usePlanInfo();
  const cancelMutation = useCancelScan();
  const rerunMutation = useRerunScan();
  const deleteMutation = useDeleteScan();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'live'>('list');
  const outputRef = useRef<HTMLPreElement>(null);

  const handleCancel = useCallback(
    async (scanId: string) => {
      try {
        await cancelMutation.mutateAsync(scanId);
        toast.success('Scan cancelled');
      } catch {
        toast.error('Failed to cancel scan');
      }
    },
    [cancelMutation, toast],
  );

  const handleRerun = useCallback(
    async (scan: Scan) => {
      try {
        const data = await rerunMutation.mutateAsync(scan.id);
        toast.success(`Scan restarted on ${data.target || scan.target}`);
        setSelectedScan(null);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to rerun scan');
      }
    },
    [rerunMutation, toast],
  );

  const handleDelete = useCallback(
    async (scanId: string) => {
      try {
        await deleteMutation.mutateAsync(scanId);
        toast.success('Scan deleted');
        setDeleteConfirm(null);
        setSelectedScan(null);
      } catch {
        toast.error('Failed to delete scan');
      }
    },
    [deleteMutation, toast],
  );

  const filteredScans = scans.filter((scan: Scan) => {
    const matchesFilter = filter === 'all' || scan.status === filter;
    const name = getToolName(scan).toLowerCase();
    const q = searchQuery.toLowerCase();
    return matchesFilter && (name.includes(q) || (scan.target || '').toLowerCase().includes(q));
  });

  const runningScans = scans.filter((s: Scan) => s.status === 'running');
  const completedScans = scans.filter((s: Scan) => s.status === 'completed');
  const failedScans = scans.filter((s: Scan) => ['failed', 'timeout'].includes(s.status));
  const queuedScans = scans.filter((s: Scan) => s.status === 'queued');

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <ScansPageSkeleton />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-7xl mx-auto space-y-vos-6">
        <PageHeader
          eyebrow="Operations"
          icon={<ListChecks size={22} />}
          title={t('scans.title', 'Scans')}
          description={t('scans.subtitle', 'View and manage your security scans')}
          actions={
            <Link
              to="/dashboard/scans/new"
              className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
            >
              <Plus size={14} />
              {t('scans.newScan', 'New Scan')}
            </Link>
          }
        />

        {/* Plan usage banner */}
        {planInfo && planInfo.config?.daily_scan_limit > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-4 flex items-center justify-between gap-vos-4"
          >
            <div className="flex items-center gap-vos-3 min-w-0">
              <span className="size-9 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent shrink-0">
                <Zap size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3">
                  {t('scans.dailyScanLimit', 'Daily Scan Limit')}
                </p>
                <p className="text-vos-text font-medium tabular-nums">
                  {planInfo.usage?.scans_today ?? 0} /{' '}
                  {planInfo.config.daily_scan_limit} scans used today
                </p>
              </div>
            </div>
            <div className="flex items-center gap-vos-3">
              <div className="w-32 h-1.5 bg-vos-bg-elev-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (planInfo.usage?.scans_today ?? 0) >= planInfo.config.daily_scan_limit
                      ? 'bg-vos-danger'
                      : (planInfo.usage?.scans_today ?? 0) >=
                        planInfo.config.daily_scan_limit * 0.8
                      ? 'bg-vos-warning'
                      : 'bg-vos-accent'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      ((planInfo.usage?.scans_today ?? 0) /
                        planInfo.config.daily_scan_limit) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              {(planInfo.usage?.scans_today ?? 0) >= planInfo.config.daily_scan_limit && (
                <Link
                  to="/dashboard/upgrade"
                  className="inline-flex items-center gap-1 text-vos-xs font-medium text-vos-accent hover:opacity-80"
                >
                  <Crown size={12} />
                  Upgrade
                </Link>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-3">
          <StatCard
            title={t('scans.totalScans', 'Total Scans')}
            value={scans.length.toString()}
            icon={<ListChecks size={16} />}
          />
          <StatCard
            title={t('scans.running', 'Running')}
            value={runningScans.length.toString()}
            icon={<Activity size={16} />}
            variant="cyan"
          />
          <StatCard
            title={t('scans.completed', 'Completed')}
            value={completedScans.length.toString()}
            icon={<CheckCircle2 size={16} />}
            variant="green"
          />
          <StatCard
            title={t('scans.failed', 'Failed')}
            value={failedScans.length.toString()}
            icon={<AlertTriangle size={16} />}
            variant="red"
          />
        </div>

        {/* Refetch indicator */}
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 text-vos-xs text-vos-text-3">
            <RefreshCw size={11} className="animate-spin" />
            <span>{t('common.refreshing', 'Refreshing…')}</span>
          </div>
        )}

        {/* Command bar */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-4 space-y-vos-3">
          <div className="flex flex-col lg:flex-row gap-vos-2">
            <label className="flex items-center gap-2 px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 focus-within:border-vos-accent focus-within:ring-2 focus-within:ring-vos-accent/30 transition-colors flex-1">
              <Search size={14} className="text-vos-text-3 shrink-0" />
              <input
                id="scan-search"
                type="search"
                placeholder={t('scans.searchPlaceholder', 'Search by tool or target…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
                aria-label="Search scans by tool name or target"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="size-5 rounded hover:bg-vos-bg-elev-4 flex items-center justify-center text-vos-text-3"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </label>

            <div className="flex p-0.5 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1">
              {(['list', 'live'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`h-9 px-vos-4 rounded text-vos-xs font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? 'bg-vos-bg-elev-4 text-vos-text'
                      : 'text-vos-text-3 hover:text-vos-text'
                  }`}
                >
                  {mode === 'list' ? <ListChecks size={12} className="inline mr-1" /> : <Activity size={12} className="inline mr-1" />}
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'running', 'completed', 'failed', 'queued'] as const).map((status) => {
              const count =
                status === 'all'
                  ? scans.length
                  : status === 'running'
                  ? runningScans.length
                  : status === 'completed'
                  ? completedScans.length
                  : status === 'failed'
                  ? failedScans.length
                  : queuedScans.length;
              return (
                <FilterChip
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  value={count}
                  active={filter === status}
                  onClick={() => setFilter(status)}
                />
              );
            })}
          </div>
        </section>

        {/* List / Live view */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.section
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {filteredScans.length === 0 ? (
                <EmptyState
                  icon={<ListChecks size={20} />}
                  title={t('scans.noScansFound', 'No scans found')}
                  description={t(
                    'scans.startFirstScan',
                    'Start your first security scan to see results here.',
                  )}
                  action={
                    <Link
                      to="/dashboard/scans/new"
                      className="inline-flex items-center gap-2 h-9 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
                    >
                      <Plus size={14} />
                      New Scan
                    </Link>
                  }
                />
              ) : (
                <DenseTable>
                  <DenseTableHead>
                    <DenseTH>{t('common.status', 'Status')}</DenseTH>
                    <DenseTH>{t('common.tool', 'Tool')}</DenseTH>
                    <DenseTH>{t('common.target', 'Target')}</DenseTH>
                    <DenseTH>{t('common.started', 'Started')}</DenseTH>
                    <DenseTH>{t('common.duration', 'Duration')}</DenseTH>
                    <DenseTH>{t('common.findings', 'Findings')}</DenseTH>
                    <DenseTH align="right">{t('common.actions', 'Actions')}</DenseTH>
                  </DenseTableHead>
                  <tbody>
                    {filteredScans.map((scan: Scan) => (
                      <DenseTR key={scan.id} onClick={() => setSelectedScan(scan)}>
                        <DenseTD>
                          <StatusPill
                            tone={STATUS_TONE[scan.status] || 'neutral'}
                            pulse={scan.status === 'running'}
                          >
                            {STATUS_LABEL[scan.status] || scan.status}
                          </StatusPill>
                        </DenseTD>
                        <DenseTD>
                          <span className="text-vos-text font-medium">{getToolName(scan)}</span>
                        </DenseTD>
                        <DenseTD>
                          <span className="font-mono text-vos-xs text-vos-text-2">
                            {scan.target}
                          </span>
                        </DenseTD>
                        <DenseTD>
                          <span className="text-vos-text-3 text-vos-xs">
                            {formatDate(scan.started_at || scan.created_at || '')}
                          </span>
                        </DenseTD>
                        <DenseTD>
                          {scan.status === 'running' ? (
                            <span className="text-vos-accent text-vos-xs flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" />
                              {t('scans.inProgress', 'In progress…')}
                            </span>
                          ) : (
                            <span className="text-vos-text-3 text-vos-xs tabular-nums">
                              {formatDuration(scan)}
                            </span>
                          )}
                        </DenseTD>
                        <DenseTD>
                          <SeverityCounts scan={scan} />
                        </DenseTD>
                        <DenseTD align="right">
                          <div
                            className="flex items-center gap-1 justify-end"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {scan.status === 'running' ? (
                              <IconButton
                                tone="danger"
                                onClick={() => handleCancel(scan.id)}
                                disabled={cancelMutation.isPending}
                                aria-label={`Cancel ${getToolName(scan)} scan`}
                              >
                                <Square size={11} />
                                Cancel
                              </IconButton>
                            ) : (
                              <IconButton
                                onClick={() => handleRerun(scan)}
                                disabled={rerunMutation.isPending}
                                aria-label={`Rerun ${getToolName(scan)} scan`}
                              >
                                <RotateCw size={11} />
                                {rerunMutation.isPending ? '…' : 'Rerun'}
                              </IconButton>
                            )}
                            <Link
                              to={`/dashboard/scans/${scan.id}`}
                              className="inline-flex items-center gap-1 px-vos-2 h-7 rounded-vos-sm bg-vos-bg-elev-3 hover:bg-vos-accent hover:text-white border border-vos-border-1 hover:border-vos-accent text-vos-xs font-medium transition-colors text-vos-text"
                              aria-label={`View ${getToolName(scan)} scan`}
                            >
                              <Eye size={11} />
                              View
                            </Link>
                            {deleteConfirm === scan.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(scan.id)}
                                  disabled={deleteMutation.isPending}
                                  className="px-vos-2 h-7 rounded-vos-sm bg-vos-danger text-white text-vos-xs font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="size-7 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text-3 hover:text-vos-text flex items-center justify-center"
                                  aria-label="Cancel delete"
                                >
                                  <X size={11} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(scan.id)}
                                className="size-7 rounded-vos-sm text-vos-text-3 hover:text-vos-danger hover:bg-vos-danger/10 flex items-center justify-center transition-colors"
                                aria-label={`Delete ${getToolName(scan)} scan`}
                                title={t('scans.deleteScan', 'Delete scan')}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </DenseTD>
                      </DenseTR>
                    ))}
                  </tbody>
                </DenseTable>
              )}
            </motion.section>
          ) : (
            <motion.section
              key="live-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-vos-4"
            >
              {runningScans.length > 0 ? (
                runningScans.map((scan: Scan) => (
                  <motion.div
                    key={scan.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden"
                    role="article"
                    aria-label={`Live scan: ${getToolName(scan)} on ${scan.target}`}
                  >
                    <div className="flex items-center justify-between p-vos-4 border-b border-vos-border-1">
                      <div className="flex items-center gap-vos-3 min-w-0">
                        <StatusPill tone="info" pulse>
                          Running
                        </StatusPill>
                        <div className="min-w-0">
                          <h3 className="text-vos-sm font-semibold text-vos-text truncate">
                            {getToolName(scan)}
                          </h3>
                          <p className="text-vos-xs font-mono text-vos-text-3 truncate">
                            {scan.target}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancel(scan.id)}
                        disabled={cancelMutation.isPending}
                        className="inline-flex items-center gap-1 h-8 px-vos-3 rounded-vos-sm bg-vos-danger/10 text-vos-danger border border-vos-danger/20 hover:bg-vos-danger/20 text-vos-xs font-medium transition-colors"
                        aria-label={`Stop ${getToolName(scan)} scan`}
                      >
                        <Square size={11} />
                        Stop
                      </button>
                    </div>
                    <div className="h-64 bg-vos-bg-elev-1 p-vos-4 overflow-auto font-mono text-vos-xs">
                      <pre
                        ref={outputRef}
                        className="text-vos-success whitespace-pre-wrap leading-relaxed"
                      >
                        {`$ ${scan.command || getToolName(scan)}\n`}
                        {`[*] Starting scan on ${scan.target}…\n`}
                        {`[*] Initializing modules…\n`}
                        {`[+] Connection established\n`}
                        {`[*] Scanning in progress…\n`}
                        <span className="animate-pulse">█</span>
                      </pre>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="lg:col-span-2">
                  <EmptyState
                    icon={<Activity size={20} />}
                    title={t('scans.noRunningScans', 'No running scans')}
                    description={t(
                      'scans.startNewScan',
                      'Start a new scan to see live output here.',
                    )}
                  />
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Scan detail modal */}
        <AnimatePresence>
          {selectedScan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-vos-4"
              onClick={() => setSelectedScan(null)}
              role="dialog"
              aria-modal="true"
              aria-label={`Scan details: ${getToolName(selectedScan)}`}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                className="rounded-vos-2xl border border-vos-border-1 bg-vos-bg-elev-2 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-vos-elev-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
                      Scan
                    </p>
                    <h2 className="text-vos-lg font-semibold text-vos-text truncate">
                      {getToolName(selectedScan)}
                    </h2>
                    <p className="text-vos-xs font-mono text-vos-text-3 truncate">
                      {selectedScan.target}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedScan(null)}
                    className="size-8 rounded-vos-md text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-3 flex items-center justify-center transition-colors"
                    aria-label="Close scan details"
                    autoFocus
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-vos-5 overflow-auto max-h-[calc(90vh-220px)] space-y-vos-5">
                  <KeyValueGrid
                    cols={4}
                    items={[
                      {
                        label: 'Status',
                        value: (
                          <StatusPill
                            tone={STATUS_TONE[selectedScan.status] || 'neutral'}
                            pulse={selectedScan.status === 'running'}
                          >
                            {STATUS_LABEL[selectedScan.status] || selectedScan.status}
                          </StatusPill>
                        ),
                      },
                      {
                        label: 'Started',
                        value: (
                          <span className="text-vos-sm text-vos-text">
                            {selectedScan.started_at
                              ? new Date(selectedScan.started_at).toLocaleString()
                              : '–'}
                          </span>
                        ),
                      },
                      {
                        label: 'Duration',
                        value: (
                          <span className="text-vos-sm text-vos-text tabular-nums flex items-center gap-1">
                            <Clock size={11} className="text-vos-text-3" />
                            {formatDuration(selectedScan)}
                          </span>
                        ),
                      },
                      {
                        label: 'Findings',
                        value: (
                          <span className="text-vos-sm text-vos-text font-semibold tabular-nums">
                            {selectedScan.findings_count || 0}
                          </span>
                        ),
                      },
                    ]}
                  />

                  {selectedScan.command && (
                    <div>
                      <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
                        Command
                      </p>
                      <div className="rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 p-vos-3 overflow-x-auto">
                        <code className="text-vos-success font-mono text-vos-xs">
                          {selectedScan.command}
                        </code>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-vos-2 mb-1.5">
                      <Terminal size={11} className="text-vos-text-3" />
                      <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
                        Output
                      </p>
                    </div>
                    <div
                      className="rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 p-vos-3 h-64 overflow-auto"
                      role="log"
                      aria-label="Scan output"
                    >
                      <pre className="text-vos-success font-mono text-vos-xs whitespace-pre-wrap">
                        {selectedScan.output ||
                          'Scan output will appear here when available…'}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-vos-2 p-vos-5 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
                  <button
                    onClick={() => {
                      if (deleteConfirm === selectedScan.id) {
                        handleDelete(selectedScan.id);
                      } else {
                        setDeleteConfirm(selectedScan.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className={`inline-flex items-center gap-1.5 h-9 px-vos-4 rounded-vos-md text-vos-sm font-medium transition-colors disabled:opacity-50 ${
                      deleteConfirm === selectedScan.id
                        ? 'bg-vos-danger text-white hover:opacity-90'
                        : 'bg-vos-danger/10 text-vos-danger border border-vos-danger/20 hover:bg-vos-danger/20'
                    }`}
                  >
                    <Trash2 size={12} />
                    {deleteMutation.isPending
                      ? 'Deleting…'
                      : deleteConfirm === selectedScan.id
                      ? 'Confirm Delete'
                      : 'Delete'}
                  </button>
                  <button
                    onClick={() => handleRerun(selectedScan)}
                    disabled={rerunMutation.isPending}
                    className="inline-flex items-center gap-1.5 h-9 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4 disabled:opacity-50"
                  >
                    <RotateCw size={12} />
                    {rerunMutation.isPending ? 'Starting…' : 'Rerun Scan'}
                  </button>
                  <Link
                    to={`/dashboard/reports/new?scan=${selectedScan.id}`}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
                  >
                    Generate Report
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

/* ───────── Local primitives ───────── */
function IconButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  'aria-label'?: string;
}) {
  const cls =
    tone === 'danger'
      ? 'bg-vos-danger/10 text-vos-danger border-vos-danger/20 hover:bg-vos-danger/20'
      : 'bg-vos-bg-elev-3 text-vos-text-2 border-vos-border-1 hover:bg-vos-bg-elev-4 hover:text-vos-text';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-vos-2 h-7 rounded-vos-sm border text-vos-xs font-medium transition-colors disabled:opacity-50 ${cls}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-vos-16 rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2">
      <span className="size-12 mx-auto rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-3 mb-vos-3">
        {icon}
      </span>
      <h3 className="text-vos-md font-semibold text-vos-text mb-1">{title}</h3>
      <p className="text-vos-sm text-vos-text-3 mb-vos-4">{description}</p>
      {action}
    </div>
  );
}

export default ScansPage;
