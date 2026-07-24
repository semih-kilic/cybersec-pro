"use client";

import { useState, useCallback } from "react";
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
  ];

  /** Smooth-scroll to a hash anchor on the same page */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const hashIdx = href.indexOf("#");
      if (hashIdx === -1) return;
      const hash = href.slice(hashIdx + 1);
      const el = document.getElementById(hash);
      if (el) {
        e.preventDefault();
        setOpen(false);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `#${hash}`);
      }
    },
    [],
  );

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <Link href={lp("/")} className="flex items-center gap-2 font-bold text-white">
          <svg width="28" height="28" viewBox="0 0 512 512" fill="none">
            <circle cx="256" cy="256" r="250" fill="#0a0e14" stroke="#9fef00" strokeWidth="18"/>
            <g fill="#9fef00" transform="translate(256,256) scale(0.82) translate(-256,-256)">
              <path d="M280 120C290 100 320 85 340 90C330 105 325 115 330 125C345 115 360 110 375 115C365 130 355 140 345 145C355 150 360 160 355 175L340 165C335 175 320 185 305 185L295 180C290 190 280 195 270 195Z" opacity="0.95"/>
              <circle cx="320" cy="130" r="8" fill="#0a0e14"/><circle cx="322" cy="128" r="3" fill="#ff3333"/>
              <path d="M270 195C260 210 250 230 245 250C240 235 238 225 230 215C245 210 255 200 270 195Z" opacity="0.9"/>
              <path d="M245 250C240 275 235 300 240 330C245 355 255 375 270 390C250 395 235 385 225 370C215 355 210 335 215 310C218 290 225 270 230 255C235 250 240 248 245 250Z" opacity="0.85"/>
              <path d="M250 230C225 200 190 175 150 165C135 162 120 165 110 175C130 180 148 190 160 205C170 218 175 230 178 242C168 235 155 228 140 225C125 222 115 228 110 238C128 240 145 248 158 260C172 273 180 288 182 300L195 285C200 268 215 252 230 245C240 240 248 238 250 230Z" opacity="0.75"/>
              <path d="M285 200C310 185 340 180 370 185C385 188 395 195 400 208C382 200 365 198 350 202C338 206 328 215 322 225C335 218 350 215 368 218C382 220 390 228 392 240C375 235 358 234 342 238C325 243 312 255 305 270L295 260C290 248 278 235 268 228C262 224 260 218 265 210Z" opacity="0.75"/>
              <path d="M270 390C285 400 300 405 320 400C340 395 358 382 370 365C380 350 388 332 392 318C395 308 400 300 408 298C405 310 400 325 392 340C382 360 368 378 348 392C330 405 308 412 290 410C275 408 270 400 270 390Z" opacity="0.8"/>
              <path d="M235 320C228 335 222 350 220 365C218 375 222 382 230 385L245 385C248 380 248 372 245 365C242 355 240 345 240 330Z" opacity="0.8"/>
              <path d="M230 385L225 395L232 390L237 398L240 388L248 393L245 385Z" opacity="0.7"/>
            </g>
          </svg>
          CyberSec Pro
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={(e) => handleClick(e, l.href)}
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
              onClick={(e) => { handleClick(e, l.href); setOpen(false); }}
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
