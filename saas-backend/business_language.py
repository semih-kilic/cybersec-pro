#!/usr/bin/env python3
"""
CyberSec Pro - Business Language Translation Layer

Users NEVER see technical tool names (nmap, sqlmap, etc.)
Everything is presented in clear business language.

Author: Semih Kilic
Version: 1.0.0

Architecture:
  - 682 tools mapped to 6 business categories
  - Every tool has a business_name + business_description
  - Scan results translated from technical → business language
  - Severity ratings use business impact language
"""

import re
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# 6 BUSINESS CATEGORIES (Master Architecture)
# ═══════════════════════════════════════════════════════════════

BUSINESS_CATEGORIES = {
    'web_application_security': {
        'id': 'web_application_security',
        'name': 'Web Application Security',
        'business_name': 'Website & Web App Protection',
        'description': 'Comprehensive testing of web applications, APIs, and online services',
        'icon': 'shield-check',
        'color': '#3B82F6',  # blue
        'target_count': 180,
        'subcategories': [
            'SQL Injection Testing',
            'Cross-Site Scripting (XSS)',
            'Authentication & Session Security',
            'Server Misconfiguration',
            'File Upload Vulnerabilities',
            'Directory & Path Traversal',
            'Web Server Hardening',
            'CMS Security (WordPress, Joomla, etc.)',
            'SSL/TLS Certificate Analysis',
            'HTTP Security Headers',
            'Web Application Firewall Testing',
            'CORS & CSRF Protection',
        ]
    },
    'data_protection': {
        'id': 'data_protection',
        'name': 'Data Protection & Encryption',
        'business_name': 'Data & Encryption Security',
        'description': 'Ensuring data integrity, encryption strength, and protection against data leaks',
        'icon': 'lock-closed',
        'color': '#10B981',  # emerald
        'target_count': 95,
        'subcategories': [
            'Encryption Strength Analysis',
            'Data Leak Detection',
            'Password Policy Audit',
            'Credential Exposure Check',
            'Database Security Assessment',
            'File Integrity Monitoring',
            'Sensitive Data Discovery',
            'Key Management Review',
        ]
    },
    'infrastructure_security': {
        'id': 'infrastructure_security',
        'name': 'Infrastructure Security',
        'business_name': 'Network & Infrastructure Protection',
        'description': 'Testing network infrastructure, servers, firewalls, and cloud environments',
        'icon': 'server',
        'color': '#8B5CF6',  # violet
        'target_count': 120,
        'subcategories': [
            'Network Port Scanning',
            'Firewall Rule Assessment',
            'DNS Security Analysis',
            'Cloud Configuration Audit',
            'Container Security',
            'Wireless Network Testing',
            'VPN Security Assessment',
            'Server Hardening Check',
            'Network Traffic Analysis',
            'Service Discovery',
            'Operating System Security',
            'Intrusion Detection Testing',
        ]
    },
    'api_mobile_security': {
        'id': 'api_mobile_security',
        'name': 'API & Mobile Backend Security',
        'business_name': 'API & Mobile App Protection',
        'description': 'Security testing for APIs, mobile backends, and microservices',
        'icon': 'device-phone-mobile',
        'color': '#F59E0B',  # amber
        'target_count': 85,
        'subcategories': [
            'REST API Security Testing',
            'GraphQL Security Analysis',
            'API Authentication Audit',
            'Rate Limiting & Throttling',
            'API Input Validation',
            'Mobile Backend Security',
            'Microservice Communication',
            'API Documentation Exposure',
        ]
    },
    'compliance': {
        'id': 'compliance',
        'name': 'Compliance & Regulatory',
        'business_name': 'Compliance & Standards Verification',
        'description': 'Automated compliance checks for GDPR, PCI-DSS, HIPAA, ISO 27001, and more',
        'icon': 'clipboard-document-check',
        'color': '#EC4899',  # pink
        'target_count': 120,
        'subcategories': [
            'GDPR Compliance Check',
            'PCI-DSS Assessment',
            'HIPAA Security Audit',
            'ISO 27001 Controls',
            'SOC 2 Readiness',
            'NIST Framework Assessment',
            'OWASP Top 10 Verification',
            'CIS Benchmark Testing',
            'Privacy Policy Analysis',
            'Data Retention Audit',
        ]
    },
    'vulnerability_database': {
        'id': 'vulnerability_database',
        'name': 'Known Vulnerability Database',
        'business_name': 'Known Threat & CVE Detection',
        'description': 'Scanning against databases of known vulnerabilities, CVEs, and exploits',
        'icon': 'bug-ant',
        'color': '#EF4444',  # red
        'target_count': 82,
        'subcategories': [
            'CVE Database Scanning',
            'Exploit Verification',
            'Patch Level Assessment',
            'Software Version Analysis',
            'Zero-Day Intelligence',
            'Threat Intelligence Feeds',
            'Vulnerability Prioritization',
            'Risk Scoring',
        ]
    }
}


# ═══════════════════════════════════════════════════════════════
# TOOL NAME → BUSINESS NAME MAPPING
# Technical tool names are HIDDEN from users
# ═══════════════════════════════════════════════════════════════

TOOL_BUSINESS_NAMES = {
    # --- Web Application Security ---
    'nmap': {
        'business_name': 'Network Port Scanner',
        'business_description': 'Discovers open ports and running services on your network',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Port Scanning',
        'risk_context': 'Open ports can be entry points for attackers'
    },
    'nikto': {
        'business_name': 'Web Server Security Scanner',
        'business_description': 'Checks your web server for known security issues and misconfigurations',
        'business_category': 'web_application_security',
        'subcategory': 'Server Misconfiguration',
        'risk_context': 'Misconfigured servers are easy targets for data breaches'
    },
    'sqlmap': {
        'business_name': 'Database Injection Tester',
        'business_description': 'Tests if your web application is vulnerable to database injection attacks',
        'business_category': 'web_application_security',
        'subcategory': 'SQL Injection Testing',
        'risk_context': 'SQL injection can expose your entire database to attackers'
    },
    'gobuster': {
        'business_name': 'Hidden Directory Finder',
        'business_description': 'Discovers hidden files and directories on your web server',
        'business_category': 'web_application_security',
        'subcategory': 'Directory & Path Traversal',
        'risk_context': 'Hidden directories may contain sensitive files or admin panels'
    },
    'dirb': {
        'business_name': 'Web Content Scanner',
        'business_description': 'Scans for hidden content and directories on web servers',
        'business_category': 'web_application_security',
        'subcategory': 'Directory & Path Traversal',
        'risk_context': 'Exposed directories can leak sensitive information'
    },
    'wpscan': {
        'business_name': 'WordPress Security Scanner',
        'business_description': 'Comprehensive security audit for WordPress websites',
        'business_category': 'web_application_security',
        'subcategory': 'CMS Security (WordPress, Joomla, etc.)',
        'risk_context': 'WordPress vulnerabilities are actively exploited'
    },
    'whatweb': {
        'business_name': 'Website Technology Identifier',
        'business_description': 'Identifies technologies, frameworks, and versions used by websites',
        'business_category': 'web_application_security',
        'subcategory': 'Web Server Hardening',
        'risk_context': 'Known technology versions may have published vulnerabilities'
    },
    'wafw00f': {
        'business_name': 'Firewall Detection Scanner',
        'business_description': 'Detects web application firewalls protecting your site',
        'business_category': 'web_application_security',
        'subcategory': 'Web Application Firewall Testing',
        'risk_context': 'Understanding WAF coverage helps identify protection gaps'
    },
    'sslyze': {
        'business_name': 'SSL/TLS Certificate Analyzer',
        'business_description': 'Analyzes SSL/TLS configuration and certificate validity',
        'business_category': 'web_application_security',
        'subcategory': 'SSL/TLS Certificate Analysis',
        'risk_context': 'Weak SSL/TLS allows man-in-the-middle attacks'
    },
    'sslscan': {
        'business_name': 'SSL Security Checker',
        'business_description': 'Checks SSL encryption strength and identifies weak ciphers',
        'business_category': 'web_application_security',
        'subcategory': 'SSL/TLS Certificate Analysis',
        'risk_context': 'Outdated SSL ciphers can be easily broken'
    },
    'testssl.sh': {
        'business_name': 'TLS Configuration Auditor',
        'business_description': 'Complete audit of TLS/SSL implementation and cipher suites',
        'business_category': 'web_application_security',
        'subcategory': 'SSL/TLS Certificate Analysis',
        'risk_context': 'TLS misconfigurations enable eavesdropping'
    },
    'xsser': {
        'business_name': 'Cross-Site Scripting Tester',
        'business_description': 'Tests web applications for cross-site scripting vulnerabilities',
        'business_category': 'web_application_security',
        'subcategory': 'Cross-Site Scripting (XSS)',
        'risk_context': 'XSS can steal user sessions and credentials'
    },
    'commix': {
        'business_name': 'Command Injection Tester',
        'business_description': 'Tests for command injection vulnerabilities in web applications',
        'business_category': 'web_application_security',
        'subcategory': 'SQL Injection Testing',
        'risk_context': 'Command injection can give attackers full server control'
    },
    'wfuzz': {
        'business_name': 'Web Application Fuzzer',
        'business_description': 'Tests web applications for unexpected input handling vulnerabilities',
        'business_category': 'web_application_security',
        'subcategory': 'File Upload Vulnerabilities',
        'risk_context': 'Poor input handling leads to security bypasses'
    },
    'ffuf': {
        'business_name': 'Fast Web Fuzzer',
        'business_description': 'High-speed testing for hidden content and parameter vulnerabilities',
        'business_category': 'web_application_security',
        'subcategory': 'Directory & Path Traversal',
        'risk_context': 'Hidden endpoints may expose sensitive functionality'
    },
    'joomscan': {
        'business_name': 'Joomla Security Scanner',
        'business_description': 'Security assessment for Joomla CMS installations',
        'business_category': 'web_application_security',
        'subcategory': 'CMS Security (WordPress, Joomla, etc.)',
        'risk_context': 'Joomla vulnerabilities are commonly exploited'
    },
    'droopescan': {
        'business_name': 'CMS Security Scanner',
        'business_description': 'Multi-CMS security scanner for Drupal, WordPress, and more',
        'business_category': 'web_application_security',
        'subcategory': 'CMS Security (WordPress, Joomla, etc.)',
        'risk_context': 'Outdated CMS versions have known exploits'
    },
    'skipfish': {
        'business_name': 'Web Application Security Crawler',
        'business_description': 'Automated crawling and security assessment of web apps',
        'business_category': 'web_application_security',
        'subcategory': 'Server Misconfiguration',
        'risk_context': 'Automated scanning reveals issues manual testing misses'
    },

    # --- Data Protection & Encryption ---
    'john': {
        'business_name': 'Password Strength Auditor',
        'business_description': 'Tests password strength by attempting to crack password hashes',
        'business_category': 'data_protection',
        'subcategory': 'Password Policy Audit',
        'risk_context': 'Weak passwords are the #1 cause of breaches'
    },
    'hashcat': {
        'business_name': 'Advanced Password Analyzer',
        'business_description': 'GPU-accelerated password strength testing',
        'business_category': 'data_protection',
        'subcategory': 'Password Policy Audit',
        'risk_context': 'Modern GPU attacks can crack weak passwords in seconds'
    },
    'hydra': {
        'business_name': 'Login Security Tester',
        'business_description': 'Tests login pages for weak credential vulnerabilities',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'Brute-force attacks target weak login credentials'
    },
    'medusa': {
        'business_name': 'Authentication Brute Force Tester',
        'business_description': 'Tests multiple authentication services for weak passwords',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'Weak passwords on any service are an entry point'
    },
    'ncrack': {
        'business_name': 'Network Authentication Tester',
        'business_description': 'Tests network service authentication security',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'Default or weak credentials on network services'
    },
    'hash-identifier': {
        'business_name': 'Encryption Type Identifier',
        'business_description': 'Identifies encryption algorithms used for stored passwords',
        'business_category': 'data_protection',
        'subcategory': 'Encryption Strength Analysis',
        'risk_context': 'Weak encryption algorithms can be reversed'
    },
    'trufflehog': {
        'business_name': 'Secret Key Leak Scanner',
        'business_description': 'Scans code repositories for accidentally committed secrets and API keys',
        'business_category': 'data_protection',
        'subcategory': 'Data Leak Detection',
        'risk_context': 'Leaked API keys in code repos cause major breaches'
    },
    'gitleaks': {
        'business_name': 'Code Repository Secret Scanner',
        'business_description': 'Detects hardcoded secrets and credentials in source code',
        'business_category': 'data_protection',
        'subcategory': 'Data Leak Detection',
        'risk_context': 'Hardcoded secrets are easily discoverable by attackers'
    },
    'cewl': {
        'business_name': 'Custom Wordlist Generator',
        'business_description': 'Creates target-specific password lists for security testing',
        'business_category': 'data_protection',
        'subcategory': 'Password Policy Audit',
        'risk_context': 'Company-specific words are often used in passwords'
    },
    'crunch': {
        'business_name': 'Password Pattern Analyzer',
        'business_description': 'Generates password patterns to test password policy effectiveness',
        'business_category': 'data_protection',
        'subcategory': 'Password Policy Audit',
        'risk_context': 'Predictable password patterns reduce security'
    },

    # --- Infrastructure Security ---
    'masscan': {
        'business_name': 'High-Speed Network Scanner',
        'business_description': 'Ultra-fast scanning of large network ranges for open services',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Port Scanning',
        'risk_context': 'Unknown open services are potential attack vectors'
    },
    'netdiscover': {
        'business_name': 'Network Device Discovery',
        'business_description': 'Discovers all devices connected to your network',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Unknown devices on your network are security risks'
    },
    'arp-scan': {
        'business_name': 'Local Network Scanner',
        'business_description': 'Scans local network for connected devices using ARP',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Rogue devices can intercept network traffic'
    },
    'wireshark': {
        'business_name': 'Network Traffic Analyzer',
        'business_description': 'Deep inspection of network traffic for security issues',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Traffic Analysis',
        'risk_context': 'Unencrypted traffic exposes sensitive data'
    },
    'tcpdump': {
        'business_name': 'Network Packet Capture',
        'business_description': 'Captures and analyzes network packets for security monitoring',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Traffic Analysis',
        'risk_context': 'Packet analysis reveals data exposure risks'
    },
    'ettercap': {
        'business_name': 'Network Interception Tester',
        'business_description': 'Tests network vulnerability to man-in-the-middle attacks',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Traffic Analysis',
        'risk_context': 'MitM attacks can intercept all network communications'
    },
    'aircrack-ng': {
        'business_name': 'WiFi Security Auditor',
        'business_description': 'Comprehensive wireless network security assessment',
        'business_category': 'infrastructure_security',
        'subcategory': 'Wireless Network Testing',
        'risk_context': 'Weak WiFi security allows unauthorized network access'
    },
    'kismet': {
        'business_name': 'Wireless Network Detector',
        'business_description': 'Detects and monitors wireless networks and devices',
        'business_category': 'infrastructure_security',
        'subcategory': 'Wireless Network Testing',
        'risk_context': 'Unauthorized wireless access points bypass security'
    },
    'fierce': {
        'business_name': 'DNS Reconnaissance Scanner',
        'business_description': 'Discovers DNS records and potential attack surface',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS misconfigurations reveal internal network structure'
    },
    'dnsrecon': {
        'business_name': 'DNS Security Auditor',
        'business_description': 'Comprehensive DNS enumeration and security assessment',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS zone transfers can expose your entire infrastructure'
    },
    'dnsenum': {
        'business_name': 'DNS Enumeration Tool',
        'business_description': 'Enumerates DNS information and identifies security issues',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS enumeration reveals all your public services'
    },
    'iptables': {
        'business_name': 'Firewall Rule Analyzer',
        'business_description': 'Analyzes firewall rules for security gaps and misconfigurations',
        'business_category': 'infrastructure_security',
        'subcategory': 'Firewall Rule Assessment',
        'risk_context': 'Firewall misconfigurations leave services exposed'
    },
    'traceroute': {
        'business_name': 'Network Path Analyzer',
        'business_description': 'Maps network routing paths to identify exposure points',
        'business_category': 'infrastructure_security',
        'subcategory': 'Network Port Scanning',
        'risk_context': 'Network routing reveals infrastructure topology'
    },
    'hping3': {
        'business_name': 'Network Protocol Tester',
        'business_description': 'Advanced network protocol testing and firewall auditing',
        'business_category': 'infrastructure_security',
        'subcategory': 'Firewall Rule Assessment',
        'risk_context': 'Protocol-level attacks bypass application security'
    },
    'snort': {
        'business_name': 'Intrusion Detection System',
        'business_description': 'Real-time network intrusion detection and alerting',
        'business_category': 'infrastructure_security',
        'subcategory': 'Intrusion Detection Testing',
        'risk_context': 'Without IDS, attacks go undetected'
    },

    # --- API & Mobile Security ---
    'burpsuite': {
        'business_name': 'API Security Testing Platform',
        'business_description': 'Comprehensive API and web application security testing',
        'business_category': 'api_mobile_security',
        'subcategory': 'REST API Security Testing',
        'risk_context': 'API vulnerabilities expose backend data and services'
    },
    'zaproxy': {
        'business_name': 'API Vulnerability Scanner',
        'business_description': 'Automated security scanning for APIs and web services',
        'business_category': 'api_mobile_security',
        'subcategory': 'REST API Security Testing',
        'risk_context': 'Automated scanning catches common API flaws'
    },
    'mitmproxy': {
        'business_name': 'API Traffic Inspector',
        'business_description': 'Intercepts and analyzes API traffic for security issues',
        'business_category': 'api_mobile_security',
        'subcategory': 'API Authentication Audit',
        'risk_context': 'API traffic analysis reveals authentication weaknesses'
    },
    'postman': {
        'business_name': 'API Endpoint Tester',
        'business_description': 'Tests API endpoints for security and proper authentication',
        'business_category': 'api_mobile_security',
        'subcategory': 'REST API Security Testing',
        'risk_context': 'Untested API endpoints may lack proper authorization'
    },
    'apktool': {
        'business_name': 'Mobile App Analyzer',
        'business_description': 'Analyzes mobile application packages for security issues',
        'business_category': 'api_mobile_security',
        'subcategory': 'Mobile Backend Security',
        'risk_context': 'Mobile apps often contain hardcoded secrets'
    },
    'jadx': {
        'business_name': 'Mobile Code Reviewer',
        'business_description': 'Reviews mobile application source code for vulnerabilities',
        'business_category': 'api_mobile_security',
        'subcategory': 'Mobile Backend Security',
        'risk_context': 'Decompiled mobile apps may reveal API keys and endpoints'
    },
    'frida': {
        'business_name': 'Mobile Runtime Inspector',
        'business_description': 'Dynamic analysis of mobile applications during execution',
        'business_category': 'api_mobile_security',
        'subcategory': 'Mobile Backend Security',
        'risk_context': 'Runtime analysis reveals hidden security flaws'
    },

    # --- Compliance ---
    'lynis': {
        'business_name': 'System Compliance Auditor',
        'business_description': 'Comprehensive system hardening and compliance assessment',
        'business_category': 'compliance',
        'subcategory': 'CIS Benchmark Testing',
        'risk_context': 'Non-compliance can result in fines and breaches'
    },
    'openscap': {
        'business_name': 'Security Policy Compliance Checker',
        'business_description': 'Automated security policy compliance verification',
        'business_category': 'compliance',
        'subcategory': 'NIST Framework Assessment',
        'risk_context': 'Regulatory non-compliance carries legal penalties'
    },
    'oscap': {
        'business_name': 'SCAP Compliance Scanner',
        'business_description': 'Scans systems against SCAP security benchmarks',
        'business_category': 'compliance',
        'subcategory': 'CIS Benchmark Testing',
        'risk_context': 'SCAP compliance ensures baseline security'
    },

    # --- Vulnerability Database / CVE ---
    'nuclei': {
        'business_name': 'Known Vulnerability Scanner',
        'business_description': 'Scans for thousands of known vulnerabilities using templates',
        'business_category': 'vulnerability_database',
        'subcategory': 'CVE Database Scanning',
        'risk_context': 'Known vulnerabilities are actively exploited by attackers'
    },
    'searchsploit': {
        'business_name': 'Exploit Database Search',
        'business_description': 'Searches for known exploits matching your software versions',
        'business_category': 'vulnerability_database',
        'subcategory': 'Exploit Verification',
        'risk_context': 'Published exploits make your systems easy targets'
    },
    'nessus': {
        'business_name': 'Enterprise Vulnerability Scanner',
        'business_description': 'Professional-grade vulnerability assessment and reporting',
        'business_category': 'vulnerability_database',
        'subcategory': 'CVE Database Scanning',
        'risk_context': 'Comprehensive scanning catches what basic tools miss'
    },
    'openvas': {
        'business_name': 'Open Source Vulnerability Assessor',
        'business_description': 'Full vulnerability assessment with extensive plugin database',
        'business_category': 'vulnerability_database',
        'subcategory': 'CVE Database Scanning',
        'risk_context': 'Regular vulnerability assessment is essential for security'
    },
    'wapiti': {
        'business_name': 'Web Vulnerability Detector',
        'business_description': 'Detects web application vulnerabilities through automated scanning',
        'business_category': 'vulnerability_database',
        'subcategory': 'CVE Database Scanning',
        'risk_context': 'Web vulnerabilities are the most common attack vector'
    },
    'vuls': {
        'business_name': 'Server Vulnerability Scanner',
        'business_description': 'Agentless vulnerability scanner for Linux/FreeBSD servers',
        'business_category': 'vulnerability_database',
        'subcategory': 'Patch Level Assessment',
        'risk_context': 'Unpatched servers are primary targets for ransomware'
    },

    # --- OSINT / Recon → mapped to relevant business categories ---
    'whois': {
        'business_name': 'Domain Registration Lookup',
        'business_description': 'Checks domain registration details and expiration',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'Domain registration details can reveal organizational info'
    },
    'dig': {
        'business_name': 'DNS Record Analyzer',
        'business_description': 'Queries and analyzes DNS records for your domains',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS records can expose internal infrastructure'
    },
    'host': {
        'business_name': 'DNS Host Resolver',
        'business_description': 'Resolves hostnames and checks DNS configuration',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS resolution issues affect service availability'
    },
    'nslookup': {
        'business_name': 'DNS Lookup Service',
        'business_description': 'Interactive DNS lookup for domain security verification',
        'business_category': 'infrastructure_security',
        'subcategory': 'DNS Security Analysis',
        'risk_context': 'DNS configuration affects security posture'
    },
    'theHarvester': {
        'business_name': 'Public Information Gatherer',
        'business_description': 'Discovers publicly exposed email addresses and subdomains',
        'business_category': 'data_protection',
        'subcategory': 'Data Leak Detection',
        'risk_context': 'Exposed email addresses enable phishing attacks'
    },
    'amass': {
        'business_name': 'Attack Surface Mapper',
        'business_description': 'Maps your complete external attack surface (domains, IPs, services)',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Unknown assets cannot be protected'
    },
    'subfinder': {
        'business_name': 'Subdomain Discovery Scanner',
        'business_description': 'Discovers all subdomains associated with your organization',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Forgotten subdomains are common attack vectors'
    },
    'assetfinder': {
        'business_name': 'Digital Asset Finder',
        'business_description': 'Locates all digital assets linked to your domain',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Unmanaged digital assets increase risk'
    },
    'recon-ng': {
        'business_name': 'Reconnaissance Framework',
        'business_description': 'Automated intelligence gathering about your digital presence',
        'business_category': 'infrastructure_security',
        'subcategory': 'Service Discovery',
        'risk_context': 'Understanding your exposure is the first step to protection'
    },
    'spiderfoot': {
        'business_name': 'Digital Footprint Analyzer',
        'business_description': 'Analyzes your organization\'s complete digital footprint',
        'business_category': 'data_protection',
        'subcategory': 'Data Leak Detection',
        'risk_context': 'Your digital footprint reveals exploitable information'
    },
    'sherlock': {
        'business_name': 'Username Exposure Checker',
        'business_description': 'Checks if employee usernames are exposed across platforms',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'Username reuse across platforms enables targeted attacks'
    },
    'maltego': {
        'business_name': 'Threat Intelligence Analyzer',
        'business_description': 'Visual link analysis for threat intelligence and investigations',
        'business_category': 'vulnerability_database',
        'subcategory': 'Threat Intelligence Feeds',
        'risk_context': 'Connected threats require visual analysis to understand'
    },

    # --- Exploitation / Post-Exploitation → compliance/vuln categories ---
    'metasploit': {
        'business_name': 'Penetration Testing Framework',
        'business_description': 'Professional penetration testing to verify vulnerabilities are exploitable',
        'business_category': 'vulnerability_database',
        'subcategory': 'Exploit Verification',
        'risk_context': 'Verifying exploitability determines true risk level'
    },
    'msfconsole': {
        'business_name': 'Advanced Penetration Tester',
        'business_description': 'Advanced exploit verification and penetration testing',
        'business_category': 'vulnerability_database',
        'subcategory': 'Exploit Verification',
        'risk_context': 'Active exploitation testing proves vulnerability impact'
    },
    'msfvenom': {
        'business_name': 'Payload Generator',
        'business_description': 'Generates test payloads for penetration testing exercises',
        'business_category': 'vulnerability_database',
        'subcategory': 'Exploit Verification',
        'risk_context': 'Custom payloads test defense detection capabilities'
    },
    'responder': {
        'business_name': 'Network Protocol Exploit Tester',
        'business_description': 'Tests network protocol security by simulating attacks',
        'business_category': 'infrastructure_security',
        'subcategory': 'Intrusion Detection Testing',
        'risk_context': 'Protocol-level exploits bypass application security'
    },
    'impacket': {
        'business_name': 'Windows Protocol Security Tester',
        'business_description': 'Tests Windows network protocol implementations for vulnerabilities',
        'business_category': 'infrastructure_security',
        'subcategory': 'Operating System Security',
        'risk_context': 'Windows protocol flaws enable lateral movement'
    },
    'mimikatz': {
        'business_name': 'Credential Extraction Tester',
        'business_description': 'Tests if credentials can be extracted from Windows memory',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'In-memory credential exposure enables privilege escalation'
    },
    'bloodhound': {
        'business_name': 'Active Directory Security Auditor',
        'business_description': 'Maps Active Directory attack paths and privilege escalation routes',
        'business_category': 'compliance',
        'subcategory': 'CIS Benchmark Testing',
        'risk_context': 'AD misconfigurations enable domain-wide compromise'
    },
    'crackmapexec': {
        'business_name': 'Network Security Assessment Suite',
        'business_description': 'Comprehensive security assessment of networked Windows systems',
        'business_category': 'infrastructure_security',
        'subcategory': 'Operating System Security',
        'risk_context': 'Windows network misconfigurations are common entry points'
    },
    'evil-winrm': {
        'business_name': 'Windows Remote Access Tester',
        'business_description': 'Tests Windows Remote Management security configuration',
        'business_category': 'infrastructure_security',
        'subcategory': 'Operating System Security',
        'risk_context': 'Insecure WinRM allows unauthorized remote access'
    },
    'empire': {
        'business_name': 'Post-Exploitation Framework',
        'business_description': 'Tests post-breach detection and response capabilities',
        'business_category': 'compliance',
        'subcategory': 'NIST Framework Assessment',
        'risk_context': 'Testing response to active threats validates incident response'
    },

    # --- Forensics → Compliance ---
    'autopsy': {
        'business_name': 'Digital Forensics Platform',
        'business_description': 'Professional digital forensics investigation platform',
        'business_category': 'compliance',
        'subcategory': 'Data Retention Audit',
        'risk_context': 'Forensic readiness is required by many regulations'
    },
    'volatility': {
        'business_name': 'Memory Forensics Analyzer',
        'business_description': 'Analyzes system memory for evidence of compromise',
        'business_category': 'compliance',
        'subcategory': 'NIST Framework Assessment',
        'risk_context': 'Memory analysis detects advanced persistent threats'
    },
    'binwalk': {
        'business_name': 'Firmware Security Analyzer',
        'business_description': 'Analyzes firmware and embedded systems for vulnerabilities',
        'business_category': 'infrastructure_security',
        'subcategory': 'Server Hardening Check',
        'risk_context': 'Firmware vulnerabilities affect physical devices'
    },

    # --- Reverse Engineering → API/Mobile ---
    'ghidra': {
        'business_name': 'Software Security Analyzer',
        'business_description': 'NSA-developed tool for analyzing software security',
        'business_category': 'api_mobile_security',
        'subcategory': 'Mobile Backend Security',
        'risk_context': 'Software analysis reveals hidden vulnerabilities'
    },
    'radare2': {
        'business_name': 'Binary Analysis Framework',
        'business_description': 'Advanced binary analysis for security assessment',
        'business_category': 'api_mobile_security',
        'subcategory': 'Mobile Backend Security',
        'risk_context': 'Binary analysis finds vulnerabilities in compiled code'
    },

    # --- Social Engineering → Data Protection ---
    'setoolkit': {
        'business_name': 'Phishing Simulation Platform',
        'business_description': 'Simulates phishing attacks to test employee awareness',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'Phishing is the #1 vector for credential theft'
    },
    'gophish': {
        'business_name': 'Employee Awareness Tester',
        'business_description': 'Tests employee security awareness through simulated attacks',
        'business_category': 'data_protection',
        'subcategory': 'Credential Exposure Check',
        'risk_context': 'People are often the weakest link in security'
    },

    # --- Cloud Security → Infrastructure ---
    'prowler': {
        'business_name': 'AWS Security Auditor',
        'business_description': 'Comprehensive AWS cloud security assessment',
        'business_category': 'infrastructure_security',
        'subcategory': 'Cloud Configuration Audit',
        'risk_context': 'Cloud misconfigurations cause major data breaches'
    },
    'scout': {
        'business_name': 'Cloud Security Scanner',
        'business_description': 'Multi-cloud security configuration scanner',
        'business_category': 'infrastructure_security',
        'subcategory': 'Cloud Configuration Audit',
        'risk_context': 'Cloud security requires different testing approaches'
    },
    'trivy': {
        'business_name': 'Container Security Scanner',
        'business_description': 'Scans containers and images for vulnerabilities',
        'business_category': 'infrastructure_security',
        'subcategory': 'Container Security',
        'risk_context': 'Container vulnerabilities affect all deployments'
    },
    'docker-bench-security': {
        'business_name': 'Docker Security Benchmark',
        'business_description': 'Tests Docker installations against CIS security benchmarks',
        'business_category': 'infrastructure_security',
        'subcategory': 'Container Security',
        'risk_context': 'Insecure Docker configs expose containerized apps'
    },

    # --- Reporting Tools → Compliance ---
    'dradis': {
        'business_name': 'Security Report Generator',
        'business_description': 'Professional security assessment report generation',
        'business_category': 'compliance',
        'subcategory': 'NIST Framework Assessment',
        'risk_context': 'Proper reporting is required for compliance'
    },
    'faraday': {
        'business_name': 'Vulnerability Management Platform',
        'business_description': 'Centralized vulnerability tracking and management',
        'business_category': 'compliance',
        'subcategory': 'OWASP Top 10 Verification',
        'risk_context': 'Tracking vulnerabilities ensures timely remediation'
    },
}

# ═══════════════════════════════════════════════════════════════
# OLD → NEW CATEGORY MAPPING
# Maps 15 old Kali categories to 6 business categories
# ═══════════════════════════════════════════════════════════════

OLD_TO_NEW_CATEGORY = {
    'Information Gathering': 'infrastructure_security',
    'Vulnerability Analysis': 'vulnerability_database',
    'Web Applications': 'web_application_security',
    'Exploitation Tools': 'vulnerability_database',
    'Post Exploitation': 'compliance',
    'Password Attacks': 'data_protection',
    'Reverse Engineering': 'api_mobile_security',
    'Forensics': 'compliance',
    'Sniffing & Spoofing': 'infrastructure_security',
    'Network Utilities': 'infrastructure_security',
    'Wireless Attacks': 'infrastructure_security',
    'OSINT': 'data_protection',
    'Cloud Security': 'infrastructure_security',
    'Social Engineering': 'data_protection',
    'Reporting Tools': 'compliance',
}


# ═══════════════════════════════════════════════════════════════
# SEVERITY TRANSLATION: Technical → Business Language
# ═══════════════════════════════════════════════════════════════

SEVERITY_BUSINESS = {
    'critical': {
        'label': 'Critical Business Risk',
        'description': 'Immediate action required - active exploitation possible',
        'color': '#DC2626',
        'priority': 'Fix within 24 hours',
        'impact': 'Could result in data breach, financial loss, or service outage'
    },
    'high': {
        'label': 'High Business Risk',
        'description': 'Significant vulnerability that should be addressed urgently',
        'color': '#EA580C',
        'priority': 'Fix within 7 days',
        'impact': 'Could be exploited to compromise systems or data'
    },
    'medium': {
        'label': 'Moderate Business Risk',
        'description': 'Security issue requiring planned remediation',
        'color': '#D97706',
        'priority': 'Fix within 30 days',
        'impact': 'Could contribute to a security incident if combined with other issues'
    },
    'low': {
        'label': 'Low Business Risk',
        'description': 'Minor security observation for improvement',
        'color': '#2563EB',
        'priority': 'Fix within 90 days',
        'impact': 'Minimal direct risk but improves overall security posture'
    },
    'info': {
        'label': 'Informational',
        'description': 'Security observation for awareness',
        'color': '#6B7280',
        'priority': 'Review during next security assessment',
        'impact': 'No immediate risk but good to know for defense planning'
    }
}


# ═══════════════════════════════════════════════════════════════
# BUSINESS LANGUAGE TRANSLATOR CLASS
# ═══════════════════════════════════════════════════════════════

class BusinessLanguageTranslator:
    """
    Translates ALL technical security findings into business language.
    Users NEVER see tool names like Nmap, SQLMap, etc.
    """

    def __init__(self):
        self.tool_names = TOOL_BUSINESS_NAMES
        self.categories = BUSINESS_CATEGORIES
        self.severity_map = SEVERITY_BUSINESS
        self.category_map = OLD_TO_NEW_CATEGORY

    # ── Tool name translation ──

    def get_business_name(self, tool_name: str) -> str:
        """Convert technical tool name to business-friendly name"""
        tool_key = tool_name.lower().strip()
        if tool_key in self.tool_names:
            return self.tool_names[tool_key]['business_name']
        # Generate a reasonable name from the technical name
        return self._generate_business_name(tool_name)

    def get_business_description(self, tool_name: str) -> str:
        """Get business-friendly description for a tool"""
        tool_key = tool_name.lower().strip()
        if tool_key in self.tool_names:
            return self.tool_names[tool_key]['business_description']
        return f"Security testing component for {self._humanize(tool_name)}"

    def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """Get complete business info for a tool"""
        tool_key = tool_name.lower().strip()
        if tool_key in self.tool_names:
            info = self.tool_names[tool_key].copy()
            # Resolve category info
            cat_id = info.get('business_category', 'web_application_security')
            cat_info = self.categories.get(cat_id, {})
            info['category_name'] = cat_info.get('name', cat_id)
            info['category_icon'] = cat_info.get('icon', 'shield-check')
            info['category_color'] = cat_info.get('color', '#3B82F6')
            return info
        return {
            'business_name': self._generate_business_name(tool_name),
            'business_description': f'Security analysis component',
            'business_category': self._guess_category(tool_name),
            'subcategory': 'General Security Testing',
            'risk_context': 'Part of comprehensive security assessment',
            'category_name': 'Security Testing',
            'category_icon': 'shield-check',
            'category_color': '#3B82F6'
        }

    # ── Category translation ──

    def translate_category(self, old_category: str) -> str:
        """Map old Kali category to new business category ID"""
        return self.category_map.get(old_category, 'web_application_security')

    def get_category_info(self, category_id: str) -> Dict[str, Any]:
        """Get full business category information"""
        return self.categories.get(category_id, {
            'id': category_id,
            'name': self._humanize(category_id),
            'business_name': self._humanize(category_id),
            'description': 'Security testing category',
            'icon': 'shield-check',
            'color': '#6B7280'
        })

    def get_all_categories(self) -> List[Dict[str, Any]]:
        """Get all 6 business categories with counts"""
        return [
            {**cat_info, 'id': cat_id}
            for cat_id, cat_info in self.categories.items()
        ]

    # ── Finding translation ──

    def translate_finding(self, finding: Dict[str, Any]) -> Dict[str, Any]:
        """Translate a technical finding to business language"""
        translated = finding.copy()

        # Translate severity
        severity = finding.get('severity', 'info').lower()
        sev_info = self.severity_map.get(severity, self.severity_map['info'])
        translated['severity_label'] = sev_info['label']
        translated['severity_description'] = sev_info['description']
        translated['severity_color'] = sev_info['color']
        translated['priority'] = sev_info['priority']
        translated['business_impact'] = sev_info['impact']

        # Translate tool name if present
        if 'tool' in finding:
            tool_info = self.get_tool_info(finding['tool'])
            translated['test_name'] = tool_info['business_name']
            translated['test_description'] = tool_info['business_description']
            translated['risk_context'] = tool_info.get('risk_context', '')
            # Remove technical tool name
            if 'tool' in translated:
                del translated['tool']

        # Translate title if it contains technical jargon
        if 'title' in finding:
            translated['title'] = self._translate_title(finding['title'])

        # Translate description
        if 'description' in finding:
            translated['description'] = self._translate_description(finding['description'])

        return translated

    def translate_scan_result(self, scan_result: Dict[str, Any]) -> Dict[str, Any]:
        """Translate a complete scan result to business language"""
        translated = scan_result.copy()

        # Translate tool info
        tool_name = scan_result.get('tool', {}).get('name', '')
        if tool_name:
            tool_info = self.get_tool_info(tool_name)
            translated['tool'] = {
                'name': tool_info['business_name'],
                'description': tool_info['business_description'],
                'category': tool_info.get('category_name', 'Security Testing'),
                'subcategory': tool_info.get('subcategory', ''),
            }

        # Translate findings
        if 'findings' in scan_result and isinstance(scan_result['findings'], list):
            translated['findings'] = [
                self.translate_finding(f) for f in scan_result['findings']
            ]

        # Add business summary
        translated['business_summary'] = self._generate_business_summary(scan_result)

        return translated

    def translate_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Translate entire report to business language"""
        translated = report_data.copy()

        # Executive summary in business terms
        total = report_data.get('total_findings', 0)
        critical = report_data.get('severity_breakdown', {}).get('critical', 0)
        high = report_data.get('severity_breakdown', {}).get('high', 0)

        if critical > 0:
            translated['executive_summary'] = (
                f"URGENT: {critical} critical business risks identified that require "
                f"immediate attention. {total} total security observations found."
            )
        elif high > 0:
            translated['executive_summary'] = (
                f"IMPORTANT: {high} high-priority security issues found. "
                f"{total} total observations require review."
            )
        elif total > 0:
            translated['executive_summary'] = (
                f"{total} security observations found. "
                f"No critical issues, but improvements are recommended."
            )
        else:
            translated['executive_summary'] = (
                "No significant security issues detected. "
                "Your systems meet baseline security requirements."
            )

        return translated

    # ── Helper methods ──

    def _generate_business_name(self, tool_name: str) -> str:
        """Generate a business-friendly name for unknown tools"""
        name = tool_name.replace('-', ' ').replace('_', ' ').title()
        # Remove version numbers
        name = re.sub(r'\s*v?\d+(\.\d+)*\s*', ' ', name).strip()
        return f"{name} Security Scanner"

    def _humanize(self, text: str) -> str:
        """Convert snake_case/kebab-case to human readable"""
        return text.replace('_', ' ').replace('-', ' ').title()

    def _guess_category(self, tool_name: str) -> str:
        """Guess business category from tool name"""
        name = tool_name.lower()
        web_keywords = ['web', 'http', 'html', 'url', 'spider', 'crawl', 'cms', 'wp', 'sql']
        data_keywords = ['pass', 'hash', 'crypt', 'secret', 'leak', 'key', 'credential']
        infra_keywords = ['net', 'dns', 'port', 'scan', 'wire', 'arp', 'route', 'cloud']
        api_keywords = ['api', 'mobile', 'app', 'rest', 'graphql', 'proxy']
        compliance_keywords = ['audit', 'compliance', 'bench', 'policy', 'report', 'forensic']
        vuln_keywords = ['vuln', 'cve', 'exploit', 'nuclei', 'nessus']

        for kw in web_keywords:
            if kw in name:
                return 'web_application_security'
        for kw in data_keywords:
            if kw in name:
                return 'data_protection'
        for kw in infra_keywords:
            if kw in name:
                return 'infrastructure_security'
        for kw in api_keywords:
            if kw in name:
                return 'api_mobile_security'
        for kw in compliance_keywords:
            if kw in name:
                return 'compliance'
        for kw in vuln_keywords:
            if kw in name:
                return 'vulnerability_database'

        return 'web_application_security'  # default

    def _translate_title(self, title: str) -> str:
        """Clean up technical titles for business audience"""
        # Remove raw command references
        title = re.sub(r'(nmap|sqlmap|nikto|gobuster|dirb|hydra|hashcat|john|metasploit|msfconsole)',
                       'security test', title, flags=re.IGNORECASE)
        # Remove file paths
        title = re.sub(r'/[^\s]+', '', title)
        # Remove IP-like URLs that look too technical
        # Keep the title readable
        return title.strip()

    def _translate_description(self, desc: str) -> str:
        """Translate technical descriptions to business language"""
        if not desc:
            return desc

        # Replace common technical terms with business terms
        replacements = {
            'SQL injection': 'database injection vulnerability',
            'XSS': 'cross-site scripting (code injection)',
            'CSRF': 'cross-site request forgery (action hijacking)',
            'RCE': 'remote code execution (full system access)',
            'LFI': 'local file access vulnerability',
            'RFI': 'remote file inclusion vulnerability',
            'SSRF': 'server-side request forgery',
            'CVE-': 'Known Vulnerability CVE-',
            'buffer overflow': 'memory corruption vulnerability',
            'privilege escalation': 'unauthorized access upgrade',
            'lateral movement': 'internal network spread',
            'command injection': 'operating system command vulnerability',
            'directory traversal': 'file access vulnerability',
            'brute force': 'automated password guessing',
        }

        translated = desc
        for technical, business in replacements.items():
            translated = re.sub(re.escape(technical), business, translated, flags=re.IGNORECASE)

        return translated

    def _generate_business_summary(self, scan_result: Dict[str, Any]) -> str:
        """Generate business-friendly summary of a scan"""
        status = scan_result.get('status', 'unknown')
        target = scan_result.get('target', 'target system')
        findings = scan_result.get('findings_summary', {})
        total = findings.get('total', 0)
        critical = findings.get('critical', 0)
        high = findings.get('high', 0)

        if status == 'completed':
            if critical > 0:
                return f"Security test on {target} completed. {critical} CRITICAL issues found requiring immediate action."
            elif high > 0:
                return f"Security test on {target} completed. {high} high-priority issues found."
            elif total > 0:
                return f"Security test on {target} completed. {total} observations found, none critical."
            else:
                return f"Security test on {target} completed successfully. No issues detected."
        elif status == 'running':
            return f"Security test on {target} is currently in progress..."
        elif status == 'failed':
            return f"Security test on {target} encountered an issue. Our team has been notified."
        else:
            return f"Security test on {target} is queued for execution."


# ═══════════════════════════════════════════════════════════════
# SINGLETON INSTANCE
# ═══════════════════════════════════════════════════════════════

_translator = None

def get_translator() -> BusinessLanguageTranslator:
    """Get singleton BusinessLanguageTranslator instance"""
    global _translator
    if _translator is None:
        _translator = BusinessLanguageTranslator()
    return _translator
