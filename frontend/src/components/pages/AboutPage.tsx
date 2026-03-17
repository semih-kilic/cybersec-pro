"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import GlitchText from "@/components/animations/GlitchText";
import { Target, BookOpen, User } from "lucide-react";

const ParticleField = dynamic(() => import("@/components/three/ParticleField"), { ssr: false });

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <>
      <ParticleField />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="whitespace-pre-line text-4xl font-extrabold md:text-6xl">
            <GlitchText text={t("title")} />
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-20 md:grid-cols-2">
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <Target size={28} className="text-[var(--color-neon)]" />
            <h3 className="text-xl font-bold">{t("mission.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("mission.description")}</p>
          </div>
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="glass-card flex flex-col gap-4 p-8">
            <BookOpen size={28} className="text-[var(--color-cyan)]" />
            <h3 className="text-xl font-bold">{t("story.title")}</h3>
            <p className="text-sm leading-relaxed text-white/50">{t("story.description")}</p>
          </div>
        </RevealOnScroll>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-28">
        <RevealOnScroll>
          <div className="section-heading mb-12">
            <h2>{t("team.title")}</h2>
          </div>
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="glass-card mx-auto max-w-md p-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-neon)]/10">
              <User size={36} className="text-[var(--color-neon)]" />
            </div>
            <h3 className="text-xl font-bold">{t("team.founder.name")}</h3>
            <p className="font-mono text-sm text-[var(--color-neon)]">{t("team.founder.role")}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{t("team.founder.bio")}</p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
