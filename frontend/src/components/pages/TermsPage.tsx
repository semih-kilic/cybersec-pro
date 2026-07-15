"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import DataShield from "@/components/three/DataShield";
import { AlertTriangle } from "lucide-react";

export default function TermsPage() {
  const t = useTranslations("terms");

  return (
    <>
      <DataShield />
      <section className="mx-auto max-w-4xl px-6 pb-28 pt-32">
        <RevealOnScroll>
          <h1 className="text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-white/40">{t("lastUpdated")}</p>
          <p className="mt-4 text-sm text-white/50 leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the CyberSec Pro platform. By creating an account, you agree to these Terms in full.
          </p>
        </RevealOnScroll>

        <div className="mt-12 flex flex-col gap-10">
          {/* Authorization Warning */}
          <RevealOnScroll>
            <div className="glass-card border-red-500/30 bg-red-500/5 p-6 flex items-start gap-4">
              <AlertTriangle size={24} className="text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-bold text-red-300">Authorization Warning</h2>
                <p className="mt-2 text-sm text-red-200/60 leading-relaxed">
                  CyberSec Pro tools are powerful security testing instruments. You <strong className="text-red-300">must</strong> have explicit written authorization from the system owner before scanning any target. Unauthorized scanning is a violation of these Terms and may constitute a criminal offence under the Computer Fraud and Abuse Act (CFAA), the UK Computer Misuse Act, and similar legislation worldwide.
                </p>
              </div>
            </div>
          </RevealOnScroll>

          {/* Account Registration */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">1. Account Registration</h2>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> You must be at least 18 years old to create an account.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> One account per individual. Sharing accounts is prohibited.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> You must provide accurate information and keep it up to date.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> You are responsible for maintaining the security of your credentials and API keys.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> You are liable for all activities performed under your account.</li>
              </ul>
            </div>
          </RevealOnScroll>

          {/* Subscription & Pricing */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">2. Subscription & Pricing</h2>
              <div className="grid gap-3 md:grid-cols-3 mb-4">
                {[
                  { plan: "Starter", price: "€99", features: "50 tools, 10 scans/month" },
                  { plan: "Professional", price: "€299", features: "200 tools, unlimited scans, API access" },
                  { plan: "Enterprise", price: "€799", features: "811 tools, unlimited everything, priority support" },
                ].map((p) => (
                  <div key={p.plan} className="bg-white/5 rounded-lg p-4 text-center">
                    <h3 className="text-sm font-bold text-[var(--color-neon)]">{p.plan}</h3>
                    <p className="text-2xl font-extrabold text-white mt-1">{p.price}<span className="text-xs text-white/40">/mo</span></p>
                    <p className="text-xs text-white/40 mt-2">{p.features}</p>
                  </div>
                ))}
              </div>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> All prices are in EUR and exclude applicable taxes (VAT).</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Payments are processed securely by <strong className="text-white/70">Stripe</strong>. We accept Visa, Mastercard, SEPA Direct Debit, and bank transfers.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Subscriptions renew automatically unless cancelled before the billing cycle.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Refunds are available within 14 days of purchase if no scans have been executed.</li>
              </ul>
            </div>
          </RevealOnScroll>

          {/* Authorized Use */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">3. Authorized Use</h2>
              <p className="text-sm text-white/50 mb-3">You may use CyberSec Pro exclusively for:</p>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Security assessments of systems you own or have written authorization to test.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Generating compliance and vulnerability reports for your organisation.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Educational and research purposes with proper authorization.</li>
              </ul>
            </div>
          </RevealOnScroll>

          {/* Prohibited Activities */}
          <RevealOnScroll>
            <div className="glass-card p-6 border-red-500/10">
              <h2 className="text-xl font-bold text-white mb-3">4. Prohibited Activities</h2>
              <p className="text-sm text-white/50 mb-3">The following activities are strictly prohibited and will result in immediate account termination:</p>
              <ul className="text-sm text-red-300/60 space-y-2">
                <li className="flex items-start gap-2"><span className="text-red-400">✕</span> Scanning systems without explicit written authorization from the owner.</li>
                <li className="flex items-start gap-2"><span className="text-red-400">✕</span> Using the platform for denial-of-service (DoS/DDoS) attacks or any form of malicious activity.</li>
                <li className="flex items-start gap-2"><span className="text-red-400">✕</span> Attempting to bypass platform security controls, rate limits, or plan restrictions.</li>
                <li className="flex items-start gap-2"><span className="text-red-400">✕</span> Reselling, sublicensing, or redistributing access to the platform or its tools.</li>
                <li className="flex items-start gap-2"><span className="text-red-400">✕</span> Storing or transmitting malware through the platform infrastructure.</li>
              </ul>
            </div>
          </RevealOnScroll>

          {/* Service Availability */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">5. Service Availability</h2>
              <p className="text-sm text-white/50 leading-relaxed">We target 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance windows will be communicated 48 hours in advance. Enterprise plans include SLA guarantees with financial credits for downtime exceeding agreed thresholds.</p>
            </div>
          </RevealOnScroll>

          {/* Intellectual Property */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">6. Intellectual Property</h2>
              <p className="text-sm text-white/50 leading-relaxed">All platform code, design, documentation, and branding are owned by CyberSec Pro. Scan results and reports generated by you belong to you. Open-source tool integrations are subject to their respective licences (GPL, MIT, Apache, etc.).</p>
            </div>
          </RevealOnScroll>

          {/* Limitation of Liability */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">7. Limitation of Liability</h2>
              <p className="text-sm text-white/50 leading-relaxed">CyberSec Pro is provided &quot;as is&quot; without warranties of any kind. Our total liability for any claim is limited to the <strong className="text-white/70">total amount you paid in the 12 months preceding the claim</strong>. We are not liable for indirect, incidental, or consequential damages, including data loss, service interruptions, or consequences of unauthorized scanning.</p>
            </div>
          </RevealOnScroll>

          {/* Termination */}
          <RevealOnScroll>
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-3">8. Termination</h2>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> You may cancel your subscription at any time from your dashboard.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> We may suspend or terminate your account for violation of these Terms.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Upon termination, you have <strong className="text-white/70">30 days to export your data</strong> (scan results, reports) before it is permanently deleted.</li>
                <li className="flex items-start gap-2"><span className="text-[var(--color-neon)]">•</span> Immediate termination applies for prohibited activities — no grace period.</li>
              </ul>
            </div>
          </RevealOnScroll>

          {/* Contact */}
          <RevealOnScroll>
            <div className="glass-card p-6 border-[var(--color-neon)]/20">
              <h2 className="text-xl font-bold text-white mb-3">Contact</h2>
              <p className="text-sm text-white/50">Questions about these Terms? Contact us at:</p>
              <p className="mt-2 text-sm font-mono text-[var(--color-neon)]">support@cyber-sec-pro.com</p>
              <p className="mt-2 text-xs text-white/40">These Terms were last updated on January 15, 2026. We will notify active users of material changes via email 30 days before they take effect.</p>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
