import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { OnboardingModal } from '../../components/onboarding';
import WelcomeTour from '../../components/WelcomeTour';
import { useDashboardData } from '../../hooks/useApiQueries';
import { OverviewSkeleton } from '../../components/ui/Skeleton';
import { PageTransition } from '../../components/ui/PageTransition';

export function OverviewPage() {
  const { token, organization, user } = useAuth();
  const { t: _t } = useTranslation();  // reserved for i18n
  void _t;
  const { data: dashData, isLoading: loading } = useDashboardData();
  const scanSummary = dashData?.scanSummary || { total: 0, running: 0, completed: 0, failed: 0 };
  void scanSummary;  // used in template below but TS doesn't detect
  const recentScans = dashData?.recentScans || [];
  const totalTargets = dashData?.totalTargets || 0;

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [securityScore, setSecurityScore] = useState(0);
  const [openIssues, setOpenIssues] = useState({ critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
  const [scheduledScans, setScheduledScans] = useState<any[]>([]);

  // Fetch security score & issues from API
  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/security-summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSecurityScore(data.security_score || 0);
          setOpenIssues(data.open_issues || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
        }
      } catch { /* Use defaults */ }
    };
    const fetchScheduled = async () => {
      try {
        const res = await fetch('/api/v1/schedules', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setScheduledScans((data.schedules || []).slice(0, 5));
        }
      } catch { /* ignore */ }
    };
    if (token) { fetchSecurityData(); fetchScheduled(); }
  }, [token]);

  useEffect(() => {
    const tourCompleted = localStorage.getItem('cybersec_tour_completed');
    if (!tourCompleted && user && !loading) setShowWelcomeTour(true);
  }, [user, loading]);

  useEffect(() => {
    if (!onboardingChecked && user && organization) {
      const key = `onboarding_completed_${user.id}`;
      if (localStorage.getItem(key) !== 'true') setShowOnboarding(true);
      setOnboardingChecked(true);
    }
  }, [user, organization, onboardingChecked]);

  const handleOnboardingComplete = () => {
    if (user) localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
    setShowOnboarding(false);
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      running: 'text-yellow-400 bg-yellow-400/10',
      completed: 'text-green-400 bg-green-400/10',
      failed: 'text-red-400 bg-red-400/10',
      queued: 'text-blue-400 bg-blue-400/10',
    };
    return map[status] || 'text-gray-400 bg-gray-400/10';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Needs Attention';
    if (score >= 40) return 'At Risk';
    return 'Critical';
  };

  // Last scan info
  const lastScan = recentScans.length > 0 ? recentScans[0] : null;
  const lastScanTime = lastScan ? new Date(lastScan.started_at) : null;
  const lastScanAgo = lastScanTime ? getTimeAgo(lastScanTime) : 'Never';

  if (loading) {
    return <div className="min-h-screen bg-gray-950"><Header /><OverviewSkeleton /></div>;
  }

  const currentPlan = organization?.plan_type || 'trial';
  const orgCreatedAt = (organization as any)?.created_at;
  const trialDaysLeft = currentPlan === 'trial' ? Math.max(0, 14 - Math.floor((Date.now() - new Date(orgCreatedAt || Date.now()).getTime()) / 86400000)) : 0;

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <WelcomeTour isOpen={showWelcomeTour} onClose={() => setShowWelcomeTour(false)} planType={currentPlan} />
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        userName={user?.first_name || 'User'}
        planType={currentPlan}
        toolsCount={682}
        scansPerDay={currentPlan === 'enterprise' ? -1 : currentPlan === 'professional' ? 100 : currentPlan === 'starter' ? 30 : 5}
        trialDaysLeft={currentPlan === 'trial' ? trialDaysLeft : undefined}
      />

      <Header 
        title={`Welcome back, ${user?.first_name || 'User'}`}
        subtitle={`${organization?.name || 'Your Organization'} • ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        actions={
          <Link to="/dashboard/scans/new" className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-lg shadow-blue-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            + New Scan
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Trial Banner */}
        {currentPlan === 'trial' && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-4 border border-blue-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-lg">⏳</span>
              </div>
              <div>
                <p className="text-white font-semibold">Free Trial — {trialDaysLeft} days remaining</p>
                <p className="text-gray-400 text-sm">Unlock unlimited scans and compliance reports</p>
              </div>
            </div>
            <Link to="/dashboard/billing/upgrade" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm">
              Upgrade Now
            </Link>
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Protected Assets */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-blue-500/30 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <Link to="/dashboard/targets" className="text-xs text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition">Manage →</Link>
            </div>
            <p className="text-sm text-gray-400 mb-1">Protected Assets</p>
            <p className="text-2xl font-bold text-white">{totalTargets} <span className="text-sm font-normal text-gray-500">active domains</span></p>
          </div>

          {/* Security Score */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-green-500/30 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${securityScore >= 80 ? 'bg-green-500/10' : securityScore >= 60 ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                <svg className={`w-5 h-5 ${getScoreColor(securityScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <Link to="/dashboard/reports" className="text-xs text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition">Breakdown →</Link>
            </div>
            <p className="text-sm text-gray-400 mb-1">Security Score</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>{securityScore || '--'}<span className="text-lg">/100</span></p>
              <span className="text-xs text-gray-500">{securityScore > 0 ? getScoreLabel(securityScore) : 'Run a scan'}</span>
            </div>
          </div>

          {/* Last Scan */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-purple-500/30 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              {lastScan && <Link to={`/dashboard/scans/${lastScan.id}`} className="text-xs text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition">View →</Link>}
            </div>
            <p className="text-sm text-gray-400 mb-1">Last Scan</p>
            <p className="text-2xl font-bold text-white">{lastScanAgo}</p>
            {lastScan && (
              <span className={`inline-flex items-center gap-1 text-xs mt-1 ${lastScan.status === 'completed' ? 'text-green-400' : lastScan.status === 'running' ? 'text-yellow-400' : 'text-red-400'}`}>
                {lastScan.status === 'completed' ? '✅' : lastScan.status === 'running' ? '⏳' : '❌'} {lastScan.status.charAt(0).toUpperCase() + lastScan.status.slice(1)}
              </span>
            )}
          </div>

          {/* Open Issues */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-orange-500/30 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${openIssues.total > 0 ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                <svg className={`w-5 h-5 ${openIssues.total > 0 ? 'text-orange-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <Link to="/dashboard/reports" className="text-xs text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition">Fix →</Link>
            </div>
            <p className="text-sm text-gray-400 mb-1">Open Issues</p>
            <p className="text-2xl font-bold text-white">{openIssues.total} <span className="text-sm font-normal text-gray-500">vulnerabilities</span></p>
            {openIssues.total > 0 && (
              <div className="flex gap-2 mt-1 text-xs">
                {openIssues.critical > 0 && <span className="text-red-400">{openIssues.critical} critical</span>}
                {openIssues.high > 0 && <span className="text-orange-400">{openIssues.high} high</span>}
                {openIssues.medium > 0 && <span className="text-yellow-400">{openIssues.medium} medium</span>}
              </div>
            )}
          </div>
        </div>

        {/* Recent Scans Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Scans</h2>
            <div className="flex gap-3">
              <Link to="/dashboard/scans" className="text-sm text-blue-400 hover:underline">View all</Link>
            </div>
          </div>
          
          {recentScans.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No scans yet</h3>
              <p className="text-gray-400 mb-4">Run your first security scan to protect your business.</p>
              <Link to="/dashboard/scans/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">
                Start First Scan
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-5 py-3 font-medium">Domain</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                    <th className="px-5 py-3 font-medium">Issues</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan: any) => (
                    <tr key={scan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-5 py-4">
                        <span className="text-white font-medium">{scan.target || 'Unknown'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-gray-300 text-sm">{scan.scan_type || scan.tool_name || 'Scan'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                          {scan.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                          {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`font-semibold ${getScoreColor(scan.score || 0)}`}>{scan.score || '--'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-white">{scan.findings || 0}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {getTimeAgo(new Date(scan.started_at))}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link to={`/dashboard/scans/${scan.id}`} className="text-blue-400 hover:underline text-sm">View</Link>
                          <Link to={`/dashboard/scans/new?target=${encodeURIComponent(scan.target || '')}`} className="text-gray-500 hover:text-white text-sm">Rescan</Link>
                          <Link to={`/dashboard/reports?scan=${scan.id}`} className="text-gray-500 hover:text-white text-sm">Report</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Grid: Critical Issues + Scheduled + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Critical Issues */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Vulnerability Overview</h2>
            </div>
            <div className="p-5">
              {openIssues.total === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-green-400 font-medium">No vulnerabilities found</p>
                  <p className="text-gray-500 text-sm mt-1">Run a scan to check your security posture</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Severity Breakdown */}
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Critical', count: openIssues.critical, color: 'red' },
                      { label: 'High', count: openIssues.high, color: 'orange' },
                      { label: 'Medium', count: openIssues.medium, color: 'yellow' },
                      { label: 'Low', count: openIssues.low, color: 'blue' },
                      { label: 'Info', count: openIssues.info, color: 'gray' },
                    ].map((sev) => (
                      <div key={sev.label} className="text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full bg-${sev.color}-500/20 flex items-center justify-center mb-1`}>
                          <span className={`text-lg font-bold text-${sev.color}-400`}>{sev.count}</span>
                        </div>
                        <p className="text-xs text-gray-400">{sev.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Severity Bar */}
                  <div className="h-3 rounded-full overflow-hidden flex bg-gray-800">
                    {openIssues.critical > 0 && <div className="bg-red-500 h-full" style={{ width: `${(openIssues.critical / openIssues.total) * 100}%` }} />}
                    {openIssues.high > 0 && <div className="bg-orange-500 h-full" style={{ width: `${(openIssues.high / openIssues.total) * 100}%` }} />}
                    {openIssues.medium > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${(openIssues.medium / openIssues.total) * 100}%` }} />}
                    {openIssues.low > 0 && <div className="bg-blue-500 h-full" style={{ width: `${(openIssues.low / openIssues.total) * 100}%` }} />}
                    {openIssues.info > 0 && <div className="bg-gray-500 h-full" style={{ width: `${(openIssues.info / openIssues.total) * 100}%` }} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { to: '/dashboard/scans/new', icon: '🔍', label: 'New Scan', color: 'blue' },
                { to: '/dashboard/reports', icon: '📊', label: 'Reports', color: 'purple' },
                { to: '/dashboard/targets/new', icon: '⚙️', label: 'Add Domain', color: 'green' },
                { to: '/dashboard/analytics', icon: '📈', label: 'Analytics', color: 'orange' },
                { to: '/dashboard/settings', icon: '🔔', label: 'Alerts', color: 'yellow' },
                { to: '/dashboard/settings', icon: '👥', label: 'Team', color: 'cyan' },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition group"
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="text-white text-sm font-medium group-hover:text-blue-400 transition">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Scheduled Scans */}
        {scheduledScans.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Scheduled Scans</h2>
              <Link to="/dashboard/schedule" className="text-sm text-blue-400 hover:underline">Manage</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-5 py-3 font-medium">Domain</th>
                    <th className="px-5 py-3 font-medium">Next Run</th>
                    <th className="px-5 py-3 font-medium">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledScans.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="px-5 py-3 text-white text-sm">{s.target || s.name || 'Scheduled scan'}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{s.next_run || 'Pending'}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm capitalize">{s.frequency || s.schedule || 'Weekly'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </PageTransition>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default OverviewPage;
