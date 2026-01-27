import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { OnboardingModal, QuickStartCards } from '../../components/onboarding';

// Plan configurations - synced with backend tool_registry
const PLAN_CONFIG: Record<string, { tools: number; scansPerDay: number; features: string[] }> = {
  trial: { tools: 19, scansPerDay: 3, features: ['19 Basic tools', '3 scans/day', '7 day trial'] },
  starter: { tools: 19, scansPerDay: 10, features: ['19 Essential tools', '10 scans/day', '1 project'] },
  professional: { tools: 101, scansPerDay: 50, features: ['101 tools', '50 scans/day', 'Multi-tool scan (3)'] },
  team: { tools: 126, scansPerDay: 100, features: ['126 tools', '100 scans/day', 'Remote agent'] },
  enterprise: { tools: 131, scansPerDay: -1, features: ['131+ tools', 'Unlimited scans', 'SSO/SAML'] },
};

interface ScanSummary {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface RecentScan {
  id: string;
  tool_name: string;
  target: string;
  status: 'running' | 'completed' | 'failed' | 'queued';
  started_at: string;
  duration?: number;
  findings?: number;
}

interface ScheduledScan {
  id: string;
  name: string;
  tool: string;
  target: string;
  next_run: string;
  frequency: string;
}

export function OverviewPage() {
  const { token, organization, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scanSummary, setScanSummary] = useState<ScanSummary>({ total: 0, running: 0, completed: 0, failed: 0 });
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilitySummary>({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [_scheduledScans, _setScheduledScans] = useState<ScheduledScan[]>([]);
  const [totalTools, setTotalTools] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(organization?.plan_type || 'starter');
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin';

  const handlePlanChange = async (plan: string) => {
    setChangingPlan(true);
    try {
      const res = await fetch('/api/v1/admin/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: plan }),
      });
      if (res.ok) {
        setSelectedPlan(plan);
        alert(`Plan changed to ${plan.toUpperCase()}! Refresh the page to see changes.`);
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change plan');
      }
    } catch (error) {
      console.error('Failed to change plan:', error);
      alert('Failed to change plan');
    } finally {
      setChangingPlan(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Check if user needs onboarding
  useEffect(() => {
    if (!onboardingChecked && user && organization) {
      const onboardingKey = `onboarding_completed_${user.id}`;
      const isOnboardingCompleted = localStorage.getItem(onboardingKey) === 'true';
      
      if (!isOnboardingCompleted) {
        setShowOnboarding(true);
      }
      setOnboardingChecked(true);
    }
  }, [user, organization, onboardingChecked]);

  const handleOnboardingComplete = () => {
    if (user) {
      const onboardingKey = `onboarding_completed_${user.id}`;
      localStorage.setItem(onboardingKey, 'true');
    }
    setShowOnboarding(false);
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch tools count
      const toolsRes = await fetch('/api/v1/tools', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTotalTools(data.total_tools || 0);
      }

      // Fetch scans
      const scansRes = await fetch('/api/v1/scans', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (scansRes.ok) {
        const data = await scansRes.json();
        const scans = data.scans || [];
        
        setScanSummary({
          total: scans.length,
          running: scans.filter((s: any) => s.status === 'running').length,
          completed: scans.filter((s: any) => s.status === 'completed').length,
          failed: scans.filter((s: any) => s.status === 'failed').length,
        });

        // Map recent scans
        setRecentScans(scans.slice(0, 5).map((s: any) => ({
          id: s.id,
          tool_name: s.tool?.name || 'Unknown',
          target: s.target,
          status: s.status,
          started_at: s.created_at,
          findings: s.findings_count || 0,
        })));
      }

      // Fetch usage stats for real data
      const usageRes = await fetch('/api/v1/usage/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        // Set targets count from usage data or default to scan count
        setTotalTargets(usageData.usage?.total_scans || recentScans.length);
      }

      // Initialize vulnerabilities to 0 - will be populated from real scan results
      setVulnerabilities({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-yellow-400 bg-yellow-400/10';
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      case 'queued': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const totalVulnerabilities = vulnerabilities.critical + vulnerabilities.high + vulnerabilities.medium + vulnerabilities.low;
  const riskScore = Math.min(100, vulnerabilities.critical * 25 + vulnerabilities.high * 10 + vulnerabilities.medium * 3 + vulnerabilities.low);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const currentPlanConfig = PLAN_CONFIG[organization?.plan_type || 'trial'] || PLAN_CONFIG.trial;
  const hasRunFirstScan = scanSummary.total > 0;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        userName={user?.first_name || 'User'}
        planType={organization?.plan_type || 'trial'}
        toolsCount={totalTools || currentPlanConfig.tools}
        scansPerDay={currentPlanConfig.scansPerDay}
        trialDaysLeft={organization?.plan_type === 'trial' ? 7 : undefined}
      />

      <Header 
        title={`Welcome back, ${user?.first_name || 'User'}`}
        subtitle={`${organization?.name || 'Your Organization'} • ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        actions={
          <Link 
            to="/dashboard/scans/new" 
            className="flex items-center gap-2 px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Scan
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Quick Start Cards - Show for new/trial users or those with few scans */}
        {(scanSummary.total < 5 || organization?.plan_type === 'trial') && (
          <QuickStartCards
            planType={organization?.plan_type || 'trial'}
            toolsCount={totalTools || currentPlanConfig.tools}
            scansToday={scanSummary.running + scanSummary.completed}
            scansLimit={currentPlanConfig.scansPerDay}
            hasRunFirstScan={hasRunFirstScan}
          />
        )}

        {/* Super Admin Panel */}
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold">🔐 Super Admin Mode</h3>
                  <p className="text-purple-300 text-sm">Full access to all features • Current Plan: <span className="font-bold uppercase">{organization?.plan_type}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition"
              >
                {showAdminPanel ? 'Hide Admin Panel' : 'Open Admin Panel'}
              </button>
            </div>
            
            {showAdminPanel && (
              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <h4 className="text-white font-semibold mb-3">⚡ Change Plan (Testing)</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { id: 'trial', name: 'Trial', tools: '19 tools', scans: '3/day', features: 'Basic', color: 'gray' },
                    { id: 'starter', name: 'Starter', tools: '19 tools', scans: '10/day', features: '1 project', color: 'green' },
                    { id: 'professional', name: 'Professional', tools: '101 tools', scans: '50/day', features: 'Multi-tool (3)', color: 'blue' },
                    { id: 'team', name: 'Team', tools: '126 tools', scans: '100/day', features: 'Agent + Multi (5)', color: 'purple' },
                    { id: 'enterprise', name: 'Enterprise', tools: '131+ tools', scans: 'Unlimited', features: '∞ Agents + SSO', color: 'yellow' },
                  ].map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handlePlanChange(plan.id)}
                      disabled={changingPlan || selectedPlan === plan.id}
                      className={`p-4 rounded-lg border-2 transition ${
                        selectedPlan === plan.id
                          ? `border-${plan.color}-500 bg-${plan.color}-500/20`
                          : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                      } ${changingPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-left">
                        <div className={`font-bold ${selectedPlan === plan.id ? `text-${plan.color}-400` : 'text-white'}`}>
                          {plan.name}
                          {selectedPlan === plan.id && <span className="ml-2 text-xs">✓ Active</span>}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">{plan.tools}</div>
                        <div className="text-sm text-gray-400">{plan.scans}</div>
                        <div className="text-xs text-gray-500 mt-1">{plan.features}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-purple-300/60 text-xs mt-3">
                  * This panel is only visible to superadmin users. Changes take effect immediately.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Tools */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Available Tools</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {organization?.plan_type === 'enterprise' ? '350+' : 
                   organization?.plan_type === 'team' ? totalTools :
                   organization?.plan_type === 'professional' ? Math.min(totalTools, 120) :
                   organization?.plan_type === 'starter' ? Math.min(totalTools, 33) : 
                   Math.min(totalTools, 7)}
                </p>
                {organization?.plan_type === 'enterprise' && (
                  <p className="text-xs text-green-400 mt-1">Full Access • All Categories</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-kali-blue/10 flex items-center justify-center group-hover:scale-110 transition">
                <svg className="w-6 h-6 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </div>
            </div>
            <Link to="/dashboard/tools" className="text-sm text-kali-blue hover:underline mt-3 inline-flex items-center gap-1">
              Browse tools
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Total Scans */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Scans</p>
                <p className="text-3xl font-bold text-white mt-1">{scanSummary.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-green-400">{scanSummary.completed} completed</span>
              {scanSummary.running > 0 && (
                <span className="text-yellow-400 animate-pulse">{scanSummary.running} running</span>
              )}
            </div>
          </div>

          {/* Active Targets */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Targets</p>
                <p className="text-3xl font-bold text-white mt-1">{totalTargets}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </div>
            <Link to="/dashboard/targets" className="text-sm text-kali-blue hover:underline mt-3 inline-flex items-center gap-1">
              Manage targets
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Risk Score */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Risk Score</p>
                <p className={`text-3xl font-bold mt-1 ${riskScore > 70 ? 'text-red-400' : riskScore > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {riskScore}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition ${riskScore > 70 ? 'bg-red-500/10' : riskScore > 40 ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                <svg className={`w-6 h-6 ${riskScore > 70 ? 'text-red-400' : riskScore > 40 ? 'text-yellow-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-3">
              <div 
                className={`h-1.5 rounded-full transition-all ${riskScore > 70 ? 'bg-red-500' : riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${riskScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vulnerability Overview */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Vulnerability Overview</h2>
              <Link to="/dashboard/reports" className="text-sm text-kali-blue hover:underline">View all</Link>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-red-400">{vulnerabilities.critical}</span>
                  </div>
                  <p className="text-sm text-gray-400">Critical</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-orange-400">{vulnerabilities.high}</span>
                  </div>
                  <p className="text-sm text-gray-400">High</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-yellow-400">{vulnerabilities.medium}</span>
                  </div>
                  <p className="text-sm text-gray-400">Medium</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-blue-400">{vulnerabilities.low}</span>
                  </div>
                  <p className="text-sm text-gray-400">Low</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-500/20 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-gray-400">{vulnerabilities.info}</span>
                  </div>
                  <p className="text-sm text-gray-400">Info</p>
                </div>
              </div>
              
              {/* Severity Bar */}
              <div className="h-4 rounded-full overflow-hidden flex">
                {vulnerabilities.critical > 0 && (
                  <div className="bg-red-500 h-full" style={{ width: `${(vulnerabilities.critical / totalVulnerabilities) * 100}%` }} />
                )}
                {vulnerabilities.high > 0 && (
                  <div className="bg-orange-500 h-full" style={{ width: `${(vulnerabilities.high / totalVulnerabilities) * 100}%` }} />
                )}
                {vulnerabilities.medium > 0 && (
                  <div className="bg-yellow-500 h-full" style={{ width: `${(vulnerabilities.medium / totalVulnerabilities) * 100}%` }} />
                )}
                {vulnerabilities.low > 0 && (
                  <div className="bg-blue-500 h-full" style={{ width: `${(vulnerabilities.low / totalVulnerabilities) * 100}%` }} />
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <Link 
                to="/dashboard/scans/new" 
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-kali-blue/20 flex items-center justify-center group-hover:bg-kali-blue/30 transition">
                  <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">New Scan</p>
                  <p className="text-xs text-gray-400">Start a security scan</p>
                </div>
              </Link>

              <Link 
                to="/dashboard/targets/new" 
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Add Target</p>
                  <p className="text-xs text-gray-400">Add IP, domain or subnet</p>
                </div>
              </Link>

              <Link 
                to="/dashboard/schedule" 
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Schedule Scan</p>
                  <p className="text-xs text-gray-400">Automate recurring scans</p>
                </div>
              </Link>

              <Link 
                to="/dashboard/terminal" 
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Web Terminal</p>
                  <p className="text-xs text-gray-400">Direct Kali access</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Scans</h2>
            <Link to="/dashboard/scans" className="text-sm text-kali-blue hover:underline">View all scans</Link>
          </div>
          
          {recentScans.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No scans yet</h3>
              <p className="text-gray-400 mb-4">Start your first security scan to see results here.</p>
              <Link 
                to="/dashboard/scans/new" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Start First Scan
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-5 py-3 font-medium">Tool</th>
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Started</th>
                    <th className="px-5 py-3 font-medium">Findings</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-kali-blue/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            </svg>
                          </div>
                          <span className="text-white font-medium">{scan.tool_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded">{scan.target}</code>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                          {scan.status === 'running' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          )}
                          {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {new Date(scan.started_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-white">{scan.findings || 0}</span>
                      </td>
                      <td className="px-5 py-4">
                        <Link 
                          to={`/dashboard/scans/${scan.id}`}
                          className="text-kali-blue hover:underline text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverviewPage;
