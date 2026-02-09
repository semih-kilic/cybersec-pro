import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

const TARGET_STORAGE_KEY = 'cybersec_global_target';
const RECENT_TARGETS_KEY = 'cybersec_recent_targets';
const MAX_RECENT = 10;

interface TargetContextType {
  target: string;
  setTarget: (target: string) => void;
  recentTargets: string[];
  addRecentTarget: (target: string) => void;
  clearTarget: () => void;
  clearRecentTargets: () => void;
}

const TargetContext = createContext<TargetContextType | null>(null);

function loadRecentTargets(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_TARGETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadGlobalTarget(): string {
  try {
    return localStorage.getItem(TARGET_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function TargetProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<string>(loadGlobalTarget);
  const [recentTargets, setRecentTargets] = useState<string[]>(loadRecentTargets);

  // Persist target to localStorage
  useEffect(() => {
    localStorage.setItem(TARGET_STORAGE_KEY, target);
  }, [target]);

  const setTarget = useCallback((newTarget: string) => {
    setTargetState(newTarget);
  }, []);

  const addRecentTarget = useCallback((newTarget: string) => {
    if (!newTarget || !newTarget.trim()) return;
    const trimmed = newTarget.trim();
    setRecentTargets(prev => {
      const filtered = prev.filter(t => t !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_TARGETS_KEY, JSON.stringify(updated));
      return updated;
    });
    setTargetState(trimmed);
  }, []);

  const clearTarget = useCallback(() => {
    setTargetState('');
    localStorage.removeItem(TARGET_STORAGE_KEY);
  }, []);

  const clearRecentTargets = useCallback(() => {
    setRecentTargets([]);
    localStorage.removeItem(RECENT_TARGETS_KEY);
  }, []);

  return (
    <TargetContext.Provider value={{ target, setTarget, recentTargets, addRecentTarget, clearTarget, clearRecentTargets }}>
      {children}
    </TargetContext.Provider>
  );
}

export function useTarget(): TargetContextType {
  const ctx = useContext(TargetContext);
  if (!ctx) {
    throw new Error('useTarget must be used within a TargetProvider');
  }
  return ctx;
}
