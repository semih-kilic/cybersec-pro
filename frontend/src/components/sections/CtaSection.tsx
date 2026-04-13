"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CtaSection() {
  const t = useTranslations("cta");

  return (
    <section className="relative overflow-hidden py-28">
      {/* Circuit board background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(159,239,0,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(159,239,0,0.08) 1px, transparent 1px),
              radial-gradient(circle at 25% 50%, rgba(159,239,0,0.06) 0%, transparent 50%),
              radial-gradient(circle at 75% 50%, rgba(159,239,0,0.04) 0%, transparent 50%)
            `,
            backgroundSize: "60px 60px, 60px 60px, 100% 100%, 100% 100%",
          }}
        />
      </div>
      {/* Top/bottom gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--color-bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl"
        >
          {t("title")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-4 max-w-md text-white/50"
        >
          {t("subtitle")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8"
        >
          <Link href="/dashboard/login" className="btn-primary text-base">
            {t("button")} <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
