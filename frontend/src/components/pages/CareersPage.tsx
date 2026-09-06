"use client";
import dynamic from "next/dynamic";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
const CyberRadar = dynamic(() => import("@/components/three/CyberRadar"), { ssr: false });
import { Handshake, Building2, GraduationCap, Globe, Shield, Mail, ExternalLink, Users, Target, Zap } from "lucide-react";

const partnerships = [
  {
    icon: Building2,
    title: "Technology Partners",
    description: "Integrate your security tools, APIs, or platforms with CyberSec Pro. Expand your reach to thousands of security professionals.",
    color: "var(--color-neon)",
    opportunities: ["API integrations", "Tool marketplace listings", "Co-developed features", "Joint product roadmap"],
  },
  {
    icon: GraduationCap,
    title: "Academic & Research",
    description: "Partner with us for cybersecurity research, student programs, and academic tool development. Free access for qualifying institutions.",
    color: "var(--color-cyan)",
    opportunities: ["Free educational licenses", "Research collaborations", "Student internship programs", "Joint publications"],
  },
  {
    icon: Globe,
    title: "Channel & Reseller",
    description: "Resell CyberSec Pro to your clients. Earn competitive margins while providing enterprise-grade security testing to your portfolio.",
    color: "var(--color-purple)",
    opportunities: ["Competitive revenue share", "Sales training & certification", "Co-marketing support", "Dedicated partner portal"],
  },
  {
    icon: Shield,
    title: "Security Consultancies",
    description: "Enhance your penetration testing and security assessment services with CyberSec Pro's 88-tool arsenal and automated reporting.",
    color: "var(--color-orange)",
    opportunities: ["White-label reports", "Bulk scan pricing", "Custom tool configurations", "Priority support"],
  },
];

const sponsorTiers = [
  {
    name: "Community",
    contribution: "Open Source Contributions",
    benefits: [
      "Recognition on our GitHub and website",
      "Priority feature requests",
      "Direct communication channel with the team",
    ],
    color: "var(--color-neon)",
  },
  {
    name: "Gold Sponsor",
    contribution: "$5,000+ / year",
    benefits: [
      "Logo on the website and documentation",
      "Quarterly product briefings",
      "Co-branded security research publications",
      "Dedicated partner success manager",
    ],
    color: "#ffd166",
  },
  {
    name: "Platinum Sponsor",
    contribution: "$15,000+ / year",
    benefits: [
      "All Gold benefits",
      "Joint marketing campaigns",
      "Speaking slots at CyberSec Pro events",
      "Custom integration development",
      "Early access to new features",
    ],
    color: "#e0e0e0",
  },
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

      {/* Partnership Types */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <RevealOnScroll>
          <h2 className="mb-8 text-2xl font-bold text-center">Partner With Us</h2>
        </RevealOnScroll>
        <div className="grid gap-6 md:grid-cols-2">
          {partnerships.map(({ icon: Icon, title, description, color, opportunities }) => (
            <RevealOnScroll key={title}>
              <div className="glass-card flex flex-col gap-4 p-6 h-full">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">{description}</p>
                <div className="mt-auto space-y-2">
                  {opportunities.map((opp) => (
                    <div key={opp} className="flex items-center gap-2 text-xs text-white/40">
                      <Zap size={10} style={{ color }} className="shrink-0" />
                      {opp}
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Sponsorship Tiers */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <RevealOnScroll>
          <h2 className="mb-8 text-2xl font-bold text-center">Sponsorship Opportunities</h2>
          <p className="text-center text-sm text-white/40 mb-8 max-w-lg mx-auto">
            Support the development of open-source security tools and get visibility in the cybersecurity community.
          </p>
        </RevealOnScroll>
        <div className="grid gap-6 md:grid-cols-3">
          {sponsorTiers.map(({ name, contribution, benefits, color }) => (
            <RevealOnScroll key={name}>
              <div className="glass-card flex flex-col gap-4 p-6 h-full" style={{ borderColor: `${color}20` }}>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <h3 className="font-bold" style={{ color }}>{name}</h3>
                </div>
                <p className="text-sm text-white/50">{contribution}</p>
                <div className="mt-auto space-y-2">
                  {benefits.map((b) => (
                    <div key={b} className="flex items-start gap-2 text-xs text-white/40">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Why Partner */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <RevealOnScroll>
          <h2 className="mb-8 text-2xl font-bold text-center">Why Partner With CyberSec Pro</h2>
        </RevealOnScroll>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, label: "Growing User Base", detail: "Join a rapidly expanding community of security professionals using our platform daily." },
            { icon: Target, label: "Real-World Impact", detail: "Your tools and integrations help organizations identify and fix vulnerabilities faster." },
            { icon: Handshake, label: "Mutual Growth", detail: "We invest in partnerships that create value for both parties and the security ecosystem." },
          ].map(({ icon: Icon, label, detail }) => (
            <RevealOnScroll key={label}>
              <div className="glass-card flex flex-col items-center gap-3 p-6 text-center">
                <Icon size={28} className="text-[var(--color-neon)]" />
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className="text-xs text-white/40 leading-relaxed">{detail}</span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <RevealOnScroll>
          <div className="glass-card p-8 text-center" style={{ borderColor: "var(--color-neon)/20" }}>
            <Mail size={32} className="mx-auto text-[var(--color-neon)] mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Get In Touch</h2>
            <p className="text-sm text-white/50 max-w-lg mx-auto leading-relaxed">
              Interested in partnering, sponsoring, or collaborating? We&apos;d love to hear from you.
              Reach out and let&apos;s explore how we can work together.
            </p>
            <a
              href="mailto:partnerships@cyber-sec-pro.com?subject=Partnership%20Inquiry"
              className="mt-6 inline-block text-lg font-mono text-[var(--color-neon)] hover:underline"
            >
              partnerships@cyber-sec-pro.com
            </a>
            <p className="mt-3 text-xs text-white/30">We respond to all inquiries within 3 business days.</p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
