"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import dynamic from "next/dynamic";
const CyberScene = dynamic(() => import("@/components/three/CyberScene"), { ssr: false });
import { Shield, Database, Lock, Eye, Cookie, Users, Clock, Mail } from "lucide-react";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <>
      <CyberScene />
      <section className="mx-auto max-w-4xl px-6 pb-28 pt-32">
        <RevealOnScroll>
          <h1 className="text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-white/40">{t("lastUpdated")}</p>
          <p className="mt-4 text-sm text-white/50 leading-relaxed">
            CyberSec Pro (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal data in compliance with GDPR, CCPA, and other applicable data protection regulations.
          </p>
        </RevealOnScroll>

        <div className="mt-12 flex flex-col gap-10">
          {/* Information We Collect */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database size={20} className="text-[var(--color-neon)]" />
                <h2 className="text-xl font-bold text-white">Information We Collect</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/80 mb-2">Account Information</h3>
                  <p className="text-sm text-white/50">Full name, email address, company name, job title, and billing address provided during registration.</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/80 mb-2">Usage Data</h3>
                  <ul className="text-sm text-white/50 space-y-1 list-disc list-inside">
                    <li>Scan configurations and target domains</li>
                    <li>Tool selections and parameters</li>
                    <li>Report generation history</li>
                    <li>Login timestamps and session duration</li>
                    <li>Feature usage analytics</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/80 mb-2">Payment Data</h3>
                  <p className="text-sm text-white/50">Payment processing is handled entirely by <strong className="text-white/70">Stripe</strong>. We never store credit card numbers on our servers. We only retain transaction IDs and subscription status.</p>
                </div>
              </div>
            </div>
          </RevealOnScroll>

          {/* How We Use Your Information */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye size={20} className="text-[var(--color-cyan)]" />
                <h2 className="text-xl font-bold text-white">How We Use Your Information</h2>
              </div>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Provide, maintain, and improve the CyberSec Pro platform</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Process subscription payments and manage billing</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Send critical security alerts and scan completion notifications</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Generate anonymized usage statistics for platform improvements</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Ensure platform security and prevent unauthorized access</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Comply with legal obligations</li>
              </ul>
              <p className="mt-3 text-xs text-white/40 italic">We never sell, rent, or share your personal data with third parties for marketing purposes.</p>
            </div>
          </RevealOnScroll>

          {/* Data Security */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock size={20} className="text-[var(--color-purple)]" />
                <h2 className="text-xl font-bold text-white">Data Security</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: "End-to-End Encryption", desc: "AES-256 at rest, TLS 1.3 in transit" },
                  { label: "SOC 2-Aligned Controls", desc: "Designed against SOC 2 Trust Services Criteria (no certification claimed)" },
                  { label: "Role-Based Access Control", desc: "Granular RBAC with least-privilege principle" },
                  { label: "Multi-Factor Authentication", desc: "TOTP-based MFA for all accounts" },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-white/80">{s.label}</h3>
                    <p className="text-xs text-white/40 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* Data Retention */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock size={20} className="text-[var(--color-orange)]" />
                <h2 className="text-xl font-bold text-white">Data Retention</h2>
              </div>
              <div className="space-y-2 text-sm text-white/50">
                <p><strong className="text-white/70">Scan Results:</strong> Retained for 12 months from scan date. Older results are automatically purged.</p>
                <p><strong className="text-white/70">Account Data:</strong> Retained for 90 days after account deletion. You can request immediate deletion at any time.</p>
                <p><strong className="text-white/70">Audit Logs:</strong> Security and access logs are retained for 24 months for compliance and forensic purposes.</p>
                <p><strong className="text-white/70">Payment Records:</strong> Transaction records are retained as required by tax and financial regulations (typically 7 years).</p>
              </div>
            </div>
          </RevealOnScroll>

          {/* Your GDPR Rights */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-[var(--color-neon)]" />
                <h2 className="text-xl font-bold text-white">Your Rights (GDPR)</h2>
              </div>
              <p className="text-sm text-white/50 mb-4">Under the General Data Protection Regulation, you have the following rights:</p>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { right: "Right to Access", desc: "Request a copy of all personal data we hold about you" },
                  { right: "Right to Rectification", desc: "Correct inaccurate or incomplete personal data" },
                  { right: "Right to Erasure", desc: "Request deletion of your personal data (\"right to be forgotten\")" },
                  { right: "Right to Data Portability", desc: "Export your data in a machine-readable format (JSON)" },
                  { right: "Right to Restrict Processing", desc: "Limit how we use your data while a dispute is resolved" },
                  { right: "Right to Object", desc: "Object to processing based on legitimate interests" },
                ].map((r) => (
                  <div key={r.right} className="bg-white/5 rounded-lg p-3">
                    <h3 className="text-sm font-bold text-[var(--color-neon)]">{r.right}</h3>
                    <p className="text-xs text-white/40 mt-1">{r.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/40">We respond to all GDPR requests within 30 days. Contact our Data Protection Officer at the address below.</p>
            </div>
          </RevealOnScroll>

          {/* Third-Party Services */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users size={20} className="text-[var(--color-cyan)]" />
                <h2 className="text-xl font-bold text-white">Third-Party Services</h2>
              </div>
              <div className="space-y-2 text-sm text-white/50">
                <p><strong className="text-white/70">Stripe:</strong> Payment processing — PCI DSS Level 1 certified. We never access or store your full card number.</p>
                <p><strong className="text-white/70">GitHub OAuth:</strong> Optional authentication provider. We only access your email and profile name.</p>
                <p><strong className="text-white/70">Redis (self-hosted):</strong> Session management and caching — hosted on our own infrastructure, no third-party access.</p>
                <p><strong className="text-white/70">PostgreSQL (self-hosted):</strong> Primary database — encrypted at rest, hosted in EU data centres.</p>
              </div>
            </div>
          </RevealOnScroll>

          {/* Cookies */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cookie size={20} className="text-[var(--color-orange)]" />
                <h2 className="text-xl font-bold text-white">Cookies</h2>
              </div>
              <p className="text-sm text-white/50">We use <strong className="text-white/70">essential cookies only</strong> for session management and authentication. We do not use tracking cookies, advertising cookies, or any third-party ad cookies. No consent banner is required because we only use strictly necessary cookies.</p>
            </div>
          </RevealOnScroll>

          {/* Contact */}
          <RevealOnScroll>
            <div className="glass-card p-6 border-[var(--color-neon)]/20">
              <div className="flex items-center gap-3 mb-4">
                <Mail size={20} className="text-[var(--color-neon)]" />
                <h2 className="text-xl font-bold text-white">Contact & DPO</h2>
              </div>
              <p className="text-sm text-white/50">For privacy-related inquiries, data access requests, or to exercise your GDPR rights:</p>
              <p className="mt-2 text-sm font-mono text-[var(--color-neon)]">cybersecpro@semihkilic.com</p>
              <p className="mt-2 text-xs text-white/40">We respond to all privacy requests within 72 hours. GDPR formal requests are processed within 30 days as required by law.</p>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
