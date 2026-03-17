"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { MapPin, Briefcase, Laptop, Coins, GraduationCap, Monitor } from "lucide-react";

const jobs = [
  { title: "Senior Rust Backend Engineer", location: "Remote", type: "Full-time", description: "Build high-performance security scanning infrastructure with Axum and Tokio." },
  { title: "Frontend Engineer (React/Next.js)", location: "Remote", type: "Full-time", description: "Create beautiful, performant interfaces for security professionals worldwide." },
  { title: "Security Researcher", location: "Remote", type: "Full-time", description: "Research vulnerabilities, develop new scanning techniques, and improve our tool integrations." },
  { title: "DevOps / SRE Engineer", location: "Remote", type: "Full-time", description: "Scale our infrastructure to handle millions of security scans with zero downtime." },
];

const perks = [
  { icon: Laptop, label: "remote" },
  { icon: Coins, label: "equity" },
  { icon: GraduationCap, label: "learning" },
  { icon: Monitor, label: "hardware" },
];

export default function CareersPage() {
  const t = useTranslations("careers");

  return (
    <>
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="whitespace-pre-line text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Perks */}
      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-6 pb-16 md:grid-cols-4">
        {perks.map(({ icon: Icon, label }) => (
          <RevealOnScroll key={label}>
            <div className="glass-card flex flex-col items-center gap-3 p-6 text-center">
              <Icon size={28} className="text-[var(--color-neon)]" />
              <span className="text-sm font-semibold text-white">{t(`perks.${label}`)}</span>
            </div>
          </RevealOnScroll>
        ))}
      </section>

      {/* Open Positions */}
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <RevealOnScroll>
          <h2 className="mb-8 text-2xl font-bold">{t("openPositions")}</h2>
        </RevealOnScroll>
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <RevealOnScroll key={job.title}>
              <div className="glass-card flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{job.title}</h3>
                  <p className="mt-1 text-sm text-white/50">{job.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                    <span className="flex items-center gap-1"><Briefcase size={12} /> {job.type}</span>
                  </div>
                </div>
                <a href="mailto:cybersecpro@semihkilic.com?subject=Application:%20{job.title}" className="btn-primary mt-3 justify-center text-xs md:mt-0">
                  {t("apply")}
                </a>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>
    </>
  );
}
