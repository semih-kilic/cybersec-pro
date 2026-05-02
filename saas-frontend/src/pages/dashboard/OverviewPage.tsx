/**
 * OverviewPage — Apple-grade restraint
 *
 * Pure black canvas (provided by VosAppShell), generous whitespace,
 * SF Pro typography, hairline dividers, monochromatic surfaces with
 * a single Apple-blue accent reserved for primary action and focus.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowUpRight, Shield, Activity, AlertTriangle, Clock } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useDashboardData, useSecuritySummary, useScheduledScans } from '../../hooks/useApiQueries';
import { OnboardingModal } from '../../components/onboarding';
import WelcomeTour from '../../components/WelcomeTour';
import { OverviewSkeleton } from '../../components/ui/Skeleton';
import { ActivityFeed } from '../../components/ui';
import {
  PageTransition,
  Card,
  Stat,
  StatGroup,
  Badge,
  Button,
  EmptyState,
} from '../../components/vos';

export function OverviewPage() {
  const { organization, user } = useAuth();
  const { t } = useTranslation();
  useDocumentTitle(`${t('overview.title', 'Overview')} — CyberSec Pro`);

  const { data: dashData, isLoading: loading } = useDashboardData();
  const { data: securityData } = useSecuritySummary();
  const { data: scheduledScans = [] } = useScheduledScans(5);

  const recentScans = dashData?.recentScans || [];
  const totalTargets = dashData?.totalTargets || 0;
  const totalTools = dashData?.totalTools || 0;
  const securityScore = securityData?.securityScore || 0;
  const openIssues =
    securityData?.openIssues || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };

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

  const lastScan = recentScans.length > 0 ? recentScans[0] : null;
  const lastScanTime = lastScan ? new Date(lastScan.started_at) : null;
  const lastScanAgo = lastScanTime ? getTimeAgo(lastScanTime) : '—';

  if (loading) return <OverviewSkeleton />;

  const currentPlan = organization?.plan_type || 'trial';
  const orgCreatedAt = (organization as any)?.created_at;
  const trialDaysLeft =
    currentPlan === 'trial'
      ? Math.max(0, 14 - Math.floor((Date.now() - new Date(orgCreatedAt || Date.now()).getTime()) / 86400000))
      : 0;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <PageTransition>
      <WelcomeTour
        isOpen={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
        planType={currentPlan}
      />
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        userName={user?.first_name || 'User'}
        planType={currentPlan}
        toolsCount={totalTools}
        scansPerDay={
          currentPlan === 'trial' ? 3
          : currentPlan === 'starter' ? 30
          : currentPlan === 'professional' ? 250
          : 5000
        }
        trialDaysLeft={currentPlan === 'trial' ? trialDaysLeft : undefined}
      />

      <div className="flex flex-col gap-vos-10">
        {/* Page header — Apple display style */}
        <header className="flex flex-col gap-vos-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-vos-2">
            <span className="text-vos-xs font-medium text-vos-text-3">{today}</span>
            <h1 className="text-vos-5xl font-semibold tracking-vos-tight leading-vos-tight text-vos-text">
              {t('overview.welcome', 'Welcome back')}
              {user?.first_name ? `, ${user.first_name}` : ''}.
            </h1>
            <p className="text-vos-md text-vos-text-3 max-w-xl">
              {organization?.name || 'Your organization'} &middot;{' '}
              {t('overview.subline', 'Here is the security posture of your assets today.')}
            </p>
          </div>
          <Link to="/dashboard/scans/new" className="self-start sm:self-auto">
            <Button variant="primary" leftIcon={<Plus className="size-4" />}>
              {t('overview.newScan', 'New scan')}
            </Button>
          </Link>
        </header>

        {/* Trial notice — quiet hairline strip, no rainbow */}
        {currentPlan === 'trial' && (
          <Card elevation={1} className="rounded-vos-lg p-vos-4 flex items-center justify-between gap-vos-4 border border-vos-border-1">
            <div className="flex items-center gap-vos-3 min-w-0">
              <span className="size-8 rounded-vos-full flex items-center justify-center bg-vos-bg-elev-3 text-vos-text-2">
                <Clock className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-vos-sm text-vos-text font-medium truncate">
                  {t('overview.freeTrial', 'Free trial')} — {trialDaysLeft}{' '}
                  {t('overview.daysRemaining', 'days remaining')}
                </p>
                <p className="text-vos-xs text-vos-text-3 truncate">
                  {t('overview.upgradeHint', 'Upgrade for more scans, PDF reports, and scheduled scans.')}
                </p>
              </div>
            </div>
            <Link to="/dashboard/upgrade" className="shrink-0">
              <Button variant="secondary" size="sm">
                {t('overview.upgrade', 'Upgrade')}
              </Button>
            </Link>
          </Card>
        )}

        {/* Hero metrics — 4 quiet stats */}
        <StatGroup cols={4}>
          <Link to="/dashboard/targets" className="block">
            <Stat
              label={t('overview.protectedAssets', 'Protected assets')}
              value={totalTargets}
              icon={<Shield className="size-4" />}
              hint={t('overview.totalDomains', 'across all environments')}
            />
          </Link>
          <Link to="/dashboard/reports" className="block">
            <Stat
              label={t('overview.securityScore', 'Security score')}
              value={securityScore > 0 ? `${securityScore}` : '—'}
              icon={<Activity className="size-4" />}
              delta={
                securityScore > 0
                  ? {
                      value: securityScore >= 80 ? '+5' : securityScore >= 60 ? '−2' : '−8',
                      tone: securityScore >= 80 ? 'success' : 'danger',
                    }
                  : undefined
              }
              hint={t('overview.outOf100', 'out of 100')}
            />
          </Link>
          <Link
            to={lastScan ? `/dashboard/scans/${lastScan.id}` : '/dashboard/scans/new'}
            className="block"
          >
            <Stat
              label={t('overview.lastScan', 'Last scan')}
              value={lastScanAgo}
              icon={<Clock className="size-4" />}
              hint={lastScan?.status || t('overview.never', 'no scans yet')}
            />
          </Link>
          <Link to="/dashboard/reports" className="block">
            <Stat
              label={t('overview.openIssues', 'Open issues')}
              value={openIssues.total}
              icon={<AlertTriangle className="size-4" />}
              delta={
                openIssues.critical > 0
                  ? { value: `${openIssues.critical} critical`, tone: 'danger' }
                  : undefined
              }
              hint={openIssues.total === 0 ? t('overview.allClear', 'all clear') : undefined}
            />
          </Link>
        </StatGroup>

        {/* Recent scans + Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-vos-6">
          <Card elevation={2} className="rounded-vos-xl lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-vos-6 py-vos-5 border-b border-vos-border-1">
              <div>
                <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
                  {t('overview.recentScans', 'Recent scans')}
                </h2>
                <p className="text-vos-xs text-vos-text-3 mt-0.5">
                  {t('overview.recentScansSub', 'Latest activity across your environments')}
                </p>
              </div>
              <Link
                to="/dashboard/scans"
                className="text-vos-xs font-medium text-vos-accent hover:text-vos-accent-2 inline-flex items-center gap-1"
              >
                {t('common.viewAll', 'View all')} <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            {recentScans.length === 0 ? (
              <div className="px-vos-6 py-vos-12">
                <EmptyState
                  title={t('overview.noScansTitle', 'No scans yet')}
                  description={t(
                    'overview.noScansDesc',
                    'Run your first security scan to protect your assets.',
                  )}
                  action={
                    <Link to="/dashboard/scans/new">
                      <Button variant="primary" leftIcon={<Plus className="size-4" />}>
                        {t('overview.startFirstScan', 'Start first scan')}
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-vos-sm">
                  <thead>
                    <tr className="text-vos-text-3 text-vos-xs font-medium uppercase tracking-vos-wide">
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('overview.colDomain', 'Domain')}
                      </th>
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('common.type', 'Type')}
                      </th>
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('common.status', 'Status')}
                      </th>
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('overview.colScore', 'Score')}
                      </th>
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('overview.colIssues', 'Issues')}
                      </th>
                      <th className="px-vos-6 py-vos-3 text-left font-medium">
                        {t('overview.colDate', 'When')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.map((scan: any) => (
                      <tr
                        key={scan.id}
                        className="border-t border-vos-border-1 hover:bg-vos-bg-elev-3/60 transition-colors"
                      >
                        <td className="px-vos-6 py-vos-4">
                          <Link
                            to={`/dashboard/scans/${scan.id}`}
                            className="text-vos-text font-medium hover:text-vos-accent"
                          >
                            {scan.target || 'Unknown'}
                          </Link>
                        </td>
                        <td className="px-vos-6 py-vos-4 text-vos-text-2">
                          {scan.scan_type || scan.tool_name || 'Scan'}
                        </td>
                        <td className="px-vos-6 py-vos-4">
                          <Badge tone={statusTone(scan.status)} dot size="sm">
                            {capitalize(scan.status || 'unknown')}
                          </Badge>
                        </td>
                        <td className="px-vos-6 py-vos-4 text-vos-text font-medium tabular-nums">
                          {scan.score || '—'}
                        </td>
                        <td className="px-vos-6 py-vos-4 text-vos-text-2 tabular-nums">
                          {scan.findings || 0}
                        </td>
                        <td className="px-vos-6 py-vos-4 text-vos-text-3">
                          {getTimeAgo(new Date(scan.started_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Quick actions — minimal list */}
          <Card elevation={2} className="rounded-vos-xl overflow-hidden">
            <div className="px-vos-6 py-vos-5 border-b border-vos-border-1">
              <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
                {t('overview.quickActions', 'Quick actions')}
              </h2>
              <p className="text-vos-xs text-vos-text-3 mt-0.5">
                {t('overview.quickActionsSub', 'Jump to your most-used tools')}
              </p>
            </div>
            <ul className="divide-y divide-vos-border-1">
              {QUICK_ACTIONS.map((action) => (
                <li key={action.label}>
                  <Link
                    to={action.to}
                    className="flex items-center justify-between px-vos-6 py-vos-4 hover:bg-vos-bg-elev-3/60 transition-colors group"
                  >
                    <span className="text-vos-sm text-vos-text font-medium">
                      {t(action.i18n, action.label)}
                    </span>
                    <ArrowUpRight className="size-4 text-vos-text-3 group-hover:text-vos-accent transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Vulnerability breakdown */}
        <Card elevation={2} className="rounded-vos-xl overflow-hidden">
          <div className="px-vos-6 py-vos-5 border-b border-vos-border-1">
            <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
              {t('overview.vulnOverview', 'Vulnerability overview')}
            </h2>
            <p className="text-vos-xs text-vos-text-3 mt-0.5">
              {t('overview.vulnOverviewSub', 'Severity breakdown across all open findings')}
            </p>
          </div>
          <div className="p-vos-6">
            {openIssues.total === 0 ? (
              <p className="text-vos-sm text-vos-text-2">
                {t('overview.noVulns', 'No vulnerabilities found.')}{' '}
                <span className="text-vos-text-3">
                  {t('overview.runScanHint', 'Run a scan to check your security posture.')}
                </span>
              </p>
            ) : (
              <div className="space-y-vos-5">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-vos-3">
                  {[
                    { label: 'Critical', count: openIssues.critical, tone: 'danger' as const },
                    { label: 'High', count: openIssues.high, tone: 'warning' as const },
                    { label: 'Medium', count: openIssues.medium, tone: 'warning' as const },
                    { label: 'Low', count: openIssues.low, tone: 'info' as const },
                    { label: 'Info', count: openIssues.info, tone: 'default' as const },
                  ].map((sev) => (
                    <div
                      key={sev.label}
                      className="rounded-vos-md border border-vos-border-1 px-vos-4 py-vos-3 flex flex-col gap-1"
                    >
                      <span className="text-vos-2xs uppercase tracking-vos-wide text-vos-text-3 font-medium">
                        {sev.label}
                      </span>
                      <span className="text-vos-2xl font-semibold tabular-nums text-vos-text tracking-vos-tight">
                        {sev.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden flex bg-vos-bg-elev-3">
                  {openIssues.critical > 0 && (
                    <div
                      className="bg-vos-danger h-full"
                      style={{ width: `${(openIssues.critical / openIssues.total) * 100}%` }}
                    />
                  )}
                  {openIssues.high > 0 && (
                    <div
                      className="bg-vos-warning h-full"
                      style={{ width: `${(openIssues.high / openIssues.total) * 100}%` }}
                    />
                  )}
                  {openIssues.medium > 0 && (
                    <div
                      className="bg-vos-warning/60 h-full"
                      style={{ width: `${(openIssues.medium / openIssues.total) * 100}%` }}
                    />
                  )}
                  {openIssues.low > 0 && (
                    <div
                      className="bg-vos-info h-full"
                      style={{ width: `${(openIssues.low / openIssues.total) * 100}%` }}
                    />
                  )}
                  {openIssues.info > 0 && (
                    <div
                      className="bg-vos-text-3 h-full"
                      style={{ width: `${(openIssues.info / openIssues.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Scheduled scans */}
        {scheduledScans.length > 0 && (
          <Card elevation={2} className="rounded-vos-xl overflow-hidden">
            <div className="flex items-center justify-between px-vos-6 py-vos-5 border-b border-vos-border-1">
              <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
                {t('overview.scheduledScans', 'Scheduled scans')}
              </h2>
              <Link
                to="/dashboard/schedule"
                className="text-vos-xs font-medium text-vos-accent hover:text-vos-accent-2 inline-flex items-center gap-1"
              >
                {t('overview.manage', 'Manage')} <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-vos-sm">
                <thead>
                  <tr className="text-vos-text-3 text-vos-xs">
                    <th className="px-vos-6 py-vos-3 text-left font-medium">
                      {t('overview.colDomain', 'Domain')}
                    </th>
                    <th className="px-vos-6 py-vos-3 text-left font-medium">
                      {t('overview.colNextRun', 'Next run')}
                    </th>
                    <th className="px-vos-6 py-vos-3 text-left font-medium">
                      {t('overview.colFrequency', 'Frequency')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledScans.map((s: any, i: number) => (
                    <tr key={i} className="border-t border-vos-border-1">
                      <td className="px-vos-6 py-vos-3 text-vos-text">
                        {s.target || s.name || 'Scheduled scan'}
                      </td>
                      <td className="px-vos-6 py-vos-3 text-vos-text-2">{s.next_run || 'Pending'}</td>
                      <td className="px-vos-6 py-vos-3 text-vos-text-2 capitalize">
                        {s.frequency || s.schedule || 'Weekly'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Recent activity */}
        <Card elevation={2} className="rounded-vos-xl overflow-hidden">
          <div className="flex items-center justify-between px-vos-6 py-vos-5 border-b border-vos-border-1">
            <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
              {t('overview.recentActivity', 'Recent activity')}
            </h2>
            <span className="inline-flex items-center gap-1.5 text-vos-xs text-vos-text-3">
              <span className="size-1.5 rounded-full bg-vos-success" />
              {t('overview.live', 'Live')}
            </span>
          </div>
          <div className="px-vos-4 py-vos-4">
            <ActivityFeed limit={10} compact />
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}

const QUICK_ACTIONS = [
  { to: '/dashboard/scans/new', label: 'New scan', i18n: 'overview.qa.newScan' },
  { to: '/dashboard/reports', label: 'Reports', i18n: 'overview.qa.reports' },
  { to: '/dashboard/targets/new', label: 'Add domain', i18n: 'overview.qa.addDomain' },
  { to: '/dashboard/analytics', label: 'Analytics', i18n: 'overview.qa.analytics' },
  { to: '/dashboard/settings', label: 'Notifications', i18n: 'overview.qa.notifications' },
  { to: '/dashboard/settings', label: 'Team', i18n: 'overview.qa.team' },
];

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'warning';
    case 'failed':
      return 'danger';
    case 'queued':
      return 'info';
    default:
      return 'default';
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
