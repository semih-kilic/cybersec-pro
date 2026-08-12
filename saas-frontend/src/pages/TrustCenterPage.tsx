/**
 * Trust Center Page
 * Security communication, responsible disclosure, compliance status, sub-processors, DPA.
 */
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export function TrustCenterPage() {
  const { t } = useTranslation();

  const subProcessors = [
    { name: 'Hetzner', purpose: t('trust.subprocessors.hosting', 'Infrastructure hosting'), location: 'Finland (EU)' },
    { name: 'Stripe', purpose: t('trust.subprocessors.payments', 'Payment processing'), location: 'Ireland (EU)' },
    { name: 'Cloudflare', purpose: t('trust.subprocessors.cdn', 'CDN & DDoS protection'), location: 'Global (EU data residency)' },
  ];

  return (
    <>
      <Helmet>
        <title>{t('trust.pageTitle', 'Trust Center — CyberSec Pro')}</title>
        <meta name="description" content={t('trust.metaDesc', 'Security policies, compliance certifications, responsible disclosure, sub-processors, and data protection information for CyberSec Pro.')} />
      </Helmet>

      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('trust.title', 'Trust Center')}
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              {t('trust.subtitle', 'Security is the foundation of everything we build. This page documents our security practices, compliance posture, and how to report vulnerabilities.')}
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {[
              { label: t('trust.quick.securityTxt', 'security.txt'), href: '/.well-known/security.txt', desc: t('trust.quick.securityTxtDesc', 'RFC 9116 security policy') },
              { label: t('trust.quick.pgpKey', 'PGP Key'), href: '/.well-known/pgp-key.txt', desc: t('trust.quick.pgpKeyDesc', 'Encrypt vulnerability reports') },
              { label: t('trust.quick.dpa', 'DPA'), href: '#dpa', desc: t('trust.quick.dpaDesc', 'Data Processing Agreement') },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block p-4 rounded-xl border border-zinc-700/50 bg-zinc-900/50 hover:border-cyan-500/30 hover:bg-zinc-900 transition group"
              >
                <div className="text-cyan-400 font-semibold group-hover:text-cyan-300 transition">{link.label}</div>
                <div className="text-sm text-gray-400 mt-1">{link.desc}</div>
              </a>
            ))}
          </div>

          {/* Data Residency & Privacy */}
          <section id="data-residency" className="mb-16 p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.dataResidency.title', 'Data Residency & Privacy')}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {t('trust.dataResidency.subtitle', 'Your data stays in Canada. Always.')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">{t('trust.dataResidency.storageLocation', 'Primary Data Storage')}</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mb-1">{t('trust.dataResidency.storageLocationValue', 'Canada 🇨🇦')}</div>
                <div className="text-xs text-gray-400">{t('trust.dataResidency.storageDescription', 'All customer data stored exclusively in Canadian data centers.')}</div>
              </div>
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">{t('trust.dataResidency.encryptionAtRest', 'Encryption at Rest')}</div>
                <div className="text-lg font-mono font-bold text-purple-400 mb-1">{t('trust.dataResidency.encryptionAtRestValue', 'AES-256-GCM')}</div>
                <div className="text-xs text-gray-400">{t('trust.dataResidency.encryptionDescription', 'Per-tenant keys with 90-day rotation, stored in HSM.')}</div>
              </div>
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">{t('trust.dataResidency.encryptionInTransit', 'Encryption in Transit')}</div>
                <div className="text-lg font-mono font-bold text-green-400 mb-1">{t('trust.dataResidency.encryptionInTransitValue', 'TLS 1.3')}</div>
                <div className="text-xs text-gray-400">{t('trust.dataResidency.encryptionInTransitDescription', 'Perfect forward secrecy on all API and web traffic.')}</div>
              </div>
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">{t('trust.dataResidency.noLogging', 'No Raw Traffic Logging')}</div>
                <div className="text-lg font-mono font-bold text-orange-400 mb-1">{t('trust.dataResidency.noLoggingValue', 'Zero-Knowledge')}</div>
                <div className="text-xs text-gray-400">{t('trust.dataResidency.noLoggingDescription', 'No raw packet capture or payload content stored.')}</div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
              <h3 className="text-sm font-bold text-white mb-2">{t('trust.dataResidency.noLoggingPolicy', 'Our No-Logging Commitment')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  t('trust.dataResidency.noLoggingPolicy1', 'No raw packet capture storage'),
                  t('trust.dataResidency.noLoggingPolicy2', 'No payload content retention'),
                  t('trust.dataResidency.noLoggingPolicy3', 'No personal data in scan results'),
                  t('trust.dataResidency.noLoggingPolicy4', 'Scan results auto-delete after 30 days'),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Responsible Disclosure */}
          <section id="responsible-disclosure" className="mb-12 p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.disclosure.title', 'Responsible Disclosure')}
            </h2>
            <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
              <p>
                {t('trust.disclosure.p1', 'We take the security of CyberSec Pro seriously. If you discover a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.')}
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>{t('trust.disclosure.scope', 'Scope: All CyberSec Pro services, APIs, and infrastructure at cyber-sec-pro.com and app.cyber-sec-pro.com.')}</li>
                <li>{t('trust.disclosure.contact', 'Contact: security@cyber-sec-pro.com (PGP key available at /.well-known/pgp-key.txt)')}</li>
                <li>{t('trust.disclosure.response', 'Response time: We will acknowledge your report within 48 hours and provide a timeline for resolution within 5 business days.')}</li>
                <li>{t('trust.disclosure.safeHarbor', 'Safe Harbor: We will not pursue legal action against researchers who follow this policy and act in good faith.')}</li>
              </ul>
              <p className="text-cyan-400 font-medium">
                {t('trust.disclosure.policyDuration', 'Policy effective: 2025-01-01. Last reviewed: 2026-08-04.')}
              </p>
            </div>
          </section>

          {/* Last Pentest */}
          <section className="mb-12 p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.pentest.title', 'Last Penetration Test')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">{t('trust.pentest.date', 'Date')}</div>
                <div className="text-white font-medium">2026-07-15</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">{t('trust.pentest.scope', 'Scope')}</div>
                <div className="text-white font-medium">{t('trust.pentest.scopeValue', 'Full infrastructure + API')}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">{t('trust.pentest.status', 'Status')}</div>
                <div className="text-green-400 font-medium">{t('trust.pentest.statusValue', 'All findings remediated')}</div>
              </div>
            </div>
          </section>

          {/* Sub-processors */}
          <section className="mb-12 p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.subprocessors.title', 'Sub-processors')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 text-gray-400 font-medium">{t('trust.subprocessors.name', 'Name')}</th>
                    <th className="text-left py-2 text-gray-400 font-medium">{t('trust.subprocessors.purpose', 'Purpose')}</th>
                    <th className="text-left py-2 text-gray-400 font-medium">{t('trust.subprocessors.location', 'Data Location')}</th>
                  </tr>
                </thead>
                <tbody>
                  {subProcessors.map((sp) => (
                    <tr key={sp.name} className="border-b border-zinc-800">
                      <td className="py-3 text-white">{sp.name}</td>
                      <td className="py-3 text-gray-400">{sp.purpose}</td>
                      <td className="py-3 text-gray-400">{sp.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DPA */}
          <section id="dpa" className="mb-12 p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.dpa.title', 'Data Processing Agreement (DPA)')}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {t('trust.dpa.description', 'Our DPA is incorporated into our Terms of Service. It includes Standard Contractual Clauses (SCCs) for international data transfers and details our technical and organizational measures.')}
            </p>
            <a
              href="/dashboard/terms#dpa"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition"
            >
              {t('trust.dpa.viewDpa', 'View DPA in Terms of Service')} →
            </a>
          </section>

          {/* Status Page */}
          <section className="p-6 rounded-2xl border border-zinc-700/50 bg-zinc-900/30">
            <h2 className="text-xl font-bold text-white mb-4">
              {t('trust.status.title', 'System Status')}
            </h2>
            <p className="text-gray-400 text-sm">
              {t('trust.status.description', 'For real-time service status and incident history, visit our status page.')}
            </p>
            <a
              href="https://status.cyber-sec-pro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition"
            >
              status.cyber-sec-pro.com ↗
            </a>
          </section>
        </div>
      </div>
    </>
  );
}