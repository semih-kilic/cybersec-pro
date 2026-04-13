"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Scan, Wrench, FileText, Radio, Code2, Users } from "lucide-react";

const icons = [Scan, Wrench, FileText, Radio, Code2, Users];
const keys = ["scanning", "tools", "reports", "realtime", "api", "team"] as const;

export default function FeaturesSection() {
  const t = useTranslations("features");

  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <RevealOnScroll key={key}>
                <div className="neon-border-card flex flex-col gap-4 p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-neon)]/10">
                    <Icon size={24} className="text-[var(--color-neon)]" />
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
