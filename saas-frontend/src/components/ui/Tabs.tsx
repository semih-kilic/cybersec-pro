/**
 * 🐉 CyberSec Pro — Tabs Component
 * Accessible tabs with URL sync, variants, and keyboard navigation
 */
import { useState, useRef, useEffect, type ReactNode, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';

export type TabsVariant = 'default' | 'pills' | 'underline';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (tabId: string) => void;
  variant?: TabsVariant;
  fullWidth?: boolean;
  className?: string;
}

interface TabPanelProps {
  children: ReactNode;
  className?: string;
}

export function Tabs({ tabs, value, onChange, variant = 'default', fullWidth, className = '' }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  // Update animated indicator position
  useEffect(() => {
    const idx = tabs.findIndex(t => t.id === value);
    const el = tabRefs.current[idx];
    if (el) {
      setIndicatorStyle({
        width: el.offsetWidth,
        left: el.offsetLeft,
      });
    }
  }, [value, tabs]);

  // Arrow key navigation
  const handleKeyDown = (e: KeyboardEvent, idx: number) => {
    const enabledTabs = tabs.filter(t => !t.disabled);
    const currentEnabledIdx = enabledTabs.findIndex(t => t.id === tabs[idx].id);
    let nextIdx = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentEnabledIdx + 1) % enabledTabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentEnabledIdx - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = enabledTabs.length - 1;
    }

    if (nextIdx >= 0) {
      const nextTab = enabledTabs[nextIdx];
      const globalIdx = tabs.findIndex(t => t.id === nextTab.id);
      tabRefs.current[globalIdx]?.focus();
      onChange(nextTab.id);
    }
  };

  const baseClasses: Record<TabsVariant, { container: string; tab: string; active: string }> = {
    default: {
      container: 'bg-gray-900/50 border border-gray-800 rounded-xl p-1',
      tab: 'text-gray-400 hover:text-gray-200 rounded-lg',
      active: 'text-white bg-gray-800 shadow-sm',
    },
    pills: {
      container: 'gap-2',
      tab: 'text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-full',
      active: 'text-white bg-cyan-600/20 text-cyan-400 border border-cyan-500/30',
    },
    underline: {
      container: 'border-b border-gray-800 relative',
      tab: 'text-gray-400 hover:text-gray-200 pb-3 border-b-2 border-transparent -mb-px',
      active: 'text-cyan-400 border-b-2 border-cyan-400 -mb-px',
    },
  };

  const variantStyle = baseClasses[variant];

  return (
    <div
      className={`flex ${fullWidth ? '' : 'inline-flex'} overflow-x-auto scrollbar-none ${variantStyle.container} ${className}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {variant === 'underline' && (
        <motion.div
          className="absolute bottom-0 h-0.5 bg-cyan-400 rounded-full"
          animate={indicatorStyle}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {tabs.map((tab, idx) => (
        <button
          key={tab.id}
          ref={(el) => { tabRefs.current[idx] = el; }}
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          aria-disabled={tab.disabled}
          tabIndex={value === tab.id ? 0 : -1}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`
            flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:z-10
            disabled:opacity-40 disabled:cursor-not-allowed
            ${fullWidth ? 'flex-1 justify-center' : ''}
            ${variantStyle.tab}
            ${value === tab.id ? variantStyle.active : ''}
          `.trim().replace(/\s+/g, ' ')}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-700 text-gray-300 min-w-[18px] text-center">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
  return (
    <div role="tabpanel" className={`mt-4 ${className}`}>
      {children}
    </div>
  );
}

export default Tabs;
