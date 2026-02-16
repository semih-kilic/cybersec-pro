/**
 * Global Keyboard Shortcuts Hook
 * Manages Ctrl+K (palette), Esc (close modals), / (focus search), etc.
 */
import { useEffect, useCallback, useState } from 'react';

interface UseKeyboardShortcutsOptions {
  onCommandPalette?: () => void;
  onEscape?: () => void;
  onFocusSearch?: () => void;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions = {}) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const openPalette = useCallback(() => {
    setIsPaletteOpen(true);
    opts.onCommandPalette?.();
  }, [opts]);

  const closePalette = useCallback(() => {
    setIsPaletteOpen(false);
    opts.onEscape?.();
  }, [opts]);

  const togglePalette = useCallback(() => {
    setIsPaletteOpen((prev) => {
      const next = !prev;
      if (next) opts.onCommandPalette?.();
      else opts.onEscape?.();
      return next;
    });
  }, [opts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K or Cmd+K → Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }

      // Escape → Close palette / modals
      if (e.key === 'Escape') {
        if (isPaletteOpen) {
          e.preventDefault();
          closePalette();
          return;
        }
        opts.onEscape?.();
        return;
      }

      // / → Focus search (unless already in input)
      if (e.key === '/' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        opts.onFocusSearch?.();
        return;
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [isPaletteOpen, togglePalette, closePalette, opts]);

  return { isPaletteOpen, openPalette, closePalette, togglePalette };
}
