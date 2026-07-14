/**
 * Global Keyboard Shortcuts Hook
 *
 * Shortcuts:
 * - Ctrl+K / Cmd+K → Toggle Command Palette
 * - Ctrl+Enter     → Run scan (on scan execution page)
 * - Escape         → Close palette / modals
 * - /              → Focus search (outside inputs)
 * - G then T       → Go to Tools
 * - G then S       → Go to Scans
 * - G then D       → Go to Dashboard
 * - G then A       → Go to Agents
 * - ?              → Show shortcuts help
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardShortcutsOptions {
  onCommandPalette?: () => void;
  onEscape?: () => void;
  onFocusSearch?: () => void;
  onRunScan?: () => void;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions = {}) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

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

      // --- Ctrl+K / Cmd+K → Toggle Command Palette ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }

      // --- Ctrl+Enter → Run scan ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        opts.onRunScan?.();
        return;
      }

      // --- Escape → Close palette / modals ---
      if (e.key === 'Escape') {
        if (showShortcutsHelp) {
          e.preventDefault();
          setShowShortcutsHelp(false);
          return;
        }
        if (isPaletteOpen) {
          e.preventDefault();
          closePalette();
          return;
        }
        opts.onEscape?.();
        return;
      }

      // Skip remaining shortcuts if in input
      if (isInput) return;

      // --- / → Focus search ---
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        opts.onFocusSearch?.();
        return;
      }

      // --- ? → Show shortcuts help ---
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutsHelp((p) => !p);
        return;
      }

      // --- G+key sequences → Navigation ---
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        if (!gPressedRef.current) {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => { gPressedRef.current = false; }, 800);
          return;
        }
      }

      if (gPressedRef.current) {
        gPressedRef.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);

        const routes: Record<string, string> = {
          d: '/dashboard',
          t: '/dashboard/tools',
          s: '/dashboard/scans',
          a: '/dashboard/agents',
          r: '/dashboard/reports',
          p: '/dashboard/projects',
          n: '/dashboard/scans/new',
        };

        if (routes[e.key]) {
          e.preventDefault();
          navigate(routes[e.key]);
          return;
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [isPaletteOpen, showShortcutsHelp, togglePalette, closePalette, opts, navigate]);

  return {
    isPaletteOpen,
    openPalette,
    closePalette,
    togglePalette,
    showShortcutsHelp,
    setShowShortcutsHelp,
  };
}

/**
 * Shortcut definitions for the help overlay
 */
export const SHORTCUT_LIST = [
  { keys: ['Ctrl', 'K'], label: 'Command Palette' },
  { keys: ['Ctrl', 'Enter'], label: 'Run Scan' },
  { keys: ['Esc'], label: 'Close Modal / Palette' },
  { keys: ['/'], label: 'Focus Search' },
  { keys: ['?'], label: 'Show Shortcuts' },
  { keys: ['G', 'D'], label: 'Go to Dashboard' },
  { keys: ['G', 'T'], label: 'Go to Tools' },
  { keys: ['G', 'S'], label: 'Go to Scans' },
  { keys: ['G', 'A'], label: 'Go to Agents' },
  { keys: ['G', 'R'], label: 'Go to Reports' },
  { keys: ['G', 'N'], label: 'New Scan' },
];
