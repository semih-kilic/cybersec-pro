import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

// Target Memory - now uses global TargetContext for cross-tool persistence
const TARGET_STORAGE_KEY = 'cybersec_recent_targets';

function getRecentTargets(): string[] {
  try {
    const stored = localStorage.getItem(TARGET_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentTarget(target: string): void {
  if (!target) return;
  const targets = getRecentTargets().filter(t => t !== target);
  targets.unshift(target);
  localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(targets.slice(0, 10)));
}

interface ToolParameter {
  name: string;
  flag: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'file';
  required: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
  description?: string;
  group?: string;
}

interface Tool {
  id: string;
  name: string;
  slug?: string;
  description: string;
  category: string;
  plan_required: string;
  is_active: boolean;
  parameters: ToolParameter[];
  documentation?: string;
  examples?: { name: string; command: string; description: string }[];
}

// Get tool slug from name (handle missing slug field)
const getToolSlug = (tool: Tool): string => {
  return tool.slug || tool.name?.toLowerCase().replace(/\s+/g, '') || 'unknown';
};

// Tool parameters now managed by toolConfigs.ts - see /config/toolConfigs.ts

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { token: _token } = useAuth();
  const { target: globalTarget, addRecentTarget: addGlobalTarget } = useTarget();
  const [paramValues, setParamValues] = useState<{ [key: string]: string | number | boolean }>({});
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [activeTab, setActiveTab] = useState<'params' | 'docs' | 'examples'>('params');
  
  // New: One-Click Scan and Target Memory
  const [recentTargets, setRecentTargets] = useState<string[]>([]);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('server');

  // Fetch agents for execution selector
  const { data: agentsList } = useAgentsList();
  const agents = (agentsList || []) as { id: string | number; name: string; ip_address?: string; status: string; platform?: string }[];

  // React Query: fetch tool data with caching
  const { data: toolQueryData, isLoading: loading } = useQuery({
    queryKey: queryKeys.tools.detail(toolId || ''),
    queryFn: async (): Promise<{ tool: Tool; category: string; config: ToolConfig | null }> => {
      let category = '';
      // First fetch category info from V2 API
      try {
        const v2Res = await fetch(`/api/v2/tools/${toolId}`);
        if (v2Res.ok) {
          const v2Data = await v2Res.json();
          if (v2Data.success && v2Data.tool) {
            category = v2Data.tool.category || '';
          }
        }
      } catch { /* V2 API optional */ }

      // Fetch tool configuration from V1 API
      try {
        const res = await fetch(`/api/v1/tools/${toolId}/config`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tool) {
            if (!category && data.tool.category) category = data.tool.category;
            return { tool: data.tool, category, config: null };
          }
        }
      } catch { /* fallback below */ }

      // Fallback: use smart config system
      const config = getToolConfig(toolId || '', category || undefined);
      const fallbackTool: Tool = {
        id: toolId || '',
        name: config.name || toolId?.toUpperCase() || '',
        slug: toolId || '',
        description: config.description,
        category: category || config.category,
        plan_required: 'starter',
        is_active: true,
        parameters: config.parameters,
        documentation: config.documentation,
        examples: config.examples,
      };
      return { tool: fallbackTool, category: category || config.category, config };
    },
    ...CACHE_TIMES.tools,
    enabled: !!toolId,
  });

  const tool = toolQueryData?.tool || null;
  const toolCategory = toolQueryData?.category || '';
  const toolConfig = toolQueryData?.config || (tool && toolId ? getToolConfig(toolId, toolCategory || undefined) : null);

  useDocumentTitle(tool ? `${tool.name} — CyberSec Pro` : 'Tool — CyberSec Pro');

  useEffect(() => {
    setRecentTargets(getRecentTargets());
  }, [toolId]);

  // Auto-fill target from global context when tool changes
  useEffect(() => {
    if (globalTarget && tool) {
      const params = getNormalizedParams();
      const targetParam = params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url') || p.name.toLowerCase().includes('domain') || p.name.toLowerCase().includes('input'))) || params.find(p => p.required);
      if (targetParam && !paramValues[targetParam.name]) {
        setParamValues(prev => ({ ...prev, [targetParam.name]: globalTarget }));
      }
    }
  }, [globalTarget, tool]);

  useEffect(() => {
    if (tool && toolId) {
      generateCommand();
    }
  }, [paramValues, tool, toolId]);

  // Helper function to normalize parameters from API (handles both array and object formats)
  const getNormalizedParams = (): ToolParameter[] => {
    // First priority: use toolConfig if available (from smart config system)
    if (toolConfig) {
      return toolConfig.parameters;
    }
    
    if (!tool) return [];
    if (Array.isArray(tool.parameters) && tool.parameters.length > 0) return tool.parameters;
    if (tool.parameters && typeof tool.parameters === 'object') {
      return Object.entries(tool.parameters).map(([key, param]: [string, any]) => ({
        name: param.description || key,
        flag: param.flag || '',
        type: param.type || 'text',
        required: param.required || false,
        default: param.default,
        placeholder: param.placeholder || param.default || '',
        options: param.options,
        description: param.description || key,
        group: param.group || 'General'
      }));
    }
    // Final fallback: use smart config system
    const config = getToolConfig(getToolSlug(tool));
    return config.parameters;
  };

  const generateCommand = () => {
    if (!tool) return;
    
    let cmd = getToolSlug(tool);
    const params = getNormalizedParams();
    
    params.forEach(param => {
      const value = paramValues[param.name];
      if (value !== undefined && value !== '' && value !== false) {
        if (param.type === 'boolean' && value === true) {
          cmd += ` ${param.flag}`;
        } else if (param.flag === '') {
          // Positional argument
          cmd += ` ${value}`;
        } else {
          cmd += ` ${param.flag} ${value}`;
        }
      }
    });
    
    setGeneratedCommand(cmd);
  };

  const handleParamChange = (name: string, value: string | boolean) => {
    setParamValues(prev => ({ ...prev, [name]: value }));
  };

  // One-Click Scan with mode
  const handleQuickScan = (mode: 'quick' | 'standard' | 'deep') => {
    // Get the target from paramValues
    const params = getNormalizedParams();
    const targetParam = params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url') || p.name.toLowerCase().includes('domain') || p.name.toLowerCase().includes('input'))) || params.find(p => p.required);
    const scanTarget = targetParam ? (paramValues[targetParam.name] as string) || '' : '';
    
    if (!scanTarget) {
      toast.warning('Target Required', 'Please enter a target first');
      return;
    }
    
    // Save target to global context + local memory
    addGlobalTarget(scanTarget);
    addRecentTarget(scanTarget);
    setRecentTargets(getRecentTargets());
    
    // Get smart defaults for this mode
    const defaults = getSmartDefaults(toolId || '', mode);
    const allParams = { ...defaults, [targetParam?.name || 'Target']: scanTarget };
    
    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('tool', toolId || '');
    queryParams.set('target', scanTarget);
    queryParams.set('mode', mode);
    queryParams.set('params', JSON.stringify(allParams));
    if (selectedAgentId && selectedAgentId !== 'server') {
      queryParams.set('agent', selectedAgentId);
    }
    
    // Navigate directly to scan execution
    navigate(`/dashboard/tools/${toolId}/run?${queryParams.toString()}`);
  };

  const handleRunScan = () => {
    // Find the target value from parameters (first required parameter)
    const params = getNormalizedParams();
    const targetParam = params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url') || p.name.toLowerCase().includes('domain') || p.name.toLowerCase().includes('input'))) || params.find(p => p.required);
    const scanTarget = targetParam ? (paramValues[targetParam.name] as string) || '' : '';
    
    // Save target to global context + local memory
    if (scanTarget) {
      addGlobalTarget(scanTarget);
      addRecentTarget(scanTarget);
      setRecentTargets(getRecentTargets());
    }
    
    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('tool', toolId || '');
    if (scanTarget) {
      queryParams.set('target', scanTarget);
    }
    if (generatedCommand) {
      queryParams.set('command', generatedCommand);
    }
    
    // Pass all parameters as JSON
    const allParams = { ...paramValues };
    queryParams.set('params', JSON.stringify(allParams));
    if (selectedAgentId && selectedAgentId !== 'server') {
      queryParams.set('agent', selectedAgentId);
    }
    
    // Navigate to scan execution page with parameters
    navigate(`/dashboard/tools/${toolId}/run?${queryParams.toString()}`);
  };
  
  // Select from recent targets
  const handleSelectTarget = (target: string) => {
    const params = getNormalizedParams();
    const targetParam = params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url') || p.name.toLowerCase().includes('domain'))) || params.find(p => p.required);
    if (targetParam) {
      setParamValues(prev => ({ ...prev, [targetParam.name]: target }));
    }
    setShowTargetDropdown(false);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(generatedCommand);
    // Show toast
  };

  if (loading) {
    return <ToolDetailPageSkeleton />;
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Tool Not Found</h2>
          <Link to="/dashboard/tools" className="text-kali-blue hover:underline">
            Back to Tools
          </Link>
        </div>
      </div>
    );
  }

  // Get normalized parameters using helper function
  const normalizedParams = getNormalizedParams();

  // Group parameters by category
  const groupedParams = normalizedParams.reduce((acc, param) => {
    const group = param.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(param);
    return acc;
  }, {} as { [key: string]: ToolParameter[] });

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <Header 
        title={tool.name}
        subtitle={tool.description}
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Parameters */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-4">
              {(['params', 'docs', 'examples'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab 
                      ? 'bg-kali-blue text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {tab === 'params' && 'Parameters'}
                  {tab === 'docs' && 'Documentation'}
                  {tab === 'examples' && 'Examples'}
                </button>
              ))}
            </div>

            {/* Parameters Tab */}
            {activeTab === 'params' && (
              <div className="space-y-6">
                {Object.entries(groupedParams).map(([group, params]) => (
                  <div key={group} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-kali-blue" />
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {params.map(param => (
                        <div key={param.name} className={param.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <label className="block text-sm text-gray-400 mb-1.5">
                            {param.name}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          
                          {param.type === 'text' && (
                            <input
                              type="text"
                              placeholder={param.placeholder}
                              value={(paramValues[param.name] as string) || ''}
                              onChange={(e) => handleParamChange(param.name, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                            />
                          )}
                          
                          {param.type === 'number' && (
                            <input
                              type="number"
                              placeholder={param.placeholder}
                              value={(paramValues[param.name] as string) || ''}
                              onChange={(e) => handleParamChange(param.name, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                            />
                          )}
                          
                          {param.type === 'select' && (
                            <select
                              value={(paramValues[param.name] as string) || ''}
                              onChange={(e) => handleParamChange(param.name, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition"
                            >
                              <option value="">Select...</option>
                              {param.options?.map(opt => (
                                <option key={opt} value={opt.split(' ')[0]}>{opt}</option>
                              ))}
                            </select>
                          )}
                          
                          {param.type === 'boolean' && (
                            <label className="flex items-center gap-3 cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={(paramValues[param.name] as boolean) || false}
                                  onChange={(e) => handleParamChange(param.name, e.target.checked)}
                                  className="sr-only"
                                />
                                <div className={`w-10 h-6 rounded-full transition ${paramValues[param.name] ? 'bg-kali-blue' : 'bg-gray-700'}`}>
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${paramValues[param.name] ? 'left-5' : 'left-1'}`} />
                                </div>
                              </div>
                              <span className="text-sm text-gray-300">Enable</span>
                            </label>
                          )}
                          
                          {param.type === 'textarea' && (
                            <textarea
                              placeholder={param.placeholder}
                              value={(paramValues[param.name] as string) || ''}
                              onChange={(e) => handleParamChange(param.name, e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition resize-none"
                            />
                          )}
                          
                          {param.type === 'file' && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Select or enter file path..."
                                value={(paramValues[param.name] as string) || ''}
                                onChange={(e) => handleParamChange(param.name, e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                              />
                              <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                                Browse
                              </button>
                            </div>
                          )}
                          
                          {param.description && (
                            <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documentation Tab */}
            {activeTab === 'docs' && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <div className="prose prose-invert max-w-none">
                  <pre className="text-gray-300 whitespace-pre-wrap">{tool.documentation}</pre>
                </div>
              </div>
            )}

            {/* Examples Tab */}
            {activeTab === 'examples' && (
              <div className="space-y-4">
                {tool.examples?.map((example, idx) => (
                  <div key={idx} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">{example.name}</h4>
                      <button 
                        onClick={() => navigator.clipboard.writeText(example.command)}
                        className="text-gray-400 hover:text-white transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <code className="block bg-gray-950 rounded-lg p-3 text-green-400 font-mono text-sm mb-2">
                      {example.command}
                    </code>
                    <p className="text-sm text-gray-400">{example.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Command Preview & Actions */}
          <div className="space-y-6">
            {/* One-Click Scan Modes */}
            {toolConfig && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-kali-blue/30 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  One-Click Scan
                </h3>
                <p className="text-xs text-gray-400 mb-4">Select scan intensity. Target required.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {toolConfig.scanModes.map((mode) => (
                    <button
                      key={mode.name}
                      onClick={() => handleQuickScan(mode.name)}
                      className={`p-3 rounded-lg text-center transition border ${
                        mode.name === 'quick' 
                          ? 'bg-green-500/10 border-green-500/50 hover:bg-green-500/20' 
                          : mode.name === 'standard'
                          ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20'
                          : 'bg-purple-500/10 border-purple-500/50 hover:bg-purple-500/20'
                      }`}
                    >
                      <div className={`font-semibold text-sm ${
                        mode.name === 'quick' ? 'text-green-400' : 
                        mode.name === 'standard' ? 'text-blue-400' : 'text-purple-400'
                      }`}>
                        {mode.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{mode.estimatedTime}</div>
                    </button>
                  ))}
                </div>
                
                {/* Recent Targets Dropdown */}
                {recentTargets.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="relative">
                      <button 
                        onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-lg text-left text-sm text-gray-300 hover:border-kali-blue transition flex items-center justify-between"
                      >
                        <span>Recent Targets</span>
                        <svg className={`w-4 h-4 transition ${showTargetDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showTargetDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                          {recentTargets.map((target, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectTarget(target)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition first:rounded-t-lg last:rounded-b-lg"
                            >
                              {target}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Command Preview */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Generated Command</h3>
                <button 
                  onClick={copyCommand}
                  className="text-gray-400 hover:text-white transition p-1"
                  title="Copy command"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-gray-950 rounded-lg p-4 mb-4">
                <code className="text-green-400 font-mono text-sm break-all">
                  {generatedCommand || getToolSlug(tool)}
                </code>
              </div>

              {/* Execution Agent Selector */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Execution Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition text-sm"
                >
                  <option value="server">🖥️ Server (Default)</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={String(agent.id)} disabled={agent.status !== 'online'}>
                      {agent.status === 'online' ? '🟢' : '🔴'} {agent.name} {agent.ip_address ? `(${agent.ip_address})` : ''} — {agent.platform || 'linux'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-600 mt-1">
                  {agents.filter(a => a.status === 'online').length > 0 
                    ? `${agents.filter(a => a.status === 'online').length} agent(s) online`
                    : 'No agents online — using server'}
                </p>
              </div>

              <button
                onClick={handleRunScan}
                className="w-full py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Scan
              </button>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Category: {tool.category}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Plan: {tool.plan_required}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left text-sm transition flex items-center gap-3">
                  <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Save as Favorite
                </button>
                <button className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left text-sm transition flex items-center gap-3">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Schedule Scan
                </button>
                <button className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left text-sm transition flex items-center gap-3">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

export default ToolDetailPage;
