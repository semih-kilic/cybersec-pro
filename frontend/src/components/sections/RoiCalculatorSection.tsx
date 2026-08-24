"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingDown } from "lucide-react";

// Annual cost of the Professional plan (matches PricingSection: $99 × 12 → use
// the discounted yearly price $949 to be honest about what the user actually
// pays). Keep in sync with the i18n `pricing.plans.professional.priceYearly`.
const PRO_ANNUAL_USD = 949;

export default function RoiCalculatorSection() {
  const [pentestsPerYear, setPentestsPerYear] = useState(2);
  const [costPerPentest, setCostPerPentest] = useState(12000);

  const traditional = pentestsPerYear * costPerPentest;
  const savings = useMemo(() => Math.max(0, traditional - PRO_ANNUAL_USD), [traditional]);
  const reductionPct = useMemo(
    () => Math.min(100, Math.round((1 - PRO_ANNUAL_USD / Math.max(1, traditional)) * 100)),
    [traditional]
  );

  return (
    <section id="roi" className="relative py-24">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <span className="badge mb-4 inline-flex items-center gap-1.5">
            <Calculator size={12} /> ROI Calculator
          </span>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            See how much you save vs traditional pentests
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Drag the sliders to estimate your annual savings compared to hiring a
            traditional penetration testing firm.
          </p>
        </motion.div>

        <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Pentests per year
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={pentestsPerYear}
                onChange={(e) => setPentestsPerYear(Number(e.target.value))}
                className="w-full accent-[var(--color-neon)]"
                aria-label="Pentests per year"
              />
              <div className="mt-1 flex justify-between text-xs text-white/40">
                <span>1</span>
                <span className="font-mono text-sm font-bold text-[var(--color-neon)]">
                  {pentestsPerYear}
                </span>
                <span>6</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Average cost per pentest ($)
              </label>
              <input
                type="range"
                min={5000}
                max={25000}
                step={1000}
                value={costPerPentest}
                onChange={(e) => setCostPerPentest(Number(e.target.value))}
                className="w-full accent-[var(--color-neon)]"
                aria-label="Average cost per pentest"
              />
              <div className="mt-1 flex justify-between text-xs text-white/40">
                <span>$5K</span>
                <span className="font-mono text-sm font-bold text-[var(--color-neon)]">
                  ${costPerPentest.toLocaleString()}
                </span>
                <span>$25K</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-sm text-white/60">Traditional pentests</span>
              <span className="font-mono text-sm font-semibold text-rose-400">
                ${traditional.toLocaleString()}/yr
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <span className="text-sm text-white/60">CyberSec Pro (Professional)</span>
              <span className="font-mono text-sm font-semibold text-[var(--color-neon)]">
                ${PRO_ANNUAL_USD.toLocaleString()}/yr
              </span>
            </div>
            <div className="pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white">Your savings</span>
                <div className="text-right">
                  <span className="font-mono text-3xl font-extrabold text-[var(--color-neon)]">
                    ${savings.toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs text-white/40">/ year</span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--color-neon)] to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${reductionPct}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                <TrendingDown size={12} /> {reductionPct}% cost reduction
              </p>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-white/40">
              Plus continuous monitoring, automated scans, and real-time alerts —
              not just point-in-time testing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
