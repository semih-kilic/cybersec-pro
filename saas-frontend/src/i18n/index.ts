import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import tr from './locales/tr.json';

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'es', 'it', 'tr'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
      tr: { translation: tr },
    },
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
  });

export default i18n;
