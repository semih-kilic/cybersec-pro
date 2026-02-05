import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

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
  slug: string;
  description: string;
  category: string;
  plan_required: string;
  is_active: boolean;
  parameters: ToolParameter[];
  documentation?: string;
  examples?: { name: string; command: string; description: string }[];
}

// Comprehensive Kali tool parameters - real CLI parameters
const toolParameters: { [key: string]: ToolParameter[] } = {
  'nmap': [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'scanme.nmap.org or your-domain.com', description: 'Target IP address, hostname, or CIDR range' },
    { name: 'Scan Type', flag: '-s', type: 'select', required: false, options: ['S (SYN)', 'T (Connect)', 'U (UDP)', 'A (ACK)', 'N (NULL)', 'F (FIN)', 'X (Xmas)'], description: 'Type of scan to perform', group: 'Scan Techniques' },
    { name: 'Port Range', flag: '-p', type: 'text', required: false, placeholder: '1-65535 or 22,80,443', description: 'Specific ports to scan', group: 'Port Options' },
    { name: 'Top Ports', flag: '--top-ports', type: 'number', required: false, placeholder: '1000', description: 'Scan most common ports', group: 'Port Options' },
    { name: 'OS Detection', flag: '-O', type: 'boolean', required: false, description: 'Enable OS detection', group: 'Detection' },
    { name: 'Service Version', flag: '-sV', type: 'boolean', required: false, description: 'Probe open ports to determine service/version info', group: 'Detection' },
    { name: 'Script Scan', flag: '-sC', type: 'boolean', required: false, description: 'Run default scripts', group: 'Scripts' },
    { name: 'Scripts', flag: '--script', type: 'text', required: false, placeholder: 'vuln,exploit', description: 'NSE scripts to run', group: 'Scripts' },
    { name: 'Aggressive', flag: '-A', type: 'boolean', required: false, description: 'Enable OS detection, version detection, script scanning, and traceroute', group: 'Detection' },
    { name: 'Timing', flag: '-T', type: 'select', required: false, options: ['0 (Paranoid)', '1 (Sneaky)', '2 (Polite)', '3 (Normal)', '4 (Aggressive)', '5 (Insane)'], description: 'Timing template', group: 'Performance' },
    { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Increase verbosity level', group: 'Output' },
    { name: 'No DNS', flag: '-n', type: 'boolean', required: false, description: 'Never do DNS resolution', group: 'Performance' },
    { name: 'Ping Scan Only', flag: '-sn', type: 'boolean', required: false, description: 'Disable port scan, only do host discovery', group: 'Scan Techniques' },
    { name: 'Output Format', flag: '-o', type: 'select', required: false, options: ['N (Normal)', 'X (XML)', 'G (Grepable)', 'A (All)'], description: 'Output format', group: 'Output' },
  ],
  'sqlmap': [
    { name: 'Target URL', flag: '-u', type: 'text', required: true, placeholder: 'http://example.com/page.php?id=1', description: 'Target URL with parameter to test' },
    { name: 'Request File', flag: '-r', type: 'file', required: false, description: 'Load HTTP request from file', group: 'Target' },
    { name: 'Parameter', flag: '-p', type: 'text', required: false, placeholder: 'id', description: 'Testable parameter(s)', group: 'Target' },
    { name: 'Database', flag: '--dbs', type: 'boolean', required: false, description: 'Enumerate databases', group: 'Enumeration' },
    { name: 'Tables', flag: '--tables', type: 'boolean', required: false, description: 'Enumerate tables', group: 'Enumeration' },
    { name: 'Columns', flag: '--columns', type: 'boolean', required: false, description: 'Enumerate columns', group: 'Enumeration' },
    { name: 'Dump', flag: '--dump', type: 'boolean', required: false, description: 'Dump database table entries', group: 'Enumeration' },
    { name: 'Dump All', flag: '--dump-all', type: 'boolean', required: false, description: 'Dump all databases', group: 'Enumeration' },
    { name: 'Database Name', flag: '-D', type: 'text', required: false, placeholder: 'database_name', description: 'Specific database to enumerate', group: 'Enumeration' },
    { name: 'Table Name', flag: '-T', type: 'text', required: false, placeholder: 'users', description: 'Specific table to enumerate', group: 'Enumeration' },
    { name: 'Level', flag: '--level', type: 'select', required: false, options: ['1', '2', '3', '4', '5'], description: 'Level of tests (1-5)', group: 'Injection' },
    { name: 'Risk', flag: '--risk', type: 'select', required: false, options: ['1', '2', '3'], description: 'Risk of tests (1-3)', group: 'Injection' },
    { name: 'Technique', flag: '--technique', type: 'select', required: false, options: ['B (Boolean)', 'E (Error)', 'U (Union)', 'S (Stacked)', 'T (Time)', 'Q (Inline)'], description: 'SQL injection techniques to use', group: 'Injection' },
    { name: 'Threads', flag: '--threads', type: 'number', required: false, placeholder: '10', description: 'Number of concurrent threads', group: 'Performance' },
    { name: 'Batch', flag: '--batch', type: 'boolean', required: false, description: 'Never ask for user input', group: 'General' },
    { name: 'Random Agent', flag: '--random-agent', type: 'boolean', required: false, description: 'Use random User-Agent', group: 'Request' },
    { name: 'Cookie', flag: '--cookie', type: 'text', required: false, placeholder: 'session=abc123', description: 'HTTP Cookie header value', group: 'Request' },
    { name: 'OS Shell', flag: '--os-shell', type: 'boolean', required: false, description: 'Prompt for an interactive OS shell', group: 'Takeover' },
    { name: 'SQL Shell', flag: '--sql-shell', type: 'boolean', required: false, description: 'Prompt for an interactive SQL shell', group: 'Takeover' },
  ],
  'nikto': [
    { name: 'Target Host', flag: '-h', type: 'text', required: true, placeholder: 'example.com or 192.168.1.1', description: 'Target host' },
    { name: 'Port', flag: '-p', type: 'number', required: false, placeholder: '80', description: 'Port to use (default 80)', group: 'Target' },
    { name: 'SSL', flag: '-ssl', type: 'boolean', required: false, description: 'Force SSL mode', group: 'Target' },
    { name: 'Tuning', flag: '-Tuning', type: 'text', required: false, placeholder: '123', description: 'Scan tuning options (1-9,a-c)', group: 'Scan' },
    { name: 'Plugins', flag: '-Plugins', type: 'text', required: false, placeholder: 'apacheusers', description: 'Plugins to run', group: 'Scan' },
    { name: 'Output File', flag: '-o', type: 'text', required: false, placeholder: 'output.txt', description: 'Output file name', group: 'Output' },
    { name: 'Format', flag: '-Format', type: 'select', required: false, options: ['txt', 'csv', 'htm', 'xml', 'json'], description: 'Output format', group: 'Output' },
    { name: 'Timeout', flag: '-timeout', type: 'number', required: false, placeholder: '10', description: 'Timeout for requests', group: 'Performance' },
    { name: 'No 404', flag: '-no404', type: 'boolean', required: false, description: 'Disable 404 guessing', group: 'Scan' },
    { name: 'User Agent', flag: '-useragent', type: 'text', required: false, placeholder: 'Mozilla/5.0...', description: 'Custom User-Agent string', group: 'Request' },
  ],
  'hydra': [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.1 or example.com', description: 'Target host' },
    { name: 'Service', flag: '', type: 'select', required: true, options: ['ssh', 'ftp', 'http-post-form', 'http-get', 'mysql', 'postgres', 'rdp', 'smb', 'vnc', 'telnet', 'pop3', 'imap', 'smtp'], description: 'Service to attack' },
    { name: 'Username', flag: '-l', type: 'text', required: false, placeholder: 'admin', description: 'Single username', group: 'Credentials' },
    { name: 'Username List', flag: '-L', type: 'file', required: false, description: 'Username wordlist file', group: 'Credentials' },
    { name: 'Password', flag: '-p', type: 'text', required: false, placeholder: 'password123', description: 'Single password', group: 'Credentials' },
    { name: 'Password List', flag: '-P', type: 'file', required: false, description: 'Password wordlist file', group: 'Credentials' },
    { name: 'Port', flag: '-s', type: 'number', required: false, placeholder: '22', description: 'Custom port', group: 'Target' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '16', description: 'Number of parallel tasks', group: 'Performance' },
    { name: 'Verbose', flag: '-V', type: 'boolean', required: false, description: 'Verbose mode', group: 'Output' },
    { name: 'Exit on First', flag: '-f', type: 'boolean', required: false, description: 'Exit after first found', group: 'General' },
    { name: 'Try Login as Pass', flag: '-e', type: 'select', required: false, options: ['n (null)', 's (same)', 'r (reverse)', 'ns', 'nsr'], description: 'Additional checks', group: 'Credentials' },
  ],
  'john': [
    { name: 'Hash File', flag: '', type: 'file', required: true, description: 'File containing password hashes' },
    { name: 'Wordlist', flag: '--wordlist', type: 'file', required: false, description: 'Wordlist file for dictionary attack', group: 'Attack Mode' },
    { name: 'Format', flag: '--format', type: 'select', required: false, options: ['raw-md5', 'raw-sha1', 'raw-sha256', 'raw-sha512', 'bcrypt', 'md5crypt', 'sha256crypt', 'sha512crypt', 'nt', 'lm', 'mysql-sha1'], description: 'Hash format', group: 'Format' },
    { name: 'Incremental', flag: '--incremental', type: 'boolean', required: false, description: 'Incremental (brute force) mode', group: 'Attack Mode' },
    { name: 'Single', flag: '--single', type: 'boolean', required: false, description: 'Single crack mode', group: 'Attack Mode' },
    { name: 'Rules', flag: '--rules', type: 'text', required: false, placeholder: 'best64', description: 'Word mangling rules', group: 'Attack Mode' },
    { name: 'Show', flag: '--show', type: 'boolean', required: false, description: 'Show cracked passwords', group: 'Output' },
    { name: 'Pot File', flag: '--pot', type: 'text', required: false, placeholder: 'custom.pot', description: 'Custom pot file', group: 'Output' },
  ],
  'gobuster': [
    { name: 'Mode', flag: '', type: 'select', required: true, options: ['dir', 'dns', 'vhost', 'fuzz', 's3'], description: 'Enumeration mode' },
    { name: 'Target URL', flag: '-u', type: 'text', required: true, placeholder: 'http://example.com', description: 'Target URL' },
    { name: 'Wordlist', flag: '-w', type: 'file', required: true, description: 'Path to wordlist' },
    { name: 'Extensions', flag: '-x', type: 'text', required: false, placeholder: 'php,html,txt', description: 'File extensions to search for', group: 'Discovery' },
    { name: 'Status Codes', flag: '-s', type: 'text', required: false, placeholder: '200,204,301,302', description: 'Positive status codes', group: 'Filtering' },
    { name: 'Status Codes Blacklist', flag: '-b', type: 'text', required: false, placeholder: '404,500', description: 'Negative status codes', group: 'Filtering' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '50', description: 'Number of concurrent threads', group: 'Performance' },
    { name: 'No TLS Verify', flag: '-k', type: 'boolean', required: false, description: 'Skip TLS certificate verification', group: 'Request' },
    { name: 'Follow Redirect', flag: '-r', type: 'boolean', required: false, description: 'Follow redirects', group: 'Request' },
    { name: 'User Agent', flag: '-a', type: 'text', required: false, placeholder: 'Mozilla/5.0...', description: 'User-Agent string', group: 'Request' },
    { name: 'Cookie', flag: '-c', type: 'text', required: false, placeholder: 'session=abc', description: 'Cookies to use', group: 'Request' },
    { name: 'Output', flag: '-o', type: 'text', required: false, placeholder: 'results.txt', description: 'Output file', group: 'Output' },
    { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Output' },
  ],
  'dirb': [
    { name: 'Target URL', flag: '', type: 'text', required: true, placeholder: 'http://example.com/', description: 'Target URL' },
    { name: 'Wordlist', flag: '', type: 'file', required: false, description: 'Custom wordlist (default: /usr/share/dirb/wordlists/common.txt)' },
    { name: 'Agent', flag: '-a', type: 'text', required: false, placeholder: 'Mozilla/5.0', description: 'Custom User-Agent', group: 'Request' },
    { name: 'Cookie', flag: '-c', type: 'text', required: false, placeholder: 'session=abc', description: 'Cookie string', group: 'Request' },
    { name: 'Extensions', flag: '-X', type: 'text', required: false, placeholder: '.php,.html', description: 'File extensions to try', group: 'Discovery' },
    { name: 'Output', flag: '-o', type: 'text', required: false, placeholder: 'output.txt', description: 'Output file', group: 'Output' },
    { name: 'Not Recursive', flag: '-r', type: 'boolean', required: false, description: 'Non recursive', group: 'Discovery' },
    { name: 'Silent', flag: '-S', type: 'boolean', required: false, description: 'Silent mode', group: 'Output' },
  ],
  'wpscan': [
    { name: 'Target URL', flag: '--url', type: 'text', required: true, placeholder: 'http://wordpress-site.com', description: 'WordPress site URL' },
    { name: 'Enumerate', flag: '-e', type: 'select', required: false, options: ['vp (Vulnerable Plugins)', 'ap (All Plugins)', 'p (Popular Plugins)', 'vt (Vulnerable Themes)', 'at (All Themes)', 't (Popular Themes)', 'u (Users)', 'cb (Config Backups)'], description: 'Enumeration process', group: 'Enumeration' },
    { name: 'API Token', flag: '--api-token', type: 'text', required: false, placeholder: 'YOUR_API_TOKEN', description: 'WPScan API token', group: 'API' },
    { name: 'Passwords', flag: '-P', type: 'file', required: false, description: 'Password list for brute force', group: 'Brute Force' },
    { name: 'Usernames', flag: '-U', type: 'text', required: false, placeholder: 'admin,user1', description: 'Usernames for brute force', group: 'Brute Force' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '20', description: 'Number of threads', group: 'Performance' },
    { name: 'Stealthy', flag: '--stealthy', type: 'boolean', required: false, description: 'Stealthy scan', group: 'Stealth' },
    { name: 'Disable TLS', flag: '--disable-tls-checks', type: 'boolean', required: false, description: 'Disable TLS verification', group: 'Request' },
    { name: 'Output', flag: '-o', type: 'text', required: false, placeholder: 'results.json', description: 'Output file', group: 'Output' },
    { name: 'Format', flag: '-f', type: 'select', required: false, options: ['cli', 'cli-no-colour', 'json'], description: 'Output format', group: 'Output' },
  ],
  'metasploit': [
    { name: 'Module', flag: 'use', type: 'text', required: true, placeholder: 'exploit/windows/smb/ms17_010_eternalblue', description: 'Metasploit module to use' },
    { name: 'RHOSTS', flag: 'RHOSTS', type: 'text', required: true, placeholder: '192.168.1.1', description: 'Target host(s)', group: 'Target' },
    { name: 'RPORT', flag: 'RPORT', type: 'number', required: false, placeholder: '445', description: 'Target port', group: 'Target' },
    { name: 'LHOST', flag: 'LHOST', type: 'text', required: false, placeholder: '192.168.1.100', description: 'Local host for reverse connection', group: 'Payload' },
    { name: 'LPORT', flag: 'LPORT', type: 'number', required: false, placeholder: '4444', description: 'Local port for reverse connection', group: 'Payload' },
    { name: 'Payload', flag: 'payload', type: 'text', required: false, placeholder: 'windows/x64/meterpreter/reverse_tcp', description: 'Payload to use', group: 'Payload' },
    { name: 'Threads', flag: 'THREADS', type: 'number', required: false, placeholder: '10', description: 'Number of concurrent threads', group: 'Performance' },
  ],
  'burpsuite': [
    { name: 'Target URL', flag: '', type: 'text', required: true, placeholder: 'http://example.com', description: 'Target URL to proxy' },
    { name: 'Proxy Port', flag: '-port', type: 'number', required: false, placeholder: '8080', description: 'Proxy listener port', group: 'Proxy' },
    { name: 'Project File', flag: '-project-file', type: 'text', required: false, placeholder: 'project.burp', description: 'Project file to load', group: 'Project' },
  ],
};

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { token: _token } = useAuth();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [paramValues, setParamValues] = useState<{ [key: string]: string | boolean }>({});
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [activeTab, setActiveTab] = useState<'params' | 'docs' | 'examples'>('params');

  useEffect(() => {
    fetchTool();
  }, [toolId]);

  useEffect(() => {
    if (tool) {
      generateCommand();
    }
  }, [paramValues, tool]);

  const fetchTool = async () => {
    try {
      // Fetch tool configuration from API
      const res = await fetch(`/api/v1/tools/${toolId}/config`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setTool(data.tool);
      } else {
        // Fallback: use local parameters if API unavailable
        const fallbackTool: Tool = {
          id: toolId || '',
          name: toolId?.toUpperCase() || '',
          slug: toolId || '',
          description: `${toolId} security tool for penetration testing`,
          category: 'Security Tools',
          plan_required: 'starter',
          is_active: true,
          parameters: toolParameters[toolId || ''] || [],
          documentation: `# ${toolId?.toUpperCase()}\n\nUse the parameters below to configure your scan.`,
          examples: []
        };
        setTool(fallbackTool);
      }
    } catch (error) {
      console.error('Failed to fetch tool:', error);
      // Fallback to local parameters
      const fallbackTool: Tool = {
        id: toolId || '',
        name: toolId?.toUpperCase() || '',
        slug: toolId || '',
        description: `${toolId} security tool`,
        category: 'Security Tools',
        plan_required: 'starter',
        is_active: true,
        parameters: toolParameters[toolId || ''] || [],
        documentation: '',
        examples: []
      };
      setTool(fallbackTool);
    } finally {
      setLoading(false);
    }
  };

  const generateCommand = () => {
    if (!tool) return;
    
    let cmd = tool.slug;
    const params = tool.parameters || [];
    
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

  const handleRunScan = () => {
    // Find the target value from parameters (first required parameter)
    const params = tool?.parameters || [];
    const targetParam = params.find(p => p.required && (p.name.toLowerCase().includes('target') || p.name.toLowerCase().includes('host') || p.name.toLowerCase().includes('url'))) || params.find(p => p.required);
    const targetValue = targetParam ? (paramValues[targetParam.name] as string) || '' : '';
    
    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('tool', toolId || '');
    if (targetValue) {
      queryParams.set('target', targetValue);
    }
    if (generatedCommand) {
      queryParams.set('command', generatedCommand);
    }
    
    // Pass all parameters as JSON
    const allParams = { ...paramValues };
    queryParams.set('params', JSON.stringify(allParams));
    
    // Navigate to scan execution page with parameters
    navigate(`/dashboard/tools/${toolId}/run?${queryParams.toString()}`);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(generatedCommand);
    // Show toast
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
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

  // Group parameters
  const groupedParams = tool.parameters?.reduce((acc, param) => {
    const group = param.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(param);
    return acc;
  }, {} as { [key: string]: ToolParameter[] }) || {};

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title={tool.name}
        subtitle={tool.description}
        breadcrumb={[
          { label: 'Tools', href: '/dashboard/tools' },
          { label: tool.name }
        ]}
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
                  {generatedCommand || `${tool.slug}`}
                </code>
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
  );
}

export default ToolDetailPage;
