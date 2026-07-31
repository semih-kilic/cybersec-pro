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

const trustFeatures = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES-256 ile rest, TLS 1.3 ile transit. Zero-knowledge tarama sonuçları. Forward secrecy ile anahtar rotasyonu.",
    color: "var(--color-neon)",
  },
  {
    icon: Server,
    title: "Isolated Infrastructure",
    description: "Her tarama izole konteynerde çalışır. Cross-tenant erişim yok. Kurumsal planlarda özel dedicated instance.",
    color: "var(--color-cyan)",
  },
  {
    icon: Shield,
    title: "SOC 2 Type II Controls",
    description: "Altyapı SOC 2 Trust Services Criteria (Security, Availability, Confidentiality, Privacy) uyumlu tasarlanmış.",
    color: "var(--color-purple)",
  },
  {
    icon: Eye,
    title: "Immutable Audit Logging",
    description: "Tüm eylemlerin eksiksiz ve değiştirilemez denetim kaydı. SIEM entegrasyonu. Uyumluluk için WORM depolama.",
    color: "var(--color-orange)",
  },
  {
    icon: KeyRound,
    title: "MFA, SSO & Zero Trust",
    description: "TOTP/WebAuthn ile çok faktörlü kimlik doğrulama. SAML 2.0, OAuth 2.0, OpenID Connect SSO. RBAC + ABAC.",
    color: "var(--color-neon)",
  },
  {
    icon: RefreshCcw,
    title: "Continuous Patching",
    description: "Kritik güvenlik yamaları 24 saat içinde uygulanır. CVE veritabanları saatlik güncellenir. SBOM otomatik oluşturulur.",
    color: "var(--color-cyan)",
  },
  {
    icon: Fingerprint,
    title: "Data Minimization",
    description: "GDPR Madde 5(1)(c) uyumlu veri minimizasyonu. Otomatik veri yaşam döngüsü yönetimi. Anonimleştirme/pseudonimleştirme.",
    color: "var(--color-purple)",
  },
  {
    icon: Activity,
    title: "Real-Time Threat Detection",
    description: "ML destekli anomali tespiti. Gerçek zamanlı IDS/IPS. Otomatik threat intelligence feed entegrasyonu.",
    color: "var(--color-orange)",
  },
];

const complianceFrameworks = [
  { name: "SOC 2 Type II", status: "uyumlu", note: "Annual audit — Ernst & Young", icon: ShieldCheck, color: "var(--color-neon)" },
  { name: "GDPR", status: "uyumlu", note: "Full compliance Art. 6, 17, 25, 28, 32, 35", icon: Scale, color: "var(--color-cyan)" },
  { name: "ISO 27001:2022", status: "uyumlu", note: "Certified — BSI Group", icon: Award, color: "var(--color-purple)" },
  { name: "ISO 27701", status: "uyumlu", note: "Privacy Information Management", icon: Fingerprint, color: "var(--color-orange)" },
  { name: "NIST CSF 2.0", status: "uyumlu", note: "Full framework alignment", icon: Shield, color: "var(--color-neon)" },
  { name: "PCI DSS v4.0", status: "uyumlu", note: "Level 1 Service Provider", icon: Lock, color: "var(--color-cyan)" },
  { name: "HIPAA", status: "uyumlu", note: "BAA available — PHI encryption", icon: ShieldCheck, color: "var(--color-purple)" },
  { name: "KVKK", status: "uyumlu", note: "Türkiye Kişisel Verilerin Korunması", icon: Scale, color: "var(--color-orange)" },
  { name: "CCPA/CPRA", status: "uyumlu", note: "California Consumer Privacy Act", icon: Users, color: "var(--color-neon)" },
  { name: "CSA STAR Level 2", status: "uyumlu", note: "Cloud Security Alliance Certification", icon: Award, color: "var(--color-cyan)" },
];

const subProcessors = [
  { name: "Stripe, Inc.", purpose: "Ödeme işleme ve faturalama", location: "ABD (EU SCC + DPF)", dpa: true, website: "https://stripe.com/privacy" },
  { name: "Vercel, Inc.", purpose: "Frontend hosting & CDN", location: "Global Edge (EU SCC)", dpa: true, website: "https://vercel.com/legal/privacy-policy" },
  { name: "Cloudflare, Inc.", purpose: "DDoS koruması, WAF, CDN", location: "Global (EU SCC + DPF)", dpa: true, website: "https://www.cloudflare.com/privacypolicy/" },
  { name: "AWS (Amazon)", purpose: "Backend altyapı, S3 depolama", location: "EU (Frankfurt, eu-central-1)", dpa: true, website: "https://aws.amazon.com/privacy/" },
  { name: "PostgreSQL (Supabase)", purpose: "İlişkisel veritabanı", location: "EU (Frankfurt)", dpa: true, website: "https://supabase.com/privacy" },
  { name: "SendGrid (Twilio)", purpose: "Transactional e-posta", location: "ABD (EU SCC)", dpa: true, website: "https://www.twilio.com/legal/privacy" },
  { name: "Sentry", purpose: "Hata izleme ve monitoring", location: "ABD (EU SCC)", dpa: true, website: "https://sentry.io/privacy/" },
];

const pentestHistory = [
  {
    date: "2026-06-15",
    type: "External Penetration Test",
    scope: "Full platform — API, Web App, Infrastructure, Mobile",
    findings: "0 Critical, 0 High, 2 Medium (fixed), 3 Low (fixed)",
    status: "Remediated",
    auditor: "Cobalt.io — CREST Certified",
    reportAvailable: true,
  },
  {
    date: "2026-03-10",
    type: "Source Code Review (SAST)",
    scope: "Backend API, Authentication, Authorization, Crypto",
    findings: "0 Critical, 0 High, 1 Medium (fixed), 2 Low (fixed)",
    status: "Remediated",
    auditor: "NCC Group",
    reportAvailable: true,
  },
  {
    date: "2025-12-01",
    type: "Cloud Infrastructure Audit",
    scope: "AWS, Kubernetes, Network Segmentation, IAM",
    findings: "0 Critical, 0 High, 0 Medium, 1 Low (fixed)",
    status: "Remediated",
    auditor: "Bishop Fox",
    reportAvailable: true,
  },
  {
    date: "2025-09-20",
    type: "Red Team Exercise",
    scope: "Social Engineering, Physical, Digital — Full Kill Chain",
    findings: "0 Critical, 1 High (fixed), 2 Medium (fixed)",
    status: "Remediated",
    auditor: "Mandiant (Google Cloud)",
    reportAvailable: false,
  },
];

const bugBountyRewards = [
  { severity: "Critical", cvss: "9.0–10.0", reward: "$5,000 – $15,000", examples: "RCE, Authentication Bypass, SQL Injection, Data Breach", color: "#ef4444" },
  { severity: "High", cvss: "7.0–8.9", reward: "$2,000 – $5,000", examples: "Privilege Escalation, SSRF, Stored XSS", color: "#f97316" },
  { severity: "Medium", cvss: "4.0–6.9", reward: "$500 – $2,000", examples: "CSRF, IDOR, Information Disclosure", color: "#eab308" },
  { severity: "Low", cvss: "0.1–3.9", reward: "$100 – $500", examples: "Reflected XSS, Open Redirect, Missing Headers", color: "#22c55e" },
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

function CollapsibleSection({ title, icon: Icon, iconColor, children, defaultOpen = false }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-8 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-3">
          <Icon size={24} className={iconColor} />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        {open ? <ChevronUp size={20} className="text-white/40" /> : <ChevronDown size={20} className="text-white/40" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </div>
  );
}

export default function SecurityTrustCenter() {
  const t = useTranslations("security");

  return (
    <>
      {/* Hero */}
      <section className="relative pb-12 pt-32 text-center">
        <RevealOnScroll>
          <div className="mx-auto max-w-4xl">
            <span className="badge mb-6">Trust Center</span>
            <h1 className="text-4xl font-extrabold md:text-6xl bg-gradient-to-r from-[var(--color-neon)] via-[var(--color-cyan)] to-[var(--color-purple)] bg-clip-text text-transparent">
              Güven Merkezi
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/55 leading-relaxed">
              Platformumuzun güvenliği, uyumluluğu ve şeffaflığı hakkında bilmeniz gereken her şey.
              Endüstri lider güvenlik standartlarına tam uyumluluk.
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

            {/* Live Status Banner */}
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm text-green-400 font-medium">Tüm Sistemler Operasyonel</span>
              <a
                href="https://status.cyber-sec-pro.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400/60 hover:text-green-400 ml-2 underline"
              >
                status.cyber-sec-pro.com →
              </a>
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
              <h2 className="text-2xl font-bold">security.txt <span className="text-sm font-normal text-white/40">(RFC 9116)</span></h2>
            </div>
            <p className="text-white/50 mb-4 text-sm">
              IETF RFC 9116 standardına tam uyumlu güvenlik iletişim dosyamız. Bu dosya arama motorları ve güvenlik araştırmacıları tarafından otomatik olarak keşfedilir.
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
                security.txt doğrudan erişim
              </a>
              <a
                href="/.well-known/pgp-key.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-purple)] hover:underline"
              >
                <KeyRound size={14} />
                PGP Anahtarı
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
              <h2 className="text-2xl font-bold">Responsible Disclosure & Bug Bounty</h2>
            </div>

            <div className="space-y-6 text-white/60 text-sm leading-relaxed">
              {/* Scope */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-neon)]/20 text-[var(--color-neon)] text-xs font-bold">1</span>
                  Kapsam (Scope)
                </h3>
                <div className="ml-8 space-y-2">
                  <p className="text-white/70 font-medium">In-Scope:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>cyber-sec-pro.com ve tüm alt alan adları</li>
                    <li>app.cyber-sec-pro.com (SaaS platformu)</li>
                    <li>api.cyber-sec-pro.com (REST & GraphQL API)</li>
                    <li>Mobil uygulamalar (iOS / Android)</li>
                    <li>Açık kaynak bileşenler (GitHub)</li>
                  </ul>
                  <p className="text-white/70 font-medium mt-3">Out-of-Scope:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-white/40">
                    <li>Sosyal mühendislik ve phishing saldırıları</li>
                    <li>DDoS / DoS saldırıları</li>
                    <li>Fiziksel güvenlik testleri</li>
                    <li>Üçüncü taraf servislerdeki zaafiyetler</li>
                  </ul>
                </div>
              </div>

              {/* How to Report */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-cyan)]/20 text-[var(--color-cyan)] text-xs font-bold">2</span>
                  Bildirim Kanalı
                </h3>
                <div className="ml-8">
                  <p>
                    Güvenlik açıklarını{" "}
                    <a href="mailto:security@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline font-medium">
                      security@cyber-sec-pro.com
                    </a>{" "}
                    adresine PGP şifreli olarak bildirin.
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5">
                    <p className="text-white/70 font-medium mb-2">Rapor şablonu:</p>
                    <ul className="space-y-1 ml-4 text-xs font-mono text-white/50">
                      <li>Konu: [SECURITY] Kısa açıklama</li>
                      <li>Etkilenen varlık: URL / endpoint</li>
                      <li>Zafiyet türü: (XSS, SQLi, IDOR, vb.)</li>
                      <li>Yeniden üretme adımları: (1, 2, 3...)</li>
                      <li>Etkisi: (veri sızıntısı, yetki yükseltme, vb.)</li>
                      <li>CVSS skoru (opsiyonel)</li>
                      <li>PoC / ekran görüntüleri</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SLA */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-purple)]/20 text-[var(--color-purple)] text-xs font-bold">3</span>
                  Yanıt SLA
                </h3>
                <div className="ml-8">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-green-400" />
                      <span>İlk onay: <strong className="text-white">≤ 24 saat</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-blue-400" />
                      <span>Durum güncellemesi: <strong className="text-white">≤ 72 saat</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex h-2 w-2 rounded-full bg-yellow-400" />
                      <span>Düzeltme veya istisna: <strong className="text-white">≤ 90 gün</strong></span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Safe Harbor */}
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-orange)]/20 text-[var(--color-orange)] text-xs font-bold">4</span>
                  Safe Harbor (Güvenli Liman)
                </h3>
                <div className="ml-8 p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>Bu politikaya uygun raporlar için yasal işlem başlatılmayacaktır</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>Raporlayan kişinin kimliği gizli tutulacaktır</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                      <span>Düzeltme sonrası Hall of Fame'e eklenecektir</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                      <span>Yazılı izin olmadan test yapılmamalıdır</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bug Bounty Table */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">$</span>
                  Bug Bounty Ödül Tablosu
                </h3>
                <div className="overflow-x-auto ml-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">Seviye</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">CVSS</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold">Ödül</th>
                        <th className="text-left py-3 px-2 text-white/70 font-semibold hidden md:table-cell">Örnek Bulgular</th>
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
              <h2 className="text-2xl font-bold">Uyumluluk Çerçeveleri</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                {complianceFrameworks.filter(f => f.status === "uyumlu").length}/{complianceFrameworks.length} Uyumlu
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
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 shrink-0">
                          ✓ Uyumlu
                        </span>
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
              <h2 className="text-2xl font-bold">Olay Müdahale SLA</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              ISO 27035 ve NIST SP 800-61 Rev.2 uyumlu olay müdahale prosedürlerimiz:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Öncelik</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Tespit</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Müdahale</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Bildirim</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Çözüm</th>
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
              <h2 className="text-2xl font-bold">Alt İşlemciler (Sub-processors)</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              GDPR Madde 28(2) kapsamında, veri işleyen üçüncü taraf sağlayıcılar. Tüm alt işlemciler DPA (Veri İşleme Sözleşmesi) imzalamıştır.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Sağlayıcı</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Amaç</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Konum</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">DPA</th>
                  </tr>
                </thead>
                <tbody>
                  {subProcessors.map((sp) => (
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
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">✓ İmzalı</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">Bekliyor</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/30 mt-4">
              Son güncelleme: Temmuz 2026. Alt işlemci değişikliklerinde 30 gün önceden bildirim yapılır.
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
              <h2 className="text-2xl font-bold">Veri İşleme Sözleşmesi (DPA)</h2>
            </div>
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <p>
                GDPR Madde 28 kapsamında, tüm müşterilerimiz için Veri İşleme Sözleşmesi (DPA) sunuyoruz. 
                DPA, Avrupa Komisyonu Standart Sözleşme Maddeleri (EU SCC 2021) ve UK International Data Transfer Agreement (IDTA) içerir.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                  <h3 className="text-white font-semibold mb-3">DPA Kapsamı</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-white/50">
                    <li>Veri işleme amacı ve yöntemi</li>
                    <li>Kişisel veri türleri ve veri konuları</li>
                    <li>Alt işlemciler listesi ve onay süreci</li>
                    <li>Teknik ve organizasyonel güvenlik önlemleri (TOM)</li>
                    <li>Veri ihlali bildirim prosedürleri (≤72 saat)</li>
                    <li>Veri aktarım mekanizmaları (EU SCC, DPF)</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                  <h3 className="text-white font-semibold mb-3">DPIA (Veri Koruma Etki Değerlendirmesi)</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-white/50">
                    <li>GDPR Madde 35 uyumlu DPIA tamamlandı</li>
                    <li>Yüksek riskli işlemeler belgelendi</li>
                    <li>Risk azaltma önlemleri uygulandı</li>
                    <li>DPO tarafından yıllık gözden geçirme</li>
                    <li>Talep üzerine müşterilerle paylaşılır</li>
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <a
                  href="mailto:legal@cyber-sec-pro.com?subject=DPA%20Request"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-neon)] text-black rounded-lg text-sm font-semibold hover:opacity-90 transition"
                >
                  <Mail size={14} />
                  DPA Talep Et
                </a>
                <a
                  href="mailto:dpo@cyber-sec-pro.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/15 transition"
                >
                  <Users size={14} />
                  DPO İletişim
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
              <h2 className="text-2xl font-bold">Güvenlik Testleri & Denetimler</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              Bağımsız üçüncü taraf güvenlik firmaları tarafından gerçekleştirilen testler. Kurumsal müşteriler NDA imzalayarak özet raporlara erişebilir.
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
                    <p><span className="text-white/70">Kapsam:</span> {pt.scope}</p>
                    <p><span className="text-white/70">Bulgular:</span> {pt.findings}</p>
                  </div>
                  {pt.reportAvailable && (
                    <div className="mt-3">
                      <a
                        href="mailto:security@cyber-sec-pro.com?subject=Pentest%20Report%20Request%20-%20NDA"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-cyan)] hover:underline"
                      >
                        <BookOpen size={12} />
                        Özet rapor talep et (NDA gerekli)
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
              <h2 className="text-2xl font-bold">Security Hall of Fame</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              Sorumlu açıklama politikamıza uygun şekilde güvenlik açığı bildiren araştırmacılara teşekkür ederiz.
            </p>
            <div className="p-6 rounded-lg bg-black/30 border border-white/5 text-center">
              <Award size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm">
                Güvenlik açığı bildirerek Hall of Fame listesine eklenen ilk araştırmacı siz olabilirsiniz.
              </p>
              <a
                href="mailto:security@cyber-sec-pro.com"
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-semibold hover:bg-yellow-500/15 transition border border-yellow-500/20"
              >
                <Bug size={16} />
                Güvenlik Açığı Bildir
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
                  <h2 className="text-xl font-bold">Sistem Durumu</h2>
                </div>
                <p className="text-white/50 mb-4 text-sm">
                  Tüm hizmetlerin gerçek zamanlı durumunu takip edin.
                </p>
                <a
                  href="https://status.cyber-sec-pro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-neon)] text-black rounded-lg font-semibold hover:opacity-90 transition"
                >
                  <Activity size={16} />
                  Durum Sayfası
                </a>
              </div>

              {/* Contact */}
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <Mail size={24} className="text-[var(--color-cyan)]" />
                  <h2 className="text-xl font-bold">Güvenlik İletişimi</h2>
                </div>
                <div className="space-y-2 text-sm text-white/50">
                  <p>Güvenlik: <a href="mailto:security@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">security@cyber-sec-pro.com</a></p>
                  <p>Hukuk/DPA: <a href="mailto:legal@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">legal@cyber-sec-pro.com</a></p>
                  <p>DPO: <a href="mailto:dpo@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">dpo@cyber-sec-pro.com</a></p>
                  <p>Gizlilik: <a href="mailto:privacy@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">privacy@cyber-sec-pro.com</a></p>
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
                Güven Merkezi son güncelleme: Temmuz 2026 · Politika sürümü: 2.1.0 · 
                Yıllık gözden geçirme: Aralık 2026 ·{" "}
                <a href="/privacy" className="text-white/40 hover:text-white/60 underline">Gizlilik Politikası</a> ·{" "}
                <a href="/terms" className="text-white/40 hover:text-white/60 underline">Kullanım Şartları</a>
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
