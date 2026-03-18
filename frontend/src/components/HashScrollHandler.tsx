"use client";

import { useEffect } from "react";

/** Scrolls to hash anchor after page hydration for static exports */
export default function HashScrollHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    // Delay slightly to ensure DOM is ready after hydration
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
