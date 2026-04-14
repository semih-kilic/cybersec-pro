import { useState, useCallback } from 'react';
import { useAgentsDashboard, useCreateAgent, useUpdateAgent, useDeleteAgent, useTestAgentConnection } from '../../hooks/useApiQueries';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useTranslation } from 'react-i18next';
import { AgentsPageSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { PageTransition } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   TYPES & CONFIG
   ═══════════════════════════════════════════════════════════ */

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

const CONNECTION_TYPES = [
  { id: 'ssh', name: 'SSH', icon: '\u{1F510}', desc: 'Linux, macOS, routers, firewalls', platforms: ['linux', 'macos', 'router', 'firewall'] },
  { id: 'winrm', name: 'WinRM', icon: '\u{1FA9F}', desc: 'Windows servers and workstations', platforms: ['windows'] },
  { id: 'snmp', name: 'SNMP', icon: '\u{1F4E1}', desc: 'Switches, routers, printers', platforms: ['network'] },
  { id: 'docker', name: 'Docker', icon: '\u{1F433}', desc: 'Container environments', platforms: ['docker'] },
  { id: 'cloud', name: 'Cloud API', icon: '\u2601\uFE0F', desc: 'AWS, Azure, GCP', platforms: ['cloud'] },
] as const;

const PLATFORM_ICONS: Record<string, string> = {
  linux: '\u{1F427}', windows: '\u{1FA9F}', macos: '\u{1F34E}', docker: '\u{1F433}',
  router: '\u{1F4E1}', firewall: '\u{1F6E1}\uFE0F', network: '\u{1F4E1}', cloud: '\u2601\uFE0F',
  server: '\u{1F5A5}\uFE0F', unknown: '\u2753',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  online:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Online' },
  offline: { color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/30', dot: 'bg-gray-500', label: 'Offline' },
  busy:    { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400', label: 'Scanning' },
  error:   { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400', label: 'Error' },
  pending: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', dot: 'bg-blue-400', label: 'Pending' },
};

/* ═══════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════ */

function formatTimeSince(dateStr: string): string {
  try {
    const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
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

/* ═══════════════════════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function ResourceBar({ label, value, color, showPercent }: { label: string; value: number; color: 'cyan' | 'violet' | 'amber' | 'red'; showPercent?: boolean }) {
  const colors = { cyan: 'bg-cyan-500', violet: 'bg-violet-500', amber: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-gray-500 w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: Math.min(100, Math.max(0, value)) + '%' }} />
      </div>
      {showPercent && <span className="text-gray-400 w-8 text-right">{Math.round(value)}%</span>}
    </div>
  );
}

function WizardInput({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 focus:outline-none transition-all" />
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={'text-white ' + (mono ? 'font-mono' : '')}>{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={'text-gray-300 ' + (mono ? 'font-mono' : '')}>{value}</span>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400', gray: 'text-gray-400', amber: 'text-amber-400',
    blue: 'text-blue-400', cyan: 'text-cyan-400', violet: 'text-violet-400',
  };
  const textColor = color ? (colorMap[color] || 'text-white') : 'text-white';
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className={'text-sm font-bold ' + textColor}>{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AGENT CARD
   ═══════════════════════════════════════════════════════════ */

function AgentCard({ agent, onSelect, onTest, isSelected, isTesting }: {
  agent: Agent; onSelect: () => void; onTest: () => void; isSelected: boolean; isTesting: boolean;
}) {
  const status = STATUS_CONFIG[agent.status] || STATUS_CONFIG.offline;
  const icon = PLATFORM_ICONS[agent.platform] || PLATFORM_ICONS.unknown;
  const timeSince = agent.last_heartbeat ? formatTimeSince(agent.last_heartbeat) : 'Never';

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }} onClick={onSelect}
      className={'relative cursor-pointer rounded-xl border p-4 transition-all duration-200 ' +
        (isSelected ? 'border-cyan-500/60 bg-cyan-500/5 shadow-lg shadow-cyan-500/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-900/80')}>
      {/* Status */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <span className={'h-2 w-2 rounded-full ' + status.dot + (agent.status === 'online' ? ' animate-pulse' : '')} />
        <span className={'text-[10px] font-medium uppercase tracking-wider ' + status.color}>{status.label}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-lg">{icon}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
          <p className="text-[11px] text-gray-500 truncate">{agent.hostname || agent.ip_address || 'No host'}</p>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
        <div className="flex justify-between text-[11px]"><span className="text-gray-500">IP</span><span className="text-gray-300 font-mono">{agent.ip_address || 'N/A'}</span></div>
        <div className="flex justify-between text-[11px]"><span className="text-gray-500">OS</span><span className="text-gray-300 truncate ml-1">{agent.os || agent.platform}</span></div>
        <div className="flex justify-between text-[11px]"><span className="text-gray-500">Port</span><span className="text-gray-300 font-mono">{agent.ssh_port || 22}</span></div>
        <div className="flex justify-between text-[11px]"><span className="text-gray-500">Seen</span><span className="text-gray-300">{timeSince}</span></div>
      </div>

      {/* Resource bars */}
      {agent.status === 'online' && (
        <div className="space-y-1.5 mb-3">
          <ResourceBar label="CPU" value={agent.cpu_usage} color="cyan" />
          <ResourceBar label="RAM" value={agent.memory_usage} color="violet" />
        </div>
      )}

      {/* Scans */}
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{agent.total_scans} scans</span>
        {agent.active_scans > 0 && <span className="text-amber-400 font-medium">{agent.active_scans} active</span>}
      </div>

      {/* Test button */}
      <button onClick={e => { e.stopPropagation(); onTest(); }} disabled={isTesting}
        className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium border transition-all border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed">
        {isTesting ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />Connecting...</span>
        ) : (
          <span className="flex items-center justify-center gap-1.5">{'\u26A1'} Test Connection</span>
        )}
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD DEVICE WIZARD
   ═══════════════════════════════════════════════════════════ */

function AddDeviceWizard({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Record<string, unknown>) => void }) {
  const [step, setStep] = useState<WizardStep>('type');
  const [connType, setConnType] = useState('ssh');
  const [form, setForm] = useState({
    name: '', ssh_host: '', ssh_port: 22, ssh_username: 'root', ssh_password: '',
    platform: 'linux', network_zone: 'internal', location: '',
  });

  const updateForm = (key: string, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const steps: { id: WizardStep; label: string; num: number }[] = [
    { id: 'type', label: 'Connection', num: 1 },
    { id: 'connection', label: 'Host Details', num: 2 },
    { id: 'credentials', label: 'Credentials', num: 3 },
    { id: 'review', label: 'Confirm', num: 4 },
  ];

  const canNext = () => {
    if (step === 'type') return true;
    if (step === 'connection') return form.ssh_host.trim().length > 0 && form.name.trim().length > 0;
    if (step === 'credentials') return form.ssh_username.trim().length > 0;
    return true;
  };

  const handleNext = () => { const idx = steps.findIndex(s => s.id === step); if (idx < steps.length - 1) setStep(steps[idx + 1].id); };
  const handleBack = () => { const idx = steps.findIndex(s => s.id === step); if (idx > 0) setStep(steps[idx - 1].id); };

  const handleCreate = () => {
    onCreate({
      name: form.name, connection_type: connType, ssh_host: form.ssh_host, ssh_port: form.ssh_port,
      ssh_username: form.ssh_username, ssh_password: form.ssh_password, platform: form.platform,
      network_zone: form.network_zone, location: form.location,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">Add Device</h2>
            <p className="text-xs text-gray-500 mt-0.5">Connect a new device to your security network</p></div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">{'\u2715'}</button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ' +
                (step === s.id ? 'bg-cyan-500 text-white' :
                  steps.findIndex(x => x.id === step) > i ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  'bg-gray-800 text-gray-500')}>
                {steps.findIndex(x => x.id === step) > i ? '\u2713' : s.num}
              </div>
              <span className={'ml-1.5 text-[10px] font-medium ' + (step === s.id ? 'text-cyan-400' : 'text-gray-600')}>{s.label}</span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-800 mx-2" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 'type' && (
              <motion.div key="type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
                {CONNECTION_TYPES.map(ct => (
                  <button key={ct.id} onClick={() => setConnType(ct.id)}
                    className={'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ' +
                      (connType === ct.id ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700')}>
                    <span className="text-2xl w-8">{ct.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{ct.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{ct.desc}</div>
                    </div>
                    {connType === ct.id && <span className="text-cyan-400">{'\u2713'}</span>}
                  </button>
                ))}
              </motion.div>
            )}

            {step === 'connection' && (
              <motion.div key="conn" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <WizardInput label="Device Name" placeholder="e.g. Production Server" value={form.name} onChange={v => updateForm('name', v)} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><WizardInput label="Host / IP" placeholder="10.0.0.115 or hostname" value={form.ssh_host} onChange={v => updateForm('ssh_host', v)} /></div>
                  <WizardInput label="Port" placeholder="22" value={String(form.ssh_port)} onChange={v => updateForm('ssh_port', parseInt(v) || 22)} type="number" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Platform</label>
                  <div className="flex gap-2 flex-wrap">
                    {['linux', 'windows', 'macos', 'router', 'firewall', 'docker'].map(p => (
                      <button key={p} onClick={() => updateForm('platform', p)}
                        className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                          (form.platform === p ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400' : 'border-gray-800 text-gray-400 hover:border-gray-700')}>
                        <span>{PLATFORM_ICONS[p]}</span><span className="capitalize">{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <WizardInput label="Location (optional)" placeholder="e.g. Office HQ, DC-1, Cloud-EU" value={form.location} onChange={v => updateForm('location', v)} />
              </motion.div>
            )}

            {step === 'credentials' && (
              <motion.div key="cred" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <WizardInput label="Username" placeholder="root" value={form.ssh_username} onChange={v => updateForm('ssh_username', v)} />
                <WizardInput label="Password" placeholder="password" value={form.ssh_password} onChange={v => updateForm('ssh_password', v)} type="password" />
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <p className="text-[11px] text-blue-400">{'\u{1F512}'} Password is encrypted with AES-256-GCM before storage. SSH key auth coming soon.</p>
                </div>
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
                  <ReviewRow label="Name" value={form.name} />
                  <ReviewRow label="Type" value={CONNECTION_TYPES.find(c => c.id === connType)?.name || connType} />
                  <ReviewRow label="Host" value={form.ssh_host + ':' + form.ssh_port} mono />
                  <ReviewRow label="Username" value={form.ssh_username} mono />
                  <ReviewRow label="Password" value={form.ssh_password ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Not set'} />
                  <ReviewRow label="Platform" value={(PLATFORM_ICONS[form.platform] || '') + ' ' + form.platform} />
                  {form.location && <ReviewRow label="Location" value={form.location} />}
                </div>
                <p className="text-[11px] text-gray-500 text-center">After creating, use "Test Connection" to verify SSH access and auto-detect system info.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <button onClick={step === 'type' ? onClose : handleBack}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors">
            {step === 'type' ? 'Cancel' : '\u2190 Back'}
          </button>
          {step === 'review' ? (
            <button onClick={handleCreate}
              className="px-6 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20">
              Create Device
            </button>
          ) : (
            <button onClick={handleNext} disabled={!canNext()}
              className="px-5 py-2 rounded-lg text-xs font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors disabled:opacity-40">
              Next {'\u2192'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT DEVICE MODAL
   ═══════════════════════════════════════════════════════════ */

function EditDeviceModal({ agent, onClose, onSave }: {
  agent: Agent; onClose: () => void; onSave: (id: string, data: Record<string, unknown>) => void;
}) {
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
  const updateForm = (key: string, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const data: Record<string, unknown> = {
      name: form.name, ssh_host: form.ssh_host, ssh_port: form.ssh_port,
      ssh_username: form.ssh_username, platform: form.platform,
      location: form.location, hostname: form.hostname, connection_type: form.connection_type,
    };
    if (form.ssh_password.trim()) data.ssh_password = form.ssh_password;
    onSave(agent.id, data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">Edit Device</h2>
            <p className="text-xs text-gray-500 mt-0.5">Update connection settings for {agent.name}</p></div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">{'\u2715'}</button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <WizardInput label="Device Name" placeholder="e.g. Production Server" value={form.name} onChange={v => updateForm('name', v)} />
          <WizardInput label="Hostname" placeholder="server.local" value={form.hostname} onChange={v => updateForm('hostname', v)} />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><WizardInput label="SSH Host / IP" placeholder="10.0.0.115" value={form.ssh_host} onChange={v => updateForm('ssh_host', v)} /></div>
            <WizardInput label="Port" placeholder="22" value={String(form.ssh_port)} onChange={v => updateForm('ssh_port', parseInt(v) || 22)} type="number" />
          </div>
          <WizardInput label="Username" placeholder="root" value={form.ssh_username} onChange={v => updateForm('ssh_username', v)} />
          <WizardInput label="New Password (leave blank to keep)" placeholder="leave blank to keep current" value={form.ssh_password} onChange={v => updateForm('ssh_password', v)} type="password" />
          <div>
            <label className="block text-xs text-gray-400 mb-2">Platform</label>
            <div className="flex gap-2 flex-wrap">
              {['linux', 'windows', 'macos', 'router', 'firewall', 'docker'].map(p => (
                <button key={p} onClick={() => updateForm('platform', p)}
                  className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                    (form.platform === p ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400' : 'border-gray-800 text-gray-400 hover:border-gray-700')}>
                  <span>{PLATFORM_ICONS[p]}</span><span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>
          <WizardInput label="Location" placeholder="e.g. Office HQ, DC-1" value={form.location} onChange={v => updateForm('location', v)} />
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-6 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20">
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEVICE DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */

function DeviceDetail({ agent, testResult, isTesting, onTest, onEdit, onDelete, onClose }: {
  agent: Agent; testResult: TestResult | null; isTesting: boolean; onTest: () => void; onEdit: () => void; onDelete: () => void; onClose: () => void;
}) {
  const status = STATUS_CONFIG[agent.status] || STATUS_CONFIG.offline;
  const icon = PLATFORM_ICONS[agent.platform] || '\u2753';

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div><h3 className="text-sm font-bold text-white">{agent.name}</h3>
            <p className="text-[11px] text-gray-500">{agent.hostname || 'No hostname'}</p></div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">{'\u2715'}</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className={'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ' + status.bg + ' ' + status.color}>
          <span className={'h-2 w-2 rounded-full ' + status.dot + (agent.status === 'online' ? ' animate-pulse' : '')} />{status.label}
        </div>

        <DetailSection title="Connection">
          <DetailRow label="Host / IP" value={agent.ip_address || 'N/A'} mono />
          <DetailRow label="SSH Port" value={String(agent.ssh_port || 22)} mono />
          <DetailRow label="Username" value={agent.ssh_username || 'N/A'} mono />
          <DetailRow label="Type" value={agent.connection_type || 'SSH'} />
          {agent.location && <DetailRow label="Location" value={agent.location} />}
        </DetailSection>

        <DetailSection title="System">
          <DetailRow label="OS" value={agent.os || 'Unknown'} />
          <DetailRow label="Platform" value={icon + ' ' + agent.platform} />
          <DetailRow label="Version" value={agent.version || 'N/A'} />
          <DetailRow label="Last Seen" value={agent.last_heartbeat ? formatTimeSince(agent.last_heartbeat) : 'Never'} />
        </DetailSection>

        {agent.status === 'online' && (
          <DetailSection title="Resources">
            <ResourceBar label="CPU" value={agent.cpu_usage} color="cyan" showPercent />
            <ResourceBar label="Memory" value={agent.memory_usage} color="violet" showPercent />
          </DetailSection>
        )}

        <DetailSection title="Scanning">
          <DetailRow label="Active Scans" value={String(agent.active_scans)} />
          <DetailRow label="Total Scans" value={String(agent.total_scans)} />
        </DetailSection>

        {/* Test Results Display */}
        {testResult && (
          <DetailSection title="Connection Test">
            {testResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Connected Successfully
                </div>
                {testResult.connection && (
                  <div className="text-[11px] space-y-1 text-gray-400">
                    <p>Latency: <span className="text-white font-mono">{testResult.connection.latency_ms.toFixed(1)}ms</span></p>
                    {testResult.connection.ssh_banner && <p className="font-mono text-[10px] text-gray-600 truncate">{testResult.connection.ssh_banner}</p>}
                  </div>
                )}
                {testResult.system && (
                  <div className="mt-2 p-3 rounded-lg bg-gray-900 border border-gray-800 text-[11px] space-y-1">
                    {testResult.system.hostname && <p className="text-gray-400">Hostname: <span className="text-white">{testResult.system.hostname}</span></p>}
                    {testResult.system.os && <p className="text-gray-400">OS: <span className="text-white">{testResult.system.os}</span></p>}
                    {testResult.system.kernel && <p className="text-gray-400">Kernel: <span className="text-white font-mono">{testResult.system.kernel}</span></p>}
                    {testResult.system.uptime && <p className="text-gray-400">Uptime: <span className="text-white">{testResult.system.uptime}</span></p>}
                    {testResult.system.cpu_cores > 0 && <p className="text-gray-400">CPU Cores: <span className="text-white">{testResult.system.cpu_cores}</span></p>}
                    {testResult.system.memory_total_mb > 0 && (<p className="text-gray-400">Memory: <span className="text-white">{testResult.system.memory_used_mb}MB / {testResult.system.memory_total_mb}MB</span></p>)}
                    {testResult.system.disk_total_gb > 0 && (<p className="text-gray-400">Disk: <span className="text-white">{testResult.system.disk_used_gb}GB / {testResult.system.disk_total_gb}GB</span></p>)}
                    {testResult.system.ip_addresses && testResult.system.ip_addresses.length > 0 && (
                      <p className="text-gray-400">IPs: <span className="text-white font-mono">{testResult.system.ip_addresses.join(', ')}</span></p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-red-400" /> Connection Failed
                </div>
                <p className="text-[11px] text-red-400/80">{testResult.error}</p>
                {testResult.diagnostics && (
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-[11px]">
                    <p className="text-gray-400">Port reachable: <span className={testResult.diagnostics.tcp_port_reachable ? 'text-emerald-400' : 'text-red-400'}>{testResult.diagnostics.tcp_port_reachable ? 'Yes' : 'No'}</span></p>
                    <p className="text-yellow-400/80 mt-1">{'\u{1F4A1}'} {testResult.diagnostics.hint}</p>
                  </div>
                )}
              </div>
            )}
          </DetailSection>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-gray-800 space-y-2">
        <button onClick={onTest} disabled={isTesting}
          className="w-full py-2.5 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50">
          {isTesting ? '\u23F3 Testing...' : '\u26A1 Test Connection'}
        </button>
        <button onClick={onEdit}
          className="w-full py-2 rounded-lg text-xs font-medium border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-all">
          {'\u270F\uFE0F'} Edit Device
        </button>
        <button onClick={onDelete}
          className="w-full py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
          Delete Device
        </button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NETWORK DISCOVERY PANEL
   ═══════════════════════════════════════════════════════════ */

function NetworkDiscovery({ onClose }: { onClose: () => void }) {
  const { token } = useAuthToken();
  const [subnet, setSubnet] = useState('10.0.0.0/24');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const doScan = async () => {
    setScanning(true); setError(''); setResults([]);
    try {
      const res = await fetch('/api/v1/agents/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ subnet, timeout_ms: 2000 }),
      });
      const data = await res.json();
      if (data.success) { setResults(data.hosts || []); }
      else { setError(data.error || 'Discovery failed'); }
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setScanning(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">{'\u{1F50D}'} Network Discovery</h2>
            <p className="text-xs text-gray-500">Scan a subnet to find devices</p></div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">{'\u2715'}</button>
        </div>

        <div className="px-6 py-4 border-b border-gray-800 flex gap-3">
          <input type="text" value={subnet} onChange={e => setSubnet(e.target.value)} placeholder="10.0.0.0/24"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white font-mono focus:border-cyan-500 focus:outline-none" />
          <button onClick={doScan} disabled={scanning}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 disabled:opacity-50 transition-all">
            {scanning ? '\u23F3 Scanning...' : '\u{1F50D} Scan'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">{results.length} devices found</p>
              {results.map((host: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all">
                  <span className="text-lg">{PLATFORM_ICONS[host.device_type] || '\u2753'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-white">{host.ip}</span>
                      {host.hostname && <span className="text-xs text-gray-500">({host.hostname})</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {host.os_guess && <span className="text-[10px] text-gray-400">{host.os_guess}</span>}
                      <span className="text-[10px] text-gray-600">{host.latency_ms?.toFixed(0)}ms</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {host.open_ports?.map((p: any) => (
                      <span key={p.port} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-gray-800 text-gray-400 border border-gray-700">
                        {p.port}/{p.service}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !scanning && (
            <div className="text-center py-12 text-gray-600 text-sm">Enter a subnet and click Scan to discover devices</div>
          )}
          {scanning && (
            <div className="text-center py-12">
              <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Scanning {subnet}...</p>
              <p className="text-xs text-gray-600 mt-1">This may take a moment</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEVICE GROUP
   ═══════════════════════════════════════════════════════════ */

function DeviceGroup({ title, count, color, agents, selectedId, testingId, onSelect, onTest }: {
  title: string; count: number; color: string; agents: Agent[];
  selectedId: string | null; testingId: string | null;
  onSelect: (id: string) => void; onTest: (id: string) => void;
}) {
  const dotColor: Record<string, string> = {
    emerald: 'bg-emerald-400', amber: 'bg-amber-400', blue: 'bg-blue-400',
    gray: 'bg-gray-500', red: 'bg-red-400', cyan: 'bg-cyan-400',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={'h-2 w-2 rounded-full ' + (dotColor[color] || 'bg-gray-500')} />
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h2>
        <span className="text-[10px] text-gray-600">({count})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} isSelected={selectedId === agent.id} isTesting={testingId === agent.id}
            onSelect={() => onSelect(agent.id)} onTest={() => onTest(agent.id)} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════ */

function EmptyState({ onAdd, onDiscover }: { onAdd: () => void; onDiscover: () => void }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">{'\u{1F6E1}\uFE0F'}</div>
        <h2 className="text-xl font-bold text-white mb-2">No Devices Connected</h2>
        <p className="text-sm text-gray-500 mb-6">
          Add your servers, workstations, and network devices to start scanning for vulnerabilities.
          CyberSec Pro connects via SSH, WinRM, or SNMP — no agent installation required.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onDiscover}
            className="px-5 py-2.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-all">
            {'\u{1F50D}'} Discover Network
          </button>
          <button onClick={onAdd}
            className="px-5 py-2.5 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20">
            + Add Your First Device
          </button>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div><div className="text-2xl mb-1">{'\u{1F510}'}</div><p className="text-[11px] text-gray-500">AES-256 encrypted credentials</p></div>
          <div><div className="text-2xl mb-1">{'\u26A1'}</div><p className="text-[11px] text-gray-500">Real SSH connection testing</p></div>
          <div><div className="text-2xl mb-1">{'\u{1F310}'}</div><p className="text-[11px] text-gray-500">Subnet discovery scanning</p></div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN AGENTS PAGE
   ═══════════════════════════════════════════════════════════ */

export default function AgentsPage() {
  useDocumentTitle('Devices \u2014 CyberSec Pro');
  const { t } = useTranslation();
  const toast = useToast();

  const { data: dashboard, isLoading, isError } = useAgentsDashboard();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const testAgent = useTestAgentConnection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const agents: Agent[] = (dashboard as any)?.agents || [];
  const selectedAgent = agents.find(a => a.id === selectedId);

  const online = agents.filter(a => a.status === 'online');
  const offline = agents.filter(a => a.status === 'offline');
  const pending = agents.filter(a => a.status === 'pending');
  const busy = agents.filter(a => a.status === 'busy');
  const errored = agents.filter(a => a.status === 'error');

  const handleTest = useCallback(async (agentId: string) => {
    setTestingId(agentId);
    try {
      const result = await testAgent.mutateAsync(agentId);
      setTestResults(prev => ({ ...prev, [agentId]: result as unknown as TestResult }));
      if ((result as any).success) { toast.success('Connection successful \u2014 system info updated'); }
      else { toast.error((result as any).error || 'Connection failed'); }
    } catch (e: any) { toast.error('Test failed: ' + (e.message || 'Unknown error')); }
    finally { setTestingId(null); }
  }, [testAgent, toast]);

  const handleCreate = useCallback(async (data: Record<string, unknown>) => {
    try {
      await createAgent.mutateAsync(data);
      toast.success('Device added successfully');
      setShowWizard(false);
    } catch (e: any) { toast.error('Failed to create device: ' + (e.message || 'Unknown error')); }
  }, [createAgent, toast]);

  const handleUpdate = useCallback(async (agentId: string, data: Record<string, unknown>) => {
    try {
      await updateAgent.mutateAsync({ id: agentId, data } as any);
      toast.success('Device updated successfully');
      setEditingAgent(null);
    } catch (e: any) { toast.error('Failed to update: ' + (e.message || 'Unknown error')); }
  }, [updateAgent, toast]);

  const handleDelete = useCallback(async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await deleteAgent.mutateAsync(agentId);
      toast.success('Device deleted');
      setSelectedId(null);
    } catch (e: any) { toast.error('Failed to delete: ' + (e.message || 'Unknown error')); }
  }, [deleteAgent, toast]);

  if (isLoading) return <AgentsPageSkeleton />;
  if (isError) return <div className="p-6 text-red-400">Failed to load devices dashboard</div>;

  return (
    <PageTransition>
      <div className="h-full flex flex-col">
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Devices</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your connected devices, servers, and network infrastructure</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDiscovery(true)}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-all">
              {'\u{1F50D}'} Discover Network
            </button>
            <button onClick={() => setShowWizard(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-gray-950 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20">
              + Add Device
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-3 border-b border-gray-800/50 flex items-center gap-3 flex-shrink-0 overflow-x-auto">
          <StatBadge label="Total" value={(dashboard as any)?.total_agents || 0} />
          <StatBadge label="Online" value={(dashboard as any)?.online || 0} color="emerald" />
          <StatBadge label="Offline" value={(dashboard as any)?.offline || 0} color="gray" />
          <StatBadge label="Scanning" value={(dashboard as any)?.busy || 0} color="amber" />
          <StatBadge label="Pending" value={(dashboard as any)?.pending || 0} color="blue" />
          <div className="h-4 w-px bg-gray-800" />
          <StatBadge label="Active Scans" value={(dashboard as any)?.active_scans || 0} color="cyan" />
          <StatBadge label="Total Scans" value={(dashboard as any)?.total_scans_completed || 0} color="violet" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className={'flex-1 overflow-y-auto p-6 transition-all ' + (selectedAgent ? 'pr-0' : '')}>
            {agents.length === 0 ? (
              <EmptyState onAdd={() => setShowWizard(true)} onDiscover={() => setShowDiscovery(true)} />
            ) : (
              <div className="space-y-6">
                {online.length > 0 && <DeviceGroup title="Online" count={online.length} color="emerald" agents={online} selectedId={selectedId} testingId={testingId} onSelect={setSelectedId} onTest={handleTest} />}
                {busy.length > 0 && <DeviceGroup title="Scanning" count={busy.length} color="amber" agents={busy} selectedId={selectedId} testingId={testingId} onSelect={setSelectedId} onTest={handleTest} />}
                {pending.length > 0 && <DeviceGroup title="Pending" count={pending.length} color="blue" agents={pending} selectedId={selectedId} testingId={testingId} onSelect={setSelectedId} onTest={handleTest} />}
                {offline.length > 0 && <DeviceGroup title="Offline" count={offline.length} color="gray" agents={offline} selectedId={selectedId} testingId={testingId} onSelect={setSelectedId} onTest={handleTest} />}
                {errored.length > 0 && <DeviceGroup title="Error" count={errored.length} color="red" agents={errored} selectedId={selectedId} testingId={testingId} onSelect={setSelectedId} onTest={handleTest} />}
              </div>
            )}
          </div>

          {/* Detail Sidebar */}
          <AnimatePresence>
            {selectedAgent && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                className="flex-shrink-0 border-l border-gray-800 bg-gray-950 overflow-hidden">
                <DeviceDetail agent={selectedAgent} testResult={testResults[selectedAgent.id] || null}
                  isTesting={testingId === selectedAgent.id} onTest={() => handleTest(selectedAgent.id)}
                  onEdit={() => setEditingAgent(selectedAgent)}
                  onDelete={() => handleDelete(selectedAgent.id)} onClose={() => setSelectedId(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {showWizard && <AddDeviceWizard onClose={() => setShowWizard(false)} onCreate={handleCreate} />}
          {showDiscovery && <NetworkDiscovery onClose={() => setShowDiscovery(false)} />}
          {editingAgent && <EditDeviceModal agent={editingAgent} onClose={() => setEditingAgent(null)} onSave={handleUpdate} />}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
