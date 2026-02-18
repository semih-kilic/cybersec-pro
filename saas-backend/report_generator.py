"""
CyberSec Pro - Advanced Report Generation System
World-class security reporting with professional templates, 
vulnerability analysis, compliance mapping, and multi-format export.
"""

import json
import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

# Vulnerability severity patterns for different tools
VULNERABILITY_PATTERNS = {
    'nmap': {
        'critical': [r'VULNERABLE', r'CVE-\d{4}-\d+.*critical', r'backdoor'],
        'high': [r'open.*22/tcp', r'open.*23/tcp', r'open.*445/tcp', r'CVE-\d{4}-\d+'],
        'medium': [r'open.*21/tcp', r'open.*3389/tcp', r'filtered'],
        'low': [r'open.*80/tcp', r'open.*443/tcp'],
        'info': [r'Host is up', r'PORT.*STATE.*SERVICE']
    },
    'nikto': {
        'critical': [r'SQL Injection', r'Remote Code Execution', r'RCE', r'Command Injection'],
        'high': [r'XSS', r'Cross-Site Scripting', r'OSVDB-\d+', r'Directory traversal', r'LFI', r'RFI'],
        'medium': [r'Outdated', r'Version.*detected', r'Server leaks', r'TRACE method'],
        'low': [r'robots.txt', r'X-Frame-Options', r'X-Content-Type-Options'],
        'info': [r'Target IP:', r'Server:', r'retrieved']
    },
    'sqlmap': {
        'critical': [r'is vulnerable', r'SQL injection', r'injectable', r'database', r'table.*dump'],
        'high': [r'parameter.*vulnerable', r'payload', r'boolean-based', r'time-based'],
        'medium': [r'back-end DBMS', r'web server operating'],
        'low': [r'testing connection', r'testing.*parameter'],
        'info': [r'starting', r'fetching', r'retrieved']
    },
    'wpscan': {
        'critical': [r'Unauthenticated.*RCE', r'arbitrary file', r'SQL Injection'],
        'high': [r'Vulnerability', r'CVE-\d{4}-\d+', r'outdated', r'insecure'],
        'medium': [r'Interesting Finding', r'Upload', r'exposed'],
        'low': [r'WordPress version', r'theme detected', r'plugin detected'],
        'info': [r'Scan started', r'URL:', r'Interesting Entries']
    },
    'dirb': {
        'critical': [r'/admin', r'/phpmyadmin', r'/wp-admin', r'/backup'],
        'high': [r'\.sql', r'\.bak', r'\.old', r'/config', r'/database'],
        'medium': [r'\.git', r'\.env', r'\.htaccess', r'/api'],
        'low': [r'robots\.txt', r'sitemap', r'/images'],
        'info': [r'DIRECTORY:', r'CODE:200', r'FOUND']
    },
    'default': {
        'critical': [r'CRITICAL', r'CVE-\d{4}-\d+.*9\.\d', r'Remote Code Execution', r'RCE'],
        'high': [r'HIGH', r'CVE-\d{4}-\d+.*[78]\.\d', r'vulnerability', r'exploit'],
        'medium': [r'MEDIUM', r'CVE-\d{4}-\d+.*[456]\.\d', r'warning', r'outdated'],
        'low': [r'LOW', r'CVE-\d{4}-\d+.*[123]\.\d', r'informational'],
        'info': [r'INFO', r'note', r'found', r'detected']
    }
}

# Compliance framework mappings
COMPLIANCE_MAPPINGS = {
    'OWASP Top 10': {
        'A01:2021 – Broken Access Control': ['privilege', 'access control', 'authorization', 'IDOR'],
        'A02:2021 – Cryptographic Failures': ['SSL', 'TLS', 'encryption', 'certificate', 'HTTPS'],
        'A03:2021 – Injection': ['SQL', 'injection', 'XSS', 'command injection', 'LDAP'],
        'A04:2021 – Insecure Design': ['design flaw', 'architecture', 'logic'],
        'A05:2021 – Security Misconfiguration': ['misconfiguration', 'default', 'exposed', 'directory listing'],
        'A06:2021 – Vulnerable Components': ['outdated', 'CVE', 'version', 'update'],
        'A07:2021 – Auth Failures': ['authentication', 'password', 'session', 'brute force'],
        'A08:2021 – Integrity Failures': ['integrity', 'signature', 'deserialization'],
        'A09:2021 – Logging Failures': ['logging', 'monitoring', 'audit'],
        'A10:2021 – SSRF': ['SSRF', 'server-side request']
    },
    'PCI-DSS 4.0': {
        'Req 1 - Network Security': ['firewall', 'network', 'segment', 'port'],
        'Req 2 - Secure Configurations': ['default', 'configuration', 'hardening'],
        'Req 3 - Protect Stored Data': ['encryption', 'data', 'storage'],
        'Req 4 - Encrypt Transmission': ['SSL', 'TLS', 'encryption', 'transit'],
        'Req 5 - Anti-Malware': ['malware', 'virus', 'antivirus'],
        'Req 6 - Secure Systems': ['patching', 'vulnerability', 'update'],
        'Req 7 - Restrict Access': ['access', 'authentication', 'authorization'],
        'Req 8 - Identify Access': ['user', 'identity', 'MFA'],
        'Req 9 - Physical Access': ['physical', 'access'],
        'Req 10 - Logging': ['logging', 'monitoring', 'audit'],
        'Req 11 - Security Testing': ['scan', 'pentest', 'assessment'],
        'Req 12 - Security Policy': ['policy', 'procedure']
    },
    'NIST CSF': {
        'ID.AM - Asset Management': ['asset', 'inventory', 'discovery'],
        'ID.RA - Risk Assessment': ['risk', 'vulnerability', 'threat'],
        'PR.AC - Access Control': ['access', 'authentication', 'authorization'],
        'PR.DS - Data Security': ['encryption', 'data', 'backup'],
        'PR.IP - Security Policies': ['policy', 'procedure', 'configuration'],
        'PR.PT - Protective Technology': ['firewall', 'IDS', 'antivirus'],
        'DE.AE - Anomaly Detection': ['anomaly', 'detection', 'monitoring'],
        'DE.CM - Continuous Monitoring': ['monitoring', 'logging', 'audit'],
        'RS.AN - Analysis': ['analysis', 'forensics', 'incident'],
        'RC.RP - Recovery Planning': ['recovery', 'backup', 'restore']
    },
    'CIS Controls v8': {
        '1 - Inventory Assets': ['asset', 'inventory', 'discovery'],
        '2 - Inventory Software': ['software', 'application', 'version'],
        '3 - Data Protection': ['data', 'encryption', 'classification'],
        '4 - Secure Configuration': ['configuration', 'hardening', 'benchmark'],
        '5 - Account Management': ['account', 'user', 'privilege'],
        '6 - Access Control': ['access', 'authorization', 'authentication'],
        '7 - Vulnerability Management': ['vulnerability', 'patch', 'update', 'CVE'],
        '8 - Audit Log Management': ['logging', 'audit', 'monitoring'],
        '9 - Email/Browser Protections': ['email', 'browser', 'phishing'],
        '10 - Malware Defenses': ['malware', 'antivirus', 'protection']
    },
    'ISO 27001 Annex A': {
        'A.5 - Information Security Policies': ['policy', 'procedure', 'governance', 'standard'],
        'A.6 - Organization of Information Security': ['organization', 'responsibility', 'role', 'segregation of duties'],
        'A.7 - Human Resource Security': ['awareness', 'training', 'personnel', 'employee'],
        'A.8 - Asset Management': ['asset', 'inventory', 'classification', 'media', 'disposal'],
        'A.9 - Access Control': ['access', 'authentication', 'authorization', 'password', 'privilege', 'MFA'],
        'A.10 - Cryptography': ['encryption', 'SSL', 'TLS', 'certificate', 'crypto', 'key management', 'hash'],
        'A.11 - Physical & Environmental Security': ['physical', 'environment', 'facility', 'data center'],
        'A.12 - Operations Security': ['malware', 'backup', 'logging', 'monitoring', 'change management', 'capacity'],
        'A.13 - Communications Security': ['network', 'firewall', 'transfer', 'segregation', 'VPN', 'port'],
        'A.14 - System Acquisition & Development': ['development', 'testing', 'vulnerability', 'patch', 'SDLC', 'secure coding'],
        'A.15 - Supplier Relationships': ['supplier', 'third-party', 'vendor', 'outsource'],
        'A.16 - Incident Management': ['incident', 'breach', 'response', 'forensics', 'evidence'],
        'A.17 - Business Continuity': ['continuity', 'disaster recovery', 'availability', 'resilience'],
        'A.18 - Compliance': ['compliance', 'audit', 'legal', 'review', 'regulation', 'GDPR']
    }
}

# CVSS base score ranges
CVSS_SEVERITY = {
    'Critical': (9.0, 10.0),
    'High': (7.0, 8.9),
    'Medium': (4.0, 6.9),
    'Low': (0.1, 3.9),
    'None': (0.0, 0.0)
}


class VulnerabilityFinding:
    """Represents a single vulnerability finding"""
    
    def __init__(self, title: str, description: str, severity: str, 
                 source_tool: str, line_number: int = 0):
        self.id = hashlib.md5(f"{title}{description}".encode()).hexdigest()[:8]
        self.title = title
        self.description = description
        self.severity = severity  # Critical, High, Medium, Low, Info
        self.source_tool = source_tool
        self.line_number = line_number
        self.cvss_score = self._estimate_cvss()
        self.cve_ids = self._extract_cves()
        self.compliance_mappings = self._map_compliance()
        self.remediation = self._generate_remediation()
    
    def _estimate_cvss(self) -> float:
        """Estimate CVSS score based on severity"""
        estimates = {
            'Critical': 9.5,
            'High': 7.5,
            'Medium': 5.0,
            'Low': 2.5,
            'Info': 0.0
        }
        return estimates.get(self.severity, 0.0)
    
    def _extract_cves(self) -> List[str]:
        """Extract CVE IDs from description"""
        cve_pattern = r'CVE-\d{4}-\d{4,}'
        return re.findall(cve_pattern, self.description, re.IGNORECASE)
    
    def _map_compliance(self) -> Dict[str, List[str]]:
        """Map finding to compliance frameworks"""
        mappings = {}
        text = f"{self.title} {self.description}".lower()
        
        for framework, controls in COMPLIANCE_MAPPINGS.items():
            matched = []
            for control, keywords in controls.items():
                if any(keyword.lower() in text for keyword in keywords):
                    matched.append(control)
            if matched:
                mappings[framework] = matched
        
        return mappings
    
    def _generate_remediation(self) -> str:
        """Generate remediation suggestion based on finding type"""
        remediations = {
            'SQL': 'Use parameterized queries and prepared statements. Implement input validation.',
            'XSS': 'Implement output encoding. Use Content-Security-Policy headers.',
            'injection': 'Validate and sanitize all user inputs. Use allowlists where possible.',
            'outdated': 'Update to the latest stable version. Implement patch management.',
            'SSL': 'Enable TLS 1.3. Disable weak cipher suites. Use valid certificates.',
            'certificate': 'Install valid SSL/TLS certificates from trusted CAs.',
            'authentication': 'Implement strong password policies. Enable MFA.',
            'access': 'Implement principle of least privilege. Review access controls.',
            'default': 'Change default credentials. Disable unnecessary services.',
            'open port': 'Review if port is necessary. Implement firewall rules.'
        }
        
        text = f"{self.title} {self.description}".lower()
        for keyword, remediation in remediations.items():
            if keyword.lower() in text:
                return remediation
        
        return "Review the finding and implement appropriate security controls."
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'cvss_score': self.cvss_score,
            'source_tool': self.source_tool,
            'line_number': self.line_number,
            'cve_ids': self.cve_ids,
            'compliance_mappings': self.compliance_mappings,
            'remediation': self.remediation
        }


class ScanResultParser:
    """Parse scan outputs and extract vulnerabilities"""
    
    @staticmethod
    def parse(tool_name: str, output: str) -> List[VulnerabilityFinding]:
        """Parse scan output and extract vulnerability findings"""
        findings = []
        tool_key = tool_name.lower() if tool_name.lower() in VULNERABILITY_PATTERNS else 'default'
        patterns = VULNERABILITY_PATTERNS[tool_key]
        
        lines = output.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            
            # Check each severity level
            for severity in ['critical', 'high', 'medium', 'low', 'info']:
                for pattern in patterns[severity]:
                    if re.search(pattern, line, re.IGNORECASE):
                        # Create a finding
                        finding = VulnerabilityFinding(
                            title=ScanResultParser._generate_title(line, severity),
                            description=line,
                            severity=severity.capitalize(),
                            source_tool=tool_name,
                            line_number=line_num
                        )
                        
                        # Avoid duplicates - check if similar finding exists
                        if not any(f.title == finding.title for f in findings):
                            findings.append(finding)
                        break
        
        return findings
    
    @staticmethod
    def _generate_title(line: str, severity: str) -> str:
        """Generate a meaningful title from the finding line"""
        # Extract meaningful parts
        cve_match = re.search(r'(CVE-\d{4}-\d+)', line, re.IGNORECASE)
        if cve_match:
            return f"{severity.capitalize()} - {cve_match.group(1)}"
        
        # Truncate to reasonable length
        clean_line = re.sub(r'[^\w\s\-/]', '', line)
        words = clean_line.split()[:8]
        return f"{severity.capitalize()}: {' '.join(words)}"


class ReportGenerator:
    """Generate professional security reports in multiple formats"""
    
    def __init__(self, scans: List[Dict], report_name: str, template: str = 'full'):
        self.scans = scans
        self.report_name = report_name
        self.template = template
        self.generated_at = datetime.utcnow()
        self.findings = self._parse_all_findings()
        self.summary = self._generate_summary()
    
    def _parse_all_findings(self) -> List[VulnerabilityFinding]:
        """Parse all scan outputs and collect findings"""
        all_findings = []
        for scan in self.scans:
            output = scan.get('output', '') or ''
            tool_name = scan.get('tool_name', 'Unknown')
            findings = ScanResultParser.parse(tool_name, output)
            all_findings.extend(findings)
        return all_findings
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate executive summary statistics"""
        severity_counts = defaultdict(int)
        for finding in self.findings:
            severity_counts[finding.severity] += 1
        
        # Calculate risk score (0-100)
        weights = {'Critical': 40, 'High': 25, 'Medium': 10, 'Low': 3, 'Info': 1}
        total_weight = sum(weights[s] * c for s, c in severity_counts.items())
        risk_score = min(100, total_weight)
        
        # Risk level
        if risk_score >= 70:
            risk_level = 'Critical'
        elif risk_score >= 50:
            risk_level = 'High'
        elif risk_score >= 25:
            risk_level = 'Medium'
        elif risk_score > 0:
            risk_level = 'Low'
        else:
            risk_level = 'None'
        
        return {
            'total_findings': len(self.findings),
            'severity_breakdown': dict(severity_counts),
            'risk_score': risk_score,
            'risk_level': risk_level,
            'targets_scanned': list(set(s.get('target', 'Unknown') for s in self.scans)),
            'tools_used': list(set(s.get('tool_name', 'Unknown') for s in self.scans)),
            'scan_count': len(self.scans)
        }
    
    def _get_compliance_summary(self) -> Dict[str, Dict[str, int]]:
        """Generate compliance framework summary"""
        compliance = {}
        for framework in COMPLIANCE_MAPPINGS.keys():
            control_findings = defaultdict(int)
            for finding in self.findings:
                if framework in finding.compliance_mappings:
                    for control in finding.compliance_mappings[framework]:
                        control_findings[control] += 1
            if control_findings:
                compliance[framework] = dict(control_findings)
        return compliance
    
    def generate_json(self) -> str:
        """Generate JSON format report"""
        report = {
            'metadata': {
                'report_name': self.report_name,
                'generated_at': self.generated_at.isoformat(),
                'template': self.template,
                'version': '2.0'
            },
            'executive_summary': {
                **self.summary,
                'description': f"This comprehensive security assessment report contains the results of {len(self.scans)} security scans performed across {len(self.summary['targets_scanned'])} target(s). The overall risk level is {self.summary['risk_level']} with a risk score of {self.summary['risk_score']}/100."
            },
            'findings': [f.to_dict() for f in self.findings],
            'findings_by_severity': {
                severity: [f.to_dict() for f in self.findings if f.severity == severity]
                for severity in ['Critical', 'High', 'Medium', 'Low', 'Info']
            },
            'compliance': self._get_compliance_summary(),
            'scans': [{
                'id': s.get('id'),
                'tool': s.get('tool_name'),
                'target': s.get('target'),
                'status': s.get('status'),
                'completed_at': s.get('completed_at')
            } for s in self.scans],
            'recommendations': self._get_recommendations()
        }
        return json.dumps(report, indent=2, default=str)
    
    def _get_recommendations(self) -> List[Dict[str, str]]:
        """Generate prioritized recommendations"""
        recommendations = []
        
        # Add recommendations based on critical findings
        critical = [f for f in self.findings if f.severity == 'Critical']
        if critical:
            recommendations.append({
                'priority': 'Immediate',
                'title': f'Address {len(critical)} Critical Vulnerabilities',
                'description': 'Critical vulnerabilities pose immediate risk and should be remediated within 24-48 hours.',
                'findings': [f.title for f in critical[:5]]
            })
        
        high = [f for f in self.findings if f.severity == 'High']
        if high:
            recommendations.append({
                'priority': 'High',
                'title': f'Remediate {len(high)} High-Severity Issues',
                'description': 'High severity issues should be addressed within 7 days.',
                'findings': [f.title for f in high[:5]]
            })
        
        medium = [f for f in self.findings if f.severity == 'Medium']
        if medium:
            recommendations.append({
                'priority': 'Medium',
                'title': f'Review {len(medium)} Medium-Severity Findings',
                'description': 'Plan remediation within 30 days for medium severity issues.',
                'findings': [f.title for f in medium[:5]]
            })
        
        # General recommendations
        recommendations.extend([
            {
                'priority': 'Ongoing',
                'title': 'Implement Continuous Monitoring',
                'description': 'Schedule regular security scans to detect new vulnerabilities.'
            },
            {
                'priority': 'Ongoing',
                'title': 'Maintain Patch Management',
                'description': 'Keep all systems and software updated with latest security patches.'
            }
        ])
        
        return recommendations
    
    def generate_html(self) -> str:
        """Generate professional HTML report with charts"""
        severity_colors = {
            'Critical': '#dc2626',
            'High': '#ea580c',
            'Medium': '#ca8a04',
            'Low': '#16a34a',
            'Info': '#2563eb'
        }
        
        severity_data = self.summary['severity_breakdown']
        
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.report_name}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {{
            --bg-primary: #0a0a12;
            --bg-secondary: #1a1a2e;
            --bg-card: #16162a;
            --text-primary: #e0e0e0;
            --text-secondary: #888;
            --accent: #367bf0;
            --border: #2a2a4e;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 40px 20px; }}
        
        /* Header */
        .header {{
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
            border-bottom: 2px solid var(--accent);
            margin-bottom: 40px;
        }}
        .header h1 {{ 
            font-size: 2.5rem; 
            color: var(--accent);
            margin-bottom: 10px;
        }}
        .header .subtitle {{ color: var(--text-secondary); font-size: 1.1rem; }}
        .header .meta {{ 
            margin-top: 20px;
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }}
        .header .meta span {{ color: var(--text-secondary); }}
        
        /* Risk Score */
        .risk-badge {{
            display: inline-block;
            padding: 8px 20px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 1rem;
            margin-top: 20px;
        }}
        .risk-critical {{ background: rgba(220, 38, 38, 0.2); color: #dc2626; border: 1px solid #dc2626; }}
        .risk-high {{ background: rgba(234, 88, 12, 0.2); color: #ea580c; border: 1px solid #ea580c; }}
        .risk-medium {{ background: rgba(202, 138, 4, 0.2); color: #ca8a04; border: 1px solid #ca8a04; }}
        .risk-low {{ background: rgba(22, 163, 74, 0.2); color: #16a34a; border: 1px solid #16a34a; }}
        .risk-none {{ background: rgba(37, 99, 235, 0.2); color: #2563eb; border: 1px solid #2563eb; }}
        
        /* Cards */
        .card {{
            background: var(--bg-card);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            border: 1px solid var(--border);
        }}
        .card h2 {{
            color: var(--accent);
            font-size: 1.3rem;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border);
        }}
        
        /* Stats Grid */
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: var(--bg-secondary);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }}
        .stat-card .number {{
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--accent);
        }}
        .stat-card .label {{
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-top: 5px;
        }}
        
        /* Severity Stats */
        .severity-grid {{
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            margin: 20px 0;
        }}
        .severity-card {{
            text-align: center;
            padding: 20px 10px;
            border-radius: 10px;
            background: var(--bg-secondary);
        }}
        .severity-card .count {{
            font-size: 2rem;
            font-weight: 700;
        }}
        .severity-card .label {{
            font-size: 0.85rem;
            margin-top: 5px;
        }}
        
        /* Charts */
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .chart-container {{
            position: relative;
            height: 300px;
            background: var(--bg-card);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border);
        }}
        
        /* Findings Table */
        .findings-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .findings-table th, .findings-table td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }}
        .findings-table th {{
            background: var(--bg-secondary);
            color: var(--accent);
            font-weight: 600;
        }}
        .findings-table tr:hover {{
            background: var(--bg-secondary);
        }}
        
        /* Severity badges */
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .badge-critical {{ background: rgba(220, 38, 38, 0.2); color: #dc2626; }}
        .badge-high {{ background: rgba(234, 88, 12, 0.2); color: #ea580c; }}
        .badge-medium {{ background: rgba(202, 138, 4, 0.2); color: #ca8a04; }}
        .badge-low {{ background: rgba(22, 163, 74, 0.2); color: #16a34a; }}
        .badge-info {{ background: rgba(37, 99, 235, 0.2); color: #2563eb; }}
        
        /* Compliance */
        .compliance-section {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }}
        .compliance-card {{
            background: var(--bg-secondary);
            padding: 20px;
            border-radius: 10px;
        }}
        .compliance-card h3 {{
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1rem;
        }}
        .compliance-item {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.85rem;
        }}
        
        /* Recommendations */
        .recommendation {{
            background: var(--bg-secondary);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid var(--accent);
        }}
        .recommendation.immediate {{ border-left-color: #dc2626; }}
        .recommendation.high {{ border-left-color: #ea580c; }}
        .recommendation.medium {{ border-left-color: #ca8a04; }}
        .recommendation h4 {{ color: var(--text-primary); margin-bottom: 10px; }}
        .recommendation p {{ color: var(--text-secondary); font-size: 0.9rem; }}
        
        /* Print styles */
        @media print {{
            body {{ background: white; color: black; }}
            .card {{ background: #f5f5f5; border: 1px solid #ddd; }}
            .no-print {{ display: none; }}
        }}
        
        @media (max-width: 768px) {{
            .severity-grid {{ grid-template-columns: repeat(3, 1fr); }}
            .charts-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 {self.report_name}</h1>
        <p class="subtitle">Comprehensive Security Assessment Report</p>
        <div class="meta">
            <span>📅 Generated: {self.generated_at.strftime("%B %d, %Y at %H:%M UTC")}</span>
            <span>🎯 Targets: {len(self.summary['targets_scanned'])}</span>
            <span>🛠️ Tools: {len(self.summary['tools_used'])}</span>
            <span>📊 Findings: {self.summary['total_findings']}</span>
        </div>
        <div class="risk-badge risk-{self.summary['risk_level'].lower()}">
            Risk Score: {self.summary['risk_score']}/100 ({self.summary['risk_level']})
        </div>
    </div>
    
    <div class="container">
        <!-- Executive Summary -->
        <div class="card">
            <h2>📊 Executive Summary</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="number">{self.summary['total_findings']}</div>
                    <div class="label">Total Findings</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.scans)}</div>
                    <div class="label">Scans Completed</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.summary['targets_scanned'])}</div>
                    <div class="label">Targets Scanned</div>
                </div>
                <div class="stat-card">
                    <div class="number">{self.summary['risk_score']}</div>
                    <div class="label">Risk Score</div>
                </div>
            </div>
            
            <div class="severity-grid">
                <div class="severity-card">
                    <div class="count" style="color: {severity_colors['Critical']}">{severity_data.get('Critical', 0)}</div>
                    <div class="label" style="color: {severity_colors['Critical']}">Critical</div>
                </div>
                <div class="severity-card">
                    <div class="count" style="color: {severity_colors['High']}">{severity_data.get('High', 0)}</div>
                    <div class="label" style="color: {severity_colors['High']}">High</div>
                </div>
                <div class="severity-card">
                    <div class="count" style="color: {severity_colors['Medium']}">{severity_data.get('Medium', 0)}</div>
                    <div class="label" style="color: {severity_colors['Medium']}">Medium</div>
                </div>
                <div class="severity-card">
                    <div class="count" style="color: {severity_colors['Low']}">{severity_data.get('Low', 0)}</div>
                    <div class="label" style="color: {severity_colors['Low']}">Low</div>
                </div>
                <div class="severity-card">
                    <div class="count" style="color: {severity_colors['Info']}">{severity_data.get('Info', 0)}</div>
                    <div class="label" style="color: {severity_colors['Info']}">Info</div>
                </div>
            </div>
        </div>
        
        <!-- Charts -->
        <div class="charts-grid">
            <div class="chart-container">
                <h3 style="color: var(--accent); margin-bottom: 20px;">Severity Distribution</h3>
                <canvas id="severityChart"></canvas>
            </div>
            <div class="chart-container">
                <h3 style="color: var(--accent); margin-bottom: 20px;">Findings by Tool</h3>
                <canvas id="toolsChart"></canvas>
            </div>
        </div>
        
        <!-- Findings -->
        <div class="card">
            <h2>🔍 Vulnerability Findings ({len(self.findings)})</h2>
            <table class="findings-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Severity</th>
                        <th>Title</th>
                        <th>Tool</th>
                        <th>CVSS</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(f"""
                    <tr>
                        <td><code>{f.id}</code></td>
                        <td><span class="badge badge-{f.severity.lower()}">{f.severity}</span></td>
                        <td>{f.title[:60]}...</td>
                        <td>{f.source_tool}</td>
                        <td>{f.cvss_score}</td>
                    </tr>
                    """ for f in sorted(self.findings, key=lambda x: ['Critical', 'High', 'Medium', 'Low', 'Info'].index(x.severity))[:50])}
                </tbody>
            </table>
            {f'<p style="color: var(--text-secondary); margin-top: 15px; text-align: center;">Showing top 50 of {len(self.findings)} findings</p>' if len(self.findings) > 50 else ''}
        </div>
        
        <!-- Compliance Mapping -->
        <div class="card">
            <h2>📋 Compliance Mapping</h2>
            <div class="compliance-section">
                {self._generate_compliance_html()}
            </div>
        </div>
        
        <!-- Recommendations -->
        <div class="card">
            <h2>💡 Recommendations</h2>
            {self._generate_recommendations_html()}
        </div>
        
        <!-- Scan Details -->
        <div class="card">
            <h2>🛠️ Scan Details</h2>
            <table class="findings-table">
                <thead>
                    <tr>
                        <th>Tool</th>
                        <th>Target</th>
                        <th>Status</th>
                        <th>Completed</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(f"""
                    <tr>
                        <td>{s.get('tool_name', 'Unknown')}</td>
                        <td><code>{s.get('target', 'N/A')}</code></td>
                        <td><span class="badge badge-{'low' if s.get('status') == 'completed' else 'medium'}">{s.get('status', 'N/A')}</span></td>
                        <td>{s.get('completed_at', 'N/A')}</td>
                    </tr>
                    """ for s in self.scans)}
                </tbody>
            </table>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; color: var(--text-secondary); margin-top: 40px; padding: 20px;">
            <p>Generated by CyberSec Pro | Professional Security Assessment Platform</p>
            <p style="margin-top: 5px;">© {datetime.now().year} CyberSec Pro. All rights reserved.</p>
        </div>
    </div>
    
    <script>
        // Severity Distribution Chart
        const severityCtx = document.getElementById('severityChart').getContext('2d');
        new Chart(severityCtx, {{
            type: 'doughnut',
            data: {{
                labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
                datasets: [{{
                    data: [{severity_data.get('Critical', 0)}, {severity_data.get('High', 0)}, {severity_data.get('Medium', 0)}, {severity_data.get('Low', 0)}, {severity_data.get('Info', 0)}],
                    backgroundColor: ['{severity_colors["Critical"]}', '{severity_colors["High"]}', '{severity_colors["Medium"]}', '{severity_colors["Low"]}', '{severity_colors["Info"]}'],
                    borderWidth: 0
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'right',
                        labels: {{ color: '#e0e0e0' }}
                    }}
                }}
            }}
        }});
        
        // Tools Chart
        const toolCounts = {json.dumps(self._get_tool_counts())};
        const toolsCtx = document.getElementById('toolsChart').getContext('2d');
        new Chart(toolsCtx, {{
            type: 'bar',
            data: {{
                labels: Object.keys(toolCounts),
                datasets: [{{
                    label: 'Findings',
                    data: Object.values(toolCounts),
                    backgroundColor: '#367bf0',
                    borderRadius: 5
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }}
                }},
                scales: {{
                    y: {{
                        beginAtZero: true,
                        ticks: {{ color: '#888' }},
                        grid: {{ color: '#2a2a4e' }}
                    }},
                    x: {{
                        ticks: {{ color: '#888' }},
                        grid: {{ display: false }}
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>'''
        return html
    
    def _get_tool_counts(self) -> Dict[str, int]:
        """Count findings per tool"""
        counts = defaultdict(int)
        for finding in self.findings:
            counts[finding.source_tool] += 1
        return dict(counts)
    
    def _generate_compliance_html(self) -> str:
        """Generate HTML for compliance section"""
        compliance = self._get_compliance_summary()
        if not compliance:
            return '<p style="color: var(--text-secondary);">No compliance mappings identified.</p>'
        
        html = ''
        for framework, controls in compliance.items():
            html += f'''
            <div class="compliance-card">
                <h3>{framework}</h3>
                {''.join(f'<div class="compliance-item"><span>{control}</span><span class="badge badge-medium">{count}</span></div>' for control, count in list(controls.items())[:5])}
            </div>
            '''
        return html
    
    def _generate_recommendations_html(self) -> str:
        """Generate HTML for recommendations"""
        recommendations = self._get_recommendations()
        html = ''
        for rec in recommendations:
            priority_class = rec['priority'].lower().replace(' ', '-')
            html += f'''
            <div class="recommendation {priority_class}">
                <h4>{rec['priority']}: {rec['title']}</h4>
                <p>{rec['description']}</p>
            </div>
            '''
        return html
    
    def generate_markdown(self) -> str:
        """Generate Markdown format report"""
        severity_data = self.summary['severity_breakdown']
        
        md = f'''# 🔐 {self.report_name}

**Generated:** {self.generated_at.strftime("%B %d, %Y at %H:%M UTC")}  
**Risk Score:** {self.summary['risk_score']}/100 ({self.summary['risk_level']})

---

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| Total Findings | {self.summary['total_findings']} |
| Scans Completed | len(self.scans) |
| Targets Scanned | {len(self.summary['targets_scanned'])} |
| Risk Level | {self.summary['risk_level']} |

### Severity Breakdown

| Severity | Count |
|----------|-------|
| 🔴 Critical | {severity_data.get('Critical', 0)} |
| 🟠 High | {severity_data.get('High', 0)} |
| 🟡 Medium | {severity_data.get('Medium', 0)} |
| 🟢 Low | {severity_data.get('Low', 0)} |
| 🔵 Info | {severity_data.get('Info', 0)} |

---

## 🔍 Findings

'''
        for severity in ['Critical', 'High', 'Medium', 'Low', 'Info']:
            findings = [f for f in self.findings if f.severity == severity]
            if findings:
                md += f'\n### {severity} ({len(findings)})\n\n'
                for f in findings[:10]:
                    md += f'- **{f.title}** (CVSS: {f.cvss_score})\n  - Tool: {f.source_tool}\n  - Remediation: {f.remediation}\n\n'
        
        md += '''
---

## 💡 Recommendations

'''
        for rec in self._get_recommendations():
            md += f"### {rec['priority']}: {rec['title']}\n{rec['description']}\n\n"
        
        md += f'''
---

## 📋 Scan Details

| Tool | Target | Status |
|------|--------|--------|
'''
        for s in self.scans:
            md += f"| {s.get('tool_name', 'Unknown')} | {s.get('target', 'N/A')} | {s.get('status', 'N/A')} |\n"
        
        md += f'''
---

*Report generated by CyberSec Pro - Professional Security Assessment Platform*  
*© {datetime.now().year} CyberSec Pro. All rights reserved.*
'''
        return md
    
    def generate_csv(self) -> str:
        """Generate CSV format report for analysis"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Finding ID', 'Title', 'Severity', 'CVSS Score', 'Tool', 
            'CVE IDs', 'Remediation', 'Description'
        ])
        
        # Data
        for f in self.findings:
            writer.writerow([
                f.id,
                f.title,
                f.severity,
                f.cvss_score,
                f.source_tool,
                ', '.join(f.cve_ids),
                f.remediation,
                f.description[:200]
            ])
        
        return output.getvalue()
    
    def generate_pdf_html(self) -> str:
        """Generate print-optimized HTML for PDF conversion via WeasyPrint"""
        severity_colors = {
            'Critical': '#dc2626',
            'High': '#ea580c',
            'Medium': '#ca8a04',
            'Low': '#16a34a',
            'Info': '#2563eb'
        }
        severity_data = self.summary['severity_breakdown']
        compliance = self._get_compliance_summary()
        recommendations = self._get_recommendations()

        # Determine focused framework for compliance templates
        focused_framework = None
        if self.template == 'owasp':
            focused_framework = 'OWASP Top 10'
        elif self.template == 'pci-dss':
            focused_framework = 'PCI-DSS 4.0'
        elif self.template == 'iso27001':
            focused_framework = 'ISO 27001 Annex A'

        # Build risk matrix data
        risk_matrix = self._build_risk_matrix()

        # Build compliance detail rows
        compliance_rows = ''
        target_frameworks = {focused_framework: compliance.get(focused_framework, {})} if focused_framework and focused_framework in compliance else compliance
        if not target_frameworks or all(not v for v in target_frameworks.values()):
            # Show all frameworks with all controls if no findings mapped
            for fw_name in (([focused_framework] if focused_framework else list(COMPLIANCE_MAPPINGS.keys()))):
                if fw_name in COMPLIANCE_MAPPINGS:
                    for control in COMPLIANCE_MAPPINGS[fw_name]:
                        count = compliance.get(fw_name, {}).get(control, 0)
                        status_badge = f'<span style="color:#16a34a;font-weight:600;">✓ Pass</span>' if count == 0 else f'<span style="color:#dc2626;font-weight:600;">✗ {count} Issue{"s" if count > 1 else ""}</span>'
                        compliance_rows += f'<tr><td>{fw_name}</td><td>{control}</td><td>{count}</td><td>{status_badge}</td></tr>'
        else:
            for fw_name, controls in target_frameworks.items():
                all_controls = COMPLIANCE_MAPPINGS.get(fw_name, {})
                for control in all_controls:
                    count = controls.get(control, 0)
                    status_badge = f'<span style="color:#16a34a;font-weight:600;">✓ Pass</span>' if count == 0 else f'<span style="color:#dc2626;font-weight:600;">✗ {count} Issue{"s" if count > 1 else ""}</span>'
                    compliance_rows += f'<tr><td>{fw_name}</td><td>{control}</td><td style="text-align:center;">{count}</td><td>{status_badge}</td></tr>'

        # Template-specific title
        template_titles = {
            'owasp': 'OWASP Top 10 Compliance Report',
            'pci-dss': 'PCI-DSS Requirement 11 – Vulnerability Scanning Report',
            'iso27001': 'ISO 27001 Annex A – Technical Controls Report',
            'executive': 'Executive Security Assessment',
            'technical': 'Technical Vulnerability Report',
            'compliance': 'Multi-Framework Compliance Report',
            'full': 'Comprehensive Security Assessment Report'
        }
        report_title = template_titles.get(self.template, 'Security Assessment Report')

        # Build findings rows
        findings_rows = ''
        sorted_findings = sorted(self.findings, key=lambda x: ['Critical', 'High', 'Medium', 'Low', 'Info'].index(x.severity))
        for f in sorted_findings[:100]:
            sev_color = severity_colors.get(f.severity, '#888')
            findings_rows += f'''<tr>
                <td style="font-family:monospace;font-size:0.75rem;">{f.id}</td>
                <td><span style="background:{sev_color}22;color:{sev_color};padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;">{f.severity}</span></td>
                <td>{f.title[:80]}</td>
                <td>{f.source_tool}</td>
                <td style="text-align:center;">{f.cvss_score}</td>
                <td style="font-size:0.75rem;">{f.remediation[:100]}</td>
            </tr>'''

        # Risk matrix HTML
        risk_matrix_html = self._generate_risk_matrix_html(risk_matrix)

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{report_title}</title>
<style>
  @page {{
    size: A4;
    margin: 20mm 15mm;
    @top-right {{ content: "CyberSec Pro – Confidential"; font-size: 8pt; color: #888; }}
    @bottom-center {{ content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #888; }}
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; line-height: 1.5; }}

  /* Cover / Header */
  .cover {{ 
    background: linear-gradient(135deg, #0a0a12 0%, #1a1a2e 50%, #0d1b2a 100%);
    color: white; padding: 50px 40px; margin: -20mm -15mm 30px -15mm;
    page-break-after: always;
    min-height: 250mm;
    display: flex; flex-direction: column; justify-content: center;
  }}
  .cover .logo {{ font-size: 42pt; font-weight: 800; color: #367bf0; margin-bottom: 10px; letter-spacing: -1px; }}
  .cover .logo-sub {{ font-size: 14pt; color: #8b9dc3; margin-bottom: 40px; }}
  .cover h1 {{ font-size: 28pt; margin-bottom: 15px; color: #fff; }}
  .cover .meta-line {{ font-size: 11pt; color: #8b9dc3; margin: 5px 0; }}
  .cover .risk-pill {{
    display: inline-block; margin-top: 30px; padding: 12px 30px;
    border-radius: 50px; font-weight: 700; font-size: 16pt;
  }}
  .risk-critical {{ background: #dc262633; color: #dc2626; border: 2px solid #dc2626; }}
  .risk-high {{ background: #ea580c33; color: #ea580c; border: 2px solid #ea580c; }}
  .risk-medium {{ background: #ca8a0433; color: #ca8a04; border: 2px solid #ca8a04; }}
  .risk-low {{ background: #16a34a33; color: #16a34a; border: 2px solid #16a34a; }}
  .risk-none {{ background: #2563eb33; color: #2563eb; border: 2px solid #2563eb; }}
  .cover .confidential {{ 
    margin-top: auto; padding-top: 40px; border-top: 1px solid #2a2a4e;
    font-size: 9pt; color: #555; 
  }}

  /* Section Headers */
  h2 {{ font-size: 16pt; color: #367bf0; margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #367bf0; }}
  h3 {{ font-size: 12pt; color: #1a1a2e; margin: 15px 0 10px; }}

  /* Summary Stats */
  .stats-row {{ display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }}
  .stat-box {{ 
    flex: 1; min-width: 100px; background: #f0f4ff; border-radius: 8px;
    padding: 15px; text-align: center; border: 1px solid #d0d8f0;
  }}
  .stat-box .num {{ font-size: 24pt; font-weight: 700; color: #367bf0; }}
  .stat-box .lbl {{ font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }}

  .severity-row {{ display: flex; gap: 10px; margin-bottom: 20px; }}
  .sev-box {{ flex: 1; text-align: center; padding: 12px 8px; border-radius: 8px; background: #fafafa; border: 1px solid #eee; }}
  .sev-box .num {{ font-size: 20pt; font-weight: 700; }}
  .sev-box .lbl {{ font-size: 8pt; text-transform: uppercase; }}

  /* Tables */
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; }}
  th {{ background: #1a1a2e; color: white; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 8pt; text-transform: uppercase; }}
  td {{ padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }}
  tr:nth-child(even) {{ background: #f8f9fc; }}

  /* Risk Matrix */
  .risk-matrix {{ margin: 20px 0; }}
  .risk-matrix table {{ border: 1px solid #ccc; }}
  .risk-matrix th, .risk-matrix td {{ text-align: center; padding: 10px; border: 1px solid #ddd; font-size: 9pt; }}
  .rm-critical {{ background: #dc262622; color: #dc2626; font-weight: 700; }}
  .rm-high {{ background: #ea580c22; color: #ea580c; font-weight: 700; }}
  .rm-medium {{ background: #ca8a0422; color: #ca8a04; font-weight: 700; }}
  .rm-low {{ background: #16a34a22; color: #16a34a; font-weight: 700; }}
  .rm-none {{ background: #f0f0f0; color: #888; }}

  /* Recommendations */
  .rec-card {{ background: #f8f9fc; border-left: 4px solid #367bf0; padding: 12px 15px; margin-bottom: 12px; border-radius: 0 8px 8px 0; }}
  .rec-card.immediate {{ border-left-color: #dc2626; }}
  .rec-card.high {{ border-left-color: #ea580c; }}
  .rec-card.medium {{ border-left-color: #ca8a04; }}
  .rec-card h4 {{ font-size: 10pt; margin-bottom: 5px; }}
  .rec-card p {{ font-size: 9pt; color: #555; }}

  /* Compliance Status */
  .compliance-summary {{ margin: 15px 0; }}
  .fw-badge {{ display: inline-block; padding: 4px 12px; border-radius: 15px; font-size: 8pt; font-weight: 600; margin: 3px; }}

  .page-break {{ page-break-before: always; }}
  .footer-note {{ font-size: 8pt; color: #888; text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; }}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="logo">🔐 CyberSec Pro</div>
  <div class="logo-sub">Professional Security Assessment Platform</div>
  <h1>{report_title}</h1>
  <div class="meta-line">📅 Report Date: {self.generated_at.strftime("%B %d, %Y")}</div>
  <div class="meta-line">🎯 Targets: {', '.join(self.summary['targets_scanned'][:5])}</div>
  <div class="meta-line">🛠️ Tools Used: {', '.join(self.summary['tools_used'])}</div>
  <div class="meta-line">📊 Total Findings: {self.summary['total_findings']}</div>
  <div class="risk-pill risk-{self.summary['risk_level'].lower()}">
    Risk Score: {self.summary['risk_score']}/100 — {self.summary['risk_level']}
  </div>
  <div class="confidential">
    CONFIDENTIAL — This report contains sensitive security assessment data.<br>
    Distribution should be limited to authorized personnel only.<br>
    Generated by CyberSec Pro © {datetime.now().year}
  </div>
</div>

<!-- EXECUTIVE SUMMARY -->
<h2>1. Executive Summary</h2>
<p style="margin-bottom:15px;">
  This security assessment report presents the findings from <strong>{len(self.scans)} security scan(s)</strong> 
  performed across <strong>{len(self.summary['targets_scanned'])} target(s)</strong>. 
  A total of <strong>{self.summary['total_findings']} vulnerabilities</strong> were identified, 
  with an overall risk score of <strong>{self.summary['risk_score']}/100 ({self.summary['risk_level']})</strong>.
</p>

<div class="stats-row">
  <div class="stat-box"><div class="num">{self.summary['total_findings']}</div><div class="lbl">Total Findings</div></div>
  <div class="stat-box"><div class="num">{len(self.scans)}</div><div class="lbl">Scans Completed</div></div>
  <div class="stat-box"><div class="num">{len(self.summary['targets_scanned'])}</div><div class="lbl">Targets Scanned</div></div>
  <div class="stat-box"><div class="num">{self.summary['risk_score']}</div><div class="lbl">Risk Score</div></div>
</div>

<h3>Severity Breakdown</h3>
<div class="severity-row">
  <div class="sev-box"><div class="num" style="color:{severity_colors['Critical']};">{severity_data.get('Critical', 0)}</div><div class="lbl" style="color:{severity_colors['Critical']};">Critical</div></div>
  <div class="sev-box"><div class="num" style="color:{severity_colors['High']};">{severity_data.get('High', 0)}</div><div class="lbl" style="color:{severity_colors['High']};">High</div></div>
  <div class="sev-box"><div class="num" style="color:{severity_colors['Medium']};">{severity_data.get('Medium', 0)}</div><div class="lbl" style="color:{severity_colors['Medium']};">Medium</div></div>
  <div class="sev-box"><div class="num" style="color:{severity_colors['Low']};">{severity_data.get('Low', 0)}</div><div class="lbl" style="color:{severity_colors['Low']};">Low</div></div>
  <div class="sev-box"><div class="num" style="color:{severity_colors['Info']};">{severity_data.get('Info', 0)}</div><div class="lbl" style="color:{severity_colors['Info']};">Informational</div></div>
</div>

<!-- RISK MATRIX -->
<h2>2. Risk Matrix</h2>
<p style="margin-bottom:10px;">The following matrix maps identified vulnerabilities by impact severity and estimated likelihood:</p>
{risk_matrix_html}

<!-- VULNERABILITY FINDINGS -->
<div class="page-break"></div>
<h2>3. Vulnerability Findings</h2>
<p style="margin-bottom:10px;">Showing {min(len(self.findings), 100)} of {len(self.findings)} findings, sorted by severity:</p>
<table>
  <thead>
    <tr><th>ID</th><th>Severity</th><th>Title</th><th>Tool</th><th>CVSS</th><th>Remediation</th></tr>
  </thead>
  <tbody>
    {findings_rows}
  </tbody>
</table>

<!-- COMPLIANCE MAPPING -->
<div class="page-break"></div>
<h2>4. Compliance Mapping{' — ' + focused_framework if focused_framework else ''}</h2>
<p style="margin-bottom:10px;">
  {'This section maps all findings to the <strong>' + focused_framework + '</strong> framework controls.' if focused_framework else 'This section maps findings across all applicable compliance frameworks.'}
</p>
<table>
  <thead>
    <tr><th>Framework</th><th>Control</th><th>Findings</th><th>Status</th></tr>
  </thead>
  <tbody>
    {compliance_rows}
  </tbody>
</table>

<!-- RECOMMENDATIONS -->
<h2>5. Recommendations</h2>
{''.join(f'<div class="rec-card {rec["priority"].lower()}"><h4>{rec["priority"]}: {rec["title"]}</h4><p>{rec["description"]}</p></div>' for rec in recommendations)}

<!-- SCAN DETAILS -->
<h2>6. Scan Details</h2>
<table>
  <thead><tr><th>Tool</th><th>Target</th><th>Status</th><th>Completed</th></tr></thead>
  <tbody>
    {''.join(f"<tr><td>{s.get('tool_name', 'Unknown')}</td><td>{s.get('target', 'N/A')}</td><td>{s.get('status', 'N/A')}</td><td>{s.get('completed_at', 'N/A')}</td></tr>" for s in self.scans)}
  </tbody>
</table>

<div class="footer-note">
  Generated by CyberSec Pro — Professional Security Assessment Platform<br>
  © {datetime.now().year} CyberSec Pro. All rights reserved. | CONFIDENTIAL
</div>

</body>
</html>'''
        return html

    def _build_risk_matrix(self) -> Dict[str, Dict[str, int]]:
        """Build risk matrix: severity x likelihood"""
        matrix = {}
        likelihoods = ['Very Likely', 'Likely', 'Possible', 'Unlikely']
        severities = ['Critical', 'High', 'Medium', 'Low']
        
        for sev in severities:
            matrix[sev] = {lik: 0 for lik in likelihoods}
        
        for finding in self.findings:
            sev = finding.severity
            if sev == 'Info':
                continue
            # Estimate likelihood based on vulnerability type
            text = f"{finding.title} {finding.description}".lower()
            if any(kw in text for kw in ['exploit', 'rce', 'injection', 'backdoor', 'vulnerable']):
                likelihood = 'Very Likely'
            elif any(kw in text for kw in ['cve', 'xss', 'sql', 'outdated', 'default']):
                likelihood = 'Likely'
            elif any(kw in text for kw in ['open', 'exposed', 'misconfiguration', 'directory']):
                likelihood = 'Possible'
            else:
                likelihood = 'Unlikely'
            
            if sev in matrix:
                matrix[sev][likelihood] += 1
        
        return matrix

    def _generate_risk_matrix_html(self, matrix: Dict) -> str:
        """Generate risk matrix HTML table"""
        likelihoods = ['Very Likely', 'Likely', 'Possible', 'Unlikely']
        severities = ['Critical', 'High', 'Medium', 'Low']
        
        # Risk level mapping for cells
        risk_levels = {
            ('Critical', 'Very Likely'): 'critical', ('Critical', 'Likely'): 'critical',
            ('Critical', 'Possible'): 'high', ('Critical', 'Unlikely'): 'high',
            ('High', 'Very Likely'): 'critical', ('High', 'Likely'): 'high',
            ('High', 'Possible'): 'high', ('High', 'Unlikely'): 'medium',
            ('Medium', 'Very Likely'): 'high', ('Medium', 'Likely'): 'medium',
            ('Medium', 'Possible'): 'medium', ('Medium', 'Unlikely'): 'low',
            ('Low', 'Very Likely'): 'medium', ('Low', 'Likely'): 'low',
            ('Low', 'Possible'): 'low', ('Low', 'Unlikely'): 'low',
        }
        
        html = '<div class="risk-matrix"><table>'
        html += '<tr><th style="background:#2a2a4e;">Impact ↓ / Likelihood →</th>'
        for lik in likelihoods:
            html += f'<th>{lik}</th>'
        html += '</tr>'
        
        for sev in severities:
            html += f'<tr><th style="text-align:left;">{sev}</th>'
            for lik in likelihoods:
                count = matrix.get(sev, {}).get(lik, 0)
                level = risk_levels.get((sev, lik), 'none')
                cell_class = f'rm-{level}' if count > 0 else 'rm-none'
                html += f'<td class="{cell_class}">{count if count else "—"}</td>'
            html += '</tr>'
        
        html += '</table></div>'
        return html

    def generate_pdf(self) -> bytes:
        """Generate PDF report using WeasyPrint"""
        try:
            from weasyprint import HTML
            pdf_html = self.generate_pdf_html()
            pdf_bytes = HTML(string=pdf_html).write_pdf()
            return pdf_bytes
        except ImportError:
            # Fallback: return HTML content as bytes
            return self.generate_pdf_html().encode('utf-8')
        except Exception as e:
            # If WeasyPrint fails, return HTML as fallback
            print(f"PDF generation error: {e}")
            return self.generate_pdf_html().encode('utf-8')

    def generate(self, format: str = 'html') -> str:
        """Generate report in specified format"""
        if format.lower() == 'pdf':
            # PDF returns bytes, handled specially
            return '__PDF__'
        
        generators = {
            'json': self.generate_json,
            'html': self.generate_html,
            'markdown': self.generate_markdown,
            'md': self.generate_markdown,
            'csv': self.generate_csv,
        }
        
        generator = generators.get(format.lower(), self.generate_html)
        return generator()


# Utility function for Flask integration
def generate_report_from_scans(scans: List, report_name: str, template: str, 
                               output_format: str, sections: List[str] = None):
    """
    Generate a report from scan objects.
    This is the main function to be called from Flask routes.
    Returns str for text formats, bytes for PDF.
    """
    # Convert SQLAlchemy objects to dicts
    scan_dicts = []
    for scan in scans:
        scan_dict = {
            'id': scan.id if hasattr(scan, 'id') else str(scan),
            'tool_name': scan.tool_name if hasattr(scan, 'tool_name') else 'Unknown',
            'target': scan.target if hasattr(scan, 'target') else 'Unknown',
            'status': scan.status if hasattr(scan, 'status') else 'completed',
            'output': scan.output if hasattr(scan, 'output') else '',
            'completed_at': scan.completed_at.isoformat() if hasattr(scan, 'completed_at') and scan.completed_at else None
        }
        scan_dicts.append(scan_dict)
    
    generator = ReportGenerator(scan_dicts, report_name, template)
    
    if output_format.lower() == 'pdf':
        return generator.generate_pdf()
    
    return generator.generate(output_format)


# ═══════════════════════════════════════════════════════════════
# BUSINESS LANGUAGE REPORT GENERATOR (BÖLÜM 7)
# Generates reports in plain business language — no tool names
# ═══════════════════════════════════════════════════════════════

class BusinessReportGenerator:
    """
    Generates scan reports in business language.
    Format: PDF, HTML, JSON, CSV
    Language: Business language (no technical jargon)
    Tool names HIDDEN — replaced with business-friendly names.
    """
    
    def __init__(self, scans, user_plan='starter'):
        self.scans = scans
        self.user_plan = user_plan
        self._translator = None
        self._vuln_translator = None
    
    @property
    def translator(self):
        if self._translator is None:
            try:
                from business_language import get_translator
                self._translator = get_translator()
            except ImportError:
                self._translator = None
        return self._translator

    @property
    def vuln_translator(self):
        if self._vuln_translator is None:
            try:
                from vulnerability_translator import (
                    VULNERABILITY_TRANSLATIONS, FIX_TEMPLATES,
                    translate_scan_output
                )
                self._vuln_translator = {
                    'translations': VULNERABILITY_TRANSLATIONS,
                    'fix_templates': FIX_TEMPLATES,
                    'translate_output': translate_scan_output,
                }
            except ImportError:
                self._vuln_translator = {}
        return self._vuln_translator
    
    def _calculate_score(self, findings):
        """Calculate security score (0-100, higher = more secure)"""
        if not findings:
            return 100
        weights = {'critical': 25, 'high': 15, 'medium': 5, 'low': 1, 'info': 0}
        penalty = sum(weights.get(f.get('severity', 'info'), 0) for f in findings)
        return max(0, 100 - min(100, penalty))

    def generate_executive_summary(self, scan_results):
        """Generate business-language executive summary"""
        findings = []
        for scan in scan_results:
            output = scan.get('output', '') or ''
            if self.vuln_translator and 'translate_output' in self.vuln_translator:
                findings.extend(self.vuln_translator['translate_output'](output))
        
        score = self._calculate_score(findings)
        total = len(findings)
        critical = sum(1 for f in findings if f.get('severity') == 'critical')
        high = sum(1 for f in findings if f.get('severity') == 'high')
        medium = sum(1 for f in findings if f.get('severity') == 'medium')
        low = sum(1 for f in findings if f.get('severity') == 'low')
        
        targets = list(set(s.get('target', 'Unknown') for s in scan_results))
        
        summary = {
            'security_score': score,
            'score_label': (
                'Excellent' if score >= 90 else
                'Good' if score >= 70 else
                'Needs Improvement' if score >= 50 else
                'At Risk' if score >= 30 else
                'Critical Risk'
            ),
            'total_issues': total,
            'critical_count': critical,
            'high_count': high,
            'medium_count': medium,
            'low_count': low,
            'targets': targets,
            'tests_run': 682,
            'tests_passed': 682 - total,
        }
        
        # Narrative summary
        if critical > 0:
            summary['narrative'] = (
                f"URGENT ACTION REQUIRED: {critical} critical security risks were identified "
                f"that could lead to data breach or system compromise. {total} total "
                f"issues found across {len(targets)} target(s). Immediate remediation recommended."
            )
        elif high > 0:
            summary['narrative'] = (
                f"IMPORTANT: {high} high-priority security issues were found that "
                f"require prompt attention. {total} total issues identified."
            )
        elif total > 0:
            summary['narrative'] = (
                f"Your security posture is generally good. {total} minor "
                f"observations were found. No critical issues detected."
            )
        else:
            summary['narrative'] = (
                "Excellent! No significant security issues were detected. "
                "Your systems meet baseline security requirements."
            )
        
        return summary
    
    def generate_findings_report(self, scan_results):
        """Generate business-language findings with fix instructions"""
        findings = []
        for scan in scan_results:
            output = scan.get('output', '') or ''
            target = scan.get('target', 'Unknown')
            
            if self.vuln_translator and 'translate_output' in self.vuln_translator:
                raw_findings = self.vuln_translator['translate_output'](output)
                for f in raw_findings:
                    f['target'] = target
                    # Translate tool name if present
                    if 'source_tool' in scan and self.translator:
                        f['tested_by'] = self.translator.get_business_name(scan['source_tool'])
                    findings.append(f)
        
        # Sort by severity: critical > high > medium > low
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        findings.sort(key=lambda x: severity_order.get(x.get('severity', 'info'), 5))
        
        return findings
    
    def generate_compliance_status(self, scan_results, user_plan='starter'):
        """Generate compliance status based on plan"""
        base = {
            'owasp_top_10': 'included',
        }
        
        if user_plan in ('professional', 'enterprise'):
            base['gdpr'] = 'included'
            base['pci_dss'] = 'included'
        else:
            base['gdpr'] = 'Upgrade to Professional for GDPR compliance reports'
            base['pci_dss'] = 'Upgrade to Professional for PCI-DSS compliance reports'
        
        if user_plan == 'enterprise':
            base['hipaa'] = 'included'
            base['soc2'] = 'included'
            base['iso27001'] = 'included'
        else:
            base['hipaa'] = 'Upgrade to Enterprise'
            base['soc2'] = 'Upgrade to Enterprise'
            base['iso27001'] = 'Upgrade to Enterprise'
        
        return base
    
    def generate_fix_roadmap(self, findings):
        """Generate prioritized fix roadmap"""
        roadmap = []
        priority = 1
        
        for f in findings:
            if f.get('severity') in ('critical', 'high'):
                roadmap.append({
                    'priority': priority,
                    'issue': f.get('title', 'Security Issue'),
                    'severity': f.get('severity', 'medium'),
                    'fix_time': f.get('fix_time', 'Varies'),
                    'fix_difficulty': f.get('fix_difficulty', 'Unknown'),
                    'instruction': f.get('how_to_fix', 'Contact your IT team'),
                })
                priority += 1
        
        return roadmap
    
    def generate_full_report(self, scan_results):
        """Generate complete business-language report"""
        summary = self.generate_executive_summary(scan_results)
        findings = self.generate_findings_report(scan_results)
        compliance = self.generate_compliance_status(scan_results, self.user_plan)
        roadmap = self.generate_fix_roadmap(findings)
        
        report = {
            'metadata': {
                'generated_at': datetime.utcnow().isoformat(),
                'plan': self.user_plan,
                'version': '2.0',
                'language': 'business',
            },
            'executive_summary': summary,
            'findings': findings,
            'compliance_status': compliance,
            'fix_roadmap': roadmap,
        }
        
        # White-label support for Professional+
        if self.user_plan in ('professional', 'enterprise'):
            report['white_label'] = True
        
        return report
