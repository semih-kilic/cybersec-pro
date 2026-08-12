"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

export default function SampleReportsSection() {
  const t = useTranslations("sampleReports");

  return (
    <section className="relative py-28 bg-white/5">
      <div className="mx-auto max-w-5xl px-6">
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto"
        >
          <div className="neon-border-card p-8 text-center">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-xl font-bold text-white">{t("technical.title")}</h3>
            <p className="mt-2 text-sm text-white/50">{t("technical.description")}</p>
            <button className="mt-6 rounded-xl border border-white/10 px-6 py-2 font-mono text-sm text-white/70 transition hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]">
              {t("technical.cta")}
            </button>
          </div>
          <div className="neon-border-card p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white">{t("executive.title")}</h3>
            <p className="mt-2 text-sm text-white/50">{t("executive.description")}</p>
            <button className="mt-6 rounded-xl border border-white/10 px-6 py-2 font-mono text-sm text-white/70 transition hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]">
              {t("executive.cta")}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
