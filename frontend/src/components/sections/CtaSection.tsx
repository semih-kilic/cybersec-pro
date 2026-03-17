"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CtaSection() {
  const t = useTranslations("cta");

  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-[var(--color-neon)]/10 bg-[var(--color-neon)]/[0.02] p-12 text-center"
        >
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">{t("title")}</h2>
          <p className="mx-auto mt-4 max-w-md text-white/50">{t("subtitle")}</p>
          <div className="mt-8">
            <Link href="/dashboard/login" className="btn-primary text-base">
              {t("button")} <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
