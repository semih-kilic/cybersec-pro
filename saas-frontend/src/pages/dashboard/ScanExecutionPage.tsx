import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  FileText,
  Info,
  Play,
  RotateCw,
  Server,
  ShieldCheck,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import api, { ScanResult, StreamConnectionStatus, ToolConfig } from '../../services/api';
import { useScanSubscription } from '../../hooks/useWebSocket';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../hooks/useAuth';
import { ScanProgress } from '../../components/dashboard/ScanProgress';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, CACHE_TIMES } from '../../lib/queryClient';
import {
  useToolExecutionMode,
  useFetchBusinessReport,
  normalizeAgentsPayload,
} from '../../hooks/useApiQueries';
import {
  PageHeader,
  StatusPill,
  RiskScore,
  Section,
  KeyValueGrid,
  SeverityHeatmap,
  type Severity,
} from '../../components/vos';

// ─── Helpers ────────────────────────────────────────────────────────────────

const BUSINESS_CATEGORIES: Record<string, { label: string }> = {
  network_security: { label: 'Network Security' },
  web_security: { label: 'Web Application Security' },
  vulnerability_assessment: { label: 'Vulnerability Assessment' },
  compliance_audit: { label: 'Compliance & Audit' },
  threat_intelligence: { label: 'Threat Intelligence' },
  forensics_monitoring: { label: 'Forensics & Monitoring' },
};

interface ToolExecutionMode {
  tool_id: string;
  execution_mode: string;
  can_execute: boolean;
  config?: {
    backend_mode?: string;
    user_display?: string;
    user_explanation?: string;
    headless_alternative?: string;
  };
}

interface AgentInfo {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: string;
  platform: string;
  cpu_usage: number;
  memory_usage: number;
  active_scans: number;
  last_heartbeat: string;
}

type LegacyScanFields = {
  tool_name?: string;
  command?: string;
};

type ScanStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

const STATUS_TONE: Record<ScanStatus, {
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
  pulse?: boolean;
  label: string;
}> = {
  idle: { tone: 'neutral', label: 'Ready' },
  running: { tone: 'warning', pulse: true, label: 'Running' },
  completed: { tone: 'success', label: 'Completed' },
  failed: { tone: 'danger', label: 'Failed' },
  cancelled: { tone: 'info', label: 'Cancelled' },
};

const STREAM_TONE: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string; pulse?: boolean }> = {
  connected: { tone: 'success', pulse: true, label: 'Live' },
  connecting: { tone: 'warning', pulse: true, label: 'Connecting' },
  error: { tone: 'danger', label: 'Stream error' },
  idle: { tone: 'neutral', label: 'Idle' },
};

const SEVERITY_KEYS: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScanExecutionPage() {
  const { t } = useTranslation();
  useDocumentTitle('Scan Execution — CyberSec Pro');
  const { scanId, toolId: routeToolId } = useParams<{ scanId: string; toolId: string }>();
  const [searchParams] = useSearchParams();
  const { target: globalTarget, addRecentTarget: addGlobalTarget } = useTarget();
  const { token: _token } = useAuth();

  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessDescription, setBusinessDescription] = useState<string>('');
  const [executionMode, setExecutionMode] = useState<ToolExecutionMode | null>(null);
  const [showCommand, setShowCommand] = useState(false);
  const [viewMode, setViewMode] = useState<'terminal' | 'results'>('terminal');
  const [businessResults, setBusinessResults] = useState<any>(null);
  const [target, setTarget] = useState(searchParams.get('target') || globalTarget || '');
  const [parameters, setParameters] = useState<Record<string, string | number | boolean>>(() => {
    const paramsStr = searchParams.get('params');
    if (paramsStr) {
      try {
        return JSON.parse(paramsStr);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [, setResult] = useState<ScanResult | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(scanId || null);
  const [command, setCommand] = useState(searchParams.get('command') || '');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'idle' | StreamConnectionStatus>('idle');
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('auto');
  const [executionInfo, setExecutionInfo] = useState<{
    mode: string;
    agentName?: string;
    agentIp?: string;
    dispatchMethod?: string;
    engineName?: string;
  } | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const toolId = routeToolId || searchParams.get('tool') || '';

  const ws = useScanSubscription(status === 'running' ? currentScanId : null);

  const { data: toolConfigData } = useQuery({
    queryKey: [...queryKeys.tools.detail(toolId), 'config'],
    queryFn: async () => {
      const response = await api.getToolConfig(toolId);
      return response.data?.tool || null;
    },
    ...CACHE_TIMES.tools,
    enabled: !!toolId,
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: async () => {
      const response = await api.getAgents();
      return normalizeAgentsPayload<AgentInfo>(response.data as unknown);
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (toolConfigData && !tool) {
      const tt = toolConfigData;
      setTool(tt);
      const bName = (tt as any).business_name || tt.name;
      setBusinessName(bName);
      const cat = tt.category || 'vulnerability_assessment';
      const catInfo = BUSINESS_CATEGORIES[cat];
      setBusinessDescription(
        catInfo
          ? `${catInfo.label} — Identifies security issues across the selected target.`
          : 'Comprehensive security assessment for the selected target.'
      );
      const paramsStr = searchParams.get('params');
      if (!paramsStr && tt.parameters && typeof tt.parameters === 'object') {
        const defaults: Record<string, string | number | boolean> = {};
        Object.entries(tt.parameters).forEach(([key, param]: [string, any]) => {
          if (param.default !== undefined) defaults[key] = param.default;
        });
        if (Object.keys(defaults).length > 0) setParameters(defaults);
      }
      if ((tt as any).command_template) setCommand((tt as any).command_template);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolConfigData]);

  useEffect(() => {
    setAgents(normalizeAgentsPayload<AgentInfo>(agentsData as unknown));
  }, [agentsData]);

  const { data: executionModeData } = useToolExecutionMode(toolId);
  const businessReportMutation = useFetchBusinessReport();

  useEffect(() => {
    if (executionModeData) setExecutionMode(executionModeData as any);
  }, [executionModeData]);

  // Load existing scan
  const loadedScanRef = useRef(false);
  useEffect(() => {
    if (!scanId || loadedScanRef.current || status !== 'idle') return;
    loadedScanRef.current = true;
    (async () => {
      try {
        const res = await api.getScan(scanId);
        const scan = res.data?.scan;
        if (!scan) return;
        const legacyScan = scan as typeof scan & LegacyScanFields;
        if (scan.target) setTarget(scan.target);
        if (legacyScan.tool_name || scan.tool_id) {
          const toolName = legacyScan.tool_name || scan.tool_id || '';
          setBusinessName(toolName);
          setCommand(legacyScan.command || `${toolName} ${scan.target || ''}`);
        }
        if (scan.output) {
          const lines = typeof scan.output === 'string' ? scan.output.split('\n') : [];
          setOutput(lines);
        }
        if (scan.status === 'completed' || scan.status === 'failed') {
          setStatus(scan.status);
          setProgress(100);
          if (scan.status === 'completed') {
            try {
              const data = await businessReportMutation.mutateAsync(scanId);
              setBusinessResults(data);
              setViewMode('results');
            } catch {
              setViewMode('terminal');
            }
          }
        } else if (scan.status === 'running') {
          setStatus('running');
          setScanStartTime(Date.now());
        }
      } catch (err) {
        console.error('Failed to load scan:', err);
        try {
          const tk = localStorage.getItem('auth_token') || '';
          const resp = await fetch(`/api/v1/scans/${scanId}`, {
            headers: { Authorization: `Bearer ${tk}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            const scan = data.scan;
            if (scan) {
              if (scan.target) setTarget(scan.target);
              if (scan.output) setOutput(typeof scan.output === 'string' ? scan.output.split('\n') : []);
              if (scan.status === 'completed' || scan.status === 'failed') {
                setStatus(scan.status);
                setProgress(100);
                if (scan.status === 'completed') {
                  const brData = await businessReportMutation.mutateAsync(scanId);
                  setBusinessResults(brData);
                  setViewMode('results');
                }
              } else if (scan.status === 'running') {
                setStatus('running');
                setScanStartTime(Date.now());
              }
            }
          }
        } catch {
          /* silent */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // Auto-start
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartedRef.current && target && toolId && status === 'idle' && searchParams.get('target')) {
      autoStartedRef.current = true;
      const timer = setTimeout(() => handleStartScan(), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, toolId, status]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  useEffect(() => {
    if (ws.progress) {
      setProgress(ws.progress.progress);
      if (ws.progress.status && ws.progress.status !== 'running') {
        setStatus(ws.progress.status as 'completed' | 'failed');
      }
    }
  }, [ws.progress]);

  useEffect(() => {
    if (ws.output.length > 0) {
      const lastOutput = ws.output[ws.output.length - 1];
      setOutput((prev) => [...prev, lastOutput.line]);
    }
  }, [ws.output]);

  useEffect(() => {
    if (ws.complete) {
      setStatus(ws.complete.status as 'completed' | 'failed');
      setProgress(100);
      setScanStartTime(null);
      if (ws.complete.status === 'completed') fetchBusinessResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.complete]);

  useEffect(() => {
    if (status === 'running' && scanStartTime) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - scanStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
    setElapsedSeconds(0);
  }, [status, scanStartTime]);

  const fetchBusinessResults = async () => {
    if (!currentScanId) return;
    try {
      const data = await businessReportMutation.mutateAsync(currentScanId);
      setBusinessResults(data);
      setViewMode('results');
    } catch {
      /* keep terminal */
    }
  };

  useEffect(() => {
    if (currentScanId && status === 'running') {
      setStreamStatus('connecting');
      const cleanup = api.streamScanOutput(
        currentScanId,
        (line) => setOutput((prev) => [...prev, line]),
        (scanResult) => {
          setResult(scanResult);
          const finalStatus = scanResult.status === 'timeout' ? 'failed' : scanResult.status;
          setStatus(finalStatus as 'completed' | 'failed');
          setProgress(100);
          setScanStartTime(null);
        },
        (nextStatus) => setStreamStatus(nextStatus)
      );
      return cleanup;
    }
    if (status !== 'running') setStreamStatus('idle');
  }, [currentScanId, status]);

  const handleStartScan = async () => {
    if (!target) {
      setError('Target is required');
      return;
    }
    addGlobalTarget(target);
    setError(null);
    setOutput([]);
    setStatus('running');
    setExecutionInfo(null);
    setScanStartTime(Date.now());
    setStreamStatus('connecting');

    const agentLabel =
      selectedAgentId === 'local'
        ? '(Server)'
        : selectedAgentId === 'auto'
        ? '(Auto-select agent)'
        : `(Agent: ${agents.find((a) => a.id === selectedAgentId)?.name || selectedAgentId})`;

    setOutput([`▶ Starting ${tool?.name || toolId} scan on ${target} ${agentLabel}...`, '']);

    const agentId = selectedAgentId !== 'auto' && selectedAgentId !== 'local' ? selectedAgentId : undefined;
    const execMode = selectedAgentId === 'local' ? 'local' : selectedAgentId === 'auto' ? 'auto' : 'agent';
    const response = await api.executeScan(toolId, target, parameters, agentId, execMode);

    if (response.error) {
      setError(response.error);
      setStatus('failed');
      setOutput((prev) => [...prev, `✖ Error: ${response.error}`]);
      return;
    }

    if (response.data) {
      const sId = response.data.scan_id || (response.data as any).scan?.id;
      setCurrentScanId(sId);
      setCommand(response.data.command || (response.data as any).scan?.command || '');
      const mode = response.data.execution_mode || 'local';
      setExecutionInfo({
        mode,
        agentName: response.data.agent?.name,
        agentIp: response.data.agent?.ip,
        dispatchMethod: response.data.agent?.dispatch_method,
        engineName: (response.data as any).engine,
      });
      if (mode === 'agent' && response.data.agent) {
        setOutput((prev) => [
          ...prev,
          `→ Dispatched to agent "${response.data!.agent!.name}" (${response.data!.agent!.ip})`,
          `↔ Method: ${response.data!.agent!.dispatch_method === 'websocket' ? 'WebSocket (real-time)' : 'HTTP polling'}`,
          `$ ${response.data?.command || ''}`,
          '',
          '── Agent output ──',
          '',
        ]);
      } else if (mode === 'delegated') {
        setOutput((prev) => [
          ...prev,
          `⚙ Delegated to scan engine (${(response.data as any).engine || 'rust-scan-engine'})`,
          '',
          '── Engine output ──',
          '',
        ]);
      } else {
        setOutput((prev) => [...prev, `$ ${response.data?.command || ''}`, '', '── Scan output ──', '']);
      }
    }
  };

  const handleStopScan = async () => {
    if (currentScanId) {
      await api.stopScan(currentScanId);
      setStatus('cancelled');
      setOutput((prev) => [...prev, '', '⏹ Scan cancelled by user']);
    }
  };

  const handleNewScan = () => {
    setStatus('idle');
    setOutput([]);
    setResult(null);
    setCurrentScanId(null);
    setTarget('');
    setError(null);
  };

  const handleParamChange = (name: string, value: string | boolean) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  const renderParameterInput = (name: string, param: any) => {
    const value = parameters[name];
    switch (param.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => handleParamChange(name, e.target.checked)}
              className="w-4 h-4 rounded border-vos-border-1 bg-vos-bg-elev-1 text-vos-accent focus:ring-vos-accent"
            />
            <span className="text-vos-sm text-vos-text-2">{param.description}</span>
          </label>
        );
      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            className="vos-input w-full"
          >
            <option value="">Select {name}</option>
            {param.options?.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={(value as string) || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            min={param.min}
            max={param.max}
            className="vos-input w-full"
            placeholder={param.description}
          />
        );
      default:
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            className="vos-input w-full"
            placeholder={param.description}
          />
        );
    }
  };

  // Severity counts derived from business results
  const severityCounts = (() => {
    const s = businessResults?.summary || {};
    return {
      critical: Number(s.critical) || 0,
      high: Number(s.high) || 0,
      medium: Number(s.medium) || 0,
      low: Number(s.low) || 0,
      info: Number(s.info) || 0,
    } as Record<Severity, number>;
  })();
  const severityTotal = SEVERITY_KEYS.reduce((sum, k) => sum + (severityCounts[k] || 0), 0);
  const rawSecurityScore = businessResults?.summary?.score;
  const securityScore = (typeof rawSecurityScore === 'number' && Number.isFinite(rawSecurityScore))
    ? Math.max(0, Math.min(100, rawSecurityScore))
    : null;
  const onlineAgents = agents.filter((a) => a.status === 'online');

  const isPrivateTarget =
    target &&
    (target.startsWith('10.') || target.startsWith('172.') || target.startsWith('192.168.') || target.startsWith('127.'));

  const streamMeta = STREAM_TONE[streamStatus] || STREAM_TONE.idle;
  const statusMeta = STATUS_TONE[status];

  return (
    <div className="space-y-vos-6">
      <PageHeader
        eyebrow="Scan Execution"
        title={businessName || tool?.name || toolId || 'Run scan'}
        description={businessDescription || t('scans.executeSubtitle', 'Execute a security assessment with live streaming output.')}
        icon={<Activity className="w-5 h-5" />}
        badge={<StatusPill tone={statusMeta.tone} pulse={statusMeta.pulse}>{statusMeta.label}</StatusPill>}
        actions={
          <div className="flex items-center gap-vos-2">
            {status === 'idle' && (
              <button onClick={handleStartScan} disabled={!target.trim()} className="vos-btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <Play className="w-4 h-4" />
                {t('scans.newScan', 'Start scan')}
              </button>
            )}
            {status === 'running' && (
              <button onClick={handleStopScan} className="vos-btn-danger">
                <Square className="w-4 h-4" />
                {t('common.cancel', 'Stop scan')}
              </button>
            )}
            {(status === 'completed' || status === 'failed' || status === 'cancelled') && (
              <button onClick={handleNewScan} className="vos-btn-primary">
                <RotateCw className="w-4 h-4" />
                {t('scans.newScan', 'New scan')}
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-vos-6">
        {/* ── Left column: configuration ───────────────────────────── */}
        <div className="lg:col-span-1 space-y-vos-6">
          <Section
            title={t('common.target', 'Target')}
            description={t('scans.targetHint', 'Enter the IP address, domain, or URL you want to scan.')}
          >
            <div className="space-y-vos-3">
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t('scans.targetPlaceholder', 'e.g. 192.168.1.0/24, example.com, https://app.example.com')}
                disabled={status === 'running'}
                className="vos-input w-full disabled:opacity-50"
              />
              {!target && status === 'idle' && (
                <div className="flex items-center gap-2 text-vos-xs text-vos-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('scans.targetRequired', 'Target is required to start a scan')}
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-vos-xs text-vos-danger">
                  <XCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}
            </div>
          </Section>

          {executionMode && executionMode.execution_mode !== 'normal' && (
            <Section
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-vos-warning" />
                  {executionMode.execution_mode === 'sandbox' ? 'Sandboxed execution' :
                   executionMode.execution_mode === 'rate_limited' ? 'Rate-limited scan' :
                   executionMode.execution_mode === 'simulation' ? 'Simulation mode' :
                   executionMode.execution_mode === 'headless' ? 'Headless mode' :
                   executionMode.execution_mode === 'not_applicable' ? 'Not available' :
                   'Special execution'}
                </span>
              }
            >
              <p className="text-vos-xs text-vos-text-3 leading-relaxed">
                {executionMode.config?.user_explanation || executionMode.config?.user_display ||
                  'This tool runs in a restricted environment for safety.'}
              </p>
              {!executionMode.can_execute && (
                <p className="text-vos-xs text-vos-danger mt-2 font-medium">
                  {t('scanExecution.notAvailableRemote', 'This scan type is not available for remote execution.')}
                </p>
              )}
            </Section>
          )}

          <Section
            title={
              <span className="flex items-center gap-2">
                <Server className="w-4 h-4 text-vos-text-3" />
                {t('scans.executionNode', 'Execution node')}
              </span>
            }
            description={t('scans.executionHint', 'Choose where to run the scan. Use a private agent for internal networks.')}
          >
            <div className="space-y-vos-3">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={status === 'running'}
                className="vos-input w-full disabled:opacity-50"
              >
                <option value="auto">{t('scanExec.runAuto', 'Auto — best available (public targets only)')}</option>
                <option value="local">{t('scanExec.runLocal', 'Server — run on cloud (can target private IPs)')}</option>
                {onlineAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} — {agent.ip_address} (private network) · CPU {agent.cpu_usage}%
                  </option>
                ))}
                {agents.filter((a) => a.status !== 'online').map((agent) => (
                  <option key={agent.id} value={agent.id} disabled>
                    {agent.name} — {agent.ip_address} · Offline
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-vos-xs">
                <span className={`w-2 h-2 rounded-full ${onlineAgents.length > 0 ? 'bg-vos-success' : 'bg-vos-text-3'}`} />
                <span className="text-vos-text-3">
                  {onlineAgents.length} agent{onlineAgents.length !== 1 ? 's' : ''} online
                </span>
              </div>
              {isPrivateTarget && selectedAgentId === 'auto' && (
                <div className="rounded-vos-md border border-vos-warning/30 bg-vos-warning/10 px-vos-3 py-vos-2 text-vos-xs text-vos-warning flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Private IP detected. Select <strong>Server</strong> or a private agent to scan internal networks.</span>
                </div>
              )}
              {executionInfo && (
                <KeyValueGrid
                  cols={1}
                  items={[
                    {
                      label: 'Mode',
                      value: (
                        <StatusPill tone={executionInfo.mode === 'agent' ? 'info' : executionInfo.mode === 'delegated' ? 'accent' : 'neutral'}>
                          {executionInfo.mode === 'delegated'
                            ? '⚙️ Scan Engine'
                            : executionInfo.mode === 'agent'
                            ? '🛰️ Agent'
                            : '🖥️ Running on Server'}
                        </StatusPill>
                      ),
                    },
                    ...(executionInfo.agentName ? [{ label: 'Agent', value: `${executionInfo.agentName} (${executionInfo.agentIp || ''})` }] : []),
                    ...(executionInfo.dispatchMethod ? [{ label: 'Transport', value: executionInfo.dispatchMethod === 'websocket' ? 'WebSocket' : 'HTTP polling' }] : []),
                    ...(executionInfo.mode === 'delegated'
                      ? [{ label: 'Engine', value: executionInfo.engineName || 'rust-scan-engine' }]
                      : executionInfo.engineName
                      ? [{ label: 'Engine', value: executionInfo.engineName }]
                      : []),
                  ]}
                />
              )}
            </div>
          </Section>

          {tool && Object.keys(tool.parameters || {}).length > 0 && (
            <Section
              title={
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-vos-text-3" />
                  {t('common.parameters', 'Parameters')}
                </span>
              }
            >
              <div className="space-y-vos-4">
                {Object.entries(tool.parameters || {}).map(([name, param]) => (
                  <div key={name}>
                    <label className="block text-vos-xs uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
                      {name.replace(/_/g, ' ')}
                    </label>
                    {renderParameterInput(name, param)}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            title={
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-vos-text-3" />
                {t('common.status', 'Status')}
              </span>
            }
          >
            <div className="space-y-vos-3">
              <div className="flex items-center gap-vos-3">
                <StatusPill tone={statusMeta.tone} pulse={statusMeta.pulse}>{statusMeta.label}</StatusPill>
                {status === 'running' && (
                  <>
                    <span className="text-vos-sm text-vos-text-2">{progress}%</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-vos-xs text-vos-text-3">
                      <Clock className="w-3 h-3" /> {formatElapsed(elapsedSeconds)}
                    </span>
                  </>
                )}
              </div>

              {status === 'running' && (
                <>
                  <div className="w-full h-1.5 rounded-full bg-vos-bg-elev-1 overflow-hidden">
                    <motion.div
                      className="h-full bg-vos-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-vos-xs">
                    {streamStatus === 'connected' || streamStatus === 'connecting' ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <Info className="w-3 h-3" />
                    )}
                    <StatusPill tone={streamMeta.tone} pulse={streamMeta.pulse}>{streamMeta.label}</StatusPill>
                  </div>
                  {elapsedSeconds > 15 && (
                    <p className="flex items-start gap-1.5 text-vos-xs text-vos-text-3">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" />
                      {t('scans.longRunningHint', 'Scan may take several minutes depending on the target. Output appears as data is available.')}
                    </p>
                  )}
                </>
              )}

              {command && (
                <div className="pt-vos-3 border-t border-vos-border-1">
                  <button
                    onClick={() => setShowCommand(!showCommand)}
                    className="text-vos-xs text-vos-text-3 hover:text-vos-text transition flex items-center gap-1"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${showCommand ? 'rotate-90' : ''}`} />
                    Technical details
                  </button>
                  {showCommand && (
                    <code className="mt-2 block text-vos-xs text-vos-success break-all font-mono">{command}</code>
                  )}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ── Right column: results / terminal ─────────────────────── */}
        <div className="lg:col-span-2 space-y-vos-4">
          {status === 'completed' && (
            <div className="flex items-center gap-vos-2">
              <button
                onClick={() => setViewMode('results')}
                className={`px-vos-4 py-vos-2 rounded-vos-md text-vos-sm font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'results'
                    ? 'bg-vos-accent text-white'
                    : 'bg-vos-bg-elev-1 text-vos-text-3 hover:text-vos-text border border-vos-border-1'
                }`}
              >
                <FileText className="w-4 h-4" />
                Results
              </button>
              <button
                onClick={() => setViewMode('terminal')}
                className={`px-vos-4 py-vos-2 rounded-vos-md text-vos-sm font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'terminal'
                    ? 'bg-vos-accent text-white'
                    : 'bg-vos-bg-elev-1 text-vos-text-3 hover:text-vos-text border border-vos-border-1'
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
                Terminal
              </button>
              <div className="flex-1" />
              <Link
                to={`/dashboard/reports?scan=${currentScanId}`}
                className="px-vos-4 py-vos-2 rounded-vos-md bg-vos-bg-elev-1 text-vos-text-2 border border-vos-border-1 hover:text-vos-text text-vos-sm font-medium transition flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                PDF report
              </Link>
            </div>
          )}

          {viewMode === 'results' && status === 'completed' ? (
            <div className="space-y-vos-6">
              <Section
                title={
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-vos-accent" />
                    Executive summary
                  </span>
                }
                description={`${businessName || tool?.name || ''} • ${target} • ${new Date().toLocaleDateString()}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-vos-6 items-center">
                  <div className="flex items-center justify-center">
                    {securityScore !== null ? (
                      <RiskScore value={Math.max(0, Math.min(100, 100 - securityScore))} size={140} />
                    ) : (
                      <div className="text-center">
                        <Zap className="w-10 h-10 text-vos-text-3 mx-auto" />
                        <p className="text-vos-xs text-vos-text-3 mt-2">{t('scanExec.noScore', 'No score available')}</p>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <SeverityHeatmap counts={severityCounts} total={severityTotal || 1} />
                    <KeyValueGrid
                      className="mt-vos-5"
                      cols={2}
                      items={[
                        { label: 'Security score', value: securityScore !== null ? `${securityScore}/100` : '—' },
                        { label: 'Total findings', value: severityTotal },
                        { label: 'Critical', value: severityCounts.critical },
                        { label: 'High', value: severityCounts.high },
                      ]}
                    />
                  </div>
                </div>
              </Section>

              {businessResults?.findings && businessResults.findings.length > 0 ? (
                <Section title={t('scanExecution.findings', 'Findings')}>
                  <div className="space-y-vos-3">
                    {businessResults.findings.map((f: any, i: number) => {
                      const sev = (f.severity || 'info') as Severity;
                      const tone =
                        sev === 'critical' ? 'danger' :
                        sev === 'high' ? 'danger' :
                        sev === 'medium' ? 'warning' :
                        sev === 'low' ? 'info' : 'neutral';
                      return (
                        <div key={i} className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4">
                          <div className="flex items-start gap-vos-3">
                            <StatusPill tone={tone}>{sev}</StatusPill>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-vos-sm font-semibold text-vos-text">{f.title || f.business_title || 'Finding'}</h4>
                              {f.location && <p className="text-vos-xs text-vos-text-3 mt-0.5 break-words">{f.location}</p>}
                              {f.impact && (
                                <p className="text-vos-xs text-vos-text-2 mt-vos-2">
                                  <strong className="text-vos-text">{t('scanExec.impact', 'Impact')}: </strong>{f.impact}
                                </p>
                              )}
                              {f.fix && (
                                <p className="text-vos-xs text-vos-text-2 mt-1">
                                  <strong className="text-vos-success">{t('scanExec.fix', 'Fix')}: </strong>{f.fix}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              ) : (
                <Section title={t('scanExec.result', 'Result')}>
                  <div className="text-center py-vos-6">
                    <div className="w-14 h-14 mx-auto rounded-full bg-vos-success/10 flex items-center justify-center mb-vos-3">
                      <CheckCircle2 className="w-7 h-7 text-vos-success" />
                    </div>
                    <p className="text-vos-success font-medium">{t('scanExecution.completedSuccessfully', 'Scan completed successfully')}</p>
                    <p className="text-vos-text-3 text-vos-sm mt-1">
                      {t('scanExecution.reviewOutput', 'Review the terminal output for detailed results')}
                    </p>
                    <button
                      onClick={() => setViewMode('terminal')}
                      className="mt-vos-3 px-vos-4 py-vos-2 bg-vos-bg-elev-1 hover:bg-vos-bg-elev-2 text-vos-text-2 border border-vos-border-1 rounded-vos-md text-vos-sm transition"
                    >
                      View terminal output
                    </button>
                  </div>
                </Section>
              )}

              {businessResults?.compliance && (
                <Section title={t('scanExecution.complianceStatus', 'Compliance status')}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-3">
                    {Object.entries(businessResults.compliance).map(([std, val]: [string, any]) => {
                      const passing = val === 'pass' || (typeof val === 'number' && val >= 80);
                      return (
                        <div key={std} className="rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-1 p-vos-3 text-center">
                          <p className="text-vos-xs uppercase tracking-vos-wide text-vos-text-3 font-semibold">{std}</p>
                          <p className={`text-vos-lg font-bold mt-1 ${passing ? 'text-vos-success' : 'text-vos-warning'}`}>
                            {typeof val === 'number' ? `${val}%` : passing ? 'Pass' : 'Review'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {businessResults?.roadmap && businessResults.roadmap.length > 0 && (
                <Section title={t('scanExecution.fixRoadmap', 'Fix roadmap')}>
                  <div className="space-y-vos-2">
                    {businessResults.roadmap.map((item: any, i: number) => {
                      const priority = (item.priority || 'medium').toLowerCase();
                      const tone = priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info';
                      return (
                        <div key={i} className="flex items-center gap-vos-3 rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-1 px-vos-3 py-vos-2">
                          <span className="text-vos-xs font-mono text-vos-text-3 w-20 shrink-0">{item.timeline || `Week ${i + 1}`}</span>
                          <p className="flex-1 text-vos-sm text-vos-text">{item.action || item.title}</p>
                          <StatusPill tone={tone}>{priority}</StatusPill>
                          {item.effort && <span className="text-vos-xs text-vos-text-3">{item.effort}</span>}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          ) : (
            <div className="space-y-vos-4">
              {(status === 'running' || status === 'completed' || status === 'failed') && currentScanId && (
                <ScanProgress scanId={currentScanId} isRunning={status === 'running'} />
              )}

              <div className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden">
                <div className="flex items-center justify-between px-vos-4 py-vos-3 border-b border-vos-border-1 bg-vos-bg-elev-1">
                  <div className="flex items-center gap-vos-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="text-vos-xs text-vos-text-3 font-mono">
                      {businessName || tool?.name || toolId} — {target || 'No target'}
                    </span>
                  </div>
                  <div className="flex items-center gap-vos-2">
                    <StatusPill tone={streamMeta.tone} pulse={streamMeta.pulse}>{streamMeta.label}</StatusPill>
                    <button
                      onClick={() => navigator.clipboard.writeText(output.join('\n'))}
                      className="p-1.5 rounded-vos-sm text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-2 transition"
                      title={t('scanExecution.copyOutput', 'Copy output')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setOutput([])}
                      className="p-1.5 rounded-vos-sm text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-2 transition"
                      title={t('scanExecution.clearOutput', 'Clear output')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={outputRef}
                  className="p-vos-4 font-mono text-vos-sm text-vos-success overflow-auto h-[calc(100vh-280px)] min-h-[420px]"
                  style={{ background: 'var(--vos-bg-base)' }}
                >
                  {output.length === 0 ? (
                    <div className="text-vos-text-3">
                      <p className="text-vos-text-2">{t('scanExecution.readyToExecute', 'Ready to execute security scan.')}</p>
                      <p className="mt-1">{t('scanExecution.enterTarget', 'Enter a target and click "Start scan" to begin.')}</p>
                      <p className="mt-vos-3 text-vos-warning flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Only scan systems you have permission to test.
                      </p>
                    </div>
                  ) : (
                    output.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{line}</div>
                    ))
                  )}
                  {status === 'running' && (
                    <span className="inline-block w-2 h-4 bg-vos-success animate-pulse ml-1 align-middle" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanExecutionPage;

