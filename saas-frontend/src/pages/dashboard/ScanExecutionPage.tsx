import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import api, { ScanResult, ToolConfig } from '../../services/api';
import { useScanSubscription } from '../../hooks/useWebSocket';
import { useTarget } from '../../contexts/TargetContext';
import { useAuth } from '../../hooks/useAuth';

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
  const { scanId, toolId: routeToolId } = useParams<{ scanId: string; toolId: string }>();
  const [searchParams] = useSearchParams();
  const { target: globalTarget, addRecentTarget: addGlobalTarget } = useTarget();
  const { token } = useAuth();
  
  const [tool, setTool] = useState<ToolConfig | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessDescription, setBusinessDescription] = useState<string>('');
  const [executionMode, setExecutionMode] = useState<ToolExecutionMode | null>(null);
  const [showCommand, setShowCommand] = useState(false);
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
  
  // Agent selection
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('auto');
  const [executionInfo, setExecutionInfo] = useState<{mode: string; agentName?: string; agentIp?: string; dispatchMethod?: string} | null>(null);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const toolId = routeToolId || searchParams.get('tool') || '';
  
  // WebSocket subscription for real-time updates
  const ws = useScanSubscription(status === 'running' ? currentScanId : null);

  useEffect(() => {
    fetchToolConfig();
    fetchExecutionMode();
  }, [toolId]);

  // Fetch execution mode for dangerous tool handling
  const fetchExecutionMode = async () => {
    if (!toolId) return;
    try {
      const res = await fetch(`/api/v1/tools/${toolId}/execution-mode`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExecutionMode(data);
      }
    } catch {
      // Not critical
    }
  };

  // Fetch available agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await api.getAgents();
        if (response.data?.agents) {
          setAgents(response.data.agents);
        }
      } catch {
        // Agents feature optional - ignore errors
      }
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

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
    }
  }, [ws.complete]);

  useEffect(() => {
    // Use SSE as primary streaming method (more reliable than WebSocket in production)
    // SSE will stream output line-by-line in real-time
    if (currentScanId && status === 'running') {
      console.log('📡 Starting SSE stream for scan:', currentScanId);
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
        }
      );

      return cleanup;
    }
  }, [currentScanId, status]);

  const fetchToolConfig = async () => {
    const response = await api.getToolConfig(toolId);
    if (response.data) {
      const t = response.data.tool;
      setTool(t);
      
      // Set business-friendly name
      const bName = t.business_name || t.name;
      setBusinessName(bName);
      
      // Generate business description based on category
      const cat = t.category || 'vulnerability_assessment';
      const catInfo = BUSINESS_CATEGORIES[cat];
      if (catInfo) {
        setBusinessDescription(`${catInfo.emoji} ${catInfo.label} — This scan helps identify security issues in your systems.`);
      } else {
        setBusinessDescription('🔍 Security Assessment — Comprehensive security testing for your infrastructure.');
      }
      // Set default values only if no parameters were passed from ToolDetailPage
      const paramsStr = searchParams.get('params');
      if (!paramsStr) {
        const defaults: Record<string, string | number | boolean> = {};
        Object.entries(response.data.tool.parameters || {}).forEach(([key, param]) => {
          if (param.default !== undefined) {
            defaults[key] = param.default;
          }
        });
        setParameters(defaults);
      }
    }
  };

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
    
    const agentLabel = selectedAgentId === 'local' 
      ? '(Server)' 
      : selectedAgentId === 'auto'
        ? '(Auto-select agent)'
        : `(Agent: ${agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId})`;
    
    setOutput([`🚀 Starting ${tool?.name || toolId} scan on ${target} ${agentLabel}...`, '']);

    const agentId = selectedAgentId === 'auto' ? undefined : selectedAgentId === 'local' ? undefined : selectedAgentId;
    const response = await api.executeScan(toolId, target, parameters, agentId);
    
    if (response.error) {
      setError(response.error);
      setStatus('failed');
      setOutput(prev => [...prev, `❌ Error: ${response.error}`]);
      return;
    }

    if (response.data) {
      setCurrentScanId(response.data.scan_id);
      setCommand(response.data.command || '');
      
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
    <div className="min-h-screen bg-gray-950">
      <Header 
        title={`Run: ${businessName || tool?.name || toolId}`}
        subtitle="Execute security assessment"
        breadcrumb={[
          { label: 'Tools', href: '/dashboard/tools' },
          { label: businessName || tool?.name || toolId, href: `/dashboard/tools/${toolId}` },
          { label: 'Run Scan' }
        ]}
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Target Input */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-white font-semibold mb-2">🎯 Target</h3>
              {businessDescription && (
                <p className="text-gray-400 text-xs mb-3 leading-relaxed">{businessDescription}</p>
              )}
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="scanme.nmap.org or your public domain"
                disabled={status === 'running'}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition disabled:opacity-50"
              />
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
              <h3 className="text-white font-semibold mb-4">🖥️ Execution Mode</h3>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={status === 'running'}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition disabled:opacity-50"
              >
                <option value="auto">🔄 Auto (Agent preferred, server fallback)</option>
                <option value="local">🖥️ Server (Local execution)</option>
                {agents.filter(a => a.status === 'online').map(agent => (
                  <option key={agent.id} value={agent.id}>
                    🟢 {agent.name} ({agent.ip_address}) - CPU: {agent.cpu_usage}%
                  </option>
                ))}
                {agents.filter(a => a.status !== 'online').map(agent => (
                  <option key={agent.id} value={agent.id} disabled>
                    🔴 {agent.name} ({agent.ip_address}) - Offline
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
                  className="w-full py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
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
                  {ws.connected && (
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Real-time updates active
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

          {/* Right: Output Terminal */}
          <div className="lg:col-span-2">
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
        </div>
      </div>
    </div>
  );
}

export default ScanExecutionPage;
