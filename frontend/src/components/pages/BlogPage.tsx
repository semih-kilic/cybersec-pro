"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import Link from "next/link";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
const MatrixRain = dynamic(() => import("@/components/three/MatrixRain"), { ssr: false });
import { Clock, ArrowRight, Mail } from "lucide-react";

type Category = "All" | "Tools" | "Security" | "DevSecOps" | "Tutorials" | "Guides" | "Wireless";

const categories: Category[] = ["All", "Tools", "Security", "DevSecOps", "Tutorials", "Guides", "Wireless"];

const categoryColors: Record<string, string> = {
  Tools: "var(--color-neon)",
  Security: "var(--color-cyan)",
  DevSecOps: "var(--color-purple)",
  Tutorials: "var(--color-orange)",
  Guides: "#ef476f",
  Wireless: "#ffd166",
};

const posts = [
  { slug: "mastering-wireshark", title: "Mastering Wireshark: Network Traffic Analysis Deep Dive", category: "Tools" as Category, readTime: 12, date: "Jan 15, 2026", featured: true, excerpt: "Advanced packet capture and analysis techniques — from protocol dissection to identifying malicious traffic patterns in real-time." },
  { slug: "hashcat-vs-john", title: "Hashcat vs John the Ripper: Password Cracking Compared", category: "Tools" as Category, readTime: 10, date: "Jan 12, 2026", featured: true, excerpt: "GPU-accelerated password recovery showdown. Benchmarks, rule-based attacks, and choosing the right tool for the job." },
  { slug: "nmap-complete-guide", title: "Getting Started with Nmap: A Complete Guide", category: "Tools" as Category, readTime: 8, date: "Jan 10, 2026", excerpt: "Learn how to perform comprehensive network scans using Nmap's most powerful features — from host discovery to NSE scripting." },
  { slug: "owasp-top-10-2026", title: "OWASP Top 10 in 2026: What's Changed", category: "Security" as Category, readTime: 12, date: "Jan 8, 2026", excerpt: "An updated look at the most critical web application security risks and how to mitigate them with modern tools." },
  { slug: "metasploit-zero-to-exploit", title: "Metasploit Framework: From Zero to Exploit", category: "Tutorials" as Category, readTime: 15, date: "Jan 5, 2026", featured: true, excerpt: "Hands-on walkthrough of the Metasploit Framework — modules, payloads, encoders, and post-exploitation techniques." },
  { slug: "ci-cd-pentest-automation", title: "Automating Penetration Tests with CI/CD", category: "DevSecOps" as Category, readTime: 10, date: "Jan 3, 2026", excerpt: "Integrate security testing into your development pipeline with CyberSec Pro's API and GitHub Actions." },
  { slug: "burp-suite-masterclass", title: "Burp Suite Professional: Web App Testing Masterclass", category: "Tutorials" as Category, readTime: 14, date: "Dec 28, 2025", excerpt: "Complete guide to intercepting proxies, active scanning, and extending Burp with custom extensions for targeted assessments." },
  { slug: "sql-injection-guide", title: "SQL Injection: From Detection to Exploitation", category: "Tutorials" as Category, readTime: 15, date: "Dec 22, 2025", excerpt: "A hands-on guide to finding and exploiting SQL injection vulnerabilities responsibly — union-based, blind, and time-based techniques." },
  { slug: "home-lab-setup", title: "Building a Home Lab for Security Testing", category: "Guides" as Category, readTime: 7, date: "Dec 18, 2025", excerpt: "Set up your own security testing environment using VMs, Docker, and vulnerable-by-design applications like DVWA and HackTheBox." },
  { slug: "wireless-security-assessment", title: "Wireless Security Assessment Best Practices", category: "Wireless" as Category, readTime: 9, date: "Dec 15, 2025", excerpt: "Comprehensive guide to testing Wi-Fi network security using aircrack-ng, wifite, and bettercap — WPA2/WPA3 coverage." },
];

const INITIAL_COUNT = 6;

export default function BlogPage() {
  const t = useTranslations("blog");
  const locale = useLocale();
  const [activeFilter, setActiveFilter] = useState<Category>("All");
  const [showAll, setShowAll] = useState(false);

  const filtered = activeFilter === "All" ? posts : posts.filter((p) => p.category === activeFilter);
  const featured = posts.filter((p) => p.featured);
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);

  return (
    <>
      <MatrixRain />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Featured Articles */}
      {activeFilter === "All" && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <RevealOnScroll>
            <h2 className="mb-6 text-xl font-bold text-white">Featured Articles</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {featured.map((post) => (
                <Link href={`/${locale}/blog/${post.slug}`} key={post.slug} className="glass-card p-6 border-[var(--color-neon)]/10 hover:border-[var(--color-neon)]/30 transition cursor-pointer block">
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: `${categoryColors[post.category]}20`, color: categoryColors[post.category] }}>
                    {post.category}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-white leading-snug">{post.title}</h3>
                  <p className="mt-2 text-xs text-white/40 line-clamp-2">{post.excerpt}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-white/30">
                    <span>{post.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {post.readTime} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </RevealOnScroll>
        </section>
      )}

      {/* Category Filter */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveFilter(cat); setShowAll(false); }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeFilter === cat
                  ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                  : "border border-white/10 text-white/40 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Articles Grid */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((post) => (
          <RevealOnScroll key={post.slug}>
            <Link href={`/${locale}/blog/${post.slug}`} className="glass-card flex h-full flex-col gap-4 p-6 cursor-pointer hover:border-white/10 transition block">
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: `${categoryColors[post.category]}20`, color: categoryColors[post.category] }}>
                  {post.category}
                </span>
                <span className="text-[11px] text-white/25">{post.date}</span>
              </div>
              <h3 className="text-lg font-bold text-white">{post.title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{post.excerpt}</p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="flex items-center gap-1 text-xs text-white/30">
                  <Clock size={12} /> {post.readTime} {t("minRead")}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-neon)] hover:underline">
                  {t("readMore")} <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          </RevealOnScroll>
        ))}
      </section>

      {/* Load More */}
      {!showAll && filtered.length > INITIAL_COUNT && (
        <div className="text-center pb-12">
          <button onClick={() => setShowAll(true)} className="btn-primary text-sm">
            Load More Articles ({filtered.length - INITIAL_COUNT} remaining)
          </button>
        </div>
      )}

      {/* Newsletter */}
      <section className="mx-auto max-w-2xl px-6 pb-28">
        <RevealOnScroll>
          <div className="glass-card p-8 text-center border-[var(--color-neon)]/20">
            <Mail size={32} className="mx-auto text-[var(--color-neon)] mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Stay Updated</h2>
            <p className="text-sm text-white/50 mb-6">Get the latest cybersecurity insights, tool guides, and platform updates delivered to your inbox.</p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-neon)]/50"
              />
              <button className="btn-primary text-sm whitespace-nowrap">Subscribe</button>
            </div>
            <p className="mt-3 text-[11px] text-white/25">No spam. Unsubscribe anytime. We respect your privacy.</p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
