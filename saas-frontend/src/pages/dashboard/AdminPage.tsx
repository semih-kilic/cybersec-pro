/**
 * 🛡️ Admin God Mode - Superadmin Only
 * Impersonate users, view all organizations, MRR stats.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';

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

interface AdminOverview {
  users: { total: number; active: number; list: AdminUser[] };
  organizations: { total: number; plans_distribution: Record<string, number>; list: AdminOrg[] };
  scans: { total: number; running: number; recent: ScanSummary[] };
  agents: { total: number; online: number };
  revenue: { mrr: number; arr: number };
}

export function AdminPage() {
  const { user, token } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateEmail, setImpersonateEmail] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'orgs'>('overview');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load admin data');
      }
      setOverview(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleImpersonate = async () => {
    if (!impersonateEmail.trim()) return;
    setImpersonating(true);
    try {
      const res = await fetch('/api/v1/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: impersonateEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store impersonation token and reload
      localStorage.setItem('cybersec_token', data.token);
      localStorage.setItem('cybersec_impersonated_by', user?.email || '');
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImpersonating(false);
    }
  };

  const handleChangePlan = async (planType: string) => {
    try {
      const res = await fetch('/api/v1/admin/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: planType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchOverview();
    } catch (e: any) {
      setError(e.message);
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = overview;

  return (
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
            onClick={handleImpersonate}
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
          {['trial', 'starter', 'professional', 'enterprise'].map((plan) => (
            <button
              key={plan}
              onClick={() => handleChangePlan(plan)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition capitalize"
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
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'superadmin' ? 'bg-red-500/10 text-red-400' :
                        u.role === 'admin' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 text-xs">{u.is_active ? '✅' : '❌'}</td>
                    <td className="py-2">
                      <button
                        onClick={() => { setImpersonateEmail(u.email); handleImpersonate(); }}
                        className="text-xs text-red-400 hover:text-red-300 underline"
                      >
                        Impersonate
                      </button>
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
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-300">
                {d.organizations.list.map((o) => (
                  <tr key={o.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2 text-xs font-medium">{o.name}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{o.slug}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        o.plan_type === 'enterprise' ? 'bg-purple-500/10 text-purple-400' :
                        o.plan_type === 'professional' ? 'bg-emerald-500/10 text-emerald-400' :
                        o.plan_type === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {o.plan_type}
                      </span>
                    </td>
                    <td className="py-2 text-xs">{o.is_active ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
