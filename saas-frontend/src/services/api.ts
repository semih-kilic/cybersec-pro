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

      const data = await response.json();

      if (!response.ok) {
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

  async executeScan(toolId: string, target: string, parameters: Record<string, unknown>) {
    return this.request<{
      success: boolean;
      scan_id: string;
      status: string;
      command: string;
      message: string;
    }>('/scan/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId, target, parameters }),
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
          onOutput(data.line);
        } else if (data.type === 'complete') {
          onComplete(data.result);
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

// Singleton instance
export const api = new ApiService();
export default api;
