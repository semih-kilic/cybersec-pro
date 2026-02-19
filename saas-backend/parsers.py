#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Universal Output Parser v7
Converts raw CLI output from security tools into structured JSON.

Supported parsers:
  - Nmap XML  → ports, services, OS, scripts
  - Nmap text → fallback regex
  - Nikto     → findings with OSVDB refs
  - SQLMap    → injection points, databases
  - Nuclei    → template matches (JSONL)
  - SSLScan   → certificate + cipher info
  - WhatWeb   → technology fingerprints
  - Gobuster  → discovered paths
  - Generic   → keyword-based severity extraction

Author : Semih Kılıç
Version: 7.0.0
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional


# ═══════════════════════════════════════════════
#  AUTO DISPATCH
# ═══════════════════════════════════════════════

def auto_parse(
    tool_slug: str,
    stdout: str,
    stderr: str = '',
    output_format: str = 'text',
) -> Dict[str, Any]:
    """
    Auto-detect and dispatch to the correct parser.
    Returns a structured dict with at least {'findings': [...], 'summary': {...}}.
    """
    slug = tool_slug.lower().replace('-', '_')

    PARSER_MAP = {
        'nmap':         parse_nmap,
        'nikto':        parse_nikto,
        'sqlmap':       parse_sqlmap,
        'nuclei':       parse_nuclei,
        'sslscan':      parse_sslscan,
        'whatweb':      parse_whatweb,
        'gobuster':     parse_gobuster,
        'dirb':         parse_dirb,
        'ffuf':         parse_ffuf,
        'wpscan':       parse_wpscan,
        'dnsrecon':     parse_dnsrecon,
        'subfinder':    parse_subfinder,
        'theharvester': parse_theharvester,
        'httpx':        parse_httpx,
        'searchsploit': parse_searchsploit,
        'masscan':      parse_masscan,
        'whois':        parse_whois,
        'dig':          parse_dig,
        'wafw00f':      parse_wafw00f,
        'exiftool':     parse_json_passthrough,
        'sslyze':       parse_json_passthrough,
    }

    parser = PARSER_MAP.get(slug)
    if parser:
        try:
            return parser(stdout, stderr)
        except Exception as e:
            # Fall through to generic parser if specific fails
            return generic_parse(stdout, stderr, note=f"Specific parser ({slug}) failed: {e}")
    else:
        return generic_parse(stdout, stderr)


# ═══════════════════════════════════════════════
#  NMAP PARSER
# ═══════════════════════════════════════════════

def parse_nmap(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Nmap output — prefers XML, falls back to text regex."""
    # Try XML first (output with -oX -)
    if '<?xml' in stdout or '<nmaprun' in stdout:
        return _parse_nmap_xml(stdout)
    return _parse_nmap_text(stdout)


def _parse_nmap_xml(xml_str: str) -> Dict[str, Any]:
    """Parse Nmap XML output into structured data."""
    findings: List[Dict] = []
    hosts: List[Dict] = []

    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        # Try to extract just the XML portion
        match = re.search(r'(<\?xml.*?</nmaprun>)', xml_str, re.DOTALL)
        if match:
            root = ET.fromstring(match.group(1))
        else:
            return _parse_nmap_text(xml_str)

    scan_info = root.attrib
    scan_args = scan_info.get('args', '')

    for host_el in root.findall('.//host'):
        addr_el = host_el.find('address')
        ip = addr_el.get('addr', 'unknown') if addr_el is not None else 'unknown'
        status_el = host_el.find('status')
        host_status = status_el.get('state', 'unknown') if status_el is not None else 'unknown'

        host_data: Dict[str, Any] = {
            'ip': ip,
            'status': host_status,
            'ports': [],
            'os': [],
            'hostnames': [],
        }

        # Hostnames
        for hn in host_el.findall('.//hostname'):
            host_data['hostnames'].append({
                'name': hn.get('name', ''),
                'type': hn.get('type', ''),
            })

        # Ports
        for port_el in host_el.findall('.//port'):
            port_id = port_el.get('portid', '')
            protocol = port_el.get('protocol', 'tcp')
            state_el = port_el.find('state')
            state = state_el.get('state', 'unknown') if state_el is not None else 'unknown'

            service_el = port_el.find('service')
            service = ''
            product = ''
            version = ''
            extra = ''
            if service_el is not None:
                service = service_el.get('name', '')
                product = service_el.get('product', '')
                version = service_el.get('version', '')
                extra = service_el.get('extrainfo', '')

            # Script output
            scripts = []
            for script_el in port_el.findall('script'):
                scripts.append({
                    'id': script_el.get('id', ''),
                    'output': script_el.get('output', ''),
                })

            port_data = {
                'port': int(port_id) if port_id.isdigit() else port_id,
                'protocol': protocol,
                'state': state,
                'service': service,
                'product': product,
                'version': version,
                'extra': extra,
                'scripts': scripts,
            }
            host_data['ports'].append(port_data)

            # Create finding for each open port
            if state == 'open':
                severity = _assess_port_severity(service, int(port_id) if port_id.isdigit() else 0)
                findings.append({
                    'type': 'open_port',
                    'severity': severity,
                    'title': f"Port {port_id}/{protocol} open — {service}",
                    'detail': f"{product} {version} {extra}".strip(),
                    'host': ip,
                    'port': int(port_id) if port_id.isdigit() else port_id,
                    'service': service,
                    'scripts': scripts,
                })

            # Vuln script findings
            for s in scripts:
                if any(kw in s['output'].lower() for kw in ('vulnerable', 'vuln', 'critical', 'exploit')):
                    findings.append({
                        'type': 'vulnerability',
                        'severity': 'high',
                        'title': f"Vuln: {s['id']} on port {port_id}",
                        'detail': s['output'][:500],
                        'host': ip,
                        'port': int(port_id) if port_id.isdigit() else port_id,
                    })

        # OS Detection
        for osmatch in host_el.findall('.//osmatch'):
            host_data['os'].append({
                'name': osmatch.get('name', ''),
                'accuracy': osmatch.get('accuracy', ''),
            })

        hosts.append(host_data)

    total_open = sum(len([p for p in h['ports'] if p['state'] == 'open']) for h in hosts)
    total_closed = sum(len([p for p in h['ports'] if p['state'] == 'closed']) for h in hosts)
    total_filtered = sum(len([p for p in h['ports'] if p['state'] == 'filtered']) for h in hosts)

    return {
        'tool': 'nmap',
        'format': 'xml',
        'scan_args': scan_args,
        'hosts': hosts,
        'findings': findings,
        'summary': {
            'total_hosts': len(hosts),
            'hosts_up': sum(1 for h in hosts if h['status'] == 'up'),
            'total_open_ports': total_open,
            'total_closed_ports': total_closed,
            'total_filtered_ports': total_filtered,
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def _parse_nmap_text(output: str) -> Dict[str, Any]:
    """Fallback regex-based Nmap text parser."""
    findings: List[Dict] = []

    # Match lines like: 22/tcp   open  ssh     OpenSSH 9.2p1
    port_re = re.compile(
        r'^(\d+)/(tcp|udp)\s+(open|filtered|closed)\s+(\S+)\s*(.*)',
        re.MULTILINE,
    )
    for m in port_re.finditer(output):
        port, proto, state, service, version_info = m.groups()
        if state == 'open':
            severity = _assess_port_severity(service, int(port))
            findings.append({
                'type': 'open_port',
                'severity': severity,
                'title': f"Port {port}/{proto} open — {service}",
                'detail': version_info.strip(),
                'port': int(port),
                'service': service,
            })

    return {
        'tool': 'nmap',
        'format': 'text',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'total_open_ports': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def _assess_port_severity(service: str, port: int) -> str:
    """Assess severity of an open port based on service name."""
    critical_services = {'telnet', 'ftp', 'rsh', 'rlogin', 'rexec', 'vnc'}
    high_services = {'smb', 'microsoft-ds', 'netbios-ssn', 'rdp', 'ms-wbt-server', 'mysql', 'postgresql', 'mssql', 'oracle'}
    medium_services = {'http', 'https', 'ssh', 'smtp', 'pop3', 'imap'}

    svc = service.lower()
    if svc in critical_services:
        return 'critical'
    if svc in high_services or port in (445, 3389, 3306, 5432, 1433, 1521):
        return 'high'
    if svc in medium_services:
        return 'medium'
    return 'info'


# ═══════════════════════════════════════════════
#  NIKTO PARSER
# ═══════════════════════════════════════════════

def parse_nikto(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Nikto output text."""
    findings: List[Dict] = []
    combined = stdout + '\n' + stderr

    # Match Nikto finding lines: + OSVDB-XXXX: /path: description
    osvdb_re = re.compile(r'\+\s*(OSVDB-\d+):\s*(.+)', re.MULTILINE)
    for m in osvdb_re.finditer(combined):
        ref, detail = m.groups()
        severity = 'medium'
        dl = detail.lower()
        if any(w in dl for w in ('remote code', 'rce', 'injection', 'backdoor', 'root')):
            severity = 'critical'
        elif any(w in dl for w in ('xss', 'cross-site', 'sql', 'traversal', 'disclosure')):
            severity = 'high'
        elif any(w in dl for w in ('info', 'header', 'cookie', 'version')):
            severity = 'low'

        findings.append({
            'type': 'web_vulnerability',
            'severity': severity,
            'title': ref,
            'detail': detail.strip(),
        })

    # Also match generic + lines
    generic_re = re.compile(r'^\+\s+(.+)', re.MULTILINE)
    for m in generic_re.finditer(combined):
        line = m.group(1).strip()
        if line.startswith('OSVDB') or line.startswith('-') or not line:
            continue
        if 'found' in line.lower() or 'vulnerable' in line.lower():
            findings.append({
                'type': 'web_finding',
                'severity': 'medium',
                'title': line[:100],
                'detail': line,
            })

    # Server info
    server_match = re.search(r'Server:\s+(.+)', combined)
    server = server_match.group(1).strip() if server_match else 'Unknown'

    return {
        'tool': 'nikto',
        'server': server,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  SQLMAP PARSER
# ═══════════════════════════════════════════════

def parse_sqlmap(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse SQLMap output."""
    findings: List[Dict] = []
    combined = stdout + '\n' + stderr

    # Injection points
    inj_re = re.compile(r'Parameter:\s+(.+?)(?:\s+\((.+?)\))?', re.MULTILINE)
    for m in inj_re.finditer(combined):
        param = m.group(1)
        inj_type = m.group(2) or 'unknown'
        findings.append({
            'type': 'sql_injection',
            'severity': 'critical',
            'title': f"SQLi: {param}",
            'detail': f"Injection type: {inj_type}",
            'parameter': param,
            'injection_type': inj_type,
        })

    # Databases found
    dbs: List[str] = []
    db_re = re.compile(r'available databases \[(\d+)\]:', re.IGNORECASE)
    db_match = db_re.search(combined)
    if db_match:
        db_list_re = re.compile(r'\[\*\]\s+(\S+)')
        dbs = db_list_re.findall(combined[db_match.end():db_match.end() + 500])
        for db in dbs:
            findings.append({
                'type': 'database_found',
                'severity': 'high',
                'title': f"Database: {db}",
                'detail': f"Accessible database discovered: {db}",
            })

    # DBMS detection
    dbms_match = re.search(r"back-end DBMS:\s+(.+)", combined)
    dbms = dbms_match.group(1).strip() if dbms_match else None

    return {
        'tool': 'sqlmap',
        'dbms': dbms,
        'databases': dbs,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'injection_points': sum(1 for f in findings if f['type'] == 'sql_injection'),
            'databases_found': len(dbs),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  NUCLEI PARSER
# ═══════════════════════════════════════════════

def parse_nuclei(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Nuclei JSONL output."""
    findings: List[Dict] = []

    for line in stdout.strip().split('\n'):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            findings.append({
                'type': 'nuclei_match',
                'severity': obj.get('info', {}).get('severity', 'info'),
                'title': obj.get('info', {}).get('name', obj.get('template-id', 'Unknown')),
                'detail': obj.get('matched-at', ''),
                'template_id': obj.get('template-id', ''),
                'matcher_name': obj.get('matcher-name', ''),
                'host': obj.get('host', ''),
            })
        except json.JSONDecodeError:
            # Text-based nuclei output line
            sev_match = re.search(r'\[(critical|high|medium|low|info)\]', line, re.I)
            if sev_match:
                findings.append({
                    'type': 'nuclei_match',
                    'severity': sev_match.group(1).lower(),
                    'title': line.strip()[:200],
                    'detail': line.strip(),
                })

    return {
        'tool': 'nuclei',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  SSLSCAN PARSER
# ═══════════════════════════════════════════════

def parse_sslscan(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse SSLScan output (XML or text)."""
    findings: List[Dict] = []

    if '<document>' in stdout or '<ssltest' in stdout:
        return _parse_sslscan_xml(stdout)

    # Text fallback
    weak = re.findall(r'(SSLv[23]|TLSv1\.0|RC4|DES|NULL|EXPORT|MD5)', stdout, re.I)
    for w in set(weak):
        findings.append({
            'type': 'weak_crypto',
            'severity': 'high' if 'SSL' in w.upper() or 'NULL' in w.upper() else 'medium',
            'title': f"Weak: {w}",
            'detail': f"Weak protocol/cipher detected: {w}",
        })

    cert_match = re.search(r'Subject:\s+(.+)', stdout)
    cert_info = cert_match.group(1).strip() if cert_match else None

    return {
        'tool': 'sslscan',
        'certificate': cert_info,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def _parse_sslscan_xml(xml_str: str) -> Dict[str, Any]:
    findings: List[Dict] = []
    try:
        root = ET.fromstring(xml_str)
        for cipher in root.findall('.//cipher'):
            status = cipher.get('status', '')
            sslversion = cipher.get('sslversion', '')
            name = cipher.get('cipher', '')
            bits = cipher.get('bits', '')
            if 'SSLv' in sslversion or 'NULL' in name or 'RC4' in name or 'DES' in name:
                findings.append({
                    'type': 'weak_cipher',
                    'severity': 'high',
                    'title': f"Weak: {sslversion} {name}",
                    'detail': f"{sslversion} cipher {name} ({bits} bits) — {status}",
                })
    except ET.ParseError:
        pass

    return {
        'tool': 'sslscan',
        'format': 'xml',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  WHATWEB PARSER
# ═══════════════════════════════════════════════

def parse_whatweb(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse WhatWeb JSON output."""
    findings: List[Dict] = []
    technologies: List[Dict] = []

    try:
        data = json.loads(stdout)
        if isinstance(data, list):
            for entry in data:
                target = entry.get('target', '')
                plugins = entry.get('plugins', {})
                for plugin_name, info in plugins.items():
                    if plugin_name == 'IP':
                        continue
                    versions = info.get('version', [])
                    tech = {
                        'name': plugin_name,
                        'versions': versions if isinstance(versions, list) else [versions],
                    }
                    technologies.append(tech)
                    findings.append({
                        'type': 'technology',
                        'severity': 'info',
                        'title': f"Tech: {plugin_name}",
                        'detail': f"{plugin_name} {', '.join(str(v) for v in versions)}" if versions else plugin_name,
                        'target': target,
                    })
    except json.JSONDecodeError:
        # Text fallback
        for line in stdout.split('\n'):
            if line.strip():
                findings.append({
                    'type': 'technology',
                    'severity': 'info',
                    'title': line.strip()[:100],
                    'detail': line.strip(),
                })

    return {
        'tool': 'whatweb',
        'technologies': technologies,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'technologies_detected': len(technologies),
        },
    }


# ═══════════════════════════════════════════════
#  GOBUSTER / DIRB / FFUF PARSERS
# ═══════════════════════════════════════════════

def parse_gobuster(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Gobuster directory output."""
    findings: List[Dict] = []

    # Matches lines: /admin (Status: 200) [Size: 1234]
    path_re = re.compile(r'^(/\S+)\s+\(Status:\s*(\d+)\)(?:\s+\[Size:\s*(\d+)\])?', re.MULTILINE)
    for m in path_re.finditer(stdout):
        path, status, size = m.groups()
        sev = 'info'
        if status == '200':
            sev = 'medium' if any(kw in path.lower() for kw in ('admin', 'login', 'config', 'backup', '.env')) else 'info'
        elif status == '403':
            sev = 'low'

        findings.append({
            'type': 'discovered_path',
            'severity': sev,
            'title': f"{path} [{status}]",
            'detail': f"Status: {status}, Size: {size or 'N/A'}",
            'path': path,
            'status_code': int(status),
            'size': int(size) if size else None,
        })

    return {
        'tool': 'gobuster',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'paths_found': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def parse_dirb(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse DIRB output."""
    findings: List[Dict] = []

    # Matches: + http://target/admin/ (CODE:200|SIZE:1234)
    url_re = re.compile(r'\+\s+(https?://\S+)\s+\(CODE:(\d+)\|SIZE:(\d+)\)', re.MULTILINE)
    for m in url_re.finditer(stdout):
        url, code, size = m.groups()
        findings.append({
            'type': 'discovered_path',
            'severity': 'info',
            'title': url,
            'detail': f"Code: {code}, Size: {size}",
            'url': url,
            'status_code': int(code),
        })

    return {
        'tool': 'dirb',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def parse_ffuf(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse FFUF JSON output."""
    findings: List[Dict] = []

    try:
        data = json.loads(stdout)
        results = data.get('results', [])
        for r in results:
            findings.append({
                'type': 'discovered_path',
                'severity': 'info',
                'title': r.get('input', {}).get('FUZZ', r.get('url', '')),
                'detail': f"Status: {r.get('status')}, Length: {r.get('length')}, Words: {r.get('words')}",
                'url': r.get('url', ''),
                'status_code': r.get('status'),
            })
    except json.JSONDecodeError:
        return generic_parse(stdout, stderr)

    return {
        'tool': 'ffuf',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  WPSCAN PARSER
# ═══════════════════════════════════════════════

def parse_wpscan(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse WPScan JSON output."""
    findings: List[Dict] = []

    try:
        data = json.loads(stdout)

        # Version info
        version = data.get('version', {})
        if version.get('number'):
            findings.append({
                'type': 'wordpress_version',
                'severity': 'info',
                'title': f"WordPress {version.get('number')}",
                'detail': f"Status: {version.get('status', 'unknown')}",
            })

        # Vulnerabilities
        for vuln in data.get('vulnerabilities', []):
            findings.append({
                'type': 'wordpress_vuln',
                'severity': 'high',
                'title': vuln.get('title', 'Unknown vulnerability'),
                'detail': json.dumps(vuln.get('references', {})),
            })

        # Plugins
        for name, info in data.get('plugins', {}).items():
            for vuln in info.get('vulnerabilities', []):
                findings.append({
                    'type': 'plugin_vuln',
                    'severity': 'high',
                    'title': f"Plugin {name}: {vuln.get('title', '')}",
                    'detail': f"Fixed in: {vuln.get('fixed_in', 'N/A')}",
                })

    except json.JSONDecodeError:
        return generic_parse(stdout, stderr)

    return {
        'tool': 'wpscan',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  DNS TOOLS
# ═══════════════════════════════════════════════

def parse_dnsrecon(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse DNSRecon JSON or text output."""
    findings: List[Dict] = []

    try:
        data = json.loads(stdout)
        if isinstance(data, list):
            for record in data:
                findings.append({
                    'type': 'dns_record',
                    'severity': 'info',
                    'title': f"{record.get('type', 'UNKNOWN')}: {record.get('name', '')}",
                    'detail': json.dumps(record),
                })
    except json.JSONDecodeError:
        for line in stdout.split('\n'):
            if line.strip() and not line.startswith('['):
                findings.append({
                    'type': 'dns_record',
                    'severity': 'info',
                    'title': line.strip()[:100],
                    'detail': line.strip(),
                })

    return {
        'tool': 'dnsrecon',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
        },
    }


def parse_subfinder(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Subfinder output — one subdomain per line."""
    findings: List[Dict] = []
    subdomains = [line.strip() for line in stdout.split('\n') if line.strip() and '.' in line]

    for sub in subdomains:
        findings.append({
            'type': 'subdomain',
            'severity': 'info',
            'title': sub,
            'detail': f"Subdomain discovered: {sub}",
        })

    return {
        'tool': 'subfinder',
        'subdomains': subdomains,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'subdomains_found': len(subdomains),
        },
    }


def parse_theharvester(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse theHarvester output."""
    findings: List[Dict] = []
    emails: List[str] = []
    hosts: List[str] = []

    # Extract emails
    email_re = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
    emails = list(set(email_re.findall(stdout)))
    for email in emails:
        findings.append({
            'type': 'email',
            'severity': 'info',
            'title': f"Email: {email}",
            'detail': email,
        })

    # Extract hosts/IPs
    ip_re = re.compile(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b')
    hosts = list(set(ip_re.findall(stdout)))

    return {
        'tool': 'theharvester',
        'emails': emails,
        'hosts': hosts,
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'emails_found': len(emails),
            'hosts_found': len(hosts),
        },
    }


def parse_whois(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse whois text output."""
    info: Dict[str, str] = {}
    fields = {
        'registrar': r'Registrar:\s*(.+)',
        'creation_date': r'Creat(?:ion|ed)\s*Date:\s*(.+)',
        'expiration_date': r'(?:Expir(?:ation|y)\s*Date|Registry Expiry Date):\s*(.+)',
        'name_servers': r'Name Server:\s*(.+)',
        'registrant': r'Registrant\s+(?:Organization|Name):\s*(.+)',
    }
    for key, pattern in fields.items():
        matches = re.findall(pattern, stdout, re.I)
        if matches:
            info[key] = matches[0].strip() if key != 'name_servers' else [m.strip() for m in matches]

    return {
        'tool': 'whois',
        'info': info,
        'findings': [{'type': 'whois_info', 'severity': 'info', 'title': k, 'detail': str(v)} for k, v in info.items()],
        'summary': {'fields_found': len(info)},
    }


def parse_dig(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse dig output."""
    findings: List[Dict] = []
    records: List[Dict] = []

    # Match answer section lines: domain. TTL IN TYPE value
    rec_re = re.compile(r'^(\S+)\.\s+(\d+)\s+IN\s+(\S+)\s+(.+)', re.MULTILINE)
    for m in rec_re.finditer(stdout):
        name, ttl, rtype, value = m.groups()
        rec = {'name': name, 'ttl': int(ttl), 'type': rtype, 'value': value.strip()}
        records.append(rec)
        findings.append({
            'type': 'dns_record',
            'severity': 'info',
            'title': f"{rtype}: {value.strip()[:80]}",
            'detail': f"{name} {ttl} IN {rtype} {value.strip()}",
        })

    return {
        'tool': 'dig',
        'records': records,
        'findings': findings,
        'summary': {'total_records': len(records)},
    }


def parse_wafw00f(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse wafw00f output."""
    findings: List[Dict] = []

    try:
        data = json.loads(stdout)
        if isinstance(data, list):
            for entry in data:
                waf = entry.get('firewall', 'None')
                findings.append({
                    'type': 'waf_detected',
                    'severity': 'info' if waf == 'None' else 'medium',
                    'title': f"WAF: {waf}" if waf != 'None' else 'No WAF detected',
                    'detail': json.dumps(entry),
                })
    except json.JSONDecodeError:
        waf_match = re.search(r'is behind\s+(.+?)(?:\s|$)', stdout)
        if waf_match:
            findings.append({
                'type': 'waf_detected',
                'severity': 'info',
                'title': f"WAF: {waf_match.group(1)}",
                'detail': waf_match.group(0),
            })
        elif 'no waf' in stdout.lower() or 'not behind' in stdout.lower():
            findings.append({
                'type': 'waf_detected',
                'severity': 'info',
                'title': 'No WAF detected',
                'detail': 'Target does not appear to be behind a WAF',
            })

    return {
        'tool': 'wafw00f',
        'findings': findings,
        'summary': {'total_findings': len(findings)},
    }


# ═══════════════════════════════════════════════
#  HTTPX / MASSCAN / SEARCHSPLOIT
# ═══════════════════════════════════════════════

def parse_httpx(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse httpx JSON/text output."""
    findings: List[Dict] = []

    for line in stdout.strip().split('\n'):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            findings.append({
                'type': 'http_probe',
                'severity': 'info',
                'title': f"{obj.get('url', '')} [{obj.get('status_code', '')}]",
                'detail': f"Title: {obj.get('title', '')}, Tech: {obj.get('tech', [])}",
                'url': obj.get('url', ''),
                'status_code': obj.get('status_code'),
                'title_text': obj.get('title', ''),
            })
        except json.JSONDecodeError:
            findings.append({
                'type': 'http_probe',
                'severity': 'info',
                'title': line.strip()[:200],
                'detail': line.strip(),
            })

    return {
        'tool': 'httpx',
        'findings': findings,
        'summary': {'total_findings': len(findings)},
    }


def parse_masscan(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse Masscan JSON output."""
    findings: List[Dict] = []

    try:
        # Masscan JSON is an array wrapped sometimes with trailing comma
        cleaned = stdout.strip().rstrip(',')
        if cleaned.endswith(',]'):
            cleaned = cleaned[:-2] + ']'
        data = json.loads(cleaned)
        for entry in data:
            ip = entry.get('ip', 'unknown')
            for port_info in entry.get('ports', []):
                port = port_info.get('port', 0)
                proto = port_info.get('proto', 'tcp')
                findings.append({
                    'type': 'open_port',
                    'severity': _assess_port_severity('', port),
                    'title': f"{ip}:{port}/{proto} open",
                    'detail': f"Masscan found port {port}/{proto} open on {ip}",
                    'host': ip,
                    'port': port,
                })
    except json.JSONDecodeError:
        # Text fallback
        port_re = re.compile(r'Discovered open port (\d+)/(tcp|udp) on (\S+)')
        for m in port_re.finditer(stdout):
            port, proto, ip = m.groups()
            findings.append({
                'type': 'open_port',
                'severity': _assess_port_severity('', int(port)),
                'title': f"{ip}:{port}/{proto} open",
                'detail': f"Port {port}/{proto} on {ip}",
                'host': ip,
                'port': int(port),
            })

    return {
        'tool': 'masscan',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


def parse_searchsploit(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """Parse SearchSploit JSON output."""
    findings: List[Dict] = []

    try:
        data = json.loads(stdout)
        for exploit in data.get('RESULTS_EXPLOIT', []):
            findings.append({
                'type': 'exploit',
                'severity': 'high',
                'title': exploit.get('Title', ''),
                'detail': f"Path: {exploit.get('Path', '')}",
                'edb_id': exploit.get('EDB-ID', ''),
                'platform': exploit.get('Platform', ''),
            })
    except json.JSONDecodeError:
        return generic_parse(stdout, stderr)

    return {
        'tool': 'searchsploit',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
        },
    }


# ═══════════════════════════════════════════════
#  JSON PASSTHROUGH (sslyze, exiftool, etc.)
# ═══════════════════════════════════════════════

def parse_json_passthrough(stdout: str, stderr: str = '') -> Dict[str, Any]:
    """For tools that emit clean JSON — pass it through as-is."""
    try:
        data = json.loads(stdout)
        return {
            'tool': 'json_passthrough',
            'data': data,
            'findings': [],
            'summary': {'raw_json': True},
        }
    except json.JSONDecodeError:
        return generic_parse(stdout, stderr)


# ═══════════════════════════════════════════════
#  GENERIC PARSER (Keyword Regex)
# ═══════════════════════════════════════════════

# Keyword → severity mapping
SEVERITY_KEYWORDS = {
    'critical': [
        'critical', 'rce', 'remote code execution', 'backdoor', 'rootkit',
        'arbitrary code', 'unauthenticated', 'zero-day',
    ],
    'high': [
        'high', 'vulnerability', 'vulnerable', 'exploit', 'injection',
        'xss', 'cross-site', 'sql injection', 'traversal', 'overflow',
        'rfi', 'lfi', 'command injection', 'deserialization',
    ],
    'medium': [
        'medium', 'warning', 'misconfiguration', 'weak', 'deprecated',
        'disclosure', 'information leak', 'missing header', 'csrf',
    ],
    'low': [
        'low', 'info', 'informational', 'note', 'notice', 'found',
        'detected', 'server header', 'cookie',
    ],
}


def generic_parse(
    stdout: str,
    stderr: str = '',
    note: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Universal fallback parser.
    Scans output for severity keywords and creates findings.
    """
    findings: List[Dict] = []
    combined = stdout + '\n' + stderr
    lines = combined.split('\n')

    seen_titles: set = set()

    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 5:
            continue

        lower = stripped.lower()
        matched_severity = None

        for severity, keywords in SEVERITY_KEYWORDS.items():
            if any(kw in lower for kw in keywords):
                matched_severity = severity
                break

        if matched_severity:
            title = stripped[:150]
            if title not in seen_titles:
                seen_titles.add(title)
                findings.append({
                    'type': 'generic_finding',
                    'severity': matched_severity,
                    'title': title,
                    'detail': stripped,
                })

    result: Dict[str, Any] = {
        'tool': 'generic',
        'findings': findings,
        'summary': {
            'total_findings': len(findings),
            'severity_counts': _count_severities(findings),
            'output_lines': len(lines),
        },
    }
    if note:
        result['note'] = note

    return result


# ═══════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════

def _count_severities(findings: List[Dict]) -> Dict[str, int]:
    """Count findings by severity level."""
    counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
    for f in findings:
        sev = f.get('severity', 'info')
        if sev in counts:
            counts[sev] += 1
        else:
            counts['info'] += 1
    return counts


# ═══════════════════════════════════════════════
#  CLI TEST
# ═══════════════════════════════════════════════

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage: python parsers.py <tool_slug> [file_path]")
        print("  Reads from file or stdin and parses as the given tool.")
        sys.exit(1)

    tool = sys.argv[1]
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as f:
            data = f.read()
    else:
        data = sys.stdin.read()

    result = auto_parse(tool, data)
    print(json.dumps(result, indent=2, default=str))
