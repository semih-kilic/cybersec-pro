import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { ToolDetailPageSkeleton } from '../../components/ui/Skeleton';
import { getToolConfig, getSmartDefaults, ToolConfig } from '../../config/toolConfigs';
import { useTarget } from '../../contexts/TargetContext';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, CACHE_TIMES } from '../../lib/queryClient';
import { useAgentsList } from '../../hooks/useApiQueries';
import api, { StreamConnectionStatus } from '../../services/api';

const TARGET_STORAGE_KEY = 'cybersec_recent_targets';
function getRecentTargets(): string[] {
  try { return JSON.parse(localStorage.getItem(TARGET_STORAGE_KEY) || '[]'); } catch { return []; }
}
function addRecentTarget(target: string): void {
  if (!target) return;
  const targets = getRecentTargets().filter(t => t !== target);
  targets.unshift(target);
  localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(targets.slice(0, 10)));
}

interface ToolParameter {
  name: string; flag: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'file';
  required: boolean; default?: string; placeholder?: string;
  options?: string[]; description?: string; group?: string;
  secret?: boolean;
}

const SECRET_NAME_RE = /pass|secret|token|api[_-]?key|credential/i;

interface Tool {
  id: string; name: string; slug?: string; description: string;
  category: string; plan_required: string; is_active: boolean;
  parameters: ToolParameter[];
  command_template?: string | null;
  documentation?: string;
  examples?: { name: string; command: string; description: string }[];
}

const getToolSlug = (tool: Tool): string => tool.slug || tool.name?.toLowerCase().replace(/\s+/g, '') || 'unknown';

export function ToolDetailPage() {
  const { t } = useTranslation();
  const { toolId } = useParams<{ toolId: string }>();
  const toast = useToast();
  const { token: _token } = useAuth();
  const { target: globalTarget, addRecentTarget: addGlobalTarget } = useTarget();
  const [paramValues, setParamValues] = useState<{ [key: string]: string | number | boolean }>({});
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [activeTab, setActiveTab] = useState<'params' | 'docs' | 'examples'>('params');
  const [recentTargets, setRecentTargets] = useState<string[]>([]);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('server');

  // === INLINE SCAN EXECUTION STATE ===
  const [scanStatus, setScanStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [scanOutput, setScanOutput] = useState<string[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'idle' | StreamConnectionStatus>('idle');
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanCommand, setScanCommand] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);

  const { data: agentsList } = useAgentsList();
  const agents = (agentsList || []) as { id: string | number; name: string; ip_address?: string; status: string; platform?: string }[];

  const { data: toolQueryData, isLoading: loading } = useQuery({
    queryKey: queryKeys.tools.detail(toolId || ''),
    queryFn: async (): Promise<{ tool: Tool; category: string; config: ToolConfig | null }> => {
      let category = '';
      try {
        const v2Res = await fetch(`/api/v2/tools/${toolId}`);
        if (v2Res.ok) { const v2Data = await v2Res.json(); if (v2Data.success && v2Data.tool) category = v2Data.tool.category || ''; }
      } catch { /* optional */ }
      try {
        const res = await fetch(`/api/v1/tools/${toolId}/config`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
        if (res.ok) { const data = await res.json(); if (data.tool) { if (!category && data.tool.category) category = data.tool.category; return { tool: data.tool, category, config: null }; } }
      } catch { /* fallback */ }
      const config = getToolConfig(toolId || '', category || undefined);
      return { tool: { id: toolId || '', name: config.name || toolId?.toUpperCase() || '', slug: toolId || '', description: config.description, category: category || config.category, plan_required: 'starter', is_active: true, parameters: config.parameters, documentation: config.documentation, examples: config.examples }, category: category || config.category, config };
    },
    ...CACHE_TIMES.tools, enabled: !!toolId,
  });

  const tool = toolQueryData?.tool || null;
  const toolCategory = toolQueryData?.category || '';
  const toolConfig = toolQueryData?.config || (tool && toolId ? getToolConfig(toolId, toolCategory || undefined) : null);

  useDocumentTitle(tool ? `${tool.name} — CyberSec Pro` : 'Tool — CyberSec Pro');

  useEffect(() => { setRecentTargets(getRecentTargets()); }, [toolId]);

  useEffect(() => {
    if (globalTarget && tool) {
      const tp = findTargetParam();
      if (tp && !paramValues[tp.name]) setParamValues(prev => ({ ...prev, [tp.name]: globalTarget }));
    }
  }, [globalTarget, tool]);

  useEffect(() => { if (tool && toolId) generateCommand(); }, [paramValues, tool, toolId]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [scanOutput]);

  useEffect(() => {
    if (scanStatus === 'running' && scanStartTime) {
      const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - scanStartTime) / 1000)), 1000);
      return () => clearInterval(interval);
    }
    if (scanStatus !== 'running') setElapsedSeconds(0);
  }, [scanStatus, scanStartTime]);

  useEffect(() => () => { if (sseCleanupRef.current) sseCleanupRef.current(); }, []);

  const getNormalizedParams = (): ToolParameter[] => {
    if (toolConfig) return toolConfig.parameters;
    if (!tool) return [];
    if (Array.isArray(tool.parameters) && tool.parameters.length > 0) return tool.parameters;
    // Hackingtool seed shape: { form: [{name,label,type,required,placeholder,default,options}], danger_level, target_types }
    if (tool.parameters && typeof tool.parameters === 'object' && Array.isArray((tool.parameters as any).form)) {
      const form = (tool.parameters as any).form as Array<any>;
      return form.map((f) => {
        const isSecret = f.type === 'password' || SECRET_NAME_RE.test(String(f.name || ''));
        return {
          name: f.name,
          flag: '', // Backend handles substitution via command_template {placeholders}
          type: (f.type === 'url' || f.type === 'email' || f.type === 'password') ? 'text' : (f.type as ToolParameter['type']),
          required: !!f.required,
          default: f.default !== undefined ? String(f.default) : undefined,
          placeholder: f.placeholder || (f.default !== undefined ? String(f.default) : ''),
          options: f.options,
          description: f.label || f.name,
          group: 'Parameters',
          secret: isSecret,
        } as ToolParameter;
      });
    }
    if (tool.parameters && typeof tool.parameters === 'object') {
      return Object.entries(tool.parameters).map(([key, param]: [string, any]) => ({
        name: param.description || key, flag: param.flag || '', type: param.type || 'text',
        required: param.required || false, default: param.default, placeholder: param.placeholder || param.default || '',
        options: param.options, description: param.description || key, group: param.group || 'General'
      }));
    }
    return getToolConfig(getToolSlug(tool)).parameters;
  };

  const findTargetParam = () => {
    const params = getNormalizedParams();
    return params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url') || p.name.toLowerCase().includes('domain') || p.name.toLowerCase().includes('input'))) || params.find(p => p.required);
  };

  const getTargetValue = (): string => {
    const tp = findTargetParam();
    return tp ? (paramValues[tp.name] as string) || '' : '';
  };

  const generateCommand = () => {
    if (!tool) return;
    // If the tool ships with a command_template (zero-code tools), substitute
    // {placeholder} tokens with the user's form values for an accurate preview.
    if (tool.command_template && tool.command_template.trim()) {
      let cmd = tool.command_template;
      Object.entries(paramValues).forEach(([k, v]) => {
        if (v === undefined || v === '' || v === false) return;
        cmd = cmd.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
      setGeneratedCommand(cmd);
      return;
    }
    let cmd = getToolSlug(tool);
    getNormalizedParams().forEach(param => {
      const value = paramValues[param.name];
      if (value !== undefined && value !== '' && value !== false) {
        if (param.type === 'boolean' && value === true) cmd += ` ${param.flag}`;
        else if (param.flag === '') cmd += ` ${value}`;
        else cmd += ` ${param.flag} ${value}`;
      }
    });
    setGeneratedCommand(cmd);
  };

  const handleParamChange = (name: string, value: string | boolean) => setParamValues(prev => ({ ...prev, [name]: value }));

  const handleRunScan = async () => {
    const scanTarget = getTargetValue();
    if (!scanTarget) { toast.warning('Target Required', 'Please enter a target to scan'); return; }

    addGlobalTarget(scanTarget);
    addRecentTarget(scanTarget);
    setRecentTargets(getRecentTargets());

    setScanError(null);
    setScanOutput([]);
    setScanStatus('running');
    setStreamStatus('connecting');
    setScanProgress(0);
    setScanStartTime(Date.now());
    setScanCommand('');

    const agentName = selectedAgentId !== 'server' ? agents.find(a => String(a.id) === selectedAgentId)?.name : null;
    const agentLabel = agentName ? `(Agent: ${agentName})` : '(Server)';
    setScanOutput([`🚀 Starting ${tool?.name || toolId} scan on ${scanTarget} ${agentLabel}...`, '']);

    if (sseCleanupRef.current) { sseCleanupRef.current(); sseCleanupRef.current = null; }

    const agentId = selectedAgentId !== 'server' ? selectedAgentId : undefined;
    try {
      const response = await api.executeScan(toolId || '', scanTarget, paramValues, agentId, agentId ? 'agent' : 'local');

      if (response.error) {
        setScanError(response.error);
        setScanStatus('failed');
        setScanOutput(prev => [...prev, `❌ Error: ${response.error}`]);
        return;
      }

      if (response.data) {
        const newScanId = response.data.scan_id || (response.data as any).scan?.id;
        setScanId(newScanId);
        setScanCommand(response.data.command || '');
        setScanOutput(prev => [...prev, `📝 Command: ${response.data?.command || ''}`, '', '--- Scan Output ---', '']);

        if (newScanId) {
          const cleanup = api.streamScanOutput(
            newScanId,
            (line) => setScanOutput(prev => [...prev, line]),
            (scanResult) => {
              const finalStatus = scanResult.status === 'timeout' ? 'failed' : scanResult.status;
              setScanStatus(finalStatus as 'completed' | 'failed');
              setScanProgress(100);
              setScanStartTime(null);
            },
            (nextStatus) => setStreamStatus(nextStatus)
          );
          sseCleanupRef.current = cleanup;
        }
      }
    } catch (err: any) {
      setScanError(err.message || 'Scan failed to start');
      setScanStatus('failed');
      setScanOutput(prev => [...prev, `❌ Error: ${err.message || 'Unknown error'}`]);
    }
  };

  const handleQuickScan = (mode: 'quick' | 'standard' | 'deep') => {
    const tp = findTargetParam();
    const scanTarget = getTargetValue();
    if (!scanTarget) { toast.warning('Target Required', 'Please enter a target first'); return; }
    const defaults = getSmartDefaults(toolId || '', mode);
    setParamValues(prev => ({ ...prev, ...defaults, [tp?.name || 'Target']: scanTarget }));
    setTimeout(() => handleRunScan(), 100);
  };

  const handleStopScan = async () => {
    if (scanId) {
      await api.stopScan(scanId);
      setScanStatus('cancelled');
      setStreamStatus('idle');
      setScanOutput(prev => [...prev, '', '⏹️ Scan cancelled by user']);
      if (sseCleanupRef.current) { sseCleanupRef.current(); sseCleanupRef.current = null; }
    }
  };

  const handleNewScan = () => {
    setScanStatus('idle');
    setScanOutput([]);
    setScanId(null);
    setScanError(null);
    setScanProgress(0);
    setScanCommand('');
    setStreamStatus('idle');
    if (sseCleanupRef.current) { sseCleanupRef.current(); sseCleanupRef.current = null; }
  };

  const handleSelectTarget = (target: string) => {
    const tp = findTargetParam();
    if (tp) setParamValues(prev => ({ ...prev, [tp.name]: target }));
    setShowTargetDropdown(false);
  };

  if (loading) return <ToolDetailPageSkeleton />;
  if (!tool) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">{t('tools.notFound', 'Tool Not Found')}</h2>
        <Link to="/dashboard/tools" className="text-kali-blue hover:underline">{t('tools.backToTools', 'Back to Tools')}</Link>
      </div>
    </div>
  );

  const normalizedParams = getNormalizedParams();
  const groupedParams = normalizedParams.reduce((acc, param) => {
    const group = param.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(param);
    return acc;
  }, {} as { [key: string]: ToolParameter[] });

  const isScanning = scanStatus === 'running';
  const scanDone = scanStatus === 'completed' || scanStatus === 'failed' || scanStatus === 'cancelled';

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <Header title={tool.name} subtitle={tool.description} />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Config */}
          <div className="space-y-6">
            {/* Target */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎯</span>
                <h3 className="text-white font-semibold">{t('common.target', 'Target')} <span className="text-red-400">*</span></h3>
              </div>
              <p className="text-gray-500 text-xs mb-3">{t('scans.targetHint', 'Enter the IP address, domain, or URL you want to scan. You must own or have permission to test this target.')}</p>
              <input
                type="text"
                placeholder={t('scans.targetPlaceholder', 'e.g. 192.168.1.0/24, example.com, https://app.example.com')}
                value={getTargetValue()}
                onChange={(e) => { const tp = findTargetParam(); if (tp) setParamValues(prev => ({ ...prev, [tp.name]: e.target.value })); }}
                disabled={isScanning}
                onKeyDown={(e) => { if (e.key === 'Enter' && getTargetValue()) handleRunScan(); }}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${!getTargetValue() ? 'border-yellow-600/50 focus:border-yellow-500' : 'border-gray-700 focus:border-kali-blue'}`}
              />
              {!getTargetValue() && scanStatus === 'idle' && (
                <p className="text-yellow-500/80 text-xs mt-2">⚠️ {t('scans.targetRequired', 'Target is required to start a scan')}</p>
              )}
              {recentTargets.length > 0 && scanStatus === 'idle' && (
                <div className="mt-3 relative">
                  <button onClick={() => setShowTargetDropdown(!showTargetDropdown)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                    <svg className={`w-3 h-3 transition ${showTargetDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    Recent Targets ({recentTargets.length})
                  </button>
                  {showTargetDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-36 overflow-y-auto">
                      {recentTargets.map((t, idx) => (
                        <button key={idx} onClick={() => handleSelectTarget(t)} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition first:rounded-t-lg last:rounded-b-lg">{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Execution Node */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🖥️</span>
                <h3 className="text-white font-semibold">{t('toolDetail.executionNode', 'Execution Node')}</h3>
              </div>
              <p className="text-gray-500 text-xs mb-3">{t('toolDetail.executionHint', 'Choose where to run the scan. Use a private agent to scan internal networks behind your firewall.')}</p>
              <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} disabled={isScanning}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition text-sm disabled:opacity-50">
                <option value="server">☁️ Server (Default)</option>
                {agents.filter(a => a.status === 'online').map(agent => (
                  <option key={agent.id} value={String(agent.id)}>🟢 {agent.name} — {agent.ip_address || 'Private Network'}</option>
                ))}
                {agents.filter(a => a.status !== 'online').map(agent => (
                  <option key={agent.id} value={String(agent.id)} disabled>🔴 {agent.name} — Offline</option>
                ))}
              </select>
              <div className="mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agents.filter(a => a.status === 'online').length > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">{agents.filter(a => a.status === 'online').length} agent(s) online</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-3">
              {(['params', 'docs', 'examples'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? 'bg-kali-blue text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  {tab === 'params' ? `⚙️ ${t('tools.parameters', 'Parameters')}` : tab === 'docs' ? `📖 ${t('tools.docs', 'Docs')}` : `📋 ${t('tools.examples', 'Examples')}`}
                </button>
              ))}
            </div>

            {activeTab === 'params' && (
              <div className="space-y-4">
                {Object.entries(groupedParams).map(([group, params]) => (
                  <div key={group} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-kali-blue" />{group}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {params.filter(p => {
                        const n = p.name.toLowerCase();
                        return !(n.includes('target') || n === 'host' || n === 'url' || n === 'domain' || n === 'input');
                      }).map(param => (
                        <div key={param.name} className={param.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <label className="block text-sm text-gray-400 mb-1.5">
                            {param.name}{param.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {param.type === 'text' && <input type={param.secret ? 'password' : 'text'} autoComplete={param.secret ? 'new-password' : 'off'} placeholder={param.placeholder} value={(paramValues[param.name] as string) || ''} onChange={(e) => handleParamChange(param.name, e.target.value)} disabled={isScanning} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition disabled:opacity-50" />}
                          {param.secret && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                              <span>🔒</span>
                              <span>{t('toolDetail.zeroKnowledge', 'Zero-knowledge — credentials are sent to your agent only and are never persisted on our servers.')}</span>
                              <Link to="/dashboard/privacy" className="underline hover:text-emerald-300">{t('toolDetail.learnMore', 'Learn more')}</Link>
                            </p>
                          )}
                          {param.type === 'number' && <input type="number" placeholder={param.placeholder} value={(paramValues[param.name] as string) || ''} onChange={(e) => handleParamChange(param.name, e.target.value)} disabled={isScanning} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition disabled:opacity-50" />}
                          {param.type === 'select' && (
                            <select value={(paramValues[param.name] as string) || ''} onChange={(e) => handleParamChange(param.name, e.target.value)} disabled={isScanning} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition disabled:opacity-50">
                              <option value="">{t('common.selectDots', 'Select...')}</option>
                              {param.options?.map(opt => <option key={opt} value={opt.split(' ')[0]}>{opt}</option>)}
                            </select>
                          )}
                          {param.type === 'boolean' && (
                            <label className="flex items-center gap-3 cursor-pointer">
                              <div className="relative">
                                <input type="checkbox" checked={(paramValues[param.name] as boolean) || false} onChange={(e) => handleParamChange(param.name, e.target.checked)} disabled={isScanning} className="sr-only" />
                                <div className={`w-10 h-6 rounded-full transition ${paramValues[param.name] ? 'bg-kali-blue' : 'bg-gray-700'}`}>
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${paramValues[param.name] ? 'left-5' : 'left-1'}`} />
                                </div>
                              </div>
                              <span className="text-sm text-gray-300">{t('common.active', 'Enable')}</span>
                            </label>
                          )}
                          {param.type === 'textarea' && <textarea placeholder={param.placeholder} value={(paramValues[param.name] as string) || ''} onChange={(e) => handleParamChange(param.name, e.target.value)} rows={3} disabled={isScanning} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition resize-none disabled:opacity-50" />}
                          {param.description && <p className="text-xs text-gray-500 mt-1">{param.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <pre className="text-gray-300 whitespace-pre-wrap text-sm">{tool.documentation || 'No documentation available.'}</pre>
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="space-y-4">
                {(tool.examples || []).map((example, idx) => (
                  <div key={idx} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">{example.name}</h4>
                      <button onClick={() => navigator.clipboard.writeText(example.command)} className="text-gray-400 hover:text-white transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                    <code className="block bg-gray-950 rounded-lg p-3 text-green-400 font-mono text-sm mb-2">{example.command}</code>
                    <p className="text-sm text-gray-400">{example.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Actions + Terminal */}
          <div className="space-y-6">
            {/* Quick Scan Modes */}
            {toolConfig && scanStatus === 'idle' && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-kali-blue/30 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">⚡ Quick Scan</h3>
                <div className="grid grid-cols-3 gap-2">
                  {toolConfig.scanModes.map((mode) => (
                    <button key={mode.name} onClick={() => handleQuickScan(mode.name)}
                      className={`p-3 rounded-lg text-center transition border ${mode.name === 'quick' ? 'bg-green-500/10 border-green-500/50 hover:bg-green-500/20' : mode.name === 'standard' ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' : 'bg-purple-500/10 border-purple-500/50 hover:bg-purple-500/20'}`}>
                      <div className={`font-semibold text-sm ${mode.name === 'quick' ? 'text-green-400' : mode.name === 'standard' ? 'text-blue-400' : 'text-purple-400'}`}>{mode.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{mode.estimatedTime}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Command Preview + Run Button */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">{t('tools.command', 'Command')}</h3>
                <button onClick={() => navigator.clipboard.writeText(generatedCommand)} className="text-gray-400 hover:text-white transition p-1" title="Copy">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
              <div className="bg-gray-950 rounded-lg p-3 mb-4">
                <code className="text-green-400 font-mono text-sm break-all">{scanCommand || generatedCommand || getToolSlug(tool)}</code>
              </div>

              {scanStatus === 'idle' && (tool as any).gui_required && (
                <div className="mb-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                  <p className="text-blue-400 text-sm font-medium">⚡ GUI Tool — Runs headlessly via Xvfb virtual framebuffer on the server.</p>
                </div>
              )}
              {scanStatus === 'idle' && (
                <button onClick={handleRunScan} disabled={!getTargetValue().trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-bold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {t('scans.newScan', 'Run Scan')}
                </button>
              )}
              {scanStatus === 'running' && (
                <button onClick={handleStopScan} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                  {t('common.cancel', 'Stop Scan')}
                </button>
              )}
              {scanDone && (
                <button onClick={handleNewScan} className="w-full py-3.5 bg-kali-blue hover:bg-kali-blue/80 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {t('scans.newScan', 'New Scan')}
                </button>
              )}

              {scanStatus === 'running' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-yellow-500 text-sm">Scanning... {scanProgress}%</span>
                    </div>
                    <span className="text-gray-500 text-xs">{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-kali-blue to-kali-purple transition-all duration-300" style={{ width: `${Math.max(scanProgress, 5)}%` }} />
                  </div>
                </div>
              )}

              {scanDone && (
                <div className="mt-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${scanStatus === 'completed' ? 'bg-green-500' : scanStatus === 'cancelled' ? 'bg-orange-500' : 'bg-red-500'}`} />
                  <span className={`text-sm font-medium ${scanStatus === 'completed' ? 'text-green-400' : scanStatus === 'cancelled' ? 'text-orange-400' : 'text-red-400'}`}>
                    {scanStatus === 'completed' ? 'Scan Completed' : scanStatus === 'cancelled' ? 'Scan Cancelled' : 'Scan Failed'}
                  </span>
                </div>
              )}
              {scanError && <p className="text-red-400 text-sm mt-3">{scanError}</p>}
            </div>

            {/* Terminal Output */}
            {(scanStatus !== 'idle' || scanOutput.length > 0) && (
              <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="text-gray-400 text-sm font-mono">{tool.name} — {getTargetValue() || 'No target'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {scanStatus === 'running' && <span className="text-green-400 text-xs flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE</span>}
                    {scanStatus === 'running' && (
                      <span className={`text-xs flex items-center gap-1 ${
                        streamStatus === 'connected' ? 'text-green-400' :
                        streamStatus === 'connecting' ? 'text-yellow-400' :
                        streamStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          streamStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                          streamStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                          streamStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        {streamStatus === 'connected' ? 'SSE LIVE' :
                         streamStatus === 'connecting' ? 'SSE CONNECTING' :
                         streamStatus === 'error' ? 'SSE ERROR' : 'SSE IDLE'}
                      </span>
                    )}
                    {scanDone && <span className={`text-xs font-semibold ${scanStatus === 'completed' ? 'text-green-400' : 'text-red-400'}`}>{scanStatus.toUpperCase()}</span>}
                    <button onClick={() => navigator.clipboard.writeText(scanOutput.join('\n'))} className="text-gray-500 hover:text-white transition" title="Copy output">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>
                <div ref={outputRef} className="p-4 overflow-auto font-mono text-sm leading-relaxed" style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '300px' }}>
                  {scanOutput.map((line, i) => (
                    <div key={i} className={`${line.startsWith('🚀') || line.startsWith('📝') || line.startsWith('📡') ? 'text-cyan-400' : line.startsWith('❌') ? 'text-red-400' : line.startsWith('⏹️') ? 'text-orange-400' : line.startsWith('---') ? 'text-gray-600' : 'text-green-400'}`}>
                      {line || '\u200B'}
                    </div>
                  ))}
                  {scanStatus === 'running' && <div className="text-green-500 animate-pulse">▌</div>}
                </div>
              </div>
            )}

            {/* Ready State */}
            {scanStatus === 'idle' && scanOutput.length === 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="text-white font-semibold mb-2">{t('scans.readyToScan', 'Ready to Scan')}</h3>
                  <p className="text-gray-500 text-sm">{t('scans.readyHint', 'Enter a target and click "Run Scan" to start.')}</p>
                  <p className="text-yellow-500/70 text-xs mt-3">⚠️ Only scan systems you have permission to test!</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2"><span>📂</span> Category: {tool.category}</div>
                  <div className="flex items-center gap-2"><span>🛡️</span> Plan: {tool.plan_required}</div>
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

export default ToolDetailPage;
