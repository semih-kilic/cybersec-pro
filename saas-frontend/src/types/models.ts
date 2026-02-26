/**
 * 🐉 CyberSec Pro — Shared TypeScript Models
 * Single source of truth for all domain types
 */

// ==========================================
// USER & AUTH
// ==========================================
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'viewer';
  email_verified: boolean;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface Organization {
  id: string;
  name: string;
  plan_type: PlanType;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  member_count: number;
  scan_limit: number;
  scans_used: number;
}

export type PlanType = 'free' | 'trial' | 'starter' | 'professional' | 'enterprise';

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// ==========================================
// TOOLS
// ==========================================
export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ToolCategory;
  subcategory?: string;
  plan_required: PlanType;
  installed: boolean;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
  version?: string;
  website?: string;
  documentation?: string;
}

export type ToolCategory =
  | 'information_gathering'
  | 'vulnerability_analysis'
  | 'web_application'
  | 'password_attacks'
  | 'wireless_attacks'
  | 'sniffing_spoofing'
  | 'exploitation'
  | 'post_exploitation'
  | 'forensics'
  | 'reverse_engineering'
  | 'reporting'
  | 'networking';

export interface ToolPreset {
  id: string;
  name: string;
  description: string;
  command_template: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  flag: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  default?: string | number | boolean;
  options?: string[];
  description: string;
}

// ==========================================
// SCANS
// ==========================================
export type ScanStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export interface Scan {
  id: string;
  tool_name: string;
  tool_id?: string;
  target: string;
  status: ScanStatus;
  command?: string;
  output?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  duration_seconds?: number;
  exit_code?: number;
  findings?: Finding[];
  findings_count?: number;
  severity_summary?: SeveritySummary;
  project_id?: string;
  scheduled?: boolean;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  remediation?: string;
  cve?: string;
  cvss_score?: number;
  port?: number;
  protocol?: string;
  service?: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

// ==========================================
// TARGETS
// ==========================================
export interface Target {
  id: string;
  name: string;
  type: 'ip' | 'domain' | 'cidr' | 'url';
  value: string;
  description?: string;
  tags: string[];
  last_scanned?: string;
  scan_count: number;
  created_at: string;
}

// ==========================================
// PROJECTS
// ==========================================
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  targets: Target[];
  scans_count: number;
  findings_count: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// REPORTS
// ==========================================
export interface Report {
  id: string;
  name: string;
  type: 'pdf' | 'html' | 'json' | 'csv';
  scan_ids: string[];
  status: 'generating' | 'ready' | 'failed';
  download_url?: string;
  created_at: string;
  size_bytes?: number;
}

// ==========================================
// ANALYTICS
// ==========================================
export interface AnalyticsData {
  daily_trend: Array<{ date: string; scans: number }>;
  tool_usage: Array<{ name: string; count: number }>;
  status_distribution: Record<string, number>;
  target_distribution: Array<{ target: string; count: number }>;
  comparison: { this_week: number; last_week: number; change_pct: number };
  performance: { avg_duration_seconds: number; total_scans: number; success_rate: number };
  risk: { score: number; level: string; severity_totals: Record<string, number>; total_issues: number };
}

// ==========================================
// AGENTS
// ==========================================
export interface Agent {
  id: string;
  name: string;
  type: 'red' | 'blue' | 'purple';
  status: 'online' | 'offline' | 'busy';
  description: string;
  capabilities: string[];
  last_seen?: string;
}

// ==========================================
// SCHEDULES
// ==========================================
export interface Schedule {
  id: string;
  name: string;
  tool_id: string;
  target: string;
  cron_expression: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

// ==========================================
// API KEYS
// ==========================================
export interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used: string | null;
  permissions: string[];
}

// ==========================================
// NOTIFICATIONS
// ==========================================
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

// ==========================================
// API RESPONSE ENVELOPE
// ==========================================
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
