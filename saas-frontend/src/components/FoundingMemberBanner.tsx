import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISS_KEY = 'cybersec_founding_member_dismissed';

export function FoundingMemberBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative w-full animate-pulse-subtle">
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 text-sm font-semibold">
          <span className="hidden sm:inline">🔥</span>
          <p className="text-center">
            {t('foundingBanner.message', 'Only 6 Founding Member spots left — 50% Lifetime Discount')}
          </p>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
