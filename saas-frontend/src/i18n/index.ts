import i18n from 'i18next';
import type { BackendModule, ReadCallback, ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const SUPPORTED_LANGS = ['en', 'tr', 'de', 'fr', 'es', 'pt', 'it', 'ar', 'ja', 'zh', 'ko', 'ru'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

// Each locale becomes its own lazily-fetched chunk instead of being bundled
// into the entry chunk. Statically importing all twelve made every user
// download ~755 KB of translations to read one language.
const localeLoaders = import.meta.glob<{ default: ResourceKey }>('./locales/*.json');

const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language: string, _namespace: string, callback: ReadCallback) => {
    const loader = localeLoaders[`./locales/${language}.json`];
    if (!loader) {
      // Unknown language: hand back an empty bundle so i18next falls back
      // rather than hanging on a pending read.
      callback(null, {});
      return;
    }
    loader()
      .then((module) => callback(null, module.default))
      .catch((error: unknown) => callback(error as Error, null));
  },
};

const readInitialLanguage = (): SupportedLang => {
  if (typeof window === 'undefined') return 'en';
  const raw = localStorage.getItem('cybersecpro_language');
  if (raw && SUPPORTED_LANGS.includes(raw as SupportedLang)) {
    return raw as SupportedLang;
  }
  localStorage.setItem('cybersecpro_language', 'en');
  return 'en';
};

const initialLanguage = readInitialLanguage();

/**
 * Resolves once the active language (and the English fallback) are loaded.
 * `main.tsx` awaits this before the first render so no component ever paints
 * raw translation keys.
 */
export const i18nReady = i18n
  .use(lazyLocaleBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'cybersecpro_language',
      caches: ['localStorage'],
    },
    react: {
      // The initial bundle is awaited in main.tsx, and i18next resolves
      // changeLanguage() only after the new bundle has loaded, so no component
      // needs to suspend.
      useSuspense: false,
    },
  });

export default i18n;
