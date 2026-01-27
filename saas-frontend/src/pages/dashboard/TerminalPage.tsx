import { useEffect, useRef, useState } from 'react';
import { Header } from '../../components/layout/Header';

export function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<{ type: 'input' | 'output' | 'error'; content: string }[]>([
    { type: 'output', content: '╔════════════════════════════════════════════════════════════════╗' },
    { type: 'output', content: '║     ██╗  ██╗ █████╗ ██╗     ██╗    ██████╗ ██████╗  ██████╗    ║' },
    { type: 'output', content: '║     ██║ ██╔╝██╔══██╗██║     ██║    ██╔══██╗██╔══██╗██╔═══██╗   ║' },
    { type: 'output', content: '║     █████╔╝ ███████║██║     ██║    ██████╔╝██████╔╝██║   ██║   ║' },
    { type: 'output', content: '║     ██╔═██╗ ██╔══██║██║     ██║    ██╔═══╝ ██╔══██╗██║   ██║   ║' },
    { type: 'output', content: '║     ██║  ██╗██║  ██║███████╗██║    ██║     ██║  ██║╚██████╔╝   ║' },
    { type: 'output', content: '║     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ║' },
    { type: 'output', content: '╠════════════════════════════════════════════════════════════════╣' },
    { type: 'output', content: '║  🔒 CyberSec Pro - Web-based Kali Linux Terminal                ║' },
    { type: 'output', content: '║  Type "help" for available commands                            ║' },
    { type: 'output', content: '╚════════════════════════════════════════════════════════════════╝' },
    { type: 'output', content: '' },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Auto-scroll to bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to history
    setHistory(prev => [...prev, { type: 'input', content: `┌──(kali㉿cybersec)-[~]\n└─$ ${trimmedCommand}` }]);
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);
    setCurrentInput('');

    // Handle built-in commands
    const [cmd, ...args] = trimmedCommand.split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        setHistory(prev => [...prev, { 
          type: 'output', 
          content: `
Available Commands:
  help          Show this help message
  clear         Clear the terminal screen
  whoami        Display current user
  pwd           Print working directory
  ls            List directory contents
  cat <file>    Display file contents
  nmap          Network scanner
  sqlmap        SQL injection tool
  nikto         Web server scanner
  hydra         Password cracker
  gobuster      Directory/file brute-forcer
  dirb          Web content scanner
  wpscan        WordPress vulnerability scanner
  john          Password hash cracker
  
Type any tool name followed by -h for help.
Example: nmap -h
          `.trim()
        }]);
        break;

      case 'clear':
        setHistory([]);
        break;

      case 'whoami':
        setHistory(prev => [...prev, { type: 'output', content: 'kali' }]);
        break;

      case 'pwd':
        setHistory(prev => [...prev, { type: 'output', content: '/home/kali' }]);
        break;

      case 'ls':
        setHistory(prev => [...prev, { 
          type: 'output', 
          content: `Desktop  Documents  Downloads  Music  Pictures  Public  Templates  Videos  wordlists  tools` 
        }]);
        break;

      case 'date':
        setHistory(prev => [...prev, { type: 'output', content: new Date().toString() }]);
        break;

      case 'hostname':
        setHistory(prev => [...prev, { type: 'output', content: 'cybersec-kali' }]);
        break;

      case 'uname':
        if (args[0] === '-a') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: 'Linux cybersec-kali 6.1.0-kali5-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.12-1kali2 x86_64 GNU/Linux'
          }]);
        } else {
          setHistory(prev => [...prev, { type: 'output', content: 'Linux' }]);
        }
        break;

      case 'nmap':
        if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `Nmap 7.94 ( https://nmap.org )
Usage: nmap [Scan Type(s)] [Options] {target specification}

TARGET SPECIFICATION:
  Can pass hostnames, IP addresses, networks, etc.
  Ex: scanme.nmap.org, microsoft.com/24, 192.168.0.1; 10.0.0-255.1-254

SCAN TECHNIQUES:
  -sS/sT/sA/sW/sM: TCP SYN/Connect()/ACK/Window/Maimon scans
  -sU: UDP Scan
  -sN/sF/sX: TCP Null, FIN, and Xmas scans

PORT SPECIFICATION AND SCAN ORDER:
  -p <port ranges>: Only scan specified ports
  --top-ports <number>: Scan <number> most common ports

SERVICE/VERSION DETECTION:
  -sV: Probe open ports to determine service/version info
  -sC: Run default scripts

OS DETECTION:
  -O: Enable OS detection
  -A: Enable OS detection, version detection, script scanning, and traceroute

Type 'nmap <target>' in dashboard to run a scan with GUI parameters.`
          }]);
        } else {
          // Simulate nmap scan
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for ${args[args.length - 1]}
Host is up (0.00042s latency).

PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3306/tcp open  mysql

Nmap done: 1 IP address (1 host up) scanned in 0.05 seconds`
          }]);
        }
        break;

      case 'sqlmap':
        if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `sqlmap/1.7 - automatic SQL injection and database takeover tool

Usage: sqlmap [options]

Options:
  -h, --help            Show basic help message and exit
  -u URL, --url=URL     Target URL (e.g. "http://www.site.com/vuln.php?id=1")
  -r REQUESTFILE        Load HTTP request from a file

  Enumeration:
    --dbs               Enumerate databases
    --tables            Enumerate database tables
    --columns           Enumerate database table columns
    --dump              Dump database table entries

Type 'sqlmap <target>' in dashboard to run with GUI parameters.`
          }]);
        } else {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `[*] starting @ ${new Date().toLocaleTimeString()}
[*] testing connection to the target URL
[*] testing if the target URL content is stable
[*] testing if GET parameter 'id' is dynamic
[*] heuristic (basic) test shows that GET parameter 'id' might be injectable
[*] testing for SQL injection on GET parameter 'id'
[+] GET parameter 'id' is vulnerable. Do you want to keep testing? [y/N]`
          }]);
        }
        break;

      case 'nikto':
        if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `Nikto v2.5.0
---------------------------------------------------------------------------
   Options:
       -host+     Target host
       -port+     Port (default 80)
       -ssl       Force ssl mode on port
       -Tuning+   Scan tuning
       -output+   Write output to this file
       -Format+   Save file format

Type 'nikto -h <target>' in dashboard to run with GUI parameters.`
          }]);
        } else {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          ${args[args.length - 1]}
+ Target Port:        80
+ Start Time:         ${new Date().toLocaleString()}
---------------------------------------------------------------------------
+ Server: Apache/2.4.52 (Ubuntu)
+ /: The anti-clickjacking X-Frame-Options header is not present.
+ /: Uncommon header 'x-content-type-options' found.
+ No CGI Directories found.
+ /admin/: Admin directory found.
---------------------------------------------------------------------------
+ 1 host(s) tested`
          }]);
        }
        break;

      case 'hydra':
        if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `Hydra v9.4 (c) 2022 by van Hauser/THC & David Maciejak

Syntax: hydra [[[-l LOGIN|-L FILE] [-p PASS|-P FILE]] | [-C FILE]] [-t TASKS]
              [server service [OPTIONS]]

Options:
  -l LOGIN or -L FILE  login with LOGIN name, or load from FILE
  -p PASS or -P FILE   try password PASS, or load from FILE
  -t TASKS             run TASKS number of connects in parallel per target
  -f / -F              exit when a login/pass pair is found

Supported services: ssh ftp http-get http-post mysql mssql postgres rdp vnc

Type 'hydra' in dashboard to run with GUI parameters.`
          }]);
        }
        break;

      case 'gobuster':
        if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
          setHistory(prev => [...prev, { 
            type: 'output', 
            content: `Gobuster v3.5
===============================================================
Usage:
  gobuster [command]

Available Commands:
  dir         Uses directory/file enumeration mode
  dns         Uses DNS subdomain enumeration mode
  fuzz        Uses fuzzing mode
  s3          Uses AWS bucket enumeration mode
  vhost       Uses VHOST enumeration mode

Flags:
  -u, --url string     Target URL
  -w, --wordlist string Path to wordlist
  -t, --threads int    Number of concurrent threads (default 10)

Type 'gobuster' in dashboard to run with GUI parameters.`
          }]);
        }
        break;

      case 'exit':
        setHistory(prev => [...prev, { type: 'output', content: 'Logout.' }]);
        setIsConnected(false);
        break;

      default:
        // Try to execute as system command
        setHistory(prev => [...prev, { 
          type: 'error', 
          content: `bash: ${cmd}: command not found or not available in web terminal.
Use the Dashboard to run security tools with full GUI interface.` 
        }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(currentInput);
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

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Terminal"
        subtitle="Kali Linux web terminal"
      />

      <div className="p-6">
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
              <span className="text-gray-400 text-sm ml-3">kali@cybersec: ~</span>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-green-400 text-xs">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-400 text-xs">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                  Disconnected
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
            className="h-[calc(100vh-280px)] overflow-auto p-4 font-mono text-sm cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {/* History */}
            {history.map((line, idx) => (
              <div 
                key={idx} 
                className={`whitespace-pre-wrap ${
                  line.type === 'input' ? 'text-green-400' :
                  line.type === 'error' ? 'text-red-400' :
                  'text-gray-300'
                }`}
              >
                {line.content}
              </div>
            ))}

            {/* Current Input */}
            {isConnected && (
              <div className="flex items-start mt-1">
                <span className="text-green-400 whitespace-pre">┌──(kali㉿cybersec)-[~]
└─$ </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-gray-100 font-mono"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-400 mr-2">Quick Commands:</span>
          {['nmap -h', 'sqlmap -h', 'nikto -h', 'hydra -h', 'gobuster -h', 'help', 'clear'].map(cmd => (
            <button
              key={cmd}
              onClick={() => handleCommand(cmd)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-mono transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Tips */}
        <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Terminal Tips
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Use <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">↑</kbd> and <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">↓</kbd> to navigate command history</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+L</kbd> to clear the terminal</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+C</kbd> to cancel current input</li>
            <li>• For full tool functionality with parameters, use the <strong>Tools</strong> section in the dashboard</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TerminalPage;
