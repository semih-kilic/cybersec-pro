import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Language {
  code: string;
  flag: string;
  name: string;
}

const languages: Language[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
];

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'sidebar';
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectLanguage(lang: Language) {
    i18n.changeLanguage(lang.code);
    setIsOpen(false);
  }

  // Arbitrary color values (bg-[#...]) are immune to the html.light global
  // overrides — auth pages are intentionally dark in both color modes.
  const renderDropdownItems = (position: 'above' | 'below') => (
    <div
      className={`absolute ${position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'} ${
        variant === 'sidebar' ? 'left-0' : 'right-0'
      } w-56 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#0b1220] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-50 backdrop-blur`}
    >
      <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.08)]">
        <span className="text-[11px] font-bold tracking-wider text-[#6b7280] uppercase">Language</span>
      </div>
      <div className="py-1 max-h-72 overflow-y-auto">
        {languages.map(lang => {
          const active = lang.code === i18n.language;
          return (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left ${
                active
                  ? 'bg-[rgba(6,182,212,0.12)] text-[#22d3ee]'
                  : 'text-[#d1d5db] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
              }`}
            >
              <span className="text-xl leading-none">{lang.flag}</span>
              <span className="font-medium">{lang.name}</span>
              {active && (
                <svg className="w-4 h-4 ml-auto text-[#22d3ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <span className="text-lg leading-none">{current.flag}</span>
          <span>{current.code.toUpperCase()}</span>
          <svg className={`w-3.5 h-3.5 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && renderDropdownItems('above')}
      </div>
    );
  }

  const trigger =
    variant === 'compact'
      ? 'px-3.5 py-2 text-sm border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.07)] text-white hover:bg-[rgba(255,255,255,0.13)] hover:border-[rgba(34,211,238,0.55)] shadow-[0_2px_10px_rgba(0,0,0,0.35)]'
      : 'px-4 py-2.5 text-sm border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.07)] text-white hover:bg-[rgba(255,255,255,0.13)] hover:border-[rgba(34,211,238,0.55)] shadow-[0_2px_10px_rgba(0,0,0,0.35)]';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change language"
        className={`flex items-center gap-2.5 rounded-xl border transition-all backdrop-blur ${trigger}`}
      >
        <span className="text-xl leading-none drop-shadow">{current.flag}</span>
        <span className="font-bold tracking-wide">{current.code.toUpperCase()}</span>
        <svg className={`w-3.5 h-3.5 text-[#9ca3af] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && renderDropdownItems('below')}
    </div>
  );
}

export default LanguageSwitcher;
