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
async function authFetch<T>(url: string, token: string | null | undefined, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    // Auto-logout on expired/invalid token
    if (res.status === 401) {
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/dashboard/login';
      }
    }
    let error: any = { error: `HTTP ${res.status}` };
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        error = await res.json();
      }
    } catch {}
    throw new Error(error.error || error.message || `Request failed: ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('Server returned non-JSON response');
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
  categories_total: number;
  trial_days: number;
}

/** Fetches dynamic tool counts per plan from /api/v1/tools/count (public endpoint) */
export function useToolCounts() {
  return useQuery<PlanToolCounts>({
    queryKey: ['toolCounts'],
    queryFn: () => authFetch<PlanToolCounts>('/api/v1/tools/count', undefined),
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
  gui_required?: boolean;
  group?: string;
  binary_name?: string;
  tool_type?: string;
  business_category?: string;
  maturity?: 'verified' | 'beta' | 'experimental';
  output_parser?: string | null;
}

export interface CategoryInfo {
  id?: string;
  name: string;
  icon?: string;
  description?: string;
  color?: string;
  tool_count?: number;
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
// PLAN INFO HOOK
// ==========================================

export interface PlanInfo {
  plan: string;
  config: {
    level: number;
    price_eur: number;
    tool_limit: number;
    daily_scan_limit: number;
    max_projects: number;
    max_team_members: number;
    max_agents: number;
    multi_tool_scan: number;
    features: Record<string, boolean>;
  };
  usage: {
    scans_today: number;
    scans_remaining: number;
    total_scans: number;
    team_members: number;
    online_agents: number;
    tools_accessible: number;
    tools_total: number;
  };
}

export function usePlanInfo() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.plan.info(),
    queryFn: () => authFetch<PlanInfo>('/api/v1/plan/info', token),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!token,
  });
}

// ==========================================
// DASHBOARD / OVERVIEW HOOKS
// ==========================================

interface DashboardToolsResponse {
  total_tools?: number;
  total?: number;
  [key: string]: unknown;
}

interface DashboardScansResponse {
  scans: Array<{
    id: string;
    tool?: { name: string };
    tool_name?: string;
    target: string;
    status: string;
    created_at?: string;
    started_at?: string;
    findings_count?: number;
    findings_summary?: { total?: number };
  }>;
}

interface UsageStatsResponse {
  scans_used?: number;
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

export function normalizeScansPayload<T = { id: string }>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  const maybeScans = (data as { scans?: unknown } | null | undefined)?.scans;
  return Array.isArray(maybeScans) ? (maybeScans as T[]) : [];
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
        authFetch<DashboardToolsResponse>('/api/v1/tools', token).catch((): DashboardToolsResponse => ({ total_tools: 0, total: 0 })),
        authFetch<DashboardScansResponse>('/api/v1/scans', token).catch((): DashboardScansResponse => ({ scans: [] })),
        authFetch<UsageStatsResponse>('/api/v1/usage/stats', token).catch(() => ({ usage: { total_scans: 0 } })),
      ]);

      const scans = normalizeScansPayload<DashboardScansResponse['scans'][number]>(scansData);
      return {
        totalTools: toolsData.total_tools || toolsData.total || 0,
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
          started_at: s.created_at || s.started_at || '',
          findings: s.findings_count || s.findings_summary?.total || 0,
        })),
        totalTargets: (usageData as any).scans_used || usageData.usage?.total_scans || scans.length,
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
  security_score?: number;
  risk_score?: number;
  open_issues?: OpenIssues;
  // Fields returned by the Rust backend
  total_scans?: number;
  completed_scans?: number;
  failed_scans?: number;
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
    select: (data) => {
      // Compute a score: use security_score if available, else derive from risk_score or scan stats
      let score = data.security_score || data.risk_score || 0;
      if (score === 0 && data.completed_scans && data.completed_scans > 0) {
        // Derive a basic score from completed vs failed ratio
        const total = (data.completed_scans || 0) + (data.failed_scans || 0);
        score = total > 0 ? Math.round((data.completed_scans / total) * 100) : 0;
      }
      return {
        securityScore: score,
        openIssues: data.open_issues || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      };
    },
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
    select: (data) => normalizeScansPayload<Scan>(data),
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
    onMutate: async (scanId: string) => {
      // Cancel in-flight queries to prevent overwriting optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.scans.all });
      // Snapshot current data for rollback
      const previousScans = qc.getQueriesData({ queryKey: queryKeys.scans.all });
      // Optimistically remove scan from all cached scan lists
      qc.setQueriesData({ queryKey: queryKeys.scans.all }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const data = old as Record<string, unknown>;
        if (Array.isArray(data.scans)) {
          return { ...data, scans: data.scans.filter((s: { id: string }) => s.id !== scanId) };
        }
        return old;
      });
      return { previousScans };
    },
    onError: (_err, _scanId, context) => {
      // Roll back optimistic update on failure
      if (context?.previousScans) {
        for (const [queryKey, data] of context.previousScans) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.scans.all });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
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

  // Default template metadata for merging with API data
  const templateDefaults: Record<string, { icon: string; sections: string[]; formats: string[] }> = {
    executive: { icon: '📊', sections: ['Risk Overview', 'Key Findings', 'Recommendations'], formats: ['html', 'pdf', 'json'] },
    technical: { icon: '🔧', sections: ['Vulnerability Details', 'CVE References', 'Technical Remediation'], formats: ['html', 'pdf', 'json'] },
    compliance: { icon: '📋', sections: ['Compliance Status', 'Control Mapping', 'Gap Analysis'], formats: ['html', 'pdf'] },
    owasp: { icon: '🛡️', sections: ['OWASP Top 10 Mapping', 'Vulnerability Details', 'Remediation'], formats: ['html', 'pdf', 'json'] },
    pci: { icon: '💳', sections: ['PCI DSS Requirements', 'Assessment', 'Gaps'], formats: ['html', 'pdf'] },
    iso: { icon: '🏢', sections: ['ISO 27001 Controls', 'Risk Assessment', 'Statement of Applicability'], formats: ['html', 'pdf'] },
    full: { icon: '📑', sections: ['Executive Summary', 'Technical Details', 'Vulnerabilities', 'Recommendations', 'Appendix'], formats: ['html', 'pdf', 'json', 'csv', 'markdown'] },
  };

  return useQuery({
    queryKey: queryKeys.reports.templates(),
    queryFn: () => authFetch<{ templates: { id: string; name: string; description: string; icon?: string; sections?: string[]; formats?: string[]; frameworks?: string[] }[] }>('/api/v1/reports/templates', token),
    select: (data) => (data.templates || []).map(t => ({
      ...t,
      icon: t.icon || templateDefaults[t.id]?.icon || '📄',
      sections: t.sections || templateDefaults[t.id]?.sections || ['Summary'],
      formats: t.formats || templateDefaults[t.id]?.formats || ['html', 'pdf'],
      frameworks: t.frameworks ?? [],
    })),
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

// ==========================================
// ANALYTICS HOOKS
// ==========================================

export interface AnalyticsData {
  daily_trend: Array<{ date: string; scans: number; avg_duration_seconds?: number; success_rate?: number }>;
  tool_usage: Array<{ name: string; count: number }>;
  status_distribution: Record<string, number>;
  target_distribution: Array<{ target: string; count: number }>;
  comparison: { this_week: number; last_week: number; change_pct: number };
  performance: { avg_duration_seconds: number; total_scans: number; success_rate: number };
  risk: { score: number; level: string; severity_totals: Record<string, number>; total_issues: number };
}

export function useAnalyticsOverview(timeRange?: string) {
  const { token } = useAuth();

  return useQuery<AnalyticsData>({
    queryKey: queryKeys.analytics.overview(timeRange),
    queryFn: () => authFetch<AnalyticsData>('/api/v1/analytics/overview', token),
    ...CACHE_TIMES.analytics,
    enabled: !!token,
  });
}

// ==========================================
// ADMIN HOOKS
// ==========================================

export interface AdminOverview {
  users: { total: number; active: number; list: Array<{ id: string; email: string; first_name: string; last_name: string; role: string; organization_id: string; is_active: boolean; created_at: string }> };
  organizations: { total: number; plans_distribution: Record<string, number>; list: Array<{ id: string; name: string; slug: string; plan_type: string; is_active: boolean }> };
  scans: { total: number; running: number; recent: Array<{ id: string; target: string; status: string; created_at: string }> };
  agents: { total: number; online: number };
  revenue: { mrr: number; arr: number };
}

export function useAdminOverview() {
  const { token } = useAuth();

  return useQuery<AdminOverview>({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => authFetch<AdminOverview>('/api/v1/admin/overview', token),
    ...CACHE_TIMES.admin,
    enabled: !!token,
  });
}

export function useImpersonateUser() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (email: string) =>
      authFetch<{ token: string }>('/api/v1/admin/impersonate', token, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

export function useChangePlan() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ organizationId, planType }: { organizationId: string; planType: string }) =>
      authFetch('/api/v1/admin/change-plan', token, {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, plan_type: planType }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
      qc.invalidateQueries({ queryKey: ['auth'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

// ==========================================
// PURPLE TEAM HOOKS
// ==========================================

export interface PurpleTeamStats {
  total_exercises: number;
  running: number;
  completed: number;
  total_attack_steps: number;
  total_detected: number;
  total_missed: number;
  detection_rate: number;
  average_risk_score: number;
  available_chains: number;
  available_playbooks: number;
}

export interface AttackChain {
  id: string;
  name: string;
  description: string;
  severity: string;
  steps_count: number;
  mitre_tactics: string[];
  tools_used: string[];
}

export interface Playbook {
  id: string;
  name: string;
  trigger: string;
  severity: string;
  mitre_techniques: string[];
  response_actions_count: number;
  auto_actions: number;
  detection_logic: Record<string, unknown>;
}

export interface PurpleExercise {
  id: string;
  name: string;
  attack_chain_id: string;
  target: string;
  status: string;
  started_at: string;
  completed_at: string;
  total_steps: number;
  completed_steps: number;
  detected_attacks: number;
  missed_attacks: number;
  risk_score: number;
  red_team_results: unknown[];
  blue_team_alerts: unknown[];
  gap_analysis: unknown;
  coverage_map: Record<string, unknown>;
}

export interface MitreTactic {
  name: string;
  techniques: { id: string; name: string; subtechniques_count: number }[];
  total: number;
}

export interface PurpleTeamProfileSummary {
  organization_id: string;
  source: 'db' | 'default';
  profile: {
    chains?: {
      credential?: number;
      lateral?: number;
      default?: number;
    };
    target?: {
      prod_penalty?: number;
      dev_bonus?: number;
    };
    bounds?: {
      min?: number;
      max?: number;
    };
  };
}

export function usePurpleTeamStats() {
  const { token } = useAuth();

  return useQuery<PurpleTeamStats>({
    queryKey: queryKeys.purpleTeam.dashboard(),
    queryFn: () => authFetch<PurpleTeamStats>('/api/v1/purple-team/dashboard', token),
    ...CACHE_TIMES.purpleTeam,
    enabled: !!token,
  });
}

export function usePurpleTeamProfileSummary(enabled = true) {
  const { token } = useAuth();

  return useQuery<PurpleTeamProfileSummary>({
    queryKey: queryKeys.purpleTeam.profile(),
    queryFn: () => authFetch<PurpleTeamProfileSummary>('/api/v1/settings/purple-team/profile', token),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!token && enabled,
  });
}

export function useAttackChains() {
  const { token } = useAuth();

  return useQuery<AttackChain[]>({
    queryKey: queryKeys.purpleTeam.chains(),
    queryFn: () => authFetch<AttackChain[]>('/api/v1/purple-team/chains', token),
    ...CACHE_TIMES.purpleTeam,
    enabled: !!token,
  });
}

export function usePlaybooks() {
  const { token } = useAuth();

  return useQuery<Playbook[]>({
    queryKey: queryKeys.purpleTeam.playbooks(),
    queryFn: () => authFetch<Playbook[]>('/api/v1/purple-team/playbooks', token),
    ...CACHE_TIMES.purpleTeam,
    enabled: !!token,
  });
}

export function usePurpleTeamExercises(autoRefresh = false) {
  const { token } = useAuth();

  return useQuery<PurpleExercise[]>({
    queryKey: queryKeys.purpleTeam.exercises(),
    queryFn: () => authFetch<PurpleExercise[]>('/api/v1/purple-team/exercises', token),
    ...CACHE_TIMES.purpleTeam,
    refetchInterval: autoRefresh ? 3000 : false,
    enabled: !!token,
  });
}

export function usePurpleTeamExercise(id: string | null) {
  const { token } = useAuth();

  return useQuery<PurpleExercise>({
    queryKey: queryKeys.purpleTeam.exercise(id || ''),
    queryFn: () => authFetch<PurpleExercise>(`/api/v1/purple-team/exercises/${id}`, token),
    ...CACHE_TIMES.purpleTeam,
    enabled: !!token && !!id,
  });
}

export function useMitreMatrix() {
  const { token } = useAuth();

  return useQuery<Record<string, MitreTactic>>({
    queryKey: queryKeys.purpleTeam.mitreMatrix(),
    queryFn: () => authFetch<Record<string, MitreTactic>>('/api/v1/purple-team/mitre-matrix', token),
    staleTime: 5 * 60_000,  // MITRE matrix is static data
    gcTime: 30 * 60_000,
    enabled: !!token,
  });
}

export function useStartExercise() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { chain_id: string; target: string; name?: string }) =>
      authFetch<PurpleExercise>('/api/v1/purple-team/exercises', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.exercises() });
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.dashboard() });
    },
  });
}

export interface PurpleTelemetryPayload {
  step_index: number;
  technique_id: string;
  detected: boolean;
  source?: string;
  confidence?: number;
}

export function useAbortExercise() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) =>
      authFetch<{ success: boolean; id: string; status: string }>(`/api/v1/purple-team/exercises/${exerciseId}/abort`, token, {
        method: 'POST',
      }),
    onSuccess: (_, exerciseId) => {
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.exercises() });
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.exercise(exerciseId) });
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.dashboard() });
    },
  });
}

export function useIngestExerciseTelemetry() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ exerciseId, telemetry }: { exerciseId: string; telemetry: PurpleTelemetryPayload }) =>
      authFetch<{ success: boolean; id: string; status: string; detected_attacks: number; missed_attacks: number; detection_coverage_alert?: string; attack_chain_id?: string; gap_analysis?: { total_attacks: number; detected: number; missed: number; detection_rate: number } }>(
        `/api/v1/purple-team/exercises/${exerciseId}/telemetry`,
        token,
        {
          method: 'POST',
          body: JSON.stringify(telemetry),
        }
      ),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.exercises() });
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.exercise(variables.exerciseId) });
      qc.invalidateQueries({ queryKey: queryKeys.purpleTeam.dashboard() });
    },
  });
}

// ==========================================
// TERMINAL HOOKS
// ==========================================

export interface TerminalAgent {
  id: number | string;
  name: string;
  hostname: string;
  ip_address: string;
  platform: string;
  status: string;
  ssh_host: string;
  ssh_port: number;
  ssh_username: string;
  connection_type?: string;
}

export function normalizeAgentsPayload<T = TerminalAgent>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  const maybeAgents = (data as { agents?: unknown } | null | undefined)?.agents;
  return Array.isArray(maybeAgents) ? (maybeAgents as T[]) : [];
}

export function useTerminalAgents() {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.terminal.agents(),
    queryFn: () => authFetch<{ agents: TerminalAgent[] }>('/api/v1/terminal/agents', token),
    select: (data) => normalizeAgentsPayload<TerminalAgent>(data),
    ...CACHE_TIMES.terminal,
    enabled: !!token,
  });
}

// ==========================================
// SCAN MUTATIONS
// ==========================================

export function useStartScan() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { tool: string; target: string; parameters?: Record<string, unknown>; agent_id?: number | null; project_id?: number | null }) =>
      authFetch<{ success: boolean; scan_id: string; error?: string; hint?: string; requires_confirmation?: boolean }>(
        '/api/v1/scan/start', token, {
          method: 'POST',
          body: JSON.stringify({
            tool: data.tool,
            target: data.target,
            parameters: data.parameters,
            ...(data.agent_id ? { agent_id: String(data.agent_id) } : {}),
            ...(data.project_id ? { project_id: data.project_id } : {}),
          }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scans.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useSubmitFeedback() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch('/api/v1/feedback', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useSendChatMessage() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (data: { message: string; quick_action?: string }) =>
      authFetch<{ response: string; quick_actions?: Array<{ id: string; label: string }> }>(
        '/api/v1/chatbot/message', token, {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
  });
}

// ============================================================
// V18.9: SSO, Profile, Agent, Schedule, Report, Project mutations
// ============================================================

// ---- SSO Config ----

export function useSSOConfig() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.sso.config(),
    queryFn: () => authFetch<{ config: Record<string, unknown> | null }>('/api/v1/sso/config', token),
    ...CACHE_TIMES.sso,
  });
}

export function useSaveSSOConfig() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch<{ config: Record<string, unknown> }>('/api/v1/sso/config', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.sso.all }); },
  });
}

export function useTestSSOConnection() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: { provider_type: string }) =>
      authFetch<{ success: boolean; message?: string }>('/api/v1/sso/test', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteSSOConfig() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authFetch<{ success: boolean }>('/api/v1/sso/config', token, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.sso.all }); },
  });
}

export function useToggleSSO() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      authFetch<{ success: boolean }>('/api/v1/sso/toggle', token, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.sso.all }); },
  });
}

// ---- Profile mutations ----

export function useUploadAvatar() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/auth/upload-avatar', {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload avatar');
      return res.json() as Promise<{ avatar_url?: string }>;
    },
  });
}

export function useUpdateProfile() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: { first_name: string; last_name: string; company: string }) =>
      authFetch('/api/v1/auth/profile', token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  });
}

// ---- Agent mutations ----

export function useCreateAgent() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch<{ registration_token?: string; install_command?: string; error?: string }>(
        '/api/v1/agents', token, { method: 'POST', body: JSON.stringify(data) }
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.agents.all }); },
  });
}

export function useUpdateAgent() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      authFetch(`/api/v1/agents/${id}`, token, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.agents.all }); },
  });
}

export function useTestAgentConnection() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) =>
      authFetch<{ success: boolean; os_info?: string; error?: string }>(
        `/api/v1/agents/${agentId}/test`, token, { method: 'POST' }
      ),
    onSuccess: (data) => {
      if (data.success) qc.invalidateQueries({ queryKey: queryKeys.agents.all });
    },
  });
}

// ---- Schedule mutations ----

export function useToggleSchedule() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) =>
      authFetch(`/api/v1/schedules/${scheduleId}/toggle`, token, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.schedules.all }); },
  });
}

export function useDeleteSchedule() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) =>
      authFetch(`/api/v1/schedules/${scheduleId}`, token, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.schedules.all }); },
  });
}

export function useSaveSchedule() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      const url = id ? `/api/v1/schedules/${id}` : '/api/v1/schedules';
      const method = id ? 'PUT' : 'POST';
      return authFetch(url, token, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.schedules.all }); },
  });
}

export function useRunScheduleNow() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (data: { tool: string; target: string }) =>
      authFetch('/api/v1/scan/start', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

// ---- Report mutations ----

export function useGenerateReport() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate report');
      }
      // Return raw response for PDF blob handling
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.reports.all }); },
  });
}

export function useFetchReport() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (reportId: string) =>
      authFetch<{ content: string }>(`/api/v1/reports/${reportId}`, token),
  });
}

export function useDeleteReport() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      authFetch(`/api/v1/reports/${reportId}`, token, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.reports.all }); },
  });
}

// ---- Project mutations ----

export function useCreateProject() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      authFetch('/api/v1/projects', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.projects.all }); },
  });
}

export function useDeleteProject() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string | number) =>
      authFetch(`/api/v1/projects/${projectId}`, token, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.projects.all }); },
  });
}

// ---- Upgrade/Checkout mutation ----

export function useCreateCheckout() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (data: { plan: string; billing: string }) => {
      const res = await fetch('/api/v1/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan: data.plan,
          billing: data.billing,
          success_url: `${window.location.origin}/dashboard/settings?tab=billing&success=true`,
          cancel_url: `${window.location.origin}/dashboard/upgrade`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment request failed');
      const url = json.checkout_url || json.url;
      if (url) return { checkout_url: url } as { checkout_url: string };
      throw new Error('No checkout URL received');
    },
  });
}

export function useOpenBillingPortal() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to open billing portal');
      const url = json.portal_url;
      if (url) return { portal_url: url } as { portal_url: string };
      throw new Error('No portal URL received');
    },
  });
}

// ---- Admin: impersonate ----

export function useImpersonateUserAction() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      authFetch<{ token: string }>('/api/v1/admin/impersonate', token, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

// ---- Tool execution mode (ScanExecutionPage) ----

export function useToolExecutionMode(toolId: string | undefined) {
  const { token } = useAuth();

  return useQuery({
    queryKey: queryKeys.tools.executionMode(toolId || ''),
    queryFn: () => authFetch<{ execution_mode: string; supports_streaming: boolean }>(
      `/api/v1/tools/${toolId}/execution-mode`, token
    ),
    enabled: !!toolId && !!token,
    staleTime: CACHE_TIMES.tools.staleTime,
    gcTime: CACHE_TIMES.tools.gcTime,
  });
}

// ---- Business report (ScanExecutionPage, imperative) ----

export function useFetchBusinessReport() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (scanId: string) =>
      authFetch<any>(`/api/v1/scans/${scanId}/business-report`, token),
  });
}

// ---- Agents list (NewScanPage) ----

export function useAgentsList() {
  const { token } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.agents.all, 'list'],
    queryFn: () => authFetch<{ agents: any[] }>('/api/v1/agents', token),
    select: (data) => data.agents || [],
    ...CACHE_TIMES.agents,
    enabled: !!token,
  });
}

// ---- Public: Tools catalog (ToolsCatalogPage) ----

export function useToolsCatalog() {
  return useQuery({
    queryKey: queryKeys.tools.catalog(),
    queryFn: async () => {
      const res = await fetch('/api/v1/tools/catalog');
      if (!res.ok) throw new Error('Failed to fetch catalog');
      const data = await res.json();
      if (!data.success) throw new Error('Catalog fetch failed');
      return { tools: data.tools, categories: data.categories };
    },
    staleTime: CACHE_TIMES.tools.staleTime,
    gcTime: CACHE_TIMES.tools.gcTime,
  });
}

export function useToolsStats() {
  return useQuery({
    queryKey: queryKeys.tools.stats(),
    queryFn: async () => {
      const res = await fetch('/api/v1/tools/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      if (!data.success) throw new Error('Stats fetch failed');
      return data.stats;
    },
    staleTime: CACHE_TIMES.tools.staleTime,
    gcTime: CACHE_TIMES.tools.gcTime,
  });
}

// ---- DashboardPage (legacy, authenticated) ----

export function useDashboardTools() {
  const { token } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.tools.all, 'dashboard'],
    queryFn: () => authFetch<{ tools: Record<string, any[]>; total_tools: number }>('/api/v1/tools', token),
    ...CACHE_TIMES.tools,
    enabled: !!token,
  });
}

export function useDashboardScans() {
  const { token } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.scans.all, 'dashboard'],
    queryFn: () => authFetch<{ scans: any[] }>('/api/v1/scans', token),
    select: (data) => normalizeScansPayload<DashboardScansResponse['scans'][number]>(data),
    ...CACHE_TIMES.scans,
    enabled: !!token,
  });
}

// ── Integrations ────────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  integration_type: string;
  webhook_url?: string;
  is_active: boolean;
  last_triggered_at?: string;
  last_error?: string;
  config?: Record<string, unknown>;
  created_at: string;
}

export function useIntegrations() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => authFetch<{ integrations: Integration[] }>('/api/v1/integrations', token),
    select: (data) => data.integrations || [],
    enabled: !!token,
  });
}

export function useCreateIntegration() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch('/api/v1/integrations', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useUpdateIntegration() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      authFetch(`/api/v1/integrations/${id}`, token, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useDeleteIntegration() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/v1/integrations/${id}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useToggleIntegration() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch(`/api/v1/integrations/${id}/toggle`, token, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useTestIntegration() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<{ success: boolean; message?: string; error?: string }>(`/api/v1/integrations/${id}/test`, token, { method: 'POST' }),
  });
}

// ── Roles ───────────────────────────────────────────────────

export function useRoles() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => authFetch<{ roles: Array<{ id: string; name: string; level: number; description: string }> }>('/api/v1/roles', token),
    select: (data) => data.roles || [],
    enabled: !!token,
  });
}

// ── Organization Logo ────────────────────────────────────────

export function useOrgLogo() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['org-logo'],
    queryFn: () => authFetch<{ logo_url: string | null }>('/api/v1/organization/logo', token),
    select: (data) => data.logo_url,
    enabled: !!token,
  });
}

export function useUploadOrgLogo() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const bytes = await file.arrayBuffer();
      const res = await fetch('/api/v1/organization/logo', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: new Uint8Array(bytes),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-logo'] }); },
  });
}

export function useDeleteOrgLogo() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/organization/logo', {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-logo'] }); },
  });
}

// ══════════════════════════════════════════════════
// PHASE 1 — Security: Login History + IP Whitelist
// ══════════════════════════════════════════════════

export function useLoginHistory(limit = 20, offset = 0) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['login-history', limit, offset],
    queryFn: () => authFetch(`/api/v1/security/login-history?limit=${limit}&offset=${offset}`, token),
    staleTime: 30_000,
  });
}

export function useActiveSessions() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => authFetch('/api/v1/security/sessions', token),
    staleTime: 60_000,
  });
}

export function useAuditLogs(limit = 50, offset = 0) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['audit-logs', limit, offset],
    queryFn: () => authFetch(`/api/v1/security/audit-logs?limit=${limit}&offset=${offset}`, token),
    staleTime: 30_000,
  });
}

export function useIpWhitelist() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: () => authFetch('/api/v1/security/ip-whitelist', token),
    staleTime: 60_000,
  });
}

export function useAddIpWhitelist() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ip_cidr: string; label?: string }) =>
      authFetch('/api/v1/security/ip-whitelist', token, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-whitelist'] }),
  });
}

export function useRemoveIpWhitelist() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ipId: string) =>
      authFetch(`/api/v1/security/ip-whitelist/${ipId}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-whitelist'] }),
  });
}

// ══════════════════════════════════════════════════
// PHASE 1 — API Key: Rotate + Stats
// ══════════════════════════════════════════════════

export function useApiKeyStats() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['api-key-stats'],
    queryFn: () => authFetch('/api/v1/settings/api-keys/stats', token),
    staleTime: 60_000,
  });
}

export function useRotateApiKey() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      authFetch(`/api/v1/settings/api-keys/${keyId}/rotate`, token, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      qc.invalidateQueries({ queryKey: ['api-key-stats'] });
    },
  });
}

// ══════════════════════════════════════════════════
// PHASE 3 — Scan Templates
// ══════════════════════════════════════════════════

export function useScanTemplates() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['scan-templates'],
    queryFn: () => authFetch('/api/v1/scan-templates', token),
    staleTime: 120_000,
  });
}

export function useCreateScanTemplate() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; tool_id?: string; parameters?: Record<string, unknown>; is_public?: boolean }) =>
      authFetch('/api/v1/scan-templates', token, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-templates'] }),
  });
}

export function useDeleteScanTemplate() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      authFetch(`/api/v1/scan-templates/${templateId}`, token, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-templates'] }),
  });
}

// ══════════════════════════════════════════════════
// PHASE 5 — Analytics Trend
// ══════════════════════════════════════════════════

export function useAnalyticsTrend(days = 30) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['analytics-trend', days],
    queryFn: () => authFetch(`/api/v1/analytics/trend?days=${days}`, token),
    staleTime: 300_000,
  });
}

// ══════════════════════════════════════════════════
// PHASE 6 — CyberSec Pro AI Jobs
// ══════════════════════════════════════════════════

export function useCyberSecAIJobs() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["cybersec-ai-jobs"],
    queryFn: () => authFetch('/api/v1/cybersec-ai/jobs', token),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data as { cybersec_ai_jobs?: Array<{ status: string }> } | undefined;
      const hasActive = data?.cybersec_ai_jobs?.some(j => j.status === 'queued' || j.status === 'running');
      return hasActive ? 5_000 : false;
    },
  });
}

export function useCreateCyberSecAIJob() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { target: string; target_type?: string; job_type?: string; agents_config?: Record<string, boolean> }) =>
      authFetch('/api/v1/cybersec-ai/jobs', token, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cybersec-ai-jobs"] }),
  });
}

export function useCyberSecAIJob(jobId: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["cybersec-ai-job", jobId],
    queryFn: () => authFetch(`/api/v1/cybersec-ai/jobs/${jobId}`, token),
    enabled: !!jobId,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      return data?.status === 'running' || data?.status === 'queued' || data?.status === 'cancelling' ? 3_000 : false;
    },
  });
}

export function useCancelCyberSecAIJob() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      authFetch(`/api/v1/cybersec-ai/jobs/${jobId}/cancel`, token, { method: 'POST' }),
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: ["cybersec-ai-jobs"] });
      qc.invalidateQueries({ queryKey: ["cybersec-ai-job", jobId] });
    },
  });
}

export function useDeleteCyberSecAIJob() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      authFetch(`/api/v1/cybersec-ai/jobs/${jobId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cybersec-ai-jobs"] });
    },
  });
}


// ── CyberSec Pro AI — Intelligent Assistant ─────────────────

export function useAITools() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['ai-tools'],
    queryFn: () => authFetch('/api/v1/ai/tools', token),
    staleTime: 60 * 60_000, // 1h cache
    enabled: !!token,
  });
}

export function useAISuggestTools() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { query: string; target_type?: string; use_llm?: boolean }) =>
      authFetch('/api/v1/ai/suggest-tools', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useAIGenerateCommand() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { tool_id: string; target: string; options?: Record<string, unknown> }) =>
      authFetch('/api/v1/ai/generate-command', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useAIPlaybook() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { goal: string; target: string; use_llm?: boolean }) =>
      authFetch('/api/v1/ai/playbook', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useAIExplain() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { tool_id?: string; command?: string; use_llm?: boolean }) =>
      authFetch('/api/v1/ai/explain', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useAIInterpretResults() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { findings: unknown; use_llm?: boolean }) =>
      authFetch('/api/v1/ai/interpret-results', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

export function useAIValidateCommand() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (body: { command: string }) =>
      authFetch('/api/v1/ai/validate-command', token, { method: 'POST', body: JSON.stringify(body) }),
  });
}

// ==========================================
// SUPERADMIN — God Mode endpoints
// ==========================================

export interface SuperadminTelemetry {
  host: { name: string | null; os: string | null; kernel: string | null; uptime_secs: number; boot_time: number };
  cpu: {
    usage_pct: number;
    core_count: number;
    physical_core_count: number | null;
    load_avg_1: number;
    load_avg_5: number;
    load_avg_15: number;
    per_core: Array<{ name: string; usage_pct: number; frequency_mhz: number }>;
  };
  memory: { total_bytes: number; used_bytes: number; available_bytes: number; usage_pct: number; swap_total_bytes: number; swap_used_bytes: number };
  disk: { total_bytes: number; used_bytes: number; usage_pct: number; devices: Array<{ name: string; mount: string; fs: string; total_bytes: number; available_bytes: number; used_bytes: number; usage_pct: number }> };
  network: { received_bytes_window: number; transmitted_bytes_window: number; interfaces: Array<{ name: string; received_bytes_total: number; transmitted_bytes_total: number; received_bytes_window: number; transmitted_bytes_window: number }> };
  process: { count: number };
}

/** Polls /api/v1/superadmin/telemetry every 2 seconds. */
export function useSuperadminTelemetry(enabled = true) {
  const { token } = useAuth();
  return useQuery<SuperadminTelemetry>({
    queryKey: ['superadmin', 'telemetry'],
    queryFn: () => authFetch<SuperadminTelemetry>('/api/v1/superadmin/telemetry', token),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    enabled: enabled && !!token,
  });
}

export interface SuperadminDbStats {
  database: { name: string; size_bytes: number };
  pool: { size: number; idle: number };
  active_connections: number;
  active_queries: Array<{ pid: number; usename: string | null; application_name: string | null; client_addr: string | null; state: string | null; query: string | null; query_start: string | null }>;
  top_tables: Array<{ schema: string; name: string; row_count: number; size_bytes: number; index_size_bytes: number }>;
}

export function useSuperadminDbStats(enabled = true) {
  const { token } = useAuth();
  return useQuery<SuperadminDbStats>({
    queryKey: ['superadmin', 'dbstats'],
    queryFn: () => authFetch<SuperadminDbStats>('/api/v1/superadmin/db-stats', token),
    refetchInterval: 10000,
    staleTime: 0,
    enabled: enabled && !!token,
  });
}

export interface SuperadminLogs {
  unit: string;
  lines: number;
  output: string;
}

export function useSuperadminLogs(unit: string, lines: number, enabled = true) {
  const { token } = useAuth();
  return useQuery<SuperadminLogs>({
    queryKey: ['superadmin', 'logs', unit, lines],
    queryFn: () => authFetch<SuperadminLogs>(`/api/v1/superadmin/logs?unit=${encodeURIComponent(unit)}&lines=${lines}`, token),
    refetchInterval: 5000,
    staleTime: 0,
    enabled: enabled && !!token,
  });
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useFeatureFlags(enabled = true) {
  const { token } = useAuth();
  return useQuery<{ flags: FeatureFlag[] }>({
    queryKey: ['superadmin', 'flags'],
    queryFn: () => authFetch<{ flags: FeatureFlag[] }>('/api/v1/superadmin/feature-flags', token),
    refetchInterval: 15000,
    enabled: enabled && !!token,
  });
}

export function useUpsertFeatureFlag() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; enabled: boolean; description?: string }) =>
      authFetch(`/api/v1/superadmin/feature-flags/${encodeURIComponent(body.key)}`, token, {
        method: 'PUT',
        body: JSON.stringify({ enabled: body.enabled, description: body.description ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'flags'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'killSwitch'] });
    },
  });
}

export interface KillSwitchStatus { engaged: boolean; reason?: string | null; updated_at?: string | null }

export function useKillSwitchStatus(enabled = true) {
  const { token } = useAuth();
  return useQuery<KillSwitchStatus>({
    queryKey: ['superadmin', 'killSwitch'],
    queryFn: () => authFetch<KillSwitchStatus>('/api/v1/superadmin/kill-switch', token),
    refetchInterval: 5000,
    enabled: enabled && !!token,
  });
}

export function useToggleKillSwitch() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { engaged: boolean; reason?: string }) =>
      authFetch('/api/v1/superadmin/kill-switch', token, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'killSwitch'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'flags'] });
    },
  });
}

// ── Superadmin: organizations & plan management ───────────────────────────
export interface SuperadminOrg {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  owner_email: string | null;
}
export interface SuperadminOrgsResponse {
  organizations: SuperadminOrg[];
  available_plans: string[];
  count: number;
}

export function useSuperadminOrganizations(q: string, enabled = true) {
  const { token } = useAuth();
  return useQuery<SuperadminOrgsResponse>({
    queryKey: ['superadmin', 'orgs', q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '200');
      return authFetch<SuperadminOrgsResponse>(`/api/v1/superadmin/organizations?${params.toString()}`, token);
    },
    refetchInterval: 30000,
    staleTime: 5000,
    enabled: enabled && !!token,
  });
}

export function useChangeOrgPlan() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { org_id: string; plan_type: string; reason?: string }) =>
      authFetch(`/api/v1/superadmin/organizations/${encodeURIComponent(body.org_id)}/plan`, token, {
        method: 'PUT',
        body: JSON.stringify({ plan_type: body.plan_type, reason: body.reason ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin', 'orgs'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
    },
  });
}
