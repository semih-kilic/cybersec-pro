/**
 * Comprehensive Kali Linux Tool Configurations
 * Smart Defaults + One-Click Scan Support
 * 
 * Each tool has:
 * - parameters: CLI parameter definitions
 * - smartDefaults: Pre-configured defaults for Quick/Standard/Deep modes
 * - examples: Real-world usage examples
 * - documentation: Links and info
 */

export interface ToolParameter {
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

export interface ScanMode {
  name: 'quick' | 'standard' | 'deep';
  label: string;
  description: string;
  params: Record<string, string | number | boolean>;
  estimatedTime: string; // e.g., "30s", "2m", "10m"
}

export interface ToolConfig {
  name: string;
  category: string;
  description: string;
  parameters: ToolParameter[];
  scanModes: ScanMode[];
  examples: { name: string; command: string; description: string }[];
  documentation: string;
  docLink?: string;
}

// ============================================================================
// NETWORK SCANNING TOOLS
// ============================================================================

const nmapConfig: ToolConfig = {
  name: 'nmap',
  category: 'Network Scanning',
  description: 'Network discovery and security auditing',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'scanme.nmap.org', description: 'Target IP, hostname, or CIDR', group: 'Target' },
    { name: 'Scan Type', flag: '-s', type: 'select', required: false, options: ['S (SYN)', 'T (Connect)', 'U (UDP)', 'A (ACK)', 'N (NULL)'], description: 'Type of scan', group: 'Scan Techniques' },
    { name: 'Port Range', flag: '-p', type: 'text', required: false, placeholder: '1-65535 or 22,80,443', description: 'Ports to scan', group: 'Port Options' },
    { name: 'Top Ports', flag: '--top-ports', type: 'number', required: false, placeholder: '1000', description: 'Scan most common ports', group: 'Port Options' },
    { name: 'OS Detection', flag: '-O', type: 'boolean', required: false, description: 'Enable OS detection', group: 'Detection' },
    { name: 'Service Version', flag: '-sV', type: 'boolean', required: false, description: 'Probe for service versions', group: 'Detection' },
    { name: 'Script Scan', flag: '-sC', type: 'boolean', required: false, description: 'Run default NSE scripts', group: 'Scripts' },
    { name: 'Aggressive', flag: '-A', type: 'boolean', required: false, description: 'OS + Version + Scripts + Traceroute', group: 'Detection' },
    { name: 'Timing', flag: '-T', type: 'select', required: false, options: ['0 (Paranoid)', '1 (Sneaky)', '2 (Polite)', '3 (Normal)', '4 (Aggressive)', '5 (Insane)'], description: 'Timing template', group: 'Performance' },
    { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Increase verbosity', group: 'Output' },
    { name: 'No DNS', flag: '-n', type: 'boolean', required: false, description: 'Never do DNS resolution', group: 'Performance' },
  ],
  scanModes: [
    {
      name: 'quick',
      label: 'Quick Scan',
      description: 'Fast port scan with top 100 ports',
      params: { 'Timing': '4', 'Top Ports': 100, 'Verbose': true },
      estimatedTime: '30s'
    },
    {
      name: 'standard',
      label: 'Standard Scan',
      description: 'Balanced scan with service detection',
      params: { 'Timing': '3', 'Top Ports': 1000, 'Service Version': true, 'Verbose': true },
      estimatedTime: '2m'
    },
    {
      name: 'deep',
      label: 'Deep Scan',
      description: 'Comprehensive scan with all ports and scripts',
      params: { 'Timing': '2', 'Port Range': '1-65535', 'OS Detection': true, 'Service Version': true, 'Script Scan': true, 'Verbose': true },
      estimatedTime: '15m'
    }
  ],
  examples: [
    { name: 'Quick SYN Scan', command: 'nmap -sS -T4 --top-ports 100 target.com', description: 'Fast stealth scan of common ports' },
    { name: 'Full Port Scan', command: 'nmap -sS -p- -T4 target.com', description: 'Scan all 65535 ports' },
    { name: 'Service Detection', command: 'nmap -sV -sC target.com', description: 'Detect services and run scripts' },
    { name: 'Vulnerability Scan', command: 'nmap --script vuln target.com', description: 'Run vulnerability scripts' }
  ],
  documentation: `# Nmap - Network Mapper
  
The most powerful network scanning tool. Use for:
- Port scanning and discovery
- Service/version detection
- OS fingerprinting
- Vulnerability scanning with NSE scripts

**Legal Notice:** Only scan systems you have permission to test.`,
  docLink: 'https://nmap.org/book/man.html'
};

const masscanConfig: ToolConfig = {
  name: 'masscan',
  category: 'Network Scanning',
  description: 'Mass IP port scanner - fastest scanner on the planet',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: '10.0.0.0/8 or 192.168.1.0/24', description: 'Target IP range (CIDR)', group: 'Target' },
    { name: 'Ports', flag: '-p', type: 'text', required: true, placeholder: '0-65535 or 80,443', description: 'Ports to scan', group: 'Ports' },
    { name: 'Rate', flag: '--rate', type: 'number', required: false, placeholder: '10000', description: 'Packets per second', group: 'Performance' },
    { name: 'Banners', flag: '--banners', type: 'boolean', required: false, description: 'Capture banners', group: 'Output' },
    { name: 'Output File', flag: '-oL', type: 'text', required: false, placeholder: 'results.txt', description: 'Output to list file', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Fast scan of common ports', params: { 'Ports': '21,22,23,25,80,443,3389,8080', 'Rate': 10000 }, estimatedTime: '10s' },
    { name: 'standard', label: 'Standard Scan', description: 'Top 1000 ports', params: { 'Ports': '0-1023', 'Rate': 5000, 'Banners': true }, estimatedTime: '30s' },
    { name: 'deep', label: 'Deep Scan', description: 'Full port range', params: { 'Ports': '0-65535', 'Rate': 1000, 'Banners': true }, estimatedTime: '5m' }
  ],
  examples: [
    { name: 'Full Internet Scan', command: 'masscan 0.0.0.0/0 -p80,443 --rate=10000', description: 'Scan entire internet for web servers' },
    { name: 'Banner Grab', command: 'masscan 10.0.0.0/8 -p22,80 --banners', description: 'Grab banners from services' }
  ],
  documentation: '# Masscan\n\nThe fastest port scanner. Can scan entire internet in under 6 minutes.',
  docLink: 'https://github.com/robertdavidgraham/masscan'
};

// ============================================================================
// WEB SCANNING TOOLS
// ============================================================================

const niktoConfig: ToolConfig = {
  name: 'nikto',
  category: 'Web Scanning',
  description: 'Web server vulnerability scanner',
  parameters: [
    { name: 'Target Host', flag: '-h', type: 'text', required: true, placeholder: 'example.com', description: 'Target host', group: 'Target' },
    { name: 'Port', flag: '-p', type: 'number', required: false, placeholder: '80', description: 'Port to scan', group: 'Target' },
    { name: 'SSL', flag: '-ssl', type: 'boolean', required: false, description: 'Force SSL mode', group: 'Target' },
    { name: 'Tuning', flag: '-Tuning', type: 'select', required: false, options: ['1 (Interesting)', '2 (Misconfig)', '3 (Info Disclosure)', '4 (XSS)', '5 (SQLi)', '6 (File Upload)', '7 (Remote Source)', '8 (Command Exec)', '9 (SQLi)', 'x (Reverse)'], description: 'Scan tuning', group: 'Scan' },
    { name: 'Timeout', flag: '-timeout', type: 'number', required: false, placeholder: '10', description: 'Request timeout', group: 'Performance' },
    { name: 'No 404', flag: '-no404', type: 'boolean', required: false, description: 'Disable 404 guessing', group: 'Scan' },
    { name: 'User Agent', flag: '-useragent', type: 'text', required: false, placeholder: 'Mozilla/5.0', description: 'Custom User-Agent', group: 'Request' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Fast web server check', params: { 'Timeout': 5, 'No 404': true }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Scan', description: 'Full vulnerability scan', params: { 'Timeout': 10 }, estimatedTime: '3m' },
    { name: 'deep', label: 'Deep Scan', description: 'Comprehensive with all tuning options', params: { 'Tuning': 'x', 'Timeout': 15 }, estimatedTime: '10m' }
  ],
  examples: [
    { name: 'Basic Scan', command: 'nikto -h example.com', description: 'Standard web server scan' },
    { name: 'SSL Scan', command: 'nikto -h example.com -ssl -p 443', description: 'Scan HTTPS server' },
    { name: 'XSS & SQLi Check', command: 'nikto -h example.com -Tuning 45', description: 'Focus on XSS and SQLi' }
  ],
  documentation: '# Nikto\n\nWeb server scanner that checks for dangerous files, outdated servers, and vulnerabilities.',
  docLink: 'https://github.com/sullo/nikto'
};

const whatwebConfig: ToolConfig = {
  name: 'whatweb',
  category: 'Web Scanning',
  description: 'Web scanner to identify technologies',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'example.com', description: 'Target URL or hostname', group: 'Target' },
    { name: 'Aggression', flag: '-a', type: 'select', required: false, options: ['1 (Stealthy)', '2 (Unused)', '3 (Aggressive)', '4 (Heavy)'], default: '1', description: 'Aggression level', group: 'General' },
    { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Output' },
    { name: 'Color', flag: '--color', type: 'select', required: false, options: ['always', 'never', 'auto'], description: 'Color output', group: 'Output' },
    { name: 'Quiet', flag: '-q', type: 'boolean', required: false, description: 'Quiet mode', group: 'Output' },
    { name: 'User Agent', flag: '-U', type: 'text', required: false, placeholder: 'Mozilla/5.0...', description: 'Custom User-Agent', group: 'Request' },
    { name: 'Proxy', flag: '--proxy', type: 'text', required: false, placeholder: 'http://proxy:8080', description: 'Use proxy', group: 'Request' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Stealthy fingerprint', params: { 'Aggression': '1', 'Verbose': true }, estimatedTime: '10s' },
    { name: 'standard', label: 'Standard Scan', description: 'Normal detection', params: { 'Aggression': '3', 'Verbose': true }, estimatedTime: '30s' },
    { name: 'deep', label: 'Deep Scan', description: 'Heavy/aggressive detection', params: { 'Aggression': '4', 'Verbose': true }, estimatedTime: '2m' }
  ],
  examples: [
    { name: 'Basic Fingerprint', command: 'whatweb example.com', description: 'Quick technology detection' },
    { name: 'Aggressive Scan', command: 'whatweb -a 3 -v example.com', description: 'Detailed aggressive scan' },
    { name: 'Multiple Targets', command: 'whatweb -i targets.txt', description: 'Scan list of targets' }
  ],
  documentation: '# WhatWeb\n\nIdentifies websites. Recognizes CMS, web frameworks, web servers, JavaScript libraries, and more.',
  docLink: 'https://github.com/urbanadventurer/WhatWeb'
};

const gobusterConfig: ToolConfig = {
  name: 'gobuster',
  category: 'Web Scanning',
  description: 'Directory/file & DNS busting tool',
  parameters: [
    { name: 'Mode', flag: '', type: 'select', required: true, options: ['dir', 'dns', 'vhost', 'fuzz', 's3'], description: 'Enumeration mode', group: 'General' },
    { name: 'Target URL', flag: '-u', type: 'text', required: true, placeholder: 'http://example.com', description: 'Target URL', group: 'Target' },
    { name: 'Wordlist', flag: '-w', type: 'select', required: true, options: ['/usr/share/wordlists/dirb/common.txt', '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt', '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt'], description: 'Wordlist file', group: 'General' },
    { name: 'Extensions', flag: '-x', type: 'text', required: false, placeholder: 'php,html,txt,js', description: 'File extensions', group: 'Discovery' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '50', description: 'Concurrent threads', group: 'Performance' },
    { name: 'Status Codes', flag: '-s', type: 'text', required: false, placeholder: '200,204,301,302,307', description: 'Positive status codes', group: 'Filtering' },
    { name: 'No TLS Verify', flag: '-k', type: 'boolean', required: false, description: 'Skip TLS verification', group: 'Request' },
    { name: 'Follow Redirect', flag: '-r', type: 'boolean', required: false, description: 'Follow redirects', group: 'Request' },
    { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Fast with common wordlist', params: { 'Wordlist': '/usr/share/wordlists/dirb/common.txt', 'Threads': 50 }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Scan', description: 'Medium wordlist with extensions', params: { 'Wordlist': '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt', 'Threads': 30, 'Extensions': 'php,html,txt' }, estimatedTime: '5m' },
    { name: 'deep', label: 'Deep Scan', description: 'Large wordlist comprehensive', params: { 'Wordlist': '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt', 'Threads': 20, 'Extensions': 'php,html,txt,js,json,xml,asp,aspx', 'Follow Redirect': true }, estimatedTime: '30m' }
  ],
  examples: [
    { name: 'Directory Brute', command: 'gobuster dir -u http://example.com -w /usr/share/wordlists/dirb/common.txt', description: 'Find hidden directories' },
    { name: 'With Extensions', command: 'gobuster dir -u http://example.com -w wordlist.txt -x php,html', description: 'Search with file extensions' },
    { name: 'DNS Subdomain', command: 'gobuster dns -d example.com -w subdomains.txt', description: 'Enumerate subdomains' }
  ],
  documentation: '# Gobuster\n\nDirectory/file & DNS busting tool. Fast alternative to dirb/dirbuster.',
  docLink: 'https://github.com/OJ/gobuster'
};

const dirbConfig: ToolConfig = {
  name: 'dirb',
  category: 'Web Scanning',
  description: 'Web content scanner',
  parameters: [
    { name: 'Target URL', flag: '', type: 'text', required: true, placeholder: 'http://example.com/', description: 'Target URL', group: 'Target' },
    { name: 'Wordlist', flag: '', type: 'select', required: false, options: ['/usr/share/dirb/wordlists/common.txt', '/usr/share/dirb/wordlists/big.txt', '/usr/share/dirb/wordlists/small.txt'], description: 'Wordlist file', group: 'General' },
    { name: 'User Agent', flag: '-a', type: 'text', required: false, placeholder: 'Mozilla/5.0', description: 'Custom User-Agent', group: 'Request' },
    { name: 'Cookie', flag: '-c', type: 'text', required: false, placeholder: 'session=abc', description: 'Cookie string', group: 'Request' },
    { name: 'Extensions', flag: '-X', type: 'text', required: false, placeholder: '.php,.html', description: 'File extensions', group: 'Discovery' },
    { name: 'Not Recursive', flag: '-r', type: 'boolean', required: false, description: 'Disable recursion', group: 'Discovery' },
    { name: 'Silent', flag: '-S', type: 'boolean', required: false, description: 'Silent mode', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Small wordlist', params: { 'Wordlist': '/usr/share/dirb/wordlists/small.txt' }, estimatedTime: '20s' },
    { name: 'standard', label: 'Standard Scan', description: 'Common wordlist', params: { 'Wordlist': '/usr/share/dirb/wordlists/common.txt' }, estimatedTime: '2m' },
    { name: 'deep', label: 'Deep Scan', description: 'Big wordlist with extensions', params: { 'Wordlist': '/usr/share/dirb/wordlists/big.txt', 'Extensions': '.php,.html,.txt,.bak' }, estimatedTime: '15m' }
  ],
  examples: [
    { name: 'Basic Scan', command: 'dirb http://example.com', description: 'Standard directory scan' },
    { name: 'With Extensions', command: 'dirb http://example.com -X .php,.html', description: 'Search specific file types' }
  ],
  documentation: '# Dirb\n\nWeb content scanner that uses dictionary-based attacks to find hidden files and directories.',
  docLink: 'https://tools.kali.org/web-applications/dirb'
};

const wpscanConfig: ToolConfig = {
  name: 'wpscan',
  category: 'Web Scanning',
  description: 'WordPress security scanner',
  parameters: [
    { name: 'Target URL', flag: '--url', type: 'text', required: true, placeholder: 'http://wordpress.example.com', description: 'WordPress site URL', group: 'Target' },
    { name: 'Enumerate', flag: '-e', type: 'select', required: false, options: ['vp (Vulnerable Plugins)', 'ap (All Plugins)', 'p (Popular Plugins)', 'vt (Vulnerable Themes)', 'at (All Themes)', 'u (Users)', 'cb (Config Backups)', 'dbe (DB Exports)'], description: 'Enumeration type', group: 'Enumeration' },
    { name: 'API Token', flag: '--api-token', type: 'text', required: false, placeholder: 'YOUR_TOKEN', description: 'WPScan API token', group: 'API' },
    { name: 'Passwords', flag: '-P', type: 'file', required: false, description: 'Password list', group: 'Brute Force' },
    { name: 'Usernames', flag: '-U', type: 'text', required: false, placeholder: 'admin', description: 'Usernames', group: 'Brute Force' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '20', description: 'Threads', group: 'Performance' },
    { name: 'Stealthy', flag: '--stealthy', type: 'boolean', required: false, description: 'Stealthy scan', group: 'Stealth' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Fast enumeration', params: { 'Enumerate': 'vp', 'Threads': 20 }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Scan', description: 'Full enumeration', params: { 'Enumerate': 'vp,vt,u', 'Threads': 10 }, estimatedTime: '2m' },
    { name: 'deep', label: 'Deep Scan', description: 'Complete WordPress audit', params: { 'Enumerate': 'ap,at,u,cb,dbe', 'Threads': 5, 'Stealthy': true }, estimatedTime: '10m' }
  ],
  examples: [
    { name: 'Basic Scan', command: 'wpscan --url http://wordpress.example.com', description: 'Standard WordPress scan' },
    { name: 'Plugin Enum', command: 'wpscan --url http://wordpress.example.com -e vp', description: 'Find vulnerable plugins' },
    { name: 'Brute Force', command: 'wpscan --url http://wordpress.example.com -U admin -P passwords.txt', description: 'Password brute force' }
  ],
  documentation: '# WPScan\n\nWordPress security scanner. Detects vulnerable plugins, themes, and misconfigurations.',
  docLink: 'https://github.com/wpscanteam/wpscan'
};

// ============================================================================
// SQL INJECTION TOOLS
// ============================================================================

const sqlmapConfig: ToolConfig = {
  name: 'sqlmap',
  category: 'SQL Injection',
  description: 'Automatic SQL injection and database takeover',
  parameters: [
    { name: 'Target URL', flag: '-u', type: 'text', required: true, placeholder: 'http://example.com/page.php?id=1', description: 'Target URL with parameter', group: 'Target' },
    { name: 'Parameter', flag: '-p', type: 'text', required: false, placeholder: 'id', description: 'Parameter to test', group: 'Target' },
    { name: 'Request File', flag: '-r', type: 'file', required: false, description: 'Load HTTP request from file', group: 'Target' },
    { name: 'Databases', flag: '--dbs', type: 'boolean', required: false, description: 'Enumerate databases', group: 'Enumeration' },
    { name: 'Tables', flag: '--tables', type: 'boolean', required: false, description: 'Enumerate tables', group: 'Enumeration' },
    { name: 'Dump', flag: '--dump', type: 'boolean', required: false, description: 'Dump data', group: 'Enumeration' },
    { name: 'Level', flag: '--level', type: 'select', required: false, options: ['1', '2', '3', '4', '5'], description: 'Test level (1-5)', group: 'Injection' },
    { name: 'Risk', flag: '--risk', type: 'select', required: false, options: ['1', '2', '3'], description: 'Risk level (1-3)', group: 'Injection' },
    { name: 'Technique', flag: '--technique', type: 'text', required: false, placeholder: 'BEUSTQ', description: 'SQL injection techniques', group: 'Injection' },
    { name: 'Batch', flag: '--batch', type: 'boolean', required: false, description: 'Never ask for input', group: 'General' },
    { name: 'Random Agent', flag: '--random-agent', type: 'boolean', required: false, description: 'Use random User-Agent', group: 'Request' },
    { name: 'Threads', flag: '--threads', type: 'number', required: false, placeholder: '5', description: 'Concurrent threads', group: 'Performance' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Test', description: 'Fast SQLi detection', params: { 'Level': '1', 'Risk': '1', 'Batch': true }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Test', description: 'Normal detection with enumeration', params: { 'Level': '2', 'Risk': '2', 'Databases': true, 'Batch': true, 'Random Agent': true }, estimatedTime: '2m' },
    { name: 'deep', label: 'Deep Test', description: 'Comprehensive with all techniques', params: { 'Level': '5', 'Risk': '3', 'Databases': true, 'Tables': true, 'Batch': true, 'Random Agent': true, 'Threads': 5 }, estimatedTime: '15m' }
  ],
  examples: [
    { name: 'Basic Test', command: 'sqlmap -u "http://example.com/page.php?id=1" --batch', description: 'Quick SQLi test' },
    { name: 'Dump Database', command: 'sqlmap -u "http://example.com/?id=1" --dbs --dump --batch', description: 'Extract database data' },
    { name: 'From Request', command: 'sqlmap -r request.txt --batch --level=5 --risk=3', description: 'Test from HTTP request file' }
  ],
  documentation: '# SQLMap\n\nAutomatic SQL injection and database takeover tool. Supports MySQL, PostgreSQL, MSSQL, Oracle.',
  docLink: 'https://github.com/sqlmapproject/sqlmap'
};

// ============================================================================
// PASSWORD CRACKING TOOLS
// ============================================================================

const hydraConfig: ToolConfig = {
  name: 'hydra',
  category: 'Password Cracking',
  description: 'Fast network logon cracker',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.1', description: 'Target host', group: 'Target' },
    { name: 'Service', flag: '', type: 'select', required: true, options: ['ssh', 'ftp', 'http-post-form', 'http-get', 'mysql', 'postgres', 'rdp', 'smb', 'vnc', 'telnet'], description: 'Service to attack', group: 'Target' },
    { name: 'Username', flag: '-l', type: 'text', required: false, placeholder: 'admin', description: 'Single username', group: 'Credentials' },
    { name: 'Username List', flag: '-L', type: 'file', required: false, description: 'Username wordlist', group: 'Credentials' },
    { name: 'Password', flag: '-p', type: 'text', required: false, placeholder: 'password123', description: 'Single password', group: 'Credentials' },
    { name: 'Password List', flag: '-P', type: 'file', required: false, description: 'Password wordlist', group: 'Credentials' },
    { name: 'Port', flag: '-s', type: 'number', required: false, placeholder: '22', description: 'Custom port', group: 'Target' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '16', description: 'Parallel tasks', group: 'Performance' },
    { name: 'Verbose', flag: '-V', type: 'boolean', required: false, description: 'Verbose mode', group: 'Output' },
    { name: 'Exit First', flag: '-f', type: 'boolean', required: false, description: 'Exit after first match', group: 'General' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Test', description: 'Common passwords only', params: { 'Threads': 16, 'Exit First': true }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Attack', description: 'Medium wordlist', params: { 'Threads': 8, 'Verbose': true }, estimatedTime: '5m' },
    { name: 'deep', label: 'Deep Attack', description: 'Large wordlist full brute', params: { 'Threads': 4 }, estimatedTime: '30m+' }
  ],
  examples: [
    { name: 'SSH Attack', command: 'hydra -l admin -P passwords.txt ssh://192.168.1.1', description: 'Brute force SSH login' },
    { name: 'Web Form Attack', command: 'hydra -l admin -P pass.txt target http-post-form "/login:user=^USER^&pass=^PASS^:F=failed"', description: 'Web form brute force' }
  ],
  documentation: '# Hydra\n\nFast and flexible network logon cracker. Supports 50+ protocols.',
  docLink: 'https://github.com/vanhauser-thc/thc-hydra'
};

const johnConfig: ToolConfig = {
  name: 'john',
  category: 'Password Cracking',
  description: 'John the Ripper password cracker',
  parameters: [
    { name: 'Hash File', flag: '', type: 'file', required: true, description: 'File containing hashes', group: 'Input' },
    { name: 'Wordlist', flag: '--wordlist', type: 'file', required: false, description: 'Wordlist file', group: 'Attack Mode' },
    { name: 'Format', flag: '--format', type: 'select', required: false, options: ['raw-md5', 'raw-sha1', 'raw-sha256', 'raw-sha512', 'bcrypt', 'md5crypt', 'sha512crypt', 'nt', 'lm'], description: 'Hash format', group: 'Format' },
    { name: 'Incremental', flag: '--incremental', type: 'boolean', required: false, description: 'Brute force mode', group: 'Attack Mode' },
    { name: 'Rules', flag: '--rules', type: 'text', required: false, placeholder: 'best64', description: 'Mangling rules', group: 'Attack Mode' },
    { name: 'Show', flag: '--show', type: 'boolean', required: false, description: 'Show cracked passwords', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Crack', description: 'Common passwords', params: {}, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Attack', description: 'Wordlist with rules', params: { 'Rules': 'best64' }, estimatedTime: '5m' },
    { name: 'deep', label: 'Deep Crack', description: 'Incremental brute force', params: { 'Incremental': true }, estimatedTime: '∞' }
  ],
  examples: [
    { name: 'Dictionary Attack', command: 'john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt', description: 'Crack with wordlist' },
    { name: 'Show Cracked', command: 'john --show hashes.txt', description: 'Display cracked passwords' }
  ],
  documentation: '# John the Ripper\n\nPowerful password cracker. Supports 100+ hash formats.',
  docLink: 'https://github.com/openwall/john'
};

const hashcatConfig: ToolConfig = {
  name: 'hashcat',
  category: 'Password Cracking',
  description: "World's fastest password cracker",
  parameters: [
    { name: 'Hash File', flag: '', type: 'file', required: true, description: 'File with hashes', group: 'Input' },
    { name: 'Hash Type', flag: '-m', type: 'select', required: true, options: ['0 (MD5)', '100 (SHA1)', '1400 (SHA256)', '1700 (SHA512)', '3200 (bcrypt)', '1000 (NTLM)', '5600 (NetNTLMv2)'], description: 'Hash mode', group: 'Hash' },
    { name: 'Attack Mode', flag: '-a', type: 'select', required: true, options: ['0 (Dictionary)', '1 (Combination)', '3 (Brute-force)', '6 (Hybrid Dict+Mask)', '7 (Hybrid Mask+Dict)'], description: 'Attack mode', group: 'Attack' },
    { name: 'Wordlist', flag: '', type: 'file', required: false, description: 'Wordlist file', group: 'Attack' },
    { name: 'Rules', flag: '-r', type: 'file', required: false, description: 'Rules file', group: 'Attack' },
    { name: 'Workload', flag: '-w', type: 'select', required: false, options: ['1 (Low)', '2 (Default)', '3 (High)', '4 (Nightmare)'], description: 'Workload profile', group: 'Performance' },
    { name: 'Force', flag: '--force', type: 'boolean', required: false, description: 'Ignore warnings', group: 'General' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Crack', description: 'Fast dictionary', params: { 'Attack Mode': '0', 'Workload': '2' }, estimatedTime: '1m' },
    { name: 'standard', label: 'Standard Attack', description: 'Dictionary with rules', params: { 'Attack Mode': '0', 'Workload': '3' }, estimatedTime: '10m' },
    { name: 'deep', label: 'Deep Crack', description: 'Full brute force', params: { 'Attack Mode': '3', 'Workload': '4' }, estimatedTime: '∞' }
  ],
  examples: [
    { name: 'MD5 Dictionary', command: 'hashcat -m 0 -a 0 hashes.txt rockyou.txt', description: 'Crack MD5 with wordlist' },
    { name: 'NTLM Brute', command: 'hashcat -m 1000 -a 3 hashes.txt ?a?a?a?a?a?a', description: 'Brute force NTLM 6 chars' }
  ],
  documentation: '# Hashcat\n\nGPU-accelerated password cracker. 300+ hash types supported.',
  docLink: 'https://hashcat.net/wiki/'
};

// ============================================================================
// INFORMATION GATHERING
// ============================================================================

const whoisConfig: ToolConfig = {
  name: 'whois',
  category: 'Information Gathering',
  description: 'Domain registration lookup',
  parameters: [
    { name: 'Domain', flag: '', type: 'text', required: true, placeholder: 'example.com', description: 'Domain to lookup', group: 'Target' },
    { name: 'Server', flag: '-h', type: 'text', required: false, placeholder: 'whois.verisign.com', description: 'WHOIS server', group: 'Options' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Lookup', description: 'Standard WHOIS query', params: {}, estimatedTime: '5s' },
    { name: 'standard', label: 'Standard Lookup', description: 'Same as quick', params: {}, estimatedTime: '5s' },
    { name: 'deep', label: 'Deep Lookup', description: 'Same as quick', params: {}, estimatedTime: '5s' }
  ],
  examples: [
    { name: 'Domain Lookup', command: 'whois example.com', description: 'Get domain registration info' }
  ],
  documentation: '# WHOIS\n\nQuery domain registration databases for ownership information.',
  docLink: 'https://en.wikipedia.org/wiki/WHOIS'
};

const digConfig: ToolConfig = {
  name: 'dig',
  category: 'Information Gathering',
  description: 'DNS lookup utility',
  parameters: [
    { name: 'Domain', flag: '', type: 'text', required: true, placeholder: 'example.com', description: 'Domain to query', group: 'Target' },
    { name: 'Record Type', flag: '', type: 'select', required: false, options: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'ANY'], description: 'DNS record type', group: 'Query' },
    { name: 'Short', flag: '+short', type: 'boolean', required: false, description: 'Short output', group: 'Output' },
    { name: 'Trace', flag: '+trace', type: 'boolean', required: false, description: 'Trace delegation path', group: 'Query' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Lookup', description: 'Basic A record query', params: { 'Short': true }, estimatedTime: '2s' },
    { name: 'standard', label: 'Standard Query', description: 'Full response', params: {}, estimatedTime: '3s' },
    { name: 'deep', label: 'Deep Query', description: 'All records with trace', params: { 'Record Type': 'ANY', 'Trace': true }, estimatedTime: '10s' }
  ],
  examples: [
    { name: 'A Record', command: 'dig example.com A', description: 'Query IPv4 address' },
    { name: 'All Records', command: 'dig example.com ANY', description: 'Get all DNS records' },
    { name: 'Trace', command: 'dig example.com +trace', description: 'Trace DNS resolution' }
  ],
  documentation: '# DIG\n\nDNS lookup utility. Query DNS servers for various record types.',
  docLink: 'https://linux.die.net/man/1/dig'
};

const theHarvesterConfig: ToolConfig = {
  name: 'theharvester',
  category: 'Information Gathering',
  description: 'Email, subdomain & name harvester',
  parameters: [
    { name: 'Domain', flag: '-d', type: 'text', required: true, placeholder: 'example.com', description: 'Target domain', group: 'Target' },
    { name: 'Source', flag: '-b', type: 'select', required: true, options: ['all', 'google', 'bing', 'linkedin', 'twitter', 'shodan', 'virustotal', 'censys', 'hunter', 'github-code'], description: 'Data source', group: 'Source' },
    { name: 'Limit', flag: '-l', type: 'number', required: false, placeholder: '500', description: 'Result limit', group: 'Options' },
    { name: 'Start', flag: '-S', type: 'number', required: false, placeholder: '0', description: 'Start result', group: 'Options' },
    { name: 'Screenshot', flag: '--screenshot', type: 'text', required: false, placeholder: 'screenshots/', description: 'Take screenshots', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Harvest', description: 'Google only', params: { 'Source': 'google', 'Limit': 100 }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Harvest', description: 'Multiple sources', params: { 'Source': 'all', 'Limit': 500 }, estimatedTime: '3m' },
    { name: 'deep', label: 'Deep Harvest', description: 'All sources comprehensive', params: { 'Source': 'all', 'Limit': 1000 }, estimatedTime: '10m' }
  ],
  examples: [
    { name: 'Google Search', command: 'theharvester -d example.com -b google', description: 'Harvest from Google' },
    { name: 'All Sources', command: 'theharvester -d example.com -b all -l 500', description: 'Use all data sources' }
  ],
  documentation: '# theHarvester\n\nGather emails, names, subdomains, IPs from public sources (OSINT).',
  docLink: 'https://github.com/laramies/theHarvester'
};

const subfinderConfig: ToolConfig = {
  name: 'subfinder',
  category: 'Information Gathering',
  description: 'Subdomain discovery tool',
  parameters: [
    { name: 'Domain', flag: '-d', type: 'text', required: true, placeholder: 'example.com', description: 'Target domain', group: 'Target' },
    { name: 'Output', flag: '-o', type: 'text', required: false, placeholder: 'subdomains.txt', description: 'Output file', group: 'Output' },
    { name: 'Recursive', flag: '-recursive', type: 'boolean', required: false, description: 'Recursive subdomain enum', group: 'Options' },
    { name: 'Silent', flag: '-silent', type: 'boolean', required: false, description: 'Silent mode', group: 'Output' },
    { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '10', description: 'Concurrent threads', group: 'Performance' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Discovery', description: 'Fast passive enum', params: { 'Threads': 20 }, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Discovery', description: 'Normal scan', params: { 'Threads': 10 }, estimatedTime: '1m' },
    { name: 'deep', label: 'Deep Discovery', description: 'Recursive enumeration', params: { 'Recursive': true, 'Threads': 5 }, estimatedTime: '5m' }
  ],
  examples: [
    { name: 'Basic Discovery', command: 'subfinder -d example.com', description: 'Find subdomains' },
    { name: 'Recursive', command: 'subfinder -d example.com -recursive', description: 'Deep subdomain scan' }
  ],
  documentation: '# Subfinder\n\nFast passive subdomain enumeration tool using multiple sources.',
  docLink: 'https://github.com/projectdiscovery/subfinder'
};

const amassConfig: ToolConfig = {
  name: 'amass',
  category: 'Information Gathering',
  description: 'In-depth attack surface mapping',
  parameters: [
    { name: 'Domain', flag: '-d', type: 'text', required: true, placeholder: 'example.com', description: 'Target domain', group: 'Target' },
    { name: 'Mode', flag: '', type: 'select', required: true, options: ['enum', 'intel', 'viz', 'track', 'db'], description: 'Amass mode', group: 'General' },
    { name: 'Passive', flag: '-passive', type: 'boolean', required: false, description: 'Passive only', group: 'Options' },
    { name: 'Brute', flag: '-brute', type: 'boolean', required: false, description: 'Enable brute force', group: 'Options' },
    { name: 'Output', flag: '-o', type: 'text', required: false, placeholder: 'results.txt', description: 'Output file', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Enum', description: 'Passive only', params: { 'Mode': 'enum', 'Passive': true }, estimatedTime: '1m' },
    { name: 'standard', label: 'Standard Enum', description: 'Active enumeration', params: { 'Mode': 'enum' }, estimatedTime: '5m' },
    { name: 'deep', label: 'Deep Enum', description: 'Full with brute force', params: { 'Mode': 'enum', 'Brute': true }, estimatedTime: '30m' }
  ],
  examples: [
    { name: 'Passive Enum', command: 'amass enum -passive -d example.com', description: 'Passive subdomain enum' },
    { name: 'Active Enum', command: 'amass enum -d example.com -brute', description: 'Active with brute force' }
  ],
  documentation: '# Amass\n\nIn-depth attack surface mapping and asset discovery.',
  docLink: 'https://github.com/OWASP/Amass'
};

// ============================================================================
// EXPLOITATION TOOLS
// ============================================================================

const metasploitConfig: ToolConfig = {
  name: 'msfconsole',
  category: 'Exploitation',
  description: 'Metasploit Framework console',
  parameters: [
    { name: 'Module', flag: '-x "use ', type: 'text', required: false, placeholder: 'exploit/windows/smb/ms17_010_eternalblue', description: 'Module to load', group: 'Module' },
    { name: 'Resource', flag: '-r', type: 'file', required: false, description: 'Resource script', group: 'Options' },
    { name: 'Quiet', flag: '-q', type: 'boolean', required: false, description: 'Quiet mode', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Launch', description: 'Start console', params: { 'Quiet': true }, estimatedTime: '10s' },
    { name: 'standard', label: 'Standard Launch', description: 'Full banner', params: {}, estimatedTime: '10s' },
    { name: 'deep', label: 'With Module', description: 'Load specific module', params: {}, estimatedTime: '15s' }
  ],
  examples: [
    { name: 'Start Console', command: 'msfconsole -q', description: 'Start Metasploit quietly' },
    { name: 'Run Script', command: 'msfconsole -r script.rc', description: 'Execute resource script' }
  ],
  documentation: '# Metasploit Framework\n\nThe most powerful exploitation framework. 2000+ exploits.',
  docLink: 'https://docs.metasploit.com/'
};

// ============================================================================
// SSL/TLS TOOLS
// ============================================================================

const sslscanConfig: ToolConfig = {
  name: 'sslscan',
  category: 'SSL/TLS',
  description: 'SSL/TLS cipher scanner',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'example.com:443', description: 'Target host:port', group: 'Target' },
    { name: 'No Fallback', flag: '--no-fallback', type: 'boolean', required: false, description: 'Disable fallback', group: 'Options' },
    { name: 'No Heartbleed', flag: '--no-heartbleed', type: 'boolean', required: false, description: 'Skip Heartbleed test', group: 'Options' },
    { name: 'Show Certificate', flag: '--show-certificate', type: 'boolean', required: false, description: 'Show certificate', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Scan', description: 'Fast cipher check', params: { 'No Fallback': true }, estimatedTime: '10s' },
    { name: 'standard', label: 'Standard Scan', description: 'Full SSL check', params: { 'Show Certificate': true }, estimatedTime: '30s' },
    { name: 'deep', label: 'Deep Scan', description: 'Complete analysis', params: { 'Show Certificate': true }, estimatedTime: '1m' }
  ],
  examples: [
    { name: 'Basic Scan', command: 'sslscan example.com', description: 'Check SSL/TLS configuration' },
    { name: 'HTTPS', command: 'sslscan example.com:443', description: 'Scan specific port' }
  ],
  documentation: '# SSLScan\n\nEnumerate SSL/TLS ciphers and check for vulnerabilities.',
  docLink: 'https://github.com/rbsec/sslscan'
};

const testSSLConfig: ToolConfig = {
  name: 'testssl',
  category: 'SSL/TLS',
  description: 'SSL/TLS testing tool',
  parameters: [
    { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'example.com', description: 'Target host', group: 'Target' },
    { name: 'Full', flag: '-f', type: 'boolean', required: false, description: 'Full output', group: 'Options' },
    { name: 'Color', flag: '--color', type: 'select', required: false, options: ['0 (no color)', '1 (less)', '2 (more)', '3 (most)'], description: 'Color level', group: 'Output' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Test', description: 'Fast check', params: {}, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Test', description: 'Full test', params: { 'Full': true }, estimatedTime: '2m' },
    { name: 'deep', label: 'Deep Test', description: 'Comprehensive', params: { 'Full': true }, estimatedTime: '5m' }
  ],
  examples: [
    { name: 'Basic Test', command: 'testssl.sh example.com', description: 'Standard SSL test' }
  ],
  documentation: '# testssl.sh\n\nComprehensive SSL/TLS testing from command line.',
  docLink: 'https://testssl.sh/'
};

// ============================================================================
// WIRELESS TOOLS
// ============================================================================

const aircrackConfig: ToolConfig = {
  name: 'aircrack-ng',
  category: 'Wireless',
  description: 'WiFi network security suite',
  parameters: [
    { name: 'Capture File', flag: '', type: 'file', required: true, description: 'Capture file (.cap)', group: 'Input' },
    { name: 'Wordlist', flag: '-w', type: 'file', required: false, description: 'Password wordlist', group: 'Attack' },
    { name: 'ESSID', flag: '-e', type: 'text', required: false, placeholder: 'NetworkName', description: 'Target ESSID', group: 'Target' },
    { name: 'BSSID', flag: '-b', type: 'text', required: false, placeholder: 'AA:BB:CC:DD:EE:FF', description: 'Target BSSID', group: 'Target' },
  ],
  scanModes: [
    { name: 'quick', label: 'Quick Crack', description: 'Common passwords', params: {}, estimatedTime: '30s' },
    { name: 'standard', label: 'Standard Crack', description: 'Medium wordlist', params: {}, estimatedTime: '5m' },
    { name: 'deep', label: 'Deep Crack', description: 'Large wordlist', params: {}, estimatedTime: '∞' }
  ],
  examples: [
    { name: 'WPA Crack', command: 'aircrack-ng -w rockyou.txt -b AA:BB:CC:DD:EE:FF capture.cap', description: 'Crack WPA password' }
  ],
  documentation: '# Aircrack-ng\n\nComplete suite for WiFi security. Monitor, attack, test, crack.',
  docLink: 'https://www.aircrack-ng.org/doku.php?id=Main'
};

// ============================================================================
// EXPORT ALL TOOL CONFIGS
// ============================================================================

export const toolConfigs: Record<string, ToolConfig> = {
  // Network Scanning
  'nmap': nmapConfig,
  'masscan': masscanConfig,
  
  // Web Scanning
  'nikto': niktoConfig,
  'whatweb': whatwebConfig,
  'gobuster': gobusterConfig,
  'dirb': dirbConfig,
  'wpscan': wpscanConfig,
  
  // SQL Injection
  'sqlmap': sqlmapConfig,
  
  // Password Cracking
  'hydra': hydraConfig,
  'john': johnConfig,
  'hashcat': hashcatConfig,
  
  // Information Gathering
  'whois': whoisConfig,
  'dig': digConfig,
  'theharvester': theHarvesterConfig,
  'subfinder': subfinderConfig,
  'amass': amassConfig,
  
  // Exploitation
  'msfconsole': metasploitConfig,
  'metasploit': metasploitConfig,
  
  // SSL/TLS
  'sslscan': sslscanConfig,
  'testssl': testSSLConfig,
  'testssl.sh': testSSLConfig,
  
  // Wireless
  'aircrack-ng': aircrackConfig,
};

// ============================================================================
// CATEGORY-BASED DEFAULT CONFIGS
// For tools without specific configs, use category-appropriate parameters
// ============================================================================

const categoryConfigs: Record<string, ToolConfig> = {
  'information_gathering': {
    name: '',
    category: 'Information Gathering',
    description: 'Gather intelligence about the target',
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'target.com or 192.168.1.0/24', description: 'Target domain, IP, or network range', group: 'Target' },
      { name: 'Output Format', flag: '-o', type: 'select', required: false, options: ['text', 'json', 'xml', 'csv'], description: 'Output format', group: 'Output' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Enable verbose output', group: 'Options' },
      { name: 'Timeout', flag: '--timeout', type: 'number', required: false, placeholder: '30', description: 'Connection timeout (seconds)', group: 'Options' },
      { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '10', description: 'Number of concurrent threads', group: 'Performance' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Recon', description: 'Fast reconnaissance', params: {}, estimatedTime: '30s' },
      { name: 'standard', label: 'Standard Recon', description: 'Normal information gathering', params: { Verbose: true }, estimatedTime: '2m' },
      { name: 'deep', label: 'Deep Recon', description: 'Comprehensive information gathering', params: { Verbose: true, Threads: 20 }, estimatedTime: '10m' }
    ],
    examples: [],
    documentation: ''
  },

  'vulnerability_analysis': {
    name: '',
    category: 'Vulnerability Analysis',
    description: 'Scan for vulnerabilities',
    parameters: [
      { name: 'Target URL', flag: '', type: 'text', required: true, placeholder: 'https://target.com', description: 'Target URL or IP to scan', group: 'Target' },
      { name: 'Port', flag: '-p', type: 'text', required: false, placeholder: '80,443,8080', description: 'Target ports', group: 'Target' },
      { name: 'Severity', flag: '--severity', type: 'select', required: false, options: ['info', 'low', 'medium', 'high', 'critical'], description: 'Minimum severity level', group: 'Scan Options' },
      { name: 'Output File', flag: '-o', type: 'text', required: false, placeholder: 'results.txt', description: 'Save results to file', group: 'Output' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
      { name: 'Rate Limit', flag: '--rate', type: 'number', required: false, placeholder: '100', description: 'Requests per second', group: 'Performance' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Vuln Scan', description: 'Fast vulnerability check', params: { Severity: 'high' }, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Scan', description: 'Normal vulnerability assessment', params: { Severity: 'medium', Verbose: true }, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Audit', description: 'Comprehensive vulnerability audit', params: { Severity: 'info', Verbose: true }, estimatedTime: '15m' }
    ],
    examples: [],
    documentation: ''
  },

  'web_application': {
    name: '',
    category: 'Web Application Testing',
    description: 'Test web application security',
    parameters: [
      { name: 'Target URL', flag: '', type: 'text', required: true, placeholder: 'https://target.com', description: 'Target web application URL', group: 'Target' },
      { name: 'Port', flag: '-p', type: 'number', required: false, placeholder: '8080', description: 'Target port', group: 'Target' },
      { name: 'Proxy', flag: '--proxy', type: 'text', required: false, placeholder: 'http://127.0.0.1:8080', description: 'HTTP proxy for intercepting', group: 'Proxy' },
      { name: 'Authentication', flag: '--auth', type: 'text', required: false, placeholder: 'user:pass', description: 'HTTP authentication', group: 'Authentication' },
      { name: 'Cookie', flag: '--cookie', type: 'text', required: false, placeholder: 'session=abc123', description: 'Session cookie', group: 'Authentication' },
      { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '5', description: 'Number of threads', group: 'Performance' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Web Scan', description: 'Fast web check', params: {}, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Web Test', description: 'Normal web application testing', params: { Verbose: true }, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Web Audit', description: 'Deep web application penetration test', params: { Verbose: true, Threads: 10 }, estimatedTime: '20m' }
    ],
    examples: [],
    documentation: ''
  },

  'exploitation': {
    name: '',
    category: 'Exploitation',
    description: 'Exploit vulnerabilities in target systems',
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.100', description: 'Target IP or hostname', group: 'Target' },
      { name: 'Target Port', flag: '-p', type: 'number', required: false, placeholder: '4444', description: 'Target port', group: 'Target' },
      { name: 'Payload', flag: '--payload', type: 'select', required: false, options: ['reverse_tcp', 'reverse_https', 'bind_tcp', 'meterpreter', 'shell'], description: 'Payload type', group: 'Payload' },
      { name: 'LHOST', flag: '--lhost', type: 'text', required: false, placeholder: '10.0.0.1', description: 'Listener host (your IP)', group: 'Listener' },
      { name: 'LPORT', flag: '--lport', type: 'number', required: false, placeholder: '4444', description: 'Listener port', group: 'Listener' },
      { name: 'Platform', flag: '--platform', type: 'select', required: false, options: ['windows', 'linux', 'osx', 'android', 'php', 'python', 'java'], description: 'Target platform', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Exploit', description: 'Fast exploitation attempt', params: {}, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Exploit', description: 'Normal exploitation', params: {}, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Exploitation', description: 'Comprehensive exploitation with multiple payloads', params: {}, estimatedTime: '15m' }
    ],
    examples: [],
    documentation: ''
  },

  'password_attacks': {
    name: '',
    category: 'Password Attacks',
    description: 'Crack or brute-force passwords',
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.100 or hash_file.txt', description: 'Target host or hash file', group: 'Target' },
      { name: 'Username', flag: '-l', type: 'text', required: false, placeholder: 'admin', description: 'Username to attack', group: 'Credentials' },
      { name: 'Username List', flag: '-L', type: 'text', required: false, placeholder: '/usr/share/wordlists/users.txt', description: 'Username wordlist file', group: 'Credentials' },
      { name: 'Password List', flag: '-P', type: 'text', required: false, placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', group: 'Wordlist' },
      { name: 'Service', flag: '-s', type: 'select', required: false, options: ['ssh', 'ftp', 'http-get', 'http-post', 'smb', 'rdp', 'mysql', 'mssql', 'vnc', 'telnet'], description: 'Service protocol to attack', group: 'Service' },
      { name: 'Port', flag: '-p', type: 'number', required: false, placeholder: '22', description: 'Target port', group: 'Target' },
      { name: 'Threads', flag: '-t', type: 'number', required: false, placeholder: '16', description: 'Number of parallel tasks', group: 'Performance' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Show each attempt', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Attack', description: 'Fast password check with top 100 passwords', params: { Threads: 4 }, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Attack', description: 'Medium wordlist attack', params: { Threads: 16 }, estimatedTime: '10m' },
      { name: 'deep', label: 'Full Attack', description: 'Comprehensive brute-force with large wordlist', params: { Threads: 32, Verbose: true }, estimatedTime: '60m' }
    ],
    examples: [],
    documentation: ''
  },

  'wireless_attacks': {
    name: '',
    category: 'Wireless Attacks',
    description: 'Attack wireless networks',
    parameters: [
      { name: 'Interface', flag: '-i', type: 'text', required: true, placeholder: 'wlan0', description: 'Wireless interface name', group: 'Interface' },
      { name: 'BSSID', flag: '--bssid', type: 'text', required: false, placeholder: 'AA:BB:CC:DD:EE:FF', description: 'Target access point MAC', group: 'Target' },
      { name: 'Channel', flag: '-c', type: 'number', required: false, placeholder: '6', description: 'Wireless channel', group: 'Target' },
      { name: 'ESSID', flag: '--essid', type: 'text', required: false, placeholder: 'NetworkName', description: 'Target network SSID', group: 'Target' },
      { name: 'Wordlist', flag: '-w', type: 'text', required: false, placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', group: 'Wordlist' },
      { name: 'Capture File', flag: '-r', type: 'text', required: false, placeholder: 'capture.cap', description: 'Packet capture file', group: 'Input' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Scan', description: 'Fast wireless scan', params: {}, estimatedTime: '30s' },
      { name: 'standard', label: 'Standard Capture', description: 'Normal packet capture', params: {}, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Attack', description: 'Comprehensive wireless attack', params: {}, estimatedTime: '30m' }
    ],
    examples: [],
    documentation: ''
  },

  'sniffing_spoofing': {
    name: '',
    category: 'Sniffing & Spoofing',
    description: 'Capture and analyze network traffic',
    parameters: [
      { name: 'Interface', flag: '-i', type: 'text', required: true, placeholder: 'eth0', description: 'Network interface to capture on', group: 'Interface' },
      { name: 'Filter', flag: '-f', type: 'text', required: false, placeholder: 'tcp port 80', description: 'Capture filter (BPF syntax)', group: 'Filter' },
      { name: 'Target IP', flag: '--target', type: 'text', required: false, placeholder: '192.168.1.1', description: 'Target IP for spoofing', group: 'Target' },
      { name: 'Packet Count', flag: '-c', type: 'number', required: false, placeholder: '1000', description: 'Number of packets to capture', group: 'Capture' },
      { name: 'Output File', flag: '-w', type: 'text', required: false, placeholder: 'capture.pcap', description: 'Save capture to file', group: 'Output' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Capture', description: 'Capture 100 packets', params: { 'Packet Count': 100 }, estimatedTime: '30s' },
      { name: 'standard', label: 'Standard Capture', description: 'Normal packet capture', params: { 'Packet Count': 1000, Verbose: true }, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Capture', description: 'Extended packet capture', params: { 'Packet Count': 10000, Verbose: true }, estimatedTime: '30m' }
    ],
    examples: [],
    documentation: ''
  },

  'post_exploitation': {
    name: '',
    category: 'Post Exploitation',
    description: 'Post-exploitation tools for persistence and lateral movement',
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.100', description: 'Compromised target host', group: 'Target' },
      { name: 'Username', flag: '-u', type: 'text', required: false, placeholder: 'admin', description: 'Compromised username', group: 'Credentials' },
      { name: 'Password', flag: '-p', type: 'text', required: false, placeholder: 'password123', description: 'Compromised password', group: 'Credentials' },
      { name: 'Domain', flag: '-d', type: 'text', required: false, placeholder: 'CORP.LOCAL', description: 'Domain name', group: 'Domain' },
      { name: 'Module', flag: '-m', type: 'text', required: false, placeholder: 'privesc/check', description: 'Module to run', group: 'Module' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Enum', description: 'Fast post-exploitation enumeration', params: {}, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Enum', description: 'Normal post-exploitation', params: { Verbose: true }, estimatedTime: '5m' },
      { name: 'deep', label: 'Full Enum', description: 'Comprehensive post-exploitation', params: { Verbose: true }, estimatedTime: '15m' }
    ],
    examples: [],
    documentation: ''
  },

  'forensics': {
    name: '',
    category: 'Forensics',
    description: 'Digital forensics and incident response',
    parameters: [
      { name: 'Input File', flag: '', type: 'text', required: true, placeholder: '/path/to/image.dd or evidence.bin', description: 'Input file or disk image', group: 'Input' },
      { name: 'Output Directory', flag: '-o', type: 'text', required: false, placeholder: './output', description: 'Output directory', group: 'Output' },
      { name: 'File Type', flag: '-t', type: 'select', required: false, options: ['auto', 'raw', 'ewf', 'aff', 'vmdk'], description: 'Input file type', group: 'Input' },
      { name: 'Carve Files', flag: '--carve', type: 'boolean', required: false, description: 'Enable file carving', group: 'Analysis' },
      { name: 'Recursive', flag: '-r', type: 'boolean', required: false, description: 'Recursive analysis', group: 'Options' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Analysis', description: 'Fast forensic scan', params: {}, estimatedTime: '1m' },
      { name: 'standard', label: 'Standard Analysis', description: 'Normal forensic analysis', params: { Verbose: true }, estimatedTime: '10m' },
      { name: 'deep', label: 'Deep Analysis', description: 'Comprehensive forensic investigation', params: { 'Carve Files': true, Recursive: true, Verbose: true }, estimatedTime: '30m' }
    ],
    examples: [],
    documentation: ''
  },

  'reverse_engineering': {
    name: '',
    category: 'Reverse Engineering',
    description: 'Analyze and reverse engineer binaries',
    parameters: [
      { name: 'Input Binary', flag: '', type: 'text', required: true, placeholder: '/path/to/binary', description: 'Binary file to analyze', group: 'Input' },
      { name: 'Architecture', flag: '-a', type: 'select', required: false, options: ['x86', 'x86_64', 'arm', 'arm64', 'mips'], description: 'Target architecture', group: 'Analysis' },
      { name: 'Output Format', flag: '-f', type: 'select', required: false, options: ['asm', 'json', 'hex', 'raw'], description: 'Output format', group: 'Output' },
      { name: 'Analyze All', flag: '-A', type: 'boolean', required: false, description: 'Full analysis (functions, strings, xrefs)', group: 'Analysis' },
      { name: 'Strings', flag: '-z', type: 'boolean', required: false, description: 'Extract strings', group: 'Analysis' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Analysis', description: 'Fast binary overview', params: { Strings: true }, estimatedTime: '30s' },
      { name: 'standard', label: 'Standard Analysis', description: 'Normal reverse engineering', params: { 'Analyze All': true }, estimatedTime: '5m' },
      { name: 'deep', label: 'Deep Analysis', description: 'Comprehensive reverse engineering', params: { 'Analyze All': true, Verbose: true }, estimatedTime: '20m' }
    ],
    examples: [],
    documentation: ''
  },

  'reporting': {
    name: '',
    category: 'Reporting',
    description: 'Generate security reports',
    parameters: [
      { name: 'Input', flag: '', type: 'text', required: true, placeholder: 'scan_results.json or project_name', description: 'Input data or project', group: 'Input' },
      { name: 'Format', flag: '-f', type: 'select', required: false, options: ['html', 'pdf', 'json', 'csv', 'xml'], description: 'Report format', group: 'Output' },
      { name: 'Output File', flag: '-o', type: 'text', required: false, placeholder: 'report.html', description: 'Output file path', group: 'Output' },
      { name: 'Template', flag: '--template', type: 'select', required: false, options: ['default', 'executive', 'technical', 'compliance'], description: 'Report template', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Report', description: 'Fast summary report', params: { Format: 'text' }, estimatedTime: '10s' },
      { name: 'standard', label: 'Standard Report', description: 'Normal detailed report', params: { Format: 'html' }, estimatedTime: '30s' },
      { name: 'deep', label: 'Full Report', description: 'Comprehensive security report', params: { Format: 'pdf', Template: 'executive' }, estimatedTime: '2m' }
    ],
    examples: [],
    documentation: ''
  },

  'networking': {
    name: '',
    category: 'Networking',
    description: 'Network utilities and tools',
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: '192.168.1.100 or target.com', description: 'Target host or IP', group: 'Target' },
      { name: 'Port', flag: '-p', type: 'number', required: false, placeholder: '4444', description: 'Port number', group: 'Connection' },
      { name: 'Protocol', flag: '--protocol', type: 'select', required: false, options: ['tcp', 'udp', 'sctp'], description: 'Network protocol', group: 'Connection' },
      { name: 'Listen Mode', flag: '-l', type: 'boolean', required: false, description: 'Listen for incoming connections', group: 'Mode' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Verbose output', group: 'Options' },
      { name: 'Timeout', flag: '-w', type: 'number', required: false, placeholder: '5', description: 'Connection timeout (seconds)', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Connect', description: 'Fast connection test', params: {}, estimatedTime: '10s' },
      { name: 'standard', label: 'Standard Connection', description: 'Normal network operation', params: { Verbose: true }, estimatedTime: '1m' },
      { name: 'deep', label: 'Full Network Test', description: 'Comprehensive network testing', params: { Verbose: true }, estimatedTime: '5m' }
    ],
    examples: [],
    documentation: ''
  },
};

/**
 * Get category-based config for a tool that doesn't have specific config
 */
function getCategoryConfig(toolName: string, category: string): ToolConfig {
  const catConfig = categoryConfigs[category];
  if (catConfig) {
    return {
      ...catConfig,
      name: toolName,
      description: `${toolName} - ${catConfig.description}`,
      documentation: `# ${toolName}\n\n${catConfig.description}\n\nCategory: ${catConfig.category}\n\nConfigure the parameters below and run your scan.`
    };
  }
  // Ultimate fallback
  return {
    name: toolName,
    category: 'Security Tools',
    description: `${toolName} security tool`,
    parameters: [
      { name: 'Target', flag: '', type: 'text', required: true, placeholder: 'target.com', description: 'Target to scan', group: 'Target' },
      { name: 'Options', flag: '', type: 'text', required: false, placeholder: '--help', description: 'Additional command-line options', group: 'Options' },
      { name: 'Verbose', flag: '-v', type: 'boolean', required: false, description: 'Enable verbose output', group: 'Options' },
    ],
    scanModes: [
      { name: 'quick', label: 'Quick Scan', description: 'Fast scan', params: {}, estimatedTime: '30s' },
      { name: 'standard', label: 'Standard Scan', description: 'Normal scan', params: {}, estimatedTime: '2m' },
      { name: 'deep', label: 'Deep Scan', description: 'Comprehensive scan', params: {}, estimatedTime: '10m' }
    ],
    examples: [],
    documentation: `# ${toolName}\n\nUse the parameters to configure your scan.`
  };
}

/**
 * Get tool configuration by name/slug
 * Uses category-based config if specific config not found
 */
export function getToolConfig(toolName: string, category?: string): ToolConfig {
  const slug = toolName.toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  // First try exact match
  if (toolConfigs[slug]) {
    return toolConfigs[slug];
  }
  
  // Try with hyphens removed
  const noHyphens = slug.replace(/-/g, '');
  if (toolConfigs[noHyphens]) {
    return toolConfigs[noHyphens];
  }
  
  // Try partial match
  for (const [key, config] of Object.entries(toolConfigs)) {
    if (slug.includes(key) || key.includes(slug)) {
      return config;
    }
  }
  
  // Use category-based config if category provided
  if (category) {
    return getCategoryConfig(toolName, category);
  }
  
  // Try to infer category from tool name
  const toolLower = toolName.toLowerCase();
  if (toolLower.includes('sql') || toolLower.includes('inject')) return getCategoryConfig(toolName, 'web_application');
  if (toolLower.includes('crack') || toolLower.includes('hash') || toolLower.includes('brute') || toolLower.includes('pass')) return getCategoryConfig(toolName, 'password_attacks');
  if (toolLower.includes('wifi') || toolLower.includes('wlan') || toolLower.includes('air') || toolLower.includes('wireless')) return getCategoryConfig(toolName, 'wireless_attacks');
  if (toolLower.includes('exploit') || toolLower.includes('payload') || toolLower.includes('shell') || toolLower.includes('msf')) return getCategoryConfig(toolName, 'exploitation');
  if (toolLower.includes('wireshark') || toolLower.includes('sniff') || toolLower.includes('spoof') || toolLower.includes('tcpdump') || toolLower.includes('arp')) return getCategoryConfig(toolName, 'sniffing_spoofing');
  if (toolLower.includes('forensic') || toolLower.includes('carv') || toolLower.includes('autops')) return getCategoryConfig(toolName, 'forensics');
  if (toolLower.includes('reverse') || toolLower.includes('disasm') || toolLower.includes('decompil') || toolLower.includes('radare') || toolLower.includes('ghidra')) return getCategoryConfig(toolName, 'reverse_engineering');
  if (toolLower.includes('vuln') || toolLower.includes('nuclei') || toolLower.includes('openvas')) return getCategoryConfig(toolName, 'vulnerability_analysis');
  if (toolLower.includes('web') || toolLower.includes('burp') || toolLower.includes('zap') || toolLower.includes('proxy')) return getCategoryConfig(toolName, 'web_application');
  if (toolLower.includes('net') || toolLower.includes('tcp') || toolLower.includes('udp') || toolLower.includes('socat')) return getCategoryConfig(toolName, 'networking');
  if (toolLower.includes('recon') || toolLower.includes('enum') || toolLower.includes('scan') || toolLower.includes('discover')) return getCategoryConfig(toolName, 'information_gathering');
  
  // Default: return generic information gathering (most common)
  return getCategoryConfig(toolName, 'information_gathering');
}

/**
 * Get smart defaults for one-click scanning
 */
export function getSmartDefaults(toolName: string, mode: 'quick' | 'standard' | 'deep' = 'standard'): Record<string, string | number | boolean> {
  const config = getToolConfig(toolName);
  const scanMode = config.scanModes.find(m => m.name === mode);
  return scanMode?.params || {};
}

/**
 * Generate command from tool config and parameters
 */
export function generateToolCommand(toolName: string, target: string, params: Record<string, string | number | boolean>): string {
  const config = getToolConfig(toolName);
  const slug = toolName.toLowerCase();
  
  let cmd = slug;
  
  // Add parameters with their flags
  config.parameters.forEach(param => {
    const value = params[param.name];
    if (value !== undefined && value !== '' && value !== false) {
      if (param.type === 'boolean' && value === true) {
        cmd += ` ${param.flag}`;
      } else if (param.flag === '' && param.name !== 'Target') {
        // Positional argument (not target)
        cmd += ` ${value}`;
      } else if (param.flag) {
        cmd += ` ${param.flag} ${value}`;
      }
    }
  });
  
  // Add target at the end if not already included
  if (target && !cmd.includes(target)) {
    cmd += ` ${target}`;
  }
  
  return cmd;
}
