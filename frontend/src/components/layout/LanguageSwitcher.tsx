"use client";

import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract current locale from pathname
  const segments = pathname.split("/");
  const currentLocale = locales.includes(segments[1] as Locale)
    ? (segments[1] as Locale)
    : "en";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchLocale = (locale: Locale) => {
    const newSegments = [...segments];
    if (locales.includes(newSegments[1] as Locale)) {
      newSegments[1] = locale;
    } else {
      newSegments.splice(1, 0, locale);
    }
    router.push(newSegments.join("/") || "/");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60 transition hover:border-[var(--color-neon-dim)] hover:text-white"
      >
        <Globe size={14} />
        <span className="font-mono uppercase">{currentLocale}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-white/10 bg-[var(--color-bg-secondary)] p-1 shadow-2xl">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => switchLocale(locale)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                locale === currentLocale
                  ? "bg-[var(--color-neon-dim)] text-[var(--color-neon)]"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="font-mono uppercase">{locale}</span>
              <span>{localeNames[locale]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
