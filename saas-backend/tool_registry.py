#!/usr/bin/env python3
"""
🛡️ CyberSec Pro - Kali Linux Tool Registry
Auto-discovers and manages all Kali Linux security tools

Author: Semih Kılıç
Version: 2.0.0
"""

import subprocess
import shutil
import os
import json
import logging
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# ============================================================================
# COMPREHENSIVE KALI LINUX TOOL DEFINITIONS
# ============================================================================

TOOL_DEFINITIONS = {
    # =========================================================================
    # INFORMATION GATHERING - 50+ Tools
    # =========================================================================
    "nmap": {
        "name": "Nmap",
        "category": "information_gathering",
        "subcategory": "port_scanning",
        "description": "Network exploration and security auditing tool",
        "plan_required": "starter",
        "command": "nmap",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "scan_type": {"flag": "-s", "type": "select", "options": ["S", "T", "U", "A", "V", "N"], "default": "T", "description": "Scan type"},
            "ports": {"flag": "-p", "type": "text", "default": "1-1000", "description": "Port range"},
            "timing": {"flag": "-T", "type": "select", "options": ["0", "1", "2", "3", "4", "5"], "default": "3", "description": "Timing template"},
            "os_detection": {"flag": "-O", "type": "boolean", "default": False, "description": "OS detection"},
            "service_version": {"flag": "-sV", "type": "boolean", "default": False, "description": "Service version"},
            "script": {"flag": "--script", "type": "text", "default": "", "description": "NSE scripts"},
        },
        "output_parser": "nmap"
    },
    "masscan": {
        "name": "Masscan",
        "category": "information_gathering",
        "subcategory": "port_scanning",
        "description": "TCP port scanner, spews SYN packets asynchronously",
        "plan_required": "professional",
        "command": "masscan",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "ports": {"flag": "-p", "type": "text", "default": "1-65535", "description": "Port range"},
            "rate": {"flag": "--rate", "type": "number", "default": 1000, "min": 100, "max": 100000, "description": "Packets per second"},
        }
    },
    "rustscan": {
        "name": "RustScan",
        "category": "information_gathering",
        "subcategory": "port_scanning",
        "description": "Fast port scanner in Rust",
        "plan_required": "professional",
        "command": "rustscan",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "batch_size": {"flag": "-b", "type": "number", "default": 500, "description": "Batch size"},
            "timeout": {"flag": "-t", "type": "number", "default": 1500, "description": "Timeout in ms"},
        }
    },
    "unicornscan": {
        "name": "Unicornscan",
        "category": "information_gathering", 
        "subcategory": "port_scanning",
        "description": "Asynchronous TCP/UDP scanner",
        "plan_required": "professional",
        "command": "unicornscan",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "mode": {"flag": "-m", "type": "select", "options": ["T", "U", "A"], "default": "T", "description": "Scan mode"},
        }
    },
    "zenmap": {
        "name": "Zenmap",
        "category": "information_gathering",
        "subcategory": "port_scanning",
        "description": "GUI for Nmap",
        "plan_required": "starter",
        "command": "zenmap",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    
    # DNS Tools
    "whois": {
        "name": "Whois",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "Domain registration information lookup",
        "plan_required": "starter",
        "command": "whois",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "dig": {
        "name": "Dig",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "DNS lookup utility",
        "plan_required": "starter",
        "command": "dig",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "record_type": {"flag": "", "type": "select", "options": ["A", "AAAA", "MX", "NS", "TXT", "SOA", "ANY"], "default": "A", "description": "Record type"},
        }
    },
    "host": {
        "name": "Host",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "DNS lookup utility",
        "plan_required": "starter",
        "command": "host",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "nslookup": {
        "name": "NSLookup",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "Query DNS servers",
        "plan_required": "starter",
        "command": "nslookup",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "dnsrecon": {
        "name": "DNSRecon",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "DNS enumeration tool",
        "plan_required": "professional",
        "command": "dnsrecon",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "type": {"flag": "-t", "type": "select", "options": ["std", "rvl", "brt", "srv", "axfr", "bing", "yand", "crt", "snoop"], "default": "std", "description": "Enumeration type"},
        }
    },
    "dnsenum": {
        "name": "DNSEnum",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "DNS enumeration tool",
        "plan_required": "professional",
        "command": "dnsenum",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "fierce": {
        "name": "Fierce",
        "category": "information_gathering",
        "subcategory": "dns_analysis",
        "description": "DNS reconnaissance tool for locating non-contiguous IP space",
        "plan_required": "professional",
        "command": "fierce",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # OSINT & Recon Tools
    "theHarvester": {
        "name": "theHarvester",
        "category": "information_gathering",
        "subcategory": "osint",
        "description": "E-mail, subdomain and people names harvester",
        "plan_required": "professional",
        "command": "theHarvester",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "source": {"flag": "-b", "type": "select", "options": ["all", "google", "bing", "linkedin", "twitter", "shodan", "virustotal", "crtsh"], "default": "all", "description": "Data source"},
            "limit": {"flag": "-l", "type": "number", "default": 500, "description": "Limit results"},
        }
    },
    "recon-ng": {
        "name": "Recon-ng",
        "category": "information_gathering",
        "subcategory": "osint",
        "description": "Web reconnaissance framework",
        "plan_required": "professional",
        "command": "recon-ng",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "maltego": {
        "name": "Maltego",
        "category": "information_gathering",
        "subcategory": "osint",
        "description": "Interactive data mining tool",
        "plan_required": "enterprise",
        "command": "maltego",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "spiderfoot": {
        "name": "SpiderFoot",
        "category": "information_gathering",
        "subcategory": "osint",
        "description": "Open source intelligence automation tool",
        "plan_required": "team",
        "command": "spiderfoot",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "amass": {
        "name": "Amass",
        "category": "information_gathering",
        "subcategory": "subdomain_enum",
        "description": "In-depth attack surface mapping and asset discovery",
        "plan_required": "professional",
        "command": "amass",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "mode": {"flag": "", "type": "select", "options": ["enum", "intel", "track", "db"], "default": "enum", "description": "Operation mode"},
            "passive": {"flag": "-passive", "type": "boolean", "default": False, "description": "Passive mode only"},
        }
    },
    "subfinder": {
        "name": "Subfinder",
        "category": "information_gathering",
        "subcategory": "subdomain_enum",
        "description": "Subdomain discovery tool",
        "plan_required": "professional",
        "command": "subfinder",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "silent": {"flag": "-silent", "type": "boolean", "default": False, "description": "Silent mode"},
            "recursive": {"flag": "-recursive", "type": "boolean", "default": False, "description": "Recursive mode"},
        }
    },
    "sublist3r": {
        "name": "Sublist3r",
        "category": "information_gathering",
        "subcategory": "subdomain_enum",
        "description": "Fast subdomains enumeration tool",
        "plan_required": "professional",
        "command": "sublist3r",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "assetfinder": {
        "name": "Assetfinder",
        "category": "information_gathering",
        "subcategory": "subdomain_enum",
        "description": "Find domains and subdomains related to a given domain",
        "plan_required": "professional",
        "command": "assetfinder",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "massdns": {
        "name": "MassDNS",
        "category": "information_gathering",
        "subcategory": "subdomain_enum",
        "description": "High-performance DNS stub resolver",
        "plan_required": "team",
        "command": "massdns",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # Web Identification
    "whatweb": {
        "name": "WhatWeb",
        "category": "information_gathering",
        "subcategory": "web_fingerprinting",
        "description": "Web scanner to identify technologies",
        "plan_required": "starter",
        "command": "whatweb",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "aggression": {"flag": "-a", "type": "select", "options": ["1", "2", "3", "4"], "default": "1", "description": "Aggression level"},
            "verbose": {"flag": "-v", "type": "boolean", "default": False, "description": "Verbose output"},
        }
    },
    "wafw00f": {
        "name": "WafW00f",
        "category": "information_gathering",
        "subcategory": "web_fingerprinting",
        "description": "Web Application Firewall detection tool",
        "plan_required": "professional",
        "command": "wafw00f",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "httpx": {
        "name": "HTTPX",
        "category": "information_gathering",
        "subcategory": "web_fingerprinting",
        "description": "Fast and multi-purpose HTTP toolkit",
        "plan_required": "professional",
        "command": "httpx",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "status_code": {"flag": "-status-code", "type": "boolean", "default": True, "description": "Show status code"},
            "title": {"flag": "-title", "type": "boolean", "default": True, "description": "Show page title"},
            "tech_detect": {"flag": "-tech-detect", "type": "boolean", "default": False, "description": "Technology detection"},
        }
    },
    "exiftool": {
        "name": "ExifTool",
        "category": "information_gathering",
        "subcategory": "metadata",
        "description": "Read, write and edit metadata",
        "plan_required": "starter",
        "command": "exiftool",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # SMB/Network Enum
    "enum4linux": {
        "name": "Enum4linux",
        "category": "information_gathering",
        "subcategory": "smb_enum",
        "description": "Windows/Samba enumeration tool",
        "plan_required": "professional",
        "command": "enum4linux",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "all": {"flag": "-a", "type": "boolean", "default": True, "description": "All enumeration"},
        }
    },
    "enum4linux-ng": {
        "name": "Enum4linux-ng",
        "category": "information_gathering",
        "subcategory": "smb_enum",
        "description": "Next-gen Windows/Samba enumeration tool",
        "plan_required": "professional",
        "command": "enum4linux-ng",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "all": {"flag": "-A", "type": "boolean", "default": True, "description": "All enumeration"},
        }
    },
    "nbtscan": {
        "name": "NBTScan",
        "category": "information_gathering",
        "subcategory": "smb_enum",
        "description": "NetBIOS name network scanner",
        "plan_required": "professional",
        "command": "nbtscan",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "smbclient": {
        "name": "SMBClient",
        "category": "information_gathering",
        "subcategory": "smb_enum",
        "description": "FTP-like client to access SMB/CIFS resources",
        "plan_required": "professional",
        "command": "smbclient",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "list": {"flag": "-L", "type": "boolean", "default": True, "description": "List shares"},
            "no_pass": {"flag": "-N", "type": "boolean", "default": False, "description": "No password"},
        }
    },
    "smbmap": {
        "name": "SMBMap",
        "category": "information_gathering",
        "subcategory": "smb_enum",
        "description": "SMB share enumeration tool",
        "plan_required": "professional",
        "command": "smbmap",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # SNMP
    "snmpwalk": {
        "name": "SNMPWalk",
        "category": "information_gathering",
        "subcategory": "snmp",
        "description": "Retrieve SNMP data from a network entity",
        "plan_required": "professional",
        "command": "snmpwalk",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "version": {"flag": "-v", "type": "select", "options": ["1", "2c", "3"], "default": "2c", "description": "SNMP version"},
            "community": {"flag": "-c", "type": "text", "default": "public", "description": "Community string"},
        }
    },
    "onesixtyone": {
        "name": "Onesixtyone",
        "category": "information_gathering",
        "subcategory": "snmp",
        "description": "Fast SNMP scanner",
        "plan_required": "professional",
        "command": "onesixtyone",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # LDAP
    "ldapsearch": {
        "name": "LDAPSearch",
        "category": "information_gathering",
        "subcategory": "ldap",
        "description": "LDAP search tool",
        "plan_required": "professional",
        "command": "ldapsearch",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "ldapdomaindump": {
        "name": "LDAPDomainDump",
        "category": "information_gathering",
        "subcategory": "ldap",
        "description": "Active Directory information dumper via LDAP",
        "plan_required": "team",
        "command": "ldapdomaindump",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # =========================================================================
    # VULNERABILITY ANALYSIS - 30+ Tools
    # =========================================================================
    "nikto": {
        "name": "Nikto",
        "category": "vulnerability_analysis",
        "subcategory": "web_vulnerability",
        "description": "Web server scanner for vulnerabilities",
        "plan_required": "starter",
        "command": "nikto",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "host": {"flag": "-h", "type": "target", "description": "Target host"},
            "port": {"flag": "-p", "type": "text", "default": "80", "description": "Port"},
            "ssl": {"flag": "-ssl", "type": "boolean", "default": False, "description": "Use SSL"},
            "tuning": {"flag": "-Tuning", "type": "select", "options": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "x"], "default": "x", "description": "Scan tuning"},
        }
    },
    "nuclei": {
        "name": "Nuclei",
        "category": "vulnerability_analysis",
        "subcategory": "web_vulnerability",
        "description": "Fast and customizable vulnerability scanner",
        "plan_required": "professional",
        "command": "nuclei",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "templates": {"flag": "-t", "type": "text", "default": "", "description": "Template path"},
            "severity": {"flag": "-s", "type": "select", "options": ["info", "low", "medium", "high", "critical"], "default": "medium,high,critical", "description": "Severity filter"},
            "rate_limit": {"flag": "-rl", "type": "number", "default": 150, "description": "Rate limit"},
        }
    },
    "openvas": {
        "name": "OpenVAS",
        "category": "vulnerability_analysis",
        "subcategory": "network_vulnerability",
        "description": "Full-featured vulnerability scanner",
        "plan_required": "enterprise",
        "command": "openvas",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "wpscan": {
        "name": "WPScan",
        "category": "vulnerability_analysis",
        "subcategory": "cms_vulnerability",
        "description": "WordPress vulnerability scanner",
        "plan_required": "professional",
        "command": "wpscan",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "enumerate": {"flag": "-e", "type": "select", "options": ["vp", "vt", "u", "ap", "at", "cb", "dbe"], "default": "vp,vt,u", "description": "Enumerate"},
            "api_token": {"flag": "--api-token", "type": "text", "default": "", "description": "WPScan API token"},
        }
    },
    "joomscan": {
        "name": "JoomScan",
        "category": "vulnerability_analysis",
        "subcategory": "cms_vulnerability",
        "description": "Joomla vulnerability scanner",
        "plan_required": "professional",
        "command": "joomscan",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "enumerate": {"flag": "-ec", "type": "boolean", "default": True, "description": "Enumerate components"},
        }
    },
    "sqlmap": {
        "name": "SQLMap",
        "category": "vulnerability_analysis",
        "subcategory": "injection",
        "description": "Automatic SQL injection tool",
        "plan_required": "professional",
        "command": "sqlmap",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "url": {"flag": "-u", "type": "target", "description": "Target URL"},
            "level": {"flag": "--level", "type": "select", "options": ["1", "2", "3", "4", "5"], "default": "1", "description": "Level"},
            "risk": {"flag": "--risk", "type": "select", "options": ["1", "2", "3"], "default": "1", "description": "Risk"},
            "dbs": {"flag": "--dbs", "type": "boolean", "default": False, "description": "Enumerate databases"},
            "batch": {"flag": "--batch", "type": "boolean", "default": True, "description": "Batch mode"},
        }
    },
    "commix": {
        "name": "Commix",
        "category": "vulnerability_analysis",
        "subcategory": "injection",
        "description": "Command injection exploiter",
        "plan_required": "team",
        "command": "commix",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "url": {"flag": "-u", "type": "target", "description": "Target URL"},
            "level": {"flag": "--level", "type": "select", "options": ["1", "2", "3"], "default": "1", "description": "Level"},
        }
    },
    "sslyze": {
        "name": "SSLyze",
        "category": "vulnerability_analysis",
        "subcategory": "ssl_analysis",
        "description": "Fast and powerful SSL/TLS scanning",
        "plan_required": "professional",
        "command": "sslyze",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "regular": {"flag": "--regular", "type": "boolean", "default": True, "description": "Regular scan"},
        }
    },
    "sslscan": {
        "name": "SSLScan",
        "category": "vulnerability_analysis",
        "subcategory": "ssl_analysis",
        "description": "SSL/TLS scanner",
        "plan_required": "starter",
        "command": "sslscan",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "no_color": {"flag": "--no-colour", "type": "boolean", "default": True, "description": "No color output"},
        }
    },
    "testssl.sh": {
        "name": "TestSSL.sh",
        "category": "vulnerability_analysis",
        "subcategory": "ssl_analysis",
        "description": "Testing TLS/SSL encryption",
        "plan_required": "professional",
        "command": "testssl.sh",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "searchsploit": {
        "name": "SearchSploit",
        "category": "vulnerability_analysis",
        "subcategory": "exploit_database",
        "description": "Search Exploit-DB archive",
        "plan_required": "professional",
        "command": "searchsploit",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "json": {"flag": "--json", "type": "boolean", "default": True, "description": "JSON output"},
        }
    },
    "lynis": {
        "name": "Lynis",
        "category": "vulnerability_analysis",
        "subcategory": "system_audit",
        "description": "Security auditing tool for Unix/Linux",
        "plan_required": "professional",
        "command": "lynis",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "audit": {"flag": "audit", "type": "select", "options": ["system", "dockerfile"], "default": "system", "description": "Audit type"},
        }
    },
    
    # =========================================================================
    # WEB APPLICATION ANALYSIS - 25+ Tools
    # =========================================================================
    "burpsuite": {
        "name": "Burp Suite",
        "category": "web_application",
        "subcategory": "proxy",
        "description": "Web security testing platform",
        "plan_required": "professional",
        "command": "burpsuite",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "zaproxy": {
        "name": "OWASP ZAP",
        "category": "web_application",
        "subcategory": "proxy",
        "description": "OWASP Zed Attack Proxy",
        "plan_required": "professional",
        "command": "zaproxy",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "mitmproxy": {
        "name": "MITMProxy",
        "category": "web_application",
        "subcategory": "proxy",
        "description": "Interactive HTTPS proxy",
        "plan_required": "professional",
        "command": "mitmproxy",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "gobuster": {
        "name": "Gobuster",
        "category": "web_application",
        "subcategory": "directory_brute",
        "description": "Directory/file & DNS busting tool",
        "plan_required": "professional",
        "command": "gobuster",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "mode": {"flag": "", "type": "select", "options": ["dir", "dns", "vhost"], "default": "dir", "description": "Mode"},
            "wordlist": {"flag": "-w", "type": "select", "options": ["/usr/share/wordlists/dirb/common.txt", "/usr/share/wordlists/dirb/big.txt", "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt"], "default": "/usr/share/wordlists/dirb/common.txt", "description": "Wordlist"},
            "threads": {"flag": "-t", "type": "number", "default": 10, "min": 1, "max": 50, "description": "Threads"},
            "extensions": {"flag": "-x", "type": "text", "default": "php,html,txt", "description": "Extensions"},
        }
    },
    "ffuf": {
        "name": "FFUF",
        "category": "web_application",
        "subcategory": "directory_brute",
        "description": "Fast web fuzzer",
        "plan_required": "professional",
        "command": "ffuf",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "-w", "type": "text", "default": "/usr/share/wordlists/dirb/common.txt", "description": "Wordlist"},
            "threads": {"flag": "-t", "type": "number", "default": 40, "min": 1, "max": 200, "description": "Threads"},
            "rate": {"flag": "-rate", "type": "number", "default": 0, "description": "Rate limit"},
        }
    },
    "feroxbuster": {
        "name": "Feroxbuster",
        "category": "web_application",
        "subcategory": "directory_brute",
        "description": "Fast, simple, recursive content discovery tool",
        "plan_required": "professional",
        "command": "feroxbuster",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "-w", "type": "text", "default": "/usr/share/wordlists/dirb/common.txt", "description": "Wordlist"},
            "threads": {"flag": "-t", "type": "number", "default": 50, "description": "Threads"},
            "depth": {"flag": "-d", "type": "number", "default": 2, "description": "Recursion depth"},
        }
    },
    "dirb": {
        "name": "DIRB",
        "category": "web_application",
        "subcategory": "directory_brute",
        "description": "Web content scanner",
        "plan_required": "starter",
        "command": "dirb",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "", "type": "text", "default": "/usr/share/wordlists/dirb/common.txt", "description": "Wordlist"},
        }
    },
    "dirbuster": {
        "name": "DirBuster",
        "category": "web_application",
        "subcategory": "directory_brute",
        "description": "Multi-threaded web content brute forcer",
        "plan_required": "professional",
        "command": "dirbuster",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "wfuzz": {
        "name": "WFuzz",
        "category": "web_application",
        "subcategory": "fuzzing",
        "description": "Web application fuzzer",
        "plan_required": "professional",
        "command": "wfuzz",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "-w", "type": "text", "default": "/usr/share/wordlists/dirb/common.txt", "description": "Wordlist"},
            "hide_code": {"flag": "--hc", "type": "text", "default": "404", "description": "Hide response codes"},
        }
    },
    
    # =========================================================================
    # PASSWORD ATTACKS - 35+ Tools
    # =========================================================================
    "john": {
        "name": "John the Ripper",
        "category": "password_attacks",
        "subcategory": "offline_cracking",
        "description": "Password cracker",
        "plan_required": "professional",
        "command": "john",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "--wordlist", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Wordlist"},
            "format": {"flag": "--format", "type": "text", "default": "", "description": "Hash format"},
        }
    },
    "hashcat": {
        "name": "Hashcat",
        "category": "password_attacks",
        "subcategory": "offline_cracking",
        "description": "Advanced password recovery utility",
        "plan_required": "professional",
        "command": "hashcat",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "attack_mode": {"flag": "-a", "type": "select", "options": ["0", "1", "3", "6", "7"], "default": "0", "description": "Attack mode"},
            "hash_type": {"flag": "-m", "type": "number", "default": 0, "description": "Hash type"},
            "wordlist": {"flag": "", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Wordlist"},
        }
    },
    "hydra": {
        "name": "Hydra",
        "category": "password_attacks",
        "subcategory": "online_cracking",
        "description": "Fast and flexible online password cracking tool",
        "plan_required": "professional",
        "command": "hydra",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "login": {"flag": "-l", "type": "text", "default": "admin", "description": "Username"},
            "pass_list": {"flag": "-P", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Password list"},
            "service": {"flag": "", "type": "select", "options": ["ssh", "ftp", "http-get", "http-post", "mysql", "smb", "rdp"], "default": "ssh", "description": "Service"},
            "threads": {"flag": "-t", "type": "number", "default": 16, "min": 1, "max": 64, "description": "Threads"},
        }
    },
    "medusa": {
        "name": "Medusa",
        "category": "password_attacks",
        "subcategory": "online_cracking",
        "description": "Speedy, massively parallel, modular, login brute-forcer",
        "plan_required": "professional",
        "command": "medusa",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "username": {"flag": "-u", "type": "text", "default": "admin", "description": "Username"},
            "pass_file": {"flag": "-P", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Password file"},
            "module": {"flag": "-M", "type": "select", "options": ["ssh", "ftp", "http", "mysql", "smb"], "default": "ssh", "description": "Module"},
        }
    },
    "ncrack": {
        "name": "Ncrack",
        "category": "password_attacks",
        "subcategory": "online_cracking",
        "description": "High-speed network authentication cracking tool",
        "plan_required": "professional",
        "command": "ncrack",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "user": {"flag": "-U", "type": "text", "default": "", "description": "Username file"},
            "pass": {"flag": "-P", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Password file"},
        }
    },
    "patator": {
        "name": "Patator",
        "category": "password_attacks",
        "subcategory": "online_cracking",
        "description": "Multi-purpose brute-forcer",
        "plan_required": "professional",
        "command": "patator",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "hashid": {
        "name": "HashID",
        "category": "password_attacks",
        "subcategory": "hash_identification",
        "description": "Identify the different types of hashes",
        "plan_required": "starter",
        "command": "hashid",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "hash-identifier": {
        "name": "Hash-Identifier",
        "category": "password_attacks",
        "subcategory": "hash_identification",
        "description": "Software to identify hash types",
        "plan_required": "starter",
        "command": "hash-identifier",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "crunch": {
        "name": "Crunch",
        "category": "password_attacks",
        "subcategory": "wordlist_generation",
        "description": "Wordlist generator",
        "plan_required": "professional",
        "command": "crunch",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "min": {"flag": "", "type": "number", "default": 6, "description": "Minimum length"},
            "max": {"flag": "", "type": "number", "default": 8, "description": "Maximum length"},
            "charset": {"flag": "", "type": "text", "default": "abcdefghijklmnopqrstuvwxyz0123456789", "description": "Character set"},
        }
    },
    "cewl": {
        "name": "CeWL",
        "category": "password_attacks",
        "subcategory": "wordlist_generation",
        "description": "Custom word list generator",
        "plan_required": "professional",
        "command": "cewl",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "depth": {"flag": "-d", "type": "number", "default": 2, "description": "Depth"},
            "min_word_length": {"flag": "-m", "type": "number", "default": 6, "description": "Min word length"},
        }
    },
    "cupp": {
        "name": "CUPP",
        "category": "password_attacks",
        "subcategory": "wordlist_generation",
        "description": "Common User Passwords Profiler",
        "plan_required": "professional",
        "command": "cupp",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "interactive": {"flag": "-i", "type": "boolean", "default": True, "description": "Interactive mode"},
        }
    },
    "responder": {
        "name": "Responder",
        "category": "password_attacks",
        "subcategory": "network_capture",
        "description": "LLMNR, NBT-NS and MDNS poisoner",
        "plan_required": "team",
        "command": "responder",
        "dangerous": True,
        "requires_root": True,
        "parameters": {
            "interface": {"flag": "-I", "type": "text", "default": "eth0", "description": "Interface"},
        }
    },
    "mimikatz": {
        "name": "Mimikatz",
        "category": "password_attacks",
        "subcategory": "credential_extraction",
        "description": "Windows credential extractor",
        "plan_required": "team",
        "command": "mimikatz",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "pypykatz": {
        "name": "PyPyKatz",
        "category": "password_attacks",
        "subcategory": "credential_extraction",
        "description": "Python implementation of Mimikatz",
        "plan_required": "team",
        "command": "pypykatz",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "fcrackzip": {
        "name": "FCrackZip",
        "category": "password_attacks",
        "subcategory": "archive_cracking",
        "description": "ZIP password cracker",
        "plan_required": "professional",
        "command": "fcrackzip",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "wordlist": {"flag": "-D", "type": "boolean", "default": True, "description": "Dictionary attack"},
            "dictionary": {"flag": "-p", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Dictionary file"},
        }
    },
    
    # =========================================================================
    # WIRELESS ATTACKS - 20+ Tools
    # =========================================================================
    "aircrack-ng": {
        "name": "Aircrack-ng",
        "category": "wireless_attacks",
        "subcategory": "wifi_cracking",
        "description": "WiFi security auditing tool suite",
        "plan_required": "professional",
        "command": "aircrack-ng",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "wordlist": {"flag": "-w", "type": "text", "default": "/usr/share/wordlists/rockyou.txt", "description": "Wordlist"},
        }
    },
    "airmon-ng": {
        "name": "Airmon-ng",
        "category": "wireless_attacks",
        "subcategory": "wifi_monitoring",
        "description": "Enable monitor mode on wireless interfaces",
        "plan_required": "professional",
        "command": "airmon-ng",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "airodump-ng": {
        "name": "Airodump-ng",
        "category": "wireless_attacks",
        "subcategory": "wifi_monitoring",
        "description": "Packet capture for wireless",
        "plan_required": "professional",
        "command": "airodump-ng",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "aireplay-ng": {
        "name": "Aireplay-ng",
        "category": "wireless_attacks",
        "subcategory": "wifi_injection",
        "description": "Packet injection for wireless",
        "plan_required": "professional",
        "command": "aireplay-ng",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "wifite": {
        "name": "Wifite",
        "category": "wireless_attacks",
        "subcategory": "wifi_cracking",
        "description": "Automated wireless attack tool",
        "plan_required": "professional",
        "command": "wifite",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "reaver": {
        "name": "Reaver",
        "category": "wireless_attacks",
        "subcategory": "wps_attacks",
        "description": "WPS brute force attack tool",
        "plan_required": "professional",
        "command": "reaver",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "bully": {
        "name": "Bully",
        "category": "wireless_attacks",
        "subcategory": "wps_attacks",
        "description": "WPS brute force attack tool",
        "plan_required": "professional",
        "command": "bully",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "pixiewps": {
        "name": "Pixiewps",
        "category": "wireless_attacks",
        "subcategory": "wps_attacks",
        "description": "Pixie Dust attack offline WPS bruteforce",
        "plan_required": "professional",
        "command": "pixiewps",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "kismet": {
        "name": "Kismet",
        "category": "wireless_attacks",
        "subcategory": "wifi_monitoring",
        "description": "Wireless network detector, sniffer, wardriving tool",
        "plan_required": "professional",
        "command": "kismet",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "wireshark": {
        "name": "Wireshark",
        "category": "sniffing_spoofing",
        "subcategory": "packet_capture",
        "description": "Network protocol analyzer",
        "plan_required": "professional",
        "command": "wireshark",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "tshark": {
        "name": "TShark",
        "category": "sniffing_spoofing",
        "subcategory": "packet_capture",
        "description": "Terminal-based Wireshark",
        "plan_required": "professional",
        "command": "tshark",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "interface": {"flag": "-i", "type": "text", "default": "eth0", "description": "Interface"},
            "count": {"flag": "-c", "type": "number", "default": 100, "description": "Packet count"},
        }
    },
    "hcxdumptool": {
        "name": "Hcxdumptool",
        "category": "wireless_attacks",
        "subcategory": "wifi_capture",
        "description": "Small tool to capture packets from wlan devices",
        "plan_required": "professional",
        "command": "hcxdumptool",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "cowpatty": {
        "name": "Cowpatty",
        "category": "wireless_attacks",
        "subcategory": "wifi_cracking",
        "description": "WPA-PSK dictionary attack tool",
        "plan_required": "professional",
        "command": "cowpatty",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # =========================================================================
    # SNIFFING & SPOOFING - 15+ Tools  
    # =========================================================================
    "tcpdump": {
        "name": "Tcpdump",
        "category": "sniffing_spoofing",
        "subcategory": "packet_capture",
        "description": "Packet analyzer",
        "plan_required": "professional",
        "command": "tcpdump",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "interface": {"flag": "-i", "type": "text", "default": "any", "description": "Interface"},
            "count": {"flag": "-c", "type": "number", "default": 100, "description": "Packet count"},
            "verbose": {"flag": "-v", "type": "boolean", "default": True, "description": "Verbose output"},
        }
    },
    "ettercap": {
        "name": "Ettercap",
        "category": "sniffing_spoofing",
        "subcategory": "mitm",
        "description": "Comprehensive suite for man-in-the-middle attacks",
        "plan_required": "team",
        "command": "ettercap",
        "dangerous": True,
        "requires_root": True,
        "parameters": {
            "text": {"flag": "-T", "type": "boolean", "default": True, "description": "Text mode"},
            "quiet": {"flag": "-q", "type": "boolean", "default": True, "description": "Quiet mode"},
        }
    },
    "bettercap": {
        "name": "Bettercap",
        "category": "sniffing_spoofing",
        "subcategory": "mitm",
        "description": "Swiss army knife for network attacks",
        "plan_required": "team",
        "command": "bettercap",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "arpspoof": {
        "name": "ARPSpoof",
        "category": "sniffing_spoofing",
        "subcategory": "spoofing",
        "description": "Intercept packets by ARP spoofing",
        "plan_required": "team",
        "command": "arpspoof",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "dsniff": {
        "name": "Dsniff",
        "category": "sniffing_spoofing",
        "subcategory": "password_sniffing",
        "description": "Password sniffer",
        "plan_required": "team",
        "command": "dsniff",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "sslsplit": {
        "name": "SSLSplit",
        "category": "sniffing_spoofing",
        "subcategory": "ssl_interception",
        "description": "Transparent SSL/TLS interception",
        "plan_required": "team",
        "command": "sslsplit",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "macchanger": {
        "name": "MAC Changer",
        "category": "sniffing_spoofing",
        "subcategory": "spoofing",
        "description": "GNU MAC address manipulation utility",
        "plan_required": "professional",
        "command": "macchanger",
        "dangerous": False,
        "requires_root": True,
        "parameters": {
            "random": {"flag": "-r", "type": "boolean", "default": True, "description": "Random MAC"},
        }
    },
    "dnschef": {
        "name": "DNSChef",
        "category": "sniffing_spoofing",
        "subcategory": "dns_spoofing",
        "description": "DNS proxy for penetration testers",
        "plan_required": "team",
        "command": "dnschef",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "yersinia": {
        "name": "Yersinia",
        "category": "sniffing_spoofing",
        "subcategory": "layer2_attacks",
        "description": "Network tool designed to take advantage of weaknesses in layer 2 protocols",
        "plan_required": "enterprise",
        "command": "yersinia",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    
    # =========================================================================
    # EXPLOITATION - 20+ Tools
    # =========================================================================
    "msfconsole": {
        "name": "Metasploit Framework",
        "category": "exploitation",
        "subcategory": "framework",
        "description": "Penetration testing framework",
        "plan_required": "team",
        "command": "msfconsole",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "msfvenom": {
        "name": "MSFVenom",
        "category": "exploitation",
        "subcategory": "payload_generation",
        "description": "Payload generator",
        "plan_required": "team",
        "command": "msfvenom",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "payload": {"flag": "-p", "type": "text", "default": "linux/x86/meterpreter/reverse_tcp", "description": "Payload"},
            "format": {"flag": "-f", "type": "select", "options": ["elf", "exe", "raw", "py", "bash"], "default": "elf", "description": "Format"},
            "lhost": {"flag": "LHOST=", "type": "text", "default": "", "description": "Local host"},
            "lport": {"flag": "LPORT=", "type": "number", "default": 4444, "description": "Local port"},
        }
    },
    "setoolkit": {
        "name": "Social Engineering Toolkit",
        "category": "exploitation",
        "subcategory": "social_engineering",
        "description": "Advanced social engineering attack framework",
        "plan_required": "team",
        "command": "setoolkit",
        "dangerous": True,
        "requires_root": True,
        "parameters": {}
    },
    "gophish": {
        "name": "GoPhish",
        "category": "exploitation",
        "subcategory": "phishing",
        "description": "Phishing framework",
        "plan_required": "team",
        "command": "gophish",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "crackmapexec": {
        "name": "CrackMapExec",
        "category": "exploitation",
        "subcategory": "network_exploitation",
        "description": "Swiss army knife for pentesting networks",
        "plan_required": "team",
        "command": "crackmapexec",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "protocol": {"flag": "", "type": "select", "options": ["smb", "winrm", "mssql", "ldap", "ssh"], "default": "smb", "description": "Protocol"},
        }
    },
    "evil-winrm": {
        "name": "Evil-WinRM",
        "category": "exploitation",
        "subcategory": "windows_exploitation",
        "description": "Ultimate WinRM shell for hacking/pentesting",
        "plan_required": "team",
        "command": "evil-winrm",
        "dangerous": True,
        "requires_root": False,
        "parameters": {
            "user": {"flag": "-u", "type": "text", "default": "Administrator", "description": "Username"},
            "password": {"flag": "-p", "type": "text", "default": "", "description": "Password"},
        }
    },
    "starkiller": {
        "name": "Starkiller",
        "category": "exploitation",
        "subcategory": "c2_framework",
        "description": "GUI frontend for PowerShell Empire",
        "plan_required": "enterprise",
        "command": "starkiller",
        "dangerous": True,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "unicorn-magic": {
        "name": "Unicorn",
        "category": "exploitation",
        "subcategory": "payload_generation",
        "description": "PowerShell downgrade attack and shellcode injection",
        "plan_required": "team",
        "command": "unicorn-magic",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    
    # =========================================================================
    # POST EXPLOITATION - 15+ Tools
    # =========================================================================
    "bloodhound": {
        "name": "BloodHound",
        "category": "post_exploitation",
        "subcategory": "ad_enumeration",
        "description": "Active Directory reconnaissance tool",
        "plan_required": "team",
        "command": "bloodhound",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "powershell-empire": {
        "name": "PowerShell Empire",
        "category": "post_exploitation",
        "subcategory": "c2_framework",
        "description": "Post-exploitation framework",
        "plan_required": "enterprise",
        "command": "powershell-empire",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "linpeas": {
        "name": "LinPEAS",
        "category": "post_exploitation",
        "subcategory": "privilege_escalation",
        "description": "Linux Privilege Escalation Awesome Script",
        "plan_required": "professional",
        "command": "linpeas",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "winpeas": {
        "name": "WinPEAS",
        "category": "post_exploitation",
        "subcategory": "privilege_escalation",
        "description": "Windows Privilege Escalation Awesome Script",
        "plan_required": "professional",
        "command": "winpeas",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "weevely": {
        "name": "Weevely",
        "category": "post_exploitation",
        "subcategory": "webshell",
        "description": "Weaponized web shell",
        "plan_required": "team",
        "command": "weevely",
        "dangerous": True,
        "requires_root": False,
        "parameters": {}
    },
    "chisel": {
        "name": "Chisel",
        "category": "post_exploitation",
        "subcategory": "tunneling",
        "description": "Fast TCP/UDP tunnel over HTTP",
        "plan_required": "team",
        "command": "chisel",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # =========================================================================
    # FORENSICS - 20+ Tools
    # =========================================================================
    "autopsy": {
        "name": "Autopsy",
        "category": "forensics",
        "subcategory": "disk_forensics",
        "description": "Digital forensics platform",
        "plan_required": "professional",
        "command": "autopsy",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "binwalk": {
        "name": "Binwalk",
        "category": "forensics",
        "subcategory": "firmware_analysis",
        "description": "Firmware analysis tool",
        "plan_required": "professional",
        "command": "binwalk",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "extract": {"flag": "-e", "type": "boolean", "default": False, "description": "Extract files"},
            "matryoshka": {"flag": "-M", "type": "boolean", "default": False, "description": "Recursive extract"},
        }
    },
    "foremost": {
        "name": "Foremost",
        "category": "forensics",
        "subcategory": "file_carving",
        "description": "File recovery based on headers and footers",
        "plan_required": "professional",
        "command": "foremost",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "scalpel": {
        "name": "Scalpel",
        "category": "forensics",
        "subcategory": "file_carving",
        "description": "Fast file carving tool",
        "plan_required": "professional",
        "command": "scalpel",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "bulk_extractor": {
        "name": "Bulk Extractor",
        "category": "forensics",
        "subcategory": "data_extraction",
        "description": "Extracts email addresses, URLs, credit card numbers",
        "plan_required": "professional",
        "command": "bulk_extractor",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "pdfid": {
        "name": "PDFiD",
        "category": "forensics",
        "subcategory": "pdf_analysis",
        "description": "Scan PDF for suspicious elements",
        "plan_required": "professional",
        "command": "pdfid",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "pdf-parser": {
        "name": "PDF Parser",
        "category": "forensics",
        "subcategory": "pdf_analysis",
        "description": "Parse PDF documents",
        "plan_required": "professional",
        "command": "pdf-parser",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "steghide": {
        "name": "Steghide",
        "category": "forensics",
        "subcategory": "steganography",
        "description": "Steganography program",
        "plan_required": "professional",
        "command": "steghide",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "extract": {"flag": "extract", "type": "boolean", "default": True, "description": "Extract mode"},
            "passphrase": {"flag": "-p", "type": "text", "default": "", "description": "Passphrase"},
        }
    },
    "strings": {
        "name": "Strings",
        "category": "forensics",
        "subcategory": "binary_analysis",
        "description": "Print printable strings in files",
        "plan_required": "starter",
        "command": "strings",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "hexdump": {
        "name": "Hexdump",
        "category": "forensics",
        "subcategory": "binary_analysis",
        "description": "Display file contents in hexadecimal",
        "plan_required": "starter",
        "command": "hexdump",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "canonical": {"flag": "-C", "type": "boolean", "default": True, "description": "Canonical format"},
        }
    },
    "xxd": {
        "name": "XXD",
        "category": "forensics",
        "subcategory": "binary_analysis",
        "description": "Make hexdump or reverse",
        "plan_required": "starter",
        "command": "xxd",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "testdisk": {
        "name": "TestDisk",
        "category": "forensics",
        "subcategory": "disk_recovery",
        "description": "Data recovery software",
        "plan_required": "professional",
        "command": "testdisk",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "photorec": {
        "name": "PhotoRec",
        "category": "forensics",
        "subcategory": "file_recovery",
        "description": "File data recovery software",
        "plan_required": "professional",
        "command": "photorec",
        "dangerous": False,
        "requires_root": True,
        "parameters": {}
    },
    "yara": {
        "name": "YARA",
        "category": "forensics",
        "subcategory": "malware_analysis",
        "description": "Pattern matching swiss knife for malware researchers",
        "plan_required": "team",
        "command": "yara",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    
    # =========================================================================
    # REVERSE ENGINEERING - 10+ Tools
    # =========================================================================
    "radare2": {
        "name": "Radare2",
        "category": "reverse_engineering",
        "subcategory": "disassembly",
        "description": "Advanced command-line hexadecimal editor and disassembler",
        "plan_required": "professional",
        "command": "radare2",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "r2": {
        "name": "r2",
        "category": "reverse_engineering",
        "subcategory": "disassembly",
        "description": "Radare2 shorthand command",
        "plan_required": "professional",
        "command": "r2",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "ghidra": {
        "name": "Ghidra",
        "category": "reverse_engineering",
        "subcategory": "disassembly",
        "description": "Software reverse engineering framework",
        "plan_required": "team",
        "command": "ghidra",
        "dangerous": False,
        "requires_root": False,
        "gui_only": True,
        "parameters": {}
    },
    "gdb": {
        "name": "GDB",
        "category": "reverse_engineering",
        "subcategory": "debugging",
        "description": "GNU Debugger",
        "plan_required": "professional",
        "command": "gdb",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "objdump": {
        "name": "Objdump",
        "category": "reverse_engineering",
        "subcategory": "binary_analysis",
        "description": "Display information from object files",
        "plan_required": "professional",
        "command": "objdump",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "disassemble": {"flag": "-d", "type": "boolean", "default": True, "description": "Disassemble"},
        }
    },
    "readelf": {
        "name": "Readelf",
        "category": "reverse_engineering",
        "subcategory": "binary_analysis",
        "description": "Display information about ELF files",
        "plan_required": "professional",
        "command": "readelf",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "all": {"flag": "-a", "type": "boolean", "default": True, "description": "All information"},
        }
    },
    "nm": {
        "name": "nm",
        "category": "reverse_engineering",
        "subcategory": "binary_analysis",
        "description": "List symbols from object files",
        "plan_required": "professional",
        "command": "nm",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "ltrace": {
        "name": "ltrace",
        "category": "reverse_engineering",
        "subcategory": "tracing",
        "description": "Library call tracer",
        "plan_required": "professional",
        "command": "ltrace",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "strace": {
        "name": "strace",
        "category": "reverse_engineering",
        "subcategory": "tracing",
        "description": "System call tracer",
        "plan_required": "professional",
        "command": "strace",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "upx": {
        "name": "UPX",
        "category": "reverse_engineering",
        "subcategory": "packing",
        "description": "Ultimate packer for executables",
        "plan_required": "professional",
        "command": "upx",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "decompress": {"flag": "-d", "type": "boolean", "default": True, "description": "Decompress"},
        }
    },
    
    # =========================================================================
    # REPORTING - 5+ Tools
    # =========================================================================
    "faraday": {
        "name": "Faraday",
        "category": "reporting",
        "subcategory": "vulnerability_management",
        "description": "Collaborative penetration test and vulnerability management platform",
        "plan_required": "team",
        "command": "faraday",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "pipal": {
        "name": "Pipal",
        "category": "reporting",
        "subcategory": "password_analysis",
        "description": "Password analyzer",
        "plan_required": "professional",
        "command": "pipal",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "cutycapt": {
        "name": "CutyCapt",
        "category": "reporting",
        "subcategory": "screenshot",
        "description": "Utility to capture webpage screenshots",
        "plan_required": "professional",
        "command": "cutycapt",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "url": {"flag": "--url=", "type": "target", "description": "URL to capture"},
            "out": {"flag": "--out=", "type": "text", "default": "screenshot.png", "description": "Output file"},
        }
    },
    
    # =========================================================================
    # NETWORKING TOOLS - 10+ Tools
    # =========================================================================
    "netcat": {
        "name": "Netcat",
        "category": "networking",
        "subcategory": "networking",
        "description": "TCP/IP swiss army knife",
        "plan_required": "starter",
        "command": "nc",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "listen": {"flag": "-l", "type": "boolean", "default": False, "description": "Listen mode"},
            "verbose": {"flag": "-v", "type": "boolean", "default": True, "description": "Verbose"},
            "port": {"flag": "-p", "type": "number", "default": 4444, "description": "Port"},
        }
    },
    "socat": {
        "name": "Socat",
        "category": "networking",
        "subcategory": "networking",
        "description": "Multipurpose relay",
        "plan_required": "professional",
        "command": "socat",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "proxychains": {
        "name": "ProxyChains",
        "category": "networking",
        "subcategory": "proxy",
        "description": "Redirect connections through proxy servers",
        "plan_required": "professional",
        "command": "proxychains",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
    "curl": {
        "name": "cURL",
        "category": "networking",
        "subcategory": "http",
        "description": "Transfer data with URLs",
        "plan_required": "starter",
        "command": "curl",
        "dangerous": False,
        "requires_root": False,
        "parameters": {
            "verbose": {"flag": "-v", "type": "boolean", "default": False, "description": "Verbose"},
            "headers": {"flag": "-I", "type": "boolean", "default": False, "description": "Headers only"},
            "follow": {"flag": "-L", "type": "boolean", "default": True, "description": "Follow redirects"},
        }
    },
    "wget": {
        "name": "Wget",
        "category": "networking",
        "subcategory": "http",
        "description": "Network downloader",
        "plan_required": "starter",
        "command": "wget",
        "dangerous": False,
        "requires_root": False,
        "parameters": {}
    },
}

# Plan hierarchy for tool access
PLAN_HIERARCHY = {
    "trial": 1,
    "starter": 2,
    "professional": 3,
    "team": 4,
    "enterprise": 5
}

class ToolRegistry:
    """Manages Kali Linux security tools registry"""
    
    def __init__(self, cache_file: str = "/tmp/cybersec_tool_cache.json"):
        self.cache_file = cache_file
        self.tools: Dict[str, Dict] = {}
        self.categories: Dict[str, List[str]] = {}
        self._load_cache()
    
    def _load_cache(self):
        """Load tool cache from file"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    self.tools = data.get('tools', {})
                    self.categories = data.get('categories', {})
                    cache_time = data.get('cache_time', 0)
                    # Cache valid for 1 hour
                    if time.time() - cache_time < 3600:
                        return
            except Exception as e:
                logger.error(f"Failed to load tool cache: {e}")
        
        # Rebuild cache
        self._discover_tools()
    
    def _save_cache(self):
        """Save tool cache to file"""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump({
                    'tools': self.tools,
                    'categories': self.categories,
                    'cache_time': time.time()
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save tool cache: {e}")
    
    def _discover_tools(self):
        """Discover installed tools on the system"""
        logger.info("Discovering installed security tools...")
        
        self.tools = {}
        self.categories = {}
        
        for tool_id, tool_def in TOOL_DEFINITIONS.items():
            # Check if tool is installed
            tool_path = shutil.which(tool_def['command'])
            
            if tool_path:
                # Tool is installed
                self.tools[tool_id] = {
                    **tool_def,
                    'installed': True,
                    'path': tool_path,
                    'last_checked': datetime.now().isoformat()
                }
                
                # Add to category
                category = tool_def['category']
                if category not in self.categories:
                    self.categories[category] = []
                self.categories[category].append(tool_id)
            else:
                # Tool not installed but defined
                self.tools[tool_id] = {
                    **tool_def,
                    'installed': False,
                    'path': None,
                    'last_checked': datetime.now().isoformat()
                }
        
        self._save_cache()
        logger.info(f"Discovered {len([t for t in self.tools.values() if t['installed']])} installed tools")
    
    def refresh(self):
        """Force refresh tool discovery"""
        self._discover_tools()
    
    def get_tool(self, tool_id: str) -> Optional[Dict]:
        """Get tool by ID"""
        return self.tools.get(tool_id)
    
    def get_all_tools(self) -> Dict[str, Dict]:
        """Get all tools"""
        return self.tools
    
    def get_installed_tools(self) -> Dict[str, Dict]:
        """Get only installed tools"""
        return {k: v for k, v in self.tools.items() if v.get('installed')}
    
    def get_tools_by_category(self, category: str) -> List[Dict]:
        """Get tools by category"""
        tool_ids = self.categories.get(category, [])
        return [self.tools[tid] for tid in tool_ids if tid in self.tools]
    
    def get_tools_for_plan(self, plan: str) -> Dict[str, Dict]:
        """Get tools available for a specific plan"""
        plan_level = PLAN_HIERARCHY.get(plan, 1)
        return {
            k: v for k, v in self.tools.items() 
            if v.get('installed') and PLAN_HIERARCHY.get(v.get('plan_required', 'enterprise'), 5) <= plan_level
        }
    
    def get_categories(self) -> List[str]:
        """Get all categories"""
        return list(self.categories.keys())
    
    def get_tool_count_by_plan(self) -> Dict[str, int]:
        """Get tool count for each plan"""
        counts = {plan: 0 for plan in PLAN_HIERARCHY.keys()}
        
        for tool in self.tools.values():
            if not tool.get('installed'):
                continue
            plan_required = tool.get('plan_required', 'enterprise')
            plan_level = PLAN_HIERARCHY.get(plan_required, 5)
            
            for plan, level in PLAN_HIERARCHY.items():
                if level >= plan_level:
                    counts[plan] += 1
        
        return counts
    
    def search_tools(self, query: str) -> List[Dict]:
        """Search tools by name or description"""
        query = query.lower()
        results = []
        
        for tool_id, tool in self.tools.items():
            if (query in tool_id.lower() or 
                query in tool.get('name', '').lower() or 
                query in tool.get('description', '').lower() or
                query in tool.get('category', '').lower()):
                results.append({**tool, 'id': tool_id})
        
        return results
    
    def can_use_tool(self, tool_id: str, user_plan: str) -> bool:
        """Check if user can use a specific tool"""
        tool = self.get_tool(tool_id)
        if not tool or not tool.get('installed'):
            return False
        
        user_level = PLAN_HIERARCHY.get(user_plan, 1)
        tool_level = PLAN_HIERARCHY.get(tool.get('plan_required', 'enterprise'), 5)
        
        return user_level >= tool_level
    
    def get_statistics(self) -> Dict:
        """Get tool statistics"""
        installed = [t for t in self.tools.values() if t.get('installed')]
        
        return {
            'total_defined': len(self.tools),
            'total_installed': len(installed),
            'categories': len(self.categories),
            'by_plan': self.get_tool_count_by_plan(),
            'by_category': {cat: len(tools) for cat, tools in self.categories.items()},
            'dangerous_tools': len([t for t in installed if t.get('dangerous')]),
            'gui_tools': len([t for t in installed if t.get('gui_only')]),
            'requires_root': len([t for t in installed if t.get('requires_root')]),
        }


# Global registry instance
_registry: Optional[ToolRegistry] = None

def get_registry() -> ToolRegistry:
    """Get or create tool registry singleton"""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


def get_tool_for_api(tool_id: str) -> Optional[Dict]:
    """Get tool info formatted for API response"""
    registry = get_registry()
    tool = registry.get_tool(tool_id)
    
    if not tool:
        return None
    
    return {
        'id': tool_id,
        'name': tool.get('name'),
        'category': tool.get('category'),
        'subcategory': tool.get('subcategory'),
        'description': tool.get('description'),
        'plan_required': tool.get('plan_required'),
        'installed': tool.get('installed'),
        'dangerous': tool.get('dangerous', False),
        'requires_root': tool.get('requires_root', False),
        'gui_only': tool.get('gui_only', False),
        'parameters': tool.get('parameters', {})
    }


def get_all_tools_for_api(plan: str = None) -> List[Dict]:
    """Get all tools formatted for API response"""
    registry = get_registry()
    
    if plan:
        tools = registry.get_tools_for_plan(plan)
    else:
        tools = registry.get_installed_tools()
    
    return [
        {
            'id': tool_id,
            'name': tool.get('name'),
            'category': tool.get('category'),
            'subcategory': tool.get('subcategory'),
            'description': tool.get('description'),
            'plan_required': tool.get('plan_required'),
            'installed': tool.get('installed'),
            'dangerous': tool.get('dangerous', False),
            'requires_root': tool.get('requires_root', False),
            'gui_only': tool.get('gui_only', False),
        }
        for tool_id, tool in tools.items()
    ]


if __name__ == "__main__":
    # Test the registry
    import time
    
    print("Initializing Tool Registry...")
    start = time.time()
    registry = ToolRegistry()
    print(f"Initialization took {time.time() - start:.2f}s")
    
    print("\n" + "="*60)
    print("TOOL STATISTICS")
    print("="*60)
    
    stats = registry.get_statistics()
    print(f"Total Defined: {stats['total_defined']}")
    print(f"Total Installed: {stats['total_installed']}")
    print(f"Categories: {stats['categories']}")
    print(f"\nTools by Plan:")
    for plan, count in stats['by_plan'].items():
        print(f"  {plan}: {count} tools")
    
    print(f"\nTools by Category:")
    for cat, count in stats['by_category'].items():
        print(f"  {cat}: {count} tools")
    
    print(f"\nDangerous Tools: {stats['dangerous_tools']}")
    print(f"GUI-only Tools: {stats['gui_tools']}")
    print(f"Requires Root: {stats['requires_root']}")
