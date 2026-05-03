/**
 * AgentJobsPage
 *
 * Read-only operator/admin view of the reverse-tunnel `agent_jobs` queue
 * for the current organization. Shows recent jobs (default 50, max 200),
 * status counters, and per-row details (command, exit code, stdout/stderr
 * size, claim/completion timing).
 *
 * Backend endpoint: GET /api/v1/agents/jobs?agent_id=&status=&limit=
 *   → { jobs: [...], by_status: {pending: n, …}, limit }
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Hourglass,
} from 'lucide-react';

import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import { PageHeader, StatusPill, Section } from '../../components/vos';

interface AgentJob {
  id: string;
  agent_id: string;
  agent_name: string;
  scan_id: string | null;
  tool_id: string | null;
  command: string;
  status: string;
  exit_code: number | null;
  timeout_seconds: number;
  created_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  stdout_bytes: number;
  stderr_bytes: number;
}

interface AgentJobsResponse {
  jobs: AgentJob[];
  by_status: Record<string, number>;
  limit: number;
}

const STATUS_TONES: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  pending: 'info',
  claimed: 'info',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  timeout: 'danger',
  cancelled: 'neutral',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  claimed: Hourglass,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  timeout: AlertTriangle,
  cancelled: XCircle,
};

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

function durationMs(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b)) return '—';
  const ms = b - a;
  if (ms < 1000) return ms + 'ms';
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's';
  return Math.round(ms / 60_000) + 'm ' + Math.round((ms % 60_000) / 1000) + 's';
}

export default function AgentJobsPage() {
  const { t } = useTranslation();
  useDocumentTitle('Agent Jobs');

  const [data, setData] = useState<AgentJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    try {
      setErr(null);
      const jwt = localStorage.getItem('token') || '';
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch('/api/v1/agents/jobs?' + params.toString(), {
        headers: jwt ? { Authorization: 'Bearer ' + jwt } : {},
      });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const json: AgentJobsResponse = await res.json();
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data.jobs;
    return data.jobs.filter((j) =>
      j.agent_name.toLowerCase().includes(q) ||
      j.command.toLowerCase().includes(q) ||
      (j.tool_id || '').toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q),
    );
  }, [data, searchTerm]);

  const counts = data?.by_status || {};
  const statKeys: Array<{ key: string; label: string; tone: keyof typeof STATUS_TONES }> = [
    { key: 'pending',   label: 'Pending',   tone: 'pending' },
    { key: 'claimed',   label: 'Claimed',   tone: 'claimed' },
    { key: 'running',   label: 'Running',   tone: 'running' },
    { key: 'completed', label: 'Completed', tone: 'completed' },
    { key: 'failed',    label: 'Failed',    tone: 'failed' },
    { key: 'timeout',   label: 'Timeout',   tone: 'timeout' },
    { key: 'cancelled', label: 'Cancelled', tone: 'cancelled' },
  ];

  return (
    <PageTransition>
      <div className="flex flex-col gap-vos-8 pb-vos-12">
        <PageHeader
          eyebrow="Reverse-tunnel telemetry"
          title="Agent Jobs"
          description={t('agent_jobs.description', 'Recent commands queued to your reverse-tunnel agents. Auto-refreshes every 6 s.') as string}
          icon={<Activity className="size-6" />}
          actions={
            <div className="flex items-center gap-vos-3">
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                className={
                  'px-vos-3 py-vos-2 rounded-vos-md border text-vos-sm font-medium transition-colors ' +
                  (autoRefresh
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-vos-bg-elev-2 border-vos-border-1 text-vos-text-2 hover:text-vos-text-1')
                }
              >
                {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="px-vos-3 py-vos-2 rounded-vos-md bg-vos-bg-elev-2 border border-vos-border-1 text-vos-sm font-medium text-vos-text-2 hover:text-vos-text-1 transition-colors flex items-center gap-vos-2 disabled:opacity-50"
              >
                <RefreshCw className={'size-4 ' + (loading ? 'animate-spin' : '')} />
                Refresh
              </button>
            </div>
          }
        />

        {/* Status counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-vos-3">
          {statKeys.map(({ key, label }) => {
            const Icon = STATUS_ICONS[key] || Activity;
            const tone = STATUS_TONES[key] || 'neutral';
            const n = counts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter((s) => (s === key ? '' : key))}
                className={
                  'flex items-center gap-vos-3 p-vos-3 rounded-vos-lg border text-left transition-all ' +
                  (statusFilter === key
                    ? 'bg-vos-bg-elev-3 border-vos-accent ring-1 ring-vos-accent/30'
                    : 'bg-vos-bg-elev-1 border-vos-border-1 hover:border-vos-border-2')
                }
              >
                <span
                  className={
                    'size-9 rounded-vos-md flex items-center justify-center shrink-0 ' +
                    (tone === 'success' ? 'bg-emerald-500/10 text-emerald-300' :
                     tone === 'danger'  ? 'bg-red-500/10 text-red-300' :
                     tone === 'warning' ? 'bg-amber-500/10 text-amber-300' :
                     tone === 'info'    ? 'bg-blue-500/10 text-blue-300' :
                                          'bg-vos-bg-elev-2 text-vos-text-3')
                  }
                >
                  <Icon className={'size-4 ' + (key === 'running' ? 'animate-spin' : '')} />
                </span>
                <div className="min-w-0">
                  <div className="text-vos-xs text-vos-text-3">{label}</div>
                  <div className="text-vos-base font-semibold text-vos-text-1 tabular-nums">{n}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-vos-3">
          <div className="relative flex-1">
            <Search className="absolute left-vos-3 top-1/2 -translate-y-1/2 size-4 text-vos-text-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by agent, tool, command, or job id…"
              className="w-full pl-vos-9 pr-vos-3 py-vos-2 bg-vos-bg-elev-1 border border-vos-border-1 rounded-vos-md text-vos-sm text-vos-text-1 placeholder:text-vos-text-3 focus:outline-none focus:border-vos-accent"
            />
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="px-vos-3 py-vos-2 rounded-vos-md border border-vos-border-1 text-vos-sm text-vos-text-2 hover:text-vos-text-1 flex items-center gap-vos-2"
            >
              <Filter className="size-4" />
              Clear filter ({statusFilter})
            </button>
          )}
        </div>

        {/* Table */}
        <Section title="Recent jobs" description={data ? `Showing ${filteredJobs.length} of ${data.jobs.length} loaded` : undefined}>
          {err && (
            <div className="p-vos-4 rounded-vos-md bg-red-500/10 border border-red-500/30 text-red-300 text-vos-sm">
              {err}
            </div>
          )}
          {loading && !data && (
            <div className="flex items-center justify-center p-vos-8 text-vos-text-3">
              <Loader2 className="size-5 animate-spin mr-vos-2" />
              Loading…
            </div>
          )}
          {data && filteredJobs.length === 0 && (
            <div className="p-vos-8 text-center text-vos-text-3 text-vos-sm">
              No agent jobs match your filters yet.
            </div>
          )}
          {data && filteredJobs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-vos-sm">
                <thead>
                  <tr className="text-left text-vos-xs uppercase tracking-vos-wide text-vos-text-3 border-b border-vos-border-1">
                    <th className="px-vos-3 py-vos-2 font-medium">Status</th>
                    <th className="px-vos-3 py-vos-2 font-medium">Agent</th>
                    <th className="px-vos-3 py-vos-2 font-medium">Tool / Command</th>
                    <th className="px-vos-3 py-vos-2 font-medium text-right">Duration</th>
                    <th className="px-vos-3 py-vos-2 font-medium text-right">Output</th>
                    <th className="px-vos-3 py-vos-2 font-medium text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((j) => (
                    <motion.tr
                      key={j.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-vos-border-1/60 hover:bg-vos-bg-elev-1/60"
                    >
                      <td className="px-vos-3 py-vos-3">
                        <StatusPill tone={STATUS_TONES[j.status] || 'neutral'} label={j.status} />
                        {j.exit_code != null && (j.status === 'failed' || j.status === 'completed') && (
                          <div className="text-vos-xs text-vos-text-3 mt-vos-1">exit {j.exit_code}</div>
                        )}
                      </td>
                      <td className="px-vos-3 py-vos-3 align-top">
                        <div className="font-medium text-vos-text-1 truncate max-w-[14rem]" title={j.agent_name}>{j.agent_name}</div>
                        <div className="text-vos-xs text-vos-text-3 font-mono truncate max-w-[14rem]" title={j.agent_id}>{j.agent_id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-vos-3 py-vos-3 align-top max-w-md">
                        {j.tool_id && (
                          <div className="text-vos-xs text-vos-text-3 mb-vos-1">{j.tool_id}</div>
                        )}
                        <code className="block text-vos-xs font-mono text-vos-text-2 bg-vos-bg-elev-2 rounded-vos-sm px-vos-2 py-vos-1 break-all whitespace-pre-wrap">
                          {j.command}
                        </code>
                        {j.scan_id && (
                          <div className="text-vos-xs text-vos-text-3 mt-vos-1">scan {j.scan_id.slice(0, 8)}…</div>
                        )}
                      </td>
                      <td className="px-vos-3 py-vos-3 align-top text-right tabular-nums">
                        <div className="text-vos-text-2">{durationMs(j.claimed_at, j.completed_at)}</div>
                        <div className="text-vos-xs text-vos-text-3">timeout {j.timeout_seconds}s</div>
                      </td>
                      <td className="px-vos-3 py-vos-3 align-top text-right tabular-nums">
                        <div className="text-emerald-300">{formatBytes(j.stdout_bytes)}</div>
                        {j.stderr_bytes > 0 && (
                          <div className="text-vos-xs text-amber-300">{formatBytes(j.stderr_bytes)} err</div>
                        )}
                      </td>
                      <td className="px-vos-3 py-vos-3 align-top text-right tabular-nums text-vos-text-3 text-vos-xs">
                        {formatRelative(j.created_at)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </PageTransition>
  );
}
