"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

export default function ComparisonSection() {
  const t = useTranslations("comparison");

  const rows = [
    { feature: t("rows.hardware.feature"), local: t("rows.hardware.local"), cloud: t("rows.hardware.cloud") },
    { feature: t("rows.setup.feature"), local: t("rows.setup.local"), cloud: t("rows.setup.cloud") },
    { feature: t("rows.reporting.feature"), local: t("rows.reporting.local"), cloud: t("rows.reporting.cloud") },
    { feature: t("rows.team.feature"), local: t("rows.team.local"), cloud: t("rows.team.cloud") },
    { feature: t("rows.cicd.feature"), local: t("rows.cicd.local"), cloud: t("rows.cicd.cloud") },
    { feature: t("rows.scheduled.feature"), local: t("rows.scheduled.local"), cloud: t("rows.scheduled.cloud") },
    { feature: t("rows.updates.feature"), local: t("rows.updates.local"), cloud: t("rows.updates.cloud") },
    { feature: t("rows.compliance.feature"), local: t("rows.compliance.local"), cloud: t("rows.compliance.cloud") },
  ];

  return (
    <section className="relative py-28">
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
          className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5"
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-6 text-sm font-medium text-white/60">{t("thead.feature")}</th>
                <th className="py-4 px-6 text-sm font-medium text-red-400 text-center">{t("thead.local")}</th>
                <th className="py-4 px-6 text-sm font-medium text-[var(--color-neon)] text-center">{t("thead.cloud")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row, i) => (
                <tr key={i} className="transition hover:bg-white/5">
                  <td className="py-4 px-6 text-sm font-medium text-white">{row.feature}</td>
                  <td className="py-4 px-6 text-sm text-white/50 text-center">{row.local}</td>
                  <td className="py-4 px-6 text-sm text-[var(--color-neon)] text-center font-medium">{row.cloud}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
