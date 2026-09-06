import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * Deep-merge locale messages over the default-locale base so any key that has
 * not been translated yet falls back to the default-locale (English) string
 * instead of rendering the raw key path — which is a visible break — and
 * emitting `MISSING_MESSAGE` at build time. Newer pages (e.g. the Trust Center)
 * are authored in en/tr first; without this, the other locales showed key paths.
 * Arrays are replaced wholesale (element-level merging is never what we want for
 * ordered content), leaf values prefer the translation unless it is nullish.
 */
function deepMerge(base: unknown, override: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override ?? base;
  }
  if (
    typeof base === "object" &&
    base !== null &&
    typeof override === "object" &&
    override !== null
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(override as Record<string, unknown>)) {
      const b = (base as Record<string, unknown>)[key];
      const o = (override as Record<string, unknown>)[key];
      out[key] = key in (base as Record<string, unknown>) ? deepMerge(b, o) : o;
    }
    return out;
  }
  return override ?? base;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  const messages = (await import(`./messages/${locale}.json`)).default;

  // The default locale is the fallback source; no merge needed for it.
  if (locale === defaultLocale) {
    return { locale, messages };
  }

  const base = (await import(`./messages/${defaultLocale}.json`)).default;
  return {
    locale,
    messages: deepMerge(base, messages) as Record<string, unknown>,
  };
});
