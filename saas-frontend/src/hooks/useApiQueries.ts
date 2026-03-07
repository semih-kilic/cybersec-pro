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
// SECURITY SUMMARY (Dashboard security score + issues)
// ==========================================

export interface OpenIssues {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface SecuritySummary {
  security_score: number;
  open_issues: OpenIssues;
}

/**
 * Fetch security score & vulnerability breakdown
 * Used by OverviewPage for the security overview widgets
 */
export function useSecuritySummary() {
  const { token } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'security-summary'],
    queryFn: () => authFetch<SecuritySummary>('/api/v1/dashboard/security-summary', token),
    ...CACHE_TIMES.dashboard,
    enabled: !!token,
    select: (data) => ({
      securityScore: data.security_score || 0,
      openIssues: data.open_issues || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    }),
    // Don't throw on 404 — new users have no data
    retry: 1,
  });
}

// ==========================================
// SCHEDULED SCANS
// ==========================================

export interface ScheduledScan {
  target?: string;
  name?: string;
  next_run?: string;
  frequency?: string;
  schedule?: string;
}

interface ScheduledScansResponse {
  schedules: ScheduledScan[];
}

/**
 * Fetch scheduled scans list
 */
export function useScheduledScans(limit = 5) {
  const { token } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'scheduled-scans'],
    queryFn: () => authFetch<ScheduledScansResponse>('/api/v1/schedules', token),
    ...CACHE_TIMES.dashboard,
    enabled: !!token,
    select: (data) => (data.schedules || []).slice(0, limit),
    retry: 1,
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

// ==========================================
// TARGETS HOOKS
// ==========================================

export interface Target {
  id: string;
  name: string;
  value: string;
  type: 'ip' | 'domain' | 'url' | 'cidr' | 'range';
  group_id?: string;
  group_name?: string;
  tags: string[];
  last_scan?: string;
  scans_count: number;
  risk_score?: number;
  created_at: string;
  notes?: string;
}

export interface TargetGroup {
  id: string;
  name: string;
  color: string;
  targets_count: number;
}

export function useTargets() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.targets.list(),
    queryFn: () => authFetch<{ targets: Target[] }>('/api/v1/targets', token),
    select: (data) => data.targets || [],
    ...CACHE_TIMES.targets,
    enabled: !!token,
  });
}

export function useTargetGroups() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.targets.groups(),
    queryFn: () => authFetch<{ groups: TargetGroup[] }>('/api/v1/target-groups', token),
    select: (data) => data.groups || [],
    ...CACHE_TIMES.targets,
    enabled: !!token,
  });
}

// ==========================================
// REPORTS HOOKS
// ==========================================

export interface ReportSummary {
  id: string;
  name: string;
  template: string;
  format: string;
  status: string;
  scan_ids: string[];
  sections: string[];
  total_findings: number;
  severity_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  risk_score: number;
  risk_level: string;
  file_size: number;
  created_at: string;
  completed_at: string;
}

export interface AvailableScan {
  id: string;
  name: string;
  tool: string;
  target: string;
  completed_at: string;
}

export function useReports() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.reports.list(),
    queryFn: () => authFetch<{ reports: ReportSummary[]; available_scans: AvailableScan[] }>('/api/v1/reports', token),
    ...CACHE_TIMES.reports,
    enabled: !!token,
  });
}

export function useReportTemplates() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.reports.templates(),
    queryFn: () => authFetch<{ templates: { id: string; name: string; description: string; icon: string; sections: string[]; format: string[] }[] }>('/api/v1/reports/templates', token),
    select: (data) => data.templates || [],
    ...CACHE_TIMES.reports,
    enabled: !!token,
  });
}

// ==========================================
// SCHEDULES HOOKS
// ==========================================

export interface ScheduledScanFull {
  id: string;
  name: string;
  tool_name: string;
  tool?: string;
  target: string;
  schedule_type: string;
  cron_expression?: string;
  hour?: number;
  minute?: number;
  day_of_week?: string;
  day_of_month?: number;
  next_run: string;
  last_run?: string;
  is_active: boolean;
  status?: 'active' | 'paused' | 'error';
  run_count: number;
  created_at: string;
}

export function useSchedules() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.schedules.list(),
    queryFn: () => authFetch<{ schedules: ScheduledScanFull[] }>('/api/v1/schedules', token),
    select: (data) => data.schedules || [],
    ...CACHE_TIMES.schedules,
    enabled: !!token,
  });
}

// ==========================================
// PROJECTS HOOKS
// ==========================================

export interface Project {
  id: string | number;
  name: string;
  description: string;
  target_type?: string;
  target_url?: string;
  target_ip?: string;
  target_count: number;
  scan_count: number;
  vulnerability_count: number;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at?: string;
  members?: { id: string; name: string; avatar?: string }[];
  tags?: string[];
}

export function useProjects() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => authFetch<{ projects: Record<string, unknown>[] }>('/api/v1/projects', token),
    select: (data) => (data.projects || []).map((p): Project => ({
      ...p as unknown as Project,
      target_count: (p.target_count as number) || 0,
      scan_count: (p.scan_count as number) || 0,
      vulnerability_count: (p.vulnerability_count as number) || 0,
      status: (p.status as string as Project['status']) || 'active',
      tags: (p.tags as string[]) || [],
      members: (p.members as Project['members']) || [],
    })),
    ...CACHE_TIMES.projects,
    enabled: !!token,
  });
}
