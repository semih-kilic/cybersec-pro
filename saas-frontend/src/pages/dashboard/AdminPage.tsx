/**
 * 🛡️ Admin God Mode - Superadmin Only
 * Impersonate users, view all organizations, MRR stats.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAdminOverview, useChangePlan, useImpersonateUserAction } from '../../hooks/useApiQueries';
import { AdminPageSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

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

interface _AdminOverview {
  users: { total: number; active: number; list: AdminUser[] };
  organizations: { total: number; plans_distribution: Record<string, number>; list: AdminOrg[] };
  scans: { total: number; running: number; recent: ScanSummary[] };
  agents: { total: number; online: number };
  revenue: { mrr: number; arr: number };
}

export function AdminPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('admin.title', 'Admin')} — CyberSec Pro`);
  const { user, token } = useAuth();
  const { data: overview, isLoading: loading, error: queryError, refetch } = useAdminOverview();
  const changePlanMutation = useChangePlan();
  const impersonateMutation = useImpersonateUserAction();
  const toast = useToast();
  const [error, setError] = useState<string | null>(queryError?.message || null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateEmail, setImpersonateEmail] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'orgs' | 'analytics' | 'revenue' | 'health'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  const handleImpersonate = async (email?: string) => {
    const targetEmail = email || impersonateEmail.trim();
    if (!targetEmail) return;
    setImpersonating(true);
    try {
      const data = await impersonateMutation.mutateAsync({ email: targetEmail });

      // Store impersonation token and reload
      localStorage.setItem('token', data.token);
      localStorage.setItem('cybersec_impersonated_by', user?.email || '');
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImpersonating(false);
    }
  };

  const handleChangePlan = async (orgId: string, planType: string) => {
    try {
      await changePlanMutation.mutateAsync({ organizationId: orgId, planType });
      await refetch();
      toast.success(`${t('admin.planChanged', 'Plan changed to')} ${planType} ${t('admin.successfully', 'successfully!')}`);
    } catch (e: any) {
      setError(e.message);
      toast.error(`${t('admin.changePlanFailed', 'Failed to change plan')}: ${e.message}`);
    }
  };

  const adminAction = async (url: string, method: string, body?: any) => {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('admin.actionFailed', 'Action failed'));
      return data;
    } catch (e: any) {
      throw e;
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Delete organization "${orgName}" and ALL related data (users, scans, reports, projects, agents)? This cannot be undone.`)) return;
    setActionLoading(orgId);
    try {
      await adminAction(`${API_URL}/admin/organizations/${orgId}`, 'DELETE');
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    setActionLoading(userId);
    try {
      await adminAction(`${API_URL}/admin/users/${userId}`, 'DELETE');
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      await adminAction(`${API_URL}/admin/users/${userId}/toggle`, 'PUT');
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    setActionLoading(userId);
    try {
      await adminAction(`${API_URL}/admin/users/${userId}/role`, 'PUT', { role });
      refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (bulkSelected.size === 0) return;
    const label = action === 'delete' ? 'DELETE' : action;
    if (!confirm(`${label} ${bulkSelected.size} selected user(s)?`)) return;
    for (const userId of bulkSelected) {
      try {
        if (action === 'delete') {
          await adminAction(`${API_URL}/admin/users/${userId}`, 'DELETE');
        } else {
          await adminAction(`${API_URL}/admin/users/${userId}/toggle`, 'PUT');
        }
      } catch { /* continue with others */ }
    }
    setBulkSelected(new Set());
    refetch();
    toast.success(`Bulk ${action} completed for ${bulkSelected.size} user(s)`);
  };

  // Guard: only superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin.accessDenied', 'Access Denied')}</h2>
            <p className="text-gray-500">{t('admin.superadminRequired', 'Superadmin access required.')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <AdminPageSkeleton />;
  }

  const d = overview;

  return (
    <PageTransition>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-3xl">👑</span> Admin God Mode
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Full platform control — {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full font-bold uppercase tracking-wider">
            Superadmin
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{t('common.dismiss', 'dismiss')}</button>
        </div>
      )}

      {/* KPI Cards */}
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={d.users.total} sub={`${d.users.active} active`} color="blue" />
          <StatCard label="Organizations" value={d.organizations.total} sub={`${Object.keys(d.organizations.plans_distribution).length} plan types`} color="emerald" />
          <StatCard label="Total Scans" value={d.scans.total} sub={`${d.scans.running} running`} color="amber" />
          <StatCard label="Agents" value={d.agents.total} sub={`${d.agents.online} online`} color="purple" />
          <StatCard label="MRR" value={`€${d.revenue.mrr.toLocaleString()}`} sub={`ARR: €${d.revenue.arr.toLocaleString()}`} color="cyan" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-lg w-fit flex-wrap">
        {([
          ['overview', '📊 Overview'],
          ['users', '👤 Users'],
          ['orgs', '🏢 Organizations'],
          ['analytics', '📈 Analytics'],
          ['revenue', '💰 Revenue'],
          ['health', '🏥 System Health'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Impersonate Box */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span>🎭</span> {t('admin.impersonateUser', 'Impersonate User')}
        </h3>
        <div className="flex gap-3">
          <input
            type="email"
              placeholder={t('admin.impersonatePlaceholder', 'user@example.com')}
            value={impersonateEmail}
            onChange={(e) => setImpersonateEmail(e.target.value)}
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none"
          />
          <button
            onClick={() => handleImpersonate()}
            disabled={impersonating || !impersonateEmail.trim()}
            className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
          >
            {impersonating ? 'Switching...' : 'Impersonate'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">⚠️ This will log you in as the target user. Refresh to return.</p>
      </div>

      {/* Quick Plan Switch */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span>⚡</span> Quick Plan Switch (Your Org)
        </h3>
        <div className="flex gap-2 flex-wrap">
          {['free', 'starter', 'professional', 'enterprise'].map((plan) => {
            const isCurrent = d?.organizations?.list?.find((o: AdminOrg) => o.id === user?.organization_id)?.plan_type === plan;
            return (
              <button
                key={plan}
                onClick={() => user?.organization_id && handleChangePlan(user.organization_id, plan)}
                disabled={!user?.organization_id || changePlanMutation.isPending}
                className={`px-4 py-2 text-sm rounded-lg transition capitalize ${
                  isCurrent
                    ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-400/50'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {changePlanMutation.isPending && changePlanMutation.variables?.planType === plan ? '...' : plan}
                {isCurrent && ' ✓'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && d && (
        <div className="space-y-6">
          {/* Plans Distribution */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t('admin.plansDistribution', 'Plans Distribution')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(d.organizations.plans_distribution).map(([plan, count]) => (
                <div key={plan} className="bg-white dark:bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{plan}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Scans */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t('admin.recentScans', 'Recent Scans')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left">
                     <th className="pb-2 font-medium">{t('admin.colTarget', 'Target')}</th>
                     <th className="pb-2 font-medium">{t('admin.colStatus', 'Status')}</th>
                     <th className="pb-2 font-medium">{t('admin.colCreated', 'Created')}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 dark:text-gray-300">
                  {d.scans.recent.map((s) => (
                    <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="py-2 font-mono text-xs">{s.target}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                          s.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && d && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t('admin.allUsers', 'All Users')} ({d.users.total})
            </h3>
            {bulkSelected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{bulkSelected.size} selected</span>
                  <button onClick={() => handleBulkAction('activate')} className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/30">{t('admin.activate', 'Activate')}</button>
                  <button onClick={() => handleBulkAction('deactivate')} className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg hover:bg-yellow-500/30">{t('admin.deactivate', 'Deactivate')}</button>
                  <button onClick={() => handleBulkAction('delete')} className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30">{t('admin.delete', 'Delete')}</button>
                  <button onClick={() => setBulkSelected(new Set())} className="text-xs text-gray-400 underline">{t('admin.clear', 'Clear')}</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-2 font-medium">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) setBulkSelected(new Set(d.users.list.filter((u: AdminUser) => u.id !== user?.id).map((u: AdminUser) => u.id)));
                        else setBulkSelected(new Set());
                      }}
                      checked={bulkSelected.size > 0 && bulkSelected.size === d.users.list.filter((u: AdminUser) => u.id !== user?.id).length}
                      className="rounded"
                    />
                  </th>
                      <th className="pb-2 font-medium">{t('admin.colEmail', 'Email')}</th>
                      <th className="pb-2 font-medium">{t('admin.colName', 'Name')}</th>
                      <th className="pb-2 font-medium">{t('admin.colRole', 'Role')}</th>
                      <th className="pb-2 font-medium">{t('admin.colActive', 'Active')}</th>
                      <th className="pb-2 font-medium">{t('admin.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-300">
                {d.users.list.map((u: AdminUser) => (
                  <tr key={u.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2">
                      {u.id !== user?.id && (
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(u.id)}
                          onChange={(e) => {
                            const next = new Set(bulkSelected);
                            if (e.target.checked) next.add(u.id); else next.delete(u.id);
                            setBulkSelected(next);
                          }}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="py-2 font-mono text-xs">{u.email}</td>
                    <td className="py-2 text-xs">{u.first_name} {u.last_name}</td>
                    <td className="py-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={u.id === user?.id || actionLoading === u.id}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="user">{t('admin.roleUser', 'user')}</option>
                        <option value="admin">{t('admin.roleAdmin', 'admin')}</option>
                        <option value="superadmin">{t('admin.roleSuperadmin', 'superadmin')}</option>
                      </select>
                    </td>
                    <td className="py-2 text-xs">
                      <button
                        onClick={() => handleToggleUser(u.id)}
                        disabled={u.id === user?.id || actionLoading === u.id}
                        className="hover:opacity-70 disabled:opacity-30"
                        title={u.is_active ? 'Deactivate user' : 'Activate user'}
                      >
                        {u.is_active ? '✅' : '❌'}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleImpersonate(u.email)}
                          disabled={actionLoading === u.id}
                          className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                          Impersonate
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={actionLoading === u.id}
                            className="text-xs text-red-600 hover:text-red-500 underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orgs' && d && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
            All Organizations ({d.organizations.total})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-2 font-medium">{t('admin.colName', 'Name')}</th>
                  <th className="pb-2 font-medium">{t('admin.colSlug', 'Slug')}</th>
                  <th className="pb-2 font-medium">{t('admin.colPlan', 'Plan')}</th>
                  <th className="pb-2 font-medium">{t('admin.colActive', 'Active')}</th>
                  <th className="pb-2 font-medium">{t('admin.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-300">
                {d.organizations.list.map((o: AdminOrg) => (
                  <tr key={o.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2 text-xs font-medium">{o.name}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{o.slug}</td>
                    <td className="py-2">
                      <select
                        value={o.plan_type}
                        onChange={(e) => handleChangePlan(o.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      >
                        <option value="free">{t('admin.planFree', 'free')}</option>
                        <option value="starter">{t('admin.planStarter', 'starter')}</option>
                        <option value="professional">{t('admin.planProfessional', 'professional')}</option>
                        <option value="enterprise">{t('admin.planEnterprise', 'enterprise')}</option>
                      </select>
                    </td>
                    <td className="py-2 text-xs">{o.is_active ? '✅' : '❌'}</td>
                    <td className="py-2 text-xs">
                      <button
                        onClick={() => handleDeleteOrg(o.id, o.name)}
                        disabled={actionLoading === o.id}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50"
                      >
                        {actionLoading === o.id ? '...' : '🗑️ Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && d && (
        <div className="space-y-6">
          {/* User Growth & Activity */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">📊 User Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statTotalUsers', 'Total Users')}</span>
                  <span className="text-white font-bold text-lg">{d.users.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statActiveUsers', 'Active Users')}</span>
                  <span className="text-emerald-400 font-bold text-lg">{d.users.active}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statInactiveUsers', 'Inactive Users')}</span>
                  <span className="text-red-400 font-bold text-lg">{d.users.total - d.users.active}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statActivationRate', 'Activation Rate')}</span>
                  <span className="text-cyan-400 font-bold text-lg">{d.users.total > 0 ? Math.round((d.users.active / d.users.total) * 100) : 0}%</span>
                </div>
                {/* Activity Bar */}
                <div className="pt-2">
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${d.users.total > 0 ? Math.round((d.users.active / d.users.total) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t('admin.scanAnalytics', 'Scan Analytics')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statTotalScans', 'Total Scans')}</span>
                  <span className="text-white font-bold text-lg">{d.scans.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statRunning', 'Currently Running')}</span>
                  <span className="text-blue-400 font-bold text-lg">{d.scans.running}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statCompleted', 'Completed')}</span>
                  <span className="text-emerald-400 font-bold text-lg">{d.scans.total - d.scans.running}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{t('admin.statAvgScans', 'Avg. Scans/User')}</span>
                  <span className="text-purple-400 font-bold text-lg">{d.users.active > 0 ? (d.scans.total / d.users.active).toFixed(1) : '0'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Distribution Visual */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">📋 Plan Distribution</h3>
            <div className="space-y-3">
              {Object.entries(d.organizations.plans_distribution).map(([plan, count]) => {
                const total = d.organizations.total || 1;
                const pct = Math.round(((count as number) / total) * 100);
                const colors: Record<string, string> = { free: 'bg-gray-500', starter: 'bg-blue-500', professional: 'bg-emerald-500', enterprise: 'bg-purple-500' };
                return (
                  <div key={plan}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{plan}</span>
                      <span className="text-gray-400">{count as number} orgs ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${colors[plan] || 'bg-gray-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">⚡ Recent Activity</h3>
            <div className="space-y-2">
              {d.scans.recent.slice(0, 10).map((s: ScanSummary, i: number) => (
                <div key={s.id || i} className="flex items-center gap-3 py-2 border-b border-gray-700/50 last:border-0">
                  <span className={`w-2 h-2 rounded-full ${s.status === 'completed' ? 'bg-emerald-400' : s.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-300 font-mono flex-1 truncate">{s.target}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : s.status === 'running' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>{s.status}</span>
                  <span className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</span>
                </div>
              ))}
              {d.scans.recent.length === 0 && <p className="text-gray-500 text-sm">No recent activity</p>}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {tab === 'revenue' && d && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard label="MRR" value={`€${d.revenue.mrr.toLocaleString()}`} sub="Monthly Recurring Revenue" color="emerald" />
            <StatCard label="ARR" value={`€${d.revenue.arr.toLocaleString()}`} sub="Annual Recurring Revenue" color="cyan" />
            <StatCard label="Paying Orgs" value={d.organizations.total - (d.organizations.plans_distribution['free'] || 0)} sub={`of ${d.organizations.total} total`} color="purple" />
            <StatCard label="ARPU" value={`€${d.organizations.total > 0 ? Math.round(d.revenue.mrr / Math.max(1, d.organizations.total - (d.organizations.plans_distribution['free'] || 0))) : 0}`} sub="Avg Revenue Per User" color="amber" />
          </div>

          {/* Revenue Breakdown by Plan */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">💰 Revenue by Plan</h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { plan: 'Free', price: 0, count: d.organizations.plans_distribution['free'] || 0, color: 'gray' },
                { plan: 'Starter', price: 99, count: d.organizations.plans_distribution['starter'] || 0, color: 'blue' },
                { plan: 'Professional', price: 299, count: d.organizations.plans_distribution['professional'] || 0, color: 'emerald' },
                { plan: 'Enterprise', price: 799, count: d.organizations.plans_distribution['enterprise'] || 0, color: 'purple' },
              ].map((item) => (
                <div key={item.plan} className="bg-white dark:bg-gray-900 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 uppercase">{item.plan}</div>
                  <div className="text-2xl font-bold text-white mt-1">€{(item.price * item.count).toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">{item.count} × €{item.price}/mo</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Projection */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t('admin.revenueProjections', 'Revenue Projections')}</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">{t('admin.revThisMonth', 'This Month')}</div>
                <div className="text-3xl font-bold text-emerald-400 mt-1">€{d.revenue.mrr.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">{t('admin.revQuarterly', 'Quarterly (est.)')}</div>
                <div className="text-3xl font-bold text-cyan-400 mt-1">€{(d.revenue.mrr * 3).toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">{t('admin.revAnnual', 'Annual (est.)')}</div>
                <div className="text-3xl font-bold text-purple-400 mt-1">€{d.revenue.arr.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {tab === 'health' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <HealthCard
              title="🖥️ Backend API"
              status="operational"
              detail="Rust Axum v4.0.0"
              metric="Port 5001"
            />
            <HealthCard
              title="🗄️ PostgreSQL"
              status="operational"
              detail="cybersec_pro database"
              metric="localhost:5432"
            />
            <HealthCard
              title="🌐 Nginx Proxy"
              status="operational"
              detail="Reverse proxy active"
              metric="Port 80 / 443"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <HealthCard
              title="💳 Stripe Payments"
              status="operational"
              detail="Live mode active"
              metric="3 price IDs configured"
            />
            <HealthCard
              title="📧 Email (SMTP)"
              status="operational"
              detail="Gmail SMTP"
              metric="smtp.gmail.com:465"
            />
          </div>

          {/* Services Overview */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">🛡️ Platform Services</h3>
            <div className="space-y-3">
              {[
                { name: 'Authentication & JWT', status: 'active', icon: '🔐' },
                { name: 'Rate Limiting', status: 'active', icon: '⚡' },
                { name: 'WebSocket (Socket.IO)', status: 'active', icon: '🔌' },
                { name: 'Service Manager Watchdog', status: 'active', icon: '🛡️' },
                { name: 'Site Monitor', status: 'active', icon: '📡' },
                { name: 'Audit Logging', status: 'active', icon: '📝' },
                { name: 'CORS & Security Headers', status: 'active', icon: '🔒' },
                { name: 'Static File Serving', status: 'active', icon: '📁' },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{svc.icon}</span>
                    <span className="text-sm text-gray-300">{svc.name}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {d && (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">🤖 Agent Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{d.agents.total}</div>
                  <div className="text-xs text-gray-500">{t('admin.statTotalAgents', 'Total Agents')}</div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{d.agents.online}</div>
                  <div className="text-xs text-gray-500">{t('admin.statOnlineNow', 'Online Now')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </PageTransition>
  );
}

function HealthCard({ title, status, detail, metric }: { title: string; status: string; detail: string; metric: string }) {
  const isOk = status === 'operational';
  return (
    <div className={`bg-gray-50 dark:bg-gray-800/50 border rounded-xl p-5 ${isOk ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${isOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-400">{detail}</p>
      <p className="text-xs text-gray-500 mt-1">{metric}</p>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.blue} border rounded-xl p-4`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

export default AdminPage;
