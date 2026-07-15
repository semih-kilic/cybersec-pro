"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Shield, Terminal, FileText, Settings, Users, Brain, Crosshair, CreditCard, Lock, Activity, Server, Bot, ChevronDown, ChevronRight } from "lucide-react";

const NetworkMesh = dynamic(() => import("@/components/three/NetworkMesh"), { ssr: false });

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
  admin?: boolean;
}

interface EndpointGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  endpoints: Endpoint[];
}

const groups: EndpointGroup[] = [
  {
    id: "auth", label: "Authentication", icon: Lock, color: "var(--color-neon)",
    description: "User registration, login, JWT refresh, MFA setup/verify, OAuth 2.0 (GitHub, Google), profile management.",
    endpoints: [
      { method: "POST", path: "/api/v1/auth/register", description: "Create a new user account with email, password, and organisation name" },
      { method: "POST", path: "/api/v1/auth/login", description: "Authenticate and receive JWT access_token + refresh_token", auth: false },
      { method: "POST", path: "/api/v1/auth/refresh", description: "Refresh an expired access_token using a valid refresh_token", auth: false },
      { method: "POST", path: "/api/v1/auth/logout", description: "Invalidate the current session and revoke refresh token" },
      { method: "GET", path: "/api/v1/auth/me", description: "Get current authenticated user profile and organisation" },
      { method: "PUT", path: "/api/v1/auth/profile", description: "Update user profile (name, timezone, language preference)" },
      { method: "PUT", path: "/api/v1/auth/change-password", description: "Change password (requires current password verification)" },
      { method: "PUT", path: "/api/v1/auth/avatar", description: "Upload or update profile avatar image (max 2MB, PNG/JPG)" },
      { method: "POST", path: "/api/v1/auth/mfa/setup", description: "Generate TOTP secret and QR code for MFA enrollment" },
      { method: "POST", path: "/api/v1/auth/mfa/verify-setup", description: "Confirm MFA setup with a valid 6-digit TOTP code" },
      { method: "POST", path: "/api/v1/auth/mfa/verify", description: "Verify MFA code during login (required if MFA enabled)" },
      { method: "GET", path: "/api/v1/auth/mfa/status", description: "Check MFA enrollment status for current user" },
      { method: "DELETE", path: "/api/v1/auth/mfa/disable", description: "Disable MFA (requires password confirmation)" },
      { method: "POST", path: "/api/v1/auth/mfa/regenerate-backup", description: "Regenerate MFA backup/recovery codes (10 codes)" },
      { method: "POST", path: "/api/v1/auth/resend-verification", description: "Resend email verification link" },
      { method: "GET", path: "/api/v1/auth/verify-email", description: "Verify email address using token from verification link" },
      { method: "GET", path: "/api/v1/auth/github", description: "Initiate GitHub OAuth 2.0 authorization flow" },
      { method: "GET", path: "/api/v1/auth/google", description: "Initiate Google OAuth 2.0 authorization flow" },
    ],
  },
  {
    id: "tools", label: "Tools", icon: Terminal, color: "var(--color-cyan)",
    description: "Browse, search, and configure the full arsenal of 811 verified Kali Linux security tools.",
    endpoints: [
      { method: "GET", path: "/api/v1/tools", description: "List all tools with pagination (default 50/page). Filter by category, name, status" },
      { method: "GET", path: "/api/v1/tools/count", description: "Get total tool count (returns { total: 811, active: N })" },
      { method: "GET", path: "/api/v1/tools/stats", description: "Tool usage statistics — most used, avg scan duration, success rates" },
      { method: "GET", path: "/api/v1/tools/available", description: "List tools available for current user's plan tier" },
      { method: "GET", path: "/api/v1/tools/health", description: "Health check for a specific tool (ready, version, last tested)" },
      { method: "GET", path: "/api/v1/tools/all-health", description: "Batch health check for all tools (cached 5 min)" },
      { method: "GET", path: "/api/v1/tools/business-categories", description: "List business-friendly category names with tool counts" },
      { method: "GET", path: "/api/v1/tools/business-category-tools", description: "Get tools grouped by business category with metadata" },
      { method: "GET", path: "/api/v1/tools/groups", description: "List tool groups (information-gathering, vuln-analysis, etc.)" },
      { method: "GET", path: "/api/v1/tools/groups/:id", description: "Get all tools in a specific group by group ID" },
      { method: "GET", path: "/api/v1/tools/search", description: "Full-text search across tool names, descriptions, and categories" },
      { method: "GET", path: "/api/v1/tools/:tool_id", description: "Get complete tool details — config schema, parameters, docs" },
      { method: "GET", path: "/api/v1/tools/:tool_id/config", description: "Get tool configuration schema (JSON Schema format)" },
      { method: "GET", path: "/api/v1/tools/:tool_id/execution-mode", description: "Get execution mode (sync/async) and estimated duration" },
      { method: "POST", path: "/api/v1/tools/:slug/build-command", description: "Build CLI command from parameters — returns full command string" },
      { method: "GET", path: "/api/v1/tools/catalog", description: "Full tool catalog with all metadata, for offline caching" },
      { method: "GET", path: "/api/v2/tools", description: "V2 tools endpoint with enhanced metadata and execution info" },
      { method: "GET", path: "/api/v2/tools/:tool_id", description: "V2 tool detail with full config, help text, and examples" },
    ],
  },
  {
    id: "scans", label: "Scans", icon: Shield, color: "var(--color-orange)",
    description: "Create, execute, monitor, and manage security scans. Real-time output streaming via SSE.",
    endpoints: [
      { method: "GET", path: "/api/v1/scans", description: "List all scans for current user (paginated, filterable by status/date)" },
      { method: "POST", path: "/api/v1/scans", description: "Create a new scan (target, tool, parameters, scan_type)" },
      { method: "POST", path: "/api/v1/scans/create", description: "Create scan with advanced options (schedule, profile, notifications)" },
      { method: "POST", path: "/api/v1/scans/execute", description: "Execute a created scan immediately (starts tool in container)" },
      { method: "POST", path: "/api/v1/scan/start", description: "Create + execute in one step (quick launch)" },
      { method: "GET", path: "/api/v1/scan/:scan_id", description: "Get scan metadata — status, target, tool, timestamps, progress" },
      { method: "DELETE", path: "/api/v1/scan/:scan_id", description: "Delete a scan and all associated data (results, output)" },
      { method: "GET", path: "/api/v1/scan/:scan_id/output", description: "Stream real-time scan output via SSE (Server-Sent Events)" },
      { method: "GET", path: "/api/v1/scan/:scan_id/result", description: "Get parsed scan results — findings, severity counts, CVEs" },
      { method: "POST", path: "/api/v1/scan/:scan_id/stop", description: "Stop a running scan gracefully (saves partial results)" },
      { method: "GET", path: "/api/v1/scan/:scan_id/status", description: "Quick status check (created/queued/running/completed/failed)" },
      { method: "GET", path: "/api/v1/scan/:scan_id/business-report", description: "Get business-formatted scan report with executive summary" },
      { method: "POST", path: "/api/v1/scan/:scan_id/rerun", description: "Re-run a completed scan with same parameters" },
    ],
  },
  {
    id: "reports", label: "Reports", icon: FileText, color: "var(--color-purple)",
    description: "Generate, list, and download professional security reports in multiple formats.",
    endpoints: [
      { method: "GET", path: "/api/v1/reports", description: "List all generated reports (filterable by format, date, scan)" },
      { method: "POST", path: "/api/v1/reports/generate", description: "Generate report (scan_id, template, format: pdf/html/json/csv/md)" },
    ],
  },
  {
    id: "schedules", label: "Schedules", icon: Activity, color: "#ffd166",
    description: "Automate recurring scans with cron-style scheduling and alert configuration.",
    endpoints: [
      { method: "GET", path: "/api/v1/schedules", description: "List all scan schedules for current user" },
      { method: "POST", path: "/api/v1/schedules", description: "Create a new schedule (cron, target, tool, notify channels)" },
      { method: "GET", path: "/api/v1/schedules/:id", description: "Get schedule details and next run time" },
      { method: "PUT", path: "/api/v1/schedules/:id", description: "Update schedule (cron, parameters, notifications)" },
      { method: "DELETE", path: "/api/v1/schedules/:id", description: "Delete a schedule" },
      { method: "POST", path: "/api/v1/schedules/:schedule_id/toggle", description: "Enable or disable a schedule without deleting it" },
    ],
  },
  {
    id: "settings", label: "Settings & Team", icon: Settings, color: "#e07aff",
    description: "Manage API keys, notification preferences, and team members with role-based access.",
    endpoints: [
      { method: "GET", path: "/api/v1/settings/api-keys", description: "List all API keys for current user" },
      { method: "POST", path: "/api/v1/settings/api-keys", description: "Create a new API key with scopes and expiration" },
      { method: "DELETE", path: "/api/v1/settings/api-keys/:key_id", description: "Revoke an API key permanently" },
      { method: "GET", path: "/api/v1/settings/notifications", description: "Get notification preferences (email, webhook, slack)" },
      { method: "PUT", path: "/api/v1/settings/notifications", description: "Update notification preferences and alert thresholds" },
      { method: "GET", path: "/api/v1/settings/team", description: "List team members with roles and last active time" },
      { method: "POST", path: "/api/v1/settings/team/invite", description: "Invite a new team member by email with assigned role" },
      { method: "DELETE", path: "/api/v1/settings/team/:member_id", description: "Remove a team member from the organisation" },
      { method: "PUT", path: "/api/v1/settings/team/:member_id/role", description: "Update team member role (owner/admin/analyst)" },
    ],
  },
  {
    id: "admin", label: "Admin", icon: Server, color: "#ef476f",
    description: "Platform administration — user management, organisation overview, service monitoring. Requires admin role.",
    endpoints: [
      { method: "GET", path: "/api/v1/admin/overview", description: "Platform overview — total users, organisations, scans, revenue", admin: true },
      { method: "PUT", path: "/api/v1/admin/users/:user_id", description: "Update user details (admin edit)", admin: true },
      { method: "PUT", path: "/api/v1/admin/users/:user_id/role", description: "Change user's platform role", admin: true },
      { method: "POST", path: "/api/v1/admin/users/:user_id/toggle", description: "Enable or disable a user account", admin: true },
      { method: "GET", path: "/api/v1/admin/organizations/:org_id", description: "Get organisation details and usage stats", admin: true },
      { method: "POST", path: "/api/v1/admin/change-plan", description: "Change organisation plan (starter/pro/enterprise)", admin: true },
      { method: "POST", path: "/api/v1/admin/impersonate", description: "Impersonate a user for debugging (audit logged)", admin: true },
      { method: "GET", path: "/api/v1/admin/service-manager/dashboard", description: "Service manager control panel overview", admin: true },
      { method: "GET", path: "/api/v1/admin/service-manager/services", description: "List all managed services and their status", admin: true },
      { method: "GET", path: "/api/v1/admin/service-manager/processes", description: "List running processes with CPU/memory usage", admin: true },
      { method: "GET", path: "/api/v1/admin/service-manager/system", description: "System metrics — CPU, RAM, disk, network", admin: true },
      { method: "GET", path: "/api/v1/admin/service-manager/alerts", description: "Active system alerts and thresholds", admin: true },
      { method: "POST", path: "/api/v1/admin/service-manager/alerts/:id/acknowledge", description: "Acknowledge and dismiss a system alert", admin: true },
      { method: "POST", path: "/api/v1/admin/service-manager/services/:id/action", description: "Start/stop/restart a managed service", admin: true },
    ],
  },
  {
    id: "ai", label: "AI Assistant", icon: Brain, color: "#4ecdc4",
    description: "AI-powered security insights — remediation advice, report summarization, and scan suggestions.",
    endpoints: [
      { method: "POST", path: "/api/v1/ai/remediation", description: "Get AI-generated remediation steps for a specific finding (CVE + context)" },
      { method: "POST", path: "/api/v1/ai/report-summary", description: "Generate an AI executive summary from scan results" },
      { method: "POST", path: "/api/v1/ai/suggest", description: "Get AI suggestions for next scan based on findings and target profile" },
    ],
  },
  {
    id: "purple-team", label: "Purple Team", icon: Crosshair, color: "#ff6b6b",
    description: "Attack simulation, exercise management, MITRE ATT&CK mapping, and detection validation.",
    endpoints: [
      { method: "GET", path: "/api/v1/purple-team/dashboard", description: "Purple team overview — active exercises, coverage score, recent chains" },
      { method: "GET", path: "/api/v1/purple-team/exercises", description: "List all purple team exercises with status and results" },
      { method: "GET", path: "/api/v1/purple-team/exercises/:id", description: "Get exercise details — attack chain, detections, gaps" },
      { method: "POST", path: "/api/v1/purple-team/exercises", description: "Create a new exercise (MITRE techniques, target, detection goals)" },
      { method: "GET", path: "/api/v1/purple-team/chains", description: "List attack chains (multi-step attack sequences)" },
      { method: "GET", path: "/api/v1/purple-team/mitre-matrix", description: "Get MITRE ATT&CK matrix coverage map with detection status" },
      { method: "GET", path: "/api/v1/purple-team/playbooks", description: "List playbooks — pre-built and custom attack/detect scenarios" },
    ],
  },
  {
    id: "billing", label: "Billing & Plans", icon: CreditCard, color: "#45b7d1",
    description: "Subscription management, plan details, and Stripe checkout integration.",
    endpoints: [
      { method: "POST", path: "/api/v1/billing/create-checkout", description: "Create Stripe checkout session for plan upgrade/subscription" },
      { method: "GET", path: "/api/plans", description: "List all available plans with pricing and feature comparison" },
      { method: "POST", path: "/api/create-checkout-session", description: "Alternative checkout endpoint with pre-filled plan selection" },
      { method: "GET", path: "/api/v1/billing/plan/info", description: "Get current plan details — name, limits, renewal date, usage" },
      { method: "GET", path: "/api/v1/billing/plan/features", description: "List features available on current plan vs. all plans" },
    ],
  },
  {
    id: "gdpr", label: "GDPR & Privacy", icon: Shield, color: "#22c55e",
    description: "GDPR compliance endpoints — data export and account deletion.",
    endpoints: [
      { method: "POST", path: "/api/v1/gdpr/export", description: "Request full data export (JSON). Delivered via email within 24h" },
      { method: "POST", path: "/api/v1/gdpr/delete-account", description: "Request account deletion (30-day cooling, then permanent)" },
    ],
  },
  {
    id: "terminal", label: "Terminal & Agents", icon: Bot, color: "#f97316",
    description: "Remote terminal execution, connection testing, and distributed scan agent management.",
    endpoints: [
      { method: "POST", path: "/api/v1/terminal/execute", description: "Execute a command on a remote target via SSH agent" },
      { method: "POST", path: "/api/v1/terminal/test-connection", description: "Test SSH connectivity to a target host" },
      { method: "GET", path: "/api/v1/terminal/agents", description: "List registered scan agents with status and capabilities" },
      { method: "GET", path: "/api/v1/agents/dashboard", description: "Agent fleet dashboard — online/offline, load, scan queue" },
      { method: "POST", path: "/api/v1/agents/:id/test", description: "Test agent connectivity and run diagnostic" },
    ],
  },
  {
    id: "other", label: "Targets, Analytics & More", icon: Activity, color: "var(--color-neon)",
    description: "Target management, analytics, monitoring, chatbot, SSO, email, and activity feeds.",
    endpoints: [
      { method: "GET", path: "/api/v1/targets", description: "List all verified scan targets" },
      { method: "POST", path: "/api/v1/targets", description: "Add a new scan target with verification method" },
      { method: "GET", path: "/api/v1/target-groups", description: "List target groups for batch scanning" },
      { method: "POST", path: "/api/v1/target-groups", description: "Create a target group with multiple targets" },
      { method: "GET", path: "/api/v1/analytics/overview", description: "Analytics dashboard — scan trends, tool usage, finding stats" },
      { method: "GET", path: "/api/v1/monitor/status", description: "Platform health and service status page data" },
      { method: "POST", path: "/api/v1/chatbot/message", description: "Send message to AI security chatbot (context-aware)" },
      { method: "POST", path: "/api/v1/feedback", description: "Submit user feedback (rating + message)" },
      { method: "GET", path: "/api/v1/activity", description: "Activity feed — recent scans, reports, team changes" },
      { method: "GET", path: "/api/v1/usage/stats", description: "Usage statistics — scans this month, API calls, storage" },
      { method: "GET", path: "/api/v1/email/config", description: "Get email notification configuration" },
      { method: "POST", path: "/api/v1/email/send-license", description: "Send license key to a user via email" },
      { method: "POST", path: "/api/v1/email/send-welcome", description: "Send welcome onboarding email to a new user" },
      { method: "POST", path: "/api/v1/sso/test", description: "Test SSO configuration (SAML/OIDC)" },
      { method: "POST", path: "/api/v1/sso/toggle", description: "Enable or disable SSO for the organisation" },
      { method: "GET", path: "/api/v1/health", description: "API health check — returns { status: 'ok' }", auth: false },
      { method: "GET", path: "/api/v1/ready", description: "Readiness probe — database, Redis, scan engine status", auth: false },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "text-[var(--color-neon)] bg-[var(--color-neon)]/10",
  POST: "text-[var(--color-cyan)] bg-[var(--color-cyan)]/10",
  PUT: "text-[var(--color-orange)] bg-[var(--color-orange)]/10",
  DELETE: "text-red-400 bg-red-400/10",
};

export default function ApiReferencePage() {
  const t = useTranslations("api");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ auth: true });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalEndpoints = groups.reduce((sum, g) => sum + g.endpoints.length, 0);

  return (
    <>
      <NetworkMesh />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

      {/* Overview Stats */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <RevealOnScroll>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Total Endpoints", value: totalEndpoints.toString() },
              { label: "API Versions", value: "v1 + v2" },
              { label: "Auth Methods", value: "JWT + OAuth" },
              { label: "Rate Limit", value: "60-300/min" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <span className="text-xl font-extrabold font-mono text-[var(--color-neon)]">{s.value}</span>
                <p className="text-xs text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* Base URL + Auth */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <RevealOnScroll>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-6">
              <h3 className="mb-3 font-mono text-sm font-bold text-white/70">{t("baseUrl")}</h3>
              <code className="rounded-lg bg-black/30 px-4 py-2 font-mono text-sm text-[var(--color-neon)]">
                https://api.cyber-sec-pro.com/v1
              </code>
              <p className="mt-3 text-xs text-white/40">All endpoints use HTTPS. HTTP requests are redirected. TLS 1.3 required.</p>
            </div>
            <div className="glass-card p-6">
              <h3 className="mb-3 font-mono text-sm font-bold text-white/70">{t("authentication")}</h3>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[10px] text-white/60">
{`Authorization: Bearer <your-jwt-token>

# Login → get token
POST /api/v1/auth/login
{ "email": "user@co.com", "password": "..." }
→ { "access_token": "eyJ...", "token_type": "Bearer" }`}
              </pre>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Error Codes + Rate Limits */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <RevealOnScroll>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-6">
              <h3 className="mb-3 font-mono text-sm font-bold text-white/70">Error Codes</h3>
              <div className="space-y-1.5">
                {[
                  { code: "200", desc: "OK — Request succeeded" },
                  { code: "201", desc: "Created — Resource created" },
                  { code: "400", desc: "Bad Request — Invalid parameters" },
                  { code: "401", desc: "Unauthorized — Invalid or missing token" },
                  { code: "403", desc: "Forbidden — Insufficient permissions" },
                  { code: "404", desc: "Not Found — Resource doesn't exist" },
                  { code: "429", desc: "Rate Limited — Too many requests" },
                  { code: "500", desc: "Server Error — Internal failure" },
                ].map((e) => (
                  <div key={e.code} className="flex items-center gap-3 text-xs">
                    <span className="font-mono font-bold text-[var(--color-neon)] w-8">{e.code}</span>
                    <span className="text-white/40">{e.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-6">
              <h3 className="mb-3 font-mono text-sm font-bold text-white/70">Rate Limiting</h3>
              <div className="space-y-3">
                {[
                  { plan: "Trial", limit: "10 req/min", burst: "5" },
                  { plan: "Starter", limit: "30 req/min", burst: "15" },
                  { plan: "Professional", limit: "60 req/min", burst: "30" },
                  { plan: "Enterprise", limit: "300 req/min", burst: "100" },
                ].map((r) => (
                  <div key={r.plan} className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">{r.plan}</span>
                    <div className="text-white/40 font-mono">
                      <span className="text-[var(--color-neon)]">{r.limit}</span>
                      <span className="text-white/20 mx-2">|</span>
                      burst: {r.burst}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-white/30">Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset</p>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Endpoint Groups */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <RevealOnScroll>
          <h2 className="mb-2 text-xl font-bold">{t("endpoints")}</h2>
          <p className="text-sm text-white/40 mb-6">{totalEndpoints} endpoints across {groups.length} groups. Click a group to expand.</p>
        </RevealOnScroll>
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            return (
              <div key={group.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition"
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${group.color}20`, color: group.color }}>
                    <span className="text-[10px] font-bold">{group.endpoints.length}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-white text-sm">{group.label}</h3>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/30">{group.endpoints.length}</span>
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5 truncate">{group.description}</p>
                  </div>
                  {isOpen ? <ChevronDown size={16} className="text-white/30" /> : <ChevronRight size={16} className="text-white/30" />}
                </button>
                {isOpen && (
                  <div className="border-t border-white/5 px-3 pb-3">
                    {group.endpoints.map((ep, idx) => (
                      <div key={idx} className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/[0.02] rounded-lg transition">
                        <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold flex-shrink-0 mt-0.5 ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="font-mono text-xs text-white/70 flex-shrink-0">{ep.path}</code>
                        <span className="text-[11px] text-white/35 hidden md:block">{ep.description}</span>
                        <div className="ml-auto flex gap-1.5 flex-shrink-0">
                          {ep.auth === false && <span className="text-[8px] rounded bg-green-500/10 text-green-400 px-1.5 py-0.5 font-mono">PUBLIC</span>}
                          {ep.admin && <span className="text-[8px] rounded bg-red-500/10 text-red-400 px-1.5 py-0.5 font-mono">ADMIN</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Request/Response Examples */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <RevealOnScroll>
          <h2 className="mb-6 text-xl font-bold">Request & Response Examples</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-6">
              <h4 className="font-mono text-sm font-bold text-[var(--color-cyan)] mb-3">POST /api/v1/scans/create</h4>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[10px] text-white/60">
{`// Request
{
  "target": "example.com",
  "tool": "nmap",
  "parameters": {
    "scan_type": "-sV -sC -O",
    "ports": "1-10000",
    "timing": "-T4"
  },
  "scan_type": "custom",
  "notify": ["email"]
}

// Response 201
{
  "id": "scan_a1b2c3d4",
  "status": "created",
  "target": "example.com",
  "tool": "nmap",
  "created_at": "2026-01-15T14:30:00Z"
}`}</pre>
            </div>
            <div className="glass-card p-6">
              <h4 className="font-mono text-sm font-bold text-[var(--color-neon)] mb-3">GET /api/v1/scan/:id/result</h4>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[10px] text-white/60">
{`// Response 200
{
  "scan_id": "scan_a1b2c3d4",
  "status": "completed",
  "duration_ms": 124500,
  "findings": {
    "total": 12,
    "critical": 1,
    "high": 3,
    "medium": 5,
    "low": 2,
    "info": 1
  },
  "vulnerabilities": [
    {
      "id": "vuln_001",
      "title": "Apache Request Smuggling",
      "cve": "CVE-2023-25690",
      "cvss": 9.8,
      "severity": "critical",
      "evidence": "HTTP/1.1 smuggling...",
      "remediation": "Upgrade Apache to 2.4.58+"
    }
  ]
}`}</pre>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Pagination + Webhooks */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <RevealOnScroll>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-6">
              <h3 className="font-mono text-sm font-bold text-white/70 mb-3">Pagination</h3>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[10px] text-white/60">
{`GET /api/v1/scans?page=1&per_page=25&sort=created_at&order=desc

// Response includes:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total": 142,
    "total_pages": 6
  }
}`}</pre>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-mono text-sm font-bold text-white/70 mb-3">Webhook Events</h3>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[10px] text-white/60">
{`// Webhook payload (POST to your URL)
{
  "event": "scan.completed",
  "timestamp": "2026-01-15T14:45:00Z",
  "data": {
    "scan_id": "scan_a1b2c3d4",
    "status": "completed",
    "findings_count": 12,
    "critical_count": 1
  }
}

// Events: scan.created, scan.started,
// scan.completed, scan.failed,
// report.generated, finding.critical`}</pre>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
