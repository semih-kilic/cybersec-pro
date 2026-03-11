#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Tool Configuration Registry v7
Comprehensive registry of 100+ security tools with best-practice profiles.

Each tool defines:
  - binary   : executable name (resolved via shutil.which at runtime)
  - profiles : named argument presets (quick, default, full, vuln, stealth …)
  - target   : how the target is passed ('append', '-h', '-u', etc.)
  - output   : preferred parseable format ('xml', 'json', 'csv', 'text')
  - category : business/technical grouping
  - plan     : minimum subscription plan
  - version_flag : flag to probe installation (usually '--version')

Author : Semih Kılıç
Version: 7.0.0
"""

from __future__ import annotations
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

# ─────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────

@dataclass
class ScanProfile:
    """A named set of CLI arguments."""
    name: str
    description: str
    args: List[str]
    timeout: int = 300          # seconds
    requires_root: bool = False

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ToolConfig:
    """Full configuration for a single security tool."""
    slug: str                   # unique key  (e.g. 'nmap')
    name: str                   # display name (e.g. 'Nmap')
    binary: str                 # executable  (e.g. 'nmap')
    category: str               # business category
    description: str
    plan: str                   # 'starter' | 'professional' | 'enterprise'
    target_mode: str            # 'append' | '-h' | '-u' | '-t' | '--url' | 'positional' | 'none'
    output_format: str          # 'xml' | 'json' | 'csv' | 'text'
    profiles: Dict[str, ScanProfile] = field(default_factory=dict)
    version_flag: str = '--version'
    needs_target: bool = True
    dangerous: bool = False     # tools that can cause outages
    notes: str = ''

    @property
    def default_profile(self) -> Optional[ScanProfile]:
        return self.profiles.get('default') or next(iter(self.profiles.values()), None)

    @property
    def target_flag(self) -> Optional[str]:
        """Return the flag used to specify the target, or None for append/positional."""
        if self.target_mode in ('append', 'positional', 'none'):
            return None
        return self.target_mode  # e.g. '-h', '-u', '--url'

    def to_dict(self) -> Dict:
        d = asdict(self)
        d['default_profile'] = self.default_profile.name if self.default_profile else None
        return d


# ─────────────────────────────────────────────
# Helper to build profiles quickly
# ─────────────────────────────────────────────
def _p(name: str, desc: str, args: List[str], timeout: int = 300, root: bool = False) -> ScanProfile:
    return ScanProfile(name=name, description=desc, args=args, timeout=timeout, requires_root=root)


# ═══════════════════════════════════════════════
#  TOOL REGISTRY  (100+ tools, grouped by category)
# ═══════════════════════════════════════════════

TOOL_REGISTRY: Dict[str, ToolConfig] = {}

def _register(tc: ToolConfig) -> None:
    TOOL_REGISTRY[tc.slug] = tc


# ──────────────────────────────────────
# 1. NETWORK SCANNING & DISCOVERY
# ──────────────────────────────────────

_register(ToolConfig(
    slug='nmap', name='Nmap', binary='nmap',
    category='Network Scanning', description='Network discovery and security auditing',
    plan='starter', target_mode='append', output_format='xml',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Top 100 ports, fast',      ['-v', '--stats-every', '3s', '-T4', '--top-ports', '100', '-sV', '-oX', '-'], timeout=120),
        'default': _p('default', 'Top 1000 ports, versions', ['-v', '--stats-every', '3s', '-T4', '-sV', '--top-ports', '1000', '-oX', '-'], timeout=300),
        'full':    _p('full',    'All 65535 ports, OS + versions', ['-v', '--stats-every', '5s', '-T4', '-p-', '-sV', '-O', '-oX', '-'], timeout=900, root=True),
        'vuln':    _p('vuln',    'Vulnerability scripts',    ['-v', '--stats-every', '5s', '-T4', '-sV', '--script', 'vuln', '--top-ports', '1000', '-oX', '-'], timeout=600),
        'stealth': _p('stealth', 'SYN stealth scan',         ['-v', '--stats-every', '5s', '-sS', '-T2', '--top-ports', '1000', '-oX', '-'], timeout=600, root=True),
        'udp':     _p('udp',     'UDP top 100 ports',         ['-v', '--stats-every', '5s', '-sU', '-T4', '--top-ports', '100', '-oX', '-'], timeout=600, root=True),
    }
))

_register(ToolConfig(
    slug='masscan', name='Masscan', binary='masscan',
    category='Network Scanning', description='Fastest Internet port scanner',
    plan='professional', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Top 100 ports, 10k rate',  ['--top-ports', '100', '--rate', '10000', '-oJ', '-'], timeout=120, root=True),
        'default': _p('default', 'Top 1000, rate 5000',      ['--top-ports', '1000', '--rate', '5000', '-oJ', '-'], timeout=300, root=True),
        'full':    _p('full',    'All ports, rate 1000',      ['-p0-65535', '--rate', '1000', '-oJ', '-'], timeout=1200, root=True),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='arp-scan', name='ARP Scan', binary='arp-scan',
    category='Network Scanning', description='ARP-based local network discovery',
    plan='starter', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Local network scan', ['-l'], timeout=60, root=True),
    }
))

_register(ToolConfig(
    slug='netdiscover', name='Netdiscover', binary='netdiscover',
    category='Network Scanning', description='Active/passive network discovery',
    plan='professional', target_mode='-r', output_format='text',
    version_flag='-h',   # netdiscover uses -h for help/version
    profiles={
        'default': _p('default', 'Passive network discovery', ['-P', '-N'], timeout=60, root=True),
    }
))

_register(ToolConfig(
    slug='hping3', name='Hping3', binary='hping3',
    category='Network Scanning', description='TCP/IP packet crafting & analysis',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'TCP SYN to port 80', ['-S', '-p', '80', '-c', '5'], timeout=30, root=True),
    },
    dangerous=True
))

# ──────────────────────────────────────
# 2. WEB APPLICATION SCANNING
# ──────────────────────────────────────

_register(ToolConfig(
    slug='nikto', name='Nikto', binary='nikto',
    category='Web Application', description='Web server vulnerability scanner',
    plan='starter', target_mode='-h', output_format='text',
    version_flag='-Version',
    profiles={
        'quick':   _p('quick',   'Quick scan, tuning x',   ['-Display', 'V', '-Tuning', 'x', '-maxtime', '120s'], timeout=150),
        'default': _p('default', 'Standard scan',          ['-Display', 'V', '-Tuning', 'x'], timeout=600),
        'full':    _p('full',    'Comprehensive',           ['-Display', 'V', '-Tuning', '123456789x', '-C', 'all'], timeout=1200),
    }
))

_register(ToolConfig(
    slug='wapiti', name='Wapiti', binary='wapiti',
    category='Web Application', description='Web application vulnerability scanner',
    plan='professional', target_mode='--url', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Fast scan, depth 1',     ['--scope', 'page', '-f', 'json', '-o', '/tmp/wapiti_out.json', '--max-scan-time', '120'], timeout=180),
        'default': _p('default', 'Standard, depth 3',      ['--scope', 'folder', '-f', 'json', '-o', '/tmp/wapiti_out.json'], timeout=600),
        'full':    _p('full',    'Full domain audit',       ['--scope', 'domain', '-f', 'json', '-o', '/tmp/wapiti_out.json', '-v', '2'], timeout=1800),
    }
))

_register(ToolConfig(
    slug='whatweb', name='WhatWeb', binary='whatweb',
    category='Web Application', description='Web technology fingerprinting',
    plan='starter', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Stealthy, aggression 1', ['-a', '1', '--log-json=-'], timeout=60),
        'default': _p('default', 'Standard, aggression 3', ['-a', '3', '--log-json=-'], timeout=120),
        'full':    _p('full',    'Aggressive, all plugins', ['-a', '4', '--log-json=-', '-v'], timeout=300),
    }
))

_register(ToolConfig(
    slug='wpscan', name='WPScan', binary='wpscan',
    category='Web Application', description='WordPress vulnerability scanner',
    plan='professional', target_mode='--url', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Passive enumeration',     ['--enumerate', 'vp,vt', '-f', 'json', '--no-banner'], timeout=180),
        'default': _p('default', 'Version + plugin enum',   ['--enumerate', 'vp,vt,u', '-f', 'json', '--no-banner'], timeout=300),
        'full':    _p('full',    'Aggressive + passwords',  ['--enumerate', 'vp,vt,u,m', '-f', 'json', '--no-banner', '--plugins-detection', 'aggressive'], timeout=900),
    }
))

_register(ToolConfig(
    slug='wafw00f', name='Wafw00f', binary='wafw00f',
    category='Web Application', description='Web Application Firewall detection',
    plan='starter', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Detect WAF',  ['-o-', '-f', 'json'], timeout=60),
    }
))

_register(ToolConfig(
    slug='commix', name='Commix', binary='commix',
    category='Web Application', description='Command injection exploitation',
    plan='enterprise', target_mode='--url', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Auto-detect injection', ['--batch', '--level', '2'], timeout=300),
    },
    dangerous=True
))

# ──────────────────────────────────────
# 3. DIRECTORY & CONTENT DISCOVERY
# ──────────────────────────────────────

_register(ToolConfig(
    slug='gobuster', name='Gobuster', binary='gobuster',
    category='Content Discovery', description='Directory/DNS/VHost brute-force',
    plan='professional', target_mode='-u', output_format='text',
    version_flag='version',
    profiles={
        'quick':   _p('quick',   'Small wordlist, fast',    ['dir', '-w', '/usr/share/wordlists/dirb/common.txt', '-t', '50', '--no-color'], timeout=120),
        'default': _p('default', 'Medium wordlist',         ['dir', '-w', '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt', '-t', '30', '--no-color', '-v'], timeout=600),
        'full':    _p('full',    'Large wordlist, extensions', ['dir', '-w', '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt', '-x', 'php,html,js,txt,bak', '-t', '20', '--no-color', '-v'], timeout=1200),
    }
))

_register(ToolConfig(
    slug='dirb', name='Dirb', binary='dirb',
    category='Content Discovery', description='Web content scanner',
    plan='starter', target_mode='append', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Common wordlist', ['/usr/share/wordlists/dirb/common.txt', '-S', '-r'], timeout=300),
    }
))

_register(ToolConfig(
    slug='ffuf', name='Ffuf', binary='ffuf',
    category='Content Discovery', description='Fast web fuzzer',
    plan='professional', target_mode='none', output_format='json',
    version_flag='-V',
    profiles={
        'default': _p('default', 'Dir brute with FUZZ keyword', ['-w', '/usr/share/wordlists/dirb/common.txt', '-mc', '200,301,302,403', '-o', '/tmp/ffuf_out.json', '-of', 'json'], timeout=300),
    },
    notes='Target URL must contain FUZZ keyword, e.g. http://target/FUZZ'
))

_register(ToolConfig(
    slug='wfuzz', name='Wfuzz', binary='wfuzz',
    category='Content Discovery', description='Web fuzzer',
    plan='professional', target_mode='none', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Dir brute with FUZZ', ['-w', '/usr/share/wordlists/dirb/common.txt', '--hc', '404', '-f', '/tmp/wfuzz_out,json'], timeout=300),
    },
    notes='Target URL must contain FUZZ keyword'
))

# ──────────────────────────────────────
# 4. SQL INJECTION
# ──────────────────────────────────────

_register(ToolConfig(
    slug='sqlmap', name='SQLMap', binary='sqlmap',
    category='SQL Injection', description='Automatic SQL injection and database takeover',
    plan='professional', target_mode='-u', output_format='text',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Quick, level 1',          ['-v', '1', '--batch', '--level', '1', '--risk', '1', '--smart', '--threads', '4'], timeout=180),
        'default': _p('default', 'Standard, level 2',       ['-v', '2', '--batch', '--level', '2', '--risk', '2', '--threads', '4'], timeout=600),
        'full':    _p('full',    'Deep, level 5 risk 3',    ['-v', '2', '--batch', '--level', '5', '--risk', '3', '--threads', '4', '--forms', '--crawl', '2'], timeout=1800),
    },
    dangerous=True
))

# ──────────────────────────────────────
# 5. DNS ENUMERATION
# ──────────────────────────────────────

_register(ToolConfig(
    slug='dnsrecon', name='DNSRecon', binary='dnsrecon',
    category='DNS Enumeration', description='DNS enumeration and zone transfer',
    plan='starter', target_mode='-d', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Standard enum',   ['-t', 'std', '-j', '/tmp/dnsrecon_out.json'], timeout=120),
        'default': _p('default', 'Standard + brute', ['-t', 'std,brt', '-j', '/tmp/dnsrecon_out.json'], timeout=300),
        'full':    _p('full',    'All techniques',   ['-t', 'std,brt,axfr,bing,crt', '-j', '/tmp/dnsrecon_out.json'], timeout=600),
    }
))

_register(ToolConfig(
    slug='fierce', name='Fierce', binary='fierce',
    category='DNS Enumeration', description='DNS reconnaissance and brute-force',
    plan='starter', target_mode='--domain', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Standard domain scan', [], timeout=180),
    }
))

_register(ToolConfig(
    slug='dig', name='Dig', binary='dig',
    category='DNS Enumeration', description='DNS lookup utility',
    plan='starter', target_mode='append', output_format='text',
    version_flag='-v',
    profiles={
        'default': _p('default', 'All records',   ['ANY', '+noall', '+answer'], timeout=30),
        'zone':    _p('zone',    'Zone transfer',  ['AXFR'], timeout=60),
    }
))

_register(ToolConfig(
    slug='whois', name='Whois', binary='whois',
    category='DNS Enumeration', description='Domain registration lookup',
    plan='starter', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Standard lookup', [], timeout=30),
    }
))

_register(ToolConfig(
    slug='subfinder', name='Subfinder', binary='subfinder',
    category='DNS Enumeration', description='Passive subdomain discovery',
    plan='professional', target_mode='-d', output_format='json',
    version_flag='-version',
    profiles={
        'default': _p('default', 'All sources',   ['-silent', '-oJ', '-'], timeout=180),
    }
))

_register(ToolConfig(
    slug='amass', name='Amass', binary='amass',
    category='DNS Enumeration', description='Attack surface mapping & discovery',
    plan='professional', target_mode='-d', output_format='json',
    version_flag='version',
    profiles={
        'quick':   _p('quick',   'Passive only',   ['enum', '-passive', '-json', '/tmp/amass_out.json'], timeout=300),
        'default': _p('default', 'Standard enum',  ['enum', '-json', '/tmp/amass_out.json'], timeout=900),
    }
))

# ──────────────────────────────────────
# 6. SSL/TLS ANALYSIS
# ──────────────────────────────────────

_register(ToolConfig(
    slug='sslscan', name='SSLScan', binary='sslscan',
    category='SSL/TLS Analysis', description='SSL/TLS scanner — ciphers, certificates, vulnerabilities',
    plan='starter', target_mode='append', output_format='xml',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Full SSL/TLS scan',  ['--xml=-'], timeout=120),
    }
))

_register(ToolConfig(
    slug='sslyze', name='SSLyze', binary='sslyze',
    category='SSL/TLS Analysis', description='Fast TLS/SSL analysis',
    plan='professional', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Regular scan',   ['--json_out=-', '--regular'], timeout=180),
    }
))

_register(ToolConfig(
    slug='testssl', name='testssl.sh', binary='testssl.sh',
    category='SSL/TLS Analysis', description='Testing TLS/SSL encryption',
    plan='professional', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Quick protocols check', ['--fast', '--jsonfile', '/tmp/testssl_out.json'], timeout=180),
        'default': _p('default', 'Full audit',            ['--jsonfile', '/tmp/testssl_out.json'], timeout=600),
    }
))

# ──────────────────────────────────────
# 7. OSINT & RECONNAISSANCE
# ──────────────────────────────────────

_register(ToolConfig(
    slug='theharvester', name='theHarvester', binary='theharvester',
    category='OSINT', description='Email, subdomain, and hostname harvester',
    plan='professional', target_mode='-d', output_format='json',
    version_flag='-h',
    profiles={
        'quick':   _p('quick',   'Google + Bing',           ['-b', 'google,bing', '-l', '200', '-f', '/tmp/harvester_out.json'], timeout=180),
        'default': _p('default', 'All sources',             ['-b', 'all', '-l', '500', '-f', '/tmp/harvester_out.json'], timeout=600),
    }
))

_register(ToolConfig(
    slug='searchsploit', name='SearchSploit', binary='searchsploit',
    category='OSINT', description='Exploit database search',
    plan='starter', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Search exploits', ['--json'], timeout=30),
    },
    needs_target=True,
    notes='Target is a search term, not an IP (e.g. "Apache 2.4")'
))

# ──────────────────────────────────────
# 8. VULNERABILITY SCANNING
# ──────────────────────────────────────

_register(ToolConfig(
    slug='nuclei', name='Nuclei', binary='nuclei',
    category='Vulnerability Scanning', description='Fast template-based vulnerability scanner',
    plan='professional', target_mode='-u', output_format='json',
    version_flag='-version',
    profiles={
        'quick':   _p('quick',   'Critical + High only',    ['-severity', 'critical,high', '-silent', '-jsonl', '-o', '/tmp/nuclei_out.jsonl'], timeout=300),
        'default': _p('default', 'All severities',          ['-silent', '-jsonl', '-o', '/tmp/nuclei_out.jsonl'], timeout=900),
        'cve':     _p('cve',     'CVE templates only',      ['-t', 'cves/', '-silent', '-jsonl', '-o', '/tmp/nuclei_out.jsonl'], timeout=600),
    }
))

_register(ToolConfig(
    slug='httpx', name='Httpx', binary='httpx',
    category='Vulnerability Scanning', description='HTTP toolkit for probing',
    plan='professional', target_mode='-u', output_format='json',
    version_flag='-version',
    profiles={
        'default': _p('default', 'Probe with tech detect', ['-silent', '-title', '-tech-detect', '-status-code', '-json'], timeout=120),
    }
))

# ──────────────────────────────────────
# 9. PASSWORD ATTACKS
# ──────────────────────────────────────

_register(ToolConfig(
    slug='hydra', name='Hydra', binary='hydra',
    category='Password Attacks', description='Network logon brute-force',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'SSH brute (small list)', ['-l', 'admin', '-P', '/usr/share/wordlists/rockyou.txt', '-t', '4', '-f', 'ssh'], timeout=600),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='ncrack', name='Ncrack', binary='ncrack',
    category='Password Attacks', description='High-speed network authentication cracker',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'SSH default creds', ['-p', 'ssh', '-U', '/usr/share/ncrack/minimal.usr', '-P', '/usr/share/ncrack/minimal.pwd'], timeout=300),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='medusa', name='Medusa', binary='medusa',
    category='Password Attacks', description='Parallel network login brute-force',
    plan='enterprise', target_mode='-h', output_format='text',
    version_flag='-V',
    profiles={
        'default': _p('default', 'SSH brute', ['-u', 'admin', '-P', '/usr/share/wordlists/rockyou.txt', '-M', 'ssh', '-t', '4', '-f'], timeout=600),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='john', name='John the Ripper', binary='john',
    category='Password Attacks', description='Password hash cracker',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Auto-detect format', ['--format=auto'], timeout=600),
    },
    needs_target=True,
    notes='Target is a hash file path'
))

_register(ToolConfig(
    slug='hashcat', name='Hashcat', binary='hashcat',
    category='Password Attacks', description='Advanced GPU password recovery',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Dictionary attack', ['-a', '0', '-m', '0'], timeout=600),
    },
    needs_target=True,
    notes='Target is a hash file path'
))

_register(ToolConfig(
    slug='cewl', name='CeWL', binary='cewl',
    category='Password Attacks', description='Custom wordlist generator',
    plan='professional', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Depth 2, min 5 chars', ['-d', '2', '-m', '5', '-w', '/tmp/cewl_wordlist.txt'], timeout=180),
    }
))

_register(ToolConfig(
    slug='crunch', name='Crunch', binary='crunch',
    category='Password Attacks', description='Wordlist generator',
    plan='professional', target_mode='none', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Generate 6-8 char lowercase', ['6', '8', 'abcdefghijklmnopqrstuvwxyz', '-o', '/tmp/crunch_wordlist.txt'], timeout=60),
    },
    needs_target=False
))

# ──────────────────────────────────────
# 10. SMB / WINDOWS ENUMERATION
# ──────────────────────────────────────

_register(ToolConfig(
    slug='enum4linux', name='Enum4linux', binary='enum4linux',
    category='SMB Enumeration', description='Windows/SMB enumeration',
    plan='professional', target_mode='append', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Full enumeration', ['-a'], timeout=300),
    }
))

_register(ToolConfig(
    slug='smbclient', name='SMBClient', binary='smbclient',
    category='SMB Enumeration', description='SMB share listing',
    plan='professional', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'List shares (no auth)', ['-L', '-N'], timeout=60),
    },
    notes='Target format: //IP or hostname prepended'
))

_register(ToolConfig(
    slug='smbmap', name='SMBMap', binary='smbmap',
    category='SMB Enumeration', description='SMB share access checker',
    plan='professional', target_mode='-H', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Enumerate with null session', ['-u', '', '-p', ''], timeout=120),
    }
))

_register(ToolConfig(
    slug='crackmapexec', name='CrackMapExec', binary='crackmapexec',
    category='SMB Enumeration', description='Post-exploitation Swiss army knife',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'SMB enum', ['smb', '--shares', '-u', '', '-p', ''], timeout=120),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='nbtscan', name='NBTScan', binary='nbtscan',
    category='SMB Enumeration', description='NetBIOS name scanner',
    plan='starter', target_mode='append', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Standard scan', ['-r'], timeout=60),
    }
))

# ──────────────────────────────────────
# 11. SNMP
# ──────────────────────────────────────

_register(ToolConfig(
    slug='snmpwalk', name='SNMPWalk', binary='snmpwalk',
    category='SNMP', description='SNMP tree walker',
    plan='professional', target_mode='append', output_format='text',
    version_flag='-V',
    profiles={
        'default': _p('default', 'Community string public', ['-v', '2c', '-c', 'public'], timeout=120),
    }
))

_register(ToolConfig(
    slug='onesixtyone', name='OneSixtyOne', binary='onesixtyone',
    category='SNMP', description='SNMP community string brute-force',
    plan='professional', target_mode='append', output_format='text',
    version_flag='-h',
    profiles={
        'default': _p('default', 'Default communities', ['-c', '/usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt'], timeout=120),
    }
))

# ──────────────────────────────────────
# 12. WIRELESS
# ──────────────────────────────────────

_register(ToolConfig(
    slug='aircrack-ng', name='Aircrack-ng', binary='aircrack-ng',
    category='Wireless', description='WiFi security auditing',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Dictionary attack', ['-w', '/usr/share/wordlists/rockyou.txt'], timeout=600),
    },
    needs_target=True,
    notes='Target is a .cap file path'
))

# ──────────────────────────────────────
# 13. EXPLOITATION TOOLS
# ──────────────────────────────────────

_register(ToolConfig(
    slug='msfconsole', name='Metasploit', binary='msfconsole',
    category='Exploitation', description='Exploitation framework',
    plan='enterprise', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Run resource script', ['-q', '-x', 'exit'], timeout=30),
    },
    dangerous=True,
    notes='Use with resource scripts only'
))

_register(ToolConfig(
    slug='searchsploit', name='SearchSploit', binary='searchsploit',
    category='Exploitation', description='Exploit database search',
    plan='starter', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'JSON search', ['--json'], timeout=30),
    },
    notes='Target is a search term (e.g., "Apache 2.4")'
))

# ──────────────────────────────────────
# 14. FORENSICS & REVERSE ENGINEERING
# ──────────────────────────────────────

_register(ToolConfig(
    slug='foremost', name='Foremost', binary='foremost',
    category='Forensics', description='File carving / recovery',
    plan='enterprise', target_mode='-i', output_format='text',
    version_flag='-V',
    profiles={
        'default': _p('default', 'Carve all types', ['-o', '/tmp/foremost_out'], timeout=600),
    },
    notes='Target is a disk image path'
))

_register(ToolConfig(
    slug='binwalk', name='Binwalk', binary='binwalk',
    category='Forensics', description='Firmware analysis',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Signature scan', ['-e'], timeout=120),
    },
    notes='Target is a firmware file path'
))

_register(ToolConfig(
    slug='exiftool', name='ExifTool', binary='exiftool',
    category='Forensics', description='Metadata extraction',
    plan='starter', target_mode='append', output_format='json',
    version_flag='-ver',
    profiles={
        'default': _p('default', 'Extract all metadata', ['-json'], timeout=30),
    },
    notes='Target is a file path'
))

_register(ToolConfig(
    slug='steghide', name='Steghide', binary='steghide',
    category='Forensics', description='Steganography tool',
    plan='professional', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Extract info', ['info', '-f'], timeout=30),
    },
    needs_target=True,
    notes='Target is an image/audio file path'
))

_register(ToolConfig(
    slug='yara', name='Yara', binary='yara',
    category='Forensics', description='Pattern matching for malware analysis',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Scan with rules', ['-r'], timeout=120),
    },
    notes='Requires rule file + target file/dir'
))

_register(ToolConfig(
    slug='radare2', name='Radare2', binary='radare2',
    category='Forensics', description='Reverse engineering framework',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='-v',
    profiles={
        'default': _p('default', 'Analyze binary', ['-A', '-q', '-c', 'afl; exit'], timeout=60),
    },
    notes='Target is a binary file path'
))

# ──────────────────────────────────────
# 15. NETWORK SNIFFING
# ──────────────────────────────────────

_register(ToolConfig(
    slug='tcpdump', name='Tcpdump', binary='tcpdump',
    category='Network Sniffing', description='Packet capture & analysis',
    plan='professional', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Capture 100 packets', ['-c', '100', '-nn', '-v'], timeout=60, root=True),
    },
    notes='Target should be interface or filter expression'
))

_register(ToolConfig(
    slug='tshark', name='TShark', binary='tshark',
    category='Network Sniffing', description='Terminal-based Wireshark',
    plan='professional', target_mode='none', output_format='json',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Capture 50 packets, JSON', ['-c', '50', '-T', 'json'], timeout=60, root=True),
    }
))

# ──────────────────────────────────────
# 16. PROXY / MITM
# ──────────────────────────────────────

_register(ToolConfig(
    slug='responder', name='Responder', binary='responder',
    category='MITM', description='LLMNR/NBT-NS/mDNS poisoner',
    plan='enterprise', target_mode='-I', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Analyze mode', ['-A'], timeout=120, root=True),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='bettercap', name='Bettercap', binary='bettercap',
    category='MITM', description='Network attack and monitoring framework',
    plan='enterprise', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Net probe', ['-eval', 'net.probe on; sleep 10; quit'], timeout=30, root=True),
    },
    dangerous=True
))

_register(ToolConfig(
    slug='ettercap', name='Ettercap', binary='ettercap',
    category='MITM', description='Man-in-the-middle suite',
    plan='enterprise', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Text mode scan', ['-T', '-q', '-M', 'arp:remote'], timeout=60, root=True),
    },
    dangerous=True
))

# ──────────────────────────────────────
# 17. CONTAINER / CLOUD SECURITY
# ──────────────────────────────────────

_register(ToolConfig(
    slug='trivy', name='Trivy', binary='trivy',
    category='Container Security', description='Container image vulnerability scanner',
    plan='professional', target_mode='append', output_format='json',
    version_flag='--version',
    profiles={
        'quick':   _p('quick',   'Critical only',   ['image', '--severity', 'CRITICAL', '-f', 'json'], timeout=300),
        'default': _p('default', 'All severities',  ['image', '-f', 'json'], timeout=600),
    },
    notes='Target is a container image name'
))

# ──────────────────────────────────────
# 18. MOBILE SECURITY
# ──────────────────────────────────────

_register(ToolConfig(
    slug='apktool', name='APKTool', binary='apktool',
    category='Mobile Security', description='Android APK reverse engineering',
    plan='enterprise', target_mode='none', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Decompile APK', ['d', '-f', '-o', '/tmp/apktool_out'], timeout=120),
    },
    needs_target=True,
    notes='Target is an APK file path'
))

_register(ToolConfig(
    slug='jadx', name='JADX', binary='jadx',
    category='Mobile Security', description='Android DEX/APK decompiler',
    plan='enterprise', target_mode='append', output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Decompile to Java', ['-d', '/tmp/jadx_out'], timeout=120),
    },
    notes='Target is an APK/DEX file path'
))


# ═══════════════════════════════════════════════
#  PLAN TIER LISTING
# ═══════════════════════════════════════════════

PLAN_TIERS = ('trial', 'starter', 'professional', 'enterprise')

def _plan_rank(plan: str) -> int:
    try:
        return PLAN_TIERS.index(plan)
    except ValueError:
        return 0


def get_tools_for_plan(plan: str) -> Dict[str, ToolConfig]:
    """Return all tools accessible to a given plan (inclusive of lower tiers)."""
    rank = _plan_rank(plan)
    return {slug: tc for slug, tc in TOOL_REGISTRY.items() if _plan_rank(tc.plan) <= rank}


def get_tool(slug: str) -> Optional[ToolConfig]:
    return TOOL_REGISTRY.get(slug)


def get_all_slugs() -> List[str]:
    return list(TOOL_REGISTRY.keys())


def get_categories() -> Dict[str, List[str]]:
    """Group tools by category."""
    cats: Dict[str, List[str]] = {}
    for slug, tc in TOOL_REGISTRY.items():
        cats.setdefault(tc.category, []).append(slug)
    return cats


# ═══════════════════════════════════════════════
#  GENERIC FALLBACK TEMPLATE
# ═══════════════════════════════════════════════

GENERIC_TEMPLATE = ToolConfig(
    slug='__generic__',
    name='Generic Tool',
    binary='',
    category='Uncategorized',
    description='Fallback for tools not in registry',
    plan='enterprise',
    target_mode='append',
    output_format='text',
    version_flag='--version',
    profiles={
        'default': _p('default', 'Run with target only', [], timeout=300),
    }
)


def get_or_generic(slug: str) -> ToolConfig:
    """Get tool config or return a generic template with slug filled in."""
    tc = TOOL_REGISTRY.get(slug)
    if tc:
        return tc
    # Build generic template
    from copy import deepcopy
    g = deepcopy(GENERIC_TEMPLATE)
    g.slug = slug
    g.name = slug.replace('-', ' ').title()
    g.binary = slug
    return g


# ═══════════════════════════════════════════════
#  BULK AUTO-REGISTRATION FROM DATABASE
# ═══════════════════════════════════════════════

# Category mapping: DB categories → V7 categories
_DB_CATEGORY_MAP = {
    'API & Mobile Backend Security': 'Mobile & API Security',
    'Compliance & Regulatory': 'Forensics & Compliance',
    'Data Protection & Encryption': 'Cryptography & Data Protection',
    'Infrastructure Security': 'Network Scanning',
    'Known Vulnerability Database': 'Vulnerability Assessment',
    'Web Application Security': 'Web Security',
    'information_gathering': 'Information Gathering',
    'vulnerability_analysis': 'Vulnerability Assessment',
    'web_application': 'Web Security',
    'password_attacks': 'Password & Authentication',
    'wireless_attacks': 'Wireless Security',
    'sniffing_spoofing': 'Network Scanning',
    'exploitation': 'Exploitation',
    'post_exploitation': 'Post-Exploitation',
    'forensics': 'Forensics & Compliance',
    'reverse_engineering': 'Mobile & API Security',
    'reporting': 'Forensics & Compliance',
    'networking': 'Network Scanning',
}

# Tools that are GUI-only or frameworks (not CLI scanners)
_GUI_ONLY_TOOLS = {
    'maltego', 'burpsuite', 'ida', 'ida-free', 'binary-ninja', 'hopper',
    'ollydbg', 'x64dbg', 'windbg', 'ghidra', 'cutter', 'autopsy',
    'guymager', 'keepnote', 'cherrytree', 'magictree', 'faraday',
    'wireshark', 'zenmap', 'armitage', 'cobalt-strike', 'metasploit-framework',
    'dirbuster', 'etherape', 'kismet-gui', 'dradis', 'bloodhound',
}

# Tool binary name overrides (when slug != binary name)
_BINARY_OVERRIDES = {
    'theHarvester': 'theHarvester',
    'theharvester': 'theHarvester',
    'zaproxy': 'zap-cli',
    'wpscan': 'wpscan',
    'hashcat': 'hashcat',
    'msfconsole': 'msfconsole',
    'searchsploit': 'searchsploit',
    'john': 'john',
    'hydra': 'hydra',
    'aircrack-ng': 'aircrack-ng',
    'recon-ng': 'recon-ng',
    'spiderfoot': 'spiderfoot',
    'subfinder': 'subfinder',
    'amass': 'amass',
    'crackmapexec': 'crackmapexec',
    'responder': 'responder',
    'enum4linux': 'enum4linux',
    'steghide': 'steghide',
    'binwalk': 'binwalk',
    'volatility': 'vol.py',
    'volatility3': 'vol3',
    'foremost': 'foremost',
    'bulk-extractor': 'bulk_extractor',
    'linpeas': 'linpeas.sh',
    'winpeas': 'winpeas.exe',
    'PEASS-ng': 'linpeas.sh',
    'empire': 'powershell-empire',
    'strace': 'strace',
    'ltrace': 'ltrace',
    'gdb': 'gdb',
    'radare2': 'r2',
    'apktool': 'apktool',
    'jadx': 'jadx',
    'frida': 'frida',
    'objection': 'objection',
    'mitmproxy': 'mitmproxy',
    'bettercap': 'bettercap',
    'ettercap': 'ettercap',
    'pixiewps': 'pixiewps',
    'airgeddon': 'airgeddon',
    'wifite': 'wifite',
    'fern-wifi': 'fern-wifi-cracker',
    'cowpatty': 'cowpatty',
    'hashdeep': 'hashdeep',
    'yara': 'yara',
    'trivy': 'trivy',
    'lynis': 'lynis',
    'chkrootkit': 'chkrootkit',
    'rkhunter': 'rkhunter',
    'clamav': 'clamscan',
    'snort': 'snort',
    'suricata': 'suricata',
    'openvas': 'gvm-cli',
    'nessus': 'nessuscli',
    'GTFOBins': 'gtfobins',
    'LOLBASProject': 'lolbas',
    'WADComs': 'wadcoms',
}

# Target modes for known tool types
_TARGET_MODE_MAP = {
    'Network Scanning': 'append',
    'Web Security': '-u',
    'Information Gathering': 'append',
    'Vulnerability Assessment': 'append',
    'Password & Authentication': '-h',
    'Wireless Security': 'none',
    'Forensics & Compliance': 'positional',
    'Cryptography & Data Protection': 'positional',
    'Mobile & API Security': 'positional',
    'Exploitation': 'append',
    'Post-Exploitation': 'append',
}


def _parse_command_template(template: str, slug: str, binary: str) -> tuple:
    """
    Parse a DB command_template like 'nikto -h {target}' into
    (pre_args, target_mode, post_args).
    
    Returns:
        (pre_args: list[str], target_mode: str, post_args: list[str])
    """
    if not template or '{target}' not in template:
        return [], 'append', []
    
    # Split template into tokens, preserving {target} as marker
    # e.g. 'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt'
    parts = template.split()
    
    # Remove the binary (first token) - we'll add it back from the config
    if parts and (parts[0] == binary or parts[0] == slug or
                  parts[0].endswith(f'/{binary}') or parts[0].endswith(f'/{slug}')):
        parts = parts[1:]
    
    pre_args = []
    post_args = []
    target_mode = 'append'
    found_target = False
    
    i = 0
    while i < len(parts):
        token = parts[i]
        if '{target}' in token:
            found_target = True
            # Check if previous token was a flag like -h, -u, -d, --url, --domain
            if pre_args and pre_args[-1].startswith('-'):
                target_mode = pre_args.pop()  # e.g. '-h', '-u', '-d'
            else:
                target_mode = 'append'
            # If token has more than just {target} (e.g. '{service}://{target}')
            # keep it as a special template — but for now treat as append
            i += 1
            continue
        
        if not found_target:
            pre_args.append(token)
        else:
            post_args.append(token)
        i += 1
    
    return pre_args, target_mode, post_args


def bulk_register_from_db(tools_data: List[Dict[str, Any]]) -> int:
    """
    Bulk-register tools from database records into V7 TOOL_REGISTRY.
    
    Parses command_template from DB to build correct command profiles,
    so tools like 'nikto -h {target}' get proper flags.
    
    Only registers tools that aren't already in the registry.
    
    Returns:
        Number of newly registered tools
    """
    import shutil
    count = 0
    
    for td in tools_data:
        slug = td.get('name', '').strip()
        if not slug or slug in TOOL_REGISTRY:
            continue
        
        db_category = td.get('category', 'general')
        v7_category = _DB_CATEGORY_MAP.get(db_category, db_category)
        plan = td.get('plan_required', 'starter')
        biz_name = td.get('business_name', slug.replace('-', ' ').title())
        description = td.get('description', '') or td.get('business_description', '') or f'{biz_name} security tool'
        command_template = td.get('command_template', '') or ''
        
        # Determine binary name
        binary = _BINARY_OVERRIDES.get(slug, slug)
        
        # Parse command_template for correct args and target mode
        pre_args, tmpl_target_mode, post_args = _parse_command_template(command_template, slug, binary)
        
        # Use parsed target_mode if available, else fall back to category map
        if command_template and '{target}' in command_template:
            target_mode = tmpl_target_mode
        else:
            target_mode = _TARGET_MODE_MAP.get(v7_category, 'append')
        
        # Build profile args from template
        default_args = pre_args + post_args  # flags before and after {target}
        
        # Check if tool is GUI-only
        is_gui = slug in _GUI_ONLY_TOOLS
        
        # Check if binary exists on system
        binary_path = shutil.which(binary)
        installed = binary_path is not None
        
        # Create ToolConfig with template-derived profiles
        tc = ToolConfig(
            slug=slug,
            name=biz_name if biz_name else slug.replace('-', ' ').title(),
            binary=binary,
            category=v7_category,
            description=description[:200] if description else f'{slug} security tool',
            plan=plan,
            target_mode=target_mode,
            output_format='text',
            version_flag='--version' if not is_gui else '',
            needs_target=not is_gui,
            dangerous=slug in {'empire', 'cobalt-strike', 'ettercap', 'bettercap', 'responder', 'msfconsole'},
            notes='gui-only' if is_gui else ('installed' if installed else 'not-installed'),
            profiles={
                'default': _p('default', f'Run {slug} with standard settings', default_args, timeout=300),
                'quick': _p('quick', f'Quick {slug} scan', pre_args, timeout=120),
                'full': _p('full', f'Comprehensive {slug} scan', default_args, timeout=600),
            }
        )
        
        TOOL_REGISTRY[slug] = tc
        count += 1
    
    return count


def load_tools_from_system() -> int:
    """
    Auto-discover security tools from system paths.
    Scans /usr/bin, /usr/sbin, and known Kali tool locations.
    
    Returns:
        Number of newly discovered tools
    """
    import shutil
    import os
    
    # Known security tool binaries to look for
    KNOWN_SECURITY_TOOLS = [
        # Network
        'nmap', 'masscan', 'zmap', 'unicornscan', 'arp-scan', 'netdiscover',
        'hping3', 'fping', 'arping', 'nbtscan', 'onesixtyone', 'snmpwalk',
        'snmpcheck', 'snmpenum', 'ike-scan', 'p0f', 'netcat', 'ncat', 'socat',
        'proxychains', 'proxychains4', 'tor', 'torsocks',
        
        # DNS
        'dig', 'host', 'nslookup', 'dnsrecon', 'dnsenum', 'fierce', 'dnsmap',
        'dnswalk', 'whois', 'dmitri',
        
        # Web
        'nikto', 'whatweb', 'wpscan', 'gobuster', 'dirb', 'wfuzz', 'ffuf',
        'sqlmap', 'xsser', 'commix', 'dalfox', 'arjun', 'httpx', 'httprobe',
        'wafw00f', 'feroxbuster', 'wapiti', 'skipfish', 'uniscan',
        'cadaver', 'davtest', 'joomscan', 'droopescan', 'cmsmap',
        
        # Vulnerability
        'nuclei', 'searchsploit', 'nmap-vulners', 'vulscan',
        'openvas', 'lynis', 'chkrootkit', 'rkhunter', 'tiger',
        
        # Password
        'hydra', 'john', 'hashcat', 'medusa', 'ncrack', 'patator',
        'cewl', 'crunch', 'cupp', 'wordlister', 'crowbar',
        'ophcrack', 'rainbowcrack', 'johnny',
        
        # Wireless
        'aircrack-ng', 'airmon-ng', 'airodump-ng', 'aireplay-ng',
        'wifite', 'reaver', 'bully', 'pixiewps', 'fern-wifi-cracker',
        'cowpatty', 'mdk3', 'mdk4', 'hostapd-mana',
        
        # Exploitation
        'msfconsole', 'msfvenom', 'msfdb', 'shellter', 'veil',
        'empire', 'covenant', 'sliver',
        
        # OSINT
        'theharvester', 'recon-ng', 'maltego', 'spiderfoot', 'sherlock',
        'metagoofil', 'exiftool', 'foca', 'osrframework',
        
        # Forensics
        'foremost', 'binwalk', 'volatility', 'autopsy', 'sleuthkit',
        'bulk_extractor', 'scalpel', 'dc3dd', 'dcfldd', 'guymager',
        'hashdeep', 'md5deep', 'photorec', 'testdisk',
        
        # Reverse Engineering
        'gdb', 'radare2', 'r2', 'ghidra', 'jadx', 'apktool',
        'dex2jar', 'objdump', 'readelf', 'strings', 'strace', 'ltrace',
        'nm', 'hexdump', 'xxd',
        
        # Network Sniffing
        'tcpdump', 'tshark', 'wireshark', 'ettercap', 'bettercap',
        'dsniff', 'arpspoof', 'mitmproxy', 'sslstrip', 'sslsplit',
        'responder',
        
        # Container/Cloud
        'trivy', 'docker', 'kubectl', 'prowler', 'scout',
        
        # Crypto
        'sslscan', 'sslyze', 'testssl', 'tlsx', 'cipherscan',
        
        # Misc
        'yara', 'suricata', 'snort', 'clamav', 'clamscan',
        'steghide', 'stegsolve', 'openstego', 'snow', 'outguess',
        'ipcalc', 'sipcalc', 'macchanger', 'ethtool',
    ]
    
    count = 0
    for tool_name in KNOWN_SECURITY_TOOLS:
        if tool_name in TOOL_REGISTRY:
            continue
        
        binary_path = shutil.which(tool_name)
        if not binary_path:
            continue
        
        # Auto-categorize
        category = 'Uncategorized'
        for cat_keyword, cat_name in [
            ('dns', 'DNS & Domain'), ('nmap', 'Network Scanning'), 
            ('scan', 'Vulnerability Assessment'), ('web', 'Web Security'),
            ('sql', 'Web Security'), ('crack', 'Password & Authentication'),
            ('hash', 'Password & Authentication'), ('air', 'Wireless Security'),
            ('wifi', 'Wireless Security'), ('msf', 'Exploitation'),
            ('forensic', 'Forensics & Compliance'), ('steg', 'Steganography'),
            ('ssl', 'Cryptography & Data Protection'), ('sniff', 'Network Scanning'),
            ('dump', 'Forensics & Compliance'),
        ]:
            if cat_keyword in tool_name.lower():
                category = cat_name
                break
        
        tc = ToolConfig(
            slug=tool_name,
            name=tool_name.replace('-', ' ').title(),
            binary=tool_name,
            category=category,
            description=f'{tool_name} security tool (auto-discovered)',
            plan='starter',
            target_mode='append',
            output_format='text',
            version_flag='--version',
            profiles={
                'default': _p('default', f'Run {tool_name}', [], timeout=300),
            }
        )
        
        TOOL_REGISTRY[tool_name] = tc
        count += 1
    
    return count


# Auto-discover system tools at import time
_sys_discovered = load_tools_from_system()
if _sys_discovered > 0:
    pass  # Silent — app.py will print summary


# Quick summary when run directly
if __name__ == '__main__':
    print(f"Tool Registry v7 — {len(TOOL_REGISTRY)} tools registered")
    for cat, slugs in sorted(get_categories().items()):
        print(f"\n  {cat} ({len(slugs)}):")
        for s in sorted(slugs):
            tc = TOOL_REGISTRY[s]
            profiles = ', '.join(tc.profiles.keys())
            print(f"    {s:20s} plan={tc.plan:14s} profiles=[{profiles}]")
