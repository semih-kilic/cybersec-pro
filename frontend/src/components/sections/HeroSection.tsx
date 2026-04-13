"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Cloud } from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";
import MatrixRain from "@/components/three/MatrixRain";

const CyberAttackGlobe = dynamic(() => import("@/components/three/CyberAttackGlobe"), { ssr: false });

/* ─── Animated Counter ─── */
function AnimCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    const num = parseInt(target.replace(/[^\d]/g, ""));
    if (isNaN(num)) { setDisplay(target); return; }
    const duration = 2000;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * num);
      setDisplay(current.toLocaleString() + suffix);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(target);
    };
    requestAnimationFrame(tick);
  }, [target, suffix]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !hasAnimated.current) { hasAnimated.current = true; animate(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate]);

  return <div ref={ref} className="font-mono text-3xl font-bold text-[var(--color-neon)]">{display}</div>;
}

/* ─── Typing Effect ─── */
function TypeWriter({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i <= text.length) { setDisplayed(text.slice(0, i)); i++; }
      else { clearInterval(iv); setTimeout(() => setShowCursor(false), 2000); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return <>{displayed}{showCursor && <span className="animate-pulse text-[var(--color-neon)]">|</span>}</>;
}

export default function HeroSection() {
  const t = useTranslations("hero");
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const yContent = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const stats = [
    { value: t("stats.tools"), label: t("stats.toolsLabel") },
    { value: t("stats.categories"), label: t("stats.categoriesLabel") },
    { value: t("stats.uptime"), label: t("stats.uptimeLabel") },
    { value: t("stats.scans"), label: t("stats.scansLabel") },
  ];

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden">
      <MatrixRain />
      <CyberAttackGlobe />

      <motion.div
        style={{ y: yContent, opacity: opacityContent }}
        className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 text-center"
      >
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, type: "spring", stiffness: 100 }}
          className="whitespace-pre-line text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-8xl"
        >
          <span className="hero-neon-title">
            {t("title")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl"
        >
          <TypeWriter text={t("subtitle")} speed={25} />
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-10"
        >
          <Link href="/dashboard/login" className="btn-primary group text-base">
            {t("cta")} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Stats bar with counter animation */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mt-20 grid w-full max-w-3xl grid-cols-2 gap-6 md:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <AnimCounter target={s.value} />
              <div className="mt-1 text-xs uppercase tracking-wider text-white/40">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
    </section>
  );
}
