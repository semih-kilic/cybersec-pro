"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  /** Prefix a path with the current locale */
  const lp = (path: string) => `/${locale}${path}`;

  const links = [
    { href: lp("/#features"), label: t("features") },
    { href: lp("/tools"), label: t("arsenal") },
    { href: lp("/#pricing"), label: t("pricing") },
    { href: lp("/docs"), label: t("docs") },
    { href: lp("/api-reference"), label: t("api") },
    { href: lp("/donate"), label: t("donate") },
  ];

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <Link href={lp("/")} className="flex items-center gap-2 font-bold text-white">
          <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
            <rect width="26" height="26" rx="3" fill="#9fef00" />
            <path d="M7.5 13l3 3 8-8" stroke="#0a0e14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CyberSec Pro
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/60 transition-colors hover:text-[var(--color-neon)]"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Link href="/dashboard/login" className="font-mono text-sm text-[var(--color-neon)] transition hover:underline">
            {t("login")}
          </Link>
          <Link href="/dashboard/login" className="btn-primary text-xs">
            {t("getAccess")}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/5 bg-[var(--color-bg)] px-6 py-4 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-2 text-sm text-white/60 hover:text-[var(--color-neon)]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-3 flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/dashboard/login" className="btn-primary text-xs" onClick={() => setOpen(false)}>
              {t("getAccess")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
