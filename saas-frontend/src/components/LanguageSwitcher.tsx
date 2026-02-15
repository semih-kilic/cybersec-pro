import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Language {
  code: string;
  flag: string;
  name: string;
}

const languages: Language[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
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

  const renderDropdownItems = (position: 'above' | 'below') => (
    <div className={`absolute ${position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'} ${variant === 'sidebar' ? 'left-0' : 'right-0'} w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50`}>
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-500 uppercase">Language</span>
      </div>
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => selectLanguage(lang)}
          className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors ${
            lang.code === i18n.language
              ? 'bg-cyan-500/10 text-cyan-400'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span className="text-base">{lang.flag}</span>
          <span>{lang.name}</span>
          {lang.code === i18n.language && (
            <svg className="w-4 h-4 ml-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ))}
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
          <span>{current.flag} {current.code.toUpperCase()}</span>
          <svg className={`w-3.5 h-3.5 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && renderDropdownItems('above')}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg border transition-all ${
          variant === 'compact'
            ? 'px-2.5 py-1.5 text-xs border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:text-white'
            : 'px-3 py-2 text-sm border-gray-700 bg-gray-800/60 text-gray-300 hover:border-cyan-500/50 hover:text-white'
        }`}
      >
        <span>{current.flag}</span>
        <span className="font-medium">{current.code.toUpperCase()}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && renderDropdownItems('below')}
    </div>
  );
}

export default LanguageSwitcher;
