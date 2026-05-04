"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import CyberRadar from "@/components/three/CyberRadar";
import { MapPin, Briefcase, Laptop, Coins, GraduationCap, Monitor, Heart, Shield, Send } from "lucide-react";

const jobs = [
  {
    title: "Senior Rust Backend Engineer",
    department: "Engineering",
    location: "Remote (EU preferred)",
    type: "Full-time",
    description: "Build high-performance security scanning infrastructure with Axum and Tokio.",
    requirements: ["5+ years Rust (Axum, Tokio, sqlx)", "PostgreSQL & Redis expertise", "REST API design at scale", "Security mindset — OWASP awareness"],
    color: "var(--color-neon)",
  },
  {
    title: "Frontend Engineer (React/Next.js)",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    description: "Create beautiful, performant interfaces for security professionals worldwide.",
    requirements: ["3+ years React/Next.js", "TypeScript, TailwindCSS", "Three.js/R3F experience a plus", "Accessibility and performance focus"],
    color: "var(--color-cyan)",
  },
  {
    title: "Security Researcher",
    department: "Security",
    location: "Remote",
    type: "Full-time",
    description: "Research vulnerabilities, develop new scanning techniques, and improve tool integrations.",
    requirements: ["OSCP, OSCE, or equivalent certification", "Kali Linux & penetration testing expertise", "CVE research experience", "Strong technical writing"],
    color: "var(--color-purple)",
  },
  {
    title: "Detection Engineer",
    department: "Security",
    location: "Remote",
    type: "Full-time",
    description: "Design and implement detection rules, improve scan accuracy, and reduce false positives.",
    requirements: ["SIEM/SOAR experience", "Regex & YARA rule writing", "Network protocol analysis", "Python or Rust scripting"],
    color: "var(--color-orange)",
  },
  {
    title: "DevOps / SRE Engineer",
    department: "Infrastructure",
    location: "Remote (EU preferred)",
    type: "Full-time",
    description: "Scale our infrastructure to handle millions of security scans with zero downtime.",
    requirements: ["Kubernetes & Docker orchestration", "CI/CD pipelines (GitHub Actions)", "Monitoring (Prometheus, Grafana)", "Linux systems administration"],
    color: "#ef476f",
  },
  {
    title: "Product Manager",
    department: "Product",
    location: "Remote",
    type: "Full-time",
    description: "Define product roadmap, prioritize features, and translate customer needs into engineering specs.",
    requirements: ["3+ years PM experience (B2B SaaS)", "Cybersecurity domain knowledge", "Data-driven decision making", "Excellent stakeholder communication"],
    color: "#ffd166",
  },
];

const perks = [
  { icon: Laptop, label: "remote", detail: "100% remote — work from anywhere" },
  { icon: Coins, label: "equity", detail: "Competitive salary + equity options" },
  { icon: GraduationCap, label: "learning", detail: "€2,000/year learning & conference budget" },
  { icon: Monitor, label: "hardware", detail: "MacBook Pro + security lab setup" },
  { icon: Heart, label: "health", detail: "Health insurance & wellness support" },
  { icon: Shield, label: "security", detail: "Access to all 778 tools for research" },
];

export default function CareersPage() {
  const t = useTranslations("careers");

  return (
    <>
      <CyberRadar />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="whitespace-pre-line text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Perks */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-6 pb-16 md:grid-cols-3">
        {perks.map(({ icon: Icon, label, detail }) => (
          <RevealOnScroll key={label}>
            <div className="glass-card flex flex-col items-center gap-3 p-6 text-center">
              <Icon size={28} className="text-[var(--color-neon)]" />
              <span className="text-sm font-semibold text-white">{t(`perks.${label}`)}</span>
              <span className="text-xs text-white/40">{detail}</span>
            </div>
          </RevealOnScroll>
        ))}
      </section>

      {/* Open Positions */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <RevealOnScroll>
          <h2 className="mb-8 text-2xl font-bold">{t("openPositions")}</h2>
        </RevealOnScroll>
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <RevealOnScroll key={job.title}>
              <div className="glass-card p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{job.title}</h3>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: `${job.color}20`, color: job.color }}>
                        {job.department}
                      </span>
                    </div>
                    <p className="text-sm text-white/50">{job.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                      <span className="flex items-center gap-1"><Briefcase size={12} /> {job.type}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.requirements.map((req) => (
                        <span key={req} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/40">{req}</span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`mailto:cybersecpro@semihkilic.com?subject=Application: ${job.title}`}
                    className="btn-primary mt-3 justify-center text-xs md:mt-0 flex-shrink-0"
                  >
                    {t("apply")}
                  </a>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* How to Apply */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <RevealOnScroll>
          <div className="glass-card p-8 border-[var(--color-neon)]/20 text-center">
            <Send size={32} className="mx-auto text-[var(--color-neon)] mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">How to Apply</h2>
            <p className="text-sm text-white/50 max-w-lg mx-auto leading-relaxed">
              Send your CV, a brief cover letter, and links to relevant work (GitHub, portfolio, or published research) to:
            </p>
            <a href="mailto:cybersecpro@semihkilic.com" className="mt-4 inline-block text-lg font-mono text-[var(--color-neon)] hover:underline">
              cybersecpro@semihkilic.com
            </a>
            <p className="mt-3 text-xs text-white/30">We review all applications within 5 business days. No recruiters, please.</p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
