export const locales = ["en", "tr", "de", "fr", "es", "ar", "ja", "zh", "ru", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ar: "العربية",
  ja: "日本語",
  zh: "中文",
  ru: "Русский",
  ko: "한국어",
};

export const rtlLocales: Locale[] = ["ar"];
