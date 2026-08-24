/**
 * Admin God Mode — Superadmin Only.
 *
 * Vos-design migration of the legacy admin console.  Surfaces every operational
 * lever a super-admin needs in one place: users, organizations, signups,
 * newsletter, revenue, system health and a live audit log.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertCircle, BadgeCheck, Building2, CheckCircle2, CreditCard, Crown, HeartPulse, Lock, Mail, ScrollText, Search, ShieldCheck, Trash2, UserCheck, Users } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import {
  useAdminOverview,
  useChangePlan,
  useImpersonateUserAction,
} from '../../hooks/useApiQueries';
import { AdminPageSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  PageHeader,
  Section,
  StatusPill,
  KeyValueGrid,
  DenseTable,
  DenseTableHead,
  DenseTH,
  DenseTR,
  DenseTD,
} from '../../components/vos/Soc';

const API_URL = '/api/v1';

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
}

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  is_active: boolean;
}

interface ScanSummary {
  id: string;
  target: string;
  status: string;
  created_at: string;
}

interface SignupSummary {
  id: string;
  email: string;
  first_name: string;
  created_at: string;
}

interface NewsletterRow {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface AuditRow {
  action: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
}

interface AdminOverview {
  users: { total: number; active: number; list: AdminUser[] };
  organizations: { total: number; plans_distribution: Record<string, number>; list: AdminOrg[] };
  scans: { total: number; running: number; recent: ScanSummary[] };
  agents: { total: number; online: number };
  revenue: { mrr: number; arr: number };
  signups?: { last_24h: number; last_7d: number; last_30d: number; recent: SignupSummary[] };
  newsletter?: { total: number; list: NewsletterRow[] };
  audit_log?: AuditRow[];
}

const TABS = [
  { key: 'overview', labelKey: 'admin.tabOverview', labelFallback: 'Overview', icon: Activity },
  { key: 'users', labelKey: 'admin.tabUsers', labelFallback: 'Users', icon: Users },
  { key: 'orgs', labelKey: 'admin.tabOrganizations', labelFallback: 'Organizations', icon: Building2 },
  { key: 'signups', labelKey: 'admin.tabSignups', labelFallback: 'Signups', icon: UserCheck },
  { key: 'newsletter', labelKey: 'admin.tabNewsletter', labelFallback: 'Newsletter', icon: Mail },
  { key: 'revenue', labelKey: 'admin.tabRevenue', labelFallback: 'Revenue', icon: CreditCard },
  { key: 'audit', labelKey: 'admin.tabAuditLog', labelFallback: 'Audit Log', icon: ScrollText },
  { key: 'health', labelKey: 'admin.tabSystemHealth', labelFallback: 'System Health', icon: HeartPulse },
] as const;
type TabKey = typeof TABS[number]['key'];

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = {
  critical: 'danger', high: 'danger', warning: 'warning',
  medium: 'warning', info: 'info', low: 'info', success: 'success',
};

const PLAN_PRICES: Record<string, number> = {
  free: 0, starter: 29, professional: 99, enterprise: 349,
};

export function AdminPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('admin.title', 'Admin')} — CyberSec Pro`);
  const { user, token } = useAuth();
  const { data: overview, isLoading, error: queryError, refetch } = useAdminOverview();
  const changePlan = useChangePlan();
  const impersonate = useImpersonateUserAction();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(queryError?.message ?? null);
  const [impersonateEmail, setImpersonateEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Set<string>>(new Set());

  // ── server actions ────────────────────────────────────────────────────────
  const callAdmin = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Action failed');
    return data;
  };

  const handleImpersonate = async (email?: string) => {
    const target = email ?? impersonateEmail.trim();
    if (!target) return;
    try {
      const data = await impersonate.mutateAsync({ email: target });
      localStorage.setItem('token', data.token);
      localStorage.setItem('cybersec_impersonated_by', user?.email ?? '');
      window.location.href = '/dashboard';
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleChangePlan = async (orgId: string, planType: string) => {
    try {
      await changePlan.mutateAsync({ organizationId: orgId, planType });
      await refetch();
      toast.success(`Plan changed to ${planType}`);
    } catch (e) {
      setError((e as Error).message);
      toast.error(`Failed to change plan: ${(e as Error).message}`);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      await callAdmin(`${API_URL}/admin/users/${id}`, 'DELETE');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUser = async (id: string) => {
    setActionLoading(id);
    try {
      await callAdmin(`${API_URL}/admin/users/${id}/toggle`, 'PUT');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (id: string, role: string) => {
    setActionLoading(id);
    try {
      await callAdmin(`${API_URL}/admin/users/${id}/role`, 'PUT', { role });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteOrg = async (id: string, name: string) => {
    if (!confirm(`Delete organization "${name}" and ALL related data? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      await callAdmin(`${API_URL}/admin/organizations/${id}`, 'DELETE');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulk = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (bulk.size === 0) return;
    if (!confirm(`${action.toUpperCase()} ${bulk.size} selected user(s)?`)) return;
    for (const id of bulk) {
      try {
        if (action === 'delete') await callAdmin(`${API_URL}/admin/users/${id}`, 'DELETE');
        else await callAdmin(`${API_URL}/admin/users/${id}/toggle`, 'PUT');
      } catch { /* continue */ }
    }
    setBulk(new Set());
    await refetch();
    toast.success(`Bulk ${action} completed`);
  };

  // ── access guard ──────────────────────────────────────────────────────────
  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-vos-3">
          <div className="w-16 h-16 mx-auto rounded-vos-lg bg-vos-danger/10 border border-vos-danger/30 flex items-center justify-center">
            <Lock size={28} className="text-vos-danger" />
          </div>
          <h2 className="text-vos-xl font-semibold text-vos-text">{t('admin.accessDenied', 'Access Denied')}</h2>
          <p className="text-vos-text-3 text-vos-sm">{t('admin.superadminRequired', 'Superadmin access required.')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <AdminPageSkeleton />;

  const d = overview as AdminOverview | undefined;

  return (
    <PageTransition>
      <div className="p-vos-6 max-w-vos-page mx-auto space-y-vos-6">
        <PageHeader
          icon={<Crown size={22} />}
          title={t('admin.godMode', 'Admin God Mode')}
          description={t('admin.fullPlatformControl', 'Full platform control — {{email}}', { email: user.email })}
          badge={<StatusPill tone="danger" label={t('admin.superadmin', 'SUPERADMIN')} />}
        />

        {error && (
          <div className="flex items-start gap-vos-3 p-vos-3 rounded-vos-md bg-vos-danger/10 border border-vos-danger/30 text-vos-danger text-vos-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-vos-xs underline">{t('admin.dismiss', 'dismiss')}</button>
          </div>
        )}

        {/* KPI Strip — visible on every tab */}
        {d && (
          <KeyValueGrid
            cols={4}
            items={[
              { label: t('admin.kpiTotalUsers', 'Total Users'), value: t('admin.kpiUsersWithActive', '{{total}} ({{active}} active)', { total: d.users.total, active: d.users.active }) },
              { label: t('admin.kpiOrganizations', 'Organizations'), value: d.organizations.total },
              { label: t('admin.kpiTotalScans', 'Total Scans'), value: t('admin.kpiScansWithRunning', '{{total}} ({{running}} running)', { total: d.scans.total, running: d.scans.running }) },
              { label: t('admin.kpiAgents', 'Agents'), value: t('admin.kpiAgentsWithOnline', '{{total}} ({{online}} online)', { total: d.agents.total, online: d.agents.online }) },
              { label: t('admin.kpiMRR', 'MRR'), value: `$${Math.round(d.revenue.mrr).toLocaleString()}` },
              { label: t('admin.kpiARR', 'ARR'), value: `$${Math.round(d.revenue.arr).toLocaleString()}` },
              { label: t('admin.kpiSignups24h', 'Signups · 24h'), value: d.signups?.last_24h ?? 0 },
              { label: t('admin.kpiNewsletter', 'Newsletter'), value: d.newsletter?.total ?? 0 },
            ]}
          />
        )}

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1 p-1 rounded-vos-lg bg-vos-bg-elev-1 border border-vos-border-1 w-fit">
          {TABS.map(({ key, labelKey, labelFallback, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-vos-md text-vos-xs font-medium transition-colors ${
                  active
                    ? 'bg-vos-accent/10 text-vos-accent ring-1 ring-vos-accent/30'
                    : 'text-vos-text-2 hover:text-vos-text hover:bg-vos-bg-elev-2'
                }`}
              >
                <Icon size={14} />
                {t(labelKey, labelFallback)}
              </button>
            );
          })}
        </div>

        {/* Impersonation control — always visible at top of operational tabs */}
        <Section title={t('admin.impersonateUser', 'Impersonate User')} description={t('admin.impersonateDescription', "Switch to any user's session for support and debugging.")}>
          <div className="flex gap-vos-3">
            <input
              type="email"
              placeholder={t("admin.impersonatePlaceholder", "user@example.com")}
              value={impersonateEmail}
              onChange={(e) => setImpersonateEmail(e.target.value)}
              className="flex-1 h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30"
            />
            <button
              onClick={() => handleImpersonate()}
              disabled={impersonate.isPending || !impersonateEmail.trim()}
              className="inline-flex items-center gap-1.5 h-9 px-vos-4 rounded-vos-md bg-vos-danger text-white text-vos-sm font-semibold hover:bg-vos-danger/90 disabled:opacity-50 transition-colors"
            >
              {impersonate.isPending ? t('admin.switching', 'Switching…') : t('admin.impersonate', 'Impersonate')}
            </button>
          </div>
          <p className="text-vos-xs text-vos-text-3 mt-vos-2">
            {t('admin.impersonateNote', 'Logs you in as the target user. Refresh the page to return to your account.')}
          </p>
        </Section>

        {tab === 'overview' && d && <OverviewTab d={d} />}
        {tab === 'users' && d && (
          <UsersTab
            d={d}
            currentUserId={user.id}
            bulk={bulk}
            setBulk={setBulk}
            onBulk={handleBulk}
            onToggle={handleToggleUser}
            onRole={handleChangeRole}
            onDelete={handleDeleteUser}
            onImpersonate={handleImpersonate}
            actionLoading={actionLoading}
          />
        )}
        {tab === 'orgs' && d && (
          <OrgsTab d={d} onChangePlan={handleChangePlan} onDelete={handleDeleteOrg} actionLoading={actionLoading} />
        )}
        {tab === 'signups' && d && <SignupsTab d={d} />}
        {tab === 'newsletter' && d && <NewsletterTab d={d} />}
        {tab === 'revenue' && d && <RevenueTab d={d} />}
        {tab === 'audit' && d && <AuditTab d={d} />}
        {tab === 'health' && d && <HealthTab d={d} />}
      </div>
    </PageTransition>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────
function OverviewTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  return (
    <>
      <Section title={t('admin.plansDistribution', 'Plans Distribution')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-3">
          {Object.entries(d.organizations.plans_distribution).map(([plan, count]) => (
            <div key={plan} className="rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4 text-center">
              <div className="text-vos-2xl font-bold text-vos-text">{count}</div>
              <div className="text-[10px] uppercase tracking-vos-wide text-vos-text-3 mt-1">{plan}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('admin.recentScans', 'Recent Scans')}>
        <DenseTable>
          <DenseTableHead>
            <DenseTH>{t('admin.colTarget', 'Target')}</DenseTH>
            <DenseTH>{t('admin.colStatus', 'Status')}</DenseTH>
            <DenseTH>{t('admin.colCreated', 'Created')}</DenseTH>
          </DenseTableHead>
          <tbody>
            {d.scans.recent.map((s) => (
              <DenseTR key={s.id}>
                <DenseTD className="font-vos-mono">{s.target}</DenseTD>
                <DenseTD>
                  <StatusPill
                    tone={s.status === 'completed' ? 'success' : s.status === 'running' ? 'info' : 'neutral'}
                    label={s.status}
                  />
                </DenseTD>
                <DenseTD className="text-vos-text-3">{new Date(s.created_at).toLocaleString()}</DenseTD>
              </DenseTR>
            ))}
            {d.scans.recent.length === 0 && (
              <DenseTR><DenseTD className="text-vos-text-3">{t('admin.noScansYet', 'No scans yet')}</DenseTD></DenseTR>
            )}
          </tbody>
        </DenseTable>
      </Section>
    </>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────
function UsersTab(props: {
  d: AdminOverview;
  currentUserId?: string;
  bulk: Set<string>;
  setBulk: (s: Set<string>) => void;
  onBulk: (a: 'activate' | 'deactivate' | 'delete') => void;
  onToggle: (id: string) => void;
  onRole: (id: string, role: string) => void;
  onDelete: (id: string, email: string) => void;
  onImpersonate: (email: string) => void;
  actionLoading: string | null;
}) {
  const { d, currentUserId, bulk, setBulk, onBulk, onToggle, onRole, onDelete, onImpersonate, actionLoading } = props;
  const { t } = useTranslation();
  const selectableIds = useMemo(
    () => d.users.list.filter((u) => u.id !== currentUserId).map((u) => u.id),
    [d.users.list, currentUserId]
  );
  const allSelected = bulk.size > 0 && bulk.size === selectableIds.length;

  return (
    <Section
      title={`${t('admin.allUsers', 'All Users')} (${d.users.total})`}
      action={
        bulk.size > 0 ? (
          <div className="flex items-center gap-vos-2">
            <span className="text-vos-xs text-vos-text-3">{t('admin.selected', '{{count}} selected', { count: bulk.size })}</span>
            <button onClick={() => onBulk('activate')} className="px-2.5 h-7 rounded-vos-sm bg-vos-success/10 text-vos-success text-vos-xs border border-vos-success/30 hover:bg-vos-success/20">{t('admin.activate', 'Activate')}</button>
            <button onClick={() => onBulk('deactivate')} className="px-2.5 h-7 rounded-vos-sm bg-vos-warning/10 text-vos-warning text-vos-xs border border-vos-warning/30 hover:bg-vos-warning/20">{t('admin.deactivate', 'Deactivate')}</button>
            <button onClick={() => onBulk('delete')} className="px-2.5 h-7 rounded-vos-sm bg-vos-danger/10 text-vos-danger text-vos-xs border border-vos-danger/30 hover:bg-vos-danger/20">{t('admin.delete', 'Delete')}</button>
            <button onClick={() => setBulk(new Set())} className="text-vos-xs text-vos-text-3 underline">{t('admin.clear', 'Clear')}</button>
          </div>
        ) : null
      }
    >
      <DenseTable>
        <DenseTableHead>
          <DenseTH>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setBulk(e.target.checked ? new Set(selectableIds) : new Set())}
            />
          </DenseTH>
          <DenseTH>{t('admin.colEmail', 'Email')}</DenseTH>
          <DenseTH>{t('admin.colName', 'Name')}</DenseTH>
          <DenseTH>{t('admin.colRole', 'Role')}</DenseTH>
          <DenseTH>{t('admin.colActive', 'Active')}</DenseTH>
          <DenseTH>{t('admin.colActions', 'Actions')}</DenseTH>
        </DenseTableHead>
        <tbody>
          {d.users.list.map((u) => (
            <DenseTR key={u.id}>
              <DenseTD>
                {u.id !== currentUserId && (
                  <input
                    type="checkbox"
                    checked={bulk.has(u.id)}
                    onChange={(e) => {
                      const next = new Set(bulk);
                      if (e.target.checked) next.add(u.id); else next.delete(u.id);
                      setBulk(next);
                    }}
                  />
                )}
              </DenseTD>
              <DenseTD className="font-vos-mono">{u.email}</DenseTD>
              <DenseTD>{u.first_name} {u.last_name}</DenseTD>
              <DenseTD>
                <select
                  value={u.role}
                  onChange={(e) => onRole(u.id, e.target.value)}
                  disabled={u.id === currentUserId || actionLoading === u.id}
                  className="h-7 px-2 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-xs text-vos-text disabled:opacity-50"
                >
                  <option value="user">{t("admin.roleUser", "user")}</option>
                  <option value="admin">{t("admin.roleAdmin", "admin")}</option>
                  <option value="superadmin">{t("admin.roleSuperadmin", "superadmin")}</option>
                </select>
              </DenseTD>
              <DenseTD>
                <button
                  onClick={() => onToggle(u.id)}
                  disabled={u.id === currentUserId || actionLoading === u.id}
                  className="disabled:opacity-30"
                >
                  <StatusPill tone={u.is_active ? 'success' : 'neutral'} label={u.is_active ? t('admin.statusActive', 'Active') : t('admin.statusInactive', 'Inactive')} />
                </button>
              </DenseTD>
              <DenseTD>
                <div className="flex gap-2">
                  <button
                    onClick={() => onImpersonate(u.email)}
                    disabled={actionLoading === u.id}
                    className="text-vos-xs text-vos-accent hover:underline"
                  >
                    {t('admin.impersonate', 'Impersonate')}
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => onDelete(u.id, u.email)}
                      disabled={actionLoading === u.id}
                      className="text-vos-xs text-vos-danger hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 size={11} /> {t('admin.delete', 'Delete')}
                    </button>
                  )}
                </div>
              </DenseTD>
            </DenseTR>
          ))}
        </tbody>
      </DenseTable>
    </Section>
  );
}

// ─── Organizations ─────────────────────────────────────────────────────────
function OrgsTab({
  d, onChangePlan, onDelete, actionLoading,
}: {
  d: AdminOverview;
  onChangePlan: (id: string, plan: string) => void;
  onDelete: (id: string, name: string) => void;
  actionLoading: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t('admin.allOrganizations', 'All Organizations ({{total}})', { total: d.organizations.total })}>
      <DenseTable>
        <DenseTableHead>
          <DenseTH>{t('admin.colName', 'Name')}</DenseTH>
          <DenseTH>{t('admin.colSlug', 'Slug')}</DenseTH>
          <DenseTH>{t('admin.colPlan', 'Plan')}</DenseTH>
          <DenseTH>{t('admin.colActive', 'Active')}</DenseTH>
          <DenseTH>{t('admin.colActions', 'Actions')}</DenseTH>
        </DenseTableHead>
        <tbody>
          {d.organizations.list.map((o) => (
            <DenseTR key={o.id}>
              <DenseTD className="font-medium">{o.name}</DenseTD>
              <DenseTD className="font-vos-mono text-vos-text-3">{o.slug}</DenseTD>
              <DenseTD>
                <select
                  value={o.plan_type}
                  onChange={(e) => onChangePlan(o.id, e.target.value)}
                  className="h-7 px-2 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-xs text-vos-text"
                >
                  <option value="free">{t("admin.planFree", "free")}</option>
                  <option value="starter">{t("admin.planStarter", "starter")}</option>
                  <option value="professional">{t("admin.planProfessional", "professional")}</option>
                  <option value="enterprise">{t("admin.planEnterprise", "enterprise")}</option>
                </select>
              </DenseTD>
              <DenseTD>
                <StatusPill tone={o.is_active ? 'success' : 'neutral'} label={o.is_active ? t('admin.statusActive', 'Active') : t('admin.statusInactive', 'Inactive')} />
              </DenseTD>
              <DenseTD>
                <button
                  onClick={() => onDelete(o.id, o.name)}
                  disabled={actionLoading === o.id}
                  className="inline-flex items-center gap-1 text-vos-xs text-vos-danger hover:underline disabled:opacity-50"
                >
                  <Trash2 size={11} /> {actionLoading === o.id ? '…' : t('admin.delete', 'Delete')}
                </button>
              </DenseTD>
            </DenseTR>
          ))}
        </tbody>
      </DenseTable>
    </Section>
  );
}

// ─── Signups ───────────────────────────────────────────────────────────────
function SignupsTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  const s = d.signups;
  if (!s) return <Section title={t('admin.tabSignups', 'Signups')}><p className="text-vos-text-3 text-vos-sm">{t('admin.noSignupData', 'No signup data available.')}</p></Section>;
  return (
    <>
      <KeyValueGrid
        cols={3}
        items={[
          { label: t('admin.signupsLast24h', 'Last 24 hours'), value: s.last_24h },
          { label: t('admin.signupsLast7d', 'Last 7 days'), value: s.last_7d },
          { label: t('admin.signupsLast30d', 'Last 30 days'), value: s.last_30d },
        ]}
      />
      <Section title={t('admin.recentSignups', 'Recent Signups (last 14 days)')}>
        <DenseTable>
          <DenseTableHead>
            <DenseTH>{t('admin.colEmail', 'Email')}</DenseTH>
            <DenseTH>{t('admin.colName', 'Name')}</DenseTH>
            <DenseTH>{t('admin.colJoined', 'Joined')}</DenseTH>
          </DenseTableHead>
          <tbody>
            {s.recent.map((u) => (
              <DenseTR key={u.id}>
                <DenseTD className="font-vos-mono">{u.email}</DenseTD>
                <DenseTD>{u.first_name || '—'}</DenseTD>
                <DenseTD className="text-vos-text-3">{new Date(u.created_at).toLocaleString()}</DenseTD>
              </DenseTR>
            ))}
            {s.recent.length === 0 && (
              <DenseTR><DenseTD className="text-vos-text-3">{t('admin.noRecentSignups', 'No signups in the last 14 days')}</DenseTD></DenseTR>
            )}
          </tbody>
        </DenseTable>
      </Section>
    </>
  );
}

// ─── Newsletter ────────────────────────────────────────────────────────────
function NewsletterTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  const n = d.newsletter;
  return (
    <Section
      title={t('admin.newsletterSubscribers', 'Newsletter Subscribers ({{total}})', { total: n?.total ?? 0 })}
      description={t('admin.newsletterDescription', 'Active subscribers will receive product updates and threat advisories.')}
    >
      <DenseTable>
        <DenseTableHead>
          <DenseTH>{t('admin.colEmail', 'Email')}</DenseTH>
          <DenseTH>{t('admin.colStatus', 'Status')}</DenseTH>
          <DenseTH>{t('admin.colSubscribed', 'Subscribed')}</DenseTH>
        </DenseTableHead>
        <tbody>
          {(n?.list ?? []).map((row) => (
            <DenseTR key={row.id}>
              <DenseTD className="font-vos-mono">{row.email}</DenseTD>
              <DenseTD>
                <StatusPill tone={row.is_active ? 'success' : 'neutral'} label={row.is_active ? t('admin.statusActive', 'Active') : t('admin.statusUnsubscribed', 'Unsubscribed')} />
              </DenseTD>
              <DenseTD className="text-vos-text-3">{new Date(row.created_at).toLocaleString()}</DenseTD>
            </DenseTR>
          ))}
          {(n?.list ?? []).length === 0 && (
            <DenseTR><DenseTD className="text-vos-text-3">{t('admin.noSubscribers', 'No subscribers yet')}</DenseTD></DenseTR>
          )}
        </tbody>
      </DenseTable>
    </Section>
  );
}

// ─── Revenue ───────────────────────────────────────────────────────────────
function RevenueTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  const paying = d.organizations.total - (d.organizations.plans_distribution['free'] ?? 0);
  const arpu = paying > 0 ? Math.round(d.revenue.mrr / paying) : 0;

  return (
    <>
      <KeyValueGrid
        cols={4}
        items={[
          { label: t('admin.kpiMRR', 'MRR'), value: `$${Math.round(d.revenue.mrr).toLocaleString()}` },
          { label: t('admin.kpiARR', 'ARR'), value: `$${Math.round(d.revenue.arr).toLocaleString()}` },
          { label: t('admin.payingOrgs', 'Paying Orgs'), value: `${paying} / ${d.organizations.total}` },
          { label: t('admin.arpu', 'ARPU'), value: `$${arpu}` },
        ]}
      />
      <Section title={t('admin.revenueByPlan', 'Revenue by Plan')}>
        <div className="grid md:grid-cols-4 gap-vos-3">
          {(['free', 'starter', 'professional', 'enterprise'] as const).map((plan) => {
            const count = d.organizations.plans_distribution[plan] ?? 0;
            const price = PLAN_PRICES[plan];
            return (
              <div key={plan} className="rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4 text-center">
                <div className="text-[10px] uppercase tracking-vos-wide text-vos-text-3">{plan}</div>
                <div className="text-vos-2xl font-bold text-vos-text mt-1">${(price * count).toLocaleString()}</div>
                <div className="text-vos-xs text-vos-text-3 mt-1">{t('admin.monthlyRate', '{{count}} × ${{price}}/mo', { count, price })}</div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title={t('admin.revenueProjections', 'Revenue Projections')}>
        <KeyValueGrid
          cols={3}
          items={[
            { label: t('admin.revThisMonth', 'This Month'), value: `$${Math.round(d.revenue.mrr).toLocaleString()}` },
            { label: t('admin.revQuarterly', 'Quarterly (est.)'), value: `$${Math.round(d.revenue.mrr * 3).toLocaleString()}` },
            { label: t('admin.revAnnual', 'Annual (est.)'), value: `$${Math.round(d.revenue.arr).toLocaleString()}` },
          ]}
        />
      </Section>
    </>
  );
}

// ─── Audit Log ─────────────────────────────────────────────────────────────
function AuditTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  const rows = d.audit_log ?? [];
  return (
    <Section title={t('admin.auditEventsTitle', 'Recent Audit Events')} description={t('admin.auditEventsDescription', 'Last 25 platform-wide actions, freshest first.')}>
      <DenseTable>
        <DenseTableHead>
          <DenseTH>{t('admin.colSeverity', 'Severity')}</DenseTH>
          <DenseTH>{t('admin.colAction', 'Action')}</DenseTH>
          <DenseTH>{t('admin.colCategory', 'Category')}</DenseTH>
          <DenseTH>{t('admin.colStatus', 'Status')}</DenseTH>
          <DenseTH>{t('admin.colWhen', 'When')}</DenseTH>
        </DenseTableHead>
        <tbody>
          {rows.map((row, i) => (
            <DenseTR key={i}>
              <DenseTD>
                <StatusPill tone={SEVERITY_TONE[row.severity.toLowerCase()] ?? 'neutral'} label={row.severity} />
              </DenseTD>
              <DenseTD className="font-vos-mono">{row.action}</DenseTD>
              <DenseTD className="text-vos-text-3">{row.category}</DenseTD>
              <DenseTD>
                <StatusPill tone={row.status === 'success' ? 'success' : 'danger'} label={row.status} />
              </DenseTD>
              <DenseTD className="text-vos-text-3">{new Date(row.created_at).toLocaleString()}</DenseTD>
            </DenseTR>
          ))}
          {rows.length === 0 && (
            <DenseTR><DenseTD className="text-vos-text-3">{t('admin.noAuditEvents', 'No audit events yet')}</DenseTD></DenseTR>
          )}
        </tbody>
      </DenseTable>
    </Section>
  );
}

// ─── System Health ─────────────────────────────────────────────────────────
function HealthTab({ d }: { d: AdminOverview }) {
  const { t } = useTranslation();
  const items = [
    { title: 'Backend API', detail: 'Rust Axum', metric: 'Port 5001' },
    { title: 'PostgreSQL', detail: 'cybersec_pro database', metric: 'localhost:5432' },
    { title: 'Nginx Proxy', detail: 'Reverse proxy active', metric: 'Port 80 / 443' },
    { title: 'Stripe Payments', detail: 'Live mode', metric: 'price IDs configured' },
    { title: 'Email (SMTP)', detail: 'Gmail SMTP', metric: 'smtp.gmail.com:465' },
    { title: 'CyberSec AI Worker', detail: 'Autonomous job processor', metric: '6s poll interval' },
  ];

  const services = [
    'Authentication & JWT',
    'Rate Limiting',
    'WebSocket (Socket.IO)',
    'Service Manager Watchdog',
    'Site Monitor',
    'Audit Logging',
    'CORS & Security Headers',
    'Static File Serving',
  ];

  return (
    <>
      <div className="grid md:grid-cols-3 gap-vos-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-vos-lg border border-vos-success/20 bg-vos-bg-elev-1 p-vos-4">
            <div className="flex items-center justify-between mb-vos-2">
              <h3 className="text-vos-sm font-semibold text-vos-text inline-flex items-center gap-2">
                <ShieldCheck size={14} className="text-vos-success" /> {it.title}
              </h3>
              <StatusPill tone="success" label={t('admin.operational', 'Operational')} />
            </div>
            <p className="text-vos-xs text-vos-text-3">{it.detail}</p>
            <p className="text-vos-xs text-vos-text-3 mt-1">{it.metric}</p>
          </div>
        ))}
      </div>

      <Section title={t('admin.platformServices', 'Platform Services')}>
        <div className="space-y-1.5">
          {services.map((name) => (
            <div key={name} className="flex items-center justify-between px-vos-3 h-9 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1">
              <span className="text-vos-sm text-vos-text-2 inline-flex items-center gap-2">
                <BadgeCheck size={14} className="text-vos-success" /> {name}
              </span>
              <StatusPill tone="success" label="active" />
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('admin.agentStatus', 'Agent Status')}>
        <KeyValueGrid
          cols={2}
          items={[
            { label: t('admin.statTotalAgents', 'Total Agents'), value: d.agents.total },
            { label: t('admin.statOnlineNow', 'Online Now'), value: d.agents.online },
          ]}
        />
      </Section>
    </>
  );
}

export default AdminPage;
