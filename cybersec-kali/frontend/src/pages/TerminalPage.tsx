import { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, Wifi, Plus, X, 
  Maximize2, Minimize2, Copy
} from 'lucide-react';
import { apiUrl } from '../config/api';

interface TerminalTab {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'ssh' | 'telnet' | 'rdp' | 'ftp' | 'local';
  username?: string;
  password?: string;
  authMethod?: 'password' | 'key';
  sshKey?: string;
  sshKeyPassphrase?: string;
  serverId?: number;
  connected: boolean;
  output: string[];
}

export default function TerminalPage() {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: 'local-1',
      name: 'Local Terminal',
      host: 'localhost',
      port: 0,
      protocol: 'local',
      connected: true,
      output: [
        '╔═══════════════════════════════════════════════════════════════╗',
        '║       CyberSec Pro - Security Testing Terminal                 ║',
        '║       Type "help" for available commands                       ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
        'root@cybersec:~# '
      ]
    }
  ]);
  const [activeTab, setActiveTab] = useState('local-1');
  const [input, setInput] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Connection form
  const [connectForm, setConnectForm] = useState({
    name: '',
    host: '10.0.0.115',
    port: 22,
    protocol: 'ssh' as 'ssh' | 'telnet' | 'rdp' | 'ftp' | 'local',
    username: 'root',
    password: '',
    authMethod: 'password' as 'password' | 'key',
    sshKey: '',
    sshKeyPassphrase: ''
  });
  type ConnectionConfig = typeof connectForm & { serverId?: number };

  // Parse URL params for direct connection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const protocol = params.get('protocol') as 'ssh' | 'telnet' | 'rdp' | 'ftp' | 'local';
    const port = params.get('port');
    const user = params.get('user');
    const password = params.get('password') || '';
    const storedConnect = sessionStorage.getItem('terminal-connect');
    let storedPayload: null | {
      serverId?: number;
      host?: string;
      port?: number;
      protocol?: string;
      username?: string;
      password?: string;
      authMethod?: 'password' | 'key';
      sshKey?: string;
      sshKeyPassphrase?: string;
    } = null;

    if (storedConnect) {
      try {
        storedPayload = JSON.parse(storedConnect);
      } catch {
        storedPayload = null;
      }
    }
    
    if (protocol === 'local') {
      connectToServer({
        name: 'Local Terminal',
        host: 'localhost',
        port: 0,
        protocol: 'local',
        username: 'root',
        password: '',
        authMethod: 'password',
        sshKey: '',
        sshKeyPassphrase: ''
      });
      return;
    }

    if (host && protocol) {
      const defaultPort = protocol === 'ssh' ? '22' : protocol === 'telnet' ? '23' : protocol === 'rdp' ? '3389' : protocol === 'ftp' ? '21' : '0';
      const useStored = storedPayload
        && storedPayload.host === host
        && String(storedPayload.port || '') === String(port || defaultPort)
        && storedPayload.protocol === protocol;
      connectToServer({
        name: `${protocol.toUpperCase()} - ${host}`,
        host,
        port: parseInt(port || defaultPort),
        protocol,
        username: user || 'root',
        password: useStored ? (storedPayload?.password || '') : password,
        authMethod: useStored ? (storedPayload?.authMethod || 'password') : 'password',
        sshKey: useStored ? (storedPayload?.sshKey || '') : '',
        sshKeyPassphrase: useStored ? (storedPayload?.sshKeyPassphrase || '') : '',
        serverId: useStored ? storedPayload?.serverId : undefined
      });
      if (useStored) {
        sessionStorage.removeItem('terminal-connect');
      }
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [tabs]);

  // Focus input on click
  useEffect(() => {
    const handleClick = () => inputRef.current?.focus();
    terminalRef.current?.addEventListener('click', handleClick);
    return () => terminalRef.current?.removeEventListener('click', handleClick);
  }, []);

  const connectToServer = async (config: ConnectionConfig) => {
    const newTab: TerminalTab = {
      id: `${config.protocol}-${Date.now()}`,
      name: config.name || `${config.protocol.toUpperCase()} - ${config.host}`,
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      username: config.username,
      password: config.password,
      authMethod: config.authMethod,
      sshKey: config.sshKey,
      sshKeyPassphrase: config.sshKeyPassphrase,
      serverId: config.serverId,
      connected: false,
      output: [
        `Connecting to ${config.host}:${config.port} via ${config.protocol.toUpperCase()}...`,
        ''
      ]
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newTab.id);
    setShowConnectModal(false);

    try {
      const response = await fetch(apiUrl('/api/terminal/connect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          protocol: config.protocol,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          server_id: config.serverId,
          ssh_key: config.authMethod === 'key' ? config.sshKey : '',
          ssh_key_passphrase: config.authMethod === 'key' ? config.sshKeyPassphrase : ''
        })
      });
      const data = await response.json();
      const connected = response.ok && data?.connected;

      setTabs(prev => prev.map(tab => {
        if (tab.id === newTab.id) {
          return {
            ...tab,
            connected,
            output: [
              ...tab.output,
              connected ? `Connected to ${config.host || 'local'}` : `Connection failed: ${data?.error || 'Unknown error'}`,
              connected && config.protocol !== 'local' ? `Last login: ${new Date().toLocaleString()}` : '',
              '',
              `${config.protocol === 'local' ? 'root@cybersec' : `${config.username}@${config.host}`}:~${config.protocol === 'local' ? '# ' : '$ '}`
            ].filter(line => line !== '')
          };
        }
        return tab;
      }));
    } catch (error) {
      setTabs(prev => prev.map(tab => {
        if (tab.id === newTab.id) {
          return {
            ...tab,
            connected: false,
            output: [
              ...tab.output,
              `Connection failed: ${String(error)}`,
              ''
            ]
          };
        }
        return tab;
      }));
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    // Add to history
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    const activeTerminal = tabs.find(t => t.id === activeTab);
    if (!activeTerminal) return;

    const prompt = activeTerminal.protocol === 'local' 
      ? 'root@cybersec:~# '
      : `${activeTerminal.username}@${activeTerminal.host}:~$ `;

    if (activeTerminal.protocol === 'rdp' || activeTerminal.protocol === 'ftp') {
      const message = activeTerminal.protocol === 'rdp'
        ? 'RDP sessions are external. Use an RDP client to connect.'
        : 'FTP sessions are external. Use an FTP client to connect.';
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTab) {
          return {
            ...tab,
            output: [...tab.output.slice(0, -1), prompt + cmd, message, prompt]
          };
        }
        return tab;
      }));
      setInput('');
      return;
    }

    const lowerCmd = cmd.toLowerCase().trim();
    if (lowerCmd === 'clear') {
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab ? { ...tab, output: [prompt] } : tab
      ));
      setInput('');
      return;
    } else if (lowerCmd === 'exit') {
      if (activeTerminal.protocol !== 'local') {
        setTabs(prev => prev.filter(tab => tab.id !== activeTab));
        const remainingTabs = tabs.filter(t => t.id !== activeTab);
        if (remainingTabs.length > 0) {
          setActiveTab(remainingTabs[0].id);
        }
        return;
      } else {
        const output = ['', 'Cannot exit local terminal', ''];
        setTabs(prev => prev.map(tab => {
          if (tab.id === activeTab) {
            return {
              ...tab,
              output: [...tab.output.slice(0, -1), prompt + cmd, ...output, prompt]
            };
          }
          return tab;
        }));
        setInput('');
        return;
      }
    }

    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTab) {
        return {
          ...tab,
          output: [...tab.output.slice(0, -1), prompt + cmd, '']
        };
      }
      return tab;
    }));

    try {
      const response = await fetch(apiUrl('/api/terminal/execute'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: cmd,
          protocol: activeTerminal.protocol,
          host: activeTerminal.host,
          port: activeTerminal.port,
          username: activeTerminal.username,
          password: activeTerminal.password,
          server_id: activeTerminal.serverId,
          ssh_key: activeTerminal.authMethod === 'key' ? activeTerminal.sshKey : '',
          ssh_key_passphrase: activeTerminal.authMethod === 'key' ? activeTerminal.sshKeyPassphrase : ''
        })
      });

      const data = await response.json();
      const outputLines = Array.isArray(data?.output) ? data.output : [];
      const errorLine = data?.error ? [`Error: ${data.error}`] : [];
      const finalLines = outputLines.length > 0 ? outputLines : [''];

      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTab) {
          return {
            ...tab,
            output: [...tab.output.slice(0, -1), ...finalLines, ...errorLine, prompt]
          };
        }
        return tab;
      }));
    } catch (error) {
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTab) {
          return {
            ...tab,
            output: [...tab.output.slice(0, -1), `Error: ${String(error)}`, prompt]
          };
        }
        return tab;
      }));
    } finally {
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void executeCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion
      const commands = ['nmap', 'nikto', 'sqlmap', 'hydra', 'gobuster', 'curl', 'ping', 'whoami', 'pwd', 'ls', 'clear', 'exit', 'help'];
      const match = commands.find(c => c.startsWith(input));
      if (match) setInput(match);
    }
  };

  const copyOutput = () => {
    const activeTerminal = tabs.find(t => t.id === activeTab);
    if (activeTerminal) {
      navigator.clipboard.writeText(activeTerminal.output.join('\n'));
    }
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.protocol === 'local') return; // Can't close local terminal
    
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) {
      const remaining = tabs.filter(t => t.id !== tabId);
      if (remaining.length > 0) {
        setActiveTab(remaining[0].id);
      }
    }
  };

  const activeTerminal = tabs.find(t => t.id === activeTab);
  const connectDisabled = (connectForm.protocol !== 'local' && !connectForm.host)
    || (connectForm.protocol === 'ssh' && connectForm.authMethod === 'key' && !connectForm.sshKey.trim());

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-dark-bg' : 'min-h-screen'} p-4`}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <TerminalIcon className="w-8 h-8" />
              Terminal
            </h1>
            <p className="text-gray-400 mt-2">SSH/Telnet/RDP/FTP connections and command execution</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Connection
            </button>
          </div>
        </div>
      )}

      {/* Terminal Container */}
      <div className={`glass rounded-xl overflow-hidden ${isFullscreen ? 'h-full' : 'h-[calc(100vh-200px)]'}`}>
        {/* Tabs */}
        <div className="flex items-center bg-dark-bg/50 border-b border-dark-border overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-dark-border min-w-[150px] ${
                activeTab === tab.id ? 'bg-dark-card' : 'hover:bg-dark-card/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${tab.connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-sm truncate flex-1">{tab.name}</span>
              {tab.protocol !== 'local' && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="p-1 hover:bg-dark-bg rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowConnectModal(true)}
            className="p-2 hover:bg-dark-card"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          <div className="ml-auto flex items-center gap-1 pr-2">
            <button onClick={copyOutput} className="p-2 hover:bg-dark-card rounded" title="Copy output">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-dark-card rounded">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Terminal Output */}
        <div 
          ref={terminalRef}
          className="h-[calc(100%-90px)] overflow-y-auto p-4 font-mono text-sm bg-[#0a0a0f]"
          onClick={() => inputRef.current?.focus()}
        >
          {activeTerminal?.output.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line.includes('root@') || line.includes('$') ? (
                <span>
                  <span className="text-green-400">{line.split(':')[0]}:</span>
                  <span className="text-blue-400">{line.split(':')[1]?.split(/[$#]/)[0] || ''}</span>
                  <span className="text-white">{line.includes('$') ? '$ ' : '# '}</span>
                  <span>{line.split(/[$#]\s*/)[1] || ''}</span>
                </span>
              ) : line.startsWith('╔') || line.startsWith('║') || line.startsWith('╚') ? (
                <span className="text-primary">{line}</span>
              ) : line.includes('Connected') || line.includes('open') ? (
                <span className="text-green-400">{line}</span>
              ) : line.includes('Error') || line.includes('failed') ? (
                <span className="text-red-400">{line}</span>
              ) : (
                <span className="text-gray-300">{line}</span>
              )}
            </div>
          ))}
          
          {/* Active input line */}
          {activeTerminal?.connected && (
            <div className="flex items-center">
              <span className="text-green-400">
                {activeTerminal.protocol === 'local' ? 'root@cybersec' : `${activeTerminal.username}@${activeTerminal.host}`}
              </span>
              <span className="text-white">:</span>
              <span className="text-blue-400">~</span>
              <span className="text-white">{activeTerminal.protocol === 'local' ? '# ' : '$ '}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-white"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Quick Commands */}
        <div className="p-2 border-t border-dark-border bg-dark-bg/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-500">Quick:</span>
          {['nmap -sV 10.0.0.115', 'ping 10.0.0.115', 'whoami', 'ls -la', 'clear'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => { setInput(cmd); inputRef.current?.focus(); }}
              className="px-2 py-1 bg-dark-card text-xs rounded hover:bg-primary/20 whitespace-nowrap"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-xl font-bold">New Connection</h2>
              <button onClick={() => setShowConnectModal(false)} className="p-2 hover:bg-dark-bg rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Connection Name</label>
                <input
                  type="text"
                  value={connectForm.name}
                  onChange={(e) => setConnectForm({ ...connectForm, name: e.target.value })}
                  placeholder="Target Server"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Connection Type</label>
                  <select
                    value={connectForm.protocol}
                    onChange={(e) => setConnectForm({
                      ...connectForm,
                      protocol: e.target.value as 'ssh' | 'telnet' | 'rdp' | 'ftp' | 'local',
                      port: e.target.value === 'ssh' ? 22 : e.target.value === 'telnet' ? 23 : e.target.value === 'rdp' ? 3389 : e.target.value === 'ftp' ? 21 : 0,
                      authMethod: e.target.value === 'ssh' ? connectForm.authMethod : 'password',
                      sshKey: e.target.value === 'ssh' ? connectForm.sshKey : '',
                      sshKeyPassphrase: e.target.value === 'ssh' ? connectForm.sshKeyPassphrase : ''
                    })}
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  >
                    <option value="local">Local (Server)</option>
                    <option value="ssh">SSH</option>
                    <option value="telnet">Telnet</option>
                    <option value="rdp">RDP</option>
                    <option value="ftp">FTP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host / IP</label>
                  <input
                    type="text"
                    value={connectForm.host}
                    onChange={(e) => setConnectForm({ ...connectForm, host: e.target.value })}
                    placeholder="10.0.0.115"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                    disabled={connectForm.protocol === 'local'}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={connectForm.port}
                    onChange={(e) => setConnectForm({ ...connectForm, port: parseInt(e.target.value) })}
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                    disabled={connectForm.protocol === 'local'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={connectForm.username}
                    onChange={(e) => setConnectForm({ ...connectForm, username: e.target.value })}
                    placeholder="root"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                    disabled={connectForm.protocol === 'local'}
                  />
                </div>
                {connectForm.protocol === 'ssh' ? (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Auth Method</label>
                    <select
                      value={connectForm.authMethod}
                      onChange={(e) => setConnectForm({ ...connectForm, authMethod: e.target.value as 'password' | 'key' })}
                      className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                    >
                      <option value="password">Password</option>
                      <option value="key">SSH Key</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Password</label>
                    <input
                      type="password"
                      value={connectForm.password}
                      onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                      disabled={connectForm.protocol === 'local'}
                    />
                  </div>
                )}
              </div>
              {connectForm.protocol === 'ssh' && connectForm.authMethod === 'password' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={connectForm.password}
                    onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
              )}
              {connectForm.protocol === 'ssh' && connectForm.authMethod === 'key' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">SSH Private Key</label>
                    <textarea
                      value={connectForm.sshKey}
                      onChange={(e) => setConnectForm({ ...connectForm, sshKey: e.target.value })}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg min-h-[120px] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Key Passphrase (Optional)</label>
                    <input
                      type="password"
                      value={connectForm.sshKeyPassphrase}
                      onChange={(e) => setConnectForm({ ...connectForm, sshKeyPassphrase: e.target.value })}
                      placeholder="••••••••"
                      className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-border flex gap-4">
              <button
                onClick={() => setShowConnectModal(false)}
                className="flex-1 py-2 bg-dark-bg border border-dark-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => connectToServer(connectForm)}
                disabled={connectDisabled}
                className="flex-1 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Wifi className="w-4 h-4" />
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
