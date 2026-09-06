"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import {
  Shield,
  Lock,
  Server,
  Eye,
  KeyRound,
  RefreshCcw,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  Clock,
  Users,
  Database,
  Globe,
  Mail,
  Bug,
  Award,
  Zap,
  ShieldCheck,
  Activity,
  BookOpen,
  Scale,
  Fingerprint,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── DATA ────────────────────────────────────────────────────────── */

const trustFeaturesBase = [
  { icon: Lock, color: "var(--color-neon)" },
  { icon: Server, color: "var(--color-cyan)" },
  { icon: Shield, color: "var(--color-purple)" },
  { icon: Eye, color: "var(--color-orange)" },
  { icon: KeyRound, color: "var(--color-neon)" },
  { icon: RefreshCcw, color: "var(--color-cyan)" },
  { icon: Fingerprint, color: "var(--color-purple)" },
  { icon: Activity, color: "var(--color-orange)" },
];

// `compliant: true` = legal framework we self-attest alignment with (GDPR, NIST CSF,
// KVKK, CCPA — no external certification body). `compliant: false` = certification /
// third-party audit we do NOT yet hold; shown as "Pending" with an honest "in progress"
// note. Do not flip any of these to true without a certificate/report on file.
const complianceFrameworksBase = [
  { compliant: false, icon: ShieldCheck, color: "var(--color-neon)" },   // SOC 2 Type II
  { compliant: true, icon: Scale, color: "var(--color-cyan)" },          // GDPR
  { compliant: false, icon: Award, color: "var(--color-purple)" },       // ISO 27001:2022
  { compliant: false, icon: Fingerprint, color: "var(--color-orange)" }, // ISO 27701
  { compliant: true, icon: Shield, color: "var(--color-neon)" },         // NIST CSF 2.0
  { compliant: false, icon: Lock, color: "var(--color-cyan)" },          // PCI DSS v4.0
  { compliant: false, icon: ShieldCheck, color: "var(--color-purple)" }, // HIPAA
  { compliant: true, icon: Scale, color: "var(--color-orange)" },        // KVKK
  { compliant: true, icon: Users, color: "var(--color-neon)" },          // CCPA/CPRA
  { compliant: false, icon: Award, color: "var(--color-cyan)" },         // CSA STAR
];



const subProcessorsBase = [
  { name: "Stripe, Inc.", location: "ABD (EU SCC + DPF)", dpa: true, website: "https://stripe.com/privacy" },
  { name: "Vercel, Inc.", location: "Global Edge (EU SCC)", dpa: true, website: "https://vercel.com/legal/privacy-policy" },
  { name: "Cloudflare, Inc.", location: "Global (EU SCC + DPF)", dpa: true, website: "https://www.cloudflare.com/privacypolicy/" },
  { name: "AWS (Amazon)", location: "EU (Frankfurt, eu-central-1)", dpa: true, website: "https://aws.amazon.com/privacy/" },
  { name: "PostgreSQL (Supabase)", location: "EU (Frankfurt)", dpa: true, website: "https://supabase.com/privacy" },
  { name: "SendGrid (Twilio)", location: "ABD (EU SCC)", dpa: true, website: "https://www.twilio.com/legal/privacy" },
  { name: "Sentry", location: "ABD (EU SCC)", dpa: true, website: "https://sentry.io/privacy/" },
];

// Internal, continuous security testing performed with our own platform + manual review.
// These are NOT third-party engagements — do not name an external firm or offer a
// downloadable third-party report unless one genuinely exists on file. Independent
// third-party penetration testing is planned (see sections.pentest.description).
const pentestHistoryBase = [
  { date: "2026-06-15", type: "Platform Security Assessment", auditor: "CyberSec Pro Security Team (internal)", reportAvailable: false },
  { date: "2026-03-10", type: "Source Code Review (SAST)", auditor: "CyberSec Pro Security Team (internal)", reportAvailable: false },
  { date: "2025-12-01", type: "Cloud Infrastructure Review", auditor: "CyberSec Pro Security Team (internal)", reportAvailable: false },
  { date: "2025-09-20", type: "Internal Red-Team Exercise", auditor: "CyberSec Pro Security Team (internal)", reportAvailable: false },
];

const bugBountyRewardsBase = [
  { cvss: "9.0–10.0", reward: "$5,000 – $15,000", color: "#ef4444" },
  { cvss: "7.0–8.9", reward: "$2,000 – $5,000", color: "#f97316" },
  { cvss: "4.0–6.9", reward: "$500 – $2,000", color: "#eab308" },
  { cvss: "0.1–3.9", reward: "$100 – $500", color: "#22c55e" },
];

const incidentResponseSLA = [
  { priority: "P0 — Critical", detection: "≤ 15 min", response: "≤ 30 min", notification: "≤ 1 hour", resolution: "≤ 4 hours", color: "#ef4444" },
  { priority: "P1 — High", detection: "≤ 30 min", response: "≤ 1 hour", notification: "≤ 4 hours", resolution: "≤ 24 hours", color: "#f97316" },
  { priority: "P2 — Medium", detection: "≤ 1 hour", response: "≤ 4 hours", notification: "≤ 24 hours", resolution: "≤ 72 hours", color: "#eab308" },
  { priority: "P3 — Low", detection: "≤ 4 hours", response: "≤ 24 hours", notification: "≤ 72 hours", resolution: "≤ 30 days", color: "#22c55e" },
];

const securityCertBadges = [
  { name: "SOC 2", img: "🛡️" },
  { name: "ISO 27001", img: "🏅" },
  { name: "GDPR", img: "🇪🇺" },
  { name: "PCI DSS", img: "💳" },
  { name: "CSA STAR", img: "⭐" },
  { name: "HIPAA", img: "🏥" },
  { name: "NIST", img: "🔐" },
  { name: "KVKK", img: "🇹🇷" },
];

/* ─── COMPONENT ───────────────────────────────────────────────────── */

export default function SecurityTrustCenter() {
  const t = useTranslations("security.trustCenter");
  
  const trustFeatures = trustFeaturesBase.map((f, i) => ({
    ...f,
    title: t(`arrays.trustFeatures.${i}.title`),
    description: t(`arrays.trustFeatures.${i}.description`)
  }));

  const complianceFrameworks = complianceFrameworksBase.map((f, i) => ({
    ...f,
    name: t(`arrays.complianceFrameworks.${i}.name`),
    note: t(`arrays.complianceFrameworks.${i}.note`)
  }));

  const subProcessors = subProcessorsBase.map((f, i) => ({
    ...f,
    purpose: t(`arrays.subProcessorPurposes.${i}`)
  }));

  const pentestHistory = pentestHistoryBase.map((f, i) => ({
    ...f,
    scope: t(`arrays.pentestHistory.${i}.scope`),
    findings: t(`arrays.pentestHistory.${i}.findings`),
    status: t(`arrays.pentestHistory.${i}.status`)
  }));

  const bugBountyRewards = bugBountyRewardsBase.map((f, i) => ({
    ...f,
    severity: t(`arrays.bugBountyRewards.${i}.severity`),
    examples: t(`arrays.bugBountyRewards.${i}.examples`)
  }));

  return (
    <>
      {/* Hero */}
      <section className="relative pb-12 pt-32 text-center">
        <RevealOnScroll>
          <div className="mx-auto max-w-4xl">
            <span className="badge mb-6">{t("badge")}</span>
            <h1 className="text-4xl font-extrabold md:text-6xl bg-gradient-to-r from-[var(--color-neon)] via-[var(--color-cyan)] to-[var(--color-purple)] bg-clip-text text-transparent">
              {t("title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/55 leading-relaxed">
              {t("subtitle")}
            </p>

            {/* Cert Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {securityCertBadges.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm font-medium"
                >
                  <span className="text-lg">{b.img}</span>
                  <span className="text-white/70">{b.name}</span>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-xs text-white/40">
              {t("certBadgesNote")}
            </p>

            {/* Live Status Banner */}
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm text-green-400 font-medium">{t("status.operational")}</span>
              <a
                href="https://status.cyber-sec-pro.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400/60 hover:text-green-400 ml-2 underline"
              >
                {t("status.link")}
              </a>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Data Residency & Privacy ── */}
      <section id="data-residency" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Server size={24} className="text-[var(--color-neon)]" />
              <h2 className="text-2xl font-bold">{t("sections.dataResidency.title")}</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-neon)]/10 text-[var(--color-neon)] border border-[var(--color-neon)]/20 font-semibold">
                {t("sections.dataResidency.subtitle")}
              </span>
            </div>

            {/* Location & Encryption Grid */}
            <div className="grid gap-6 sm:grid-cols-2 mb-8">
              <div className="p-5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={16} className="text-[var(--color-cyan)]" />
                  <h3 className="text-sm font-bold text-white">{t("sections.dataResidency.storageLocation")}</h3>
                </div>
                <p className="text-xl font-mono font-bold text-[var(--color-cyan)] mb-1">{t("sections.dataResidency.storageLocationValue")}</p>
                <p className="text-xs text-white/50 leading-relaxed">{t("sections.dataResidency.storageDescription")}</p>
              </div>
              <div className="p-5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={16} className="text-[var(--color-purple)]" />
                  <h3 className="text-sm font-bold text-white">{t("sections.dataResidency.encryptionAtRest")}</h3>
                </div>
                <p className="text-xl font-mono font-bold text-[var(--color-purple)] mb-1">{t("sections.dataResidency.encryptionAtRestValue")}</p>
                <p className="text-xs text-white/50 leading-relaxed">{t("sections.dataResidency.encryptionDescription")}</p>
              </div>
              <div className="p-5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-[var(--color-neon)]" />
                  <h3 className="text-sm font-bold text-white">{t("sections.dataResidency.encryptionInTransit")}</h3>
                </div>
                <p className="text-xl font-mono font-bold text-[var(--color-neon)] mb-1">{t("sections.dataResidency.encryptionInTransitValue")}</p>
                <p className="text-xs text-white/50 leading-relaxed">{t("sections.dataResidency.encryptionInTransitDescription")}</p>
              </div>
              <div className="p-5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-[var(--color-orange)]" />
                  <h3 className="text-sm font-bold text-white">{t("sections.dataResidency.noLogging")}</h3>
                </div>
                <p className="text-xl font-mono font-bold text-[var(--color-orange)] mb-1">{t("sections.dataResidency.noLoggingValue")}</p>
                <p className="text-xs text-white/50 leading-relaxed">{t("sections.dataResidency.noLoggingDescription")}</p>
              </div>
            </div>

            {/* No-Logging Commitment */}
            <div className="p-5 rounded-lg bg-green-500/5 border border-green-500/10">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                {t("sections.dataResidency.noLoggingPolicy")}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  t("sections.dataResidency.noLoggingPolicy1"),
                  t("sections.dataResidency.noLoggingPolicy2"),
                  t("sections.dataResidency.noLoggingPolicy3"),
                  t("sections.dataResidency.noLoggingPolicy4"),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Data Processing Principles */}
            <div className="mt-6 p-5 rounded-lg bg-black/30 border border-white/5">
              <h3 className="text-sm font-bold text-white mb-3">{t("sections.dataResidency.dataProcessing")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  t("sections.dataResidency.dataProcessing1"),
                  t("sections.dataResidency.dataProcessing2"),
                  t("sections.dataResidency.dataProcessing3"),
                  t("sections.dataResidency.dataProcessing4"),
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-cyan)]/20 text-[var(--color-cyan)] text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Trust Features ── */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-16 md:grid-cols-2 lg:grid-cols-4">
        {trustFeatures.map((f) => {
          const Icon = f.icon;
          return (
            <RevealOnScroll key={f.title}>
              <div className="glass-card flex flex-col gap-4 p-6 h-full hover:border-white/20 transition-colors">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${f.color}15`, color: f.color }}
                >
                  <Icon size={24} />
                </div>
                <h3 className="text-base font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.description}</p>
              </div>
            </RevealOnScroll>
          );
        })}
      </section>

      {/* ── Security.txt (RFC 9116) ── */}
      <section id="security-txt" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileCheck size={24} className="text-[var(--color-neon)]" />
              <h2 className="text-2xl font-bold">{t("sections.securityTxt.title")} <span className="text-sm font-normal text-white/40">(RFC 9116)</span></h2>
            </div>
            <p className="text-white/50 mb-4 text-sm">
              {t("sections.securityTxt.description")}
            </p>
            <div className="bg-black/40 rounded-lg p-5 font-mono text-sm space-y-1 border border-white/5">
              <p className="text-white/30"># CyberSec Pro Security Policy</p>
              <p className="text-white/30"># RFC 9116 Compliant</p>
              <p className="text-[var(--color-neon)]">Contact: <span className="text-white/70">mailto:security@cyber-sec-pro.com</span></p>
              <p className="text-[var(--color-neon)]">Contact: <span className="text-white/70">https://cyber-sec-pro.com/trust-center#responsible-disclosure</span></p>
              <p className="text-[var(--color-neon)]">Encryption: <span className="text-white/70">https://cyber-sec-pro.com/.well-known/pgp-key.txt</span></p>
              <p className="text-[var(--color-neon)]">Acknowledgments: <span className="text-white/70">https://cyber-sec-pro.com/trust-center#acknowledgments</span></p>
              <p className="text-[var(--color-neon)]">Policy: <span className="text-white/70">https://cyber-sec-pro.com/trust-center#responsible-disclosure</span></p>
              <p className="text-[var(--color-neon)]">Hiring: <span className="text-white/70">https://cyber-sec-pro.com/careers</span></p>
              <p className="text-[var(--color-neon)]">Preferred-Languages: <span className="text-white/70">en, tr</span></p>
              <p className="text-[var(--color-neon)]">Canonical: <span className="text-white/70">https://cyber-sec-pro.com/.well-known/security.txt</span></p>
              <p className="text-[var(--color-neon)]">Expires: <span className="text-white/70">2027-07-31T23:59:59.000Z</span></p>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <a
                href="/.well-known/security.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-cyan)] hover:underline"
              >
                <ExternalLink size={14} />
                {t("sections.securityTxt.directAccess")}
              </a>
              <a
                href="/.well-known/pgp-key.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-purple)] hover:underline"
              >
                <KeyRound size={14} />
                {t("sections.securityTxt.pgpKey")}
              </a>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Responsible Disclosure & Bug Bounty ── */}
      <section id="responsible-disclosure" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Bug size={24} className="text-yellow-400" />
              <h2 className="text-2xl font-bold">{t("sections.disclosure.title")}</h2>
            </div>

            <div className="space-y-6 text-white/60 text-sm leading-relaxed">
              {/* Scope */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs font-bold">1</span>
                  {t("sections.disclosure.scope")}
                </h3>
                <div className="ml-8 space-y-2">
                  <p className="text-white/70 font-medium">{t("sections.disclosure.scopeIn")}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>cyber-sec-pro.com (sub-domains)</li>
                    <li>app.cyber-sec-pro.com (SaaS platform)</li>
                    <li>api.cyber-sec-pro.com (REST & GraphQL API)</li>
                    <li>Mobile Apps (iOS / Android)</li>
                    <li>Open Source Components (GitHub)</li>
                  </ul>
                  <p className="text-white/70 font-medium mt-3">{t("sections.disclosure.scopeOut")}</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-white/40">
                    <li>Social engineering & phishing</li>
                    <li>DDoS / DoS</li>
                    <li>Physical security</li>
                    <li>Third-party services</li>
                  </ul>
                </div>
              </div>

              {/* How to Report */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-cyan)]/20 text-[var(--color-cyan)] text-xs font-bold">2</span>
                  {t("sections.disclosure.channel")}
                </h3>
                <div className="ml-8">
                  <p>
                    {t("sections.disclosure.channelDesc")}{" "}
                    <a href="mailto:security@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline font-medium">
                      security@cyber-sec-pro.com
                    </a>
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5">
                    <p className="text-white/70 font-medium mb-2">{t("sections.disclosure.reportTemplate")}</p>
                    <ul className="space-y-1 ml-4 text-xs font-mono text-white/50">
                      <li>Subject: [SECURITY] Short description</li>
                      <li>Affected asset: URL / endpoint</li>
                      <li>Vulnerability type: (XSS, SQLi, IDOR, etc.)</li>
                      <li>Steps to reproduce: (1, 2, 3...)</li>
                      <li>Impact: (Data leak, Privilege escalation, etc.)</li>
                      <li>CVSS score (optional)</li>
                      <li>PoC / Screenshots</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SLA */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-purple)]/20 text-[var(--color-purple)] text-xs font-bold">3</span>
                  {t("sections.disclosure.sla")}
                </h3>
                <div className="ml-8">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-green-400" />
                      <span>{t("sections.disclosure.slaFirst")} <strong className="text-white">≤ 24 hours</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-blue-400" />
                      <span>{t("sections.disclosure.slaUpdate")} <strong className="text-white">≤ 72 hours</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-yellow-400" />
                      <span>{t("sections.disclosure.slaFix")} <strong className="text-white">≤ 90 days</strong></span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Safe Harbor */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-orange)]/20 text-[var(--color-orange)] text-xs font-bold">4</span>
                  {t("sections.disclosure.safeHarbor")}
                </h3>
                <div className="ml-8 p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{t("sections.disclosure.safeHarbor1")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{t("sections.disclosure.safeHarbor2")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{t("sections.disclosure.safeHarbor3")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                      <span>{t("sections.disclosure.safeHarbor4")}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bug Bounty Table */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">$</span>
                  {t("sections.disclosure.bountyTable")}
                </h3>
                <div className="overflow-x-auto ml-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.disclosure.tableLevel")}</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">CVSS</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.disclosure.tableReward")}</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold hidden md:table-cell">{t("sections.disclosure.tableExamples")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bugBountyRewards.map((r) => (
                        <tr key={r.severity} className="border-b border-white/5">
                          <td className="py-3 px-2">
                            <span
                              className="px-2 py-1 rounded text-xs font-bold"
                              style={{ backgroundColor: `${r.color}20`, color: r.color }}
                            >
                              {r.severity}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-white/60 font-mono text-xs">{r.cvss}</td>
                          <td className="py-3 px-2 text-white font-semibold">{r.reward}</td>
                          <td className="py-3 px-2 text-white/40 text-xs hidden md:table-cell">{r.examples}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Compliance Frameworks ── */}
      <section id="compliance" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle size={24} className="text-green-400" />
              <h2 className="text-2xl font-bold">{t("sections.compliance.title")}</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                {complianceFrameworks.filter(f => f.compliant).length}/{complianceFrameworks.length} {t("sections.compliance.compliant")}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {complianceFrameworks.map((cf) => {
                const CfIcon = cf.icon;
                return (
                  <div key={cf.name} className="flex items-center gap-3 p-4 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-colors">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                      style={{ background: `${cf.color}15`, color: cf.color }}
                    >
                      <CfIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{cf.name}</span>
                        {cf.compliant ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 shrink-0">
                            ✓ {t("sections.compliance.compliant")}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 shrink-0">
                            {t("sections.compliance.pending")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/40">{cf.note}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Incident Response SLA ── */}
      <section id="incident-response" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={24} className="text-[var(--color-orange)]" />
              <h2 className="text-2xl font-bold">{t("sections.incident.title")}</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              {t("sections.incident.description")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.incident.priority")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.incident.detection")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.incident.response")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.incident.notification")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.incident.resolution")}</th>
                  </tr>
                </thead>
                <tbody>
                  {incidentResponseSLA.map((sla) => (
                    <tr key={sla.priority} className="border-b border-white/5">
                      <td className="py-3 px-2">
                        <span
                          className="px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
                          style={{ backgroundColor: `${sla.color}20`, color: sla.color }}
                        >
                          {sla.priority}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-white/60 font-mono text-xs">{sla.detection}</td>
                      <td className="py-3 px-2 text-white/60 font-mono text-xs">{sla.response}</td>
                      <td className="py-3 px-2 text-white/60 font-mono text-xs">{sla.notification}</td>
                      <td className="py-3 px-2 text-white/60 font-mono text-xs">{sla.resolution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Sub-processors ── */}
      <section id="sub-processors" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Database size={24} className="text-[var(--color-purple)]" />
              <h2 className="text-2xl font-bold">{t("sections.subprocessors.title")}</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              {t("sections.subprocessors.description")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.subprocessors.provider")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.subprocessors.purpose")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">{t("sections.subprocessors.location")}</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">DPA</th>
                  </tr>
                </thead>
                <tbody>
                  {subProcessors.map((sp, index) => (
                    <tr key={sp.name} className="border-b border-white/5">
                      <td className="py-3 px-2">
                        <a href={sp.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-cyan)] hover:underline">
                          {sp.name}
                        </a>
                      </td>
                      <td className="py-3 px-2 text-white/60">{sp.purpose}</td>
                      <td className="py-3 px-2 text-white/60">{sp.location}</td>
                      <td className="py-3 px-2">
                        {sp.dpa ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">✓ {t("sections.subprocessors.signed")}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">{t("sections.subprocessors.pending")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/30 mt-4">
              {t("sections.subprocessors.footer")}
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── DPA ── */}
      <section id="dpa" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Scale size={24} className="text-[var(--color-orange)]" />
              <h2 className="text-2xl font-bold">{t("sections.dpa.title")}</h2>
            </div>
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <p>
                {t("sections.dpa.description")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                  <h3 className="text-white font-semibold mb-3">{t("sections.dpa.scopeTitle")}</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-white/50">
                    <li>Purpose and methods of processing</li>
                    <li>Types of personal data and data subjects</li>
                    <li>List of sub-processors and approval process</li>
                    <li>Technical and organizational measures (TOMs)</li>
                    <li>Data breach notification procedures (≤72 hrs)</li>
                    <li>Data transfer mechanisms (EU SCC, DPF)</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                  <h3 className="text-white font-semibold mb-3">{t("sections.dpa.dpiaTitle")}</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-white/50">
                    <li>GDPR Article 35 compliant DPIA completed</li>
                    <li>High-risk processing operations documented</li>
                    <li>Risk mitigation measures implemented</li>
                    <li>Annual review by Data Protection Officer (DPO)</li>
                    <li>Available to customers upon request</li>
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <a
                  href="mailto:legal@cyber-sec-pro.com?subject=DPA%20Request"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-neon)] text-black rounded-lg text-sm font-semibold hover:opacity-90 transition"
                >
                  <Mail size={14} />
                  {t("sections.dpa.requestBtn")}
                </a>
                <a
                  href="mailto:dpo@cyber-sec-pro.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/15 transition"
                >
                  <Users size={14} />
                  {t("sections.dpa.dpoBtn")}
                </a>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Pentest History ── */}
      <section id="pentest-history" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock size={24} className="text-[var(--color-cyan)]" />
              <h2 className="text-2xl font-bold">{t("sections.pentest.title")}</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              {t("sections.pentest.description")}
            </p>
            <div className="space-y-4">
              {pentestHistory.map((pt) => (
                <div key={`${pt.date}-${pt.type}`} className="p-5 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-semibold text-white">{pt.type}</span>
                      <p className="text-xs text-white/40 mt-0.5">{pt.auditor}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{pt.date}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                        {pt.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-white/50 space-y-1">
                    <p><span className="text-white/70">{t("sections.pentest.scope")}</span> {pt.scope}</p>
                    <p><span className="text-white/70">{t("sections.pentest.findings")}</span> {pt.findings}</p>
                  </div>
                  {pt.reportAvailable && (
                    <div className="mt-3">
                      <a
                        href="mailto:security@cyber-sec-pro.com?subject=Pentest%20Report%20Request%20-%20NDA"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-cyan)] hover:underline"
                      >
                        <BookOpen size={12} />
                        {t("sections.pentest.requestReport")}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Acknowledgments (Hall of Fame) ── */}
      <section id="acknowledgments" className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Award size={24} className="text-yellow-400" />
              <h2 className="text-2xl font-bold">{t("sections.hallOfFame.title")}</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              {t("sections.hallOfFame.description")}
            </p>
            <div className="p-6 rounded-lg bg-black/30 border border-white/5 text-center">
              <Award size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm">
                {t("sections.hallOfFame.empty")}
              </p>
              <a
                href="mailto:security@cyber-sec-pro.com"
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-semibold hover:bg-yellow-500/15 transition border border-yellow-500/20"
              >
                <Bug size={16} />
                {t("sections.hallOfFame.reportBtn")}
              </a>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ── Status & Contact ── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Status */}
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <Globe size={24} className="text-[var(--color-neon)]" />
                  <h2 className="text-xl font-bold">{t("sections.contact.statusTitle")}</h2>
                </div>
                <p className="text-white/50 mb-4 text-sm">
                  {t("sections.contact.statusDesc")}
                </p>
                <a
                  href="https://status.cyber-sec-pro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-neon)] text-black rounded-lg font-semibold hover:opacity-90 transition"
                >
                  <Activity size={16} />
                  {t("sections.contact.statusBtn")}
                </a>
              </div>

              {/* Contact */}
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <Mail size={24} className="text-[var(--color-cyan)]" />
                  <h2 className="text-xl font-bold">{t("sections.contact.contactTitle")}</h2>
                </div>
                <div className="space-y-2 text-sm text-white/50">
                  <p>{t("sections.contact.security")}: <a href="mailto:security@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">security@cyber-sec-pro.com</a></p>
                  <p>{t("sections.contact.legal")}: <a href="mailto:legal@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">legal@cyber-sec-pro.com</a></p>
                  <p>DPO: <a href="mailto:dpo@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">dpo@cyber-sec-pro.com</a></p>
                  <p>{t("sections.contact.privacy")}: <a href="mailto:privacy@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">privacy@cyber-sec-pro.com</a></p>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                  <a
                    href="/.well-known/security.txt"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/15 transition"
                  >
                    <FileCheck size={14} />
                    security.txt
                  </a>
                  <a
                    href="/.well-known/pgp-key.txt"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/15 transition"
                  >
                    <KeyRound size={14} />
                    PGP Key
                  </a>
                </div>
              </div>
            </div>

            {/* Policy Version */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-white/30">
                {t("sections.contact.footer")}
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
