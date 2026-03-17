"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Scan, Wrench, FileText, Radio, Code2, Users } from "lucide-react";

const icons = [Scan, Wrench, FileText, Radio, Code2, Users];
const keys = ["scanning", "tools", "reports", "realtime", "api", "team"] as const;
const colors = ["var(--color-neon)", "var(--color-cyan)", "var(--color-purple)", "var(--color-orange)", "var(--color-neon)", "var(--color-cyan)"];

export default function FeaturesSection() {
  const t = useTranslations("features");

  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll className="section-heading mb-16">
          <span className="badge mb-4">{t("badge")}</span>
          <h2 className="whitespace-pre-line">{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </RevealOnScroll>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <RevealOnScroll key={key}>
                <div className="glass-card flex flex-col gap-4 p-8">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: `${colors[i]}15`, color: colors[i] }}
                  >
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t(`items.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{t(`items.${key}.description`)}</p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
