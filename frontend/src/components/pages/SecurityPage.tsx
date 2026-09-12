"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Lock, Server, Shield, Eye, KeyRound, RefreshCcw } from "lucide-react";

const CyberAttackGlobe = dynamic(() => import("@/components/three/CyberAttackGlobe"), { ssr: false });

// Icons only. The six cards used to carry hardcoded English strings that no
// locale translated and that four of them got wrong — "Enterprise plans get
// dedicated instances", "immutable logs with tamper detection", "export logs
// for compliance", "security patches applied within 24 hours … tool databases
// updated daily". None of that exists. They now render the first six entries
// of the Trust Center's own feature list, so the two pages cannot drift again
// and this page is translated in all ten locales for free.
const icons = [Lock, Server, Shield, Eye, KeyRound, RefreshCcw];
const colors = [
  "var(--color-neon)",
  "var(--color-cyan)",
  "var(--color-purple)",
  "var(--color-orange)",
  "var(--color-neon)",
  "var(--color-cyan)",
];

export default function SecurityPage() {
  const t = useTranslations("security");
  const tc = useTranslations("security.trustCenter.arrays.trustFeatures");
  const features = icons.map((icon, i) => ({
    icon,
    color: colors[i],
    title: tc(`${i}.title`),
    description: tc(`${i}.description`),
  }));

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
