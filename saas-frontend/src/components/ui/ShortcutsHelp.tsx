/**
 * Keyboard Shortcuts Help Overlay
 * Shows all available keyboard shortcuts (toggled with ?)
 */
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHORTCUT_LIST } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelp = memo(({ isOpen, onClose }: ShortcutsHelpProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-kali-blue/50"
              aria-label="Close"
              autoFocus
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-2 max-h-[60vh] overflow-auto">
            {SHORTCUT_LIST.map((shortcut) => (
              <div
                key={shortcut.label}
                className="flex items-center justify-between py-2 px-1"
              >
                <span className="text-sm text-gray-300">{shortcut.label}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={i}>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700 rounded shadow-sm min-w-[24px] text-center inline-block">
                        {key}
                      </kbd>
                      {i < shortcut.keys.length - 1 && (
                        <span className="text-gray-600 mx-0.5">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">
              Press <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-mono bg-gray-800 text-gray-400 border border-gray-700 rounded">?</kbd> to toggle this panel
            </p>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
));
ShortcutsHelp.displayName = 'ShortcutsHelp';
