/**
 * useLocalStorage — Typed localStorage hook with SSR safety
 */
import { useState, useCallback, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch { /* quota exceeded */ }
        return next;
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

/**
 * useDebounce — Debounce a value by delay (ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useMediaQuery — Reactive CSS media query match
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * useClipboard — Copy text to clipboard with feedback
 */
export function useClipboard(timeout: number = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
      }
    },
    []
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), timeout);
    return () => clearTimeout(timer);
  }, [copied, timeout]);

  return { copied, copy };
}

/**
 * useOnlineStatus — Track browser online/offline state
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return isOnline;
}

/**
 * useDocumentTitle — Set dynamic page title
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — CyberSec Pro` : 'CyberSec Pro';
    return () => { document.title = prev; };
  }, [title]);
}

/**
 * usePrevious — Track previous value of a reactive variable
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

/**
 * useIntersectionObserver — Lazy-load content when it enters viewport
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIntersecting(true);
            observerRef.current?.disconnect();
          }
        },
        { rootMargin: '200px', ...options }
      );
      observerRef.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.rootMargin, options.threshold]
  );

  return [ref, isIntersecting];
}

/**
 * useStableCallback — Returns a stable reference to the latest callback.
 * Useful for passing callbacks to memoized children without triggering re-renders.
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: any[]) => callbackRef.current(...args)) as T,
    []
  );
}
