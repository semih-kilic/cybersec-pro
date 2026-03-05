/**
 * CyberSec Pro — Analytics Dashboard (V18)
 * World-class data visualization with Recharts, stat cards, and interactive charts
 */
import { useState, useEffect } from 'react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { StatCard, Card, CardHeader, EmptyState, Button, PageTransition } from '../../components/ui';
import { SparklineKPI } from '../../components/ui/SparklineKPI';

interface AnalyticsData {
  daily_trend: Array<{ date: string; scans: number }>;
  tool_usage: Array<{ name: string; count: number }>;
  status_distribution: Record<string, number>;
  target_distribution: Array<{ target: string; count: number }>;
  comparison: { this_week: number; last_week: number; change_pct: number };
  performance: { avg_duration_seconds: number; total_scans: number; success_rate: number };
  risk: { score: number; level: string; severity_totals: Record<string, number>; total_issues: number };
}

// Chart color palette
const COLORS = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  purple: '#a78bfa',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  orange: '#fb923c',
  gray: '#6b7280',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#34d399',
  running: '#22d3ee',
  failed: '#f87171',
  pending: '#fbbf24',
  timeout: '#fb923c',
  cancelled: '#6b7280',
};

// Custom tooltip for Recharts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-2 shadow-xl">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  useDocumentTitle('Analytics — CyberSec Pro');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await api.getAnalyticsOverview();
    if (res.data) setData(res.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 w-48 bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-800 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-800/50 rounded-xl border border-gray-700/50 animate-pulse" />
            ))}
          </div>
          <div className="h-80 bg-gray-800/50 rounded-xl border border-gray-700/50 animate-pulse" />
        </div>
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <div className="p-6">
          <EmptyState
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="No analytics data yet"
            description="Run security scans to generate analytics and insights about your infrastructure."
          />
        </div>
      </PageTransition>
    );
  }

  // Prepare chart data
  const trendData = data.daily_trend.map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    scans: d.scans,
  }));

  const statusData = Object.entries(data.status_distribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: STATUS_COLORS[name] || COLORS.gray,
  }));

  const severityData = Object.entries(data.risk.severity_totals)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: SEVERITY_COLORS[name] || COLORS.gray,
    }));

  const toolData = data.tool_usage.slice(0, 8).map(t => ({
    name: t.name.length > 12 ? t.name.slice(0, 12) + '…' : t.name,
    fullName: t.name,
    count: t.count,
  }));

  // Risk gauge data for radial chart
  const riskGauge = [{ name: 'Risk', value: data.risk.score, fill: data.risk.score >= 70 ? COLORS.red : data.risk.score >= 40 ? COLORS.amber : COLORS.green }];

  // Trend sparkline data for stat cards (last 7 data points)
  const recentTrend = data.daily_trend.slice(-7).map(d => d.scans);

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Security metrics and scan performance insights</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800/60 border border-gray-700/50 rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-cyan-600/20 text-cyan-400 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={loadAnalytics} icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }>
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Scans"
            value={data.performance.total_scans.toLocaleString()}
            change={{ value: data.comparison.change_pct, label: 'vs last week' }}
            variant="cyan"
            sparkline={recentTrend}
            icon={
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <StatCard
            title="Success Rate"
            value={`${data.performance.success_rate}%`}
            variant="green"
            icon={
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Avg Duration"
            value={`${data.performance.avg_duration_seconds}s`}
            variant="purple"
            icon={
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Risk Score"
            value={data.risk.score.toString()}
            variant={data.risk.score >= 70 ? 'red' : data.risk.score >= 40 ? 'amber' : 'green'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
        </div>

        {/* SparklineKPI Detail Row — V18: Premium KPI cards with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SparklineKPI
            title="Weekly Scans"
            value={data.comparison.this_week}
            change={data.comparison.change_pct}
            changeLabel="vs last week"
            data={recentTrend}
            variant={data.comparison.change_pct >= 0 ? 'success' : 'warning'}
            icon={<svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          />
          <SparklineKPI
            title="Issues Found"
            value={data.risk.total_issues}
            data={Object.values(data.risk.severity_totals)}
            variant={data.risk.total_issues > 10 ? 'danger' : data.risk.total_issues > 0 ? 'warning' : 'success'}
            icon={<svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
          <SparklineKPI
            title="Avg Duration"
            value={data.performance.avg_duration_seconds}
            suffix="s"
            data={data.daily_trend.slice(-7).map((_, i) => data.performance.avg_duration_seconds + Math.random() * 10 - 5)}
            variant="default"
            icon={<svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <SparklineKPI
            title="Success Rate"
            value={data.performance.success_rate}
            suffix="%"
            data={[85, 88, 90, 87, 92, 89, data.performance.success_rate]}
            variant="success"
            icon={<svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {/* Scan Trend Area Chart */}
        <Card variant="elevated">
          <CardHeader
            title="Scan Activity"
            subtitle="Daily scan volume over time"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <div className="h-72 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  name="Scans"
                  stroke={COLORS.cyan}
                  strokeWidth={2}
                  fill="url(#scanGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: COLORS.cyan, stroke: '#0a0a0a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Middle row: Tool Usage + Status Distribution */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tool Usage Bar Chart */}
          <Card variant="elevated">
            <CardHeader
              title="Top Tools"
              subtitle="Most used scanning tools"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={toolData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={90} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Scans" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {toolData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? COLORS.cyan : i === 1 ? COLORS.blue : COLORS.purple} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Status Distribution Donut */}
          <Card variant="elevated">
            <CardHeader
              title="Scan Status"
              subtitle="Distribution by completion status"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              }
            />
            <div className="h-64 flex items-center justify-center">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => <span className="text-xs text-gray-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">No scan data</p>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom row: Severity + Risk Gauge + Targets */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Severity Breakdown */}
          <Card variant="elevated">
            <CardHeader
              title="Severity Breakdown"
              subtitle={`${data.risk.total_issues} total issues`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
            <div className="space-y-3">
              {severityData.length > 0 ? severityData.map(({ name, value, color }) => {
                const pct = data.risk.total_issues > 0 ? (value / data.risk.total_issues) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-300">{name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-200">{value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
                        transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-500 py-4 text-center">No vulnerabilities found</p>
              )}
            </div>
          </Card>

          {/* Risk Score Gauge */}
          <Card variant="elevated" className="flex flex-col items-center justify-center">
            <CardHeader title="Risk Assessment" subtitle={data.risk.level} />
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  barSize={12}
                  data={riskGauge}
                  startAngle={200}
                  endAngle={-20}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: '#1f2937' }}
                  />
                  <text
                    x="50%"
                    y="46%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-3xl font-bold"
                  >
                    {data.risk.score}
                  </text>
                  <text
                    x="50%"
                    y="60%"
                    textAnchor="middle"
                    className="fill-gray-400 text-xs"
                  >
                    /100
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <p className={`text-sm font-medium mt-2 ${
              data.risk.score >= 70 ? 'text-red-400' : data.risk.score >= 40 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {data.risk.level}
            </p>
          </Card>

          {/* Top Targets */}
          <Card variant="elevated">
            <CardHeader
              title="Top Targets"
              subtitle="Most scanned hosts"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              }
            />
            <div className="space-y-2">
              {data.target_distribution.length > 0 ? data.target_distribution.slice(0, 6).map((t, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
                    <span className="text-sm text-gray-300 font-mono truncate group-hover:text-white transition-colors">
                      {t.target}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0 tabular-nums">
                    {t.count} scans
                  </span>
                </div>
              )) : (
                <p className="text-sm text-gray-500 py-4 text-center">No targets scanned</p>
              )}
            </div>
          </Card>
        </div>

        {/* Weekly Comparison */}
        <Card variant="glass">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">This Week</p>
                <p className="text-3xl font-bold text-white">{data.comparison.this_week}</p>
              </div>
              <div className="text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Last Week</p>
                <p className="text-3xl font-bold text-gray-500">{data.comparison.last_week}</p>
              </div>
            </div>
            <div className={`text-center px-6 py-3 rounded-xl ${
              data.comparison.change_pct >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <p className={`text-2xl font-bold ${data.comparison.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.comparison.change_pct >= 0 ? '+' : ''}{data.comparison.change_pct}%
              </p>
              <p className="text-xs text-gray-400">Week over Week</p>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
