/**
 * TanStack Query hooks for API data fetching with caching
 * 
 * Replaces manual useState/useEffect patterns with:
 * - Automatic caching & deduplication
 * - Background refetching
 * - Stale-while-revalidate strategy
 * - Error retry with exponential backoff
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { queryKeys, CACHE_TIMES } from '../lib/queryClient';

// ---- Helper: authenticated fetch ----
async function authFetch<T>(url: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || error.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ==========================================
// TOOL COUNTS (Public endpoint - no auth)
// ==========================================

export interface PlanToolCounts {
  plans: {
    trial: number;
    starter: number;
    professional: number;
    team: number;
    enterprise: number;
  };
  total: number;
}

/** Fetches dynamic tool counts per plan from /api/v1/tools/count (public, no auth) */
export function useToolCounts() {
  return useQuery<PlanToolCounts>({
    queryKey: ['toolCounts'],
    queryFn: async () => {
      const res = await fetch('/api/v1/tools/count');
      if (!res.ok) throw new Error('Failed to fetch tool counts');
      return res.json();
    },
    staleTime: CACHE_TIMES.tools.staleTime,   // 5 minutes - counts rarely change
    gcTime: CACHE_TIMES.tools.gcTime,          // 30 min cache
    refetchOnWindowFocus: false,
  });
}

// ==========================================
// TOOLS HOOKS
// ==========================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  plan_required: string;
  installed: boolean;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
}

export interface CategoryInfo {
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface CategoryData {
  info: CategoryInfo;
  tools: Tool[];
}

export interface ToolsResponse {
  success: boolean;
  total_tools: number;
  categories: { [key: string]: CategoryData };
  category_list: string[];
}

/**
 * Fetch tools catalog with 5-minute cache
 * Tools data is relatively static - aggressive caching is safe
 */
export function useTools(plan: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.tools.list(plan),
    queryFn: () => authFetch<ToolsResponse>(`/api/v2/tools?plan=${plan}`, token),
    ...CACHE_TIMES.tools,
    enabled: !!token,
    select: (data) => ({
      categories: data.categories || {},
      totalTools: data.total_tools || 0,
      categoryList: data.category_list || [],
    }),
  });
}

// ==========================================
// DASHBOARD / OVERVIEW HOOKS
// ==========================================

interface DashboardToolsResponse {
  total_tools: number;
  [key: string]: unknown;
}

interface DashboardScansResponse {
  scans: Array<{
    id: string;
    tool?: { name: string };
    tool_name?: string;
    target: string;
    status: string;
    created_at: string;
    findings_count?: number;
  }>;
}

interface UsageStatsResponse {
  usage?: {
    total_scans?: number;
    [key: string]: unknown;
  };
}

export interface DashboardData {
  totalTools: number;
  scanSummary: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  recentScans: Array<{
    id: string;
    tool_name: string;
    target: string;
    status: string;
    started_at: string;
    findings: number;
  }>;
  totalTargets: number;
}

/**
 * Fetch all dashboard overview data in parallel
 */
export function useDashboardData() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: async (): Promise<DashboardData> => {
      const [toolsData, scansData, usageData] = await Promise.all([
        authFetch<DashboardToolsResponse>('/api/v1/tools', token),
        authFetch<DashboardScansResponse>('/api/v1/scans', token),
        authFetch<UsageStatsResponse>('/api/v1/usage/stats', token).catch(() => ({ usage: { total_scans: 0 } })),
      ]);

      const scans = scansData.scans || [];
      return {
        totalTools: toolsData.total_tools || 0,
        scanSummary: {
          total: scans.length,
          running: scans.filter((s) => s.status === 'running').length,
          completed: scans.filter((s) => s.status === 'completed').length,
          failed: scans.filter((s) => s.status === 'failed').length,
        },
        recentScans: scans.slice(0, 5).map((s) => ({
          id: s.id,
          tool_name: s.tool?.name || s.tool_name || 'Unknown',
          target: s.target,
          status: s.status,
          started_at: s.created_at,
          findings: s.findings_count || 0,
        })),
        totalTargets: usageData.usage?.total_scans || scans.length,
      };
    },
    ...CACHE_TIMES.dashboard,
    enabled: !!token,
  });
}

// ==========================================
// SCANS HOOKS
// ==========================================

export interface Scan {
  id: string;
  tool?: { id: string; name: string; category?: string };
  tool_name?: string;
  target: string;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled' | 'pending' | 'timeout';
  started_at: string;
  completed_at?: string;
  created_at?: string;
  duration?: string;
  duration_seconds?: number;
  findings_summary?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    open_ports?: number;
  };
  findings_count?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  command?: string;
  output?: string;
  error_log?: string;
}

interface ScansListResponse {
  scans: Scan[];
  total?: number;
}

/**
 * Fetch scans list with 15s cache
 */
export function useScans(filters?: Record<string, string>) {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.scans.list(filters),
    queryFn: () => {
      const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return authFetch<ScansListResponse>(`/api/v1/scans${params}`, token);
    },
    ...CACHE_TIMES.scans,
    enabled: !!token,
    select: (data) => data.scans || [],
  });
}

/**
 * Fetch single scan details
 */
export function useScan(scanId: string | undefined) {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.scans.detail(scanId || ''),
    queryFn: () => authFetch<Scan>(`/api/v1/scans/${scanId}`, token),
    enabled: !!token && !!scanId,
    refetchInterval: (query) => {
      // Auto-refetch running scans every 3s
      const scan = query.state.data;
      return scan?.status === 'running' ? 3000 : false;
    },
  });
}

// ==========================================
// AGENTS HOOKS
// ==========================================

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  status: 'online' | 'offline' | 'busy' | 'error' | 'pending';
  status_emoji?: string;
  os: string;
  platform: 'linux' | 'windows' | 'macos' | 'docker';
  version?: string;
  last_seen: string | null;
  last_heartbeat?: string | null;
  cpu_usage: number;
  memory_usage: number;
  active_scans: number;
  total_scans: number;
  location?: string;
  connection_type: 'direct' | 'ssh';
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  registration_token?: string;
  created_at?: string;
}

export interface AgentsDashboard {
  total_agents: number;
  online: number;
  offline: number;
  busy: number;
  pending: number;
  total_scans_completed: number;
  agents: Agent[];
}

/**
 * Fetch agents dashboard with 10s cache + auto-refetch
 */
export function useAgentsDashboard(autoRefresh = true) {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.agents.dashboard(),
    queryFn: () => authFetch<AgentsDashboard>('/api/v1/agents/dashboard', token),
    ...CACHE_TIMES.agents,
    refetchInterval: autoRefresh ? CACHE_TIMES.agents.refetchInterval : false,
    enabled: !!token,
  });
}

// ==========================================
// MUTATIONS
// ==========================================

/**
 * Cancel a scan
 */
export function useCancelScan() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) =>
      authFetch(`/api/v1/scans/${scanId}/cancel`, token, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scans.all });
    },
  });
}

/**
 * Delete a scan
 */
export function useDeleteScan() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) =>
      authFetch(`/api/v1/scans/${scanId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scans.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/**
 * Rerun a scan
 */
export function useRerunScan() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) =>
      authFetch<{ success: boolean; target?: string; error?: string }>(
        `/api/v1/scans/${scanId}/rerun`,
        token,
        { method: 'POST' }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scans.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/**
 * Delete an agent
 */
export function useDeleteAgent() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) =>
      authFetch(`/api/v1/agents/${agentId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.all });
    },
  });
}
