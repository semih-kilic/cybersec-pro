/**
 * Theme Toggle Component
 * ☀️/🌙 button for dark/light mode switching
 */
import { useColorMode } from '../../contexts/ColorModeContext';

export function ThemeToggle() {
  const { isDark, toggleMode } = useColorMode();

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
    </div>
  );
}

export default ThemeToggle;
