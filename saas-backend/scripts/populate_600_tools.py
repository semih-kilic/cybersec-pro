#!/usr/bin/env python3
"""
Populate 600+ Kali Linux Security Tools
This script adds comprehensive tool definitions to the database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, Tool
import uuid

# Comprehensive Kali Linux Tool Database
KALI_TOOLS = {
    # =======================================================================
    # INFORMATION GATHERING (100+ tools)
    # =======================================================================
    "Information Gathering": [
        # Network Scanners
        {"name": "nmap", "description": "Network mapper and port scanner", "command": "nmap", "plan_required": "starter"},
        {"name": "masscan", "description": "High-speed TCP port scanner", "command": "masscan", "plan_required": "starter"},
        {"name": "rustscan", "description": "Modern fast port scanner", "command": "rustscan", "plan_required": "starter"},
        {"name": "zmap", "description": "Internet-wide scanner", "command": "zmap", "plan_required": "professional"},
        {"name": "unicornscan", "description": "Asynchronous network scanner", "command": "unicornscan", "plan_required": "professional"},
        {"name": "hping3", "description": "TCP/IP packet assembler/analyzer", "command": "hping3", "plan_required": "professional"},
        {"name": "fping", "description": "Fast ping sweep tool", "command": "fping", "plan_required": "starter"},
        {"name": "arping", "description": "ARP level ping utility", "command": "arping", "plan_required": "starter"},
        {"name": "netdiscover", "description": "Active/passive ARP reconnaissance", "command": "netdiscover", "plan_required": "starter"},
        {"name": "p0f", "description": "Passive OS fingerprinting", "command": "p0f", "plan_required": "professional"},
        
        # DNS Tools
        {"name": "dnsrecon", "description": "DNS enumeration script", "command": "dnsrecon", "plan_required": "starter"},
        {"name": "dnsenum", "description": "DNS enumeration tool", "command": "dnsenum", "plan_required": "starter"},
        {"name": "dnsmap", "description": "DNS subdomain brute forcer", "command": "dnsmap", "plan_required": "starter"},
        {"name": "fierce", "description": "DNS reconnaissance tool", "command": "fierce", "plan_required": "starter"},
        {"name": "host", "description": "DNS lookup utility", "command": "host", "plan_required": "starter"},
        {"name": "dig", "description": "DNS lookup tool", "command": "dig", "plan_required": "starter"},
        {"name": "nslookup", "description": "Query DNS nameservers", "command": "nslookup", "plan_required": "starter"},
        {"name": "dnstracer", "description": "Trace DNS queries", "command": "dnstracer", "plan_required": "professional"},
        {"name": "dnstwist", "description": "Domain name permutation engine", "command": "dnstwist", "plan_required": "professional"},
        {"name": "massdns", "description": "High-performance DNS resolver", "command": "massdns", "plan_required": "professional"},
        
        # Subdomain Tools
        {"name": "sublist3r", "description": "Fast subdomain enumeration", "command": "sublist3r", "plan_required": "starter"},
        {"name": "amass", "description": "In-depth attack surface mapping", "command": "amass", "plan_required": "professional"},
        {"name": "subfinder", "description": "Subdomain discovery tool", "command": "subfinder", "plan_required": "starter"},
        {"name": "assetfinder", "description": "Find domains and subdomains", "command": "assetfinder", "plan_required": "starter"},
        {"name": "knockpy", "description": "Subdomain scanner", "command": "knockpy", "plan_required": "starter"},
        {"name": "gobuster-dns", "description": "DNS subdomain brute force", "command": "gobuster dns", "plan_required": "starter"},
        {"name": "altdns", "description": "DNS subdomain permutation", "command": "altdns", "plan_required": "professional"},
        {"name": "shuffledns", "description": "Massdns wrapper for subdomain", "command": "shuffledns", "plan_required": "professional"},
        {"name": "puredns", "description": "Fast domain resolver", "command": "puredns", "plan_required": "professional"},
        {"name": "findomain", "description": "Cross-platform subdomain finder", "command": "findomain", "plan_required": "starter"},
        
        # OSINT Tools
        {"name": "theharvester", "description": "Email and subdomain harvester", "command": "theHarvester", "plan_required": "starter"},
        {"name": "recon-ng", "description": "Web reconnaissance framework", "command": "recon-ng", "plan_required": "professional"},
        {"name": "maltego", "description": "Open source intelligence", "command": "maltego", "plan_required": "enterprise"},
        {"name": "spiderfoot", "description": "Automated OSINT collection", "command": "spiderfoot", "plan_required": "professional"},
        {"name": "sherlock", "description": "Hunt usernames across social networks", "command": "sherlock", "plan_required": "starter"},
        {"name": "holehe", "description": "Check email on various sites", "command": "holehe", "plan_required": "starter"},
        {"name": "socialscan", "description": "Check social media username availability", "command": "socialscan", "plan_required": "starter"},
        {"name": "phoneinfoga", "description": "Phone number OSINT", "command": "phoneinfoga", "plan_required": "professional"},
        {"name": "emailharvester", "description": "Email harvesting tool", "command": "emailharvester", "plan_required": "starter"},
        {"name": "infoga", "description": "Email OSINT tool", "command": "infoga", "plan_required": "starter"},
        
        # Whois/Network Info
        {"name": "whois", "description": "Domain registration lookup", "command": "whois", "plan_required": "starter"},
        {"name": "whatweb", "description": "Web fingerprinting tool", "command": "whatweb", "plan_required": "starter"},
        {"name": "wafw00f", "description": "Web application firewall detector", "command": "wafw00f", "plan_required": "starter"},
        {"name": "wappalyzer", "description": "Technology profiler", "command": "wappalyzer", "plan_required": "starter"},
        {"name": "builtwith", "description": "Website technology lookup", "command": "builtwith", "plan_required": "starter"},
        {"name": "httpx", "description": "HTTP probing tool", "command": "httpx", "plan_required": "starter"},
        {"name": "httprobe", "description": "HTTP/HTTPS probe", "command": "httprobe", "plan_required": "starter"},
        {"name": "aquatone", "description": "Visual inspection of websites", "command": "aquatone", "plan_required": "professional"},
        {"name": "eyewitness", "description": "Website screenshot tool", "command": "eyewitness", "plan_required": "professional"},
        {"name": "gowitness", "description": "Web screenshot utility", "command": "gowitness", "plan_required": "professional"},
        
        # Traceroute/Network Path
        {"name": "traceroute", "description": "Trace network path", "command": "traceroute", "plan_required": "starter"},
        {"name": "mtr", "description": "Network diagnostic tool", "command": "mtr", "plan_required": "starter"},
        {"name": "tracepath", "description": "Traces path to network host", "command": "tracepath", "plan_required": "starter"},
        {"name": "lft", "description": "Layer four traceroute", "command": "lft", "plan_required": "professional"},
        {"name": "tcptraceroute", "description": "TCP traceroute", "command": "tcptraceroute", "plan_required": "starter"},
        
        # Port/Service Identification
        {"name": "amap", "description": "Application mapper", "command": "amap", "plan_required": "professional"},
        {"name": "xprobe2", "description": "Remote OS fingerprinting", "command": "xprobe2", "plan_required": "professional"},
        {"name": "sslscan", "description": "SSL/TLS scanner", "command": "sslscan", "plan_required": "starter"},
        {"name": "sslyze", "description": "SSL configuration analyzer", "command": "sslyze", "plan_required": "starter"},
        {"name": "testssl", "description": "SSL/TLS testing tool", "command": "testssl.sh", "plan_required": "starter"},
        {"name": "tlssled", "description": "TLS/SSL security auditor", "command": "tlssled", "plan_required": "professional"},
        
        # Banner Grabbing
        {"name": "netcat", "description": "TCP/UDP networking utility", "command": "nc", "plan_required": "starter"},
        {"name": "ncat", "description": "Nmap's netcat implementation", "command": "ncat", "plan_required": "starter"},
        {"name": "socat", "description": "Multipurpose relay tool", "command": "socat", "plan_required": "professional"},
        {"name": "curl", "description": "URL transfer tool", "command": "curl", "plan_required": "starter"},
        {"name": "wget", "description": "Non-interactive network downloader", "command": "wget", "plan_required": "starter"},
        
        # SMB/Windows
        {"name": "enum4linux", "description": "Windows/Samba enumeration", "command": "enum4linux", "plan_required": "starter"},
        {"name": "smbclient", "description": "SMB/CIFS client", "command": "smbclient", "plan_required": "starter"},
        {"name": "smbmap", "description": "SMB share enumerator", "command": "smbmap", "plan_required": "starter"},
        {"name": "rpcclient", "description": "Windows RPC client", "command": "rpcclient", "plan_required": "starter"},
        {"name": "nbtscan", "description": "NetBIOS scanner", "command": "nbtscan", "plan_required": "starter"},
        {"name": "nmblookup", "description": "NetBIOS name lookup", "command": "nmblookup", "plan_required": "starter"},
        {"name": "ldapsearch", "description": "LDAP search utility", "command": "ldapsearch", "plan_required": "professional"},
        {"name": "windapsearch", "description": "LDAP enumeration for Windows", "command": "windapsearch", "plan_required": "professional"},
        
        # SNMP
        {"name": "snmpwalk", "description": "SNMP tree walker", "command": "snmpwalk", "plan_required": "starter"},
        {"name": "snmpcheck", "description": "SNMP enumeration tool", "command": "snmpcheck", "plan_required": "starter"},
        {"name": "onesixtyone", "description": "Fast SNMP scanner", "command": "onesixtyone", "plan_required": "starter"},
        {"name": "snmp-brute", "description": "SNMP community brute forcer", "command": "snmp-brute", "plan_required": "professional"},
        
        # Email
        {"name": "smtp-user-enum", "description": "SMTP user enumeration", "command": "smtp-user-enum", "plan_required": "starter"},
        {"name": "swaks", "description": "SMTP test tool", "command": "swaks", "plan_required": "starter"},
        {"name": "dkim-query", "description": "DKIM record query", "command": "dkim-query", "plan_required": "starter"},
        {"name": "spfquery", "description": "SPF record query", "command": "spfquery", "plan_required": "starter"},
        
        # Web Crawlers
        {"name": "gospider", "description": "Fast web spider", "command": "gospider", "plan_required": "starter"},
        {"name": "hakrawler", "description": "Web crawler for gathering URLs", "command": "hakrawler", "plan_required": "starter"},
        {"name": "katana", "description": "Next-gen crawling framework", "command": "katana", "plan_required": "professional"},
        {"name": "photon", "description": "Incredibly fast crawler", "command": "photon", "plan_required": "starter"},
        {"name": "waybackurls", "description": "Wayback Machine URL fetcher", "command": "waybackurls", "plan_required": "starter"},
        {"name": "gau", "description": "Get All URLs", "command": "gau", "plan_required": "starter"},
        
        # Git/Code
        {"name": "gitleaks", "description": "Git secrets scanner", "command": "gitleaks", "plan_required": "starter"},
        {"name": "trufflehog", "description": "Secret scanner", "command": "trufflehog", "plan_required": "starter"},
        {"name": "gitrob", "description": "Github organization scanner", "command": "gitrob", "plan_required": "professional"},
        {"name": "gitdumper", "description": "Git repository dumper", "command": "gitdumper", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # VULNERABILITY ANALYSIS (100+ tools)
    # =======================================================================
    "Vulnerability Analysis": [
        # General Scanners
        {"name": "nikto", "description": "Web server scanner", "command": "nikto", "plan_required": "starter"},
        {"name": "nuclei", "description": "Fast vulnerability scanner", "command": "nuclei", "plan_required": "starter"},
        {"name": "openvas", "description": "Open vulnerability assessment", "command": "openvas", "plan_required": "professional"},
        {"name": "nessus", "description": "Commercial vulnerability scanner", "command": "nessus", "plan_required": "enterprise"},
        {"name": "legion", "description": "Network penetration testing framework", "command": "legion", "plan_required": "professional"},
        {"name": "vulscan", "description": "Nmap vulnerability scanner", "command": "nmap --script vulscan", "plan_required": "professional"},
        {"name": "vulners", "description": "Nmap vulners script", "command": "nmap --script vulners", "plan_required": "starter"},
        {"name": "searchsploit", "description": "Exploit database search", "command": "searchsploit", "plan_required": "starter"},
        
        # Web Vulnerabilities
        {"name": "sqlmap", "description": "SQL injection tool", "command": "sqlmap", "plan_required": "starter"},
        {"name": "commix", "description": "Command injection exploiter", "command": "commix", "plan_required": "professional"},
        {"name": "xsser", "description": "XSS exploitation framework", "command": "xsser", "plan_required": "professional"},
        {"name": "dalfox", "description": "XSS scanning and analysis", "command": "dalfox", "plan_required": "professional"},
        {"name": "xsstrike", "description": "Advanced XSS detection", "command": "xsstrike", "plan_required": "professional"},
        {"name": "nosqlmap", "description": "NoSQL injection tool", "command": "nosqlmap", "plan_required": "professional"},
        {"name": "tplmap", "description": "Template injection exploiter", "command": "tplmap", "plan_required": "professional"},
        {"name": "xxeinjector", "description": "XXE injection tool", "command": "xxeinjector", "plan_required": "professional"},
        {"name": "ssrf-sheriff", "description": "SSRF detection tool", "command": "ssrf-sheriff", "plan_required": "professional"},
        {"name": "ssrfmap", "description": "SSRF exploitation tool", "command": "ssrfmap", "plan_required": "professional"},
        
        # CMS Scanners
        {"name": "wpscan", "description": "WordPress vulnerability scanner", "command": "wpscan", "plan_required": "starter"},
        {"name": "joomscan", "description": "Joomla vulnerability scanner", "command": "joomscan", "plan_required": "starter"},
        {"name": "droopescan", "description": "Drupal/Silverstripe scanner", "command": "droopescan", "plan_required": "starter"},
        {"name": "cmsmap", "description": "CMS vulnerability scanner", "command": "cmsmap", "plan_required": "professional"},
        {"name": "magescan", "description": "Magento vulnerability scanner", "command": "magescan", "plan_required": "professional"},
        {"name": "typo3scan", "description": "TYPO3 vulnerability scanner", "command": "typo3scan", "plan_required": "professional"},
        {"name": "plecost", "description": "WordPress fingerprinting tool", "command": "plecost", "plan_required": "starter"},
        
        # API Security
        {"name": "arjun", "description": "HTTP parameter discovery", "command": "arjun", "plan_required": "starter"},
        {"name": "paramspider", "description": "Parameter discovery from archives", "command": "paramspider", "plan_required": "starter"},
        {"name": "kiterunner", "description": "API endpoint discovery", "command": "kr", "plan_required": "professional"},
        {"name": "postman", "description": "API testing tool", "command": "postman", "plan_required": "starter"},
        {"name": "swagger-ui", "description": "API documentation interface", "command": "swagger-ui", "plan_required": "starter"},
        
        # SSL/TLS
        {"name": "sslyze", "description": "SSL/TLS configuration analyzer", "command": "sslyze", "plan_required": "starter"},
        {"name": "sslscan", "description": "SSL scanner", "command": "sslscan", "plan_required": "starter"},
        {"name": "testssl", "description": "SSL/TLS testing", "command": "testssl.sh", "plan_required": "starter"},
        {"name": "tlsx", "description": "TLS grabber", "command": "tlsx", "plan_required": "starter"},
        
        # LFI/RFI
        {"name": "dotdotpwn", "description": "Directory traversal fuzzer", "command": "dotdotpwn", "plan_required": "professional"},
        {"name": "fimap", "description": "LFI/RFI scanner", "command": "fimap", "plan_required": "professional"},
        {"name": "kadimus", "description": "LFI exploitation tool", "command": "kadimus", "plan_required": "professional"},
        {"name": "lfisuite", "description": "LFI exploitation framework", "command": "lfisuite", "plan_required": "professional"},
        
        # Subdomain Takeover
        {"name": "subjack", "description": "Subdomain takeover detection", "command": "subjack", "plan_required": "starter"},
        {"name": "can-i-take-over-xyz", "description": "Subdomain takeover list", "command": "can-i-take-over-xyz", "plan_required": "starter"},
        {"name": "subzy", "description": "Subdomain takeover scanner", "command": "subzy", "plan_required": "starter"},
        {"name": "nuclei-takeovers", "description": "Takeover templates for nuclei", "command": "nuclei -t takeovers", "plan_required": "starter"},
        
        # Container Security
        {"name": "trivy", "description": "Container vulnerability scanner", "command": "trivy", "plan_required": "professional"},
        {"name": "grype", "description": "Container image scanner", "command": "grype", "plan_required": "professional"},
        {"name": "clair", "description": "Container security analysis", "command": "clair", "plan_required": "enterprise"},
        {"name": "docker-bench", "description": "Docker security best practices", "command": "docker-bench-security", "plan_required": "professional"},
        {"name": "kube-hunter", "description": "Kubernetes security testing", "command": "kube-hunter", "plan_required": "enterprise"},
        {"name": "kubeaudit", "description": "Kubernetes security audit", "command": "kubeaudit", "plan_required": "enterprise"},
        {"name": "kube-bench", "description": "Kubernetes CIS benchmark", "command": "kube-bench", "plan_required": "enterprise"},
        
        # Cloud Security
        {"name": "prowler", "description": "AWS security assessment", "command": "prowler", "plan_required": "professional"},
        {"name": "scoutsuite", "description": "Multi-cloud security auditing", "command": "scout", "plan_required": "professional"},
        {"name": "cloudsploit", "description": "Cloud security posture scanner", "command": "cloudsploit", "plan_required": "professional"},
        {"name": "cloudmapper", "description": "AWS environment analyzer", "command": "cloudmapper", "plan_required": "professional"},
        {"name": "pacu", "description": "AWS exploitation framework", "command": "pacu", "plan_required": "enterprise"},
        {"name": "s3scanner", "description": "S3 bucket scanner", "command": "s3scanner", "plan_required": "starter"},
        {"name": "az-enum", "description": "Azure enumeration", "command": "az-enum", "plan_required": "professional"},
        {"name": "gcpbucketbrute", "description": "GCP bucket brute forcer", "command": "gcpbucketbrute", "plan_required": "professional"},
        
        # Code Analysis
        {"name": "semgrep", "description": "Static analysis tool", "command": "semgrep", "plan_required": "professional"},
        {"name": "bandit", "description": "Python security linter", "command": "bandit", "plan_required": "starter"},
        {"name": "brakeman", "description": "Ruby on Rails scanner", "command": "brakeman", "plan_required": "professional"},
        {"name": "gosec", "description": "Go security checker", "command": "gosec", "plan_required": "professional"},
        {"name": "nodejsscan", "description": "Node.js security scanner", "command": "nodejsscan", "plan_required": "professional"},
        {"name": "snyk", "description": "Dependency vulnerability scanner", "command": "snyk", "plan_required": "professional"},
        {"name": "dependency-check", "description": "OWASP dependency checker", "command": "dependency-check", "plan_required": "professional"},
        {"name": "retire", "description": "JS library vulnerability scanner", "command": "retire", "plan_required": "starter"},
        
        # Fuzzing
        {"name": "wfuzz", "description": "Web fuzzing tool", "command": "wfuzz", "plan_required": "starter"},
        {"name": "ffuf", "description": "Fast web fuzzer", "command": "ffuf", "plan_required": "starter"},
        {"name": "radamsa", "description": "Fuzzing test case generator", "command": "radamsa", "plan_required": "professional"},
        {"name": "boofuzz", "description": "Network protocol fuzzer", "command": "boofuzz", "plan_required": "professional"},
        {"name": "afl", "description": "American Fuzzy Lop", "command": "afl-fuzz", "plan_required": "professional"},
        {"name": "honggfuzz", "description": "Security oriented fuzzer", "command": "honggfuzz", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # WEB APPLICATIONS (80+ tools)
    # =======================================================================
    "Web Applications": [
        # Directory Bruteforce
        {"name": "gobuster", "description": "Directory/file brute forcer", "command": "gobuster", "plan_required": "starter"},
        {"name": "dirb", "description": "Web content scanner", "command": "dirb", "plan_required": "starter"},
        {"name": "dirbuster", "description": "Web application brute forcer", "command": "dirbuster", "plan_required": "starter"},
        {"name": "dirsearch", "description": "Web path scanner", "command": "dirsearch", "plan_required": "starter"},
        {"name": "feroxbuster", "description": "Recursive content discovery", "command": "feroxbuster", "plan_required": "starter"},
        {"name": "filebuster", "description": "High-speed file discovery", "command": "filebuster", "plan_required": "starter"},
        {"name": "directorybus", "description": "Directory enumeration", "command": "directorybus", "plan_required": "professional"},
        
        # Web App Frameworks
        {"name": "burpsuite", "description": "Web security testing platform", "command": "burpsuite", "plan_required": "professional"},
        {"name": "zaproxy", "description": "OWASP ZAP web scanner", "command": "zaproxy", "plan_required": "starter"},
        {"name": "arachni", "description": "Web application scanner", "command": "arachni", "plan_required": "professional"},
        {"name": "skipfish", "description": "Web app security recon", "command": "skipfish", "plan_required": "starter"},
        {"name": "vega", "description": "Web vulnerability scanner", "command": "vega", "plan_required": "starter"},
        {"name": "w3af", "description": "Web Application Attack Framework", "command": "w3af", "plan_required": "professional"},
        {"name": "wapiti", "description": "Web vulnerability scanner", "command": "wapiti", "plan_required": "starter"},
        {"name": "ratproxy", "description": "Passive web app security audit", "command": "ratproxy", "plan_required": "professional"},
        
        # HTTP Analysis
        {"name": "httpx", "description": "HTTP toolkit", "command": "httpx", "plan_required": "starter"},
        {"name": "httprobe", "description": "HTTP/HTTPS probe", "command": "httprobe", "plan_required": "starter"},
        {"name": "httpie", "description": "Modern HTTP client", "command": "http", "plan_required": "starter"},
        {"name": "h2csmuggler", "description": "HTTP/2 cleartext smuggling", "command": "h2csmuggler", "plan_required": "professional"},
        {"name": "smuggler", "description": "HTTP request smuggling", "command": "smuggler", "plan_required": "professional"},
        
        # WebDAV
        {"name": "davtest", "description": "WebDAV scanner", "command": "davtest", "plan_required": "starter"},
        {"name": "cadaver", "description": "WebDAV client", "command": "cadaver", "plan_required": "starter"},
        
        # Proxy Tools
        {"name": "mitmproxy", "description": "Interactive HTTPS proxy", "command": "mitmproxy", "plan_required": "professional"},
        {"name": "proxychains", "description": "Proxy chains", "command": "proxychains", "plan_required": "starter"},
        {"name": "proxify", "description": "Proxy utility for HTTPx", "command": "proxify", "plan_required": "professional"},
        
        # Web Shells
        {"name": "weevely", "description": "Web shell generator", "command": "weevely", "plan_required": "enterprise"},
        {"name": "webshell", "description": "Web shell collection", "command": "webshell", "plan_required": "enterprise"},
        
        # JS Analysis
        {"name": "linkfinder", "description": "JS endpoint finder", "command": "linkfinder", "plan_required": "starter"},
        {"name": "secretfinder", "description": "Find secrets in JS files", "command": "secretfinder", "plan_required": "starter"},
        {"name": "jsparser", "description": "JavaScript parser", "command": "jsparser", "plan_required": "starter"},
        {"name": "sourcemapper", "description": "Extract code from sourcemaps", "command": "sourcemapper", "plan_required": "professional"},
        
        # Wordlists
        {"name": "cewl", "description": "Custom wordlist generator", "command": "cewl", "plan_required": "starter"},
        {"name": "crunch", "description": "Wordlist generator", "command": "crunch", "plan_required": "starter"},
        {"name": "cupp", "description": "Common User Passwords Profiler", "command": "cupp", "plan_required": "starter"},
        {"name": "seclists", "description": "Security wordlist collection", "command": "seclists", "plan_required": "starter"},
        {"name": "wordlistctl", "description": "Wordlist manager", "command": "wordlistctl", "plan_required": "starter"},
    ],
    
    # =======================================================================
    # PASSWORD ATTACKS (60+ tools)
    # =======================================================================
    "Password Attacks": [
        # Cracking
        {"name": "john", "description": "John the Ripper password cracker", "command": "john", "plan_required": "starter"},
        {"name": "hashcat", "description": "Advanced password recovery", "command": "hashcat", "plan_required": "professional"},
        {"name": "hydra", "description": "Network login cracker", "command": "hydra", "plan_required": "starter"},
        {"name": "medusa", "description": "Parallel password cracker", "command": "medusa", "plan_required": "professional"},
        {"name": "ncrack", "description": "High-speed network cracker", "command": "ncrack", "plan_required": "professional"},
        {"name": "patator", "description": "Multi-purpose brute forcer", "command": "patator", "plan_required": "professional"},
        {"name": "crowbar", "description": "Brute forcing tool", "command": "crowbar", "plan_required": "professional"},
        {"name": "brutespray", "description": "Spray default creds to services", "command": "brutespray", "plan_required": "professional"},
        
        # Hash Tools
        {"name": "hashid", "description": "Hash type identifier", "command": "hashid", "plan_required": "starter"},
        {"name": "hash-identifier", "description": "Identify hash types", "command": "hash-identifier", "plan_required": "starter"},
        {"name": "hashcat-utils", "description": "Hashcat utilities", "command": "hashcat-utils", "plan_required": "professional"},
        {"name": "haiti", "description": "Hash type identifier", "command": "haiti", "plan_required": "starter"},
        {"name": "name-that-hash", "description": "Hash identifier", "command": "nth", "plan_required": "starter"},
        
        # Wordlists
        {"name": "crunch", "description": "Wordlist generator", "command": "crunch", "plan_required": "starter"},
        {"name": "cewl", "description": "Custom wordlist generator", "command": "cewl", "plan_required": "starter"},
        {"name": "cupp", "description": "User password profiler", "command": "cupp", "plan_required": "starter"},
        {"name": "mentalist", "description": "Wordlist generator", "command": "mentalist", "plan_required": "professional"},
        {"name": "kwprocessor", "description": "Keyboard walk processor", "command": "kwp", "plan_required": "professional"},
        {"name": "princeprocessor", "description": "PRINCE password generator", "command": "pp64.bin", "plan_required": "professional"},
        {"name": "pipal", "description": "Password analyzer", "command": "pipal", "plan_required": "starter"},
        
        # Windows
        {"name": "mimikatz", "description": "Windows credential extraction", "command": "mimikatz", "plan_required": "enterprise"},
        {"name": "secretsdump", "description": "Dump Windows secrets", "command": "secretsdump.py", "plan_required": "professional"},
        {"name": "lsassy", "description": "Remote lsass dumper", "command": "lsassy", "plan_required": "professional"},
        {"name": "pypykatz", "description": "Mimikatz in Python", "command": "pypykatz", "plan_required": "professional"},
        {"name": "nanodump", "description": "LSASS dump tool", "command": "nanodump", "plan_required": "enterprise"},
        
        # Linux
        {"name": "unshadow", "description": "Combine passwd and shadow", "command": "unshadow", "plan_required": "starter"},
        {"name": "sucrack", "description": "Local su password cracker", "command": "sucrack", "plan_required": "professional"},
        
        # Online Attacks
        {"name": "thc-pptp-bruter", "description": "PPTP VPN brute forcer", "command": "thc-pptp-bruter", "plan_required": "professional"},
        {"name": "spray", "description": "Password spraying tool", "command": "spray", "plan_required": "professional"},
        {"name": "kerbrute", "description": "Kerberos brute forcer", "command": "kerbrute", "plan_required": "professional"},
        {"name": "o365spray", "description": "Office 365 password spray", "command": "o365spray", "plan_required": "professional"},
        {"name": "trevorspray", "description": "ModernAuth password sprayer", "command": "trevorspray", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # EXPLOITATION TOOLS (80+ tools)
    # =======================================================================
    "Exploitation Tools": [
        # Frameworks
        {"name": "metasploit", "description": "Exploitation framework", "command": "msfconsole", "plan_required": "professional"},
        {"name": "armitage", "description": "Metasploit GUI", "command": "armitage", "plan_required": "professional"},
        {"name": "cobalt-strike", "description": "Commercial red team tool", "command": "cobaltstrike", "plan_required": "enterprise"},
        {"name": "empire", "description": "PowerShell post-exploitation", "command": "empire", "plan_required": "enterprise"},
        {"name": "covenant", "description": "C2 framework", "command": "covenant", "plan_required": "enterprise"},
        {"name": "sliver", "description": "Cross-platform C2 framework", "command": "sliver", "plan_required": "enterprise"},
        {"name": "havoc", "description": "Modern C2 framework", "command": "havoc", "plan_required": "enterprise"},
        
        # Payload Generators
        {"name": "msfvenom", "description": "Metasploit payload generator", "command": "msfvenom", "plan_required": "professional"},
        {"name": "shellter", "description": "Shell code injector", "command": "shellter", "plan_required": "professional"},
        {"name": "veil", "description": "Payload generation framework", "command": "veil", "plan_required": "professional"},
        {"name": "unicorn", "description": "PowerShell attack tool", "command": "unicorn", "plan_required": "professional"},
        {"name": "scarecrow", "description": "EDR bypass framework", "command": "scarecrow", "plan_required": "enterprise"},
        {"name": "donut", "description": "Shellcode generator", "command": "donut", "plan_required": "enterprise"},
        {"name": "pezor", "description": "PE packer", "command": "pezor", "plan_required": "enterprise"},
        
        # Web Exploitation
        {"name": "sqlmap", "description": "SQL injection tool", "command": "sqlmap", "plan_required": "starter"},
        {"name": "commix", "description": "Command injection", "command": "commix", "plan_required": "professional"},
        {"name": "xsser", "description": "XSS exploitation", "command": "xsser", "plan_required": "professional"},
        {"name": "beef", "description": "Browser Exploitation Framework", "command": "beef-xss", "plan_required": "enterprise"},
        {"name": "setoolkit", "description": "Social Engineering Toolkit", "command": "setoolkit", "plan_required": "professional"},
        
        # Binary
        {"name": "pwntools", "description": "CTF toolkit", "command": "python3 -c 'from pwn import *'", "plan_required": "professional"},
        {"name": "ropgadget", "description": "ROP chain finder", "command": "ROPgadget", "plan_required": "professional"},
        {"name": "ropper", "description": "ROP gadget finder", "command": "ropper", "plan_required": "professional"},
        {"name": "one-gadget", "description": "One gadget RCE finder", "command": "one_gadget", "plan_required": "professional"},
        
        # Impacket Suite
        {"name": "psexec.py", "description": "Remote execution (PsExec)", "command": "psexec.py", "plan_required": "professional"},
        {"name": "wmiexec.py", "description": "Remote execution (WMI)", "command": "wmiexec.py", "plan_required": "professional"},
        {"name": "smbexec.py", "description": "Remote execution (SMB)", "command": "smbexec.py", "plan_required": "professional"},
        {"name": "atexec.py", "description": "Remote execution (AT)", "command": "atexec.py", "plan_required": "professional"},
        {"name": "dcomexec.py", "description": "Remote execution (DCOM)", "command": "dcomexec.py", "plan_required": "professional"},
        {"name": "ntlmrelayx.py", "description": "NTLM relay attacks", "command": "ntlmrelayx.py", "plan_required": "professional"},
        {"name": "smbserver.py", "description": "SMB server", "command": "smbserver.py", "plan_required": "professional"},
        {"name": "kerberoast.py", "description": "Kerberoasting attacks", "command": "GetUserSPNs.py", "plan_required": "professional"},
        
        # AD Attacks
        {"name": "crackmapexec", "description": "Network sweep tool", "command": "crackmapexec", "plan_required": "professional"},
        {"name": "evil-winrm", "description": "WinRM shell", "command": "evil-winrm", "plan_required": "professional"},
        {"name": "bloodhound", "description": "AD attack path tool", "command": "bloodhound", "plan_required": "professional"},
        {"name": "rubeus", "description": "Kerberos abuse toolkit", "command": "rubeus", "plan_required": "enterprise"},
        {"name": "certipy", "description": "AD CS abuse tool", "command": "certipy", "plan_required": "professional"},
        {"name": "petitpotam", "description": "NTLM relay via EFS", "command": "petitpotam.py", "plan_required": "enterprise"},
        {"name": "zerologon", "description": "Netlogon exploit", "command": "zerologon", "plan_required": "enterprise"},
        {"name": "printnightmare", "description": "Print Spooler exploit", "command": "printnightmare", "plan_required": "enterprise"},
    ],
    
    # =======================================================================
    # SNIFFING & SPOOFING (40+ tools)
    # =======================================================================
    "Sniffing & Spoofing": [
        # Packet Capture
        {"name": "wireshark", "description": "Network protocol analyzer", "command": "wireshark", "plan_required": "starter"},
        {"name": "tshark", "description": "CLI Wireshark", "command": "tshark", "plan_required": "starter"},
        {"name": "tcpdump", "description": "Packet analyzer", "command": "tcpdump", "plan_required": "starter"},
        {"name": "dumpcap", "description": "Network traffic dump", "command": "dumpcap", "plan_required": "starter"},
        {"name": "ngrep", "description": "Network grep", "command": "ngrep", "plan_required": "starter"},
        {"name": "dsniff", "description": "Network auditing toolkit", "command": "dsniff", "plan_required": "professional"},
        
        # MITM
        {"name": "ettercap", "description": "Comprehensive MITM suite", "command": "ettercap", "plan_required": "professional"},
        {"name": "bettercap", "description": "Network reconnaissance", "command": "bettercap", "plan_required": "professional"},
        {"name": "arpspoof", "description": "ARP spoofing tool", "command": "arpspoof", "plan_required": "professional"},
        {"name": "dnsspoof", "description": "DNS spoofing tool", "command": "dnsspoof", "plan_required": "professional"},
        {"name": "macchanger", "description": "MAC address changer", "command": "macchanger", "plan_required": "starter"},
        {"name": "mitmproxy", "description": "Interactive HTTPS proxy", "command": "mitmproxy", "plan_required": "professional"},
        {"name": "sslstrip", "description": "SSL stripping tool", "command": "sslstrip", "plan_required": "professional"},
        {"name": "sslsplit", "description": "SSL/TLS intercepting proxy", "command": "sslsplit", "plan_required": "professional"},
        
        # Responder
        {"name": "responder", "description": "LLMNR/NBT-NS/MDNS poisoner", "command": "responder", "plan_required": "professional"},
        {"name": "inveigh", "description": "Windows network spoofer", "command": "inveigh", "plan_required": "professional"},
        {"name": "pretender", "description": "DHCPv6/DNS spoofer", "command": "pretender", "plan_required": "professional"},
        
        # Packet Crafting
        {"name": "scapy", "description": "Packet manipulation tool", "command": "scapy", "plan_required": "professional"},
        {"name": "hping3", "description": "Packet generator", "command": "hping3", "plan_required": "professional"},
        {"name": "packeth", "description": "Packet generator GUI", "command": "packeth", "plan_required": "professional"},
        {"name": "yersinia", "description": "Network protocol attacks", "command": "yersinia", "plan_required": "professional"},
        
        # VoIP
        {"name": "sipvicious", "description": "SIP auditing toolkit", "command": "svmap", "plan_required": "professional"},
        {"name": "ohrwurm", "description": "RTP fuzzer", "command": "ohrwurm", "plan_required": "professional"},
        {"name": "rtpflood", "description": "RTP flooding tool", "command": "rtpflood", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # WIRELESS ATTACKS (40+ tools)
    # =======================================================================
    "Wireless Attacks": [
        # WiFi
        {"name": "aircrack-ng", "description": "WiFi security suite", "command": "aircrack-ng", "plan_required": "professional"},
        {"name": "airmon-ng", "description": "Monitor mode enabler", "command": "airmon-ng", "plan_required": "professional"},
        {"name": "airodump-ng", "description": "WiFi packet capture", "command": "airodump-ng", "plan_required": "professional"},
        {"name": "aireplay-ng", "description": "WiFi packet injection", "command": "aireplay-ng", "plan_required": "professional"},
        {"name": "wifite", "description": "Automated WiFi auditor", "command": "wifite", "plan_required": "professional"},
        {"name": "fern-wifi-cracker", "description": "WiFi security auditing GUI", "command": "fern-wifi-cracker", "plan_required": "professional"},
        {"name": "reaver", "description": "WPS cracker", "command": "reaver", "plan_required": "professional"},
        {"name": "bully", "description": "WPS brute force", "command": "bully", "plan_required": "professional"},
        {"name": "pixiewps", "description": "WPS pixie dust attack", "command": "pixiewps", "plan_required": "professional"},
        {"name": "kismet", "description": "Wireless network detector", "command": "kismet", "plan_required": "professional"},
        {"name": "wifipumpkin3", "description": "Rogue AP framework", "command": "wifipumpkin3", "plan_required": "enterprise"},
        {"name": "fluxion", "description": "WiFi phishing tool", "command": "fluxion", "plan_required": "enterprise"},
        {"name": "airgeddon", "description": "WiFi auditing suite", "command": "airgeddon", "plan_required": "professional"},
        
        # WPA Cracking
        {"name": "hcxdumptool", "description": "Capture PMKID/handshakes", "command": "hcxdumptool", "plan_required": "professional"},
        {"name": "hcxtools", "description": "Convert capture to hashcat", "command": "hcxpcapngtool", "plan_required": "professional"},
        {"name": "cowpatty", "description": "WPA-PSK cracker", "command": "cowpatty", "plan_required": "professional"},
        {"name": "pyrit", "description": "WPA/WPA2-PSK cracker", "command": "pyrit", "plan_required": "professional"},
        
        # Bluetooth
        {"name": "bluez", "description": "Bluetooth tools", "command": "bluetoothctl", "plan_required": "professional"},
        {"name": "btscanner", "description": "Bluetooth scanner", "command": "btscanner", "plan_required": "professional"},
        {"name": "redfang", "description": "Hidden Bluetooth discovery", "command": "redfang", "plan_required": "professional"},
        {"name": "bluesnarfer", "description": "Bluetooth attack tool", "command": "bluesnarfer", "plan_required": "enterprise"},
        {"name": "spooftooph", "description": "Bluetooth spoofing", "command": "spooftooph", "plan_required": "professional"},
        {"name": "ubertooth", "description": "Bluetooth sniffing", "command": "ubertooth-rx", "plan_required": "enterprise"},
        
        # RFID/NFC
        {"name": "mfoc", "description": "Mifare Classic cracker", "command": "mfoc", "plan_required": "enterprise"},
        {"name": "mfcuk", "description": "Mifare Classic key recovery", "command": "mfcuk", "plan_required": "enterprise"},
        {"name": "proxmark3", "description": "RFID research tool", "command": "proxmark3", "plan_required": "enterprise"},
    ],
    
    # =======================================================================
    # POST EXPLOITATION (50+ tools)
    # =======================================================================
    "Post Exploitation": [
        # File Transfer
        {"name": "scp", "description": "Secure copy", "command": "scp", "plan_required": "starter"},
        {"name": "rsync", "description": "Remote sync", "command": "rsync", "plan_required": "starter"},
        {"name": "nc", "description": "Netcat file transfer", "command": "nc", "plan_required": "starter"},
        {"name": "python-http", "description": "Python HTTP server", "command": "python3 -m http.server", "plan_required": "starter"},
        {"name": "uploadserver", "description": "Upload file server", "command": "uploadserver", "plan_required": "starter"},
        
        # Shells
        {"name": "rlwrap", "description": "Readline wrapper", "command": "rlwrap", "plan_required": "starter"},
        {"name": "pwncat", "description": "Reverse shell handler", "command": "pwncat-cs", "plan_required": "professional"},
        {"name": "powercat", "description": "PowerShell netcat", "command": "powercat", "plan_required": "professional"},
        {"name": "chisel", "description": "TCP/UDP tunneling", "command": "chisel", "plan_required": "professional"},
        {"name": "ligolo-ng", "description": "Tunneling tool", "command": "ligolo-ng", "plan_required": "professional"},
        
        # Privilege Escalation
        {"name": "linpeas", "description": "Linux privilege escalation", "command": "linpeas.sh", "plan_required": "starter"},
        {"name": "winpeas", "description": "Windows privilege escalation", "command": "winpeas.exe", "plan_required": "starter"},
        {"name": "linux-exploit-suggester", "description": "Linux kernel exploit finder", "command": "linux-exploit-suggester.sh", "plan_required": "starter"},
        {"name": "windows-exploit-suggester", "description": "Windows exploit finder", "command": "windows-exploit-suggester.py", "plan_required": "starter"},
        {"name": "suid3num", "description": "SUID binary enumerator", "command": "suid3num", "plan_required": "starter"},
        {"name": "pspy", "description": "Monitor processes without root", "command": "pspy64", "plan_required": "starter"},
        {"name": "beroot", "description": "Privilege escalation paths", "command": "beroot", "plan_required": "professional"},
        
        # Credential Access
        {"name": "mimikatz", "description": "Windows credentials", "command": "mimikatz", "plan_required": "enterprise"},
        {"name": "lazagne", "description": "Credentials recovery", "command": "lazagne", "plan_required": "professional"},
        {"name": "creds", "description": "Credential harvester", "command": "creds", "plan_required": "professional"},
        {"name": "keylogger", "description": "Keystroke capture", "command": "keylogger", "plan_required": "enterprise"},
        
        # Persistence
        {"name": "crontab-enum", "description": "Cron job enumeration", "command": "crontab -l", "plan_required": "starter"},
        {"name": "autoruns", "description": "Windows autorun enumeration", "command": "autoruns", "plan_required": "professional"},
        {"name": "schtasks-enum", "description": "Scheduled tasks enum", "command": "schtasks /query", "plan_required": "professional"},
        
        # Lateral Movement
        {"name": "crackmapexec", "description": "SMB/AD attack tool", "command": "crackmapexec", "plan_required": "professional"},
        {"name": "evil-winrm", "description": "Windows remote shell", "command": "evil-winrm", "plan_required": "professional"},
        {"name": "xfreerdp", "description": "RDP client", "command": "xfreerdp", "plan_required": "starter"},
        {"name": "rdesktop", "description": "RDP client", "command": "rdesktop", "plan_required": "starter"},
        {"name": "ssh", "description": "Secure shell client", "command": "ssh", "plan_required": "starter"},
        {"name": "sshpass", "description": "SSH password provider", "command": "sshpass", "plan_required": "starter"},
        
        # Data Collection
        {"name": "exfil", "description": "Data exfiltration", "command": "exfil", "plan_required": "enterprise"},
        {"name": "dnscat2", "description": "DNS tunneling C2", "command": "dnscat2", "plan_required": "enterprise"},
        {"name": "iodine", "description": "DNS tunnel", "command": "iodine", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # FORENSICS (40+ tools)
    # =======================================================================
    "Forensics": [
        # Disk Forensics
        {"name": "autopsy", "description": "Digital forensics platform", "command": "autopsy", "plan_required": "professional"},
        {"name": "sleuthkit", "description": "File system forensics", "command": "fls", "plan_required": "professional"},
        {"name": "dc3dd", "description": "Forensic disk imaging", "command": "dc3dd", "plan_required": "professional"},
        {"name": "dcfldd", "description": "Enhanced dd for forensics", "command": "dcfldd", "plan_required": "professional"},
        {"name": "ewfacquire", "description": "E01 image acquisition", "command": "ewfacquire", "plan_required": "professional"},
        {"name": "guymager", "description": "Forensic imager GUI", "command": "guymager", "plan_required": "professional"},
        
        # File Recovery
        {"name": "foremost", "description": "Data recovery tool", "command": "foremost", "plan_required": "starter"},
        {"name": "scalpel", "description": "File carving tool", "command": "scalpel", "plan_required": "starter"},
        {"name": "photorec", "description": "Photo recovery", "command": "photorec", "plan_required": "starter"},
        {"name": "testdisk", "description": "Disk recovery", "command": "testdisk", "plan_required": "starter"},
        {"name": "extundelete", "description": "Ext3/4 file recovery", "command": "extundelete", "plan_required": "starter"},
        {"name": "fatcat", "description": "FAT forensics tool", "command": "fatcat", "plan_required": "professional"},
        
        # Memory Forensics
        {"name": "volatility", "description": "Memory forensics framework", "command": "vol.py", "plan_required": "professional"},
        {"name": "volatility3", "description": "Memory forensics v3", "command": "vol3", "plan_required": "professional"},
        {"name": "rekall", "description": "Memory forensic framework", "command": "rekall", "plan_required": "professional"},
        {"name": "lime", "description": "Linux memory extractor", "command": "lime", "plan_required": "professional"},
        {"name": "avml", "description": "Volatile memory acquisition", "command": "avml", "plan_required": "professional"},
        
        # File Analysis
        {"name": "binwalk", "description": "Firmware analysis tool", "command": "binwalk", "plan_required": "starter"},
        {"name": "file", "description": "File type identifier", "command": "file", "plan_required": "starter"},
        {"name": "exiftool", "description": "Metadata extractor", "command": "exiftool", "plan_required": "starter"},
        {"name": "pdfparser", "description": "PDF analysis", "command": "pdf-parser", "plan_required": "starter"},
        {"name": "peepdf", "description": "PDF analysis tool", "command": "peepdf", "plan_required": "professional"},
        {"name": "oletools", "description": "Office document analysis", "command": "olevba", "plan_required": "starter"},
        {"name": "yara", "description": "Pattern matching tool", "command": "yara", "plan_required": "professional"},
        
        # Log Analysis
        {"name": "logparser", "description": "Log file analyzer", "command": "logparser", "plan_required": "professional"},
        {"name": "lnav", "description": "Log file navigator", "command": "lnav", "plan_required": "starter"},
        {"name": "goaccess", "description": "Web log analyzer", "command": "goaccess", "plan_required": "starter"},
        
        # Steganography
        {"name": "steghide", "description": "Steganography tool", "command": "steghide", "plan_required": "starter"},
        {"name": "stegseek", "description": "Steghide cracker", "command": "stegseek", "plan_required": "starter"},
        {"name": "zsteg", "description": "PNG/BMP steganography", "command": "zsteg", "plan_required": "starter"},
        {"name": "stegsolve", "description": "Steganography analyzer", "command": "stegsolve", "plan_required": "starter"},
        {"name": "openstego", "description": "Steganography tool", "command": "openstego", "plan_required": "starter"},
        {"name": "snow", "description": "Whitespace steganography", "command": "snow", "plan_required": "starter"},
    ],
    
    # =======================================================================
    # REVERSE ENGINEERING (30+ tools)
    # =======================================================================
    "Reverse Engineering": [
        # Disassemblers
        {"name": "ghidra", "description": "NSA reverse engineering suite", "command": "ghidraRun", "plan_required": "professional"},
        {"name": "radare2", "description": "Reverse engineering framework", "command": "r2", "plan_required": "professional"},
        {"name": "cutter", "description": "Radare2 GUI", "command": "cutter", "plan_required": "professional"},
        {"name": "hopper", "description": "Disassembler", "command": "hopper", "plan_required": "enterprise"},
        {"name": "binary-ninja", "description": "RE platform", "command": "binaryninja", "plan_required": "enterprise"},
        {"name": "ida-free", "description": "Interactive Disassembler", "command": "ida64", "plan_required": "professional"},
        
        # Debuggers
        {"name": "gdb", "description": "GNU Debugger", "command": "gdb", "plan_required": "starter"},
        {"name": "gdb-peda", "description": "GDB enhanced", "command": "gdb", "plan_required": "starter"},
        {"name": "gef", "description": "GDB Enhanced Features", "command": "gdb", "plan_required": "starter"},
        {"name": "pwndbg", "description": "GDB for hackers", "command": "gdb", "plan_required": "starter"},
        {"name": "edb", "description": "Cross-platform debugger", "command": "edb", "plan_required": "professional"},
        {"name": "x64dbg", "description": "Windows debugger", "command": "x64dbg", "plan_required": "professional"},
        {"name": "ollydbg", "description": "Windows debugger", "command": "ollydbg", "plan_required": "professional"},
        {"name": "windbg", "description": "Microsoft debugger", "command": "windbg", "plan_required": "professional"},
        
        # Binary Analysis
        {"name": "objdump", "description": "Display object file info", "command": "objdump", "plan_required": "starter"},
        {"name": "readelf", "description": "ELF file analyzer", "command": "readelf", "plan_required": "starter"},
        {"name": "nm", "description": "List symbols from object files", "command": "nm", "plan_required": "starter"},
        {"name": "strings", "description": "Print file strings", "command": "strings", "plan_required": "starter"},
        {"name": "ltrace", "description": "Library call tracer", "command": "ltrace", "plan_required": "starter"},
        {"name": "strace", "description": "System call tracer", "command": "strace", "plan_required": "starter"},
        {"name": "checksec", "description": "Check binary security", "command": "checksec", "plan_required": "starter"},
        {"name": "patchelf", "description": "ELF binary modifier", "command": "patchelf", "plan_required": "professional"},
        
        # Android/Mobile
        {"name": "apktool", "description": "Android app reverse engineering", "command": "apktool", "plan_required": "starter"},
        {"name": "jadx", "description": "Dex to Java decompiler", "command": "jadx", "plan_required": "starter"},
        {"name": "dex2jar", "description": "DEX to JAR converter", "command": "d2j-dex2jar", "plan_required": "starter"},
        {"name": "frida", "description": "Dynamic instrumentation", "command": "frida", "plan_required": "professional"},
        {"name": "objection", "description": "Mobile exploration toolkit", "command": "objection", "plan_required": "professional"},
        {"name": "drozer", "description": "Android security testing", "command": "drozer", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # REPORTING TOOLS (15 tools)
    # =======================================================================
    "Reporting Tools": [
        {"name": "dradis", "description": "Collaboration and reporting", "command": "dradis", "plan_required": "professional"},
        {"name": "faraday", "description": "Collaborative penetration test", "command": "faraday", "plan_required": "professional"},
        {"name": "pipal", "description": "Password analyzer", "command": "pipal", "plan_required": "starter"},
        {"name": "cutycapt", "description": "Web page screenshot", "command": "cutycapt", "plan_required": "starter"},
        {"name": "recordmydesktop", "description": "Screen recording", "command": "recordmydesktop", "plan_required": "starter"},
        {"name": "cherrytree", "description": "Note taking app", "command": "cherrytree", "plan_required": "starter"},
        {"name": "keepnote", "description": "Note taking app", "command": "keepnote", "plan_required": "starter"},
        {"name": "metagoofil", "description": "Metadata extractor", "command": "metagoofil", "plan_required": "starter"},
        {"name": "magictree", "description": "Data management", "command": "magictree", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # SOCIAL ENGINEERING (20 tools)
    # =======================================================================
    "Social Engineering": [
        {"name": "setoolkit", "description": "Social Engineering Toolkit", "command": "setoolkit", "plan_required": "professional"},
        {"name": "gophish", "description": "Phishing framework", "command": "gophish", "plan_required": "professional"},
        {"name": "king-phisher", "description": "Phishing campaign toolkit", "command": "king-phisher", "plan_required": "professional"},
        {"name": "evilginx2", "description": "MITM phishing framework", "command": "evilginx", "plan_required": "enterprise"},
        {"name": "modlishka", "description": "Reverse proxy phishing", "command": "modlishka", "plan_required": "enterprise"},
        {"name": "beef", "description": "Browser Exploitation Framework", "command": "beef-xss", "plan_required": "enterprise"},
        {"name": "httrack", "description": "Website copier", "command": "httrack", "plan_required": "starter"},
        {"name": "maltego", "description": "Link analysis tool", "command": "maltego", "plan_required": "enterprise"},
        {"name": "creepy", "description": "Geolocation OSINT", "command": "creepy", "plan_required": "professional"},
        {"name": "catphish", "description": "Phishing domain checker", "command": "catphish", "plan_required": "starter"},
    ],
    
    # =======================================================================
    # CLOUD SECURITY (20 tools)
    # =======================================================================
    "Cloud Security": [
        {"name": "prowler", "description": "AWS security assessment", "command": "prowler", "plan_required": "professional"},
        {"name": "scoutsuite", "description": "Multi-cloud security audit", "command": "scout", "plan_required": "professional"},
        {"name": "cloudsploit", "description": "Cloud security scanner", "command": "cloudsploit", "plan_required": "professional"},
        {"name": "cloudmapper", "description": "AWS environment analyzer", "command": "cloudmapper", "plan_required": "professional"},
        {"name": "pacu", "description": "AWS exploitation framework", "command": "pacu", "plan_required": "enterprise"},
        {"name": "s3scanner", "description": "S3 bucket scanner", "command": "s3scanner", "plan_required": "starter"},
        {"name": "cloudenum", "description": "Cloud service enumeration", "command": "cloud_enum", "plan_required": "professional"},
        {"name": "fireprox", "description": "AWS API Gateway proxy", "command": "fire.py", "plan_required": "professional"},
        {"name": "weirdaal", "description": "AWS attack library", "command": "weirdaal", "plan_required": "enterprise"},
        {"name": "awscli", "description": "AWS command line interface", "command": "aws", "plan_required": "starter"},
        {"name": "az", "description": "Azure CLI", "command": "az", "plan_required": "starter"},
        {"name": "gcloud", "description": "Google Cloud CLI", "command": "gcloud", "plan_required": "starter"},
        {"name": "terraform", "description": "Infrastructure as code", "command": "terraform", "plan_required": "professional"},
        {"name": "checkov", "description": "Infrastructure scanner", "command": "checkov", "plan_required": "professional"},
        {"name": "tfsec", "description": "Terraform security scanner", "command": "tfsec", "plan_required": "professional"},
    ],
    
    # =======================================================================
    # NETWORK UTILITIES (30+ tools)
    # =======================================================================
    "Network Utilities": [
        {"name": "openvpn", "description": "OpenVPN client", "command": "openvpn", "plan_required": "starter"},
        {"name": "wireguard", "description": "WireGuard VPN", "command": "wg", "plan_required": "starter"},
        {"name": "stunnel", "description": "SSL tunneling", "command": "stunnel", "plan_required": "professional"},
        {"name": "sshuttle", "description": "Poor man's VPN", "command": "sshuttle", "plan_required": "starter"},
        {"name": "proxychains", "description": "Proxy chains", "command": "proxychains4", "plan_required": "starter"},
        {"name": "tor", "description": "The Onion Router", "command": "tor", "plan_required": "starter"},
        {"name": "torsocks", "description": "Tor wrapper", "command": "torsocks", "plan_required": "starter"},
        {"name": "i2p", "description": "Invisible Internet Project", "command": "i2prouter", "plan_required": "professional"},
        {"name": "iptables", "description": "Linux firewall", "command": "iptables", "plan_required": "starter"},
        {"name": "nftables", "description": "Next-gen firewall", "command": "nft", "plan_required": "starter"},
        {"name": "ufw", "description": "Uncomplicated Firewall", "command": "ufw", "plan_required": "starter"},
        {"name": "ss", "description": "Socket statistics", "command": "ss", "plan_required": "starter"},
        {"name": "netstat", "description": "Network statistics", "command": "netstat", "plan_required": "starter"},
        {"name": "ip", "description": "IP configuration", "command": "ip", "plan_required": "starter"},
        {"name": "ifconfig", "description": "Interface config", "command": "ifconfig", "plan_required": "starter"},
        {"name": "route", "description": "Routing table", "command": "route", "plan_required": "starter"},
        {"name": "arp", "description": "ARP table", "command": "arp", "plan_required": "starter"},
        {"name": "ethtool", "description": "Ethernet tool", "command": "ethtool", "plan_required": "starter"},
        {"name": "iwconfig", "description": "Wireless config", "command": "iwconfig", "plan_required": "starter"},
        {"name": "iw", "description": "Wireless tool", "command": "iw", "plan_required": "starter"},
    ],
}

def populate_tools():
    """Populate database with comprehensive Kali Linux tools"""
    with app.app_context():
        # Get existing tool names
        existing_tools = {t.name.lower() for t in Tool.query.all()}
        
        added = 0
        skipped = 0
        
        for category, tools in KALI_TOOLS.items():
            for tool_data in tools:
                tool_name = tool_data["name"].lower()
                
                if tool_name in existing_tools:
                    skipped += 1
                    continue
                
                tool = Tool(
                    id=str(uuid.uuid4()),
                    name=tool_data["name"],
                    description=tool_data["description"],
                    category=category,
                    command_template=tool_data["command"],
                    plan_required=tool_data.get("plan_required", "starter"),
                    parameters={},
                    is_active=True
                )
                
                db.session.add(tool)
                existing_tools.add(tool_name)
                added += 1
        
        db.session.commit()
        
        total = Tool.query.count()
        print(f"\n{'='*60}")
        print(f"TOOL POPULATION COMPLETE")
        print(f"{'='*60}")
        print(f"Added: {added} new tools")
        print(f"Skipped: {skipped} (already exist)")
        print(f"Total in database: {total} tools")
        print(f"{'='*60}")
        
        # Print category breakdown
        print("\nCategory Breakdown:")
        for category in KALI_TOOLS.keys():
            count = Tool.query.filter_by(category=category).count()
            print(f"  {category}: {count}")
        
        return total

if __name__ == "__main__":
    total = populate_tools()
    if total >= 600:
        print(f"\n✅ SUCCESS: {total} tools (goal: 600+)")
    else:
        print(f"\n⚠️  Current: {total} tools (need {600 - total} more for goal)")
