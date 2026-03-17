"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import GlitchText from "@/components/animations/GlitchText";
import Link from "next/link";
import { Mail, ArrowRight, Headphones, Handshake } from "lucide-react";

const ParticleField = dynamic(() => import("@/components/three/ParticleField"), { ssr: false });

export default function ContactPage() {
  const t = useTranslations("contact");

  return (
    <>
      <ParticleField />
      {/* Hero */}
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">
            <GlitchText text={t("title")} />
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Contact Cards */}
      <section className="mx-auto grid max-w-[1100px] gap-6 px-6 pb-20 md:grid-cols-3">
        {/* Sales */}
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <Mail size={32} className="text-[var(--color-neon)]" />
            <h3 className="text-xl font-bold">{t("sales.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("sales.description")}</p>
            <div className="flex items-center gap-2 font-mono text-xs text-white/40">
              <span className="uppercase text-white/30">Email</span>
              <a href="mailto:cybersecpro@semihkilic.com" className="truncate text-[var(--color-neon)] hover:underline">
                cybersecpro@semihkilic.com
              </a>
            </div>
            <span className="inline-block w-fit rounded-full border border-[var(--color-neon)]/15 bg-[var(--color-neon)]/[0.06] px-3 py-1 font-mono text-xs font-semibold text-[var(--color-neon)]">
              {t("sales.response")}
            </span>
            <a
              href="mailto:cybersecpro@semihkilic.com?subject=Demo%20Request"
              className="btn-primary mt-auto justify-center"
            >
              {t("sales.cta")} <ArrowRight size={14} />
            </a>
          </div>
        </RevealOnScroll>

        {/* Support */}
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <Headphones size={32} className="text-[var(--color-cyan)]" />
            <h3 className="text-xl font-bold">{t("support.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("support.description")}</p>
            <ul className="flex flex-col gap-2 text-sm text-white/50">
              <li className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="min-w-[90px] font-mono text-xs font-semibold text-[var(--color-neon)]">Enterprise</span>
                {t("support.enterprise").split("—")[1]}
              </li>
              <li className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="min-w-[90px] font-mono text-xs font-semibold text-[var(--color-neon)]">Professional</span>
                {t("support.professional").split("—")[1]}
              </li>
              <li className="flex items-center gap-2">
                <span className="min-w-[90px] font-mono text-xs font-semibold text-[var(--color-neon)]">Trial</span>
                {t("support.trial").split("—")[1]}
              </li>
            </ul>
            <Link href="/docs" className="btn-outline mt-auto justify-center">
              {t("support.cta")} <ArrowRight size={14} />
            </Link>
          </div>
        </RevealOnScroll>

        {/* Partnerships */}
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <Handshake size={32} className="text-[var(--color-purple)]" />
            <h3 className="text-xl font-bold">{t("partnerships.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("partnerships.description")}</p>
            <div className="flex items-center gap-2 font-mono text-xs text-white/40">
              <span className="uppercase text-white/30">Email</span>
              <a href="mailto:cybersecpro@semihkilic.com" className="truncate text-[var(--color-neon)] hover:underline">
                cybersecpro@semihkilic.com
              </a>
            </div>
            <span className="inline-block w-fit rounded-full border border-[var(--color-neon)]/15 bg-[var(--color-neon)]/[0.06] px-3 py-1 font-mono text-xs font-semibold text-[var(--color-neon)]">
              {t("partnerships.response")}
            </span>
            <a
              href="mailto:cybersecpro@semihkilic.com?subject=Partnership%20Inquiry"
              className="btn-primary mt-auto justify-center"
            >
              {t("partnerships.cta")} <ArrowRight size={14} />
            </a>
          </div>
        </RevealOnScroll>
      </section>

      {/* CTA */}
      <section className="pb-28 text-center">
        <RevealOnScroll>
          <div className="mx-auto max-w-xl rounded-2xl border border-[var(--color-neon)]/10 bg-[var(--color-neon)]/[0.02] p-10">
            <h2 className="text-2xl font-bold">{t("ctaSection.title")}</h2>
            <p className="mt-3 text-sm text-white/50">{t("ctaSection.subtitle")}</p>
            <Link href="/dashboard/login" className="btn-primary mt-6">
              {t("ctaSection.button")} <ArrowRight size={14} />
            </Link>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
