/**
 * GodMode — Superadmin omniscient control panel.
 *
 * Real-time data backed by /api/v1/superadmin/* endpoints (no mocks).
 *   • Live system telemetry (CPU/RAM/Disk/Net) every 2s via sysinfo.
 *   • Database explorer (size, top tables, active connections).
 *   • Live journalctl tail (cybersec-saas / nginx / postgresql).
 *   • Feature flags registry with per-flag toggle.
 *   • Platform-wide kill switch with audit-logged confirmation.
 */
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  Activity,
  Database,
  ScrollText,
  ToggleLeft,
  Cpu,
  HardDrive,
  Network,
  Wand2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Plus,
  Crown,
  Search,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import {
  PageTransition,
  Card,
  Stat,
  StatGroup,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Button,
  EmptyState,
  Switch,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Spinner,
} from '../../components/vos';
import {
  useSuperadminTelemetry,
  useSuperadminDbStats,
  useSuperadminLogs,
  useFeatureFlags,
  useUpsertFeatureFlag,
  useKillSwitchStatus,
  useToggleKillSwitch,
  useSuperadminOrganizations,
  useChangeOrgPlan,
  type FeatureFlag,
  type SuperadminOrg,
} from '../../hooks/useApiQueries';

// ---------- helpers ----------
function fmtBytes(n: number | undefined | null): string {
  if (!n || !Number.isFinite(n)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtUptime(secs: number | undefined): string {
  if (!secs || secs < 0) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---------- main page ----------
export default function GodModePage() {
  const { t } = useTranslation();
  useDocumentTitle('God Mode — CyberSec Pro');

  const [tab, setTab] = useState('telemetry');
  const [killModalOpen, setKillModalOpen] = useState(false);

  const ks = useKillSwitchStatus();
  const tel = useSuperadminTelemetry(tab === 'telemetry');

  const cpuPct = tel.data?.cpu.usage_pct ?? 0;
  const memPct = tel.data?.memory.usage_pct ?? 0;
  const diskPct = tel.data?.disk.usage_pct ?? 0;
  const memUsed = tel.data?.memory.used_bytes ?? 0;
  const memTotal = tel.data?.memory.total_bytes ?? 0;
  const diskUsed = tel.data?.disk.used_bytes ?? 0;
  const diskTotal = tel.data?.disk.total_bytes ?? 0;
  const netRx = tel.data?.network.received_bytes_window ?? 0;
  const netTx = tel.data?.network.transmitted_bytes_window ?? 0;
  const cores = tel.data?.cpu.core_count ?? 0;
  const physical = tel.data?.cpu.physical_core_count ?? null;

  return (
    <PageTransition>
      <div className="flex flex-col gap-vos-8">
        {/* Page header */}
        <header className="flex items-end justify-between gap-vos-4 flex-wrap">
          <div className="flex items-center gap-vos-4">
            <span className="size-12 rounded-vos-lg bg-vos-danger/10 border border-vos-danger/30 flex items-center justify-center text-vos-danger">
              <Wand2 size={22} />
            </span>
            <div>
              <div className="flex items-center gap-vos-2 mb-1 flex-wrap">
                <h1 className="text-vos-4xl font-semibold tracking-vos-tight leading-vos-tight text-vos-text">
                  {t('godMode.title', 'God Mode')}
                </h1>
                <Badge tone="danger" size="sm">
                  {t('godMode.restricted', 'Superadmin')}
                </Badge>
                {ks.data?.engaged && (
                  <Badge tone="danger" size="sm">
                    <AlertTriangle size={11} className="mr-1" />
                    Kill switch engaged
                  </Badge>
                )}
              </div>
              <p className="text-vos-sm text-vos-text-3 max-w-xl">
                {t(
                  'godMode.subtitle',
                  'Full-system control. Every action here is audited and irreversible. Use with care.',
                )}
              </p>
            </div>
          </div>
          <Button
            variant={ks.data?.engaged ? 'secondary' : 'danger'}
            leftIcon={<ShieldAlert size={14} />}
            onClick={() => setKillModalOpen(true)}
          >
            {ks.data?.engaged
              ? t('godMode.killSwitchRelease', 'Release kill switch')
              : t('godMode.killSwitch', 'Engage kill switch')}
          </Button>
        </header>

        {/* Live telemetry summary cards */}
        <StatGroup cols={4}>
          <Stat
            label={t('godMode.cpu', 'CPU load')}
            value={fmtPct(cpuPct)}
            icon={<Cpu className="size-4" />}
            hint={
              cores
                ? `${cores} threads${physical ? ` · ${physical} cores` : ''} · load ${(tel.data?.cpu.load_avg_1 ?? 0).toFixed(2)}`
                : tel.isLoading
                  ? 'Loading…'
                  : '—'
            }
          />
          <Stat
            label={t('godMode.memory', 'Memory')}
            value={fmtBytes(memUsed)}
            icon={<Activity className="size-4" />}
            hint={memTotal ? `${fmtPct(memPct)} of ${fmtBytes(memTotal)}` : '—'}
          />
          <Stat
            label={t('godMode.disk', 'Disk usage')}
            value={fmtPct(diskPct)}
            icon={<HardDrive className="size-4" />}
            hint={diskTotal ? `${fmtBytes(diskUsed)} / ${fmtBytes(diskTotal)}` : '—'}
          />
          <Stat
            label={t('godMode.network', 'Network (window)')}
            value={`${fmtBytes(netRx)} / ${fmtBytes(netTx)}`}
            icon={<Network className="size-4" />}
            hint={`rx / tx · ${tel.data?.network.interfaces.length ?? 0} interfaces`}
          />
        </StatGroup>

        {/* Section tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="telemetry">
              <Activity size={14} className="mr-1.5" />
              {t('godMode.tabs.telemetry', 'Telemetry')}
            </TabsTrigger>
            <TabsTrigger value="db">
              <Database size={14} className="mr-1.5" />
              {t('godMode.tabs.db', 'Database')}
            </TabsTrigger>
            <TabsTrigger value="logs">
              <ScrollText size={14} className="mr-1.5" />
              {t('godMode.tabs.logs', 'Logs')}
            </TabsTrigger>
            <TabsTrigger value="flags">
              <ToggleLeft size={14} className="mr-1.5" />
              {t('godMode.tabs.flags', 'Feature flags')}
            </TabsTrigger>
            <TabsTrigger value="plans">
              <Crown size={14} className="mr-1.5" />
              {t('godMode.tabs.plans', 'Plans & Memberships')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="telemetry">
            <TelemetryPanel telemetry={tel.data} loading={tel.isLoading} error={tel.error?.message} />
          </TabsContent>

          <TabsContent value="db">
            <DbPanel />
          </TabsContent>

          <TabsContent value="logs">
            <LogsPanel />
          </TabsContent>

          <TabsContent value="flags">
            <FeatureFlagsPanel />
          </TabsContent>

          <TabsContent value="plans">
            <PlansPanel />
          </TabsContent>
        </Tabs>

        <KillSwitchModal
          open={killModalOpen}
          onClose={() => setKillModalOpen(false)}
          currentlyEngaged={ks.data?.engaged ?? false}
        />
      </div>
    </PageTransition>
  );
}

// ---------- Telemetry panel ----------
function TelemetryPanel({
  telemetry,
  loading,
  error,
}: {
  telemetry: ReturnType<typeof useSuperadminTelemetry>['data'];
  loading: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  if (loading && !telemetry) {
    return (
      <Card elevation={2} className="rounded-vos-xl p-vos-8">
        <div className="flex items-center justify-center gap-vos-3 text-vos-text-3">
          <Spinner size="md" />
          <span className="text-vos-sm">{t('godMode.loadingTelemetry', 'Loading telemetry…')}</span>
        </div>
      </Card>
    );
  }
  if (error || !telemetry) {
    return (
      <Card elevation={2} className="rounded-vos-xl p-vos-6">
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title={t('godMode.telemetryUnavailable', 'Telemetry unavailable')}
          description={error || t('godMode.telemetryNoData', 'No data returned from /api/v1/superadmin/telemetry')}
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-vos-6">
      {/* Host */}
      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center gap-vos-2">
          <Server size={16} className="text-vos-text-3" />
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.host', 'Host')}</h2>
        </div>
        <div className="p-vos-6 grid grid-cols-2 gap-vos-3 text-vos-sm">
          <KV label={t('godMode.hostname', 'Hostname')} value={telemetry.host.name ?? '—'} />
          <KV label={t('godMode.os', 'OS')} value={telemetry.host.os ?? '—'} />
          <KV label={t('godMode.kernel', 'Kernel')} value={telemetry.host.kernel ?? '—'} />
          <KV label={t('godMode.uptime', 'Uptime')} value={fmtUptime(telemetry.host.uptime_secs)} />
          <KV label={t('godMode.processes', 'Processes')} value={String(telemetry.process.count)} />
          <KV
            label={t('godMode.loadAvg', 'Load avg (1/5/15)')}
            value={`${telemetry.cpu.load_avg_1.toFixed(2)} / ${telemetry.cpu.load_avg_5.toFixed(2)} / ${telemetry.cpu.load_avg_15.toFixed(2)}`}
          />
        </div>
      </Card>

      {/* CPU per-core */}
      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center justify-between">
          <div className="flex items-center gap-vos-2">
            <Cpu size={16} className="text-vos-text-3" />
            <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.cpuPerCore', 'CPU per-core')}</h2>
          </div>
          <Badge tone="default" size="sm">
            {t('godMode.avg', '{{value}} avg', { value: fmtPct(telemetry.cpu.usage_pct) })}
          </Badge>
        </div>
        <div className="p-vos-6 grid grid-cols-2 gap-x-vos-4 gap-y-vos-2 max-h-72 overflow-y-auto">
          {telemetry.cpu.per_core.map((c, i) => (
            <CoreBar key={i} name={c.name || `cpu${i}`} pct={c.usage_pct} freq={c.frequency_mhz} />
          ))}
        </div>
      </Card>

      {/* Memory */}
      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center gap-vos-2">
          <Activity size={16} className="text-vos-text-3" />
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.memory', 'Memory')}</h2>
        </div>
        <div className="p-vos-6 space-y-vos-3 text-vos-sm">
          <MeterRow
            label="RAM"
            usedLabel={`${fmtBytes(telemetry.memory.used_bytes)} / ${fmtBytes(telemetry.memory.total_bytes)}`}
            pct={telemetry.memory.usage_pct}
          />
          {telemetry.memory.swap_total_bytes > 0 && (
            <MeterRow
              label="Swap"
              usedLabel={`${fmtBytes(telemetry.memory.swap_used_bytes)} / ${fmtBytes(telemetry.memory.swap_total_bytes)}`}
              pct={
                telemetry.memory.swap_total_bytes
                  ? (telemetry.memory.swap_used_bytes / telemetry.memory.swap_total_bytes) * 100
                  : 0
              }
            />
          )}
          <KV label={t('godMode.available', 'Available')} value={fmtBytes(telemetry.memory.available_bytes)} />
        </div>
      </Card>

      {/* Disks */}
      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center gap-vos-2">
          <HardDrive size={16} className="text-vos-text-3" />
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.disks', 'Disks')}</h2>
        </div>
        <div className="p-vos-6 space-y-vos-3 text-vos-sm max-h-80 overflow-y-auto">
          {telemetry.disk.devices.length === 0 && (
            <p className="text-vos-text-3 text-vos-xs">{t('godMode.noDisks', 'No disks reported.')}</p>
          )}
          {telemetry.disk.devices.map((d, i) => (
            <div key={i} className="border border-vos-border-1 rounded-vos-md p-vos-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-vos-xs text-vos-text-2 truncate">{d.mount}</span>
                <Badge tone="default" size="sm">
                  {d.fs}
                </Badge>
              </div>
              <MeterRow
                label={d.name}
                usedLabel={`${fmtBytes(d.used_bytes)} / ${fmtBytes(d.total_bytes)}`}
                pct={d.usage_pct}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Network */}
      <Card elevation={2} className="rounded-vos-xl lg:col-span-2">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center gap-vos-2">
          <Network size={16} className="text-vos-text-3" />
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.networkInterfaces', 'Network interfaces')}</h2>
        </div>
        <div className="p-vos-6 overflow-x-auto">
          <table className="w-full text-vos-sm">
            <thead>
              <tr className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 border-b border-vos-border-1">
                <th className="text-left py-vos-2 pr-vos-4">{t('godMode.colName', 'Name')}</th>
                <th className="text-right py-vos-2 pr-vos-4">{t('godMode.rxWindow', 'RX (window)')}</th>
                <th className="text-right py-vos-2 pr-vos-4">{t('godMode.txWindow', 'TX (window)')}</th>
                <th className="text-right py-vos-2 pr-vos-4">{t('godMode.rxTotal', 'RX total')}</th>
                <th className="text-right py-vos-2">{t('godMode.txTotal', 'TX total')}</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.network.interfaces.map((n) => (
                <tr key={n.name} className="border-b border-vos-border-1/50">
                  <td className="py-vos-2 pr-vos-4 font-mono text-vos-xs">{n.name}</td>
                  <td className="py-vos-2 pr-vos-4 text-right">{fmtBytes(n.received_bytes_window)}</td>
                  <td className="py-vos-2 pr-vos-4 text-right">{fmtBytes(n.transmitted_bytes_window)}</td>
                  <td className="py-vos-2 pr-vos-4 text-right text-vos-text-3">{fmtBytes(n.received_bytes_total)}</td>
                  <td className="py-vos-2 text-right text-vos-text-3">{fmtBytes(n.transmitted_bytes_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3">{label}</div>
      <div className="text-vos-text font-mono text-vos-xs mt-0.5 break-all">{value}</div>
    </div>
  );
}

function MeterRow({ label, usedLabel, pct }: { label: string; usedLabel: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = clamped >= 90 ? 'bg-vos-danger' : clamped >= 75 ? 'bg-vos-warning' : 'bg-vos-accent';
  return (
    <div>
      <div className="flex items-center justify-between text-vos-xs mb-1">
        <span className="text-vos-text-2 font-mono">{label}</span>
        <span className="text-vos-text-3">{usedLabel} · {fmtPct(clamped)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-vos-glass-2 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%`, transition: 'width 600ms ease-out' }} />
      </div>
    </div>
  );
}

function CoreBar({ name, pct, freq }: { name: string; pct: number; freq: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = clamped >= 90 ? 'bg-vos-danger' : clamped >= 70 ? 'bg-vos-warning' : 'bg-vos-accent';
  return (
    <div className="flex items-center gap-vos-2 text-vos-xs">
      <span className="text-vos-text-3 font-mono w-12 shrink-0">{name}</span>
      <div className="flex-1 h-1.5 rounded-full bg-vos-glass-2 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%`, transition: 'width 600ms ease-out' }} />
      </div>
      <span className="text-vos-text-3 w-12 text-right font-mono">{clamped.toFixed(0)}%</span>
      {freq > 0 && <span className="text-vos-text-3 w-16 text-right font-mono">{(freq / 1000).toFixed(1)}GHz</span>}
    </div>
  );
}

// ---------- DB panel ----------
function DbPanel() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, isFetching } = useSuperadminDbStats();

  if (isLoading && !data) {
    return (
      <Card elevation={2} className="rounded-vos-xl p-vos-8">
        <div className="flex items-center justify-center gap-vos-3 text-vos-text-3">
          <Spinner size="md" />
          <span className="text-vos-sm">{t('godMode.loadingDb', 'Loading database stats…')}</span>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card elevation={2} className="rounded-vos-xl p-vos-6">
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title={t('godMode.dbUnavailable', 'DB stats unavailable')}
          description={error?.message || t('godMode.noDataReturned', 'No data returned')}
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-vos-6">
      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center justify-between">
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.dbOverview', 'Database overview')}</h2>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={12} />} onClick={() => refetch()} loading={isFetching}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
        <div className="p-vos-6 grid grid-cols-2 gap-vos-3 text-vos-sm">
          <KV label={t('godMode.dbName', 'Database')} value={data.database.name} />
          <KV label={t('godMode.dbSize', 'Size')} value={fmtBytes(data.database.size_bytes)} />
          <KV label={t('godMode.poolSize', 'Pool size')} value={String(data.pool.size)} />
          <KV label={t('godMode.poolIdle', 'Pool idle')} value={String(data.pool.idle)} />
          <KV label={t('godMode.activeConnections', 'Active connections')} value={String(data.active_connections)} />
          <KV label={t('godMode.activeQueries', 'Active queries')} value={String(data.active_queries.length)} />
        </div>
      </Card>

      <Card elevation={2} className="rounded-vos-xl">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1">
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.activeQueries', 'Active queries')}</h2>
        </div>
        <div className="p-vos-6 max-h-96 overflow-y-auto space-y-vos-3 text-vos-sm">
          {data.active_queries.length === 0 && (
            <p className="text-vos-text-3 text-vos-xs">{t('godMode.noActiveQueries', 'No active queries.')}</p>
          )}
          {data.active_queries.map((q) => (
            <div key={q.pid} className="border border-vos-border-1 rounded-vos-md p-vos-3 text-vos-xs">
              <div className="flex items-center gap-vos-2 mb-1 flex-wrap">
                <Badge tone="default" size="sm">pid {q.pid}</Badge>
                {q.state && <Badge tone={q.state === 'active' ? 'success' : 'default'} size="sm">{q.state}</Badge>}
                {q.usename && <span className="text-vos-text-3 font-mono">{q.usename}</span>}
                {q.application_name && <span className="text-vos-text-3">{q.application_name}</span>}
                {q.client_addr && <span className="text-vos-text-3 font-mono">{q.client_addr}</span>}
              </div>
              <pre className="font-mono text-vos-text-2 whitespace-pre-wrap break-words">
                {q.query?.trim() || '(no query)'}
              </pre>
            </div>
          ))}
        </div>
      </Card>

      <Card elevation={2} className="rounded-vos-xl lg:col-span-2">
        <div className="px-vos-6 py-vos-5 border-b border-vos-border-1">
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.topTables', 'Top tables (by size)')}</h2>
        </div>
        <div className="p-vos-6 overflow-x-auto">
          <table className="w-full text-vos-sm">
            <thead>
              <tr className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 border-b border-vos-border-1">
                <th className="text-left py-vos-2 pr-vos-4">{t('godMode.colTable', 'Table')}</th>
                <th className="text-right py-vos-2 pr-vos-4">{t('godMode.colRows', 'Rows')}</th>
                <th className="text-right py-vos-2 pr-vos-4">{t('godMode.colSize', 'Size')}</th>
                <th className="text-right py-vos-2">{t('godMode.colIndexSize', 'Index size')}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_tables.map((t) => (
                <tr key={`${t.schema}.${t.name}`} className="border-b border-vos-border-1/50">
                  <td className="py-vos-2 pr-vos-4 font-mono text-vos-xs">
                    {t.schema}.{t.name}
                  </td>
                  <td className="py-vos-2 pr-vos-4 text-right font-mono text-vos-xs">{t.row_count.toLocaleString()}</td>
                  <td className="py-vos-2 pr-vos-4 text-right font-mono text-vos-xs">{fmtBytes(t.size_bytes)}</td>
                  <td className="py-vos-2 text-right font-mono text-vos-xs text-vos-text-3">{fmtBytes(t.index_size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------- Logs panel ----------
function LogsPanel() {
  const { t } = useTranslation();
  const [unit, setUnit] = useState('cybersec-saas.service');
  const [lines, setLines] = useState(300);
  const { data, isLoading, error, refetch, isFetching } = useSuperadminLogs(unit, lines);

  return (
    <Card elevation={2} className="rounded-vos-xl">
      <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center justify-between gap-vos-3 flex-wrap">
        <div className="flex items-center gap-vos-3 flex-wrap">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="bg-vos-glass-2 border border-vos-border-1 text-vos-text rounded-vos-md text-vos-sm px-vos-3 py-vos-2"
          >
            <option value="cybersec-saas.service">cybersec-saas</option>
            <option value="nginx.service">nginx</option>
            <option value="postgresql.service">postgresql</option>
            <option value="redis-server.service">redis</option>
            <option value="cybersec-monitor.service">cybersec-monitor</option>
          </select>
          <select
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            className="bg-vos-glass-2 border border-vos-border-1 text-vos-text rounded-vos-md text-vos-sm px-vos-3 py-vos-2"
          >
            <option value={100}>{t('godMode.linesN', '{{n}} lines', { n: 100 })}</option>
            <option value={300}>{t('godMode.linesN', '{{n}} lines', { n: 300 })}</option>
            <option value={1000}>{t('godMode.linesN', '{{n}} lines', { n: 1000 })}</option>
            <option value={2000}>{t('godMode.linesN', '{{n}} lines', { n: 2000 })}</option>
          </select>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={12} />} onClick={() => refetch()} loading={isFetching}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
        <span className="text-vos-xs text-vos-text-3">{t('godMode.autoRefresh', 'Auto-refresh every 5s')}</span>
      </div>
      <div className="p-vos-4">
        {isLoading && !data && (
          <div className="flex items-center justify-center py-vos-6">
            <Spinner size="md" />
          </div>
        )}
        {error && (
          <p className="text-vos-danger text-vos-sm p-vos-4">{error.message}</p>
        )}
        {data && (
          <pre className="bg-vos-bg-1 border border-vos-border-1 rounded-vos-md p-vos-4 text-vos-xs font-mono leading-relaxed text-vos-text-2 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">
            {data.output || t('godMode.noOutput', '(no output)')}
          </pre>
        )}
      </div>
    </Card>
  );
}

// ---------- Feature flags panel ----------
function FeatureFlagsPanel() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, isFetching } = useFeatureFlags();
  const upsert = useUpsertFeatureFlag();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const flags = useMemo<FeatureFlag[]>(() => data?.flags ?? [], [data]);

  return (
    <Card elevation={2} className="rounded-vos-xl">
      <div className="px-vos-6 py-vos-5 border-b border-vos-border-1 flex items-center justify-between flex-wrap gap-vos-3">
        <div>
          <h2 className="text-vos-md font-semibold text-vos-text">{t('godMode.featureFlags', 'Feature flags')}</h2>
          <p className="text-vos-xs text-vos-text-3 mt-0.5">
            {t('godMode.featureFlagsHint', 'Toggle experimental features and platform kill switches. All changes are audited.')}
          </p>
        </div>
        <div className="flex items-center gap-vos-2">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={12} />} onClick={() => refetch()} loading={isFetching}>
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={() => setShowCreate(true)}>
            {t('godMode.newFlag', 'New flag')}
          </Button>
        </div>
      </div>
      <div className="p-vos-6">
        {isLoading && !data && (
          <div className="flex items-center justify-center py-vos-6">
            <Spinner size="md" />
          </div>
        )}
        {error && <p className="text-vos-danger text-vos-sm">{error.message}</p>}
        {flags.length === 0 && !isLoading && (
          <EmptyState
            icon={<ToggleLeft size={20} />}
            title={t('godMode.noFlags', 'No feature flags yet')}
            description={t('godMode.noFlagsDesc', 'Click "New flag" to create the first one.')}
          />
        )}
        <div className="divide-y divide-vos-border-1">
          {flags.map((f) => (
            <FeatureFlagRow
              key={f.key}
              flag={f}
              onToggle={(next) =>
                upsert.mutate({ key: f.key, enabled: next, description: f.description ?? undefined })
              }
              busy={upsert.isPending && upsert.variables?.key === f.key}
            />
          ))}
        </div>
      </div>

      {/* Create flag modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} size="md">
        <ModalHeader title={t('godMode.newFlagTitle', 'New feature flag')} onClose={() => setShowCreate(false)} />
        <ModalBody>
          <div className="space-y-vos-4">
            <div>
              <label className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 block mb-1.5">
                {t('godMode.key', 'Key')}
              </label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="my_new_feature"
                autoFocus
              />
            </div>
            <div>
              <label className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 block mb-1.5">
                {t('common.description', 'Description')}
              </label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder={t('godMode.flagDescPlaceholder', 'What does this flag control?')}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreate(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!newKey.trim()}
            loading={upsert.isPending}
            onClick={async () => {
              await upsert.mutateAsync({ key: newKey.trim(), enabled: false, description: newDesc.trim() || undefined });
              setNewKey('');
              setNewDesc('');
              setShowCreate(false);
            }}
          >
            {t('godMode.createDisabled', 'Create (disabled)')}
          </Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
}

function FeatureFlagRow({
  flag,
  onToggle,
  busy,
}: {
  flag: FeatureFlag;
  onToggle: (next: boolean) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-vos-4 py-vos-4">
      <div className="min-w-0">
        <div className="flex items-center gap-vos-2 flex-wrap">
          <span className="font-mono text-vos-sm text-vos-text">{flag.key}</span>
          {flag.enabled ? (
            <Badge tone="success" size="sm">
              <CheckCircle2 size={11} className="mr-1" />
              {t('godMode.enabled', 'Enabled')}
            </Badge>
          ) : (
            <Badge tone="default" size="sm">{t('godMode.disabled', 'Disabled')}</Badge>
          )}
          {flag.key === 'platform_kill_switch' && (
            <Badge tone="danger" size="sm">{t('godMode.killSwitchBadge', 'Kill switch')}</Badge>
          )}
        </div>
        {flag.description && (
          <p className="text-vos-xs text-vos-text-3 mt-1 max-w-xl">{flag.description}</p>
        )}
        <p className="text-vos-xs text-vos-text-3 mt-1 font-mono">
          {t('godMode.updatedAt', 'updated {{at}}', { at: flag.updated_at })}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-vos-3">
        {busy && <Spinner size="sm" />}
        <Switch checked={flag.enabled} onCheckedChange={onToggle} disabled={busy} />
      </div>
    </div>
  );
}

// ---------- Kill switch modal ----------
function KillSwitchModal({
  open,
  onClose,
  currentlyEngaged,
}: {
  open: boolean;
  onClose: () => void;
  currentlyEngaged: boolean;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const toggle = useToggleKillSwitch();
  const targetState = !currentlyEngaged;
  const requiredConfirmation = targetState ? 'ENGAGE' : 'RELEASE';

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title={targetState ? t('godMode.killEngageTitle', 'Engage platform kill switch') : t('godMode.killReleaseTitle', 'Release platform kill switch')}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-vos-4">
          <div className="rounded-vos-md border border-vos-danger/30 bg-vos-danger/5 p-vos-4 text-vos-sm flex items-start gap-vos-3">
            <AlertTriangle size={18} className="text-vos-danger shrink-0 mt-0.5" />
            <p className="text-vos-text-2">
              {targetState
                ? t('godMode.killEngageWarn', 'Engaging the kill switch will block non-superadmin requests across the entire platform. All running scans, agents, and AI workers will refuse new work. This action is logged to the audit trail.')
                : t('godMode.killReleaseWarn', 'Releasing the kill switch will restore normal platform operation. This action is logged to the audit trail.')}
            </p>
          </div>
          <div>
            <label className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 block mb-1.5">
              {t('godMode.reason', 'Reason')} {targetState && <span className="text-vos-danger">{t('godMode.required', '(required)')}</span>}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={targetState ? t('godMode.reasonPlaceholderEngage', 'e.g. Security incident, suspected breach…') : t('godMode.reasonPlaceholderRelease', 'e.g. Incident resolved')}
            />
          </div>
          <div>
            <label className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 block mb-1.5">
              {t('godMode.typeToConfirmPrefix', 'Type')} <span className="font-mono text-vos-danger">{requiredConfirmation}</span> {t('godMode.typeToConfirmSuffix', 'to confirm')}
            </label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          variant="danger"
          loading={toggle.isPending}
          disabled={confirmText !== requiredConfirmation || (targetState && !reason.trim())}
          onClick={async () => {
            await toggle.mutateAsync({ engaged: targetState, reason: reason.trim() || undefined });
            setReason('');
            setConfirmText('');
            onClose();
          }}
        >
          {targetState ? t('godMode.killSwitch', 'Engage kill switch') : t('godMode.killSwitchRelease', 'Release kill switch')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ---------- Plans & Memberships panel ----------
const PLAN_TONE: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  trial: 'warning',
  starter: 'default',
  professional: 'info',
  enterprise: 'success',
};

function PlansPanel() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const orgs = useSuperadminOrganizations(search);
  const [editing, setEditing] = useState<SuperadminOrg | null>(null);

  const items = orgs.data?.organizations ?? [];
  const plans = orgs.data?.available_plans ?? ['trial', 'starter', 'professional', 'enterprise'];

  return (
    <Card className="p-vos-6">
      <div className="flex items-end justify-between gap-vos-4 mb-vos-4 flex-wrap">
        <div>
          <h2 className="text-vos-lg font-semibold text-vos-text">
            {t('godMode.plans.title', 'Plans & Memberships')}
          </h2>
          <p className="text-vos-sm text-vos-text-3">
            {t('godMode.plans.subtitle', 'Switch any organization to any plan. Changes are audit-logged.')}
          </p>
        </div>
        <div className="flex items-center gap-vos-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vos-text-3" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('godMode.plans.search', 'Search org / email')}
              className="pl-8 w-64"
            />
          </div>
          <Button variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => orgs.refetch()}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {orgs.isLoading && <Spinner />}
      {orgs.error && (
        <div className="text-vos-sm text-vos-danger">{(orgs.error as Error).message}</div>
      )}

      {!orgs.isLoading && items.length === 0 && (
        <EmptyState
          icon={<Crown size={20} />}
          title={t('godMode.plans.empty', 'No organizations found')}
          description={t('godMode.plans.emptyDesc', 'Try a different search.')}
        />
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-vos-md border border-vos-border-1">
          <table className="w-full text-vos-sm">
            <thead className="bg-vos-surface-2 text-vos-text-3">
              <tr>
                <th className="text-left px-vos-3 py-vos-2">{t('common.organization', 'Organization')}</th>
                <th className="text-left px-vos-3 py-vos-2">{t('godMode.plans.owner', 'Owner')}</th>
                <th className="text-left px-vos-3 py-vos-2">{t('godMode.plans.members', 'Members')}</th>
                <th className="text-left px-vos-3 py-vos-2">{t('godMode.plans.plan', 'Current plan')}</th>
                <th className="text-left px-vos-3 py-vos-2">{t('godMode.plans.created', 'Created')}</th>
                <th className="text-right px-vos-3 py-vos-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-t border-vos-border-1 hover:bg-vos-surface-2/40">
                  <td className="px-vos-3 py-vos-2">
                    <div className="font-medium text-vos-text">{o.name}</div>
                    <div className="text-vos-xs text-vos-text-3 font-mono">{o.slug}</div>
                  </td>
                  <td className="px-vos-3 py-vos-2 text-vos-text-2">{o.owner_email ?? '—'}</td>
                  <td className="px-vos-3 py-vos-2 text-vos-text-2">{o.member_count}</td>
                  <td className="px-vos-3 py-vos-2">
                    <Badge tone={PLAN_TONE[o.plan_type] ?? 'neutral'} size="sm">
                      {o.plan_type}
                    </Badge>
                  </td>
                  <td className="px-vos-3 py-vos-2 text-vos-xs text-vos-text-3">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-vos-3 py-vos-2 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(o)}>
                      {t('godMode.plans.change', 'Change plan')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ChangePlanModal
        org={editing}
        plans={plans}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

function ChangePlanModal({
  org,
  plans,
  onClose,
}: {
  org: SuperadminOrg | null;
  plans: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const change = useChangeOrgPlan();
  const [target, setTarget] = useState<string>('starter');
  const [reason, setReason] = useState<string>('');

  // Reset form when a different org opens
  useEffect(() => {
    if (org) {
      setTarget(org.plan_type);
      setReason('');
    }
  }, [org]);

  if (!org) return null;

  const submit = async () => {
    if (!target || target === org.plan_type) {
      onClose();
      return;
    }
    await change.mutateAsync({ org_id: org.id, plan_type: target, reason: reason.trim() || undefined });
    onClose();
  };

  return (
    <Modal open={!!org} onClose={onClose}>
      <ModalHeader>
        {t('godMode.plans.changeFor', 'Change plan for')} <span className="font-mono text-vos-text">{org.name}</span>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-vos-4">
          <div>
            <div className="text-vos-xs text-vos-text-3 mb-1">{t('godMode.plans.currentPlan', 'Current plan')}</div>
            <Badge tone={PLAN_TONE[org.plan_type] ?? 'neutral'}>{org.plan_type}</Badge>
          </div>
          <div>
            <label className="text-vos-xs text-vos-text-3 block mb-1">{t('godMode.plans.newPlan', 'New plan')}</label>
            <div className="flex flex-wrap gap-vos-2">
              {plans.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTarget(p)}
                  className={`px-vos-3 py-vos-2 rounded-vos-md border text-vos-sm font-medium capitalize transition-colors ${
                    target === p
                      ? 'border-vos-accent bg-vos-accent/10 text-vos-accent'
                      : 'border-vos-border-1 text-vos-text-2 hover:bg-vos-surface-2'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-vos-xs text-vos-text-3 block mb-1">{t('godMode.plans.reason', 'Reason (optional, audited)')}</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={t('godMode.plans.reasonPh', 'e.g. customer upgrade request, comp account, abuse downgrade...')}
            />
          </div>
          {change.error && (
            <div className="text-vos-sm text-vos-danger">{(change.error as Error).message}</div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={change.isPending || target === org.plan_type}
          leftIcon={change.isPending ? <Spinner size="sm" /> : <CheckCircle2 size={14} />}
        >
          {target === org.plan_type
            ? t('godMode.plans.noChange', 'No change')
            : t('godMode.plans.apply', 'Apply change')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
