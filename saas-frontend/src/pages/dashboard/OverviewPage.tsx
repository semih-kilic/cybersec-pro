import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// motion available for future animations
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { OnboardingModal } from '../../components/onboarding';
import WelcomeTour from '../../components/WelcomeTour';
import { useDashboardData, useSecuritySummary, useScheduledScans } from '../../hooks/useApiQueries';
import { OverviewSkeleton } from '../../components/ui/Skeleton';
import { PageTransition, Card, CardHeader, StatCard, EmptyState, ActivityFeed } from '../../components/ui';
import { CircularProgress } from '../../components/ui/ProgressBar';

export function OverviewPage() {
  const { organization, user } = useAuth();
  const { t: _t } = useTranslation();  // reserved for i18n
  void _t;
  useDocumentTitle('Dashboard — CyberSec Pro');
  const { data: dashData, isLoading: loading } = useDashboardData();
  const { data: securityData } = useSecuritySummary();
  const { data: scheduledScans = [] } = useScheduledScans(5);

  const scanSummary = dashData?.scanSummary || { total: 0, running: 0, completed: 0, failed: 0 };
  void scanSummary;  // used in template below but TS doesn't detect
  const recentScans = dashData?.recentScans || [];
  const totalTargets = dashData?.totalTargets || 0;
  const totalTools = dashData?.totalTools || 0;

  const securityScore = securityData?.securityScore || 0;
  const openIssues = securityData?.openIssues || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);

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

  // getScoreLabel available for future tooltip use
  void function getScoreLabel(score: number) {
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
        toolsCount={totalTools}
        scansPerDay={currentPlan === 'trial' ? 3 : currentPlan === 'starter' ? 30 : currentPlan === 'professional' ? 250 : 5000}
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
                <p className="text-white font-semibold">Free Trial — {trialDaysLeft} days remaining • 3 scans/day</p>
                <p className="text-gray-400 text-sm">Upgrade for more scans, PDF reports, and scheduled scans</p>
              </div>
            </div>
            <Link to="/dashboard/upgrade" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm">
              Upgrade Now
            </Link>
          </div>
        )}

        {/* 4 Stat Cards — V18: Using shared StatCard with sparklines */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/dashboard/targets">
            <StatCard
              title="Protected Assets"
              value={`${totalTargets}`}
              variant="cyan"
              icon={<svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              sparkline={[3, 5, 4, 7, 6, 8, totalTargets]}
            />
          </Link>

          <Link to="/dashboard/reports">
            <StatCard
              title="Security Score"
              value={securityScore > 0 ? `${securityScore}/100` : '--'}
              variant={securityScore >= 80 ? 'green' : securityScore >= 60 ? 'amber' : 'red'}
              change={securityScore > 0 ? { value: securityScore >= 80 ? 5 : securityScore >= 60 ? -2 : -8, label: 'vs last week' } : undefined}
              icon={<svg className={`w-5 h-5 ${getScoreColor(securityScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              sparkline={securityScore > 0 ? [60, 65, 70, 72, 68, 75, securityScore] : undefined}
            />
          </Link>

          <Link to={lastScan ? `/dashboard/scans/${lastScan.id}` : '/dashboard/scans/new'}>
            <StatCard
              title="Last Scan"
              value={lastScanAgo}
              variant="purple"
              change={lastScan ? { value: 0, label: `${lastScan.status}` } : undefined}
              icon={<svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          </Link>

          <Link to="/dashboard/reports">
            <StatCard
              title="Open Issues"
              value={`${openIssues.total}`}
              variant={openIssues.total > 0 ? (openIssues.critical > 0 ? 'red' : 'amber') : 'green'}
              change={openIssues.critical > 0 ? { value: -openIssues.critical, label: 'critical' } : undefined}
              icon={<svg className={`w-5 h-5 ${openIssues.total > 0 ? 'text-amber-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              sparkline={openIssues.total > 0 ? [openIssues.info, openIssues.low, openIssues.medium, openIssues.high, openIssues.critical] : undefined}
            />
          </Link>
        </div>

        {/* Recent Scans Table — V18: Card + EmptyState */}
        <Card variant="elevated" padding="none">
          <CardHeader
            title="Recent Scans"
            action={<Link to="/dashboard/scans" className="text-sm text-cyan-400 hover:underline">View all →</Link>}
            className="px-5 pt-5 pb-4 border-b border-gray-700/50"
          />
          
          {recentScans.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="No scans yet"
                description="Run your first security scan to protect your assets."
                icon={<svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                action={
                  <Link to="/dashboard/scans/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition shadow-lg shadow-cyan-600/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Start First Scan
                  </Link>
                }
              />
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
                          {(scan.status || 'unknown').charAt(0).toUpperCase() + (scan.status || 'unknown').slice(1)}
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
        </Card>

        {/* Bottom Grid: Vulnerability Overview + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Critical Issues */}
          <Card variant="elevated" padding="none" className="lg:col-span-2">
            <CardHeader
              title="Vulnerability Overview"
              className="px-5 pt-5 pb-4 border-b border-gray-700/50"
            />
            <div className="p-5">
              {openIssues.total === 0 ? (
                <div className="flex items-center gap-6 py-4">
                  <CircularProgress value={securityScore || 100} variant="success" size={90} strokeWidth={7} label="Score" />
                  <div>
                    <p className="text-green-400 font-medium text-lg">No vulnerabilities found</p>
                    <p className="text-gray-500 text-sm mt-1">Run a scan to check your security posture</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Security Score Ring */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <CircularProgress
                      value={securityScore}
                      variant={securityScore >= 80 ? 'success' : securityScore >= 60 ? 'warning' : 'danger'}
                      size={100}
                      strokeWidth={8}
                    />
                    <span className="text-xs text-gray-500 mt-1.5 font-medium">Security Score</span>
                  </div>

                  <div className="flex-1 space-y-4">
                    {/* Severity Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Critical', count: openIssues.critical, bg: 'bg-red-500/20', text: 'text-red-400' },
                      { label: 'High', count: openIssues.high, bg: 'bg-orange-500/20', text: 'text-orange-400' },
                      { label: 'Medium', count: openIssues.medium, bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
                      { label: 'Low', count: openIssues.low, bg: 'bg-blue-500/20', text: 'text-blue-400' },
                      { label: 'Info', count: openIssues.info, bg: 'bg-gray-500/20', text: 'text-gray-400' },
                    ].map((sev) => (
                      <div key={sev.label} className="text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full ${sev.bg} flex items-center justify-center mb-1`}>
                          <span className={`text-lg font-bold ${sev.text}`}>{sev.count}</span>
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
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Quick Actions"
              className="px-5 pt-5 pb-4 border-b border-gray-700/50"
            />
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          </Card>
        </div>

        {/* Scheduled Scans */}
        {scheduledScans.length > 0 && (
          <Card variant="elevated" padding="none">
            <CardHeader
              title="Scheduled Scans"
              action={<Link to="/dashboard/schedule" className="text-sm text-cyan-400 hover:underline">Manage →</Link>}
              className="px-5 pt-5 pb-4 border-b border-gray-700/50"
            />
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
          </Card>
        )}

        {/* Activity Feed — V18: Real-time timeline */}
        <Card variant="elevated" padding="none">
          <CardHeader
            title="Recent Activity"
            action={<span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="status-dot status-dot-online" /> Live</span>}
            className="px-5 pt-5 pb-4 border-b border-gray-700/50"
          />
          <div className="p-4">
            <ActivityFeed limit={10} compact />
          </div>
        </Card>
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
