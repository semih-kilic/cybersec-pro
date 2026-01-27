import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

type AgentPlatform = 'linux' | 'windows' | 'macos' | 'docker';

interface Agent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  os: string;
  platform: AgentPlatform;
  version: string;
  last_seen: string;
  cpu_usage: number;
  memory_usage: number;
  active_scans: number;
  total_scans: number;
  location?: string;
  connection_type?: 'direct' | 'ssh' | 'rdp';
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Primary Agent',
    hostname: 'kali-primary',
    ip_address: '10.0.1.100',
    status: 'online',
    os: 'Kali Linux 2026.1',
    platform: 'linux',
    version: '2.1.0',
    last_seen: new Date().toISOString(),
    cpu_usage: 23,
    memory_usage: 45,
    active_scans: 2,
    total_scans: 1543,
    location: 'Frankfurt, DE',
    connection_type: 'direct',
  },
  {
    id: '2',
    name: 'US East Agent',
    hostname: 'kali-us-east',
    ip_address: '10.0.2.101',
    status: 'online',
    os: 'Kali Linux 2026.1',
    platform: 'linux',
    version: '2.1.0',
    last_seen: new Date().toISOString(),
    cpu_usage: 67,
    memory_usage: 72,
    active_scans: 5,
    total_scans: 892,
    location: 'Virginia, US',
    connection_type: 'ssh',
  },
  {
    id: '3',
    name: 'Backup Agent',
    hostname: 'kali-backup',
    ip_address: '10.0.1.102',
    status: 'offline',
    os: 'Kali Linux 2025.4',
    platform: 'linux',
    version: '2.0.5',
    last_seen: new Date(Date.now() - 3600000 * 24).toISOString(),
    cpu_usage: 0,
    memory_usage: 0,
    active_scans: 0,
    total_scans: 234,
    location: 'London, UK',
    connection_type: 'direct',
  },
];

export default function AgentsPage() {
  const { organization } = useAuth();
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [installToken, setInstallToken] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<AgentPlatform>('linux');
  const [connectionType, setConnectionType] = useState<'direct' | 'ssh'>('direct');
  const [sshCredentials, setSshCredentials] = useState({ host: '', port: '22', username: '', password: '', keyFile: '' });

  // Check if user's plan supports agents - use organization.plan_type
  const userPlan = organization?.plan_type || 'trial';
  const planSupportsAgents = ['team', 'enterprise'].includes(userPlan);
  const maxAgents = userPlan === 'enterprise' ? Infinity : userPlan === 'team' ? 1 : 0;

  const generateInstallToken = () => {
    const token = `csp_agent_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
    setInstallToken(token);
  };

  const addAgent = () => {
    if (!newAgentName.trim()) return;
    
    const newAgent: Agent = {
      id: Math.random().toString(),
      name: newAgentName,
      hostname: 'pending-registration',
      ip_address: connectionType === 'ssh' ? sshCredentials.host : 'Pending...',
      status: 'offline',
      os: selectedPlatform === 'windows' ? 'Windows Server' : selectedPlatform === 'macos' ? 'macOS' : 'Pending...',
      platform: selectedPlatform,
      version: 'N/A',
      last_seen: new Date().toISOString(),
      cpu_usage: 0,
      memory_usage: 0,
      active_scans: 0,
      total_scans: 0,
      connection_type: connectionType,
    };
    
    setAgents([...agents, newAgent]);
    generateInstallToken();
    setNewAgentName('');
  };

  const getPlatformIcon = (platform: AgentPlatform) => {
    switch (platform) {
      case 'windows': return '🪟';
      case 'macos': return '🍎';
      case 'docker': return '🐳';
      default: return '🐧';
    }
  };

  const getInstallCommand = () => {
    const baseUrl = 'https://semihkilic.com/agent';
    
    if (connectionType === 'ssh') {
      return `# SSH Connection - Agent will connect via SSH
# Host: ${sshCredentials.host}:${sshCredentials.port}
# No local installation required - we connect to your server`;
    }
    
    switch (selectedPlatform) {
      case 'windows':
        return `# Windows PowerShell (Run as Administrator)
irm ${baseUrl}/install.ps1 | iex
Set-AgentToken -Token "${installToken}"
Start-CyberSecAgent`;
      
      case 'macos':
        return `# macOS Terminal
curl -sSL ${baseUrl}/install-mac.sh | \\
  sudo AGENT_TOKEN="${installToken}" bash`;
      
      case 'docker':
        return `# Docker
docker run -d --name cybersec-agent \\
  -e AGENT_TOKEN="${installToken}" \\
  --restart unless-stopped \\
  cybersecpro/agent:latest`;
      
      default:
        return `# Linux (Debian/Ubuntu/Kali)
curl -sSL ${baseUrl}/install.sh | \\
  sudo AGENT_TOKEN="${installToken}" bash`;
    }
  };

  const deleteAgent = (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    setAgents(agents.filter(a => a.id !== agentId));
    setSelectedAgent(null);
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'text-green-400 bg-green-400/20';
      case 'busy': return 'text-yellow-400 bg-yellow-400/20';
      case 'offline': return 'text-gray-400 bg-gray-400/20';
      case 'error': return 'text-red-400 bg-red-400/20';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!planSupportsAgents) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Remote Agents</h1>
          <p className="text-gray-400 text-lg mb-8">
            Deploy remote scanning agents in your infrastructure for internal network testing,
            continuous monitoring, and distributed scanning capabilities.
          </p>
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-8">
            <h3 className="text-white font-semibold mb-4">Remote Agents Include:</h3>
            <ul className="text-left text-gray-400 space-y-2">
              <li className="flex items-center gap-2">
                <span className="text-kali-blue">✓</span> Internal network scanning
              </li>
              <li className="flex items-center gap-2">
                <span className="text-kali-blue">✓</span> Private asset discovery
              </li>
              <li className="flex items-center gap-2">
                <span className="text-kali-blue">✓</span> Continuous vulnerability monitoring
              </li>
              <li className="flex items-center gap-2">
                <span className="text-kali-blue">✓</span> Distributed scanning from multiple locations
              </li>
              <li className="flex items-center gap-2">
                <span className="text-kali-blue">✓</span> Secure encrypted communication
              </li>
            </ul>
          </div>
          <div className="flex gap-4 justify-center">
            <a
              href="/#pricing"
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition"
            >
              Upgrade to Team - €79/mo
            </a>
            <a
              href="/#pricing"
              className="px-8 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition border border-gray-700"
            >
              View All Plans
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Remote Agents</h1>
          <p className="text-gray-400">
            Deploy scanning agents in your infrastructure for internal testing
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {agents.filter(a => a.status === 'online').length} / {maxAgents === Infinity ? '∞' : maxAgents} agents online
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={agents.length >= maxAgents}
            className="px-4 py-2 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Agent
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Agents', value: agents.length, icon: '🖥️' },
          { label: 'Online', value: agents.filter(a => a.status === 'online').length, icon: '🟢' },
          { label: 'Active Scans', value: agents.reduce((sum, a) => sum + a.active_scans, 0), icon: '🔄' },
          { label: 'Total Scans', value: agents.reduce((sum, a) => sum + a.total_scans, 0).toLocaleString(), icon: '📊' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-gray-400 text-sm">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`bg-gray-900 rounded-xl p-6 border transition cursor-pointer hover:border-kali-blue/50 ${
              selectedAgent?.id === agent.id ? 'border-kali-blue' : 'border-gray-800'
            }`}
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold">{agent.name}</h3>
                  <p className="text-gray-500 text-sm">{agent.hostname}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                {agent.status}
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">IP Address</span>
                <span className="text-white font-mono">{agent.ip_address}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Location</span>
                <span className="text-white">{agent.location || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">OS</span>
                <span className="text-white">{agent.os}</span>
              </div>
              
              {agent.status === 'online' && (
                <>
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>CPU Usage</span>
                      <span>{agent.cpu_usage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${agent.cpu_usage > 80 ? 'bg-red-500' : agent.cpu_usage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${agent.cpu_usage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Memory</span>
                      <span>{agent.memory_usage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${agent.memory_usage > 80 ? 'bg-red-500' : agent.memory_usage > 50 ? 'bg-yellow-500' : 'bg-kali-blue'}`}
                        style={{ width: `${agent.memory_usage}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
              <span className="text-gray-500 text-xs">
                {agent.active_scans} active • {agent.total_scans} total scans
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAgent(agent.id);
                }}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        
        {/* Add New Agent Card */}
        {agents.length < maxAgents && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gray-900/50 rounded-xl p-6 border-2 border-dashed border-gray-700 hover:border-kali-blue/50 transition flex flex-col items-center justify-center min-h-[300px] group"
          >
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-kali-blue/20 transition">
              <svg className="w-8 h-8 text-gray-500 group-hover:text-kali-blue transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium group-hover:text-white transition">Add New Agent</p>
            <p className="text-gray-500 text-sm mt-1">Deploy in your infrastructure</p>
          </button>
        )}
      </div>

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full border border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add New Agent</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setInstallToken(null);
                  setSelectedPlatform('linux');
                  setConnectionType('direct');
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {!installToken ? (
              <div className="space-y-6">
                {/* Agent Name */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g., Production Server Agent"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                  />
                </div>

                {/* Connection Type */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Connection Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setConnectionType('direct')}
                      className={`p-4 rounded-lg border-2 transition text-left ${
                        connectionType === 'direct' 
                          ? 'border-kali-blue bg-kali-blue/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">📦</div>
                      <div className="font-semibold text-white">Install Agent</div>
                      <p className="text-gray-400 text-sm mt-1">Install agent software on target machine</p>
                    </button>
                    <button
                      onClick={() => setConnectionType('ssh')}
                      className={`p-4 rounded-lg border-2 transition text-left ${
                        connectionType === 'ssh' 
                          ? 'border-kali-blue bg-kali-blue/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">🔐</div>
                      <div className="font-semibold text-white">SSH Connection</div>
                      <p className="text-gray-400 text-sm mt-1">Connect via SSH (no agent install)</p>
                    </button>
                  </div>
                </div>

                {/* Platform Selection (for direct install) */}
                {connectionType === 'direct' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Platform</label>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'linux', name: 'Linux', icon: '🐧', desc: 'Debian, Ubuntu, Kali' },
                        { id: 'windows', name: 'Windows', icon: '🪟', desc: 'Server 2019+' },
                        { id: 'macos', name: 'macOS', icon: '🍎', desc: 'Monterey+' },
                        { id: 'docker', name: 'Docker', icon: '🐳', desc: 'Container' },
                      ].map((platform) => (
                        <button
                          key={platform.id}
                          onClick={() => setSelectedPlatform(platform.id as AgentPlatform)}
                          className={`p-4 rounded-lg border-2 transition text-center ${
                            selectedPlatform === platform.id 
                              ? 'border-kali-blue bg-kali-blue/10' 
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="text-3xl mb-2">{platform.icon}</div>
                          <div className="font-semibold text-white text-sm">{platform.name}</div>
                          <p className="text-gray-500 text-xs mt-1">{platform.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SSH Credentials (for SSH connection) */}
                {connectionType === 'ssh' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">Host / IP</label>
                        <input
                          type="text"
                          value={sshCredentials.host}
                          onChange={(e) => setSshCredentials({...sshCredentials, host: e.target.value})}
                          placeholder="192.168.1.100"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">Port</label>
                        <input
                          type="text"
                          value={sshCredentials.port}
                          onChange={(e) => setSshCredentials({...sshCredentials, port: e.target.value})}
                          placeholder="22"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Username</label>
                      <input
                        type="text"
                        value={sshCredentials.username}
                        onChange={(e) => setSshCredentials({...sshCredentials, username: e.target.value})}
                        placeholder="root"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Authentication</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="password"
                            value={sshCredentials.password}
                            onChange={(e) => setSshCredentials({...sshCredentials, password: e.target.value})}
                            placeholder="Password"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={sshCredentials.keyFile}
                            onChange={(e) => setSshCredentials({...sshCredentials, keyFile: e.target.value})}
                            placeholder="Or SSH Key Path"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-sm">
                        ⚠️ SSH credentials are encrypted and stored securely. We recommend using SSH keys for better security.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={addAgent}
                  disabled={!newAgentName.trim() || (connectionType === 'ssh' && !sshCredentials.host)}
                  className="w-full py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
                >
                  {connectionType === 'ssh' ? 'Connect via SSH' : 'Generate Installation Command'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 font-medium mb-2">✓ Agent Created - {getPlatformIcon(selectedPlatform)} {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}</p>
                  <p className="text-gray-400 text-sm">
                    {connectionType === 'ssh' 
                      ? 'SSH connection configured. Testing connection...'
                      : 'Use the installation command below on your target machine.'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    {connectionType === 'ssh' ? 'Connection Details' : 'Installation Command'}
                  </label>
                  <div className="relative">
                    <pre className="p-4 bg-gray-800 rounded-lg text-sm text-kali-blue font-mono overflow-x-auto whitespace-pre-wrap">
{getInstallCommand()}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getInstallCommand())}
                      className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h4 className="text-white font-medium mb-2">
                    {selectedPlatform === 'windows' ? 'Windows Requirements:' :
                     selectedPlatform === 'macos' ? 'macOS Requirements:' :
                     selectedPlatform === 'docker' ? 'Docker Requirements:' :
                     'Linux Requirements:'}
                  </h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    {selectedPlatform === 'windows' ? (
                      <>
                        <li>• Windows Server 2019+ or Windows 10/11</li>
                        <li>• PowerShell 5.1+ (Run as Administrator)</li>
                        <li>• .NET Framework 4.8+</li>
                        <li>• Outbound HTTPS (port 443) access</li>
                      </>
                    ) : selectedPlatform === 'macos' ? (
                      <>
                        <li>• macOS Monterey (12.0) or later</li>
                        <li>• Admin/sudo access</li>
                        <li>• Xcode Command Line Tools</li>
                        <li>• Outbound HTTPS (port 443) access</li>
                      </>
                    ) : selectedPlatform === 'docker' ? (
                      <>
                        <li>• Docker Engine 20.10+</li>
                        <li>• Docker Compose (optional)</li>
                        <li>• 2GB RAM, 5GB disk space</li>
                        <li>• Outbound HTTPS (port 443) access</li>
                      </>
                    ) : (
                      <>
                        <li>• Linux (Debian/Ubuntu/Kali recommended)</li>
                        <li>• Root or sudo access</li>
                        <li>• Outbound HTTPS (port 443) access</li>
                        <li>• Minimum 2GB RAM, 10GB disk space</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setInstallToken(null);
                    setSelectedPlatform('linux');
                    setConnectionType('direct');
                    setSshCredentials({ host: '', port: '22', username: '', password: '', keyFile: '' });
                  }}
                  className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
