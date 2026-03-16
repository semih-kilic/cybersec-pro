/**
 * CyberSec Pro API Service
 * Handles all API calls to the backend
 */

const API_BASE = '/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { error: 'Server returned non-JSON response. The backend may be unavailable.' };
      }

      const data = await response.json();

      if (!response.ok) {
        // Auto-logout on expired/invalid token
        if (response.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/dashboard/login';
          }
        }
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // ================================
  // AUTH
  // ================================

  async login(email: string, password: string) {
    return this.request<{
      access_token: string;
      user: User;
      organization: Organization;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    password: string;
    organization_name: string;
    first_name?: string;
    last_name?: string;
  }) {
    return this.request<{
      access_token: string;
      user: User;
      organization: Organization;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async googleAuth(credential: string) {
    return this.request<{
      access_token: string;
      user: User;
      organization: Organization;
    }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  async githubAuth(code: string) {
    return this.request<{
      access_token: string;
      user: User;
      organization: Organization;
    }>('/auth/github', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getCurrentUser() {
    return this.request<{
      user: User;
      organization: Organization;
    }>('/auth/me');
  }

  // ================================
  // MFA — V20
  // ================================

  async getMfaStatus() {
    return this.request<{
      mfa_enabled: boolean;
      mfa_enabled_at: string | null;
      backup_codes_remaining: number;
    }>('/auth/mfa/status');
  }

  async setupMfa() {
    return this.request<{
      secret: string;
      qr_code: string;
      issuer: string;
    }>('/auth/mfa/setup', { method: 'POST' });
  }

  async verifyMfaSetup(code: string) {
    return this.request<{
      message: string;
      backup_codes: string[];
    }>('/auth/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disableMfa(password: string) {
    return this.request<{ message: string }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async regenerateBackupCodes(password: string) {
    return this.request<{
      backup_codes: string[];
      message: string;
    }>('/auth/mfa/regenerate-backup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // ================================
  // TOOLS
  // ================================

  async getTools() {
    return this.request<{
      tools: Record<string, Tool[]>;
      total_tools: number;
      available_tools: number;
      user_plan: string;
    }>('/tools/available');
  }

  async getToolConfig(toolId: string) {
    return this.request<{
      tool: ToolConfig;
    }>(`/tools/${toolId}/config`);
  }

  // ================================
  // SCANS
  // ================================

  async getScans() {
    return this.request<{
      scans: Scan[];
      total: number;
    }>('/scans');
  }

  async getScan(scanId: string) {
    return this.request<{
      scan: Scan;
      execution_result?: ScanResult;
    }>(`/scan/${scanId}/result`);
  }

  async executeScan(toolId: string, target: string, parameters: Record<string, unknown>, agentId?: string, executionMode?: string) {
    return this.request<{
      success: boolean;
      scan_id: string;
      status: string;
      command: string;
      message: string;
      execution_mode?: string;
      engine?: string;
      agent?: {
        id: string;
        name: string;
        ip: string;
        dispatch_method: string;
      };
    }>('/scan/start', {
      method: 'POST',
      body: JSON.stringify({ 
        tool: toolId, 
        target, 
        parameters,
        ...(executionMode && { execution_mode: executionMode }),
        ...(agentId && { agent_id: agentId }),
      }),
    });
  }

  async getAgents() {
    return this.request<{
      agents: Array<{
        id: string;
        name: string;
        hostname: string;
        ip_address: string;
        status: string;
        platform: string;
        cpu_usage: number;
        memory_usage: number;
        active_scans: number;
        last_heartbeat: string;
      }>;
    }>('/agents');
  }

  // ── Plan & Features ──

  async getPlanInfo() {
    return this.request<{
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
    }>('/plan/info');
  }

  async getPlanFeatures() {
    return this.request<{
      plan: string;
      features: Record<string, boolean>;
      limits: Record<string, number>;
    }>('/plan/features');
  }

  async getAllPlans() {
    return this.request<{
      plans: Record<string, {
        price_eur: number;
        tool_count: number;
        daily_scan_limit: number | string;
        features: Record<string, boolean>;
      }>;
      total_tools: number;
    }>('/plans');
  }

  // ── Analytics ──

  async getAnalyticsOverview() {
    return this.request<{
      daily_trend: Array<{ date: string; scans: number }>;
      tool_usage: Array<{ name: string; count: number }>;
      status_distribution: Record<string, number>;
      target_distribution: Array<{ target: string; count: number }>;
      comparison: { this_week: number; last_week: number; change_pct: number };
      performance: { avg_duration_seconds: number; total_scans: number; success_rate: number };
      risk: { score: number; level: string; severity_totals: Record<string, number>; total_issues: number };
    }>('/analytics/overview');
  }

  // ── AI Features ──

  async aiSuggestTools(target: string, context?: string) {
    return this.request<{
      target: string;
      target_type: string;
      suggestions: Array<{
        tool_name: string;
        tool_id: string | null;
        reason: string;
        category: string;
        available: boolean;
        plan_required: string;
      }>;
      scan_plan: {
        phase_1: string;
        phase_2: string;
        phase_3: string;
        recommended_order: string[];
      };
    }>('/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ target, context }),
    });
  }

  async aiRemediation(scanId: string) {
    return this.request<{
      scan_id: string;
      tool: string;
      target: string;
      remediations: Array<{
        priority: number;
        issue: string;
        severity: string;
        fix: string;
        code_example: string;
        references: string[];
        estimated_effort: string;
      }>;
      total_issues: number;
      executive_summary: string;
    }>('/ai/remediation', {
      method: 'POST',
      body: JSON.stringify({ scan_id: scanId }),
    });
  }

  async aiReportSummary(scanIds: string[]) {
    return this.request<{
      summary: string;
      risk_score: number;
      risk_level: string;
      severity_breakdown: Record<string, number>;
      recommendations: string[];
    }>('/ai/report-summary', {
      method: 'POST',
      body: JSON.stringify({ scan_ids: scanIds }),
    });
  }

  async stopScan(scanId: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/scan/${scanId}/stop`, {
      method: 'POST',
    });
  }

  // SSE for real-time scan output
  streamScanOutput(scanId: string, onOutput: (line: string) => void, onComplete: (result: ScanResult) => void) {
    // EventSource doesn't support Authorization headers, so we pass token as query param
    const token = localStorage.getItem('token');
    const url = token 
      ? `${API_BASE}/scan/${scanId}/output?token=${encodeURIComponent(token)}`
      : `${API_BASE}/scan/${scanId}/output`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          onOutput(data.line || data.data || '');
        } else if (data.type === 'complete') {
          onComplete(data.result || { status: data.status || 'completed', exit_code: data.exit_code });
          eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }

  // ================================
  // USAGE
  // ================================

  async getUsageStats() {
    return this.request<{
      usage: {
        today_scans: number;
        week_scans: number;
        total_scans: number;
        completed_scans: number;
        failed_scans: number;
      };
      limits: {
        scans_per_day: number;
        tools: number;
      };
      plan: string;
    }>('/usage/stats');
  }

  // ================================
  // BILLING
  // ================================

  async getSubscription() {
    return this.request<{
      organization: Organization;
      subscription: Subscription | null;
    }>('/billing/subscription');
  }

  async createCheckoutSession(planType: string) {
    return this.request<{
      checkout_url: string;
    }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_type: planType }),
    });
  }

  // ================================
  // Service Manager (Super Admin)
  // ================================
  async getServiceManagerDashboard() {
    return this.request<ServiceManagerDashboard>('/admin/service-manager/dashboard');
  }

  async getServices() {
    return this.request<ServiceState[]>('/admin/service-manager/services');
  }

  async serviceAction(serviceId: string, action: 'start' | 'stop' | 'restart') {
    return this.request<{ success: boolean; message: string }>(`/admin/service-manager/services/${serviceId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async getSystemMetrics() {
    return this.request<SystemMetrics>('/admin/service-manager/system');
  }

  async getProcesses() {
    return this.request<Array<{ pid: number; name: string; cpu: number; memory_mb: number; status: string }>>('/admin/service-manager/processes');
  }

  async getServiceAlerts() {
    return this.request<ServiceAlert[]>('/admin/service-manager/alerts');
  }

  async acknowledgeAlert(alertId: string) {
    return this.request<void>(`/admin/service-manager/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
  }
}

// Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  avatar_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  created_at: string;
  is_active: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  plan_required: string;
  parameters: Record<string, ToolParameter>;
  is_available: boolean;
}

export interface ToolConfig extends Tool {
  command: string;
}

export interface ToolParameter {
  flag: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'target';
  description: string;
  default?: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface Scan {
  id: string;
  organization_id: string;
  user_id: string;
  tool_id: string;
  target: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output?: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  tool?: Tool;
}

export interface ScanResult {
  scan_id: string;
  tool: string;
  target: string;
  command: string;
  status: string;
  output: string;
  started_at: string;
  completed_at: string | null;
  exit_code?: number;
  error?: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_type: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

// ================================
// Service Manager (Super Admin)
// ================================
export interface ServiceManagerDashboard {
  system: SystemMetrics;
  services: ServiceState[];
  alerts: ServiceAlert[];
  summary: DashboardSummary;
}

export interface SystemMetrics {
  hostname: string;
  os: string;
  kernel: string;
  uptime_secs: number;
  cpu_count: number;
  cpu_usage_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  load_avg: [number, number, number];
  network_rx_bytes: number;
  network_tx_bytes: number;
  timestamp: string;
}

export interface ServiceState {
  config: {
    id: string;
    name: string;
    description: string;
    category: string;
    port: number | null;
    priority: number;
  };
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'failed' | 'degraded' | 'unknown';
  pid: number | null;
  uptime_secs: number | null;
  cpu_percent: number;
  memory_mb: number;
  restart_count: number;
  last_started: string | null;
  last_health_check: string | null;
  health_ok: boolean;
  error_message: string | null;
  logs_tail: string[];
}

export interface ServiceAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  service_id: string | null;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface DashboardSummary {
  total_services: number;
  running: number;
  stopped: number;
  failed: number;
  total_cpu_percent: number;
  total_memory_mb: number;
  uptime_formatted: string;
  overall_health: string;
}

// Singleton instance
export const api = new ApiService();
export default api;
