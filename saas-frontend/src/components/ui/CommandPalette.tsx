/**
 * Command Palette (Ctrl+K / ⌘K)
 * Spotlight-style search overlay for quick navigation
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ---- Types ----
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action' | 'tool';
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---- Icons ----
const NavIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ActionIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ToolIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Build command items
  const commands: CommandItem[] = useMemo(() => {
    const nav = (path: string) => () => { navigate(path); onClose(); };

    return [
      // Navigation
      { id: 'nav-dashboard', label: t('nav.dashboard', 'Dashboard'), description: 'Overview & statistics', icon: <NavIcon />, action: nav('/dashboard'), category: 'navigation' as const, keywords: ['home', 'overview', 'stats'] },
      { id: 'nav-tools', label: t('nav.tools', 'Tools'), description: '401 security tools', icon: <NavIcon />, action: nav('/dashboard/tools'), category: 'navigation' as const, keywords: ['kali', 'security', 'catalog'] },
      { id: 'nav-scans', label: t('nav.scans', 'Scans'), description: 'View scan history', icon: <NavIcon />, action: nav('/dashboard/scans'), category: 'navigation' as const, keywords: ['scan', 'history', 'results'] },
      { id: 'nav-targets', label: t('nav.targets', 'Targets'), description: 'Manage scan targets', icon: <NavIcon />, action: nav('/dashboard/targets'), category: 'navigation' as const, keywords: ['ip', 'host', 'domain'] },
      { id: 'nav-reports', label: t('nav.reports', 'Reports'), description: 'Security reports', icon: <NavIcon />, action: nav('/dashboard/reports'), category: 'navigation' as const, keywords: ['report', 'pdf', 'export'] },
      { id: 'nav-schedule', label: t('nav.schedule', 'Schedule'), description: 'Scheduled scans', icon: <NavIcon />, action: nav('/dashboard/schedule'), category: 'navigation' as const, keywords: ['cron', 'recurring', 'automation'] },
      { id: 'nav-projects', label: t('nav.projects', 'Projects'), description: 'Project management', icon: <NavIcon />, action: nav('/dashboard/projects'), category: 'navigation' as const, keywords: ['project', 'organize'] },
      { id: 'nav-agents', label: t('nav.agents', 'Agents'), description: 'Agent management', icon: <NavIcon />, action: nav('/dashboard/agents'), category: 'navigation' as const, keywords: ['agent', 'kali', 'machine'] },
      { id: 'nav-terminal', label: t('nav.terminal', 'Terminal'), description: 'Web terminal', icon: <NavIcon />, action: nav('/dashboard/terminal'), category: 'navigation' as const, keywords: ['shell', 'bash', 'command'] },
      { id: 'nav-settings', label: t('nav.settings', 'Settings'), description: 'App settings', icon: <NavIcon />, action: nav('/dashboard/settings'), category: 'navigation' as const, keywords: ['config', 'preferences'] },

      // Actions
      { id: 'act-new-scan', label: 'New Scan', description: 'Start a new security scan', icon: <ActionIcon />, action: nav('/dashboard/scans/new'), category: 'action' as const, keywords: ['start', 'run', 'execute'] },
      { id: 'act-upgrade', label: 'Upgrade Plan', description: 'Upgrade to Pro', icon: <ActionIcon />, action: nav('/dashboard/upgrade'), category: 'action' as const, keywords: ['pro', 'premium', 'billing'] },

      // Popular tools
      { id: 'tool-nmap', label: 'Nmap', description: 'Network scanner', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['port', 'network', 'scanner'] },
      { id: 'tool-sqlmap', label: 'SQLMap', description: 'SQL injection tool', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['sql', 'injection', 'database'] },
      { id: 'tool-nikto', label: 'Nikto', description: 'Web server scanner', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['web', 'vulnerability'] },
      { id: 'tool-gobuster', label: 'Gobuster', description: 'Directory brute-forcer', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['directory', 'bruteforce', 'fuzz'] },
      { id: 'tool-hydra', label: 'Hydra', description: 'Password cracker', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['password', 'brute', 'login'] },
      { id: 'tool-burpsuite', label: 'Burp Suite', description: 'Web security testing', icon: <ToolIcon />, action: nav('/dashboard/tools'), category: 'tool' as const, keywords: ['proxy', 'web', 'intercept'] },
    ];
  }, [navigate, onClose, t]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.includes(q))
    );
  }, [query, commands]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  const flatList = useMemo(() => filtered, [filtered]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            flatList[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatList, selectedIndex, onClose]
  );

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Pages',
    action: 'Actions',
    tool: 'Tools',
  };

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm palette-backdrop"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative flex justify-center pt-[15vh]">
        <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden palette-container">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {flatList.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No results for "{query}"
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category] || category}
                  </div>
                  {items.map((item) => {
                    globalIndex++;
                    const idx = globalIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          idx === selectedIndex
                            ? 'bg-kali-blue/20 text-white'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <span className={idx === selectedIndex ? 'text-kali-blue' : 'text-gray-500'}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{item.label}</span>
                          {item.description && (
                            <span className="text-xs text-gray-500 ml-2">{item.description}</span>
                          )}
                        </div>
                        {idx === selectedIndex && (
                          <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">↵</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-800 px-1 py-0.5 rounded">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-800 px-1 py-0.5 rounded">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-800 px-1 py-0.5 rounded">ESC</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
