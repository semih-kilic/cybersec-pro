"use client";

/**
 * AnnouncementBar — site-wide strip promoting the limited Founding Member
 * offer. Renders only while the offer is live (public availability probe)
 * and stays hidden after the visitor dismisses it (localStorage).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Crown } from "lucide-react";

const DISMISS_KEY = "fm_bar_dismissed";
const REGISTER_URL = "https://app.cyber-sec-pro.com/register?plan=founding_member";

export default function AnnouncementBar() {
  const t = useTranslations("founding");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    fetch("/api/v1/billing/founding-member/status")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.available) setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div className="relative z-10 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <Crown size={15} className="shrink-0 text-black/80" />
        <p className="text-xs font-semibold text-black sm:text-sm">
          {t.has("bar") ? t("bar") : "Founding Member offer — $19/mo lifetime (81% off). Only 10 spots."}
        </p>
        <a
          href={REGISTER_URL}
          className="rounded-full bg-black/85 px-3.5 py-1 text-xs font-bold text-amber-300 transition hover:bg-black"
        >
          {t.has("barCta") ? t("barCta") : "Claim your spot"}
        </a>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/60 transition hover:text-black"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
