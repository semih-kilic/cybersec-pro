/**
 * Dark/Light Mode Context
 * System preference detection + manual toggle with localStorage persistence
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

type ColorMode = 'dark' | 'light' | 'system';

interface ColorModeContextType {
  colorMode: ColorMode;       // User preference (dark/light/system)
  resolvedMode: 'dark' | 'light'; // Actual applied mode
  setColorMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  isDark: boolean;
}

const ColorModeContext = createContext<ColorModeContextType | null>(null);
const STORAGE_KEY = 'cybersecpro_color_mode';

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within ColorModeProvider');
  return ctx;
}

function getSystemPreference(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedMode(): ColorMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch { /* noop */ }
  return 'light'; // Default to light (professional SaaS appearance)
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(getSavedMode);
  const [systemPref, setSystemPref] = useState<'dark' | 'light'>(getSystemPreference);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedMode = useMemo(
    () => (colorMode === 'system' ? systemPref : colorMode),
    [colorMode, systemPref]
  );

  const isDark = resolvedMode === 'dark';

  // Apply to <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Remove transition class after animation
    const timer = setTimeout(() => root.classList.remove('theme-transition'), 400);
    return () => clearTimeout(timer);
  }, [isDark]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
  }, []);

  const toggleMode = useCallback(() => {
    setColorMode(isDark ? 'light' : 'dark');
  }, [isDark, setColorMode]);

  const value = useMemo(
    () => ({ colorMode, resolvedMode, setColorMode, toggleMode, isDark }),
    [colorMode, resolvedMode, setColorMode, toggleMode, isDark]
  );

  return (
    <ColorModeContext.Provider value={value}>
      {children}
    </ColorModeContext.Provider>
  );
}
