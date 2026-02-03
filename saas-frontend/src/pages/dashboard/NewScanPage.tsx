import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface Tool {
  id: string;
  name: string;
  slug?: string;
  category: string;
  description?: string;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
  plan_required?: string;
}

interface Target {
  id: string;
  name: string;
  value: string;
  type: string;
}

interface Agent {
  id: number;
  name: string;
  ip_address: string;
  platform: string;
  status: string;
}

interface Project {
  id: number;
  name: string;
  target_url?: string;
  target_ip?: string;
}

export function NewScanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [step, setStep] = useState(1);
  const [tools, setTools] = useState<{ [category: string]: Tool[] }>({});
  const [targets, setTargets] = useState<Target[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedTool, setSelectedTool] = useState<string>(searchParams.get('tool') || '');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [customTarget, setCustomTarget] = useState('');
  const [useCustomTarget, setUseCustomTarget] = useState(true);
  const [customCommand, setCustomCommand] = useState(searchParams.get('command') || '');
  const [scanName, setScanName] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [notifications, setNotifications] = useState(true);
  const [showDangerousWarning, setShowDangerousWarning] = useState(false);
  const [dangerousConfirmed, setDangerousConfirmed] = useState(false);
  const [toolSearch, setToolSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tools from v2 API
      const toolsRes = await fetch('/api/v2/tools?plan=enterprise', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (toolsRes.ok) {
        const data = await toolsRes.json();
        // Convert v2 API format to component format
        const toolsByCategory: { [key: string]: Tool[] } = {};
        Object.entries(data.categories || {}).forEach(([catKey, catData]: [string, any]) => {
          toolsByCategory[catData.info?.name || catKey] = catData.tools.map((t: any) => ({
            ...t,
            slug: t.id,
          }));
        });
        setTools(toolsByCategory);
      }

      // Fetch targets
      const targetsRes = await fetch('/api/v1/targets', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data.targets || []);
      }

      // Fetch agents
      const agentsRes = await fetch('/api/v1/agents', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
        // Auto-select first online agent
        const onlineAgent = (data.agents || []).find((a: Agent) => a.status === 'online');
        if (onlineAgent) {
          setSelectedAgent(onlineAgent.id);
        }
      }

      // Fetch projects
      const projectsRes = await fetch('/api/v1/projects', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Check if selected tool is dangerous
    const selectedToolObj = allTools.find(t => t.id === selectedTool || t.slug === selectedTool);
    
    if (selectedToolObj?.dangerous && !dangerousConfirmed) {
      setShowDangerousWarning(true);
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/scan/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool_id: selectedTool,
          target: useCustomTarget ? customTarget : selectedTarget,
          parameters: {},
          name: scanName,
          priority,
          notifications,
          confirm_dangerous: dangerousConfirmed,
          agent_id: selectedAgent,
          project_id: selectedProject,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        navigate(`/dashboard/scans/${data.scan_id}`);
      } else if (data.requires_confirmation) {
        // Tool requires dangerous confirmation
        setShowDangerousWarning(true);
      } else {
        console.error('Scan failed:', data.error);
        alert(data.error || 'Failed to start scan');
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDangerousScan = () => {
    setDangerousConfirmed(true);
    setShowDangerousWarning(false);
    handleSubmit();
  };

  const allTools = Object.values(tools).flat();

  // Helper function available for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getToolBySlug = (slug: string) => allTools.find(t => t.slug === slug || t.id === slug);
  void getToolBySlug; // suppress unused warning

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="New Scan"
        subtitle="Configure and start a new security scan"
        breadcrumb={[
          { label: 'Scans', href: '/dashboard/scans' },
          { label: 'New Scan' }
        ]}
      />

      <div className="max-w-4xl mx-auto p-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${
                  step >= s 
                    ? 'bg-kali-blue text-white' 
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div className={`w-24 h-1 mx-2 rounded ${step > s ? 'bg-kali-blue' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center mb-8 text-sm">
          <span className={`w-32 text-center ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>Select Tool</span>
          <span className={`w-32 text-center ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>Configure</span>
          <span className={`w-32 text-center ${step >= 3 ? 'text-white' : 'text-gray-500'}`}>Review</span>
        </div>

        {/* Step 1: Select Tool */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select a Tool</h2>
              
              {/* Quick Search */}
              <div className="relative mb-6">
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Popular Tools - only show when not searching */}
              {!toolSearch && (
              <div className="mb-6">
                <h3 className="text-sm text-gray-400 mb-3">Popular Tools</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['nmap', 'sqlmap', 'nikto', 'hydra', 'gobuster', 'wpscan', 'john', 'dirb'].map(tool => (
                    <button
                      key={tool}
                      onClick={() => setSelectedTool(tool)}
                      className={`p-4 rounded-xl border text-left transition ${
                        selectedTool === tool
                          ? 'bg-kali-blue/20 border-kali-blue'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <p className="font-medium text-white">{tool}</p>
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* All Tools by Category */}
              <div>
                <h3 className="text-sm text-gray-400 mb-3">
                  {toolSearch ? `Search Results for "${toolSearch}"` : 'All Tools'}
                </h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(tools).map(([category, categoryTools]) => {
                    // Filter tools by search
                    const filteredTools = toolSearch 
                      ? categoryTools.filter(t => 
                          t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                          t.id.toLowerCase().includes(toolSearch.toLowerCase()) ||
                          (t.description?.toLowerCase() || '').includes(toolSearch.toLowerCase())
                        )
                      : categoryTools;
                    
                    if (filteredTools.length === 0) return null;
                    
                    return (
                    <div key={category}>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{category}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {filteredTools.map(tool => (
                          <button
                            key={tool.id}
                            onClick={() => setSelectedTool(tool.slug || tool.id)}
                            className={`p-3 rounded-lg border text-left transition ${
                              selectedTool === tool.slug || selectedTool === tool.id
                                ? 'bg-kali-blue/20 border-kali-blue'
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <p className="text-sm font-medium text-white">{tool.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link
                to="/dashboard/scans"
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </Link>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedTool}
                className="px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Configure Scan</h2>

              {/* Scan Name */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Scan Name (Optional)</label>
                <input
                  type="text"
                  value={scanName}
                  onChange={(e) => setScanName(e.target.value)}
                  placeholder={`${selectedTool} scan - ${new Date().toLocaleDateString()}`}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                />
              </div>

              {/* Target */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Target</label>
                
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => setUseCustomTarget(true)}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      useCustomTarget ? 'bg-kali-blue text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    Custom Target
                  </button>
                  <button
                    onClick={() => setUseCustomTarget(false)}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      !useCustomTarget ? 'bg-kali-blue text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    Saved Target
                  </button>
                </div>

                {useCustomTarget ? (
                  <input
                    type="text"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    placeholder="192.168.1.1, example.com, or http://target.com"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                  />
                ) : (
                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                  >
                    <option value="">Select a saved target...</option>
                    {targets.map(target => (
                      <option key={target.id} value={target.value}>
                        {target.name} ({target.value})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Agent Selection */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Execution Agent
                  </span>
                </label>
                <select
                  value={selectedAgent || ''}
                  onChange={(e) => setSelectedAgent(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                >
                  <option value="">Server (Default)</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id} disabled={agent.status !== 'online'}>
                      {agent.status === 'online' ? '🟢' : '🔴'} {agent.name} ({agent.ip_address}) - {agent.platform}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select an agent to execute the scan. Use "Server" for built-in execution, or choose an SSH agent.
                </p>
              </div>

              {/* Project Selection */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Project (Optional)
                  </span>
                </label>
                <select
                  value={selectedProject || ''}
                  onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                >
                  <option value="">No Project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Assign this scan to a project for better organization.
                </p>
              </div>

              {/* Custom Command */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">
                  Custom Command (Optional)
                  <Link to={`/dashboard/tools/${selectedTool}`} className="ml-2 text-kali-blue hover:underline">
                    Configure parameters →
                  </Link>
                </label>
                <textarea
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder={`${selectedTool} [options] target`}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition font-mono text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use default options, or customize the command above.
                </p>
              </div>

              {/* Priority */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Priority</label>
                <div className="flex gap-3">
                  {(['low', 'normal', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-4 py-2 rounded-lg text-sm capitalize ${
                        priority === p
                          ? p === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                            p === 'normal' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                            'bg-gray-600/20 text-gray-400 border border-gray-500/50'
                          : 'bg-gray-800 text-gray-400 border border-transparent'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition ${notifications ? 'bg-kali-blue' : 'bg-gray-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications ? 'left-5' : 'left-1'}`} />
                    </div>
                  </div>
                  <span className="text-white">Notify me when scan completes</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!customTarget && !selectedTarget}
                className="px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Review Scan</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Tool</span>
                  <span className="text-white font-medium">{selectedTool}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Target</span>
                  <span className="text-white font-mono">{useCustomTarget ? customTarget : selectedTarget}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Priority</span>
                  <span className={`px-2 py-1 rounded text-sm capitalize ${
                    priority === 'high' ? 'bg-red-500/20 text-red-400' :
                    priority === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>
                    {priority}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Notifications</span>
                  <span className="text-white">{notifications ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Execution Agent</span>
                  <span className="text-white">
                    {selectedAgent 
                      ? agents.find(a => a.id === selectedAgent)?.name || 'Unknown Agent'
                      : 'Server (Default)'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">Project</span>
                  <span className="text-white">
                    {selectedProject 
                      ? projects.find(p => p.id === selectedProject)?.name || 'Unknown Project'
                      : 'No Project'
                    }
                  </span>
                </div>
                {customCommand && (
                  <div className="py-3">
                    <span className="text-gray-400 block mb-2">Command</span>
                    <code className="block bg-gray-950 rounded-lg p-4 text-green-400 font-mono text-sm">
                      {customCommand}
                    </code>
                  </div>
                )}
              </div>
            </div>

            {/* Warning for sensitive scans */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-yellow-500 font-medium">Authorized Testing Only</p>
                <p className="text-yellow-500/70 text-sm mt-1">
                  Only scan targets you have explicit permission to test. Unauthorized scanning is illegal.
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Scan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dangerous Tool Warning Modal */}
      {showDangerousWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-red-500/50 max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">⚠️ Dangerous Tool Warning</h3>
                <p className="text-sm text-gray-400">This action requires confirmation</p>
              </div>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">
                <strong>{selectedTool}</strong> is marked as a <strong>dangerous tool</strong>. 
                It may actively exploit vulnerabilities or affect target systems.
              </p>
              <ul className="mt-3 text-red-400/80 text-sm space-y-1">
                <li>• Only use on systems you own or have written permission to test</li>
                <li>• May trigger security alerts on target systems</li>
                <li>• Could cause service disruption if misconfigured</li>
                <li>• All actions are logged for audit purposes</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDangerousWarning(false)}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDangerousScan}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition font-medium"
              >
                I Understand, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewScanPage;
