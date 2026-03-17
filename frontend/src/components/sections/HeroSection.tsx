"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import MatrixRain from "@/components/three/MatrixRain";

const CyberScene = dynamic(() => import("@/components/three/CyberScene"), { ssr: false });

export default function HeroSection() {
  const t = useTranslations("hero");

  const stats = [
    { value: t("stats.tools"), label: t("stats.toolsLabel") },
    { value: t("stats.categories"), label: t("stats.categoriesLabel") },
    { value: t("stats.uptime"), label: t("stats.uptimeLabel") },
    { value: t("stats.scans"), label: t("stats.scansLabel") },
  ];

  return (
    <section className="relative min-h-screen overflow-hidden">
      <MatrixRain />
      <CyberScene />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="badge mb-6"
        >
          <Shield size={14} className="mr-1 inline" />
          {t("badge")}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-8xl"
        >
          <span className="neon-text">{t("titleHighlight")}</span>
          <br />
          <span className="whitespace-pre-line bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            {t("title")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl"
        >
          {t("subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/dashboard/login" className="btn-primary text-base">
            {t("cta")} <ArrowRight size={16} />
          </Link>
          <Link href="/tools" className="btn-outline text-base">
            {t("ctaSecondary")}
          </Link>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid w-full max-w-3xl grid-cols-2 gap-6 md:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-mono text-3xl font-bold text-[var(--color-neon)]">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-white/40">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
    </section>
  );
}
