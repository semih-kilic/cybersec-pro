/**
 * 🛡️ Admin God Mode - Superadmin Only
 * Impersonate users, view all organizations, MRR stats.
 */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAdminOverview, useChangePlan, useImpersonateUserAction } from '../../hooks/useApiQueries';
import { AdminPageSkeleton } from '../../components/ui/Skeleton';

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
  useDocumentTitle('Admin — CyberSec Pro');
  const { user, token } = useAuth();
  const { data: overview, isLoading: loading, error: queryError, refetch } = useAdminOverview();
  const changePlanMutation = useChangePlan();
  const impersonateMutation = useImpersonateUserAction();
  const [error, setError] = useState<string | null>(queryError?.message || null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateEmail, setImpersonateEmail] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'orgs'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      refetch();
    } catch (e: any) {
      setError(e.message);
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
      if (!res.ok) throw new Error(data.error || 'Action failed');
      return data;
    } catch (e: any) {
      throw e;
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

  // Guard: only superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500">Superadmin access required.</p>
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
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
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
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-lg w-fit">
        {(['overview', 'users', 'orgs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t === 'overview' ? '📊 Overview' : t === 'users' ? '👤 Users' : '🏢 Organizations'}
          </button>
        ))}
      </div>

      {/* Impersonate Box */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span>🎭</span> Impersonate User
        </h3>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="user@example.com"
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
          {['free', 'starter', 'professional', 'enterprise'].map((plan) => (
            <button
              key={plan}
              onClick={() => user?.organization_id && handleChangePlan(user.organization_id, plan)}
              disabled={!user?.organization_id}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition capitalize"
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && d && (
        <div className="space-y-6">
          {/* Plans Distribution */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Plans Distribution</h3>
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
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Recent Scans</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
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
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
            All Users ({d.users.total})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Active</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-300">
                {d.users.list.map((u) => (
                  <tr key={u.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2 font-mono text-xs">{u.email}</td>
                    <td className="py-2 text-xs">{u.first_name} {u.last_name}</td>
                    <td className="py-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={u.id === user?.id || actionLoading === u.id}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
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
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Slug</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Active</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-300">
                {d.organizations.list.map((o) => (
                  <tr key={o.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2 text-xs font-medium">{o.name}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{o.slug}</td>
                    <td className="py-2">
                      <select
                        value={o.plan_type}
                        onChange={(e) => handleChangePlan(o.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      >
                        <option value="free">free</option>
                        <option value="starter">starter</option>
                        <option value="professional">professional</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                    </td>
                    <td className="py-2 text-xs">{o.is_active ? '✅' : '❌'}</td>
                    <td className="py-2 text-xs text-gray-500">{o.id.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
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
