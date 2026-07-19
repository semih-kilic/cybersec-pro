"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import GlitchText from "@/components/animations/GlitchText";
import { Heart, Coffee, Github, DollarSign, Gift, ExternalLink } from "lucide-react";

const CyberScene = dynamic(() => import("@/components/three/CyberScene"), { ssr: false });

const donationPlatforms = [
  {
    id: "buymeacoffee",
    icon: Coffee,
    name: "Buy Me a Coffee",
    url: "https://buymeacoffee.com/semihkilic",
    color: "#FFDD00",
    description: "buymeacoffeeDesc",
  },
  {
    id: "github",
    icon: Github,
    name: "GitHub Sponsors",
    url: "https://github.com/sponsors/semih-kilic",
    color: "#9fef00",
    description: "githubDesc",
  },
  {
    id: "kofi",
    icon: Heart,
    name: "Ko-fi",
    url: "https://ko-fi.com/semihkilic",
    color: "#FF5E5B",
    description: "kofiDesc",
  },
  {
    id: "stripe",
    icon: Gift,
    name: "Stripe",
    url: "https://buy.stripe.com/4gM28jfEx3dhcuVbeibo400",
    color: "#635BFF",
    description: "stripeDesc",
  },
];

export default function DonatePage() {
  const t = useTranslations("donate");

  return (
    <main className="relative min-h-screen bg-[var(--color-bg)] pt-24 pb-20">
      <CyberScene />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <RevealOnScroll>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-neon)]/20 bg-[var(--color-neon)]/5 px-4 py-1.5 text-xs font-medium text-[var(--color-neon)]">
            <Heart size={14} />
            {t("badge")}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            <GlitchText text={t("title")} />
          </h1>
        </RevealOnScroll>

        <RevealOnScroll>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
            {t("subtitle")}
          </p>
        </RevealOnScroll>
      </section>

      {/* Story */}
      <section className="relative z-10 mx-auto mt-16 max-w-3xl px-6">
        <RevealOnScroll>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-neon)]/10">
                <Gift size={20} className="text-[var(--color-neon)]" />
              </div>
              <h2 className="text-xl font-bold text-white">{t("storyTitle")}</h2>
            </div>
            <p className="text-sm leading-relaxed text-white/50">
              {t("storyText")}
            </p>
          </div>
        </RevealOnScroll>
      </section>

      {/* Donation Platforms */}
      <section className="relative z-10 mx-auto mt-16 max-w-5xl px-6">
        <RevealOnScroll>
          <h2 className="mb-8 text-center text-2xl font-bold text-white">{t("platformsTitle")}</h2>
        </RevealOnScroll>

        <div className="grid gap-6 sm:grid-cols-2">
          {donationPlatforms.map((platform, i) => (
            <RevealOnScroll key={platform.id}>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${platform.color}15` }}
                >
                  <platform.icon size={24} style={{ color: platform.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{platform.name}</h3>
                    <ExternalLink size={14} className="text-white/30 transition-colors group-hover:text-[var(--color-neon)]" />
                  </div>
                  <p className="mt-1 text-sm text-white/40">{t(platform.description)}</p>
                </div>
              </a>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 mx-auto mt-20 max-w-2xl px-6 text-center">
        <RevealOnScroll>
          <p className="text-sm text-white/30">{t("thankYou")}</p>
        </RevealOnScroll>
      </section>
    </main>
  );
}
