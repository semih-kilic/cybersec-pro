"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowRight, Cloud } from "lucide-react";
import MatrixRain from "@/components/three/MatrixRain";

const CyberAttackGlobe = dynamic(() => import("@/components/three/CyberAttackGlobe"), { ssr: false });

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
      <CyberAttackGlobe />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="badge mb-6"
        >
          <Cloud size={14} className="mr-1 inline" />
          {t("badge")}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="whitespace-pre-line text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-8xl"
        >
          <span className="bg-gradient-to-b from-[var(--color-neon)] to-[var(--color-neon)]/60 bg-clip-text text-transparent drop-shadow-[0_0_30px_var(--color-neon-glow)]">
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
          className="mt-10"
        >
          <Link href="/dashboard/login" className="btn-primary text-base">
            {t("cta")} <ArrowRight size={16} />
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
