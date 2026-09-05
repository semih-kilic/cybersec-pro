"use client";
import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
const CyberRadar = dynamic(() => import("@/components/three/CyberRadar"), { ssr: false });
import { Shield, Wifi, Globe, Bug, Database, Lock, Terminal, FileSearch, Radio, Server, Code2, Zap } from "lucide-react";

const assessmentTypes = [
  { icon: Globe, title: "Web Application Testing", description: "OWASP Top 10 vulnerability scanning, XSS, SQLi, CSRF detection with automated proof-of-concept generation.", color: "var(--color-neon)" },
  { icon: Wifi, title: "Network Penetration Testing", description: "Internal and external network assessments. Port scanning, service enumeration, and exploit verification.", color: "var(--color-cyan)" },
  { icon: Bug, title: "Vulnerability Assessment", description: "Comprehensive CVE scanning across your entire infrastructure with prioritized remediation guidance.", color: "var(--color-purple)" },
  { icon: Lock, title: "Authentication Testing", description: "Brute-force resistance, session management, MFA bypass attempts, and credential stuffing simulations.", color: "var(--color-orange)" },
  { icon: Database, title: "Database Security Audit", description: "Configuration review, privilege escalation testing, SQL injection deep-dive, and data exposure analysis.", color: "var(--color-neon)" },
  { icon: Terminal, title: "API Security Testing", description: "REST & GraphQL endpoint testing, rate limiting verification, BOLA/IDOR checks, and auth bypass attempts.", color: "var(--color-cyan)" },
  { icon: FileSearch, title: "Source Code Review", description: "Static analysis for security anti-patterns, hardcoded secrets, dependency vulnerabilities, and unsafe deserialization.", color: "var(--color-purple)" },
  { icon: Radio, title: "Wireless Security Assessment", description: "WiFi security auditing, rogue AP detection, WPA/WPA2 testing, and evil twin attack simulation.", color: "var(--color-orange)" },
  { icon: Server, title: "Cloud Configuration Review", description: "AWS/Azure/GCP misconfigurations, IAM policy analysis, S3 bucket exposure, and serverless security checks.", color: "var(--color-neon)" },
  { icon: Code2, title: "Container Security", description: "Docker image scanning, Kubernetes RBAC audit, pod security policies, and runtime threat detection.", color: "var(--color-cyan)" },
  { icon: Shield, title: "Compliance Scanning", description: "PCI-DSS, HIPAA, GDPR, and SOC 2 compliance verification with automated reporting and evidence collection.", color: "var(--color-purple)" },
  { icon: Zap, title: "Red Team Simulation", description: "Full adversary simulation including social engineering, physical security testing, and advanced persistent threat emulation.", color: "var(--color-red)" },
];

export default function TestsPage() {
  const t = useTranslations("tests");

  return (
    <>
      <CyberRadar />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-28 md:grid-cols-2 lg:grid-cols-3">
        {assessmentTypes.map((a) => {
          const Icon = a.icon;
          return (
            <RevealOnScroll key={a.title}>
              <div className="glass-card group p-6 transition-colors hover:border-[color:var(--color-neon)]/30">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${a.color} 15%, transparent)` }}>
                  <Icon className="h-6 w-6" style={{ color: a.color }} />
                </div>
                <h3 className="mb-2 text-lg font-bold">{a.title}</h3>
                <p className="text-sm text-white/55">{a.description}</p>
                <button className="mt-4 text-sm font-semibold text-[--color-neon] opacity-0 transition-opacity group-hover:opacity-100">
                  Run Assessment →
                </button>
              </div>
            </RevealOnScroll>
          );
        })}
      </section>
    </>
  );
}
