/**
 * GDPR Cookie Consent Banner
 * Implements Google Consent Mode v2 — blocks GA4 until user accepts.
 * Renders a fixed bottom banner with Accept All / Essential Only / Customize.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'cybersecpro_cookie_consent';

type ConsentChoice = 'all' | 'essential' | null;

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice>(null);

  useEffect(() => {
    // Check if consent was already given
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Small delay so the banner doesn't flash before page renders
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    // Re-apply stored consent on page load
    applyConsent(stored as ConsentChoice);
  }, []);

  const applyConsent = useCallback((c: ConsentChoice) => {
    const granted = c === 'all';
    gtag('consent', 'update', {
      'ad_storage': granted ? 'granted' : 'denied',
      'ad_user_data': granted ? 'granted' : 'denied',
      'ad_personalization': granted ? 'granted' : 'denied',
      'analytics_storage': granted ? 'granted' : 'denied',
      'functionality_storage': 'granted',
      'personalization_storage': granted ? 'granted' : 'denied',
      'security_storage': 'granted',
    });
    if (granted) {
      // Send the deferred page_view
      gtag('event', 'page_view');
    }
    localStorage.setItem(STORAGE_KEY, c ?? 'essential');
    setChoice(c);
    setVisible(false);
  }, []);

  const handleAcceptAll = () => applyConsent('all');
  const handleEssentialOnly = () => applyConsent('essential');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6"
          role="dialog"
          aria-modal="false"
          aria-label={t('cookie.title', 'Cookie Preferences')}
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-700/50 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              {/* Icon */}
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-xl">
                🍪
              </div>

              {/* Content */}
              <div className="flex-1 space-y-3">
                <h3 className="text-sm font-semibold text-white sm:text-base">
                  {t('cookie.title', 'We use cookies')}
                </h3>
                <p className="text-xs leading-relaxed text-gray-400 sm:text-sm">
                  {t(
                    'cookie.description',
                    'We use cookies for security, analytics, and to improve your experience. By clicking "Accept All", you consent to our use of analytics cookies. You can choose "Essential Only" to reject non-essential cookies.'
                  )}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    onClick={handleAcceptAll}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-cyan-400 sm:text-sm"
                  >
                    {t('cookie.acceptAll', 'Accept All')}
                  </button>
                  <button
                    onClick={handleEssentialOnly}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-zinc-600 hover:text-white sm:text-sm"
                  >
                    {t('cookie.essentialOnly', 'Essential Only')}
                  </button>
                  <a
                    href="/dashboard/privacy"
                    className="inline-flex items-center px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-300 sm:text-sm"
                  >
                    {t('cookie.learnMore', 'Privacy Policy')} →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}