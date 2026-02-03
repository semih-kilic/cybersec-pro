import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

type AgentPlatform = 'linux' | 'windows' | 'macos' | 'docker';
type ConnectionType = 'direct' | 'ssh';

interface Agent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: 'online' | 'offline' | 'busy' | 'error' | 'pending';
  os: string;
  platform: AgentPlatform;
  version: string;
  last_seen: string | null;
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
}

export default function AgentsPage() {
  const { organization, token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Form state
  const [newAgentName, setNewAgentName] = useState('');
  const [installToken, setInstallToken] = useState<string | null>(null);
  const [installCommand, setInstallCommand] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<AgentPlatform>('linux');
  const [connectionType, setConnectionType] = useState<ConnectionType>('ssh');
  const [sshCredentials, setSshCredentials] = useState({ 
    host: '', 
    port: '22', 
    username: 'root', 
    password: '' 
  });

  const userPlan = organization?.plan_type || 'trial';
  const planSupportsAgents = ['team', 'enterprise'].includes(userPlan);
  const maxAgents = userPlan === 'enterprise' ? 999 : userPlan === 'team' ? 1 : 0;

  useEffect(() => {
    if (planSupportsAgents) {
      fetchAgents();
    } else {
      setLoading(false);
    }
  }, [planSupportsAgents]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/v1/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

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
          ssh_host: connectionType === 'ssh' ? sshCredentials.host : undefined,
          ssh_port: connectionType === 'ssh' ? parseInt(sshCredentials.port) : undefined,
          ssh_username: connectionType === 'ssh' ? sshCredentials.username : undefined,
          ssh_password: connectionType === 'ssh' ? sshCredentials.password : undefined,
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setInstallToken(data.registration_token);
        setInstallCommand(data.install_command);
        setAgents([...agents, data.agent]);
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
    
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: selectedAgent.name,
          ssh_host: selectedAgent.ssh_host,
          ssh_port: selectedAgent.ssh_port,
          ssh_username: selectedAgent.ssh_username,
          location: selectedAgent.location,
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAgents(agents.map(a => a.id === selectedAgent.id ? data.agent : a));
        setShowEditModal(false);
        setSelectedAgent(null);
      } else {
        alert(data.error || 'Failed to update agent');
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    
    try {
      const res = await fetch(`/api/v1/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setAgents(agents.filter(a => a.id !== agentId));
        setSelectedAgent(null);
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
        message: data.success ? `Connected! OS: ${data.os_info || 'Unknown'}` : data.error
      });
      
      if (data.success) {
        fetchAgents();
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'text-green-400 bg-green-400/20';
      case 'busy': return 'text-yellow-400 bg-yellow-400/20';
      case 'offline': return 'text-gray-400 bg-gray-400/20';
      case 'error': return 'text-red-400 bg-red-400/20';
      case 'pending': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getPlatformIcon = (platform: AgentPlatform) => {
    switch (platform) {
      case 'windows': return '🪟';
      case 'macos': return '🍎';
      case 'docker': return '🐳';
      default: return '🐧';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const resetAddForm = () => {
    setNewAgentName('');
    setInstallToken(null);
    setInstallCommand('');
    setSelectedPlatform('linux');
    setConnectionType('ssh');
    setSshCredentials({ host: '', port: '22', username: 'root', password: '' });
    setShowAddModal(false);
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
            Deploy remote scanning agents in your infrastructure for internal network testing.
          </p>
          <a href="/dashboard/billing" className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium">
            Upgrade to Team - €49/mo
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-kali-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Remote Agents</h1>
          <p className="text-gray-400">Deploy scanning agents in your infrastructure</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{agents.length} / {maxAgents === 999 ? '∞' : maxAgents} agents</span>
          <button onClick={() => setShowAddModal(true)} disabled={agents.length >= maxAgents} className="px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Agent
          </button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-2">No Agents Yet</h3>
          <p className="text-gray-400 mb-6">Add your first remote agent to start scanning internal networks</p>
          <button onClick={() => setShowAddModal(true)} className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition">Add First Agent</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div key={agent.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition cursor-pointer" onClick={() => setSelectedAgent(agent)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getPlatformIcon(agent.platform)}</span>
                  <div>
                    <h3 className="text-white font-medium">{agent.name}</h3>
                    <p className="text-gray-500 text-sm">{agent.hostname || 'pending-registration'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>{agent.status}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">IP Address</span><span className="text-cyan-400 font-mono">{agent.ip_address || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">OS</span><span className="text-gray-300">{agent.os || 'Pending...'}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs">
                <span className="text-gray-500">{agent.active_scans} active • {agent.total_scans} total scans</span>
                {agent.connection_type === 'ssh' && <span className="text-cyan-400">SSH</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">{installToken ? 'Agent Created!' : 'Add Remote Agent'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {!installToken ? (
                <>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Agent Name</label>
                    <input type="text" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="e.g., My PC, Office Server" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Connection Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setConnectionType('ssh')} className={`p-4 rounded-lg border ${connectionType === 'ssh' ? 'border-kali-blue bg-kali-blue/10' : 'border-gray-700 bg-gray-800'}`}>
                        <div className="text-2xl mb-2">🔐</div>
                        <div className="text-white font-medium">SSH Connection</div>
                        <div className="text-gray-500 text-xs">Connect to existing server</div>
                      </button>
                      <button onClick={() => setConnectionType('direct')} className={`p-4 rounded-lg border ${connectionType === 'direct' ? 'border-kali-blue bg-kali-blue/10' : 'border-gray-700 bg-gray-800'}`}>
                        <div className="text-2xl mb-2">📦</div>
                        <div className="text-white font-medium">Install Agent</div>
                        <div className="text-gray-500 text-xs">Install our agent software</div>
                      </button>
                    </div>
                  </div>
                  {connectionType === 'ssh' && (
                    <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg">
                      <h4 className="text-white font-medium">SSH Credentials</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-gray-500 text-xs mb-1">Host / IP</label>
                          <input type="text" value={sshCredentials.host} onChange={(e) => setSshCredentials({...sshCredentials, host: e.target.value})} placeholder="10.0.0.115" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-gray-500 text-xs mb-1">Port</label>
                          <input type="text" value={sshCredentials.port} onChange={(e) => setSshCredentials({...sshCredentials, port: e.target.value})} placeholder="22" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Username</label>
                        <input type="text" value={sshCredentials.username} onChange={(e) => setSshCredentials({...sshCredentials, username: e.target.value})} placeholder="root" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-gray-500 text-xs mb-1">Password</label>
                        <input type="password" value={sshCredentials.password} onChange={(e) => setSshCredentials({...sshCredentials, password: e.target.value})} placeholder="••••••••" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
                      </div>
                    </div>
                  )}
                  {connectionType === 'direct' && (
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Platform</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['linux', 'windows', 'macos', 'docker'] as AgentPlatform[]).map(p => (
                          <button key={p} onClick={() => setSelectedPlatform(p)} className={`p-3 rounded-lg border ${selectedPlatform === p ? 'border-kali-blue bg-kali-blue/10' : 'border-gray-700 bg-gray-800'}`}>
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
                  <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-lg">
                    <p className="text-green-400">✓ Agent "{newAgentName}" created successfully!</p>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{connectionType === 'ssh' ? 'SSH Configuration' : 'Installation Command'}</label>
                    <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 relative">
                      <pre className="whitespace-pre-wrap">{installCommand}</pre>
                      <button onClick={() => copyToClipboard(installCommand)} className="absolute top-2 right-2 p-2 hover:bg-gray-700 rounded transition" title="Copy">📋</button>
                    </div>
                  </div>
                  {connectionType === 'ssh' && (
                    <button onClick={() => testConnection(agents[agents.length - 1]?.id)} disabled={testingConnection} className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                      {testingConnection ? 'Testing Connection...' : 'Test SSH Connection'}
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
                <button onClick={addAgent} disabled={!newAgentName.trim() || (connectionType === 'ssh' && !sshCredentials.host)} className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition disabled:opacity-50">Create Agent</button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedAgent && !showEditModal && (
        <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-700 shadow-xl z-40 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
              <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-gray-800 rounded-lg transition">✕</button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">{getPlatformIcon(selectedAgent.platform)}</span>
              <div>
                <p className="text-gray-400 text-sm">{selectedAgent.hostname || 'pending-registration'}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedAgent.status)}`}>{selectedAgent.status}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">IP Address</p><p className="text-cyan-400 font-mono">{selectedAgent.ip_address || 'N/A'}</p></div>
                <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Location</p><p className="text-white">{selectedAgent.location || 'Unknown'}</p></div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Operating System</p><p className="text-white">{selectedAgent.os || 'Pending...'}</p></div>
              {selectedAgent.connection_type === 'ssh' && (
                <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">SSH Connection</p><p className="text-white font-mono text-sm">{selectedAgent.ssh_username}@{selectedAgent.ssh_host}:{selectedAgent.ssh_port}</p></div>
              )}
              <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Scans</p><p className="text-white">{selectedAgent.active_scans} active • {selectedAgent.total_scans} total</p></div>
              <div className="bg-gray-800/50 rounded-lg p-3"><p className="text-gray-500 text-xs mb-1">Last Seen</p><p className="text-white">{selectedAgent.last_seen ? new Date(selectedAgent.last_seen).toLocaleString() : 'Never'}</p></div>
            </div>
            <div className="mt-6 space-y-3">
              {selectedAgent.connection_type === 'ssh' && (
                <button onClick={() => testConnection(selectedAgent.id)} disabled={testingConnection} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50">
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              )}
              {testResult && <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{testResult.message}</div>}
              <button onClick={() => setShowEditModal(true)} className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition">Edit Agent</button>
              <button onClick={() => deleteAgent(selectedAgent.id)} className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition">Remove Agent</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-700"><h2 className="text-xl font-bold text-white">Edit Agent</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Agent Name</label>
                <input type="text" value={selectedAgent.name} onChange={(e) => setSelectedAgent({...selectedAgent, name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
              </div>
              {selectedAgent.connection_type === 'ssh' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-gray-400 text-sm mb-2">SSH Host</label>
                      <input type="text" value={selectedAgent.ssh_host || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_host: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Port</label>
                      <input type="number" value={selectedAgent.ssh_port || 22} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_port: parseInt(e.target.value)})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">SSH Username</label>
                    <input type="text" value={selectedAgent.ssh_username || ''} onChange={(e) => setSelectedAgent({...selectedAgent, ssh_username: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Location</label>
                <input type="text" value={selectedAgent.location || ''} onChange={(e) => setSelectedAgent({...selectedAgent, location: e.target.value})} placeholder="e.g., Office, Home Lab" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-kali-blue focus:outline-none" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setSelectedAgent(null); }} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
              <button onClick={updateAgent} className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
