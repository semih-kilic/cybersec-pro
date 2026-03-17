"use client";

import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { CheckCircle, BookOpen, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function SuccessPage() {
  const t = useTranslations("success");

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6 pt-32 pb-28">
      <RevealOnScroll>
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[--color-neon]/15">
            <CheckCircle className="h-10 w-10 text-[--color-neon]" />
          </div>
          <h1 className="text-4xl font-extrabold md:text-5xl">{t("title")}</h1>
          <p className="mt-4 text-lg text-white/55">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              {t("dashboard")}
            </Link>
            <Link href="/docs" className="btn-outline inline-flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t("docs")}
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
