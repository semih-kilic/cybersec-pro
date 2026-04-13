"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Check, Star } from "lucide-react";

const planKeys = ["trial", "starter", "professional", "enterprise"] as const;

export default function PricingSection() {
  const t = useTranslations("pricing");
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">{t("subtitle")}</p>
        </RevealOnScroll>

        {/* Toggle */}
        <div className="mb-16 flex items-center justify-center gap-3">
          <span className={`text-sm ${!annual ? "text-white" : "text-white/40"}`}>{t("monthly")}</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative h-7 w-12 rounded-full border border-white/10 bg-white/5 transition"
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-[var(--color-neon)] transition-all ${
                annual ? "left-[calc(100%-1.625rem)]" : "left-0.5"
              }`}
            />
          </button>
          <span className={`text-sm ${annual ? "text-white" : "text-white/40"}`}>
            {t("annual")} <span className="text-[var(--color-neon)]">{t("annualSave")}</span>
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planKeys.map((key) => {
            const features: string[] = t.raw(`plans.${key}.features`);
            const isPopular = key === "professional";
            return (
              <RevealOnScroll key={key} className="h-full">
                <div
                  className={`neon-border-card relative flex h-full flex-col p-8 ${
                    isPopular ? "!border-[var(--color-neon)]/40 !shadow-[0_0_40px_rgba(159,239,0,0.12)]" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1 rounded-full bg-[var(--color-neon)] px-3 py-1 text-xs font-bold text-[var(--color-bg)]">
                        <Star size={12} /> {t("popular")}
                      </span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white">{t(`plans.${key}.name`)}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-extrabold text-[var(--color-neon)]">
                      {t(`plans.${key}.price`)}
                    </span>
                    <span className="text-sm text-white/40">{t(`plans.${key}.period`)}</span>
                  </div>
                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {features.map((f: string) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/55">
                        <Check size={14} className="shrink-0 text-[var(--color-neon)]" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`mt-8 w-full rounded-xl py-3 font-mono text-sm font-bold transition-all ${
                      isPopular
                        ? "bg-[var(--color-neon)] text-[var(--color-bg)] hover:shadow-[0_0_30px_var(--color-neon-glow)]"
                        : "border border-white/10 text-white/70 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
                    }`}
                    onClick={() => {
                      fetch("/api/create-checkout-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          plan: key,
                          billing: annual ? "annual" : "monthly",
                          success_url: `${window.location.origin}/dashboard/settings?tab=billing&success=true`,
                          cancel_url: window.location.href,
                        }),
                      })
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.url || d.checkout_url) window.location.href = d.url || d.checkout_url;
                          else window.location.href = "/dashboard/login";
                        })
                        .catch(() => (window.location.href = "/dashboard/login"));
                    }}
                  >
                    {t("cta")}
                  </button>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
