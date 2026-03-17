"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import ThreatPulse from "@/components/three/ThreatPulse";
import { BookOpen, Rocket, Code2, FileText, Shield, Settings, Terminal, AlertTriangle, CheckCircle } from "lucide-react";

export default function DocsPage() {
  const t = useTranslations("docs");
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections = [
    { id: "getting-started", label: "Getting Started", icon: Rocket },
    { id: "scanning", label: "Scanning", icon: Shield },
    { id: "tools", label: "Tool Arsenal", icon: Terminal },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "api", label: "API Integration", icon: Code2 },
    { id: "compliance", label: "Compliance", icon: BookOpen },
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
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neon)]/10 font-mono font-bold text-[var(--color-neon)]">1</div>
                    <h3 className="text-lg font-bold text-white">Create Account</h3>
                    <p className="text-sm text-white/50">Register at semihkilic.com with email or GitHub OAuth. Verify your email to activate your account.</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neon)]/10 font-mono font-bold text-[var(--color-neon)]">2</div>
                    <h3 className="text-lg font-bold text-white">Set Up MFA</h3>
                    <p className="text-sm text-white/50">Go to Settings → Security and enable TOTP-based MFA with Google Authenticator or Authy.</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neon)]/10 font-mono font-bold text-[var(--color-neon)]">3</div>
                    <h3 className="text-lg font-bold text-white">Run First Scan</h3>
                    <p className="text-sm text-white/50">Navigate to Scans → New Scan. Enter your target, select tools, and launch your first security assessment.</p>
                  </div>
                </div>
                <div className="mt-6 glass-card border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300/80">Only scan targets you own or have explicit written permission to test. Unauthorized scanning may violate local laws.</p>
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
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { name: "Quick Scan", desc: "Top 20 tools — fast overview of your target's security posture in minutes.", color: "var(--color-neon)" },
                    { name: "Full Scan", desc: "All relevant tools — comprehensive assessment covering every attack vector.", color: "var(--color-cyan)" },
                    { name: "Custom Scan", desc: "Hand-pick specific tools, configure parameters, and build your own scan profile.", color: "var(--color-purple)" },
                    { name: "Scheduled Scan", desc: "Set recurring scans — daily, weekly, or monthly — with automated alerts.", color: "var(--color-orange)" },
                  ].map((scan) => (
                    <div key={scan.name} className="glass-card p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-3 w-3 rounded-full" style={{ background: scan.color }} />
                        <h3 className="font-bold text-white">{scan.name}</h3>
                      </div>
                      <p className="text-sm text-white/50">{scan.desc}</p>
                    </div>
                  ))}
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
                <h2 className="text-2xl font-bold text-white mb-6">Tool Arsenal — 401 Verified Tools</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { cat: "Information Gathering", tools: "nmap, whois, dig, amass, recon-ng", color: "var(--color-cyan)" },
                    { cat: "Vulnerability Analysis", tools: "nikto, sqlmap, openvas, wpscan", color: "var(--color-orange)" },
                    { cat: "Web Application Testing", tools: "burpsuite, gobuster, dirb, wfuzz", color: "var(--color-purple)" },
                    { cat: "Password Attacks", tools: "hydra, john, hashcat, medusa", color: "var(--color-neon)" },
                    { cat: "Wireless Testing", tools: "aircrack-ng, wifite, bettercap", color: "#ef476f" },
                    { cat: "Exploitation Tools", tools: "metasploit, searchsploit, beef-xss", color: "#ffd166" },
                  ].map((cat) => (
                    <div key={cat.cat} className="glass-card p-5">
                      <h3 className="font-bold text-white text-sm" style={{ color: cat.color }}>{cat.cat}</h3>
                      <p className="mt-2 font-mono text-xs text-white/40">{cat.tools}</p>
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
                <div className="mb-6">
                  <h3 className="font-bold text-white mb-3">Output Formats</h3>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { fmt: "PDF", desc: "For stakeholders and management" },
                      { fmt: "HTML", desc: "Interactive, in-browser viewing" },
                      { fmt: "JSON", desc: "Machine-readable for automation" },
                      { fmt: "CSV", desc: "Spreadsheet-compatible data" },
                      { fmt: "Markdown", desc: "Developer-friendly format" },
                    ].map((f) => (
                      <div key={f.fmt} className="glass-card px-4 py-3 flex-1 min-w-[140px]">
                        <span className="font-mono font-bold text-[var(--color-neon)]">{f.fmt}</span>
                        <p className="text-xs text-white/40 mt-1">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-3">Report Templates</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { name: "Executive Summary", desc: "High-level findings for leadership and board presentations." },
                      { name: "Technical Report", desc: "Deep-dive analysis with CVE references and remediation steps." },
                      { name: "Compliance Report", desc: "Map findings to OWASP Top 10, PCI-DSS, and ISO 27001 frameworks." },
                    ].map((tmpl) => (
                      <div key={tmpl.name} className="glass-card p-4">
                        <h4 className="font-bold text-white text-sm">{tmpl.name}</h4>
                        <p className="text-xs text-white/50 mt-1">{tmpl.desc}</p>
                      </div>
                    ))}
                  </div>
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
                <p className="text-sm text-white/50 mb-6">Full REST API available on Professional and Enterprise plans. Automate scans, retrieve results, and integrate with your CI/CD pipeline.</p>
                <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-[var(--color-neon)]/80 overflow-x-auto">
                  <pre>{`# Start a scan via API
curl -X POST https://semihkilic.com/api/v1/scan/start \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"tool": "nmap", "target": "example.com"}'

# Get scan results
curl https://semihkilic.com/api/v1/scans/SCAN_ID \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                </div>
                <p className="mt-4 text-xs text-white/40">
                  <CheckCircle size={12} className="inline mr-1 text-[var(--color-neon)]" />
                  Priority support included for Professional and Enterprise plans.
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
                <h2 className="text-2xl font-bold text-white mb-6">Compliance Templates</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { name: "OWASP Top 10", desc: "Map scan results to the OWASP Top 10 2021 categories with risk scoring and remediation guidance.", icon: "🛡️" },
                    { name: "PCI-DSS", desc: "PCI DSS v4.0 Requirement 11 compliance — validate vulnerability scanning and penetration testing.", icon: "💳" },
                    { name: "ISO 27001", desc: "ISO 27001 Annex A technical controls assessment with gap analysis and statement of applicability.", icon: "📋" },
                  ].map((c) => (
                    <div key={c.name} className="glass-card p-6">
                      <span className="text-3xl">{c.icon}</span>
                      <h3 className="mt-3 font-bold text-white">{c.name}</h3>
                      <p className="mt-2 text-sm text-white/50">{c.desc}</p>
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
