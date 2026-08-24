"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Star, ChevronDown, Crown } from "lucide-react";

const planKeys = ["trial", "starter", "professional", "enterprise"] as const;

/** Number of features to show before collapsing behind "Read more" */
const VISIBLE_LIMIT = 5;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

function PricingCard({
  planKey,
  annual,
  t,
}: {
  planKey: (typeof planKeys)[number];
  annual: boolean;
  t: ReturnType<typeof useTranslations<"pricing">>;
}) {
  const features: string[] = t.raw(`plans.${planKey}.features`);
  const isPopular = planKey === "professional";
  const needsCollapse = features.length > VISIBLE_LIMIT;
  const [expanded, setExpanded] = useState(false);

  const baseFeatures = features.slice(0, VISIBLE_LIMIT);
  const extraFeatures = features.slice(VISIBLE_LIMIT);
  const hiddenCount = extraFeatures.length;

  return (
    <div
      className={`neon-border-card group relative flex h-full flex-col p-8 ${
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
      <h3 className="text-lg font-bold text-white">{t(`plans.${planKey}.name`)}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-mono text-4xl font-extrabold text-[var(--color-neon)]">
          {annual && planKey !== "trial"
            ? t(`plans.${planKey}.priceYearly`)
            : t(`plans.${planKey}.price`)}
        </span>
        <span className="text-sm text-white/40">
          {annual && planKey !== "trial"
            ? t(`plans.${planKey}.periodYearly`)
            : t(`plans.${planKey}.period`)}
        </span>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <ul className="flex flex-col gap-3">
          {baseFeatures.map((f: string) => (
            <li key={f} className="flex items-center gap-2 text-sm text-white/55">
              <Check size={14} className="shrink-0 text-[var(--color-neon)]" /> {f}
            </li>
          ))}
        </ul>

        {/* Collapsed extra features with smooth animation */}
        <AnimatePresence initial={false}>
          {needsCollapse && expanded && (
            <motion.div
              key="extra-features"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <ul className="mt-3 flex flex-col gap-3">
                {extraFeatures.map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/55">
                    <Check size={14} className="shrink-0 text-[var(--color-neon)]" /> {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Read more / Show less toggle */}
        {needsCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-4 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[var(--color-neon)] transition-opacity hover:opacity-80"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded
              ? (t.has("showLess") ? t("showLess") : "Show less")
              : `${t.has("readMore") ? t("readMore") : "Read more"} (+${hiddenCount})`}
          </button>
        )}
      </div>

      <button
        className={`mt-8 w-full rounded-xl py-3 font-mono text-sm font-bold transition-all ${
          isPopular
            ? "bg-[var(--color-neon)] text-[var(--color-bg)] hover:shadow-[0_0_30px_var(--color-neon-glow)]"
            : "border border-white/10 text-white/70 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
        }`}
        onClick={() => {
          if (planKey === "trial") {
            window.location.href = "https://app.cyber-sec-pro.com/register";
            return;
          }
          fetch("/api/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: planKey,
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
  );
}

export default function PricingSection() {
  const t = useTranslations("pricing");
  const [annual, setAnnual] = useState(false);
  const [foundingLive, setFoundingLive] = useState(false);

  useEffect(() => {
    fetch("/api/v1/billing/founding-member/status")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.available) setFoundingLive(true);
      })
      .catch(() => {});
  }, []);

  return (
    <section id="pricing" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">{t("subtitle")}</p>
        </motion.div>

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

        {foundingLive && (
          <div className="mb-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--color-neon)]/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <Crown size={26} className="shrink-0 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {t.has("foundingTitle") ? t("foundingTitle") : "Founding Member — $19/mo lifetime"}
                </h3>
                <p className="text-xs text-white/55">
                  {t.has("foundingSub") ? t("foundingSub") : "First 10 members lock 81% off forever. Normal price: $99/mo."}
                </p>
              </div>
            </div>
            <a
              href="https://app.cyber-sec-pro.com/register?plan=founding_member"
              className="shrink-0 rounded-xl bg-[var(--color-neon)] px-6 py-3 font-mono text-sm font-bold text-[var(--color-bg)] transition hover:shadow-[0_0_30px_var(--color-neon-glow)]"
            >
              {t.has("foundingCta") ? t("foundingCta") : "Claim Founding Spot"}
            </a>
          </div>
        )}

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {planKeys.map((key) => (
            <motion.div key={key} variants={cardVariant} className="h-full">
              <PricingCard planKey={key} annual={annual} t={t} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
