"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Clock, ArrowRight } from "lucide-react";

const posts = [
  { title: "Getting Started with Nmap: A Complete Guide", category: "Tools", readTime: 8, excerpt: "Learn how to perform comprehensive network scans using Nmap's most powerful features." },
  { title: "OWASP Top 10 in 2026: What's Changed", category: "Security", readTime: 12, excerpt: "An updated look at the most critical web application security risks and how to mitigate them." },
  { title: "Automating Penetration Tests with CI/CD", category: "DevSecOps", readTime: 10, excerpt: "Integrate security testing into your development pipeline with CyberSec Pro's API." },
  { title: "SQL Injection: From Detection to Exploitation", category: "Tutorials", readTime: 15, excerpt: "A hands-on guide to finding and exploiting SQL injection vulnerabilities responsibly." },
  { title: "Building a Home Lab for Security Testing", category: "Guides", readTime: 7, excerpt: "Set up your own security testing environment using VMs and containerized tools." },
  { title: "Wireless Security Assessment Best Practices", category: "Wireless", readTime: 9, excerpt: "Comprehensive guide to testing Wi-Fi network security using aircrack-ng and related tools." },
];

export default function BlogPage() {
  const t = useTranslations("blog");

  return (
    <>
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-28 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <RevealOnScroll key={post.title}>
            <div className="glass-card flex h-full flex-col gap-4 p-6">
              <span className="w-fit rounded-full bg-[var(--color-neon)]/[0.06] px-3 py-1 text-xs font-semibold text-[var(--color-neon)]">{post.category}</span>
              <h3 className="text-lg font-bold text-white">{post.title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{post.excerpt}</p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="flex items-center gap-1 text-xs text-white/30">
                  <Clock size={12} /> {post.readTime} {t("minRead")}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-neon)] hover:underline cursor-pointer">
                  {t("readMore")} <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </RevealOnScroll>
        ))}
      </section>
    </>
  );
}
