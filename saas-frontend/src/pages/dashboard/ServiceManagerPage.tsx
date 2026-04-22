import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ServiceManagerDashboard, ServiceState, ServiceAlert } from '../../services/api';
import { toast } from 'react-hot-toast';
import { useDocumentTitle } from '../../hooks/useUtilities';

// ================================
// STATUS COLORS & ICONS
// ================================

const statusColors: Record<string, string> = {
  running: 'bg-green-500',
  stopped: 'bg-red-500',
  starting: 'bg-yellow-500',
  stopping: 'bg-yellow-500',
  failed: 'bg-red-600',
  degraded: 'bg-orange-500',
  unknown: 'bg-gray-500',
};

const statusDots: Record<string, string> = {
  running: 'bg-green-400 animate-pulse',
  stopped: 'bg-red-400',
  failed: 'bg-red-500 animate-pulse',
  degraded: 'bg-orange-400 animate-pulse',
};

const categoryColors: Record<string, string> = {
  core: 'text-cyan-400 bg-cyan-500/10',
  backend: 'text-blue-400 bg-blue-500/10',
  frontend: 'text-purple-400 bg-purple-500/10',
  database: 'text-yellow-400 bg-yellow-500/10',
  cache: 'text-red-400 bg-red-500/10',
  monitoring: 'text-green-400 bg-green-500/10',
  security: 'text-orange-400 bg-orange-500/10',
  network: 'text-indigo-400 bg-indigo-500/10',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(secs: number | null): string {
  if (!secs) return '-';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ================================
// MAIN PAGE COMPONENT
// ================================

export default function ServiceManagerPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('serviceManager.title', 'Service Manager')} — CyberSec Pro`);
  const [dashboard, setDashboard] = useState<ServiceManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceState | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.getServiceManagerDashboard();
      if (res.data) setDashboard(res.data);
    } catch {
      // Silently fail on refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    if (!autoRefresh) return;
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard, autoRefresh]);

  const handleAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${serviceId}-${action}`);
    try {
      const res = await api.serviceAction(serviceId, action);
      if (res.data?.success) {
        toast.success(`${action} ${serviceId} — ${res.data.message}`);
        setTimeout(fetchDashboard, 2000);
      } else {
        toast.error(res.error || t('serviceManager.actionFailed', 'Action failed'));
      }
    } catch {
      toast.error(t('serviceManager.unavailable', 'Service manager unavailable'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      fetchDashboard();
    } catch {
      toast.error(t('serviceManager.acknowledgeFailed', 'Failed to acknowledge alert'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-gray-400">{t('serviceManager.connecting', 'Connecting to Service Manager...')}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-xl font-bold text-white mb-2">{t('serviceManager.offline', 'Service Manager Offline')}</h3>
          <p className="text-gray-400">{t('serviceManager.offlineDesc', 'The Rust service manager daemon is not responding on port 9000.')}</p>
          <button onClick={fetchDashboard} className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { system, services, alerts, summary } = dashboard;
  const activeAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Service Manager
            <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded font-mono">{t('serviceManager.rustVersion', 'RUST v1.0')}</span>
          </h1>
          <p className="text-gray-400 mt-1">
            {system.hostname} · {system.os} · Kernel {system.kernel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
              autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
          <button onClick={fetchDashboard} className="px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition">
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <SummaryCard
          label="Overall Health"
          value={summary.overall_health.toUpperCase()}
          color={summary.overall_health === 'healthy' ? 'text-green-400' : summary.overall_health === 'warning' ? 'text-yellow-400' : 'text-red-400'}
          icon={<HealthIcon health={summary.overall_health} />}
        />
        <SummaryCard label="Services" value={`${summary.running}/${summary.total_services}`} color="text-cyan-400" icon={<ServerIcon />} />
        <SummaryCard label="CPU" value={`${system.cpu_usage_percent.toFixed(1)}%`} color="text-blue-400" icon={<CpuIcon />} sub={`${system.cpu_count} cores · Load ${system.load_avg[0].toFixed(2)}`} />
        <SummaryCard label="Memory" value={`${system.memory_percent.toFixed(1)}%`} color="text-purple-400" icon={<MemoryIcon />} sub={`${system.memory_used_mb.toLocaleString()} / ${system.memory_total_mb.toLocaleString()} MB`} />
        <SummaryCard label="Disk" value={`${system.disk_percent.toFixed(1)}%`} color={system.disk_percent > 90 ? 'text-red-400' : 'text-green-400'} icon={<DiskIcon />} sub={`${system.disk_used_gb.toFixed(1)} / ${system.disk_total_gb.toFixed(1)} GB`} />
        <SummaryCard label="Uptime" value={summary.uptime_formatted} color="text-gray-300" icon={<UptimeIcon />} sub={`Net: ↓${formatBytes(system.network_rx_bytes)} ↑${formatBytes(system.network_tx_bytes)}`} />
      </div>

      {/* Alerts — collapsible */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-red-500/10 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-400">
                {activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${alertsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {alertsOpen && (
            <div className="px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto">
              {activeAlerts.map(alert => (
                <AlertBanner key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Services Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Services ({services.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(service => (
            <ServiceCard
              key={service.config.id}
              service={service}
              actionLoading={actionLoading}
              onAction={handleAction}
              onSelect={() => setSelectedService(service)}
            />
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

// ================================
// SUMMARY CARD
// ================================

function SummaryCard({ label, value, color, icon, sub }: { label: string; value: string; color: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-gray-500">{icon}</div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ================================
// SERVICE CARD
// ================================

function ServiceCard({
  service,
  actionLoading,
  onAction,
  onSelect,
}: {
  service: ServiceState;
  actionLoading: string | null;
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { config, status, pid, uptime_secs, cpu_percent, memory_mb, health_ok } = service;
  const isRunning = status === 'running';

  return (
    <div
      className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition cursor-pointer group"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusDots[status] || 'bg-gray-500'}`} />
          <h3 className="font-semibold text-white text-sm">{config.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${categoryColors[config.category] || 'text-gray-400 bg-gray-500/10'}`}>
            {config.category}
          </span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium text-white ${statusColors[status]}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-1">{config.description}</p>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500">{t('serviceManager.cpu', 'CPU')}</p>
          <p className={`text-sm font-mono font-bold ${cpu_percent > 80 ? 'text-red-400' : cpu_percent > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
            {cpu_percent.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500">{t('serviceManager.mem', 'MEM')}</p>
          <p className="text-sm font-mono font-bold text-blue-400">{memory_mb.toFixed(0)} MB</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500">{t('serviceManager.uptime', 'UPTIME')}</p>
          <p className="text-sm font-mono font-bold text-gray-300">{formatUptime(uptime_secs)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {pid && <span className="font-mono">PID {pid}</span>}
          {config.port && <span>:{config.port}</span>}
          {health_ok ? (
            <span className="text-green-400">● healthy</span>
          ) : isRunning ? (
            <span className="text-yellow-400">● degraded</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
          {isRunning ? (
            <>
              <ActionBtn label="Restart" color="yellow" loading={actionLoading === `${config.id}-restart`} onClick={() => onAction(config.id, 'restart')} />
              <ActionBtn label="Stop" color="red" loading={actionLoading === `${config.id}-stop`} onClick={() => onAction(config.id, 'stop')} />
            </>
          ) : (
            <ActionBtn label="Start" color="green" loading={actionLoading === `${config.id}-start`} onClick={() => onAction(config.id, 'start')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ================================
// ACTION BUTTON
// ================================

function ActionBtn({ label, color, loading, onClick }: { label: string; color: string; loading: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
    red: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-2 py-1 text-[10px] rounded font-medium transition ${colors[color] || colors.green} disabled:opacity-50`}
    >
      {loading ? '...' : label}
    </button>
  );
}

// ================================
// ALERT BANNER
// ================================

function AlertBanner({ alert, onAcknowledge }: { alert: ServiceAlert; onAcknowledge: (id: string) => void }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${severityColors[alert.severity]}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase">{alert.severity}</span>
        <span className="text-sm">{alert.message}</span>
        <span className="text-xs opacity-60">{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <button onClick={() => onAcknowledge(alert.id)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition">
        Acknowledge
      </button>
    </div>
  );
}

// ================================
// SERVICE DETAIL MODAL
// ================================

function ServiceDetailModal({
  service,
  onClose,
  onAction,
  actionLoading,
}: {
  service: ServiceState;
  onClose: () => void;
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void;
  actionLoading: string | null;
}) {
  const { t } = useTranslation();
  const { config, status, pid, uptime_secs, cpu_percent, memory_mb, restart_count, last_started, last_health_check, health_ok, error_message, logs_tail } = service;
  const isRunning = status === 'running';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusDots[status] || 'bg-gray-500'}`} />
              <h2 className="text-xl font-bold text-white">{config.name}</h2>
              <span className={`px-2 py-0.5 text-xs rounded-full text-white ${statusColors[status]}`}>{status}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{config.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DetailMetric label="PID" value={pid?.toString() || '-'} />
            <DetailMetric label="CPU" value={`${cpu_percent.toFixed(1)}%`} />
            <DetailMetric label="Memory" value={`${memory_mb.toFixed(1)} MB`} />
            <DetailMetric label="Uptime" value={formatUptime(uptime_secs)} />
            <DetailMetric label="Port" value={config.port?.toString() || '-'} />
            <DetailMetric label="Restarts" value={restart_count.toString()} />
            <DetailMetric label="Health" value={health_ok ? 'OK' : 'FAIL'} color={health_ok ? 'text-green-400' : 'text-red-400'} />
            <DetailMetric label="Priority" value={`P${config.priority}`} />
          </div>

          {/* Timestamps */}
          <div className="text-xs text-gray-500 space-y-1">
            {last_started && <p>Started: {new Date(last_started).toLocaleString()}</p>}
            {last_health_check && <p>Last check: {new Date(last_health_check).toLocaleString()}</p>}
          </div>

          {/* Error */}
          {error_message && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400">{error_message}</p>
            </div>
          )}

          {/* Logs */}
          {logs_tail.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">{t('serviceManager.recentLogs', 'Recent Logs')}</h3>
              <div className="bg-black/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-gray-400 space-y-0.5">
                {logs_tail.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {isRunning ? (
              <>
                <button
                  onClick={() => onAction(config.id, 'restart')}
                  disabled={actionLoading === `${config.id}-restart`}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition font-medium text-sm disabled:opacity-50"
                >
                  {actionLoading === `${config.id}-restart` ? 'Restarting...' : 'Restart'}
                </button>
                <button
                  onClick={() => onAction(config.id, 'stop')}
                  disabled={actionLoading === `${config.id}-stop`}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition font-medium text-sm disabled:opacity-50"
                >
                  {actionLoading === `${config.id}-stop` ? 'Stopping...' : 'Stop'}
                </button>
              </>
            ) : (
              <button
                onClick={() => onAction(config.id, 'start')}
                disabled={actionLoading === `${config.id}-start`}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition font-medium text-sm disabled:opacity-50"
              >
                {actionLoading === `${config.id}-start` ? 'Starting...' : 'Start'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-800/60 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-bold mt-0.5 ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}

// ================================
// SVG ICONS
// ================================

function HealthIcon({ health }: { health: string }) {
  const color = health === 'healthy' ? 'text-green-400' : health === 'warning' ? 'text-yellow-400' : 'text-red-400';
  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function DiskIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  );
}

function UptimeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
