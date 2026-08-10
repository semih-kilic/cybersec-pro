/**
 * 🛡️ AgentsPage — V20 "Onyx" rewrite
 *
 * Apple-grade fleet management for connected devices.
 * - PageHeader + StatCard summary
 * - DeviceGroup sections with status grouping (online/scanning/pending/offline/error)
 * - AgentCard: lucide platform icon + StatusPill + resource bars + scans + Test button
 * - Slide-out detail panel with KeyValueGrid sections + test results
 * - Add Device wizard (4-step), Edit Device modal, Network Discovery modal
 *
 * All business logic (React Query mutations, test results state) preserved.
 */
import React, { useState, useCallback } from 'react';
import {
  useAgentsDashboard,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useTestAgentConnection,
} from '../../hooks/useApiQueries';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useTranslation } from 'react-i18next';
import { AgentsPageSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { PageTransition } from '../../components/ui';
import { StatCard } from '../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Server,
  Terminal as TerminalIcon,
  AppWindow,
  Laptop,
  Container,
  Router as RouterIcon,
  ShieldAlert,
  Cloud,
  Network,
  HelpCircle,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Lock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Globe2,
  Loader2,
  ChevronRight,
  Power,
  PlayCircle,
  Clock,
  Download,
  Copy,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  StatusPill,
  Section,
  KeyValueGrid,
} from '../../components/vos';

/* ════════════════════════════════════════════════════════════ *
 *  TYPES
 * ════════════════════════════════════════════════════════════ */

interface Agent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: string;
  os: string;
  platform: string;
  version: string;
  last_seen: string;
  last_heartbeat: string;
  cpu_usage: number;
  memory_usage: number;
  active_scans: number;
  total_scans: number;
  location: string;
  connection_type: string;
  ssh_port: number;
  ssh_username: string;
}

interface TestResult {
  success: boolean;
  connection?: {
    type: string;
    host: string;
    port: number;
    username: string;
    latency_ms: number;
    ssh_banner: string;
  };
  system?: {
    hostname: string;
    os: string;
    kernel: string;
    uptime: string;
    cpu_cores: number;
    memory_total_mb: number;
    memory_used_mb: number;
    disk_total_gb: number;
    disk_used_gb: number;
    ip_addresses: string[];
  };
  diagnostics?: {
    tcp_port_reachable: boolean;
    host: string;
    port: number;
    hint: string;
  };
  error?: string;
  message?: string;
}

type WizardStep = 'type' | 'connection' | 'credentials' | 'review';
type QuickConnectOS = 'windows' | 'linux' | 'macos' | 'docker';

/* ════════════════════════════════════════════════════════════ *
 *  CONFIG
 * ════════════════════════════════════════════════════════════ */

const CONNECTION_TYPES: {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  desc: string;
}[] = [
  { id: 'ssh', name: 'SSH', icon: TerminalIcon, desc: 'Linux, macOS, routers, firewalls' },
  { id: 'reverse_tunnel', name: 'Reverse-tunnel agent', icon: Download, desc: 'You install our binary; works behind NAT/firewall, no inbound port required' },
  { id: 'winrm', name: 'WinRM', icon: AppWindow, desc: 'Windows servers and workstations' },
  { id: 'snmp', name: 'SNMP', icon: Network, desc: 'Switches, routers, printers' },
  { id: 'docker', name: 'Docker', icon: Container, desc: 'Container environments' },
  { id: 'cloud', name: 'Cloud API', icon: Cloud, desc: 'AWS, Azure, GCP' },
];

/* ════════════════════════════════════════════════════════════ *
 *  QUICK CONNECT MODAL — one-click agent install
 * ════════════════════════════════════════════════════════════ */

const QC_OS: { id: QuickConnectOS; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: 'windows', label: 'Windows', icon: AppWindow },
  { id: 'linux',   label: 'Linux',   icon: TerminalIcon },
  { id: 'macos',   label: 'macOS',   icon: Laptop },
  { id: 'docker',  label: 'Docker',  icon: Container },
];

function buildInstallCmd(os: QuickConnectOS, token: string): string {
  const api = (typeof window !== 'undefined' && window.location?.origin) || 'https://app.cyber-sec-pro.com';
  const t = token || 'YOUR_TOKEN';
  switch (os) {
    case 'windows':
      return `$env:CSP_TOKEN="${t}"; Invoke-Expression (Invoke-WebRequest -Uri "${api}/api/v1/agents/install.ps1" -UseBasicParsing).Content`;
    case 'docker':
      return `docker run -d --name cybersec-agent --restart=always -e CSP_TOKEN="${t}" -e CSP_API_URL="${api}" cybersecpro/cybersec-agent:latest`;
    default:
      return `curl -fsSL ${api}/api/v1/agents/install.sh | CSP_TOKEN="${t}" sh`;
  }
}

function QuickConnectModal({ onClose }: { onClose: () => void }) {
  const [os, setOs] = useState<QuickConnectOS>('windows');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [waitingOnline, setWaitingOnline] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const jwt = localStorage.getItem('token') || '';
      const res = await fetch('/api/v1/agents/enrollment-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) { setToken(data.token); return; }
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchToken().finally(() => setLoading(false)); }, [fetchToken]);

  const cmd = buildInstallCmd(os, token);

  const handleCopy = () => {
    try { navigator.clipboard.writeText(cmd); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Start polling for any online agent
    if (waitingOnline || agentOnline) return;
    setWaitingOnline(true);
    const start = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - start > 120_000) { clearInterval(poll); setWaitingOnline(false); return; }
      try {
        const jwt = localStorage.getItem('token') || '';
        const res = await fetch('/api/v1/agents', { headers: { Authorization: 'Bearer ' + jwt } });
        if (!res.ok) return;
        const data = await res.json();
        const agents: any[] = data?.agents || [];
        if (agents.some((a) => a.status === 'online')) {
          clearInterval(poll);
          setWaitingOnline(false);
          setAgentOnline(true);
        }
      } catch { /* noop */ }
    }, 3000);
  };

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">Quick Connect</p>
          <h2 className="text-vos-lg font-semibold text-vos-text">Add This Device</h2>
          <p className="text-vos-xs text-vos-text-3 mt-0.5">Copy the command below and run it on the device you want to connect</p>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <div className="px-vos-5 py-vos-5 space-y-vos-4">
        {/* OS Picker */}
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">Select OS</p>
          <div className="grid grid-cols-4 gap-vos-2">
            {QC_OS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setOs(id)}
                className={`flex flex-col items-center gap-1.5 py-vos-3 rounded-vos-md border transition-colors ${
                  os === id
                    ? 'border-vos-accent bg-vos-accent/10 text-vos-accent'
                    : 'border-vos-border-1 bg-vos-bg-elev-3 text-vos-text-2 hover:border-vos-border-2'
                }`}
              >
                <Icon size={20} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Command box */}
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
            {os === 'windows' ? 'Run in PowerShell (Admin)' : os === 'docker' ? 'Run in terminal' : 'Run in terminal'}
          </p>
          <div className="relative rounded-vos-md bg-vos-bg-elev-4 border border-vos-border-1 p-vos-3 pr-12">
            <code className="block text-[11px] font-mono text-vos-text break-all leading-relaxed">
              {loading ? 'Generating token…' : cmd}
            </code>
            <button
              onClick={handleCopy}
              disabled={loading || !token}
              className="absolute top-vos-2 right-vos-2 size-8 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 hover:text-vos-accent disabled:opacity-40 transition-colors"
              title="Copy"
            >
              {copied ? <CheckCircle2 size={14} className="text-vos-success" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Status */}
        {agentOnline ? (
          <div className="flex items-center gap-vos-2 p-vos-3 rounded-vos-md bg-vos-success/10 border border-vos-success/20">
            <CheckCircle2 size={16} className="text-vos-success shrink-0" />
            <div>
              <p className="text-vos-sm font-semibold text-vos-success">Agent connected!</p>
              <p className="text-vos-xs text-vos-text-3">Your device is now online and ready to scan.</p>
            </div>
          </div>
        ) : waitingOnline ? (
          <div className="flex items-center gap-vos-2 p-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1">
            <Loader2 size={14} className="animate-spin text-vos-accent shrink-0" />
            <p className="text-vos-xs text-vos-text-3">Waiting for agent to connect… (up to 2 min)</p>
          </div>
        ) : (
          <div className="flex items-start gap-vos-2 p-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1">
            <AlertCircle size={14} className="text-vos-info shrink-0 mt-0.5" />
            <p className="text-vos-xs text-vos-text-3 leading-relaxed">
              🔒 No firewall rules needed. The agent dials out over TLS and appears here within ~30 seconds.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-vos-5 py-vos-4 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
        <button
          onClick={onClose}
          className="h-9 px-vos-3 text-vos-xs font-medium text-vos-text-2 hover:text-vos-text"
        >
          {agentOnline ? 'Done' : 'Cancel'}
        </button>
        <button
          onClick={handleCopy}
          disabled={loading || !token}
          className="inline-flex items-center gap-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy Command'}
        </button>
      </div>
    </ModalShell>
  );
}

const PLATFORM_ICON: Record<
  string,
  React.ComponentType<{ size?: number | string; className?: string }>
> = {
  linux: TerminalIcon,
  windows: AppWindow,
  macos: Laptop,
  docker: Container,
  router: RouterIcon,
  firewall: ShieldAlert,
  network: Network,
  cloud: Cloud,
  server: Server,
  unknown: HelpCircle,
};

const STATUS_TONE: Record<
  string,
  { tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'; label: string; pulse?: boolean }
> = {
  online: { tone: 'success', label: 'Online', pulse: true },
  offline: { tone: 'neutral', label: 'Offline' },
  busy: { tone: 'warning', label: 'Scanning', pulse: true },
  error: { tone: 'danger', label: 'Error' },
  pending: { tone: 'info', label: 'Pending' },
};

const PLATFORMS = ['linux', 'windows', 'macos', 'router', 'firewall', 'docker'];

/* ════════════════════════════════════════════════════════════ *
 *  HELPERS
 * ════════════════════════════════════════════════════════════ */

function formatTimeSince(dateStr: string): string {
  try {
    const date = new Date(
      dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'),
    );
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + 'h ago';
    const diffDays = Math.floor(diffHours / 24);
    return diffDays + 'd ago';
  } catch {
    return 'Unknown';
  }
}

function useAuthToken() {
  const token = localStorage.getItem('token') || '';
  return { token };
}

/* ════════════════════════════════════════════════════════════ *
 *  SMALL COMPONENTS
 * ════════════════════════════════════════════════════════════ */

function ResourceBar({
  label,
  value,
  tone,
  showPercent,
}: {
  label: string;
  value: number;
  tone: 'accent' | 'info' | 'warning' | 'danger';
  showPercent?: boolean;
}) {
  const toneClass: Record<typeof tone, string> = {
    accent: 'bg-vos-accent',
    info: 'bg-vos-info',
    warning: 'bg-vos-warning',
    danger: 'bg-vos-danger',
  };
  return (
    <div className="flex items-center gap-vos-2 text-[10px]">
      <span className="text-vos-text-3 w-8 uppercase tracking-vos-wide font-semibold">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-vos-bg-elev-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${toneClass[tone]} rounded-full transition-all duration-500`}
          style={{ width: Math.min(100, Math.max(0, value)) + '%' }}
        />
      </div>
      {showPercent && (
        <span className="text-vos-text-2 w-9 text-right tabular-nums">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}

function WizardInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  AGENT CARD
 * ════════════════════════════════════════════════════════════ */

function AgentCard({
  agent,
  onSelect,
  onTest,
  isSelected,
  isTesting,
}: {
  agent: Agent;
  onSelect: () => void;
  onTest: () => void;
  isSelected: boolean;
  isTesting: boolean;
}) {
  const { t } = useTranslation();
  const status = STATUS_TONE[agent.status] || STATUS_TONE.offline;
  const PlatformIcon = PLATFORM_ICON[agent.platform] || PLATFORM_ICON.unknown;
  const timeSince = agent.last_heartbeat
    ? formatTimeSince(agent.last_heartbeat)
    : 'Never';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onSelect}
      className={`relative cursor-pointer rounded-vos-xl border p-vos-4 transition-colors ${
        isSelected
          ? 'border-vos-accent/60 bg-vos-accent/5 shadow-vos-elev-2'
          : 'border-vos-border-1 bg-vos-bg-elev-2 hover:border-vos-border-2'
      }`}
    >
      <div className="absolute top-vos-3 right-vos-3">
        <StatusPill tone={status.tone} pulse={status.pulse}>
          {status.label}
        </StatusPill>
      </div>

      <div className="flex items-center gap-vos-3 mb-vos-3 pr-20">
        <span className="size-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 shrink-0">
          <PlatformIcon size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-vos-sm font-semibold text-vos-text truncate">
            {agent.name}
          </h3>
          <p className="text-vos-xs text-vos-text-3 truncate">
            {agent.hostname || agent.ip_address || 'No host'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-vos-3 gap-y-1 mb-vos-3 text-[11px]">
        <KV label="IP" value={agent.ip_address || 'N/A'} mono />
        <KV label="OS" value={agent.os || agent.platform} truncate />
        <KV label="Port" value={String(agent.ssh_port || 22)} mono />
        <KV label="Seen" value={timeSince} />
      </div>

      {agent.status === 'online' && (
        <div className="space-y-1.5 mb-vos-3">
          <ResourceBar label={t('agents.detailCPU', 'CPU')} value={agent.cpu_usage} tone="accent" />
          <ResourceBar label="RAM" value={agent.memory_usage} tone="info" />
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-vos-text-3 mb-vos-3">
        <span className="tabular-nums">{agent.total_scans} scans</span>
        {agent.active_scans > 0 && (
          <span className="text-vos-warning font-medium tabular-nums">
            {agent.active_scans} active
          </span>
        )}
      </div>

      {agent.connection_type !== 'reverse_tunnel' && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTest();
        }}
        disabled={isTesting}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-vos-sm border border-vos-accent/30 text-vos-accent text-vos-xs font-medium hover:bg-vos-accent/10 disabled:opacity-50"
      >
        {isTesting ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            {t('agents.connecting', 'Connecting…')}
          </>
        ) : (
          <>
            <Zap size={11} />
            {t('agents.testConnection', 'Test Connection')}
          </>
        )}
      </button>
      )}
    </motion.div>
  );
}

function KV({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-vos-text-3">{label}</span>
      <span
        className={`text-vos-text-2 ${mono ? 'font-mono' : ''} ${
          truncate ? 'truncate' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  REVERSE-TUNNEL AGENT PANEL
 *  Shows per-OS download links + a one-time enrollment token.
 *  The agent binary dials our hub over TLS — no inbound port needed.
 * ════════════════════════════════════════════════════════════ */

const AGENT_VERSION = 'v1';
const AGENT_BASE_URL =
  (typeof window !== 'undefined' && window.location?.origin) || 'https://app.cyber-sec-pro.com';

const RT_DOWNLOADS: Record<string, { label: string; url: string; install: string }> = {
  linux: {
    label: 'Linux (x86_64 / arm64 — auto-detected)',
    url: `${AGENT_BASE_URL}/api/v1/agents/install.sh`,
    install: `curl -fsSL ${AGENT_BASE_URL}/api/v1/agents/install.sh | CSP_TOKEN=__TOKEN__ sh`,
  },
  macos: {
    label: 'macOS (universal — coming soon, use Docker)',
    url: `${AGENT_BASE_URL}/api/v1/agents/install.sh`,
    install: `curl -fsSL ${AGENT_BASE_URL}/api/v1/agents/install.sh | CSP_TOKEN=__TOKEN__ sh`,
  },
  windows: {
    label: 'Windows (x86_64)',
    url: `${AGENT_BASE_URL}/api/v1/agents/install.ps1`,
    install: `$env:CSP_TOKEN="__TOKEN__"; iwr ${AGENT_BASE_URL}/api/v1/agents/install.ps1 -useb | iex`,
  },
  docker: {
    label: 'Docker',
    url: 'https://hub.docker.com/r/cybersecpro/cybersec-agent',
    install: `docker run -d --name cybersec-agent --restart=always -e CSP_TOKEN=__TOKEN__ cybersecpro/cybersec-agent:${AGENT_VERSION}`,
  },
};

function ReverseTunnelPanel({ platform, compact }: { platform: string; compact?: boolean }) {
  const { t } = useTranslation();
  const key = (platform || 'linux').toLowerCase();
  const dl = RT_DOWNLOADS[key] || RT_DOWNLOADS.linux;
  // Fetch a short-lived enrollment JWT from the backend (HS256, 24h, scoped to org).
  // Falls back to a client-generated UUID if the user is unauthenticated or the
  // endpoint is unreachable, so the wizard preview never blocks.
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    const fallback = () => {
      try { return crypto.randomUUID().replace(/-/g, '').slice(0, 32); }
      catch { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    };
    try {
      const jwt = localStorage.getItem('token') || '';
      const res = await fetch('/api/v1/agents/enrollment-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.token === 'string' && data.token.length > 0) {
          setToken(data.token);
          if (typeof data.expires_at === 'number') setExpiresAt(data.expires_at);
          setLoading(false);
          return;
        }
      }
      setToken(fallback());
    } catch {
      setToken(fallback());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchToken(); }, [fetchToken]);

  const installCmd = dl.install.replace('__TOKEN__', token || '__TOKEN__');
  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* noop */ }
  };
  const expiresLabel = expiresAt
    ? new Date(expiresAt * 1000).toLocaleString()
    : '24h';
  return (
    <div className={`rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-3 p-vos-3 space-y-vos-2 ${compact ? '' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-vos-xs font-semibold text-vos-text-2 uppercase tracking-vos-wide">
          {t('agents.reverseTunnelAgent', 'Reverse-tunnel agent')} — {dl.label}
        </div>
        <a
          href={dl.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-vos-accent hover:underline"
        >
          <Download size={12} /> {t('agents.directDownload', 'Direct download')}
        </a>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-vos-wide text-vos-text-3">
          {t('agents.enrollmentToken', 'One-time enrollment token (expires {{expires}})', { expires: expiresLabel })}
        </label>
        <div className="mt-1 flex items-stretch gap-1">
          <code className="flex-1 truncate rounded-vos-sm bg-vos-bg-elev-4 px-2 py-1.5 text-[11px] text-vos-text font-mono">
            {loading ? t('agents.issuingToken', 'Issuing token…') : token}
          </code>
          <button
            type="button"
            onClick={() => copy(token)}
            disabled={loading || !token}
            className="inline-flex items-center gap-1 rounded-vos-sm bg-vos-bg-elev-4 px-2 text-[11px] text-vos-text-2 hover:text-vos-text disabled:opacity-50"
            title={t('agents.copyToken', 'Copy token')}
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            onClick={fetchToken}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-vos-sm bg-vos-bg-elev-4 px-2 text-[11px] text-vos-text-2 hover:text-vos-text disabled:opacity-50"
            title={t('agents.regenerate', 'Regenerate')}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-vos-wide text-vos-text-3">
          {t('agents.installCommand', 'Install command')}
        </label>
        <div className="mt-1 flex items-stretch gap-1">
          <code className="flex-1 overflow-x-auto rounded-vos-sm bg-vos-bg-elev-4 px-2 py-1.5 text-[11px] text-vos-text font-mono whitespace-pre">
            {installCmd}
          </code>
          <button
            type="button"
            onClick={() => copy(installCmd)}
            className="inline-flex items-center gap-1 rounded-vos-sm bg-vos-bg-elev-4 px-2 text-[11px] text-vos-text-2 hover:text-vos-text"
            title={t('agents.copy', 'Copy')}
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-vos-text-3 leading-relaxed">
        {t('agents.reverseTunnelHint', '🔒 The agent dials our hub over TLS 1.3, authenticates with this token, and tunnels scan jobs back through the same connection. No inbound firewall rule is required and the token expires automatically. Credentials you supply per scan are never stored on our side.')}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  ADD DEVICE WIZARD
 * ════════════════════════════════════════════════════════════ */

function AddDeviceWizard({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>('type');
  const [connType, setConnType] = useState('ssh');
  const [form, setForm] = useState({
    name: '',
    ssh_host: '',
    ssh_port: 22,
    ssh_username: 'root',
    ssh_password: '',
    platform: 'linux',
    network_zone: 'internal',
    location: '',
  });
  const updateForm = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const steps: { id: WizardStep; label: string; num: number }[] = [
    { id: 'type', label: t('agents.stepConnection', 'Connection'), num: 1 },
    { id: 'connection', label: t('agents.stepHostDetails', 'Host Details'), num: 2 },
    { id: 'credentials', label: t('agents.stepCredentials', 'Credentials'), num: 3 },
    { id: 'review', label: t('agents.stepConfirm', 'Confirm'), num: 4 },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  const isReverseTunnel = connType === 'reverse_tunnel';
  const canNext = () => {
    if (step === 'type') return true;
    if (step === 'connection') {
      if (isReverseTunnel) return form.name.trim().length > 0;
      return form.ssh_host.trim().length > 0 && form.name.trim().length > 0;
    }
    if (step === 'credentials') return form.ssh_username.trim().length > 0;
    return true;
  };
  const handleNext = () => {
    // Reverse-tunnel agents skip the credentials step entirely (the agent
    // authenticates with a one-time enrollment token, no SSH creds needed).
    if (isReverseTunnel && step === 'connection') {
      setStep('review');
      return;
    }
    if (currentIdx < steps.length - 1) setStep(steps[currentIdx + 1].id);
  };
  const handleBack = () => {
    if (isReverseTunnel && step === 'review') {
      setStep('connection');
      return;
    }
    if (currentIdx > 0) setStep(steps[currentIdx - 1].id);
  };

  const handleCreate = () => {
    onCreate({
      name: form.name,
      connection_type: connType,
      ssh_host: form.ssh_host,
      ssh_port: form.ssh_port,
      ssh_username: form.ssh_username,
      ssh_password: form.ssh_password,
      platform: form.platform,
      network_zone: form.network_zone,
      location: form.location,
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
            Workflow
          </p>
          <h2 className="text-vos-lg font-semibold text-vos-text">
            {t('agents.addDeviceTitle', 'Add Device')}
          </h2>
          <p className="text-vos-xs text-vos-text-3 mt-0.5">
            {t(
              'agents.addDeviceSubtitle',
              'Connect a new device to your security network',
            )}
          </p>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <Stepper steps={steps} currentIdx={currentIdx} />

      <div className="px-vos-5 py-vos-4 min-h-[280px]">
        <AnimatePresence mode="wait">
          {step === 'type' && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-vos-2"
            >
              {CONNECTION_TYPES.map((ct) => {
                const Icon = ct.icon;
                const active = connType === ct.id;
                return (
                  <button
                    key={ct.id}
                    onClick={() => setConnType(ct.id)}
                    className={`w-full flex items-center gap-vos-3 p-vos-3 rounded-vos-md border transition-colors text-left ${
                      active
                        ? 'border-vos-accent bg-vos-accent/5'
                        : 'border-vos-border-1 bg-vos-bg-elev-3 hover:border-vos-border-2'
                    }`}
                  >
                    <span
                      className={`size-9 rounded-vos-md flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-vos-accent/15 text-vos-accent'
                          : 'bg-vos-bg-elev-4 text-vos-text-2'
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-vos-sm font-semibold text-vos-text">
                        {ct.name}
                      </div>
                      <div className="text-vos-xs text-vos-text-3 truncate">
                        {ct.desc}
                      </div>
                    </div>
                    {active && <CheckCircle2 size={14} className="text-vos-accent" />}
                  </button>
                );
              })}
            </motion.div>
          )}

          {step === 'connection' && isReverseTunnel && (
            <motion.div
              key="conn-rt"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-vos-3"
            >
              <WizardInput
                label={t('agents.labelDeviceName', 'Device Name')}
                placeholder={t('agents.placeholderLaptopBehindNAT', 'e.g. Laptop behind NAT')}
                value={form.name}
                onChange={(v) => updateForm('name', v)}
              />
              <PlatformPicker
                value={form.platform}
                onChange={(v) => updateForm('platform', v)}
              />
              <ReverseTunnelPanel platform={form.platform} />
            </motion.div>
          )}

          {step === 'connection' && !isReverseTunnel && (
            <motion.div
              key="conn"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-vos-3"
            >
              <WizardInput
                label={t('agents.labelDeviceName', 'Device Name')}
                placeholder={t('agents.placeholderProductionServer', 'e.g. Production Server')}
                value={form.name}
                onChange={(v) => updateForm('name', v)}
              />
              <div className="grid grid-cols-3 gap-vos-3">
                <div className="col-span-2">
                  <WizardInput
                    label={t('agents.labelHostIP', 'Host / IP')}
                    placeholder="10.0.0.115 or hostname"
                    value={form.ssh_host}
                    onChange={(v) => updateForm('ssh_host', v)}
                  />
                </div>
                <WizardInput
                  label={t('agents.labelPort', 'Port')}
                  placeholder="22"
                  value={String(form.ssh_port)}
                  onChange={(v) => updateForm('ssh_port', parseInt(v) || 22)}
                  type="number"
                />
              </div>
              <PlatformPicker
                value={form.platform}
                onChange={(v) => updateForm('platform', v)}
              />
              <WizardInput
                label={t('agents.labelLocationOptional', 'Location (optional)')}
                placeholder={t('agents.placeholderLocationExample', 'e.g. Office HQ, DC-1, Cloud-EU')}
                value={form.location}
                onChange={(v) => updateForm('location', v)}
              />
            </motion.div>
          )}

          {step === 'credentials' && !isReverseTunnel && (
            <motion.div
              key="cred"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-vos-3"
            >
              <WizardInput
                label={t('agents.labelUsername', 'Username')}
                placeholder={t("agents.placeholderRoot", "root")}
                value={form.ssh_username}
                onChange={(v) => updateForm('ssh_username', v)}
              />
              <WizardInput
                label={t('agents.labelPassword', 'Password')}
                placeholder={t("agents.placeholderPassword", "password")}
                value={form.ssh_password}
                onChange={(v) => updateForm('ssh_password', v)}
                type="password"
              />
              <div className="rounded-vos-md bg-vos-info/5 border border-vos-info/20 p-vos-3 flex items-start gap-vos-2">
                <Lock size={12} className="text-vos-info mt-0.5 shrink-0" />
                <p className="text-vos-xs text-vos-info">
                  Password is encrypted with AES-256-GCM before storage. SSH key auth
                  coming soon.
                </p>
              </div>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-vos-3"
            >
              <div className="rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 p-vos-4">
                <KeyValueGrid
                  cols={2}
                  items={
                    isReverseTunnel
                      ? [
                          { label: 'Name', value: form.name || '—' },
                          { label: t('common.type', 'Type'), value: 'Reverse-tunnel agent' },
                          { label: t('agents.detailPlatform', 'Platform'), value: form.platform },
                          { label: 'Inbound port', value: 'None required', mono: true },
                          { label: 'Auth', value: 'One-time enrollment token', mono: true },
                        ]
                      : [
                          { label: 'Name', value: form.name || '—' },
                          {
                            label: t('common.type', 'Type'),
                            value:
                              CONNECTION_TYPES.find((c) => c.id === connType)?.name || connType,
                          },
                          { label: 'Host', value: `${form.ssh_host}:${form.ssh_port}`, mono: true },
                          {
                            label: t('agents.labelUsername', 'Username'),
                            value: form.ssh_username,
                            mono: true,
                          },
                          {
                            label: t('agents.labelPassword', 'Password'),
                            value: form.ssh_password ? '••••••••' : 'Not set',
                          },
                          {
                            label: t('agents.detailPlatform', 'Platform'),
                            value: form.platform,
                          },
                          ...(form.location
                            ? [{ label: t('agents.labelLocation', 'Location'), value: form.location }]
                            : []),
                        ]
                  }
                />
              </div>
              {isReverseTunnel && <ReverseTunnelPanel platform={form.platform} compact />}
              <p className="text-vos-xs text-vos-text-3 text-center">
                {isReverseTunnel
                  ? t(
                      'agents.reviewHintRT',
                      'After creating, run the install command on the device. The agent will dial home over TLS and appear online here within ~30s.',
                    )
                  : t(
                      'agents.reviewHint',
                      'After creating, use Test Connection to verify SSH access and auto-detect system info.',
                    )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-vos-5 py-vos-4 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
        <button
          onClick={step === 'type' ? onClose : handleBack}
          className="h-9 px-vos-3 text-vos-xs font-medium text-vos-text-2 hover:text-vos-text"
        >
          {step === 'type' ? t('common.cancel', 'Cancel') : t('agents.back', 'Back')}
        </button>
        {step === 'review' ? (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90"
          >
            <Plus size={13} />
            Create Device
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canNext()}
            className="inline-flex items-center gap-2 h-9 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-xs font-medium hover:bg-vos-bg-elev-4 disabled:opacity-40"
          >
            Next
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function Stepper({
  steps,
  currentIdx,
}: {
  steps: { id: string; label: string; num: number }[];
  currentIdx: number;
}) {
  return (
    <div className="px-vos-5 pt-vos-4 flex items-center gap-1">
      {steps.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div
              className={`flex items-center justify-center size-6 rounded-full text-[10px] font-bold transition-colors ${
                active
                  ? 'bg-vos-accent text-white'
                  : done
                    ? 'bg-vos-success/20 text-vos-success border border-vos-success/30'
                    : 'bg-vos-bg-elev-3 text-vos-text-3 border border-vos-border-1'
              }`}
            >
              {done ? <CheckCircle2 size={11} /> : s.num}
            </div>
            <span
              className={`ml-1.5 text-[10px] font-medium ${
                active ? 'text-vos-accent' : 'text-vos-text-3'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-vos-border-1 mx-vos-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlatformPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
        {t('agents.labelPlatform', 'Platform')}
      </label>
      <div className="flex gap-1.5 flex-wrap">
        {PLATFORMS.map((p) => {
          const Icon = PLATFORM_ICON[p] || HelpCircle;
          const active = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-sm border text-vos-xs font-medium transition-colors ${
                active
                  ? 'border-vos-accent bg-vos-accent/10 text-vos-accent'
                  : 'border-vos-border-1 bg-vos-bg-elev-3 text-vos-text-2 hover:text-vos-text'
              }`}
            >
              <Icon size={11} />
              <span className="capitalize">{p}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  EDIT DEVICE MODAL
 * ════════════════════════════════════════════════════════════ */

function EditDeviceModal({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: agent.name || '',
    ssh_host: agent.ip_address || '',
    ssh_port: agent.ssh_port || 22,
    ssh_username: agent.ssh_username || 'root',
    ssh_password: '',
    platform: agent.platform || 'linux',
    location: agent.location || '',
    hostname: agent.hostname || '',
    connection_type: agent.connection_type || 'ssh',
  });
  const updateForm = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const data: Record<string, unknown> = {
      name: form.name,
      ssh_host: form.ssh_host,
      ssh_port: form.ssh_port,
      ssh_username: form.ssh_username,
      platform: form.platform,
      location: form.location,
      hostname: form.hostname,
      connection_type: form.connection_type,
    };
    if (form.ssh_password.trim()) data.ssh_password = form.ssh_password;
    onSave(agent.id, data);
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
            Configuration
          </p>
          <h2 className="text-vos-lg font-semibold text-vos-text">
            {t('agents.editDeviceTitle', 'Edit Device')}
          </h2>
          <p className="text-vos-xs text-vos-text-3 mt-0.5">
            Update connection settings for {agent.name}
          </p>
        </div>
        <ModalClose onClose={onClose} />
      </div>
      <div className="px-vos-5 py-vos-4 space-y-vos-3 max-h-[60vh] overflow-y-auto">
        <WizardInput
          label={t('agents.labelDeviceName', 'Device Name')}
          placeholder={t('agents.placeholderProductionServer', 'e.g. Production Server')}
          value={form.name}
          onChange={(v) => updateForm('name', v)}
        />
        <WizardInput
          label={t('agents.labelHostname', 'Hostname')}
          placeholder={t("agents.placeholderServer", "server.local")}
          value={form.hostname}
          onChange={(v) => updateForm('hostname', v)}
        />
        <div className="grid grid-cols-3 gap-vos-3">
          <div className="col-span-2">
            <WizardInput
              label={t('agents.labelSSHHostIP', 'SSH Host / IP')}
              placeholder="10.0.0.115"
              value={form.ssh_host}
              onChange={(v) => updateForm('ssh_host', v)}
            />
          </div>
          <WizardInput
            label={t('agents.labelPort', 'Port')}
            placeholder="22"
            value={String(form.ssh_port)}
            onChange={(v) => updateForm('ssh_port', parseInt(v) || 22)}
            type="number"
          />
        </div>
        <WizardInput
          label={t('agents.labelUsername', 'Username')}
          placeholder={t("agents.placeholderRoot", "root")}
          value={form.ssh_username}
          onChange={(v) => updateForm('ssh_username', v)}
        />
        <WizardInput
          label={t('agents.labelNewPassword', 'New Password (leave blank to keep)')}
          placeholder={t('agents.placeholderLeaveBlank', 'leave blank to keep current')}
          value={form.ssh_password}
          onChange={(v) => updateForm('ssh_password', v)}
          type="password"
        />
        <PlatformPicker
          value={form.platform}
          onChange={(v) => updateForm('platform', v)}
        />
        <WizardInput
          label={t('agents.labelLocation', 'Location')}
          placeholder={t('agents.placeholderLocationShort', 'e.g. Office HQ, DC-1')}
          value={form.location}
          onChange={(v) => updateForm('location', v)}
        />
      </div>
      <div className="flex items-center justify-between px-vos-5 py-vos-4 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
        <button
          onClick={onClose}
          className="h-9 px-vos-3 text-vos-xs font-medium text-vos-text-2 hover:text-vos-text"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90"
        >
          {t('agents.saveChanges', 'Save Changes')}
        </button>
      </div>
    </ModalShell>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  DEVICE DETAIL PANEL
 * ════════════════════════════════════════════════════════════ */

function DeviceDetail({
  agent,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onDelete,
  onClose,
}: {
  agent: Agent;
  testResult: TestResult | null;
  isTesting: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const status = STATUS_TONE[agent.status] || STATUS_TONE.offline;
  const PlatformIcon = PLATFORM_ICON[agent.platform] || HelpCircle;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="h-full flex flex-col"
    >
      <div className="px-vos-5 py-vos-4 border-b border-vos-border-1 flex items-center justify-between">
        <div className="flex items-center gap-vos-3 min-w-0">
          <span className="size-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 shrink-0">
            <PlatformIcon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-vos-sm font-bold text-vos-text truncate">
              {agent.name}
            </h3>
            <p className="text-vos-xs text-vos-text-3 truncate">
              {agent.hostname || 'No hostname'}
            </p>
          </div>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto px-vos-5 py-vos-4 space-y-vos-5">
        <StatusPill tone={status.tone} pulse={status.pulse}>
          {status.label}
        </StatusPill>

        <Section title={t('agents.sectionConnection', 'Connection')}>
          <KeyValueGrid
            cols={1}
            items={[
              { label: t('agents.labelHostIP', 'Host / IP'), value: agent.ip_address || 'N/A', mono: true },
              { label: t('agents.detailSSHPort', 'SSH Port'), value: String(agent.ssh_port || 22), mono: true },
              { label: t('agents.labelUsername', 'Username'), value: agent.ssh_username || 'N/A', mono: true },
              { label: t('common.type', 'Type'), value: agent.connection_type || 'SSH' },
              ...(agent.location ? [{ label: t('agents.labelLocation', 'Location'), value: agent.location }] : []),
            ]}
          />
        </Section>

        <Section title={t('agents.sectionSystem', 'System')}>
          <KeyValueGrid
            cols={1}
            items={[
              { label: t('agents.detailOS', 'OS'), value: agent.os || 'Unknown' },
              { label: t('agents.detailPlatform', 'Platform'), value: agent.platform },
              { label: t('agents.detailVersion', 'Version'), value: agent.version || 'N/A' },
              {
                label: t('agents.detailLastSeen', 'Last Seen'),
                value: agent.last_heartbeat ? formatTimeSince(agent.last_heartbeat) : 'Never',
              },
            ]}
          />
        </Section>

        {agent.status === 'online' && (
          <Section title={t('agents.sectionResources', 'Resources')}>
            <div className="space-y-vos-2">
              <ResourceBar
                label={t('agents.detailCPU', 'CPU')}
                value={agent.cpu_usage}
                tone="accent"
                showPercent
              />
              <ResourceBar
                label={t('agents.detailMemory', 'Memory')}
                value={agent.memory_usage}
                tone="info"
                showPercent
              />
            </div>
          </Section>
        )}

        <Section title={t('agents.sectionScanning', 'Scanning')}>
          <KeyValueGrid
            cols={2}
            items={[
              { label: t('agents.detailActiveScans', 'Active Scans'), value: String(agent.active_scans) },
              { label: t('agents.detailTotalScans', 'Total Scans'), value: String(agent.total_scans) },
            ]}
          />
        </Section>

        {testResult && (
          <Section title={t('agents.sectionConnectionTest', 'Connection Test')}>
            {testResult.success ? (
              <div className="space-y-vos-2">
                <div className="flex items-center gap-2 text-vos-success text-vos-xs font-medium">
                  <CheckCircle2 size={12} /> Connected Successfully
                </div>
                {testResult.connection && (
                  <div className="text-vos-xs space-y-1 text-vos-text-3">
                    <p>
                      Latency:{' '}
                      <span className="text-vos-text font-mono tabular-nums">
                        {testResult.connection.latency_ms.toFixed(1)}ms
                      </span>
                    </p>
                    {testResult.connection.ssh_banner && (
                      <p className="font-mono text-[10px] text-vos-text-muted truncate">
                        {testResult.connection.ssh_banner}
                      </p>
                    )}
                  </div>
                )}
                {testResult.system && (
                  <div className="rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 p-vos-3 text-[11px] space-y-1">
                    {testResult.system.hostname && (
                      <KV label="Hostname" value={testResult.system.hostname} />
                    )}
                    {testResult.system.os && <KV label="OS" value={testResult.system.os} />}
                    {testResult.system.kernel && (
                      <KV label="Kernel" value={testResult.system.kernel} mono />
                    )}
                    {testResult.system.uptime && (
                      <KV label="Uptime" value={testResult.system.uptime} />
                    )}
                    {testResult.system.cpu_cores > 0 && (
                      <KV label="CPU Cores" value={String(testResult.system.cpu_cores)} />
                    )}
                    {testResult.system.memory_total_mb > 0 && (
                      <KV
                        label="Memory"
                        value={`${testResult.system.memory_used_mb}MB / ${testResult.system.memory_total_mb}MB`}
                      />
                    )}
                    {testResult.system.disk_total_gb > 0 && (
                      <KV
                        label="Disk"
                        value={`${testResult.system.disk_used_gb}GB / ${testResult.system.disk_total_gb}GB`}
                      />
                    )}
                    {testResult.system.ip_addresses?.length > 0 && (
                      <KV
                        label="IPs"
                        value={testResult.system.ip_addresses.join(', ')}
                        mono
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-vos-2">
                <div className="flex items-center gap-2 text-vos-danger text-vos-xs font-medium">
                  <AlertCircle size={12} /> Connection Failed
                </div>
                <p className="text-vos-xs text-vos-danger/80">{testResult.error}</p>
                {testResult.diagnostics && (
                  <div className="rounded-vos-md bg-vos-danger/5 border border-vos-danger/20 p-vos-3 text-vos-xs">
                    <p className="text-vos-text-3">
                      Port reachable:{' '}
                      <span
                        className={
                          testResult.diagnostics.tcp_port_reachable
                            ? 'text-vos-success'
                            : 'text-vos-danger'
                        }
                      >
                        {testResult.diagnostics.tcp_port_reachable ? 'Yes' : 'No'}
                      </span>
                    </p>
                    <p className="text-vos-warning mt-1">
                      💡 {testResult.diagnostics.hint}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}
      </div>

      <div className="px-vos-5 py-vos-4 border-t border-vos-border-1 bg-vos-bg-elev-1/40 space-y-vos-2">
        {agent.connection_type === 'reverse_tunnel' ? (
          <div className={`w-full inline-flex items-center justify-center gap-2 h-10 rounded-vos-md text-vos-sm font-semibold ${
            agent.status === 'online'
              ? 'bg-vos-success/10 border border-vos-success/20 text-vos-success'
              : 'bg-vos-warning/10 border border-vos-warning/20 text-vos-warning'
          }`}>
            {agent.status === 'online'
              ? <><CheckCircle2 size={13} /> Agent Online — last heartbeat {agent.last_heartbeat ? formatTimeSince(agent.last_heartbeat) : 'never'}</>
              : <><AlertCircle size={13} /> Agent Offline — waiting for heartbeat</>}
          </div>
        ) : (
          <button
            onClick={onTest}
            disabled={isTesting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {isTesting ? (
              <><Loader2 size={13} className="animate-spin" />{t('agents.testing', 'Testing…')}</>
            ) : (
              <><Zap size={13} />{t('agents.testConnection', 'Test Connection')}</>
            )}
          </button>
        )}
        <button
          onClick={onEdit}
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-xs font-medium hover:bg-vos-bg-elev-4"
        >
          <Pencil size={12} /> Edit Device
        </button>
        <button
          onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-vos-md bg-vos-danger/10 border border-vos-danger/20 text-vos-danger text-vos-xs font-medium hover:bg-vos-danger/20"
        >
          <Trash2 size={12} /> Delete Device
        </button>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  NETWORK DISCOVERY
 * ════════════════════════════════════════════════════════════ */

function NetworkDiscovery({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { token } = useAuthToken();
  const [subnet, setSubnet] = useState('10.0.0.0/24');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const doScan = async () => {
    setScanning(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/v1/agents/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ subnet, timeout_ms: 2000 }),
      });
      const data = await res.json();
      if (data.success) setResults(data.hosts || []);
      else setError(data.error || 'Discovery failed');
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setScanning(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
        <div className="flex items-center gap-vos-3">
          <span className="size-9 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent">
            <Search size={16} />
          </span>
          <div>
            <h2 className="text-vos-lg font-semibold text-vos-text">
              {t('agents.networkDiscovery', 'Network Discovery')}
            </h2>
            <p className="text-vos-xs text-vos-text-3">
              {t('agents.networkDiscoverySubtitle', 'Scan a subnet to find devices')}
            </p>
          </div>
        </div>
        <ModalClose onClose={onClose} />
      </div>

      <div className="px-vos-5 py-vos-4 border-b border-vos-border-1 flex gap-vos-2">
        <input
          type="text"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          placeholder="10.0.0.0/24"
          className="flex-1 px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text font-mono focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30"
        />
        <button
          onClick={doScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {scanning ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Search size={13} />
          )}
          {scanning ? t('agents.scanning', 'Scanning…') : t('agents.scan', 'Scan')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-vos-5 py-vos-4 max-h-[60vh]">
        {error && (
          <p className="text-vos-danger text-vos-sm mb-vos-3">{error}</p>
        )}
        {results.length > 0 ? (
          <div className="space-y-vos-2">
            <p className="text-vos-xs text-vos-text-3 mb-vos-2">
              {results.length} {t('agents.devicesFound', 'devices found')}
            </p>
            {results.map((host: any, i: number) => {
              const Icon = PLATFORM_ICON[host.device_type] || HelpCircle;
              return (
                <div
                  key={i}
                  className="flex items-center gap-vos-3 p-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 hover:border-vos-border-2 transition-colors"
                >
                  <Icon size={16} className="text-vos-text-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-vos-2">
                      <span className="text-vos-sm font-mono text-vos-text">
                        {host.ip}
                      </span>
                      {host.hostname && (
                        <span className="text-vos-xs text-vos-text-3">
                          ({host.hostname})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-vos-2 mt-0.5">
                      {host.os_guess && (
                        <span className="text-[10px] text-vos-text-2">
                          {host.os_guess}
                        </span>
                      )}
                      <span className="text-[10px] text-vos-text-muted tabular-nums">
                        {host.latency_ms?.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {host.open_ports?.map((p: any) => (
                      <span
                        key={p.port}
                        className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-mono bg-vos-bg-elev-4 text-vos-text-3 border border-vos-border-1"
                      >
                        {p.port}/{p.service}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !scanning ? (
          <div className="text-center py-vos-12 text-vos-text-3 text-vos-sm">
            {t(
              'agents.networkDiscoveryHint',
              'Enter a subnet and click Scan to discover devices',
            )}
          </div>
        ) : (
          <div className="text-center py-vos-12">
            <Loader2 size={28} className="animate-spin text-vos-accent mx-auto mb-vos-2" />
            <p className="text-vos-sm text-vos-text-2">
              {t('agents.scanningSubnet', 'Scanning…')}
            </p>
            <p className="text-vos-xs text-vos-text-3 mt-1">
              {t('agents.scanWait', 'This may take a moment')}
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  DEVICE GROUP
 * ════════════════════════════════════════════════════════════ */

function DeviceGroup({
  title,
  count,
  tone,
  agents,
  selectedId,
  testingId,
  onSelect,
  onTest,
}: {
  title: string;
  count: number;
  tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  agents: Agent[];
  selectedId: string | null;
  testingId: string | null;
  onSelect: (id: string) => void;
  onTest: (id: string) => void;
}) {
  const dotMap: Record<string, string> = {
    success: 'bg-vos-success',
    warning: 'bg-vos-warning',
    info: 'bg-vos-info',
    neutral: 'bg-vos-text-muted',
    danger: 'bg-vos-danger',
  };
  return (
    <div>
      <div className="flex items-center gap-vos-2 mb-vos-3">
        <span className={`size-2 rounded-full ${dotMap[tone]}`} />
        <h2 className="text-[10px] font-bold uppercase tracking-vos-wide text-vos-text-2">
          {title}
        </h2>
        <span className="text-[10px] text-vos-text-3 tabular-nums">({count})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-vos-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedId === agent.id}
            isTesting={testingId === agent.id}
            onSelect={() => onSelect(agent.id)}
            onTest={() => onTest(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  EMPTY STATE
 * ════════════════════════════════════════════════════════════ */

function EmptyState({
  onAdd,
  onDiscover,
}: {
  onAdd: () => void;
  onDiscover: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center py-vos-16">
      <div className="text-center max-w-md">
        <span className="size-14 mx-auto rounded-vos-xl bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 mb-vos-4">
          <ShieldAlert size={24} />
        </span>
        <h2 className="text-vos-lg font-bold text-vos-text mb-vos-2">
          {t('agents.noDevicesTitle', 'No Devices Connected')}
        </h2>
        <p className="text-vos-sm text-vos-text-3 mb-vos-5">
          Add your servers, workstations, and network devices to start scanning for
          vulnerabilities. CyberSec Pro connects via SSH, WinRM, or SNMP — no agent
          installation required.
        </p>
        <div className="flex items-center justify-center gap-vos-2">
          <button
            onClick={onDiscover}
            className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
          >
            <Search size={13} />
            Discover Network
          </button>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90"
          >
            <Plus size={13} />
            Add Your First Device
          </button>
        </div>
        <div className="mt-vos-8 grid grid-cols-3 gap-vos-3 text-center">
          <FeatureBadge icon={Lock} label="AES-256 encrypted credentials" />
          <FeatureBadge icon={Zap} label="Real SSH connection testing" />
          <FeatureBadge icon={Globe2} label="Subnet discovery scanning" />
        </div>
      </div>
    </div>
  );
}

function FeatureBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-vos-2">
      <span className="size-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2">
        <Icon size={14} />
      </span>
      <p className="text-[11px] text-vos-text-3">{label}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  MODAL HELPERS
 * ════════════════════════════════════════════════════════════ */

function ModalShell({
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-vos-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-vos-2xl border border-vos-border-1 bg-vos-bg-elev-2 shadow-vos-elev-3 overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {children}
      </motion.div>
    </div>
  );
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="size-8 rounded-vos-md text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-3 flex items-center justify-center"
      aria-label="Close"
    >
      <X size={16} />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════ *
 *  MAIN PAGE
 * ════════════════════════════════════════════════════════════ */

export default function AgentsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('agents.title', 'Devices')} — CyberSec Pro`);
  const toast = useToast();

  const { data: dashboard, isLoading, isError } = useAgentsDashboard();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const testAgent = useTestAgentConnection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showQuickConnect, setShowQuickConnect] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const agents: Agent[] = (dashboard as any)?.agents || [];
  const selectedAgent = agents.find((a) => a.id === selectedId);

  const online = agents.filter((a) => a.status === 'online');
  const offline = agents.filter((a) => a.status === 'offline');
  const pending = agents.filter((a) => a.status === 'pending');
  const busy = agents.filter((a) => a.status === 'busy');
  const errored = agents.filter((a) => a.status === 'error');

  const handleTest = useCallback(
    async (agentId: string) => {
      setTestingId(agentId);
      try {
        const result = await testAgent.mutateAsync(agentId);
        setTestResults((prev) => ({
          ...prev,
          [agentId]: result as unknown as TestResult,
        }));
        if ((result as any).success)
          toast.success(
            t('agents.connectionSuccess', 'Connection successful — system info updated'),
          );
        else
          toast.error(
            (result as any).error || t('agents.connectionFailed', 'Connection failed'),
          );
      } catch (e: any) {
        toast.error(
          `${t('agents.testFailed', 'Test failed')}: ${e.message || t('common.unknown', 'Unknown error')}`,
        );
      } finally {
        setTestingId(null);
      }
    },
    [testAgent, toast, t],
  );

  const handleCreate = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await createAgent.mutateAsync(data);
        toast.success(t('agents.deviceAdded', 'Device added successfully'));
        setShowWizard(false);
      } catch (e: any) {
        toast.error(
          `${t('agents.createFailed', 'Failed to create device')}: ${e.message || t('common.unknown', 'Unknown error')}`,
        );
      }
    },
    [createAgent, toast, t],
  );

  const handleUpdate = useCallback(
    async (agentId: string, data: Record<string, unknown>) => {
      try {
        await updateAgent.mutateAsync({ id: agentId, data } as any);
        toast.success(t('agents.deviceUpdated', 'Device updated successfully'));
        setEditingAgent(null);
      } catch (e: any) {
        toast.error(
          `${t('agents.updateFailed', 'Failed to update')}: ${e.message || t('common.unknown', 'Unknown error')}`,
        );
      }
    },
    [updateAgent, toast, t],
  );

  const handleDelete = useCallback(
    async (agentId: string) => {
      if (!confirm(t('agents.deleteConfirm', 'Are you sure you want to delete this device?')))
        return;
      try {
        await deleteAgent.mutateAsync(agentId);
        toast.success(t('agents.deviceDeleted', 'Device deleted'));
        setSelectedId(null);
      } catch (e: any) {
        toast.error(
          `${t('agents.deleteFailed', 'Failed to delete')}: ${e.message || t('common.unknown', 'Unknown error')}`,
        );
      }
    },
    [deleteAgent, toast, t],
  );

  if (isLoading) return <AgentsPageSkeleton />;
  if (isError)
    return (
      <div className="p-vos-6 text-vos-danger">
        {t('agents.loadFailed', 'Failed to load devices dashboard')}
      </div>
    );

  const dash = dashboard as any;

  return (
    <PageTransition>
      <div className="h-full flex flex-col">
        <div className="p-vos-8 pb-0 max-w-7xl mx-auto w-full">
          <PageHeader
            eyebrow="Fleet"
            icon={<Cpu size={22} />}
            title={t('agents.title', 'Devices')}
            description={t(
              'agents.subtitle',
              'Manage your connected devices, servers, and network infrastructure',
            )}
            actions={
              <div className="flex items-center gap-vos-2">
                <button
                  onClick={() => setShowDiscovery(true)}
                  className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
                >
                  <Search size={13} />
                  {t('agents.discoverNetwork', 'Discover Network')}
                </button>
                <button
                  onClick={() => setShowQuickConnect(true)}
                  className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90"
                >
                  <Plus size={13} />
                  {t('agents.addDevice', 'Add Device')}
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-vos-2 mt-vos-6">
            <StatCard
              title={t('agents.stats.total', 'Total')}
              value={String(dash?.total_agents || 0)}
              icon={<Server size={14} />}
            />
            <StatCard
              title={t('agents.stats.online', 'Online')}
              value={String(dash?.online || 0)}
              icon={<Power size={14} />}
              variant="green"
            />
            <StatCard
              title={t('agents.stats.offline', 'Offline')}
              value={String(dash?.offline || 0)}
              icon={<Power size={14} />}
            />
            <StatCard
              title={t('agents.stats.scanning', 'Scanning')}
              value={String(dash?.busy || 0)}
              icon={<PlayCircle size={14} />}
              variant="amber"
            />
            <StatCard
              title={t('agents.stats.pending', 'Pending')}
              value={String(dash?.pending || 0)}
              icon={<Clock size={14} />}
              variant="purple"
            />
            <StatCard
              title={t('agents.stats.activeScans', 'Active')}
              value={String(dash?.active_scans || 0)}
              icon={<Zap size={14} />}
              variant="purple"
            />
            <StatCard
              title={t('agents.stats.totalScans', 'Total Scans')}
              value={String(dash?.total_scans_completed || 0)}
              icon={<CheckCircle2 size={14} />}
              variant="green"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden mt-vos-6">
          <div
            className={`flex-1 overflow-y-auto px-vos-8 pb-vos-8 transition-all max-w-7xl mx-auto w-full ${
              selectedAgent ? 'pr-0' : ''
            }`}
          >
            {agents.length === 0 ? (
              <EmptyState
                onAdd={() => setShowQuickConnect(true)}
                onDiscover={() => setShowDiscovery(true)}
              />
            ) : (
              <div className="space-y-vos-6">
                {online.length > 0 && (
                  <DeviceGroup
                    title={t('agents.groups.online', 'Online')}
                    count={online.length}
                    tone="success"
                    agents={online}
                    selectedId={selectedId}
                    testingId={testingId}
                    onSelect={setSelectedId}
                    onTest={handleTest}
                  />
                )}
                {busy.length > 0 && (
                  <DeviceGroup
                    title={t('agents.groups.scanning', 'Scanning')}
                    count={busy.length}
                    tone="warning"
                    agents={busy}
                    selectedId={selectedId}
                    testingId={testingId}
                    onSelect={setSelectedId}
                    onTest={handleTest}
                  />
                )}
                {pending.length > 0 && (
                  <DeviceGroup
                    title={t('agents.groups.pending', 'Pending')}
                    count={pending.length}
                    tone="info"
                    agents={pending}
                    selectedId={selectedId}
                    testingId={testingId}
                    onSelect={setSelectedId}
                    onTest={handleTest}
                  />
                )}
                {offline.length > 0 && (
                  <DeviceGroup
                    title={t('agents.groups.offline', 'Offline')}
                    count={offline.length}
                    tone="neutral"
                    agents={offline}
                    selectedId={selectedId}
                    testingId={testingId}
                    onSelect={setSelectedId}
                    onTest={handleTest}
                  />
                )}
                {errored.length > 0 && (
                  <DeviceGroup
                    title={t('agents.groups.error', 'Error')}
                    count={errored.length}
                    tone="danger"
                    agents={errored}
                    selectedId={selectedId}
                    testingId={testingId}
                    onSelect={setSelectedId}
                    onTest={handleTest}
                  />
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedAgent && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-shrink-0 border-l border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden"
              >
                <DeviceDetail
                  agent={selectedAgent}
                  testResult={testResults[selectedAgent.id] || null}
                  isTesting={testingId === selectedAgent.id}
                  onTest={() => handleTest(selectedAgent.id)}
                  onEdit={() => setEditingAgent(selectedAgent)}
                  onDelete={() => handleDelete(selectedAgent.id)}
                  onClose={() => setSelectedId(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showQuickConnect && (
            <QuickConnectModal onClose={() => setShowQuickConnect(false)} />
          )}
          {showWizard && (
            <AddDeviceWizard
              onClose={() => setShowWizard(false)}
              onCreate={handleCreate}
            />
          )}
          {showDiscovery && (
            <NetworkDiscovery onClose={() => setShowDiscovery(false)} />
          )}
          {editingAgent && (
            <EditDeviceModal
              agent={editingAgent}
              onClose={() => setEditingAgent(null)}
              onSave={handleUpdate}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
