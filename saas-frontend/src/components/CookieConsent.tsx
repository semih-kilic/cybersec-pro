import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CONSENT_KEY = 'cybersecpro_cookie_consent';

interface CookiePreferences {
  essential: boolean;    // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: '',
  });

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    const consent = { ...prefs, timestamp: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setVisible(false);
  };

  const acceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true, timestamp: '' });
  };

  const acceptEssential = () => {
    saveConsent({ essential: true, analytics: false, marketing: false, timestamp: '' });
  };

  const saveCustom = () => {
    saveConsent(preferences);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 animate-slide-up pointer-events-none">
      <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl shadow-black/50 overflow-hidden pointer-events-auto">
        {/* Main Banner */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0 mt-1">🍪</span>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-1">{t('cookie.title')}</h3>
              <p className="text-gray-400 text-sm">
                {t('cookie.description')}{' '}
                <Link to="/dashboard/privacy" className="text-cyan-400 hover:underline">{t('cookie.privacyLink')}</Link>
              </p>
            </div>
          </div>

          {/* Cookie Categories (expandable) */}
          {showDetails && (
            <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
              {/* Essential */}
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium text-sm">{t('cookie.essential')}</p>
                  <p className="text-gray-500 text-xs">{t('cookie.essentialDesc')}</p>
                </div>
                <div className="w-12 h-6 bg-green-500/20 rounded-full flex items-center justify-end px-1">
                  <div className="w-4 h-4 bg-green-400 rounded-full" />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium text-sm">{t('cookie.analytics')}</p>
                  <p className="text-gray-500 text-xs">{t('cookie.analyticsDesc')}</p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition ${preferences.analytics ? 'bg-cyan-500/30 justify-end' : 'bg-gray-700 justify-start'}`}
                >
                  <div className={`w-4 h-4 rounded-full transition ${preferences.analytics ? 'bg-cyan-400' : 'bg-gray-500'}`} />
                </button>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium text-sm">{t('cookie.marketing')}</p>
                  <p className="text-gray-500 text-xs">{t('cookie.marketingDesc')}</p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, marketing: !p.marketing }))}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition ${preferences.marketing ? 'bg-cyan-500/30 justify-end' : 'bg-gray-700 justify-start'}`}
                >
                  <div className={`w-4 h-4 rounded-full transition ${preferences.marketing ? 'bg-cyan-400' : 'bg-gray-500'}`} />
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={acceptAll}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/20"
            >
              {t('cookie.acceptAll')}
            </button>
            <button
              onClick={acceptEssential}
              className="w-full sm:w-auto px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition border border-gray-600"
            >
              {t('cookie.essentialOnly')}
            </button>
            {showDetails ? (
              <button
                onClick={saveCustom}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-800 text-cyan-400 rounded-lg font-medium hover:bg-gray-700 transition border border-cyan-500/30"
              >
                {t('cookie.savePreferences')}
              </button>
            ) : (
              <button
                onClick={() => setShowDetails(true)}
                className="w-full sm:w-auto px-6 py-2.5 text-gray-400 hover:text-white transition text-sm"
              >
                {t('cookie.customize')}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
