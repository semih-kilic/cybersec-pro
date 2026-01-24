import { useState, useEffect } from 'react';
import { 
  Server, Plus, Wifi, WifiOff, Terminal, Trash2, Edit, 
  CheckCircle, XCircle, Clock, RefreshCw, Globe, Lock,
  Monitor, HardDrive, Cpu, MemoryStick
} from 'lucide-react';
import axios from 'axios';

const API_URL = '';

interface ServerInfo {
  id: number;
  name: string;
  host: string;
  port: number;
  protocol: 'ssh' | 'telnet' | 'ftp';
  username: string;
  status: 'online' | 'offline' | 'checking';
  last_check: string;
  os_type?: string;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  tags: string[];
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    protocol: 'ssh' as 'ssh' | 'telnet' | 'ftp',
    username: 'root',
    password: '',
    tags: ''
  });

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/servers`);
      setServers(response.data.servers || []);
    } catch (error) {
      console.error('Failed to load servers:', error);
      setErrorMessage('Failed to load servers. Please check the backend service.');
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  const checkServerStatus = async (serverId: number) => {
    setServers(prev => prev.map(s => 
      s.id === serverId ? { ...s, status: 'checking' as const } : s
    ));
    
    try {
      const response = await axios.post(`${API_URL}/api/servers/${serverId}/check`);
      setServers(prev => prev.map(s => 
        s.id === serverId ? { ...s, ...response.data, status: response.data.online ? 'online' : 'offline' } : s
      ));
    } catch (error) {
      console.error('Failed to check server status:', error);
      setServers(prev => prev.map(s => 
        s.id === serverId ? { ...s, status: 'offline', last_check: new Date().toISOString() } : s
      ));
      setErrorMessage('Failed to check server status.');
    }
  };

  const checkAllServers = async () => {
    for (const server of servers) {
      await checkServerStatus(server.id);
    }
  };

  const saveServer = async () => {
    const payload = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    if (editingServer && !payload.password) {
      delete (payload as { password?: string }).password;
    }

    try {
      const response = editingServer
        ? await axios.put(`${API_URL}/api/servers/${editingServer.id}`, payload)
        : await axios.post(`${API_URL}/api/servers`, payload);

      setServers(prev => editingServer
        ? prev.map(s => s.id === editingServer.id ? response.data : s)
        : [...prev, response.data]
      );
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save server:', error);
      setErrorMessage('Failed to save server.');
    }
  };

  const deleteServer = async (serverId: number) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/servers/${serverId}`);
    } catch (error) {
      console.error('Failed to delete server:', error);
      setErrorMessage('Failed to delete server.');
      return;
    }
    setServers(prev => prev.filter(s => s.id !== serverId));
  };

  const connectToServer = (server: ServerInfo) => {
    // Navigate to terminal with server info
    sessionStorage.setItem('terminal-connect', JSON.stringify({
      serverId: server.id,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      username: server.username
    }));
    const params = new URLSearchParams({
      server: String(server.id),
      host: server.host,
      port: String(server.port),
      protocol: server.protocol,
      user: server.username
    });
    window.location.href = `/terminal?${params.toString()}`;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: 22,
      protocol: 'ssh',
      username: 'root',
      password: '',
      tags: ''
    });
    setEditingServer(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-red-400';
      case 'checking': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="w-5 h-5" />;
      case 'offline': return <WifiOff className="w-5 h-5" />;
      case 'checking': return <RefreshCw className="w-5 h-5 animate-spin" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
          {errorMessage}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Server className="w-8 h-8" />
            Server Management
          </h1>
          <p className="text-gray-400 mt-2">Manage and connect to your servers via SSH/Telnet/FTP</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={checkAllServers}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-bg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Check All
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Server className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{servers.length}</div>
              <div className="text-gray-400 text-sm">Total Servers</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold">{servers.filter(s => s.status === 'online').length}</div>
              <div className="text-gray-400 text-sm">Online</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-2xl font-bold">{servers.filter(s => s.status === 'offline').length}</div>
              <div className="text-gray-400 text-sm">Offline</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Lock className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold">{servers.filter(s => s.protocol === 'ssh').length}</div>
              <div className="text-gray-400 text-sm">SSH Servers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servers.map((server) => (
          <div key={server.id} className="glass rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${server.status === 'online' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <Monitor className={`w-5 h-5 ${getStatusColor(server.status)}`} />
                </div>
                <div>
                  <h3 className="font-bold">{server.name}</h3>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    {server.host}:{server.port}
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-1 ${getStatusColor(server.status)}`}>
                {getStatusIcon(server.status)}
                <span className="text-sm capitalize">{server.status}</span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Protocol</span>
                <span className="uppercase font-mono bg-dark-bg px-2 py-0.5 rounded">
                  {server.protocol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Username</span>
                <span className="font-mono">{server.username}</span>
              </div>
              {server.os_type && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">OS</span>
                  <span>{server.os_type}</span>
                </div>
              )}

              {/* Resource Usage */}
              {server.status === 'online' && server.cpu_usage !== undefined && (
                <div className="space-y-2 pt-2 border-t border-dark-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span className="text-gray-400">CPU</span>
                    <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${server.cpu_usage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{server.cpu_usage}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MemoryStick className="w-4 h-4 text-secondary" />
                    <span className="text-gray-400">RAM</span>
                    <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-secondary to-primary"
                        style={{ width: `${server.memory_usage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{server.memory_usage}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400">Disk</span>
                    <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400"
                        style={{ width: `${server.disk_usage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{server.disk_usage}%</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {server.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {server.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-dark-border flex gap-2">
              <button
                onClick={() => connectToServer(server)}
                disabled={server.status !== 'online'}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
                  server.status === 'online'
                    ? 'bg-gradient-to-r from-primary to-secondary text-dark-bg'
                    : 'bg-dark-bg text-gray-500 cursor-not-allowed'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Connect
              </button>
              <button
                onClick={() => checkServerStatus(server.id)}
                className="p-2 bg-dark-bg rounded-lg hover:bg-dark-card"
              >
                <RefreshCw className={`w-4 h-4 ${server.status === 'checking' ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => {
                  setEditingServer(server);
                  setFormData({
                    name: server.name,
                    host: server.host,
                    port: server.port,
                    protocol: server.protocol,
                    username: server.username,
                    password: '',
                    tags: server.tags.join(', ')
                  });
                  setShowAddModal(true);
                }}
                className="p-2 bg-dark-bg rounded-lg hover:bg-dark-card"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteServer(server.id)}
                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Server Card */}
        <div 
          onClick={() => setShowAddModal(true)}
          className="glass rounded-xl border-2 border-dashed border-dark-border hover:border-primary cursor-pointer min-h-[300px] flex items-center justify-center"
        >
          <div className="text-center">
            <Plus className="w-12 h-12 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">Add New Server</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold">
                {editingServer ? 'Edit Server' : 'Add New Server'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Server Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Server"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host / IP</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="10.0.0.115"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      protocol: e.target.value as 'ssh' | 'telnet' | 'ftp',
                      port: e.target.value === 'ssh' ? 22 : e.target.value === 'telnet' ? 23 : 21
                    })}
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  >
                    <option value="ssh">SSH</option>
                    <option value="telnet">Telnet</option>
                    <option value="ftp">FTP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="root"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="production, web, target"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
            </div>
            <div className="p-6 border-t border-dark-border flex gap-4">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="flex-1 py-2 bg-dark-bg border border-dark-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveServer}
                disabled={!formData.name || !formData.host}
                className="flex-1 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold disabled:opacity-50"
              >
                {editingServer ? 'Save Changes' : 'Add Server'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
