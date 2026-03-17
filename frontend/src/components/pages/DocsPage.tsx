"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { BookOpen, Rocket, Code2, FileText, Shield, Settings } from "lucide-react";

const docCards = [
  { icon: Rocket, title: "Quick Start Guide", description: "Get up and running in 5 minutes. Create your first scan and generate a report.", color: "var(--color-neon)" },
  { icon: Shield, title: "Scanning & Assessment", description: "Configure scan targets, select tools, customize parameters, and interpret results.", color: "var(--color-cyan)" },
  { icon: Code2, title: "API Integration", description: "RESTful API documentation with examples for automation and CI/CD integration.", color: "var(--color-purple)" },
  { icon: FileText, title: "Reports & Templates", description: "Generate professional reports in PDF, HTML, JSON, CSV, and Markdown formats.", color: "var(--color-orange)" },
  { icon: Settings, title: "Configuration", description: "Advanced settings, environment variables, team management, and security options.", color: "var(--color-neon)" },
  { icon: BookOpen, title: "Tool Reference", description: "Detailed documentation for all 401 security tools with usage examples and parameters.", color: "var(--color-cyan)" },
];

export default function DocsPage() {
  const t = useTranslations("docs");

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
        {docCards.map((card) => {
          const Icon = card.icon;
          return (
            <RevealOnScroll key={card.title}>
              <div className="glass-card flex flex-col gap-4 p-8 cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${card.color}15`, color: card.color }}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{card.description}</p>
              </div>
            </RevealOnScroll>
          );
        })}
      </section>
    </>
  );
}
