"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import GlitchText from "@/components/animations/GlitchText";
import { Target, BookOpen, User, Shield, Globe, Lock, Clock, Award, CheckCircle, ArrowRight, Mail } from "lucide-react";

const ParticleField = dynamic(() => import("@/components/three/ParticleField"), { ssr: false });

const stats = [
  { value: "2024", label: "Founded" },
  {value: "778", label: "Kali Tools" },
  { value: "2", label: "Continents" },
  { value: "24/7", label: "Scanning" },
];

const certifications = ["CEH", "MS Azure", "AWS", "CS50X", "15y ITS"];

const values = [
  { icon: Shield, title: "Accessibility", desc: "778 verified Kali tools accessible through your browser. Plans start free — no VMs, no CLI dependencies, no complex setup." },
  { icon: BookOpen, title: "Transparency", desc: "Every scan produces reproducible output. Raw results alongside parsed summaries so you can verify and audit every finding." },
  { icon: Lock, title: "Privacy & Trust", desc: "AES-256 encryption at rest, TLS 1.3 in transit. Multi-tenant isolation ensures your scan data stays yours." },
  { icon: Clock, title: "Continuous Protection", desc: "Scheduled scans, 24/7 monitoring, and real-time WebSocket alerts keep you ahead of emerging threats." },
];

const compliance = [
  { name: "SOC 2 (aligned)", color: "#9fef00" },
  { name: "ISO 27001 (aligned)", color: "#06d6a0" },
  { name: "GDPR / CCPA", color: "#118ab2" },
  { name: "HIPAA (aligned)", color: "#ef476f" },
  { name: "PCI DSS (aligned)", color: "#ffd166" },
];

const security = [
  { title: "AES-256 Encryption", desc: "Data encrypted at rest and in transit with military-grade encryption standards." },
  { title: "Global Infrastructure", desc: "Multi-region deployment for low-latency scanning and data residency compliance." },
  { title: "GDPR Ready", desc: "Full data subject rights: access, rectify, delete, export, and withdraw consent." },
  { title: "EU Data Residency", desc: "European data stays in European data centers. Full sovereignty compliance." },
];

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <>
      <ParticleField />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="whitespace-pre-line text-4xl font-extrabold md:text-6xl">
            <GlitchText text={t("title")} />
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Stats */}
      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-6 pb-16 md:grid-cols-4">
        {stats.map((s) => (
          <RevealOnScroll key={s.label}>
            <div className="glass-card flex flex-col items-center gap-2 p-6 text-center">
              <span className="font-mono text-3xl font-extrabold text-[var(--color-neon)]">{s.value}</span>
              <span className="text-xs text-white/40">{s.label}</span>
            </div>
          </RevealOnScroll>
        ))}
      </section>

      {/* Mission & Story */}
      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-20 md:grid-cols-2">
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <Target size={28} className="text-[var(--color-neon)]" />
            <h3 className="text-xl font-bold">{t("mission.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("mission.description")}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Our mission: protect <span className="text-[var(--color-neon)] font-semibold">10,000 organisations by 2027</span> with
              professional-grade security tools that are accessible to teams of every size.
            </p>
            <div className="mt-4 glass-card border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs text-yellow-300/80">
                <strong>$4.88 million</strong> — average cost of a data breach in 2024. CyberSec Pro exists to change that.
              </p>
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <BookOpen size={28} className="text-[var(--color-cyan)]" />
            <h3 className="text-xl font-bold">{t("story.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("story.description")}</p>
          </div>
        </RevealOnScroll>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <RevealOnScroll>
          <div className="section-heading mb-12"><h2>Our Values</h2></div>
        </RevealOnScroll>
        <div className="grid gap-6 md:grid-cols-2">
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <RevealOnScroll key={v.title}>
                <div className="glass-card flex gap-4 p-6">
                  <div className="flex-shrink-0">
                    <Icon size={24} className="text-[var(--color-neon)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{v.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">{v.desc}</p>
                  </div>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </section>

      {/* Compliance */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <RevealOnScroll>
          <div className="section-heading mb-12"><h2>Compliance Frameworks We Align With</h2></div>
        </RevealOnScroll>
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          {compliance.map((c) => (
            <RevealOnScroll key={c.name}>
              <div className="glass-card flex items-center gap-3 px-6 py-4" style={{ borderColor: `${c.color}30` }}>
                <CheckCircle size={18} style={{ color: c.color }} />
                <span className="text-sm font-semibold text-white">{c.name}</span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
        <p className="text-center text-xs text-white/40 max-w-2xl mx-auto">
          We design our controls and reporting against these frameworks. Independent third-party certifications (SOC 2, ISO 27001, HIPAA, PCI DSS) are not yet held; GDPR / CCPA data subject rights are honored.
        </p>
      </section>

      {/* Security Infrastructure */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <RevealOnScroll>
          <div className="section-heading mb-12"><h2>Security Infrastructure</h2></div>
        </RevealOnScroll>
        <div className="grid gap-4 md:grid-cols-2">
          {security.map((s) => (
            <RevealOnScroll key={s.title}>
              <div className="glass-card p-6">
                <h3 className="font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-white/50">{s.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Founder */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <RevealOnScroll>
          <div className="section-heading mb-12"><h2>{t("team.title")}</h2></div>
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="glass-card mx-auto max-w-3xl p-8">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              <div className="flex-shrink-0">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-neon)]/10">
                  <User size={40} className="text-[var(--color-neon)]" />
                </div>
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold">{t("team.founder.name")}</h3>
                <p className="font-mono text-sm text-[var(--color-neon)]">{t("team.founder.role")}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">
                  Independent developer and IT professional based in <span className="text-white/70 font-medium">Toronto, Canada</span>.
                  Building CyberSec Pro solo — every line of code, every deployment, every design decision.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  <span className="text-white/70 font-semibold">15 years</span> of experience in IT Systems (ITS) — System Administration, 
                  ERP systems, Network infrastructure, Virtualization, and IT operations management. 
                  Previously at <span className="text-white/70 font-medium">KPMG</span> and 
                  co-founder of <span className="text-white/70 font-medium">Vitastra</span>.
                </p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {[
                    { role: "System Administration", detail: "Windows Server, Linux, Active Directory, Group Policy, DNS, DHCP, Exchange. Full enterprise infrastructure lifecycle management." },
                    { role: "ERP Systems", detail: "SAP, Microsoft Dynamics, enterprise resource planning deployment and administration. End-to-end business process integration." },
                    { role: "Network & Security", detail: "Cisco, Fortinet, VPN, firewall management, network architecture, monitoring and troubleshooting at enterprise scale." },
                    { role: "Virtualization & Cloud", detail: "VMware vSphere, Hyper-V, Azure, AWS. Data centre virtualisation, migration projects, and hybrid cloud deployments." },
                    { role: "IT Operations", detail: "ITIL-aligned service management, helpdesk operations, vendor management, procurement, and technical team leadership." },
                    { role: "Development (Self-taught)", detail: "Built CyberSec Pro from scratch: Rust/Axum backend, React/Next.js frontend, PostgreSQL, Nginx, Docker. Entirely self-taught in programming." },
                  ].map((r) => (
                    <div key={r.role} className="glass-card p-3">
                      <h4 className="text-xs font-bold text-[var(--color-neon)]">{r.role}</h4>
                      <p className="text-[10px] text-white/35 mt-1 leading-relaxed">{r.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                  {certifications.map((cert) => (
                    <span key={cert} className="rounded-full bg-[var(--color-neon)]/10 px-3 py-1 text-xs font-mono font-bold text-[var(--color-neon)]">
                      {cert}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-white/30 italic">
                  &ldquo;I&apos;m building CyberSec Pro entirely on my own — no team, no investors, just one person&apos;s vision to make professional-grade security testing accessible to everyone. If you believe in this mission, your support means the world.&rdquo;
                </p>
                <a href="mailto:info@cyber-sec-pro.com" className="mt-4 inline-flex items-center gap-2 text-xs text-white/40 hover:text-[var(--color-neon)] transition">
                  <Mail size={12} /> support@cyber-sec-pro.com
                </a>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Join Team CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <RevealOnScroll>
          <div className="glass-card border-dashed border-[var(--color-neon)]/20 p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Join Our Team</h3>
            <p className="text-sm text-white/50 mb-4">Help us build the future of cybersecurity. We&apos;re always looking for talented people.</p>
            <a href="/careers" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-neon)] hover:underline">
              View Open Positions <ArrowRight size={14} />
            </a>
          </div>
        </RevealOnScroll>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <RevealOnScroll>
          <div className="glass-card bg-gradient-to-r from-[var(--color-neon)]/5 to-transparent p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to Secure Your Infrastructure?</h2>
            <p className="text-sm text-white/50 mb-6">Start scanning with 778 professional security tools. No credit card required.</p>
            <div className="flex items-center justify-center gap-4">
              <a href="/dashboard/login" className="btn-primary text-sm">
                Start Free Scan
              </a>
              <a href="mailto:info@cyber-sec-pro.com" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-[var(--color-neon)] transition">
                Contact Us <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
