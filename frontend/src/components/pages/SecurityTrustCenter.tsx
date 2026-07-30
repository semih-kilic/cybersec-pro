"use client";

import { useTranslations } from "next-intl";
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
} from "lucide-react";

const trustFeatures = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES-256 ile rest, TLS 1.3 ile transit. Zero-knowledge tarama sonuçları.",
    color: "var(--color-neon)",
  },
  {
    icon: Server,
    title: "Isolated Infrastructure",
    description: "Her tarama izole konteynerde çalışır. Cross-tenant erişim yok. Kurumsal planlarda özel instance.",
    color: "var(--color-cyan)",
  },
  {
    icon: Shield,
    title: "SOC 2-Aligned Controls",
    description: "Altyapı SOC 2 Trust Services Criteria (Security, Availability, Confidentiality) uyumlu tasarlanmış.",
    color: "var(--color-purple)",
  },
  {
    icon: Eye,
    title: "Audit Logging",
    description: "Tüm eylemlerin eksiksiz denetim kaydı. Değiştirilemez loglar. Uyumluluk için dışa aktarın.",
    color: "var(--color-orange)",
  },
  {
    icon: KeyRound,
    title: "MFA & SSO",
    description: "TOTP ile çok faktörlü kimlik doğrulama. Kurumsal SSO: SAML 2.0 ve OAuth 2.0.",
    color: "var(--color-neon)",
  },
  {
    icon: RefreshCcw,
    title: "Automatic Updates",
    description: "Güvenlik yamaları 24 saat içinde uygulanır. Araç veritabanları günlük güncellenir.",
    color: "var(--color-cyan)",
  },
];

const complianceFrameworks = [
  { name: "SOC 2", status: "uyumlu", note: "Aligned controls, independent audit planned" },
  { name: "GDPR", status: "uyumlu", note: "Full compliance Art. 6, 17, 28" },
  { name: "ISO 27001", status: "hazırlanıyor", note: "Roadmap 2026" },
  { name: "PCI DSS", status: "hazırlanıyor", note: "Kapsam değerlendirmesi devam ediyor" },
  { name: "HIPAA", status: "hazırlanıyor", note: "BAA mevcut değil" },
];

const subProcessors = [
  { name: "Stripe", purpose: "Ödeme işleme", location: "ABD (EU SCC)", website: "https://stripe.com" },
  { name: "Vercel", purpose: "Hosting (frontend)", location: "ABD (EU SCC)", website: "https://vercel.com" },
  { name: "Railway", purpose: "Backend altyapı", location: "ABD (EU SCC)", website: "https://railway.app" },
  { name: "Cloudflare", purpose: "CDN ve DDoS koruması", location: "ABD (EU SCC)", website: "https://cloudflare.com" },
  { name: "PostgreSQL (ElephantSQL)", purpose: "Veritabanı", location: "EU (Frankfurt)", website: "https://www.elephantsql.com" },
];

const pentestHistory = [
  {
    date: "2026-06-15",
    type: "Sızma Testi (Pentest)",
    scope: "Full platform (API, frontend, infrastructure)",
    findings: "0 Critical, 0 High, 2 Medium, 3 Low",
    status: "Kapandı",
    auditor: "Bağımsız Güvenlik Danışmanı",
  },
  {
    date: "2026-03-10",
    type: "Kod İncelemesi",
    scope: "Backend API, authentication, authorization",
    findings: "0 Critical, 0 High, 1 Medium, 2 Low",
    status: "Kapandı",
    auditor: "Bağımsız Güvenlik Danışmanı",
  },
];

export default function SecurityTrustCenter() {
  const t = useTranslations("security");

  return (
    <>
      {/* Hero */}
      <section className="relative pb-8 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">Güven Merkezi</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">Güvenlik Merkezi</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            Platformumuzun güvenliği, uyumluluğu ve şeffaflığı hakkında bilmeniz gereken her şey.
          </p>
        </RevealOnScroll>
      </section>

      {/* Trust Features */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-16 md:grid-cols-2 lg:grid-cols-3">
        {trustFeatures.map((f) => {
          const Icon = f.icon;
          return (
            <RevealOnScroll key={f.title}>
              <div className="glass-card flex flex-col gap-4 p-8">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${f.color}15`, color: f.color }}
                >
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.description}</p>
              </div>
            </RevealOnScroll>
          );
        })}
      </section>

      {/* Security.txt */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileCheck size={24} className="text-[var(--color-neon)]" />
              <h2 className="text-2xl font-bold">Güvenlik Bildirimi (security.txt)</h2>
            </div>
            <p className="text-white/50 mb-4">
              RFC 9116 uyumlu güvenlik iletişim dosyamız:
            </p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-[var(--color-neon)]">
              <p>Contact: mailto:security@cyber-sec-pro.com</p>
              <p>Expires: 2027-01-01T00:00:00.000Z</p>
              <p>Preferred-Languages: en, tr</p>
              <p>Canonical: https://cyber-sec-pro.com/.well-known/security.txt</p>
              <p>Policy: https://cyber-sec-pro.com/security/disclosure</p>
              <p>Encryption: https://cyber-sec-pro.com/.well-known/pgp-key.txt</p>
            </div>
            <a
              href="/.well-known/security.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--color-cyan)] hover:underline"
            >
              <ExternalLink size={14} />
              security.txt doğrudan erişim
            </a>
          </div>
        </RevealOnScroll>
      </section>

      {/* Responsible Disclosure */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle size={24} className="text-yellow-400" />
              <h2 className="text-2xl font-bold">Sorumlu Disclosure Politikası</h2>
            </div>
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <div>
                <h3 className="text-white font-semibold mb-2">1. Kapsam</h3>
                <p>
                  Bu politika, CyberSec Pro platformundaki (cyber-sec-pro.com, app.cyber-sec-pro.com)
                  tüm yazılım, API ve altyapı güvenlik açıklarını kapsar.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">2. Bildirim Kanalı</h3>
                <p>
                  Güvenlik açıklarını <a href="mailto:security@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">security@cyber-sec-pro.com</a> adresine
                  PGP şifreli olarak bildirin. E-posta konusunda: <code>[GÜVENLİK] Kısa açıklama</code> kullanın.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">3. Yanıt Süresi</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>24 saat içinde ilk onay</li>
                  <li>72 saat içinde durum güncellemesi</li>
                  <li>90 gün içinde düzeltme veya istisna bildirimi</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">4. Sorunsuz Raporlama</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Yasal dokunulmazlık sağlanması için çaba gösterilecektir</li>
                  <li>Gizlilik taahhüt edilir</li>
                  <li>İzin alınmadan test yapılmamalıdır</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">5. Teşekkür</h3>
                <p>
                  Geçerli raporlar için <a href="/security/acknowledgments" className="text-[var(--color-cyan)] hover:underline">Teşekkürler</a> sayfasında isminiz yayınlanacaktır.
                </p>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Sub-processors */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Database size={24} className="text-[var(--color-purple)]" />
              <h2 className="text-2xl font-bold">Alt İşlemciler (Sub-processors)</h2>
            </div>
            <p className="text-white/50 mb-6 text-sm">
              Hizmetimizi sunmak için veri işleyen üçüncü taraf sağlayıcılar:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Sağlayıcı</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Amaç</th>
                    <th className="text-left py-3 px-2 text-white/70 font-semibold">Konum</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Compliance Frameworks */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle size={24} className="text-green-400" />
              <h2 className="text-2xl font-bold">Uyumluluk Çerçeveleri</h2>
            </div>
            <div className="space-y-3">
              {complianceFrameworks.map((cf) => (
                <div key={cf.name} className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{cf.name}</span>
                    <span className="text-xs text-white/40">{cf.note}</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      cf.status === "uyumlu"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {cf.status === "uyumlu" ? "Uyumlu" : "Hazırlanıyor"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* DPA */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileCheck size={24} className="text-[var(--color-orange)]" />
              <h2 className="text-2xl font-bold">Veri İşleme Sözleşmesi (DPA)</h2>
            </div>
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <p>
                GDPR Madde 28 kapsamında, Kurumsal müşterilerimiz için Veri İşleme Sözleşmesi (DPA) sunuyoruz.
              </p>
              <div>
                <h3 className="text-white font-semibold mb-2">DPA Kapsamı:</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Veri işleme amacı ve yöntemi</li>
                  <li>Kişisel veri türleri ve veri konuları</li>
                  <li>Alt işlemciler listesi</li>
                  <li>Güvenlik önlemleri</li>
                  <li>Veri ihlali bildirim prosedürleri (72 saat)</li>
                  <li>Veri aktarım mekanizmaları (EU SCC)</li>
                </ul>
              </div>
              <p>
                DPA talebi için: <a href="mailto:legal@cyber-sec-pro.com" className="text-[var(--color-cyan)] hover:underline">legal@cyber-sec-pro.com</a>
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Pentest History */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock size={24} className="text-[var(--color-cyan)]" />
              <h2 className="text-2xl font-bold">Son Güvenlik Testleri</h2>
            </div>
            <div className="space-y-4">
              {pentestHistory.map((pt) => (
                <div key={pt.date} className="p-4 rounded-lg bg-black/30 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">{pt.type}</span>
                    <span className="text-xs text-white/40">{pt.date}</span>
                  </div>
                  <div className="text-sm text-white/50 space-y-1">
                    <p><span className="text-white/70">Kapsam:</span> {pt.scope}</p>
                    <p><span className="text-white/70">Bulgular:</span> {pt.findings}</p>
                    <p><span className="text-white/70">Denetçi:</span> {pt.auditor}</p>
                  </div>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                    {pt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Status Page Link */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <RevealOnScroll>
          <div className="glass-card p-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Globe size={24} className="text-[var(--color-neon)]" />
              <h2 className="text-2xl font-bold">Sistem Durumu</h2>
            </div>
            <p className="text-white/50 mb-6">
              Tüm hizmetlerin gerçek zamanlı durumunu takip edin.
            </p>
            <a
              href="https://status.cyber-sec-pro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-neon)] text-black rounded-lg font-semibold hover:opacity-90 transition"
            >
              <ExternalLink size={16} />
              status.cyber-sec-pro.com
            </a>
          </div>
        </RevealOnScroll>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <RevealOnScroll>
          <div className="glass-card p-8 text-center">
            <Mail size={32} className="text-[var(--color-neon)] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Güvenlik İletişimi</h2>
            <p className="text-white/50 mb-6">
              Güvenlik endişeleriniz mi var? Bize ulaşın.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:security@cyber-sec-pro.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-neon)] text-black rounded-lg font-semibold hover:opacity-90 transition"
              >
                <Mail size={16} />
                security@cyber-sec-pro.com
              </a>
              <a
                href="/.well-known/security.txt"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/15 transition"
              >
                <FileCheck size={16} />
                security.txt
              </a>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
