"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Quote } from "lucide-react";

const testimonials = [
  { name: "Alex M.", role: "Penetration Tester", text: "CyberSec Pro replaced our entire tool chain. Having 401 tools in the browser is a game changer.", avatar: "A" },
  { name: "Sarah K.", role: "Security Lead, FinTech", text: "The automated scanning and professional reports saved us 20+ hours per week. Enterprise plan is worth every cent.", avatar: "S" },
  { name: "James L.", role: "Bug Bounty Hunter", text: "I use CyberSec Pro daily for my bounty hunting. The real-time results and API integration are incredible.", avatar: "J" },
  { name: "Maria G.", role: "CISO, Healthcare", text: "Compliance-ready reports and SOC 2 alignment made this an easy choice for our security program.", avatar: "M" },
];

export default function TestimonialsSection() {
  const t = useTranslations("testimonials");

  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll className="section-heading mb-16">
          <span className="badge mb-4">{t("badge")}</span>
          <h2>{t("title")}</h2>
        </RevealOnScroll>

        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((t) => (
            <RevealOnScroll key={t.name}>
              <div className="glass-card flex flex-col gap-4 p-8">
                <Quote size={24} className="text-[var(--color-neon)]/30" />
                <p className="text-sm leading-relaxed text-white/60">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-auto flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-neon)]/10 font-mono text-sm font-bold text-[var(--color-neon)]">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.role}</div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
