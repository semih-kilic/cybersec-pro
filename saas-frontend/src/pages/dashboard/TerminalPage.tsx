import { useEffect, useRef, useState, useCallback } from 'react';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useToast } from '../../components/ui/Toast';
import { useTerminalAgents } from '../../hooks/useApiQueries';

interface Agent {
  id: number | string;
  name: string;
  hostname: string;
  ip_address: string;
  platform: string;
  status: string;
  ssh_host: string;
  ssh_port: number;
  ssh_username: string;
  connection_type?: string;
}

interface HistoryLine {
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp?: Date;
}

export function TerminalPage() {
  useDocumentTitle('Terminal — CyberSec Pro');
  const toast = useToast();
  const { token } = useAuth();
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: fetchedAgents = [] } = useTerminalAgents();
  const agents = fetchedAgents as unknown as Agent[];
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<HistoryLine[]>([
    { type: 'system', content: '╔════════════════════════════════════════════════════════════════════╗' },
    { type: 'system', content: '║     ██╗  ██╗ █████╗ ██╗     ██╗    ██████╗ ██████╗  ██████╗       ║' },
    { type: 'system', content: '║     ██║ ██╔╝██╔══██╗██║     ██║    ██╔══██╗██╔══██╗██╔═══██╗      ║' },
    { type: 'system', content: '║     █████╔╝ ███████║██║     ██║    ██████╔╝██████╔╝██║   ██║      ║' },
    { type: 'system', content: '║     ██╔═██╗ ██╔══██║██║     ██║    ██╔═══╝ ██╔══██╗██║   ██║      ║' },
    { type: 'system', content: '║     ██║  ██╗██║  ██║███████╗██║    ██║     ██║  ██║╚██████╔╝      ║' },
    { type: 'system', content: '║     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝       ║' },
    { type: 'system', content: '╠════════════════════════════════════════════════════════════════════╣' },
    { type: 'system', content: '║  🔒 CyberSec Pro - Real SSH Terminal                               ║' },
    { type: 'system', content: '║  Select an agent from dropdown to connect                         ║' },
    { type: 'system', content: '╚════════════════════════════════════════════════════════════════════╝' },
    { type: 'system', content: '' },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPath, setCurrentPath] = useState('~');

  // Auto-select first online agent when data loads
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      const onlineAgent = agents.find((a: Agent) => a.status === 'online');
      if (onlineAgent) setSelectedAgent(onlineAgent);
    }
  }, [agents]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const testConnection = async () => {
    if (!selectedAgent) return;
    
    setHistory(prev => [...prev, { 
      type: 'system', 
      content: `🔄 Testing connection to ${selectedAgent.name}...` 
    }]);

    try {
      const response = await fetch('/api/v1/terminal/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_id: selectedAgent.id })
      });

      const data = await response.json();

      if (data.connected) {
        setIsConnected(true);
        setHistory(prev => [...prev, 
          { type: 'output', content: `✅ Connected to ${selectedAgent.name} (${selectedAgent.platform})` },
          { type: 'output', content: `📍 System: ${data.system_info}` },
          { type: 'system', content: '' },
          { type: 'system', content: 'Type "help" for available commands or any shell command.' },
          { type: 'system', content: '' }
        ]);
        fetchAgents(); // Refresh agent status
      } else {
        setIsConnected(false);
        setHistory(prev => [...prev, { 
          type: 'error', 
          content: `❌ Connection failed: ${data.error}` 
        }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { 
        type: 'error', 
        content: `❌ Connection error: ${err}` 
      }]);
    }
  };

  const executeCommand = useCallback(async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to history
    const promptUser = selectedAgent?.ssh_username || 'kali';
    const promptHost = selectedAgent?.hostname || 'cybersec';
    const prompt = `┌──(${promptUser}㉿${promptHost})-[${currentPath}]\n└─$ ${trimmedCommand}`;
    
    setHistory(prev => [...prev, { type: 'input', content: prompt }]);
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);
    setCurrentInput('');

    // Handle local commands
    const [cmd] = trimmedCommand.split(' ');

    // Local commands that don't need SSH
    if (cmd.toLowerCase() === 'clear') {
      setHistory([]);
      return;
    }

    if (cmd.toLowerCase() === 'help') {
      setHistory(prev => [...prev, { 
        type: 'output', 
        content: `
╔════════════════════════════════════════════════════════════════════╗
║                    CyberSec Pro Terminal Help                       ║
╠════════════════════════════════════════════════════════════════════╣
║  LOCAL COMMANDS (work without SSH connection):                      ║
║    help          - Show this help message                          ║
║    clear         - Clear the terminal screen                       ║
║    agents        - List available agents                           ║
║    connect       - Test connection to selected agent               ║
║                                                                    ║
║  SECURITY TOOLS (requires SSH connection):                         ║
║    nmap          - Network mapper and port scanner                 ║
║    nikto         - Web server vulnerability scanner                ║
║    sqlmap        - SQL injection detection tool                    ║
║    dirb          - Web content scanner                             ║
║    gobuster      - Directory/file brute-forcer                     ║
║    hydra         - Password cracker                                ║
║    wpscan        - WordPress vulnerability scanner                 ║
║    whatweb       - Web technology identifier                       ║
║    ffuf          - Fast web fuzzer                                 ║
║    nuclei        - Vulnerability scanner                           ║
║    subfinder     - Subdomain discovery                             ║
║    httpx         - HTTP toolkit                                    ║
║    amass         - Network mapping                                 ║
║    masscan       - Fast port scanner                               ║
║                                                                    ║
║  SYSTEM COMMANDS (all Linux/Windows commands work):                ║
║    ls, pwd, cd, cat, grep, find, ps, top, etc.                     ║
║    Any command installed on the remote system                      ║
║                                                                    ║
║  TIPS:                                                             ║
║    • Use ↑/↓ arrows for command history                            ║
║    • Press Ctrl+L to clear screen                                  ║
║    • Press Ctrl+C to cancel current input                          ║
║    • Commands execute on the selected SSH agent                    ║
╚════════════════════════════════════════════════════════════════════╝
`.trim()
      }]);
      return;
    }

    if (cmd.toLowerCase() === 'agents') {
      const agentList = agents.map(a => 
        `  ${a.status === 'online' ? '🟢' : '🔴'} ${a.name} (${a.ip_address}) - ${a.platform}`
      ).join('\n');
      setHistory(prev => [...prev, { 
        type: 'output', 
        content: `Available Agents:\n${agentList || '  No agents configured. Add agents in the Agents page.'}`
      }]);
      return;
    }

    if (cmd.toLowerCase() === 'connect') {
      testConnection();
      return;
    }

    // Check if connected for remote commands
    if (!isConnected) {
      setHistory(prev => [...prev, { 
        type: 'error', 
        content: `⚠️ Not connected to any agent.\nSelect an agent from the dropdown and click "Connect" to establish SSH connection.\nType "agents" to see available agents.`
      }]);
      return;
    }

    if (!selectedAgent) {
      setHistory(prev => [...prev, { 
        type: 'error', 
        content: '⚠️ No agent selected. Select an agent from the dropdown above.'
      }]);
      return;
    }

    // Execute command via SSH
    setIsExecuting(true);
    try {
      const response = await fetch('/api/v1/terminal/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          command: trimmedCommand
        })
      });

      const data = await response.json();

      if (data.output) {
        // Check if command was cd and update path
        if (cmd.toLowerCase() === 'cd') {
          // Try to get new path
          const pwdResponse = await fetch('/api/v1/terminal/execute', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              agent_id: selectedAgent.id,
              command: 'pwd'
            })
          });
          const pwdData = await pwdResponse.json();
          if (pwdData.output) {
            const newPath = pwdData.output.trim().replace(/^\/home\/[^/]+/, '~');
            setCurrentPath(newPath);
          }
        }

        setHistory(prev => [...prev, { 
          type: data.exit_code === 0 ? 'output' : 'error', 
          content: data.output
        }]);
      } else if (data.error) {
        setHistory(prev => [...prev, { type: 'error', content: `Error: ${data.error}` }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', content: `Execution failed: ${err}` }]);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedAgent, isConnected, currentPath, token, agents]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    } else if (e.key === 'c' && e.ctrlKey) {
      setCurrentInput('');
      setHistory(prev => [...prev, { type: 'output', content: '^C' }]);
    }
  };

  const quickCommands = [
    // Security Tools
    { label: 'nmap scan', cmd: 'nmap -sV -sC -Pn', category: 'scan' },
    { label: 'nikto', cmd: 'nikto -h', category: 'scan' },
    { label: 'dirb', cmd: 'dirb http://', category: 'scan' },
    { label: 'gobuster', cmd: 'gobuster dir -u http:// -w /usr/share/wordlists/dirb/common.txt', category: 'scan' },
    { label: 'sqlmap', cmd: 'sqlmap -u', category: 'scan' },
    { label: 'wpscan', cmd: 'wpscan --url', category: 'scan' },
    { label: 'whatweb', cmd: 'whatweb', category: 'recon' },
    { label: 'whois', cmd: 'whois', category: 'recon' },
    { label: 'dig', cmd: 'dig', category: 'recon' },
    { label: 'nslookup', cmd: 'nslookup', category: 'recon' },
    { label: 'traceroute', cmd: 'traceroute', category: 'recon' },
    { label: 'ping', cmd: 'ping -c 4', category: 'recon' },
    // System
    { label: 'top', cmd: 'top -b -n 1 | head -20', category: 'system' },
    { label: 'df -h', cmd: 'df -h', category: 'system' },
    { label: 'free -m', cmd: 'free -m', category: 'system' },
    { label: 'ps aux', cmd: 'ps aux | head -20', category: 'system' },
    { label: 'netstat', cmd: 'netstat -tlnp', category: 'system' },
    { label: 'ifconfig', cmd: 'ifconfig || ip addr', category: 'system' },
    // Utils
    { label: 'clear', cmd: 'clear', category: 'util' },
    { label: 'help', cmd: 'help', category: 'util' },
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'scan': return 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-600/30';
      case 'recon': return 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-600/30';
      case 'system': return 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30';
      default: return 'bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 border-gray-600/30';
    }
  };

  const promptUser = selectedAgent?.ssh_username || 'kali';
  const promptHost = selectedAgent?.hostname || 'cybersec';

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="SSH Terminal"
        subtitle="Real-time SSH connection to your agents"
      />

      <div className="p-6">
        {/* Agent Selection Bar */}
        <div className="mb-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Agent:</span>
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => String(a.id) === e.target.value);
                  setSelectedAgent(agent || null);
                  setIsConnected(false);
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select an agent...</option>
                {agents.length === 0 && (
                  <option value="" disabled>No agents configured</option>
                )}
                {agents.map(agent => (
                  <option key={String(agent.id)} value={String(agent.id)}>
                    {agent.status === 'online' ? '🟢' : '🔴'} {agent.name} {agent.ip_address ? `(${agent.ip_address})` : ''} {agent.connection_type === 'local' ? '[Local]' : '[SSH]'}
                  </option>
                ))}
              </select>
              {agents.length === 0 && (
                <span className="text-amber-400 text-xs ml-2">
                  💡 Deploy a Remote Agent to connect to internal networks
                </span>
              )}
            </div>

            <button
              onClick={testConnection}
              disabled={!selectedAgent}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect
            </button>

            <button
              onClick={fetchAgents}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            {/* Connection Status */}
            <div className="ml-auto flex items-center gap-4">
              {selectedAgent && (
                <div className="text-sm">
                  <span className="text-gray-500">Platform:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded ${
                    selectedAgent.platform === 'kali' ? 'bg-purple-600/20 text-purple-400' :
                    selectedAgent.platform === 'windows' ? 'bg-blue-600/20 text-blue-400' :
                    'bg-green-600/20 text-green-400'
                  }`}>
                    {selectedAgent.platform}
                  </span>
                </div>
              )}
              
              {isConnected ? (
                <span className="flex items-center gap-2 text-green-400 text-sm bg-green-600/10 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  SSH Connected
                </span>
              ) : (
                <span className="flex items-center gap-2 text-gray-400 text-sm bg-gray-600/10 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Not Connected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Terminal Window */}
        <div className="bg-[#0d0d0d] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-gray-400 text-sm ml-3">
                {selectedAgent ? `${promptUser}@${promptHost}:${currentPath}` : 'No agent selected'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isExecuting && (
                <span className="flex items-center gap-1.5 text-yellow-400 text-xs">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Executing...
                </span>
              )}
              <button 
                onClick={() => setHistory([])}
                className="text-gray-400 hover:text-white transition p-1"
                title="Clear terminal"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div 
            ref={terminalRef}
            className="h-[calc(100vh-420px)] min-h-[400px] overflow-auto p-4 font-mono text-sm cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {/* History */}
            {history.map((line, idx) => (
              <div 
                key={idx} 
                className={`whitespace-pre-wrap break-all ${
                  line.type === 'input' ? 'text-green-400' :
                  line.type === 'error' ? 'text-red-400' :
                  line.type === 'system' ? 'text-cyan-400' :
                  'text-gray-300'
                }`}
              >
                {line.content}
              </div>
            ))}

            {/* Current Input */}
            <div className="flex items-start mt-1">
              <span className="text-green-400 whitespace-pre">{`┌──(${promptUser}㉿${promptHost})-[${currentPath}]
└─$ `}</span>
              <input
                ref={inputRef}
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExecuting}
                className="flex-1 bg-transparent border-none outline-none text-gray-100 font-mono disabled:opacity-50"
                spellCheck={false}
                autoComplete="off"
                placeholder={isExecuting ? 'Executing...' : ''}
              />
              {isExecuting && (
                <span className="w-2 h-4 bg-cyan-400 animate-pulse ml-1" />
              )}
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Commands
          </h4>
          
          <div className="space-y-3">
            {/* Security Scanning */}
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Security Scanning</span>
              <div className="flex flex-wrap gap-2">
                {quickCommands.filter(c => c.category === 'scan').map(({ label, cmd }) => (
                  <button
                    key={cmd}
                    onClick={() => setCurrentInput(cmd)}
                    className={`px-3 py-1.5 rounded border text-sm font-mono transition ${getCategoryColor('scan')}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reconnaissance */}
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Reconnaissance</span>
              <div className="flex flex-wrap gap-2">
                {quickCommands.filter(c => c.category === 'recon').map(({ label, cmd }) => (
                  <button
                    key={cmd}
                    onClick={() => setCurrentInput(cmd)}
                    className={`px-3 py-1.5 rounded border text-sm font-mono transition ${getCategoryColor('recon')}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* System */}
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">System Info</span>
              <div className="flex flex-wrap gap-2">
                {quickCommands.filter(c => c.category === 'system').map(({ label, cmd }) => (
                  <button
                    key={cmd}
                    onClick={() => setCurrentInput(cmd)}
                    className={`px-3 py-1.5 rounded border text-sm font-mono transition ${getCategoryColor('system')}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            SSH Terminal Tips
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• <strong>Connect First:</strong> Select an agent and click "Connect" before running commands</li>
            <li>• Use <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">↑</kbd> and <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">↓</kbd> to navigate command history</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+L</kbd> to clear the terminal</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+C</kbd> to cancel current input</li>
            <li>• All commands are executed on the remote agent via SSH</li>
            <li>• Click Quick Commands to paste commands instantly</li>
          </ul>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

export default TerminalPage;
