"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");

  return (
    <footer className="border-t border-white/5 bg-[var(--color-bg)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold text-white">
              <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
                <rect width="26" height="26" rx="3" fill="#9fef00" />
                <path d="M7.5 13l3 3 8-8" stroke="#0a0e14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              CyberSec Pro
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/40">{t("description")}</p>
          </div>

          {/* Platform */}
          <div>
            <h5 className="mb-3 text-sm font-semibold text-white/80">{t("platform")}</h5>
            <div className="flex flex-col gap-2">
              <Link href="/#features" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("features")}</Link>
              <Link href="/tools" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("arsenal")}</Link>
              <Link href="/#pricing" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("pricing")}</Link>
              <Link href="/docs" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("docs")}</Link>
              <Link href="/api-reference" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("api")}</Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h5 className="mb-3 text-sm font-semibold text-white/80">{t("company")}</h5>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("about")}</Link>
              <Link href="/blog" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("blog")}</Link>
              <Link href="/careers" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("careers")}</Link>
              <Link href="/contact" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{nav("contact")}</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h5 className="mb-3 text-sm font-semibold text-white/80">{t("legal")}</h5>
            <div className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{t("privacyPolicy")}</Link>
              <Link href="/terms" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{t("termsOfService")}</Link>
              <a href="mailto:cybersecpro@semihkilic.com" className="text-sm text-white/40 hover:text-[var(--color-neon)]">{t("support")}</a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <span className="text-xs text-white/30">{t("copyright")}</span>
          <span className="font-mono text-xs text-white/30">cybersecpro@semihkilic.com</span>
        </div>
      </div>
    </footer>
  );
}
