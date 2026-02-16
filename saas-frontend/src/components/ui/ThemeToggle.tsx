/**
 * Theme Toggle Component
 * ☀️/🌙 button for dark/light mode switching
 */
import { useColorMode } from '../../contexts/ColorModeContext';

export function ThemeToggle() {
  const { isDark, toggleMode, colorMode, setColorMode } = useColorMode();

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        onClick={toggleMode}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition btn-micro w-full"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="text-lg transition-transform duration-300" style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(360deg)' }}>
          {isDark ? '🌙' : '☀️'}
        </span>
        <span className="flex-1 text-left">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
      </button>

      {/* System preference button */}
      <button
        onClick={() => setColorMode(colorMode === 'system' ? 'dark' : 'system')}
        className={`p-1.5 rounded-lg text-xs transition ${
          colorMode === 'system'
            ? 'text-kali-blue bg-kali-blue/10'
            : 'text-gray-600 hover:text-gray-400'
        }`}
        title="Use system preference"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}

export default ThemeToggle;
