import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { AgentsPageSkeleton } from '../../components/ui/Skeleton';

type AgentPlatform = 'linux' | 'windows' | 'macos' | 'docker';
type ConnectionType = 'cloud_to_target' | 'agent_internal' | 'agent_dmz' | 'agent_airgapped' | 'hybrid';
type AgentStatus = 'online' | 'offline' | 'busy' | 'error' | 'pending';

// 5 Network Modes matching backend agent_manager.py
const NETWORK_MODES: Record<ConnectionType, { name: string; description: string; icon: string; emoji: string; needsAgent: boolean }> = {
  cloud_to_target: {
    name: 'Cloud → Target',
    description: 'Our cloud scanners test your external-facing systems directly. No installation needed.',
    icon: 'cloud',
    emoji: '☁️',
    needsAgent: false
  },
  agent_internal: {
    name: 'Internal Agent',
    description: 'Install a lightweight agent inside your network for internal vulnerability scanning.',
    icon: 'agent',
    emoji: '🔒',
    needsAgent: true
  },
  agent_dmz: {
    name: 'DMZ Agent',
    description: 'Deploy an agent in your DMZ to scan both internal and external attack surfaces.',
    icon: 'dmz',
    emoji: '🛡️',
    needsAgent: true
  },
  agent_airgapped: {
    name: 'Air-Gapped',
    description: 'For isolated networks: export scan configs via USB, import results back securely.',
    icon: 'airgap',
    emoji: '🔌',
    needsAgent: true
  },
  hybrid: {
    name: 'Hybrid Mode',
    description: 'Combine cloud scanning with an internal agent for comprehensive coverage.',
    icon: 'hybrid',
    emoji: '🔄',
    needsAgent: true
  },
};

interface Agent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: AgentStatus;
  status_emoji?: string;
  os: string;
  platform: AgentPlatform;
  version?: string;
  last_seen: string | null;
  last_heartbeat?: string | null;
  cpu_usage: number;
  memory_usage: number;
  active_scans: number;
  total_scans: number;
  location?: string;
  connection_type: ConnectionType;
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  registration_token?: string;
  created_at?: string;
}

interface DashboardData {
  total_agents: number;
  online: number;
  offline: number;
  busy: number;
  pending: number;
  total_scans_completed: number;
  agents: Agent[];
}

export default function AgentsPage() {
  const { token } = useAuth();
  const { t: _t } = useTranslation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showExplainer, setShowExplainer] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [setupMethod, setSetupMethod] = useState<'docker' | 'windows' | 'kubernetes'>('docker');
  
  // Form state
  const [newAgentName, setNewAgentName] = useState('');
  const [installToken, setInstallToken] = useState<string | null>(null);
  const [installCommand, setInstallCommand] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<AgentPlatform>('linux');
  const [connectionType, setConnectionType] = useState<ConnectionType>('cloud_to_target');
  const [sshCredentials, setSshCredentials] = useState({ 
    host: '', 
    port: '22', 
    username: 'root', 
    password: '' 
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agents/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: DashboardData = await res.json();
        setDashboard(data);
        setAgents(data.agents || []);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchDashboard, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const addAgent = async () => {
    if (!newAgentName.trim()) return;
    
    try {
      const res = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newAgentName,
          platform: selectedPlatform,
          connection_type: connectionType,
          network_mode: connectionType,
          ssh_host: (connectionType === 'agent_internal' || connectionType === 'agent_dmz') ? sshCredentials.host : undefined,
          ssh_port: (connectionType === 'agent_internal' || connectionType === 'agent_dmz') ? parseInt(sshCredentials.port) : undefined,
          ssh_username: (connectionType === 'agent_internal' || connectionType === 'agent_dmz') ? sshCredentials.username : undefined,
          ssh_password: (connectionType === 'agent_internal' || connectionType === 'agent_dmz') ? sshCredentials.password : undefined,
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setInstallToken(data.registration_token);
        setInstallCommand(data.install_command || `# Agent Registration Token:\n${data.registration_token}\n\n# Install & run:\ncurl -sSL https://cybersecpro.semihkilic.com/api/v1/agent-script | python3 - --token ${data.registration_token}`);
        fetchDashboard();
      } else {
        alert(data.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Failed to add agent:', error);
      alert('Failed to create agent');
    }
  };

  const updateAgent = async () => {
    if (!selectedAgent) return;
    
    const agentData = selectedAgent as Agent & { ssh_password?: string; ssh_key_path?: string };
    
    try {
      const body: Record<string, unknown> = {
        name: selectedAgent.name,
        ssh_host: selectedAgent.ssh_host,
        ssh_port: selectedAgent.ssh_port,
        ssh_username: selectedAgent.ssh_username,
        location: selectedAgent.location,
        connection_type: selectedAgent.connection_type,
      };
      
      // Only send password if user typed something
      if (agentData.ssh_password) {
        body.ssh_password = agentData.ssh_password;
      }
      if (agentData.ssh_key_path) {
        body.ssh_key_path = agentData.ssh_key_path;
      }
      
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setShowEditModal(false);
        setSelectedAgent(null);
        setTestResult(null);
        fetchDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update agent');
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    
    try {
      const res = await fetch(`/api/v1/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setSelectedAgent(null);
        fetchDashboard();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const testConnection = async (agentId: string) => {
    setTestingConnection(true);
    setTestResult(null);
    
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? `Connection successful! OS: ${data.os_info || 'Unknown'}` : data.error
      });
      
      if (data.success) fetchDashboard();
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusColor = (status: AgentStatus) => {
    const colors: Record<string, string> = {
      online: 'text-green-400 bg-green-400/20',
      busy: 'text-yellow-400 bg-yellow-400/20',
      offline: 'text-gray-400 bg-gray-400/20',
      error: 'text-red-400 bg-red-400/20',
      pending: 'text-blue-400 bg-blue-400/20',
    };
    return colors[status] || 'text-gray-400 bg-gray-400/20';
  };

  const getStatusDot = (status: AgentStatus) => {
    const colors: Record<string, string> = {
      online: 'bg-green-400 shadow-green-400/50',
      busy: 'bg-yellow-400 shadow-yellow-400/50',
      offline: 'bg-gray-500',
      error: 'bg-red-400 shadow-red-400/50',
      pending: 'bg-blue-400 shadow-blue-400/50',
    };
    const pulse = status === 'online' ? 'animate-pulse' : '';
    return `w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-gray-500'} shadow-lg ${pulse}`;
  };

  const getPlatformIcon = (platform: AgentPlatform) => {
    const icons: Record<string, string> = { windows: '🪟', macos: '🍎', docker: '🐳', linux: '🐧' };
    return icons[platform] || '🐧';
  };

  const getCpuColor = (cpu: number) => cpu > 80 ? 'bg-red-500' : cpu > 50 ? 'bg-yellow-500' : 'bg-green-500';
  const getMemColor = (mem: number) => mem > 80 ? 'bg-red-500' : mem > 50 ? 'bg-yellow-500' : 'bg-cyan-500';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const resetAddForm = () => {
    setNewAgentName('');
    setInstallToken(null);
    setInstallCommand('');
    setSelectedPlatform('linux');
    setConnectionType('cloud_to_target');
    setSshCredentials({ host: '', port: '22', username: 'root', password: '' });
    setShowAddModal(false);
  };

  if (loading) {
    return <AgentsPageSkeleton />;
  }

  const onlineAgents = agents.filter(a => a.status === 'online');
  const offlineAgents = agents.filter(a => a.status === 'offline');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Agent Management</h1>
          <p className="text-gray-400 text-sm">
            Manage and monitor your security agents
            <span className="text-gray-600 ml-2">
              Last update: {lastRefresh.toLocaleTimeString('en-GB')}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${autoRefresh ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
          >
            {autoRefresh ? '● LIVE' : '○ PAUSED'}
          </button>
          <button onClick={fetchDashboard} className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white" title="Refresh">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-gradient-to-r from-kali-blue to-cyan-600 hover:from-kali-blue/90 hover:to-cyan-600/90 text-white rounded-lg font-medium transition flex items-center gap-2 shadow-lg shadow-kali-blue/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Agent
          </button>
        </div>
      </div>

      {/* What are Agents? Explainer */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 overflow-hidden">
        <button 
          onClick={() => setShowExplainer(!showExplainer)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">What are Agents?</h3>
              <p className="text-gray-400 text-sm">Learn how agents extend your scanning capabilities</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showExplainer ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showExplainer && (
          <div className="px-4 pb-5 space-y-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              Agents are lightweight software that runs inside your network, enabling internal vulnerability scanning 
              that cloud-based tools cannot reach. They securely connect to CyberSec Pro and execute scans on your behalf.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <div className="text-2xl mb-2">☁️</div>
                <h4 className="text-white font-medium text-sm">Cloud Scanning</h4>
                <p className="text-gray-500 text-xs mt-1">No agent needed. We scan your external-facing systems from our cloud.</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-blue-500/20">
                <div className="text-2xl mb-2">🔒</div>
                <h4 className="text-white font-medium text-sm">Internal Agent</h4>
                <p className="text-gray-500 text-xs mt-1">Deploy inside your network to scan internal systems and databases.</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                <div className="text-2xl mb-2">🔄</div>
                <h4 className="text-white font-medium text-sm">Hybrid Mode</h4>
                <p className="text-gray-500 text-xs mt-1">Combine cloud + agent for complete internal and external coverage.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{dashboard?.total_agents || 0}</p>
              <p className="text-gray-500 text-xs">Total Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{dashboard?.online || 0}</p>
              <p className="text-gray-500 text-xs">Online</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{dashboard?.offline || 0}</p>
              <p className="text-gray-500 text-xs">Offline</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{dashboard?.busy || 0}</p>
              <p className="text-gray-500 text-xs">Scanning</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">{dashboard?.total_scans_completed || 0}</p>
              <p className="text-gray-500 text-xs">Total Scans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-gray-700 border-dashed">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Agents Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Deploy an agent inside your network to scan internal systems, or use cloud scanning for external targets.
          </p>
          
          {/* 3-Step Quick Setup */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${setupStep === s ? 'bg-blue-600 text-white' : setupStep > s ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                    {setupStep > s ? '✓' : s}
                  </div>
                  <span className={`text-xs ${setupStep === s ? 'text-white' : 'text-gray-500'}`}>
                    {s === 1 ? 'Choose Method' : s === 2 ? 'Install' : 'Verify'}
                  </span>
                  {s < 3 && <div className={`w-12 h-0.5 ${setupStep > s ? 'bg-green-500' : 'bg-gray-700'}`} />}
                </div>
              ))}
            </div>
            
            {setupStep === 1 && (
              <div className="grid grid-cols-3 gap-3 text-left">
                <button onClick={() => { setSetupMethod('docker'); setSetupStep(2); }} className={`p-4 rounded-xl border transition hover:border-blue-500/50 ${setupMethod === 'docker' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/50'}`}>
                  <div className="text-3xl mb-2">🐳</div>
                  <h4 className="text-white font-semibold text-sm">Docker</h4>
                  <p className="text-gray-500 text-xs mt-1">Recommended. One command to start.</p>
                  <span className="text-green-400 text-xs mt-2 inline-block">✓ Fastest setup</span>
                </button>
                <button onClick={() => { setSetupMethod('windows'); setSetupStep(2); }} className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 transition hover:border-blue-500/50">
                  <div className="text-3xl mb-2">🪟</div>
                  <h4 className="text-white font-semibold text-sm">Windows</h4>
                  <p className="text-gray-500 text-xs mt-1">Windows Service. Run as background service.</p>
                </button>
                <button onClick={() => { setSetupMethod('kubernetes'); setSetupStep(2); }} className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 transition hover:border-blue-500/50">
                  <div className="text-3xl mb-2">☸️</div>
                  <h4 className="text-white font-semibold text-sm">Kubernetes</h4>
                  <p className="text-gray-500 text-xs mt-1">Helm chart for K8s clusters.</p>
                </button>
              </div>
            )}
            
            {setupStep === 2 && (
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 text-left">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-semibold">Install Agent ({setupMethod === 'docker' ? 'Docker' : setupMethod === 'windows' ? 'Windows' : 'Kubernetes'})</h4>
                  <button onClick={() => setSetupStep(1)} className="text-xs text-gray-400 hover:text-white transition">← Change method</button>
                </div>
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm text-green-400 relative border border-gray-700">
                  <pre className="whitespace-pre-wrap">{setupMethod === 'docker' 
                    ? 'docker run -d --name cybersec-agent \\\n  -e AGENT_TOKEN=<your-token> \\\n  -e API_URL=https://semihkilic.com/api \\\n  --restart unless-stopped \\\n  cybersecpro/agent:latest'
                    : setupMethod === 'windows'
                    ? '# Download installer\nInvoke-WebRequest -Uri "https://semihkilic.com/api/v1/agent-installer.exe" -OutFile agent-setup.exe\n\n# Install with token\n.\\agent-setup.exe --token <your-token>'
                    : '# Add Helm repo\nhelm repo add cybersecpro https://charts.semihkilic.com\n\n# Install\nhelm install cybersec-agent cybersecpro/agent \\\n  --set token=<your-token> \\\n  --set apiUrl=https://semihkilic.com/api'
                  }</pre>
                  <button onClick={() => navigator.clipboard.writeText(setupMethod === 'docker' ? 'docker run -d ...' : 'helm install ...')} className="absolute top-2 right-2 p-2 hover:bg-gray-800 rounded transition text-gray-500 hover:text-white" title="Copy">📋</button>
                </div>
                <p className="text-gray-500 text-xs mt-3">Replace &lt;your-token&gt; with the token generated when you click "Add Agent" above.</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setSetupStep(3)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">I've installed it →</button>
                  <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">Generate Token First</button>
                </div>
              </div>
            )}
            
            {setupStep === 3 && (
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                </div>
                <h4 className="text-white font-semibold mb-2">Waiting for Agent Connection...</h4>
                <p className="text-gray-400 text-sm mb-4">Your agent should appear here within 30 seconds after installation.</p>
                <button onClick={() => { fetchDashboard(); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition">🔄 Refresh Now</button>
                <button onClick={() => setSetupStep(1)} className="ml-3 px-4 py-2 text-gray-400 hover:text-white text-sm transition">Start Over</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Online Agents */}
          {onlineAgents.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Online ({onlineAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {onlineAgents.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    onSelect={() => setSelectedAgent(agent)}
                    getStatusDot={getStatusDot}
                    getPlatformIcon={getPlatformIcon}
                    getCpuColor={getCpuColor}
                    getMemColor={getMemColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Offline/Pending Agents */}
          {offlineAgents.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                Offline ({offlineAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {offlineAgents.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    onSelect={() => setSelectedAgent(agent)}
                    getStatusDot={getStatusDot}
                    getPlatformIcon={getPlatformIcon}
                    getCpuColor={getCpuColor}
                    getMemColor={getMemColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Agents */}
          {agents.filter(a => a.status === 'pending').length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Pending Registration ({agents.filter(a => a.status === 'pending').length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {agents.filter(a => a.status === 'pending').map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    onSelect={() => setSelectedAgent(agent)}
                    getStatusDot={getStatusDot}
                    getPlatformIcon={getPlatformIcon}
                    getCpuColor={getCpuColor}
                    getMemColor={getMemColor}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{installToken ? 'Agent Created!' : 'Add New Agent'}</h2>
              <button onClick={resetAddForm} className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {!installToken ? (
                <>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Agent Name</label>
                    <input type="text" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="E.g.: Office-Scanner, DMZ-Agent-01" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-kali-blue focus:outline-none focus:ring-1 focus:ring-kali-blue/50" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Network Mode</label>
                    <div className="grid grid-cols-1 gap-2">
                      {(Object.entries(NETWORK_MODES) as [ConnectionType, typeof NETWORK_MODES[ConnectionType]][]).map(([key, mode]) => (
                        <button
                          key={key}
                          onClick={() => setConnectionType(key)}
                          className={`p-3 rounded-lg border transition text-left flex items-start gap-3 ${connectionType === key ? 'border-kali-blue bg-kali-blue/10 ring-1 ring-kali-blue/30' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                        >
                          <span className="text-xl mt-0.5">{mode.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm">{mode.name}</div>
                            <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{mode.description}</div>
                          </div>
                          {connectionType === key && (
                            <div className="w-5 h-5 rounded-full bg-kali-blue flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(connectionType === 'agent_internal' || connectionType === 'agent_dmz') && (
                    <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <h4 className="text-white font-medium text-sm">SSH Details</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-gray-500 text-xs mb-1">Host / IP</label>
                          <input type="text" value={sshCredentials.host} onChange={(e) => setSshCredentials({...sshCredentials, host: e.target.value})} placeholder="10.0.0.115" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-gray-500 text-xs mb-1">Port</label>
                          <input type="text" value={sshCredentials.port} onChange={(e) => setSshCredentials({...sshCredentials, port: e.target.value})} placeholder="22" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Username</label>
                        <input type="text" value={sshCredentials.username} onChange={(e) => setSshCredentials({...sshCredentials, username: e.target.value})} placeholder="root" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Password</label>
                        <input type="password" value={sshCredentials.password} onChange={(e) => setSshCredentials({...sshCredentials, password: e.target.value})} placeholder="••••••••" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                      </div>
                    </div>
                  )}
                  {NETWORK_MODES[connectionType]?.needsAgent && connectionType !== 'agent_internal' && connectionType !== 'agent_dmz' && (
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Platform</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['linux', 'windows', 'macos', 'docker'] as AgentPlatform[]).map(p => (
                          <button key={p} onClick={() => setSelectedPlatform(p)} className={`p-3 rounded-lg border transition ${selectedPlatform === p ? 'border-kali-blue bg-kali-blue/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                            <div className="text-2xl mb-1">{getPlatformIcon(p)}</div>
                            <div className="text-xs text-gray-400 capitalize">{p}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-lg flex items-center gap-3">
                    <span className="text-green-400 text-xl">✓</span>
                    <p className="text-green-400">Agent "<span className="font-medium">{newAgentName}</span>" successfully created!</p>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">
                      {(connectionType === 'agent_internal' || connectionType === 'agent_dmz') ? 'SSH / Agent Configuration' : connectionType === 'agent_airgapped' ? 'Air-Gap Setup Instructions' : 'Setup Instructions'}
                    </label>
                    <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm text-green-400 relative border border-gray-700">
                      <pre className="whitespace-pre-wrap">{installCommand}</pre>
                      <button onClick={() => copyToClipboard(installCommand)} className="absolute top-2 right-2 p-2 hover:bg-gray-800 rounded transition text-gray-500 hover:text-white" title="Copy">📋</button>
                    </div>
                  </div>
                  {(connectionType === 'agent_internal' || connectionType === 'agent_dmz') && (
                    <button onClick={() => testConnection(agents[agents.length - 1]?.id)} disabled={testingConnection} className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                      {testingConnection ? 'Testing connection...' : 'Test Agent Connection'}
                    </button>
                  )}
                  {testResult && (
                    <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                      <p className={testResult.success ? 'text-green-400' : 'text-red-400'}>{testResult.success ? '✓' : '✗'} {testResult.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={resetAddForm} className="px-4 py-2 text-gray-400 hover:text-white transition">{installToken ? 'Done' : 'Cancel'}</button>
              {!installToken && (
                <button onClick={addAgent} disabled={!newAgentName.trim() || ((connectionType === 'agent_internal' || connectionType === 'agent_dmz') && !sshCredentials.host)} className="px-6 py-2 bg-gradient-to-r from-kali-blue to-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50 shadow-lg shadow-kali-blue/20">Create Agent</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent Detail Sidebar */}
      {selectedAgent && !showEditModal && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-gray-900 border-l border-gray-700 shadow-2xl z-40 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getPlatformIcon(selectedAgent.platform)}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                  <p className="text-gray-500 text-sm">{selectedAgent.hostname || 'pending-registration'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400">✕</button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-6">
              <div className={getStatusDot(selectedAgent.status)} />
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(selectedAgent.status)}`}>
                {selectedAgent.status}
              </span>
              {selectedAgent.last_seen && (
                <span className="text-gray-500 text-xs ml-auto">{selectedAgent.last_seen}</span>
              )}
            </div>

            {/* CPU & RAM Bars */}
            {selectedAgent.status !== 'pending' && (
              <div className="space-y-3 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs font-medium">CPU</span>
                    <span className="text-white text-xs font-mono">{selectedAgent.cpu_usage}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${getCpuColor(selectedAgent.cpu_usage)}`} style={{ width: `${Math.min(selectedAgent.cpu_usage, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs font-medium">RAM</span>
                    <span className="text-white text-xs font-mono">{selectedAgent.memory_usage}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${getMemColor(selectedAgent.memory_usage)}`} style={{ width: `${Math.min(selectedAgent.memory_usage, 100)}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Info Grid */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">IP Address</p>
                  <p className="text-cyan-400 font-mono text-sm">{selectedAgent.ip_address || 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Location</p>
                  <p className="text-white text-sm">{selectedAgent.location || 'Unknown'}</p>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Operating System</p>
                <p className="text-white text-sm">{selectedAgent.os || 'Awaiting registration...'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Network Mode</p>
                <div className="flex items-center gap-2">
                  <span>{NETWORK_MODES[selectedAgent.connection_type]?.emoji || '☁️'}</span>
                  <p className="text-white text-sm">{NETWORK_MODES[selectedAgent.connection_type]?.name || selectedAgent.connection_type}</p>
                </div>
              </div>
              {selectedAgent.ssh_host && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Agent Connection</p>
                  <p className="text-white font-mono text-sm">{selectedAgent.ssh_username}@{selectedAgent.ssh_host}:{selectedAgent.ssh_port}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Active Scans</p>
                  <p className="text-yellow-400 text-lg font-bold">{selectedAgent.active_scans}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Total Scans</p>
                  <p className="text-purple-400 text-lg font-bold">{selectedAgent.total_scans}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              {selectedAgent.ssh_host && (
                <button onClick={() => testConnection(selectedAgent.id)} disabled={testingConnection} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              )}
              {testResult && <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{testResult.message}</div>}
              <button onClick={() => setShowEditModal(true)} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition">Edit</button>
              <button onClick={() => deleteAgent(selectedAgent.id)} className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition border border-red-500/20">Delete Agent</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700"><h2 className="text-xl font-bold text-white">Edit Agent</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Agent Name</label>
                <input type="text" value={selectedAgent.name} onChange={(e) => setSelectedAgent({...selectedAgent, name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-kali-blue focus:outline-none" />
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Network Mode</label>
                <select
                  value={selectedAgent.connection_type}
                  onChange={(e) => setSelectedAgent({...selectedAgent, connection_type: e.target.value as ConnectionType})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-kali-blue focus:outline-none"
                >
                  {Object.entries(NETWORK_MODES).map(([key, mode]) => (
                    <option key={key} value={key}>{mode.emoji} {mode.name}</option>
                  ))}
                </select>
              </div>

              {/* SSH Configuration - always shown for agent types */}
              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="text-white text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  SSH Connection
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">Host / IP</label>
                    <input type="text" value={selectedAgent.ssh_host || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_host: e.target.value})} placeholder="192.168.1.100" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Port</label>
                    <input type="number" value={selectedAgent.ssh_port || 22} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_port: parseInt(e.target.value)})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Username</label>
                  <input type="text" value={selectedAgent.ssh_username || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_username: e.target.value})} placeholder="root" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Password</label>
                  <input type="password" value={(selectedAgent as Agent & { ssh_password?: string }).ssh_password || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_password: e.target.value} as Agent)} placeholder="Leave empty to keep existing" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">SSH Key Path (optional)</label>
                  <input type="text" value={(selectedAgent as Agent & { ssh_key_path?: string }).ssh_key_path || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_key_path: e.target.value} as Agent)} placeholder="/home/user/.ssh/id_rsa" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-kali-blue focus:outline-none" />
                </div>

                {/* Test Connection Button */}
                <button
                  onClick={() => testConnection(selectedAgent.id)}
                  disabled={testingConnection || !selectedAgent.ssh_host}
                  className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg text-sm font-medium transition border border-cyan-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <div className={`p-2 rounded-lg text-xs ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Location</label>
                <input type="text" value={selectedAgent.location || ''} onChange={(e) => setSelectedAgent({...selectedAgent, location: e.target.value})} placeholder="E.g.: Office, Home Lab, AWS EU" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-kali-blue focus:outline-none" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setSelectedAgent(null); setTestResult(null); }} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
              <button onClick={updateAgent} className="px-6 py-2 bg-gradient-to-r from-kali-blue to-cyan-600 text-white rounded-lg font-medium transition shadow-lg shadow-kali-blue/20">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Card Component ─────────────────────────────
function AgentCard({ 
  agent, 
  onSelect, 
  getStatusDot, 
  getPlatformIcon, 
  getCpuColor, 
  getMemColor 
}: { 
  agent: Agent;
  onSelect: () => void;
  getStatusDot: (s: AgentStatus) => string;
  getPlatformIcon: (p: AgentPlatform) => string;
  getCpuColor: (n: number) => string;
  getMemColor: (n: number) => string;
}) {
  return (
    <div 
      onClick={onSelect}
      className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-500 transition-all cursor-pointer group hover:shadow-lg hover:shadow-black/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getPlatformIcon(agent.platform)}</span>
          <div>
            <h3 className="text-white font-medium group-hover:text-kali-blue transition">{agent.name}</h3>
            <p className="text-gray-500 text-xs font-mono">{agent.hostname || 'pending-registration'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={getStatusDot(agent.status)} />
          <span className="text-xs text-gray-500 uppercase font-medium">{agent.status}</span>
        </div>
      </div>

      {/* IP & OS */}
      <div className="space-y-1.5 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-gray-500 text-xs">IP</span>
          <span className="text-cyan-400 font-mono text-xs">{agent.ip_address || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-xs">OS</span>
          <span className="text-gray-300 text-xs truncate max-w-[180px]">{agent.os || 'Awaiting...'}</span>
        </div>
      </div>

      {/* CPU & RAM Mini Bars */}
      {agent.status !== 'pending' && (
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px] w-8">CPU</span>
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${getCpuColor(agent.cpu_usage)}`} style={{ width: `${Math.min(agent.cpu_usage, 100)}%` }} />
            </div>
            <span className="text-gray-400 text-[10px] font-mono w-8 text-right">{agent.cpu_usage}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px] w-8">RAM</span>
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${getMemColor(agent.memory_usage)}`} style={{ width: `${Math.min(agent.memory_usage, 100)}%` }} />
            </div>
            <span className="text-gray-400 text-[10px] font-mono w-8 text-right">{agent.memory_usage}%</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {agent.active_scans > 0 && (
            <span className="text-yellow-400 text-xs flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              {agent.active_scans} active
            </span>
          )}
          <span className="text-gray-600 text-xs">{agent.total_scans} scans</span>
        </div>
        {agent.last_seen && (
          <span className="text-gray-600 text-[10px]">{agent.last_seen}</span>
        )}
      </div>
    </div>
  );
}
