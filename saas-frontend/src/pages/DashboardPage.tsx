import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardTools, useDashboardScans } from '../hooks/useApiQueries';
import CyberPulseBg from '../components/ui/CyberPulseBg';

interface _Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  plan_required: string;
}

interface _Scan {
  id: string;
  tool: { name: string };
  target: string;
  status: string;
  created_at: string;
}

export function DashboardPage() {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const { data: toolsData, isLoading: toolsLoading } = useDashboardTools();
  const { data: scansData, isLoading: scansLoading } = useDashboardScans();
  const tools = toolsData?.tools || {};
  const totalTools = toolsData?.total_tools || 0;
  const scans = scansData || [];
  const loading = toolsLoading || scansLoading;
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'scans'>('overview');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'starter': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'professional': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'enterprise': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-cyan-400 animate-pulse';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <CyberPulseBg />
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">CyberSec Pro</h1>
                <p className="text-sm text-gray-400">{organization?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPlanBadgeColor(organization?.plan_type || '')}`}>
                {organization?.plan_type?.toUpperCase()} PLAN
              </span>
              <div className="text-right">
                <p className="text-sm text-white">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {(['overview', 'tools', 'scans'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-3xl font-bold text-white">{totalTools}</div>
                <div className="text-gray-400 mt-1">Available Tools</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-3xl font-bold text-white">{scans.length}</div>
                <div className="text-gray-400 mt-1">Total Scans</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-3xl font-bold text-white">{Object.keys(tools).length}</div>
                <div className="text-gray-400 mt-1">Categories</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-3xl font-bold text-cyan-400">{organization?.plan_type}</div>
                <div className="text-gray-400 mt-1">Current Plan</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveTab('tools')}
                  className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition text-left"
                >
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="text-white font-medium">Browse Tools</div>
                  <div className="text-sm text-gray-400">View all {totalTools} tools</div>
                </button>
                <button 
                  onClick={() => setActiveTab('scans')}
                  className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition text-left"
                >
                  <div className="text-2xl mb-2">📊</div>
                  <div className="text-white font-medium">View Scans</div>
                  <div className="text-sm text-gray-400">See scan history</div>
                </button>
                <a 
                  href="/dashboard/upgrade"
                  className="p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg hover:from-cyan-500/30 hover:to-blue-500/30 transition text-left border border-cyan-500/30"
                >
                  <div className="text-2xl mb-2">⬆️</div>
                  <div className="text-white font-medium">Upgrade Plan</div>
                  <div className="text-sm text-gray-400">Get more tools</div>
                </a>
                <a 
                  href="https://docs.semihkilic.com" 
                  target="_blank"
                  className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition text-left"
                >
                  <div className="text-2xl mb-2">📚</div>
                  <div className="text-white font-medium">Documentation</div>
                  <div className="text-sm text-gray-400">Learn more</div>
                </a>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Scans</h3>
              {scans.length === 0 ? (
                <p className="text-gray-400">No scans yet. Run your first scan to see results here.</p>
              ) : (
                <div className="space-y-3">
                  {scans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                      <div>
                        <span className="text-white font-medium">{scan.tool?.name}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-gray-300">{scan.target}</span>
                      </div>
                      <span className={`text-sm ${getStatusColor(scan.status)}`}>
                        {scan.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Security Tools</h2>
              <span className="text-gray-400">{totalTools} tools available</span>
            </div>
            
            {Object.entries(tools).map(([category, categoryTools]) => (
              <div key={category} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                  {category}
                  <span className="text-sm text-gray-400 font-normal">({categoryTools.length} tools)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryTools.map((tool) => (
                    <div key={tool.id} className="p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium">{tool.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${getPlanBadgeColor(tool.plan_required)}`}>
                          {tool.plan_required}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'scans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Scan History</h2>
              <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition">
                + New Scan
              </button>
            </div>
            
            {scans.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 border border-gray-700 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-white mb-2">No scans yet</h3>
                <p className="text-gray-400 mb-6">Run your first security scan to get started</p>
                <button 
                  onClick={() => setActiveTab('tools')}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition"
                >
                  Browse Tools
                </button>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="text-left p-4 text-gray-300 font-medium">Tool</th>
                      <th className="text-left p-4 text-gray-300 font-medium">Target</th>
                      <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                      <th className="text-left p-4 text-gray-300 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                        <td className="p-4 text-white">{scan.tool?.name}</td>
                        <td className="p-4 text-gray-300">{scan.target}</td>
                        <td className={`p-4 ${getStatusColor(scan.status)}`}>{scan.status}</td>
                        <td className="p-4 text-gray-400">{new Date(scan.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
