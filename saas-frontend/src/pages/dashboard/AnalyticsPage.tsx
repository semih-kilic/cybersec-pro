import { useState, useEffect } from 'react';
import api from '../../services/api';

interface AnalyticsData {
  daily_trend: Array<{ date: string; scans: number }>;
  tool_usage: Array<{ name: string; count: number }>;
  status_distribution: Record<string, number>;
  target_distribution: Array<{ target: string; count: number }>;
  comparison: { this_week: number; last_week: number; change_pct: number };
  performance: { avg_duration_seconds: number; total_scans: number; success_rate: number };
  risk: { score: number; level: string; severity_totals: Record<string, number>; total_issues: number };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await api.getAnalyticsOverview();
    if (res.data) setData(res.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-2xl mb-2">📊</p>
        <p>No analytics data available yet. Start scanning to see insights.</p>
      </div>
    );
  }

  const riskColor = data.risk.level === 'Critical' ? 'text-red-500' :
    data.risk.level === 'High' ? 'text-orange-500' :
    data.risk.level === 'Medium' ? 'text-yellow-500' : 'text-green-500';

  const maxScans = Math.max(...data.daily_trend.map(d => d.scans), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📊 Analytics Dashboard</h1>
        <button onClick={loadAnalytics} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm">
          ↻ Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Scans</div>
          <div className="text-2xl font-bold text-white">{data.performance.total_scans}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Success Rate</div>
          <div className="text-2xl font-bold text-green-400">{data.performance.success_rate}%</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Avg Duration</div>
          <div className="text-2xl font-bold text-cyan-400">{data.performance.avg_duration_seconds}s</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Risk Score</div>
          <div className={`text-2xl font-bold ${riskColor}`}>{data.risk.score}</div>
          <div className={`text-xs ${riskColor}`}>{data.risk.level}</div>
        </div>
      </div>

      {/* Weekly Comparison */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">📈 Weekly Comparison</h2>
        <div className="flex items-center gap-8">
          <div>
            <div className="text-gray-400 text-sm">This Week</div>
            <div className="text-3xl font-bold text-white">{data.comparison.this_week}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Last Week</div>
            <div className="text-3xl font-bold text-gray-400">{data.comparison.last_week}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Change</div>
            <div className={`text-3xl font-bold ${data.comparison.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.comparison.change_pct >= 0 ? '+' : ''}{data.comparison.change_pct}%
            </div>
          </div>
        </div>
      </div>

      {/* Scan Trend Chart (Bar chart with CSS) */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">📊 30-Day Scan Trend</h2>
        <div className="flex items-end gap-1 h-32">
          {data.daily_trend.map((d, i) => (
            <div key={i} className="flex-1 group relative">
              <div
                className="bg-cyan-500/80 hover:bg-cyan-400 rounded-t transition-all"
                style={{ height: `${Math.max((d.scans / maxScans) * 100, 2)}%` }}
              />
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs p-1 rounded whitespace-nowrap z-10">
                {d.date}: {d.scans} scans
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{data.daily_trend[0]?.date}</span>
          <span>{data.daily_trend[data.daily_trend.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tool Usage */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">🔧 Top Tools</h2>
          <div className="space-y-3">
            {data.tool_usage.map((t, i) => {
              const maxCount = data.tool_usage[0]?.count || 1;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{t.name}</span>
                    <span className="text-gray-400">{t.count}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                      style={{ width: `${(t.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.tool_usage.length === 0 && (
              <p className="text-gray-500 text-sm">No tool usage data yet</p>
            )}
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">🛡️ Severity Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(data.risk.severity_totals).map(([sev, count]) => {
              const colors: Record<string, string> = {
                critical: 'from-red-600 to-red-500',
                high: 'from-orange-500 to-orange-400',
                medium: 'from-yellow-500 to-yellow-400',
                low: 'from-blue-500 to-blue-400',
                info: 'from-gray-500 to-gray-400',
              };
              return (
                <div key={sev}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{sev}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${colors[sev] || 'from-gray-500 to-gray-400'} rounded-full`}
                      style={{ width: `${Math.max((count / Math.max(data.risk.total_issues, 1)) * 100, count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Total Issues</span>
              <span className="text-white font-bold">{data.risk.total_issues}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Distribution & Targets */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">📋 Scan Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(data.status_distribution).map(([status, count]) => {
              const statusColors: Record<string, string> = {
                completed: 'bg-green-500/20 text-green-400',
                running: 'bg-cyan-500/20 text-cyan-400',
                failed: 'bg-red-500/20 text-red-400',
                pending: 'bg-yellow-500/20 text-yellow-400',
                timeout: 'bg-orange-500/20 text-orange-400',
                cancelled: 'bg-gray-500/20 text-gray-400',
              };
              return (
                <div key={status} className={`${statusColors[status] || 'bg-gray-500/20 text-gray-400'} rounded-lg p-3 text-center`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs capitalize">{status}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">🎯 Top Targets</h2>
          <div className="space-y-2">
            {data.target_distribution.map((t, i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <span className="text-gray-300 text-sm font-mono truncate max-w-[200px]">{t.target}</span>
                <span className="text-gray-400 text-sm ml-2">{t.count} scans</span>
              </div>
            ))}
            {data.target_distribution.length === 0 && (
              <p className="text-gray-500 text-sm">No targets scanned yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
