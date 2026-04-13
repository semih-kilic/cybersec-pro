"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Scan, Wrench, FileText, Radio, Code2, Users } from "lucide-react";

const icons = [Scan, Wrench, FileText, Radio, Code2, Users];
const keys = ["scanning", "tools", "reports", "realtime", "api", "team"] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function FeaturesSection() {
  const t = useTranslations("features");

  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <motion.div key={key} variants={item}>
                <div className="neon-border-card group flex flex-col gap-4 p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-neon)]/10 transition-all duration-300 group-hover:bg-[var(--color-neon)]/20 group-hover:shadow-[0_0_20px_rgba(159,239,0,0.15)]">
                    <Icon size={24} className="text-[var(--color-neon)] transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t(`items.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{t(`items.${key}.description`)}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
