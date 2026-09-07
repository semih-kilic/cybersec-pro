"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Lock, Server, Shield, Eye, KeyRound, RefreshCcw } from "lucide-react";

const CyberAttackGlobe = dynamic(() => import("@/components/three/CyberAttackGlobe"), { ssr: false });

const features = [
  { icon: Lock, title: "End-to-End Encryption", description: "All data encrypted at rest (AES-256) and in transit (TLS 1.3). Zero-knowledge architecture for scan results.", color: "var(--color-neon)" },
  { icon: Server, title: "Isolated Infrastructure", description: "Each scan runs in an isolated container. No cross-tenant data access. Enterprise plans get dedicated instances.", color: "var(--color-cyan)" },
  { icon: Shield, title: "SOC 2-Aligned Controls", description: "Infrastructure designed against SOC 2 Trust Services Criteria (Security, Availability, Confidentiality). Independent audit not yet completed.", color: "var(--color-purple)" },
  { icon: Eye, title: "Audit Logging", description: "Complete audit trail of all actions. Immutable logs with tamper detection. Export logs for compliance.", color: "var(--color-orange)" },
  { icon: KeyRound, title: "MFA & SSO", description: "Multi-factor authentication with TOTP. Enterprise SSO via SAML 2.0, OpenID Connect (OIDC), and LDAP / Active Directory.", color: "var(--color-neon)" },
  { icon: RefreshCcw, title: "Automatic Updates", description: "Security patches applied within 24 hours. Tool databases updated daily. Zero-downtime deployments.", color: "var(--color-cyan)" },
];

export default function SecurityPage() {
  const t = useTranslations("security");

  return (
    <>
      <CyberAttackGlobe />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-28 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <RevealOnScroll key={f.title}>
              <div className="glass-card flex flex-col gap-4 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${f.color}15`, color: f.color }}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.description}</p>
              </div>
            </RevealOnScroll>
          );
        })}
      </section>
    </>
  );
}
