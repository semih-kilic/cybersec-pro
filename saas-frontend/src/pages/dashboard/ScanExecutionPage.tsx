import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import api, { ScanResult, StreamConnectionStatus, ToolConfig } from '../../services/api';
import { useScanSubscription } from '../../hooks/useWebSocket';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../hooks/useAuth';
import { ScanProgress } from '../../components/dashboard/ScanProgress';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, CACHE_TIMES } from '../../lib/queryClient';
import { useToolExecutionMode, useFetchBusinessReport } from '../../hooks/useApiQueries';

// Business-friendly category names
const BUSINESS_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  network_security: { label: 'Network Security', emoji: '🌐' },
  web_security: { label: 'Web Application Security', emoji: '🔒' },
  vulnerability_assessment: { label: 'Vulnerability Assessment', emoji: '🔍' },
  compliance_audit: { label: 'Compliance & Audit', emoji: '📋' },
  threat_intelligence: { label: 'Threat Intelligence', emoji: '🛡️' },
  forensics_monitoring: { label: 'Forensics & Monitoring', emoji: '📊' },
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

export function ScanExecutionPage() {
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
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [, setResult] = useState<ScanResult | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(scanId || null);
  const [command, setCommand] = useState(searchParams.get('command') || '');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'idle' | StreamConnectionStatus>('idle');
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Agent selection
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('auto');
  const [executionInfo, setExecutionInfo] = useState<{mode: string; agentName?: string; agentIp?: string; dispatchMethod?: string} | null>(null);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const toolId = routeToolId || searchParams.get('tool') || '';
  
  // WebSocket subscription for real-time updates
  const ws = useScanSubscription(status === 'running' ? currentScanId : null);

  // React Query: tool config (cached across tool detail -> execution navigation)
  const { data: toolConfigData } = useQuery({
    queryKey: [...queryKeys.tools.detail(toolId), 'config'],
    queryFn: async () => {
      const response = await api.getToolConfig(toolId);
      return response.data?.tool || null;
    },
    ...CACHE_TIMES.tools,
    enabled: !!toolId,
  });

  // React Query: agents list with auto-refresh  
  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: async () => {
      const response = await api.getAgents();
      return response.data?.agents || [];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Sync tool config from RQ into local state
  useEffect(() => {
    if (toolConfigData && !tool) {
      const t = toolConfigData;
      setTool(t);
      const bName = (t as any).business_name || t.name;
      setBusinessName(bName);
      const cat = t.category || 'vulnerability_assessment';
      const catInfo = BUSINESS_CATEGORIES[cat];
      if (catInfo) {
        setBusinessDescription(`${catInfo.emoji} ${catInfo.label} — This scan helps identify security issues in your systems.`);
      } else {
        setBusinessDescription('🔍 Security Assessment — Comprehensive security testing for your infrastructure.');
      }
      const paramsStr = searchParams.get('params');
      if (!paramsStr && t.parameters && typeof t.parameters === 'object') {
        const defaults: Record<string, string | number | boolean> = {};
        Object.entries(t.parameters).forEach(([key, param]: [string, any]) => {
          if (param.default !== undefined) defaults[key] = param.default;
        });
        if (Object.keys(defaults).length > 0) setParameters(defaults);
      }
      if ((t as any).command_template) setCommand((t as any).command_template);
    }
  }, [toolConfigData]);

  // Sync agents from RQ
  useEffect(() => {
    if (agentsData) setAgents(agentsData as AgentInfo[]);
  }, [agentsData]);

  // Use execution mode from RQ
  const { data: executionModeData } = useToolExecutionMode(toolId);
  const businessReportMutation = useFetchBusinessReport();

  useEffect(() => {
    if (executionModeData) setExecutionMode(executionModeData as any);
  }, [executionModeData]);

  // ── Load existing scan data when navigated with scanId (from email link, View button, etc.) ──
  const loadedScanRef = useRef(false);
  useEffect(() => {
    if (!scanId || loadedScanRef.current || status !== 'idle') return;
    loadedScanRef.current = true;

    (async () => {
      try {
        // First try the result endpoint
        const res = await api.getScan(scanId);
        const scan = res.data?.scan;
        if (!scan) return;

        // Populate state from existing scan data
        if (scan.target) setTarget(scan.target);
        if (scan.tool_name || scan.tool_id) {
          const toolName = scan.tool_name || scan.tool_id || '';
          setBusinessName(toolName);
          setCommand(scan.command || `${toolName} ${scan.target || ''}`);
        }
        if (scan.output) {
          const lines = typeof scan.output === 'string' ? scan.output.split('\n') : [];
          setOutput(lines);
        }
        if (scan.status === 'completed' || scan.status === 'failed') {
          setStatus(scan.status);
          setProgress(100);
          // Fetch business-language results for completed scans
          if (scan.status === 'completed') {
            try {
              const data = await businessReportMutation.mutateAsync(scanId);
              setBusinessResults(data);
              setViewMode('results');
            } catch {
              // Stay in terminal view if business report fails
              setViewMode('terminal');
            }
          }
        } else if (scan.status === 'running') {
          setStatus('running');
          setScanStartTime(Date.now());
        }
      } catch (err) {
        console.error('Failed to load scan:', err);
        // Try direct scan endpoint as fallback
        try {
          const token = localStorage.getItem('auth_token') || '';
          const resp = await fetch(`/api/v1/scans/${scanId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
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
        } catch { /* silently fail */ }
      }
    })();
  }, [scanId]);

  // Auto-start scan when coming from ToolDetailPage with target pre-filled
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartedRef.current && target && toolId && status === 'idle' && searchParams.get('target')) {
      autoStartedRef.current = true;
      // Small delay to allow tool config to load
      const timer = setTimeout(() => handleStartScan(), 500);
      return () => clearTimeout(timer);
    }
  }, [target, toolId, status]);

  useEffect(() => {
    // Auto-scroll output
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);
  
  // Handle WebSocket progress updates
  useEffect(() => {
    if (ws.progress) {
      setProgress(ws.progress.progress);
      if (ws.progress.status && ws.progress.status !== 'running') {
        setStatus(ws.progress.status as 'completed' | 'failed');
      }
    }
  }, [ws.progress]);
  
  // Handle WebSocket output updates
  useEffect(() => {
    if (ws.output.length > 0) {
      const lastOutput = ws.output[ws.output.length - 1];
      setOutput(prev => [...prev, lastOutput.line]);
    }
  }, [ws.output]);
  
  // Handle WebSocket completion
  useEffect(() => {
    if (ws.complete) {
      setStatus(ws.complete.status as 'completed' | 'failed');
      setProgress(100);
      setScanStartTime(null);
      if (ws.complete.status === 'completed') fetchBusinessResults();
    }
  }, [ws.complete]);

  // Elapsed time counter for running scans
  useEffect(() => {
    if (status === 'running' && scanStartTime) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - scanStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [status, scanStartTime]);

  // Fetch business-language results when scan completes
  const fetchBusinessResults = async () => {
    if (!currentScanId) return;
    try {
      const data = await businessReportMutation.mutateAsync(currentScanId);
      setBusinessResults(data);
      setViewMode('results');
    } catch {
      // Results view stays on terminal
    }
  };

  useEffect(() => {
    // Use SSE as primary streaming method (more reliable than WebSocket in production)
    // SSE will stream output line-by-line in real-time
    if (currentScanId && status === 'running') {
      console.log('📡 Starting SSE stream for scan:', currentScanId);
      setStreamStatus('connecting');
      const cleanup = api.streamScanOutput(
        currentScanId,
        (line) => {
          setOutput(prev => [...prev, line]);
        },
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

    if (status !== 'running') {
      setStreamStatus('idle');
    }
  }, [currentScanId, status]);

  const handleStartScan = async () => {
    if (!target) {
      setError('Target is required');
      return;
    }

    // Save target to global context for cross-tool persistence
    addGlobalTarget(target);

    setError(null);
    setOutput([]);
    setStatus('running');
    setExecutionInfo(null);
    setScanStartTime(Date.now());
    setStreamStatus('connecting');
    
    const agentLabel = selectedAgentId === 'local' 
      ? '(Server)' 
      : selectedAgentId === 'auto'
        ? '(Auto-select agent)'
        : `(Agent: ${agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId})`;
    
    setOutput([`🚀 Starting ${tool?.name || toolId} scan on ${target} ${agentLabel}...`, '']);

    const agentId = selectedAgentId !== 'auto' && selectedAgentId !== 'local' ? selectedAgentId : undefined;
    const executionMode = selectedAgentId === 'local' ? 'local' : selectedAgentId === 'auto' ? 'auto' : 'agent';
    const response = await api.executeScan(toolId, target, parameters, agentId, executionMode);
    
    if (response.error) {
      setError(response.error);
      setStatus('failed');
      setOutput(prev => [...prev, `❌ Error: ${response.error}`]);
      return;
    }

    if (response.data) {
      // Backend returns {scan: {id, tool, target, status}} or {scan_id: "..."}
      const scanId = response.data.scan_id || (response.data as any).scan?.id;
      setCurrentScanId(scanId);
      setCommand(response.data.command || (response.data as any).scan?.command || '');
      
      // Set execution info
      const mode = response.data.execution_mode || 'local';
      setExecutionInfo({
        mode,
        agentName: response.data.agent?.name,
        agentIp: response.data.agent?.ip,
        dispatchMethod: response.data.agent?.dispatch_method
      });
      
      if (mode === 'agent' && response.data.agent) {
        setOutput(prev => [
          ...prev, 
          `📡 Dispatched to agent "${response.data!.agent!.name}" (${response.data!.agent!.ip})`,
          `🔗 Method: ${response.data!.agent!.dispatch_method === 'websocket' ? 'WebSocket (real-time)' : 'HTTP Polling'}`,
          `📝 Command: ${response.data?.command || ''}`,
          '',
          '--- Agent Output ---',
          ''
        ]);
      } else {
        setOutput(prev => [...prev, `📝 Command: ${response.data?.command || ''}`, '', '--- Scan Output ---', '']);
      }
    }
  };

  const handleStopScan = async () => {
    if (currentScanId) {
      await api.stopScan(currentScanId);
      setStatus('cancelled');
      setOutput(prev => [...prev, '', '⏹️ Scan cancelled by user']);
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
    setParameters(prev => ({ ...prev, [name]: value }));
  };

  const renderParameterInput = (name: string, param: any) => {
    const value = parameters[name];

    switch (param.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => handleParamChange(name, e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"
            />
            <span className="text-sm text-gray-300">{param.description}</span>
          </label>
        );
      case 'select':
        return (
          <select
            value={value as string || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue"
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
            value={value as string || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            min={param.min}
            max={param.max}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue"
            placeholder={param.description}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value as string || ''}
            onChange={(e) => handleParamChange(name, e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue"
            placeholder={param.description}
          />
        );
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <Header 
        title={`Run: ${businessName || tool?.name || toolId}`}
        subtitle="Execute security assessment"
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Target Input */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-white font-semibold mb-2">🎯 Target <span className="text-red-400">*</span></h3>
              <p className="text-gray-500 text-xs mb-3">Enter the IP address, domain, or URL you want to scan. You must own or have permission to test this target.</p>
              {businessDescription && (
                <p className="text-gray-400 text-xs mb-3 leading-relaxed">{businessDescription}</p>
              )}
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. 192.168.1.0/24, example.com, https://app.example.com"
                disabled={status === 'running'}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                  !target && status === 'idle' ? 'border-yellow-600/50 focus:border-yellow-500' : 'border-gray-700 focus:border-kali-blue'
                }`}
              />
              {!target && status === 'idle' && (
                <p className="text-yellow-500/80 text-xs mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  Target is required to start a scan
                </p>
              )}
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>

            {/* Execution Mode Warning for dangerous tools */}
            {executionMode && executionMode.execution_mode !== 'normal' && (
              <div className={`bg-gray-900 rounded-xl border p-5 ${
                executionMode.execution_mode === 'sandbox' ? 'border-yellow-500/30' :
                executionMode.execution_mode === 'not_applicable' ? 'border-red-500/30' :
                'border-blue-500/30'
              }`}>
                <h3 className={`font-semibold mb-2 text-sm ${
                  executionMode.execution_mode === 'sandbox' ? 'text-yellow-400' :
                  executionMode.execution_mode === 'not_applicable' ? 'text-red-400' :
                  'text-blue-400'
                }`}>
                  {executionMode.execution_mode === 'sandbox' ? '⚠️ Sandboxed Execution' :
                   executionMode.execution_mode === 'rate_limited' ? '⏱️ Rate-Limited Scan' :
                   executionMode.execution_mode === 'simulation' ? '🧪 Simulation Mode' :
                   executionMode.execution_mode === 'headless' ? '🖥️ Headless Mode' :
                   executionMode.execution_mode === 'not_applicable' ? '❌ Not Available' :
                   '⚙️ Special Execution'}
                </h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {executionMode.config?.user_explanation || 
                   executionMode.config?.user_display || 
                   'This tool runs in a restricted environment for safety.'}
                </p>
                {!executionMode.can_execute && (
                  <p className="text-red-400 text-xs mt-2 font-medium">This scan type is not available for remote execution.</p>
                )}
              </div>
            )}

            {/* Agent Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-white font-semibold mb-2">🖥️ Execution Node</h3>
              <p className="text-gray-500 text-xs mb-3">Choose where to run the scan. Use a private agent to scan internal networks behind your firewall.</p>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={status === 'running'}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition disabled:opacity-50"
              >
                <option value="auto">🔄 Auto — Best available (public targets only)</option>
                <option value="local">☁️ Server — Run on cloud server (can target private IPs)</option>
                {agents.filter(a => a.status === 'online').map(agent => (
                  <option key={agent.id} value={agent.id}>
                    🟢 {agent.name} — {agent.ip_address} (Private Network Access) — CPU: {agent.cpu_usage}%
                  </option>
                ))}
                {agents.filter(a => a.status !== 'online').map(agent => (
                  <option key={agent.id} value={agent.id} disabled>
                    🔴 {agent.name} — {agent.ip_address} — Offline
                  </option>
                ))}
              </select>
              
              {/* Online agents count */}
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agents.filter(a => a.status === 'online').length > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">
                  {agents.filter(a => a.status === 'online').length} agent{agents.filter(a => a.status === 'online').length !== 1 ? 's' : ''} online
                </span>
              </div>
              
              {/* Private network scanning hint */}
              {target && (target.startsWith('10.') || target.startsWith('172.') || target.startsWith('192.168.') || target.startsWith('127.')) && selectedAgentId === 'auto' && (
                <div className="mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-400 text-xs">
                    ⚠️ Private IP detected. Select "Server" or a Private Agent to scan internal networks.
                  </p>
                </div>
              )}
              
              {/* Execution info */}
              {executionInfo && (
                <div className={`mt-3 p-2 rounded-lg text-xs ${
                  executionInfo.mode === 'agent' 
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' 
                    : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                }`}>
                  {executionInfo.mode === 'agent' ? (
                    <>
                      <p className="font-semibold">📡 Running on Agent</p>
                      <p>{executionInfo.agentName} ({executionInfo.agentIp})</p>
                      <p>Via: {executionInfo.dispatchMethod === 'websocket' ? 'WebSocket' : 'Polling'}</p>
                    </>
                  ) : (
                    <p className="font-semibold">🖥️ Running on Server</p>
                  )}
                </div>
              )}
            </div>

            {/* Parameters */}
            {tool && Object.keys(tool.parameters || {}).length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="text-white font-semibold mb-4">⚙️ Parameters</h3>
                <div className="space-y-4">
                  {Object.entries(tool.parameters || {}).map(([name, param]) => (
                    <div key={name}>
                      <label className="block text-sm text-gray-400 mb-1.5 capitalize">
                        {name.replace(/_/g, ' ')}
                      </label>
                      {renderParameterInput(name, param)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {status === 'idle' && (
                <button
                  onClick={handleStartScan}
                  disabled={!target.trim()}
                  className="w-full py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Scan
                </button>
              )}

              {status === 'running' && (
                <button
                  onClick={handleStopScan}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Scan
                </button>
              )}

              {(status === 'completed' || status === 'failed' || status === 'cancelled') && (
                <button
                  onClick={handleNewScan}
                  className="w-full py-3 bg-kali-blue hover:bg-kali-blue/80 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  New Scan
                </button>
              )}
            </div>

            {/* Status */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-white font-semibold mb-3">Status</h3>
              <div className="flex items-center gap-3">
                {status === 'idle' && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-gray-400">Ready to scan</span>
                  </>
                )}
                {status === 'running' && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-yellow-500">Scanning... {progress}%</span>
                    <span className="text-gray-500 text-xs ml-auto">
                      {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                    </span>
                  </>
                )}
                {status === 'completed' && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-green-500">Completed</span>
                  </>
                )}
                {status === 'failed' && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-red-500">Failed</span>
                  </>
                )}
                {status === 'cancelled' && (
                  <>
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-orange-500">Cancelled</span>
                  </>
                )}
              </div>
              
              {/* Progress Bar */}
              {status === 'running' && (
                <div className="mt-3">
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-kali-blue to-kali-purple transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    streamStatus === 'connected' ? 'text-green-400' :
                    streamStatus === 'connecting' ? 'text-yellow-400' :
                    streamStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      streamStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                      streamStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                      streamStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    {streamStatus === 'connected' ? 'Live output stream connected' :
                     streamStatus === 'connecting' ? 'Connecting to live output stream...' :
                     streamStatus === 'error' ? 'Live output stream error' : 'Live output stream idle'}
                  </p>
                  {elapsedSeconds > 15 && (
                    <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Scan may take several minutes depending on target and parameters. Output will appear when data is available.
                    </p>
                  )}
                </div>
              )}
              
              {command && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <button 
                    onClick={() => setShowCommand(!showCommand)} 
                    className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showCommand ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Technical Details
                  </button>
                  {showCommand && (
                    <code className="text-xs text-green-400 break-all mt-2 block">{command}</code>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Results / Terminal */}
          <div className="lg:col-span-2">
            {/* View Toggle */}
            {status === 'completed' && (
              <div className="flex gap-2 mb-3">
                <button onClick={() => setViewMode('results')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  📊 Results
                </button>
                <button onClick={() => setViewMode('terminal')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === 'terminal' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  🖥️ Terminal
                </button>
                <div className="flex-1" />
                <Link to={`/dashboard/reports?scan=${currentScanId}`} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
                  📄 PDF Report
                </Link>
              </div>
            )}

            {/* Business Results View */}
            {viewMode === 'results' && status === 'completed' ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-auto h-[calc(100vh-240px)] p-6 space-y-6">
                {/* Executive Summary */}
                <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                  <h2 className="text-lg font-bold text-white mb-3">Security Report: {target}</h2>
                  <p className="text-gray-400 text-sm mb-4">{businessName || tool?.name} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  
                  {businessResults?.summary ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className={`text-3xl font-bold ${(businessResults.summary.score || 0) >= 80 ? 'text-green-400' : (businessResults.summary.score || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {businessResults.summary.score || '--'}/100
                        </p>
                        <p className="text-gray-500 text-xs mt-1">Security Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-red-400">{businessResults.summary.critical || 0}</p>
                        <p className="text-gray-500 text-xs mt-1">Critical</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-orange-400">{businessResults.summary.high || 0}</p>
                        <p className="text-gray-500 text-xs mt-1">High</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-yellow-400">{(businessResults.summary.medium || 0) + (businessResults.summary.low || 0)}</p>
                        <p className="text-gray-500 text-xs mt-1">Medium/Low</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">Scan completed. {output.length} lines of output captured.</p>
                  )}
                </div>

                {/* Vulnerability Cards */}
                {businessResults?.findings && businessResults.findings.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-white font-semibold">Findings</h3>
                    {businessResults.findings.map((f: any, i: number) => (
                      <div key={i} className={`rounded-xl p-4 border ${
                        f.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                        f.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                        f.severity === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-gray-700 bg-gray-800/50'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            f.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                            f.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            f.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{f.severity}</span>
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{f.title || f.business_title || 'Finding'}</h4>
                            {f.location && <p className="text-gray-500 text-xs mt-0.5">{f.location}</p>}
                            {f.impact && <p className="text-gray-400 text-sm mt-2"><strong className="text-gray-300">Impact:</strong> {f.impact}</p>}
                            {f.fix && <p className="text-gray-400 text-sm mt-1"><strong className="text-green-400">Fix:</strong> {f.fix}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-green-400 font-medium">Scan completed successfully</p>
                    <p className="text-gray-500 text-sm mt-1">Review the terminal output for detailed results</p>
                    <button onClick={() => setViewMode('terminal')} className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">
                      View Terminal Output
                    </button>
                  </div>
                )}

                {/* Compliance */}
                {businessResults?.compliance && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Compliance Status</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(businessResults.compliance).map(([std, val]: [string, any]) => (
                        <div key={std} className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700">
                          <p className="text-white font-medium text-sm uppercase">{std}</p>
                          <p className={`text-lg font-bold mt-1 ${val === 'pass' || (typeof val === 'number' && val >= 80) ? 'text-green-400' : 'text-yellow-400'}`}>
                            {typeof val === 'number' ? `${val}%` : val === 'pass' ? '✅' : '⚠️'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fix Roadmap */}
                {businessResults?.roadmap && businessResults.roadmap.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-3">Fix Roadmap</h3>
                    <div className="space-y-2">
                      {businessResults.roadmap.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                          <span className="text-gray-500 text-xs font-mono w-16">{item.timeline || `Week ${i+1}`}</span>
                          <div className="flex-1">
                            <p className="text-white text-sm">{item.action || item.title}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs uppercase font-medium ${
                            item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{item.priority || 'medium'}</span>
                          <span className="text-gray-500 text-xs">{item.effort || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div>
            {/* V12: Scan Progress Stepper */}
            {(status === 'running' || status === 'completed' || status === 'failed') && currentScanId && (
              <ScanProgress
                scanId={currentScanId}
                isRunning={status === 'running'}
              />
            )}

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden h-[calc(100vh-200px)]">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-gray-400 text-sm ml-3">
                    {businessName || tool?.name || toolId} — {target || 'No target'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs mr-2" title={`SSE stream status: ${streamStatus}`}>
                    <span className={`w-2 h-2 rounded-full ${
                      streamStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                      streamStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                      streamStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                    }`} />
                    <span className={
                      streamStatus === 'connected' ? 'text-green-500' :
                      streamStatus === 'connecting' ? 'text-yellow-500' :
                      streamStatus === 'error' ? 'text-red-500' : 'text-gray-500'
                    }>
                      {streamStatus === 'connected' ? 'LIVE' :
                       streamStatus === 'connecting' ? 'CONNECTING' :
                       streamStatus === 'error' ? 'ERROR' : 'IDLE'}
                    </span>
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(output.join(''))}
                    className="p-1.5 text-gray-400 hover:text-white transition"
                    title="Copy output"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setOutput([])}
                    className="p-1.5 text-gray-400 hover:text-white transition"
                    title="Clear output"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Terminal Output */}
              <div 
                ref={outputRef}
                className="p-4 font-mono text-sm text-green-400 bg-gray-950 overflow-auto h-[calc(100%-52px)]"
              >
                {output.length === 0 ? (
                  <div className="text-gray-500">
                    <pre className="text-kali-blue">{`
  ██████╗██╗   ██╗██████╗ ███████╗██████╗ ███████╗███████╗ ██████╗
 ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝
 ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝███████╗█████╗  ██║     
 ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗╚════██║██╔══╝  ██║     
 ╚██████╗   ██║   ██████╔╝███████╗██║  ██║███████║███████╗╚██████╗
  ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝
                                                                   
`}</pre>
                    <p className="mt-4">Ready to execute security scan.</p>
                    <p className="mt-2">Enter a target and click "Start Scan" to begin.</p>
                    <p className="mt-4 text-yellow-500">⚠️ Only scan systems you have permission to test!</p>
                  </div>
                ) : (
                  output.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">{line}</div>
                  ))
                )}
                
                {status === 'running' && (
                  <div className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
                )}
              </div>
            </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

export default ScanExecutionPage;
