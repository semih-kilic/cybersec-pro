/**
 * React Query (TanStack Query) Configuration
 * 
 * Cache strategy:
 * - Tools catalog: 5min staleTime (rarely changes)
 * - Dashboard stats: 30s staleTime (updates moderately)
 * - Scans: 15s staleTime (needs near real-time)
 * - Agents: 10s staleTime (real-time via polling)
 */
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

// Global toast bridge — set at runtime by QueryErrorBridge component
let _toastError: ((title: string, message?: string) => void) | null = null;
export function setGlobalToastError(fn: typeof _toastError) {
  _toastError = fn;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Only toast network/auth errors; component-level error states handle the rest
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        // Auth errors handled by AuthProvider redirect — skip toast
        return;
      }
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        // OfflineBanner handles connectivity — skip toast
        return;
      }
      _toastError?.('Request Failed', error.message || 'An unexpected error occurred');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      _toastError?.('Action Failed', error.message || 'An unexpected error occurred');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s default
      gcTime: 5 * 60_000,       // 5min garbage collection (was cacheTime in v4)
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Cache time constants for different data types
export const CACHE_TIMES = {
  // Tools catalog - static data, rarely changes
  tools: {
    staleTime: 5 * 60_000,   // 5 minutes
    gcTime: 30 * 60_000,     // 30 minutes
  },
  // Dashboard overview - moderate refresh
  dashboard: {
    staleTime: 30_000,       // 30 seconds
    gcTime: 5 * 60_000,      // 5 minutes
  },
  // Scans - needs frequent updates
  scans: {
    staleTime: 15_000,       // 15 seconds
    gcTime: 2 * 60_000,      // 2 minutes
  },
  // Agents - near real-time
  agents: {
    staleTime: 10_000,       // 10 seconds
    gcTime: 60_000,          // 1 minute
    refetchInterval: 10_000, // Auto-refetch every 10s
  },
  // Usage/billing - infrequent
  usage: {
    staleTime: 60_000,       // 1 minute
    gcTime: 10 * 60_000,     // 10 minutes
  },
  // Targets - moderate refresh
  targets: {
    staleTime: 30_000,       // 30 seconds
    gcTime: 5 * 60_000,      // 5 minutes
  },
  // Reports - moderate refresh
  reports: {
    staleTime: 30_000,       // 30 seconds
    gcTime: 5 * 60_000,      // 5 minutes
  },
  // Schedules - frequent (timers ticking)
  schedules: {
    staleTime: 15_000,       // 15 seconds
    gcTime: 2 * 60_000,      // 2 minutes
  },
  // Projects - infrequent changes
  projects: {
    staleTime: 60_000,       // 1 minute
    gcTime: 10 * 60_000,     // 10 minutes
  },
  // Analytics - moderate refresh
  analytics: {
    staleTime: 30_000,       // 30 seconds
    gcTime: 5 * 60_000,      // 5 minutes
  },
  // Admin - moderate refresh
  admin: {
    staleTime: 30_000,       // 30 seconds
    gcTime: 5 * 60_000,      // 5 minutes
  },
  // Purple Team - frequent (exercises may be running)
  purpleTeam: {
    staleTime: 15_000,       // 15 seconds
    gcTime: 2 * 60_000,      // 2 minutes
  },
  // Terminal agents - near real-time
  terminal: {
    staleTime: 10_000,       // 10 seconds
    gcTime: 60_000,          // 1 minute
  },
  // SSO config - infrequent changes
  sso: {
    staleTime: 60_000,       // 1 minute
    gcTime: 10 * 60_000,     // 10 minutes
  },
} as const;

// Query key factory for consistent key management
export const queryKeys = {
  tools: {
    all: ['tools'] as const,
    list: (plan: string) => ['tools', 'list', plan] as const,
    detail: (id: string) => ['tools', 'detail', id] as const,
    categories: () => ['tools', 'categories'] as const,
    catalog: () => ['tools', 'catalog'] as const,
    stats: () => ['tools', 'stats'] as const,
    executionMode: (toolId: string) => ['tools', 'executionMode', toolId] as const,
  },
  scans: {
    all: ['scans'] as const,
    list: (filters?: Record<string, string>) => ['scans', 'list', filters] as const,
    detail: (id: string) => ['scans', 'detail', id] as const,
  },
  agents: {
    all: ['agents'] as const,
    dashboard: () => ['agents', 'dashboard'] as const,
    detail: (id: string) => ['agents', 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: () => ['dashboard', 'overview'] as const,
    stats: () => ['dashboard', 'stats'] as const,
  },
  usage: {
    all: ['usage'] as const,
    stats: () => ['usage', 'stats'] as const,
  },
  plan: {
    all: ['plan'] as const,
    info: () => ['plan', 'info'] as const,
  },
  targets: {
    all: ['targets'] as const,
    list: () => ['targets', 'list'] as const,
    groups: () => ['targets', 'groups'] as const,
  },
  reports: {
    all: ['reports'] as const,
    list: () => ['reports', 'list'] as const,
    templates: () => ['reports', 'templates'] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    list: () => ['schedules', 'list'] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overview: (range?: string) => ['analytics', 'overview', range] as const,
  },
  admin: {
    all: ['admin'] as const,
    overview: () => ['admin', 'overview'] as const,
  },
  purpleTeam: {
    all: ['purpleTeam'] as const,
    dashboard: () => ['purpleTeam', 'dashboard'] as const,
    profile: () => ['purpleTeam', 'profile'] as const,
    chains: () => ['purpleTeam', 'chains'] as const,
    playbooks: () => ['purpleTeam', 'playbooks'] as const,
    exercises: () => ['purpleTeam', 'exercises'] as const,
    exercise: (id: string) => ['purpleTeam', 'exercise', id] as const,
    mitreMatrix: () => ['purpleTeam', 'mitreMatrix'] as const,
  },
  terminal: {
    all: ['terminal'] as const,
    agents: () => ['terminal', 'agents'] as const,
  },
  sso: {
    all: ['sso'] as const,
    config: () => ['sso', 'config'] as const,
  },
  profile: {
    all: ['profile'] as const,
  },
} as const;
