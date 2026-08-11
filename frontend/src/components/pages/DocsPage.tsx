"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import ThreatPulse from "@/components/three/ThreatPulse";
import { BookOpen, Rocket, Code2, FileText, Shield, Terminal, AlertTriangle, CheckCircle, Check, Settings, Cpu, Zap, Globe, Lock, Users, BarChart3, Clock, Wifi } from "lucide-react";

export default function DocsPage() {
  const t = useTranslations("docs");
  const pricing = useTranslations("pricing");
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections = [
    { id: "getting-started", label: "Getting Started", icon: Rocket },
    { id: "scanning", label: "Scanning", icon: Shield },
    { id: "tools", label: "Tool Arsenal", icon: Terminal },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "api", label: "API Integration", icon: Code2 },
    { id: "compliance", label: "Compliance", icon: BookOpen },
    { id: "advanced", label: "Advanced", icon: Settings },
    { id: "architecture", label: "Architecture", icon: Cpu },
  ];

  return (
    <>
      <ThreatPulse />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        {/* Section Nav */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeSection === s.id
                    ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                    : "border border-white/10 text-white/50 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
                }`}
              >
                <Icon size={14} /> {s.label}
              </button>
            );
          })}
        </div>

        {/* Getting Started */}
        {activeSection === "getting-started" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Getting Started</h2>
                <p className="text-sm text-white/50 mb-6">Get up and running with CyberSec Pro in under 5 minutes. Follow these steps to launch your first security assessment.</p>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    { n: "1", title: "Create Account", desc: "Register at cyber-sec-pro.com with your email address or GitHub OAuth. Verify your email to activate. You'll receive a 14-day free trial with access to basic scanning tools." },
                    { n: "2", title: "Set Up MFA", desc: "Navigate to Settings → Security and enable TOTP-based MFA using Google Authenticator, Authy, or any RFC 6238 compatible app. MFA is mandatory for all accounts." },
                    { n: "3", title: "Add Your First Target", desc: "Go to Targets → Add Target. Enter your domain or IP address. Verify ownership via DNS TXT record, HTTP file upload, or HTML meta tag verification." },
                    { n: "4", title: "Configure Scan Profile", desc: "Choose a scan type (Quick, Full, Custom, or Scheduled). Select tools and set parameters. Save as a reusable profile for future scans." },
                    { n: "5", title: "Launch Scan", desc: "Click 'Start Scan' and watch results stream live via WebSocket. Terminal-style output shows real-time tool execution with progress indicators." },
                    { n: "6", title: "Generate Report", desc: "Once complete, generate reports in PDF, HTML, JSON, CSV, or Markdown. Use templates (Executive, Technical, Compliance) for professional output." },
                  ].map((step) => (
                    <div key={step.n} className="flex flex-col gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neon)]/10 font-mono font-bold text-[var(--color-neon)]">{step.n}</div>
                      <h3 className="text-lg font-bold text-white">{step.title}</h3>
                      <p className="text-sm text-white/50">{step.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 glass-card border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-yellow-300/80 font-semibold">Authorization Required</p>
                    <p className="text-xs text-yellow-300/60 mt-1">Only scan targets you own or have explicit written permission to test. Unauthorized scanning may violate the Computer Fraud and Abuse Act (CFAA), UK Computer Misuse Act, and similar legislation worldwide. CyberSec Pro logs all scan activity for compliance and audit purposes.</p>
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            {/* System Requirements */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">System Requirements</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white/80 mb-2">Browser Support</h3>
                    <ul className="text-sm text-white/50 space-y-1">
                      <li>• Chrome 90+ (recommended)</li>
                      <li>• Firefox 88+</li>
                      <li>• Safari 15+</li>
                      <li>• Edge 90+</li>
                      <li>• WebSocket support required</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/80 mb-2">Network Requirements</h3>
                    <ul className="text-sm text-white/50 space-y-1">
                      <li>• Stable internet connection (5 Mbps+)</li>
                      <li>• HTTPS port 443 access</li>
                      <li>• WebSocket connections supported</li>
                      <li>• No VPN/proxy restrictions on API calls</li>
                    </ul>
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            {/* Account Types */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-6">Account Types & Roles</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { role: "Owner", desc: "Full platform access. Manage billing, team members, and all settings. One per organisation.", color: "var(--color-neon)", permissions: ["Billing & Subscriptions", "Team Management", "All Scans & Reports", "API Keys", "Organisation Settings"] },
                    { role: "Admin", desc: "Create scans, manage targets, generate reports. Can invite team members. Cannot modify billing.", color: "var(--color-cyan)", permissions: ["Create & Run Scans", "Manage Targets", "Generate Reports", "Invite Members", "View Analytics"] },
                    { role: "Analyst", desc: "Run scans, view results, generate reports. Cannot manage targets or team settings.", color: "var(--color-purple)", permissions: ["Run Assigned Scans", "View Results", "Generate Reports", "Export Data", "Dashboard Access"] },
                  ].map((r) => (
                    <div key={r.role} className="glass-card p-5 flex flex-col">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                        <h4 className="font-bold text-sm" style={{ color: r.color }}>{r.role}</h4>
                      </div>
                      <p className="text-xs text-white/40 mb-4">{r.desc}</p>
                      <div className="mt-auto space-y-1.5">
                        {r.permissions.map((p) => (
                          <div key={p} className="flex items-center gap-2 text-[11px] text-white/30">
                            <Check size={10} className="shrink-0" style={{ color: r.color }} />
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Scanning */}
        {activeSection === "scanning" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Scanning & Assessment</h2>
                <p className="text-sm text-white/50 mb-6">CyberSec Pro offers four distinct scan modes, each designed for different assessment scenarios. All scans produce real-time output streamed via WebSocket.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { name: "Quick Scan", desc: "Top 20 tools run in parallel — Nmap, Nikto, WhatWeb, SSL scan, and more. Ideal for a fast security posture overview. Typically completes in 5-15 minutes depending on target size.", color: "var(--color-neon)", time: "5-15 min" },
                    { name: "Full Scan", desc: "All relevant tools from your plan tier (50-183 tools). Comprehensive assessment covering network, web, wireless, and application attack vectors. Can take 1-4 hours for large targets.", color: "var(--color-cyan)", time: "1-4 hours" },
                    { name: "Custom Scan", desc: "Hand-pick specific tools, configure individual parameters (ports, wordlists, intensity), and save as reusable scan profiles. Full control over every tool argument.", color: "var(--color-purple)", time: "Variable" },
                    { name: "Scheduled Scan", desc: "Set recurring scans — daily, weekly, or monthly. Configure automated alerts via email, webhook, or Slack. Compare results across scan history for trend analysis.", color: "var(--color-orange)", time: "Recurring" },
                  ].map((scan) => (
                    <div key={scan.name} className="glass-card p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ background: scan.color }} />
                          <h3 className="font-bold text-white">{scan.name}</h3>
                        </div>
                        <span className="text-[10px] font-mono text-white/30 flex items-center gap-1"><Clock size={10} />{scan.time}</span>
                      </div>
                      <p className="text-sm text-white/50">{scan.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Scan Lifecycle */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-6">Scan Lifecycle</h2>
                <div className="flex flex-wrap gap-3 items-center justify-center">
                  {[
                    { name: "Created", desc: "Scan configured and saved", color: "var(--color-neon)" },
                    { name: "Queued", desc: "Waiting for available slot", color: "var(--color-neon)" },
                    { name: "Initializing", desc: "Loading tools & targets", color: "var(--color-cyan)" },
                    { name: "Running", desc: "Active tool execution", color: "var(--color-cyan)" },
                    { name: "Analyzing", desc: "Processing results", color: "var(--color-purple)" },
                    { name: "Completed", desc: "Report ready", color: "var(--color-neon)" },
                  ].map((s, i) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="rounded-full border px-4 py-2 text-xs font-mono font-bold" style={{ borderColor: `color-mix(in srgb, ${s.color} 30%, transparent)`, color: s.color, background: `color-mix(in srgb, ${s.color} 8%, transparent)` }}>{s.name}</span>
                        <span className="mt-1 text-[10px] text-white/25">{s.desc}</span>
                      </div>
                      {i < 5 && <span className="text-white/20 text-lg mb-4">→</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Pause & Resume", desc: "Pause any running scan and resume later without losing progress." },
                    { label: "Incremental Results", desc: "Results are saved as each tool completes — never lose data mid-scan." },
                    { label: "Real-Time Streaming", desc: "Watch tool output live via WebSocket in a terminal-style interface." },
                  ].map((f) => (
                    <div key={f.label} className="glass-card p-4">
                      <h4 className="text-xs font-bold text-white/70">{f.label}</h4>
                      <p className="text-[11px] text-white/35 mt-1">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Target Verification */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Target Verification Methods</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { method: "DNS TXT Record", desc: "Add a TXT record to your domain's DNS zone with the verification token provided. Fastest method for domain owners." },
                    { method: "HTTP File Upload", desc: "Upload a verification file to your web root (/.well-known/cybersec-verify.txt). Works for any web server." },
                    { method: "HTML Meta Tag", desc: "Add a <meta> tag to your homepage's <head>. Simplest method for web applications you control." },
                  ].map((m) => (
                    <div key={m.method} className="glass-card p-4">
                      <h4 className="font-bold text-white text-sm">{m.method}</h4>
                      <p className="text-xs text-white/40 mt-2">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Real-time Output */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Real-Time Output</h2>
                <p className="text-sm text-white/50 mb-4">Watch scan results stream live in a terminal-style interface. Each tool's output is displayed as it runs, with syntax highlighting and structured parsing.</p>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/60">
{`$ nmap -sV -sC -O target.example.com
[*] Starting Nmap 7.94SVN at 2026-01-15 14:30 UTC
[*] Scanning target.example.com (203.0.113.42)
[+] Open ports: 22/tcp (SSH), 80/tcp (HTTP), 443/tcp (HTTPS)
[+] OS Detection: Linux 5.x (98% confidence)
[+] Service: Apache/2.4.57 on port 80
[+] Service: OpenSSH 9.3p1 on port 22
[*] NSE: Running vulnerability scripts...
[!] CVE-2023-25690: Apache HTTP Request Smuggling (HIGH)
[*] Scan completed: 1 host up, 3 ports open, 1 vuln found`}</pre>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Tool Arsenal */}
        {activeSection === "tools" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-2">Tool Arsenal — 183 Verified Kali Linux Tools</h2>
                <p className="text-sm text-white/50 mb-6">Every tool is verified, containerized, and optimized for cloud execution. Each tool runs in an isolated environment with configurable parameters.</p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { cat: "Information Gathering", count: 75, tools: "nmap, whois, dig, amass, recon-ng, masscan, theHarvester, fierce, dnsenum, dnsrecon, sublist3r, maltego", color: "var(--color-cyan)", icon: Globe },
                    { cat: "Vulnerability Analysis", count: 56, tools: "nikto, sqlmap, openvas, wpscan, nessus, lynis, nuclei, trivy, grype, semgrep, retire.js", color: "var(--color-orange)", icon: Shield },
                    { cat: "Web Application Testing", count: 48, tools: "burpsuite, gobuster, dirb, wfuzz, ffuf, httpx, katana, dalfox, xsstrike, arjun, paramspider", color: "var(--color-purple)", icon: Globe },
                    { cat: "Password Attacks", count: 42, tools: "hydra, john, hashcat, medusa, ncrack, cewl, crunch, patator, ophcrack, rainbowcrack", color: "var(--color-neon)", icon: Lock },
                    { cat: "Exploitation", count: 38, tools: "metasploit, searchsploit, beef-xss, msfvenom, exploit-db, routersploit, commix, shellnoob", color: "#ef476f", icon: Zap },
                    { cat: "Wireless Testing", count: 28, tools: "aircrack-ng, wifite, bettercap, reaver, pixiewps, fern-wifi-cracker, hostapd-wpe", color: "#ffd166", icon: Wifi },
                    { cat: "Digital Forensics", count: 32, tools: "autopsy, volatility, binwalk, foremost, sleuthkit, bulk_extractor, scalpel, dc3dd", color: "var(--color-cyan)", icon: BarChart3 },
                    { cat: "Reverse Engineering", count: 24, tools: "ghidra, radare2, gdb, objdump, strace, ltrace, dex2jar, apktool, jadx, frida", color: "#e07aff", icon: Cpu },
                    { cat: "Post-Exploitation", count: 22, tools: "mimikatz, bloodhound, empire, covenant, sliver, chisel, ligolo-ng, pwncat", color: "var(--color-orange)", icon: Terminal },
                    { cat: "Social Engineering", count: 12, tools: "setoolkit, gophish, evilginx2, king-phisher, modlishka", color: "#ff6b6b", icon: Users },
                    { cat: "Reporting", count: 10, tools: "dradis, faraday, serpico, defectdojo, plextrac", color: "#4ecdc4", icon: FileText },
                    { cat: "Network Sniffing", count: 14, tools: "wireshark, tcpdump, ettercap, mitmproxy, responder, bettercap, netsniff-ng", color: "#45b7d1", icon: Wifi },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.cat} className="glass-card p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon size={14} style={{ color: cat.color }} />
                            <h3 className="font-bold text-white text-sm">{cat.cat}</h3>
                          </div>
                          <span className="text-[10px] font-mono text-white/30">{cat.count} tools</span>
                        </div>
                        <p className="font-mono text-[11px] text-white/35 leading-relaxed">{cat.tools}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </RevealOnScroll>

            {/* Tool Configuration */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Tool Configuration</h2>
                <p className="text-sm text-white/50 mb-4">Every tool can be configured with custom parameters. Here's an example Nmap configuration:</p>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-[var(--color-neon)]/70">
{`{
  "tool": "nmap",
  "target": "target.example.com",
  "parameters": {
    "scan_type": "-sV -sC -O",     // Version, scripts, OS detection
    "ports": "1-65535",             // Full port range
    "timing": "-T4",               // Aggressive timing
    "scripts": "vuln,exploit",     // NSE script categories
    "output_format": "xml",        // Structured XML output
    "exclude_ports": "25",         // Skip SMTP
    "max_retries": 2
  }
}`}</pre>
                </div>
              </div>
            </RevealOnScroll>

            {/* Plan Tool Access */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Tool Access by Plan</h2>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { plan: "Free Trial", count: "183", desc: "All tools, 1 scan, 14-day trial", color: "white/60" },
                    {
                      plan: `${pricing("plans.starter.name")} (${pricing("plans.starter.price")}${pricing("plans.starter.period")})`,
                      count: "183",
                      desc: "1 domain, weekly scans, reports",
                      color: "var(--color-neon)",
                    },
                    {
                      plan: `${pricing("plans.professional.name")} (${pricing("plans.professional.price")}${pricing("plans.professional.period")})`,
                      count: "183",
                      desc: "5 domains, API, compliance reports",
                      color: "var(--color-cyan)",
                    },
                    {
                      plan: `${pricing("plans.enterprise.name")} (${pricing("plans.enterprise.price")}${pricing("plans.enterprise.period")})`,
                      count: "183",
                      desc: "Unlimited, SSO, dedicated support",
                      color: "var(--color-purple)",
                    },
                  ].map((p) => (
                    <div key={p.plan} className="glass-card p-4 text-center">
                      <span className="text-2xl font-extrabold font-mono" style={{ color: p.color }}>{p.count}</span>
                      <h4 className="text-sm font-bold text-white mt-1">{p.plan}</h4>
                      <p className="text-[10px] text-white/30 mt-1">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Reports */}
        {activeSection === "reports" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Reports & Templates</h2>
                <p className="text-sm text-white/50 mb-6">Generate professional, compliance-ready reports from any scan. Choose from multiple formats and templates, or create your own.</p>
                <div className="mb-8">
                  <h3 className="font-bold text-white mb-3">Output Formats</h3>
                  <div className="grid gap-3 md:grid-cols-5">
                    {[
                      { fmt: "PDF", desc: "Branded, paginated reports for stakeholders. Includes executive summary, findings table, risk matrix, and remediation timeline.", icon: "📄" },
                      { fmt: "HTML", desc: "Interactive in-browser reports with collapsible sections, filtering, and search. Shareable via link with access controls.", icon: "🌐" },
                      { fmt: "JSON", desc: "Machine-readable structured data. Every finding is a typed object with CVE, CVSS, evidence, and remediation fields.", icon: "📊" },
                      { fmt: "CSV", desc: "Spreadsheet-compatible for bulk analysis. Import directly into Excel, Google Sheets, or your SIEM/GRC platform.", icon: "📋" },
                      { fmt: "Markdown", desc: "Developer-friendly format. Paste directly into Jira, Confluence, GitHub Issues, or your internal wiki.", icon: "📝" },
                    ].map((f) => (
                      <div key={f.fmt} className="glass-card px-4 py-4">
                        <div className="text-xl mb-2">{f.icon}</div>
                        <span className="font-mono font-bold text-[var(--color-neon)]">{f.fmt}</span>
                        <p className="text-[10px] text-white/35 mt-2 leading-relaxed">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="font-bold text-white mb-3">Report Templates</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { name: "Executive Summary", desc: "High-level findings for leadership and board presentations. Risk score dashboard, trend graphs, and a prioritized top-10 findings list. Non-technical language with business impact analysis.", color: "var(--color-neon)" },
                      { name: "Technical Report", desc: "Deep-dive analysis for security engineers. CVE references, CVSS v3.1 scores, proof-of-concept details, raw tool output, and step-by-step remediation with code examples.", color: "var(--color-cyan)" },
                      { name: "Compliance Report", desc: "Map findings to frameworks: OWASP Top 10 2021, PCI-DSS v4.0, ISO 27001 Annex A, NIST CSF, and CIS Controls v8. Gap analysis with control coverage percentages.", color: "var(--color-purple)" },
                    ].map((tmpl) => (
                      <div key={tmpl.name} className="glass-card p-5">
                        <h4 className="font-bold text-sm" style={{ color: tmpl.color }}>{tmpl.name}</h4>
                        <p className="text-[11px] text-white/40 mt-2 leading-relaxed">{tmpl.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-3">Report Sections</h3>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    {["Executive Summary", "Scope & Methodology", "Risk Matrix (Critical/High/Medium/Low)", "Findings Table with CVSS", "Proof of Concept / Evidence", "Remediation Guidance", "Trend Analysis (vs. previous scans)", "Appendix: Raw Tool Output"].map((s) => (
                      <div key={s} className="flex items-start gap-2 text-xs text-white/50">
                        <CheckCircle size={12} className="text-[var(--color-neon)] flex-shrink-0 mt-0.5" />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            {/* CVSS Scoring */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Vulnerability Scoring</h2>
                <p className="text-sm text-white/50 mb-4">All findings are scored using CVSS v3.1. Automatic severity classification:</p>
                <div className="grid gap-2 md:grid-cols-5">
                  {[
                    { level: "Critical", range: "9.0-10.0", color: "#dc2626", desc: "Immediate action" },
                    { level: "High", range: "7.0-8.9", color: "#f97316", desc: "Priority fix" },
                    { level: "Medium", range: "4.0-6.9", color: "#eab308", desc: "Scheduled fix" },
                    { level: "Low", range: "0.1-3.9", color: "#22c55e", desc: "Accepted risk" },
                    { level: "Info", range: "0.0", color: "#6b7280", desc: "Informational" },
                  ].map((s) => (
                    <div key={s.level} className="glass-card p-3 text-center" style={{ borderColor: `${s.color}30` }}>
                      <span className="font-bold text-sm" style={{ color: s.color }}>{s.level}</span>
                      <p className="font-mono text-[10px] text-white/30 mt-1">{s.range}</p>
                      <p className="text-[10px] text-white/40 mt-1">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* API Integration */}
        {activeSection === "api" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-4">API Integration</h2>
                <p className="text-sm text-white/50 mb-6">Full REST API with 100+ endpoints available on Professional and Enterprise plans. Automate scans, retrieve results, and integrate with your CI/CD pipeline. OpenAPI 3.0 spec available.</p>

                <h3 className="font-bold text-white mb-3">Authentication</h3>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-[var(--color-neon)]/80 overflow-x-auto mb-6">
                  <pre>{`# Get JWT token
curl -X POST https://api.cyber-sec-pro.com/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@company.com", "password": "your_password"}'

# Response: { "access_token": "eyJhb...", "token_type": "Bearer" }

# Use token in all subsequent requests:
Authorization: Bearer <access_token>`}</pre>
                </div>

                <h3 className="font-bold text-white mb-3">Common Workflows</h3>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-[var(--color-neon)]/80 overflow-x-auto mb-6">
                  <pre>{`# 1. Create a scan
curl -X POST https://api.cyber-sec-pro.com/v1/scans/create \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"target": "example.com", "tool": "nmap", "params": "-sV -sC"}'

# 2. Execute the scan
curl -X POST https://api.cyber-sec-pro.com/v1/scans/execute \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"scan_id": "SCAN_ID"}'

# 3. Stream real-time output (SSE)
curl https://api.cyber-sec-pro.com/v1/scan/SCAN_ID/output \\
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Get scan results
curl https://api.cyber-sec-pro.com/v1/scan/SCAN_ID/result \\
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Generate report
curl -X POST https://api.cyber-sec-pro.com/v1/reports/generate \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"scan_id": "SCAN_ID", "template": "technical", "format": "pdf"}'`}</pre>
                </div>

                <h3 className="font-bold text-white mb-3">CI/CD Integration (GitHub Actions)</h3>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-white/50 overflow-x-auto">
                  <pre>{`# .github/workflows/security-scan.yml
name: Security Scan
on: [push]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Run CyberSec Pro Scan
        env:
          CYBERSEC_TOKEN: \${{ secrets.CYBERSEC_API_TOKEN }}
        run: |
          SCAN=$(curl -s -X POST https://api.cyber-sec-pro.com/v1/scan/start \\
            -H "Authorization: Bearer $CYBERSEC_TOKEN" \\
            -d '{"tool":"nikto","target":"staging.example.com"}')
          echo "Scan started: $SCAN"`}</pre>
                </div>
                <p className="mt-4 text-xs text-white/40">
                  <CheckCircle size={12} className="inline mr-1 text-[var(--color-neon)]" />
                  Rate limit: 60 requests/minute (Professional), 300 requests/minute (Enterprise). Full API reference at /api-reference.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Compliance */}
        {activeSection === "compliance" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Compliance Templates & Frameworks</h2>
                <p className="text-sm text-white/50 mb-6">Map your scan findings to industry compliance frameworks automatically. Generate audit-ready reports that satisfy regulator requirements.</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { name: "OWASP Top 10 (2021)", desc: "Map web application findings to all 10 OWASP categories. Includes risk scoring per category, failed/passed control counts, and prioritized remediation roadmap. Covers: Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Auth Failures, Data Integrity, Logging Failures, SSRF.", icon: "🛡️", color: "var(--color-neon)" },
                    { name: "PCI-DSS v4.0", desc: "Validate Requirement 6 (Secure Development) and Requirement 11 (Security Testing) compliance. Automated evidence collection for quarterly ASV scans. Maps tool output to specific PCI requirements. Includes network segmentation testing and vulnerability scan schedules.", icon: "💳", color: "var(--color-cyan)" },
                    { name: "ISO 27001", desc: "Annex A technical controls assessment (A.8 - Technology Controls). Gap analysis with coverage percentages. Statement of Applicability (SoA) auto-generation. Maps to clauses 8.8 (Vulnerability Management), 8.9 (Configuration), and 8.16 (Monitoring).", icon: "📋", color: "var(--color-purple)" },
                  ].map((c) => (
                    <div key={c.name} className="glass-card p-6">
                      <span className="text-3xl">{c.icon}</span>
                      <h3 className="mt-3 font-bold text-white">{c.name}</h3>
                      <p className="mt-2 text-[11px] text-white/40 leading-relaxed">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Additional Frameworks */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Additional Frameworks</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { name: "NIST Cybersecurity Framework (CSF 2.0)", desc: "Map to all 6 functions: Govern, Identify, Protect, Detect, Respond, Recover. Maturity scoring per function." },
                    { name: "CIS Controls v8", desc: "Assessment against 18 Critical Security Controls with implementation group (IG1/IG2/IG3) coverage analysis." },
                    { name: "MITRE ATT&CK", desc: "Map findings to ATT&CK techniques and tactics. Visualize coverage on the ATT&CK matrix with purple team exercise integration." },
                    { name: "SOC 2 Type II", desc: "Trust Services Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy) evidence collection." },
                    { name: "HIPAA", desc: "Technical safeguard assessment: Access Controls (§164.312(a)), Transmission Security (§164.312(e)), Audit Controls." },
                    { name: "GDPR (Article 32)", desc: "Security of processing assessment. Encryption, pseudonymisation, resilience testing, and restoration capability verification." },
                  ].map((f) => (
                    <div key={f.name} className="glass-card p-4">
                      <h4 className="font-bold text-white text-sm">{f.name}</h4>
                      <p className="text-[11px] text-white/40 mt-1">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Advanced */}
        {activeSection === "advanced" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Advanced Configuration</h2>

                <h3 className="font-bold text-white mb-3">Team Management</h3>
                <p className="text-sm text-white/50 mb-4">Invite up to 50 team members (Enterprise). Assign roles, set permissions per project, and audit all team activity.</p>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-white/50 overflow-x-auto mb-6">
                  <pre>{`POST /api/v1/settings/team/invite
{
  "email": "analyst@company.com",
  "role": "analyst",
  "projects": ["web-app-audit", "infrastructure-scan"]
}

# Update member role
PUT /api/v1/settings/team/:member_id/role
{ "role": "admin" }`}</pre>
                </div>

                <h3 className="font-bold text-white mb-3">API Keys</h3>
                <p className="text-sm text-white/50 mb-4">Generate scoped API keys with custom expiration. Each key can be restricted to specific endpoints (read-only, scan-only, full-access).</p>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-white/50 overflow-x-auto mb-6">
                  <pre>{`POST /api/v1/settings/api-keys
{
  "name": "CI/CD Pipeline",
  "scopes": ["scans:create", "scans:read", "reports:read"],
  "expires_in_days": 90
}

# Revoke a key
DELETE /api/v1/settings/api-keys/:key_id`}</pre>
                </div>

                <h3 className="font-bold text-white mb-3">Scan Schedules</h3>
                <p className="text-sm text-white/50 mb-4">Automate recurring scans with cron-style scheduling. Configure alerts for new Critical/High findings.</p>
                <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-white/50 overflow-x-auto mb-6">
                  <pre>{`POST /api/v1/schedules
{
  "name": "Weekly Full Scan",
  "target": "app.example.com",
  "scan_type": "full",
  "cron": "0 2 * * 1",           // Every Monday at 2 AM
  "notify": ["email", "slack"],
  "alert_on": ["critical", "high"]
}`}</pre>
                </div>

                <h3 className="font-bold text-white mb-3">Notification Settings</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { channel: "Email", desc: "Scan completion, new findings, weekly digests. Configurable per severity level." },
                    { channel: "Webhook", desc: "POST notifications to any URL. JSON payload with finding details. Retry with exponential backoff." },
                    { channel: "Slack", desc: "Direct integration via incoming webhook. Rich messages with severity colors and finding counts." },
                  ].map((n) => (
                    <div key={n.channel} className="glass-card p-4">
                      <h4 className="font-bold text-white text-sm">{n.channel}</h4>
                      <p className="text-xs text-white/40 mt-1">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* GDPR & Data */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">GDPR & Data Management</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { title: "Data Export", desc: "Export all your data (scans, reports, settings) in JSON format via /api/v1/gdpr/export. Available within 24 hours." },
                    { title: "Account Deletion", desc: "Full account deletion via /api/v1/gdpr/delete-account. 30-day cooling period, then permanent removal." },
                    { title: "Data Residency", desc: "EU data stays in EU data centres (Frankfurt, Amsterdam). Configure per-organisation data residency requirements." },
                    { title: "Audit Logs", desc: "Complete audit trail: every login, scan, report, and settings change. Retained for 24 months. Exportable." },
                  ].map((d) => (
                    <div key={d.title} className="glass-card p-4">
                      <h4 className="font-bold text-white text-sm">{d.title}</h4>
                      <p className="text-xs text-white/40 mt-1">{d.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}

        {/* Architecture */}
        {activeSection === "architecture" && (
          <div className="space-y-6">
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Platform Architecture</h2>
                <p className="text-sm text-white/50 mb-6">CyberSec Pro is built on a modern, high-performance stack designed for security, scalability, and real-time streaming.</p>

                <h3 className="font-bold text-white mb-3">Technology Stack</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { layer: "Backend", tech: "Rust + Axum 0.7", desc: "High-performance async API server with 100+ endpoints. Memory-safe, zero-cost abstractions, and sub-millisecond response times." },
                    { layer: "Frontend", tech: "Next.js 15 + React 18", desc: "Static-generated marketing site with next-intl (10 languages). Three.js/R3F for 3D visualisations, GSAP animations." },
                    { layer: "Dashboard", tech: "React + Vite + TanStack Query", desc: "SPA dashboard with real-time scan streaming, role-based access, and offline-capable data caching." },
                    { layer: "Database", tech: "PostgreSQL 16", desc: "Primary data store with row-level security, full-text search, and automated backup. AES-256 encryption at rest." },
                    { layer: "Cache", tech: "Redis", desc: "Session management, rate limiting, scan queue, and real-time pub/sub for WebSocket events." },
                    { layer: "Scan Engine", tech: "Containerised Kali Tools", desc: "Each tool runs in an isolated container with resource limits. Results parsed by custom Rust parsers for structured output." },
                  ].map((t) => (
                    <div key={t.layer} className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono font-bold text-[var(--color-neon)]">{t.layer}</span>
                        <span className="text-[10px] text-white/30">{t.tech}</span>
                      </div>
                      <p className="text-[11px] text-white/40">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Platform facts */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Platform at a Glance</h2>
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { metric: "183", label: "Security Tools" },
                    { metric: "22", label: "Categories" },
                    { metric: "Rust", label: "Backend Stack" },
                    { metric: "MIT", label: "Agent License" },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <span className="text-2xl font-extrabold font-mono text-[var(--color-neon)]">{m.metric}</span>
                      <p className="text-xs text-white/40 mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>

            {/* Security */}
            <RevealOnScroll>
              <div className="glass-card p-8">
                <h2 className="text-xl font-bold text-white mb-4">Security Architecture</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { title: "Encryption", desc: "AES-256 at rest, TLS 1.3 in transit. All secrets managed via encrypted vault. Zero plaintext credential storage." },
                    { title: "Authentication", desc: "JWT + TOTP MFA. OAuth 2.0 (GitHub, Google). API keys with scoped permissions. Brute-force protection with rate limiting." },
                    { title: "Isolation", desc: "Multi-tenant architecture with row-level database security. Each scan runs in an ephemeral container destroyed after completion." },
                    { title: "Audit", desc: "Every action logged with timestamp, user, IP, and request details. Tamper-proof audit log with cryptographic chaining." },
                  ].map((s) => (
                    <div key={s.title} className="glass-card p-4">
                      <h4 className="font-bold text-white text-sm">{s.title}</h4>
                      <p className="text-xs text-white/40 mt-1">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          </div>
        )}
      </section>
    </>
  );
}
