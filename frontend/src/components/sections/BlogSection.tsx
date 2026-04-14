"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Shield, Bug, Terminal, Wifi, Server, Code2 } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

const CATEGORY_COLORS: Record<string, string> = {
  Tools: "#9fef00",
  Security: "#00d4ff",
  DevSecOps: "#b44aff",
  Tutorials: "#ff6600",
  Guides: "#ef476f",
  Wireless: "#ffd166",
};

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Tools: Terminal,
  Security: Shield,
  DevSecOps: Code2,
  Tutorials: Bug,
  Guides: Server,
  Wireless: Wifi,
};

const POSTS = [
  {
    slug: "mastering-wireshark",
    title: "Mastering Wireshark: Network Traffic Analysis Deep Dive",
    category: "Tools",
    readTime: 12,
    date: "2026-01-15",
    excerpt: "Advanced packet capture and analysis techniques — from protocol dissection to identifying malicious traffic patterns in real-time.",
  },
  {
    slug: "hashcat-vs-john",
    title: "Hashcat vs John the Ripper: Password Cracking Compared",
    category: "Tools",
    readTime: 10,
    date: "2026-01-12",
    excerpt: "GPU-accelerated password recovery showdown. Benchmarks, rule-based attacks, and choosing the right tool for the job.",
  },
  {
    slug: "owasp-top-10-2026",
    title: "OWASP Top 10 in 2026: What's Changed",
    category: "Security",
    readTime: 12,
    date: "2026-01-08",
    excerpt: "An updated look at the most critical web application security risks and how to mitigate them with modern tools.",
  },
  {
    slug: "metasploit-zero-to-exploit",
    title: "Metasploit Framework: From Zero to Exploit",
    category: "Tutorials",
    readTime: 15,
    date: "2026-01-05",
    excerpt: "Hands-on walkthrough of the Metasploit Framework — modules, payloads, encoders, and post-exploitation techniques.",
  },
  {
    slug: "ci-cd-pentest-automation",
    title: "Automating Penetration Tests with CI/CD",
    category: "DevSecOps",
    readTime: 10,
    date: "2026-01-03",
    excerpt: "Integrate security testing into your development pipeline with CyberSec Pro's API and GitHub Actions.",
  },
  {
    slug: "wireless-security-assessment",
    title: "Wireless Security Assessment Best Practices",
    category: "Wireless",
    readTime: 9,
    date: "2025-12-15",
    excerpt: "Comprehensive guide to testing Wi-Fi network security using aircrack-ng, wifite, and bettercap.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const card = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogSection() {
  const t = useTranslations("blogSection");
  const locale = useLocale();

  return (
    <section id="blog" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <span className="badge mb-4 inline-block">{t("badge")}</span>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {POSTS.map((post) => {
            const color = CATEGORY_COLORS[post.category] || "#9fef00";
            const Icon = CATEGORY_ICONS[post.category] || Shield;
            return (
              <motion.article key={post.slug} variants={card}>
                <Link href={`/${locale}/blog/${post.slug}`} className="block h-full">
                <div className="neon-border-card group flex h-full flex-col p-6 transition-all duration-300 hover:translate-y-[-2px]">
                  {/* Category + date row */}
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: `${color}15`, color }}
                    >
                      <Icon size={12} />
                      {post.category}
                    </span>
                    <span className="text-[11px] text-white/30">{formatDate(post.date, locale)}</span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-3 text-[15px] font-bold leading-snug text-white transition-colors group-hover:text-[var(--color-neon)]">
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="mb-4 flex-1 text-[13px] leading-relaxed text-white/40 line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="flex items-center gap-1 text-[11px] text-white/30">
                      <Clock size={11} /> {post.readTime} {t("minRead")}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-neon)] opacity-0 transition-opacity group-hover:opacity-100">
                      {t("readMore")} <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
                </Link>
              </motion.article>
            );
          })}
        </motion.div>

        {/* View All link */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-mono text-sm font-medium text-white/60 transition-all hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
          >
            {t("viewAll")} <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
