import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useAuth } from '../../hooks/useAuth';

interface Framework {
  id: string;
  name: string;
  short_name: string;
  version: string | null;
}

interface FrameworkSummary extends Framework {
  total_controls: number;
  mapped_tools: number;
}

interface PostureEntry {
  framework: Framework;
  posture: {
    total_controls: number;
    passed: number;
    failed: number;
    partial: number;
    untested: number;
    score_pct: number | null;
  };
}

interface DashboardData {
  frameworks: FrameworkSummary[];
  posture: PostureEntry[];
  stats: { total_frameworks: number; recent_scans: number; total_scans: number };
}

interface ControlItem {
  control_id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string | null;
  mapped_tools: Array<{ tool_id: string; tool_name: string; coverage_type: string | null }>;
  recent_scans: number;
}

interface GapItem {
  control_id: string;
  title: string;
  category: string;
  severity: string | null;
  reason: string;
}

interface GapAnalysis {
  framework_id: string;
  total_controls: number;
  covered: number;
  gaps: number;
  gap_items: GapItem[];
  covered_items: Array<{ control_id: string; title: string; category: string }>;
}

interface AssessmentResult {
  framework_id: string;
  total_controls: number;
  passed: number;
  failed: number;
  partial: number;
  untested: number;
  score_pct: number;
  controls: Array<{
    control_id: string;
    title: string;
    status: string;
    mapped_tools: string[];
    category: string | null;
  }>;
}

function scoreColor(pct: number | null | undefined): string {
  const v = pct ?? 0;
  if (v >= 80) return 'text-green-400';
  if (v >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(pct: number | null | undefined): string {
  const v = pct ?? 0;
  if (v >= 80) return 'from-green-500/20 to-green-600/20 border-green-500/30';
  if (v >= 50) return 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30';
  return 'from-red-500/20 to-red-600/20 border-red-500/30';
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    passed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    untested: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return styles[status] || styles.untested;
}

function severityColor(s: string | null) {
  if (s === 'critical' || s === 'high') return 'text-red-400';
  if (s === 'medium') return 'text-yellow-400';
  if (s === 'low') return 'text-blue-400';
  return 'text-gray-400';
}

export default function ComplianceDashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('compliance.title', 'Compliance Dashboard')} — CyberSec Pro`);
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/compliance/dashboard', { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const loadFrameworkDetail = async (fwId: string) => {
    setSelectedId(fwId);
    setControls([]);
    setGapAnalysis(null);
    setAssessment(null);
    setControlsLoading(true);
    setGapLoading(true);
    try {
      const [ctrlRes, gapRes] = await Promise.all([
        fetch(`/api/v1/compliance/frameworks/${fwId}`, { headers: authHeaders }),
        fetch(`/api/v1/compliance/frameworks/${fwId}/gap-analysis`, { headers: authHeaders }),
      ]);
      if (ctrlRes.ok) {
        const cd = await ctrlRes.json();
        setControls(cd.controls || []);
      }
      if (gapRes.ok) {
        const gd = await gapRes.json();
        setGapAnalysis(gd);
      }
    } catch {
      // silently fail
    } finally {
      setControlsLoading(false);
      setGapLoading(false);
    }
  };

  const runAssessment = async (fwId: string) => {
    setAssessing(true);
    try {
      const res = await fetch(`/api/v1/compliance/frameworks/${fwId}/assess`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        const result = await res.json();
        setAssessment(result);
        loadDashboard();
      }
    } catch {
      // silently fail
    } finally {
      setAssessing(false);
    }
  };

  const postureMap = new Map<string, PostureEntry>();
  data?.posture.forEach(p => postureMap.set(p.framework.id, p));

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('compliance.dashboardTitle', 'Compliance Dashboard')}</h1>
            <p className="text-gray-400 text-sm">{t('compliance.dashboardSubtitle', 'Assess your security posture against industry frameworks')}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-sm text-red-300">{error}</div>
        )}
        {loading && !data && (
          <div className="text-center py-12 text-gray-500 text-sm">{t('common.loading', 'Loading...')}</div>
        )}

        {data && !selectedId && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label={t('compliance.frameworks', 'Frameworks')} value={data.stats.total_frameworks.toString()} />
              <StatCard label={t('compliance.recentScans', 'Scans (30d)')} value={data.stats.recent_scans.toLocaleString()} />
              <StatCard label={t('compliance.totalScans', 'Total Scans')} value={data.stats.total_scans.toLocaleString()} />
              <StatCard
                label={t('compliance.avgScore', 'Avg Score')}
                value={(() => {
                  const scored = data.posture.filter(p => p.posture.score_pct !== null);
                  if (scored.length === 0) return '\u2014';
                  const avg = scored.reduce((s, p) => s + (p.posture.score_pct || 0), 0) / scored.length;
                  return `${avg.toFixed(0)}%`;
                })()}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.frameworks.map(fw => {
                const posture = postureMap.get(fw.id);
                const score = posture?.posture.score_pct;
                return (
                  <button
                    key={fw.id}
                    onClick={() => loadFrameworkDetail(fw.id)}
                    className={`text-left bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-all group ${score !== null ? `bg-gradient-to-br ${scoreBg(score!)}` : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white font-semibold group-hover:text-cyan-300 transition-colors">{fw.name}</h4>
                        <p className="text-gray-500 text-xs">{fw.short_name} &middot; v{fw.version || '\u2014'}</p>
                      </div>
                      {score !== null ? (
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${scoreColor(score!)}`}>{(score ?? 0).toFixed(0)}%</div>
                          <div className="text-[11px] text-gray-500">score</div>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-800 border border-gray-700 text-gray-400">
                          Not assessed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span>{fw.total_controls} controls</span>
                      <span>{fw.mapped_tools} tools mapped</span>
                    </div>

                    {posture && (
                      <div className="flex gap-1.5">
                        <MiniBar count={posture.posture.passed} total={posture.posture.total_controls} color="bg-green-500" />
                        <MiniBar count={posture.posture.partial} total={posture.posture.total_controls} color="bg-yellow-500" />
                        <MiniBar count={posture.posture.failed} total={posture.posture.total_controls} color="bg-red-500" />
                        <MiniBar count={posture.posture.untested} total={posture.posture.total_controls} color="bg-gray-600" />
                      </div>
                    )}
                    {!posture && (
                      <div className="text-[11px] text-gray-600">Click to run assessment</div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {selectedId && (
          <FrameworkDetail
            frameworkId={selectedId}
            frameworks={data?.frameworks || []}
            controls={controls}
            controlsLoading={controlsLoading}
            gapAnalysis={gapAnalysis}
            gapLoading={gapLoading}
            assessment={assessment}
            assessing={assessing}
            onBack={() => { setSelectedId(null); setAssessment(null); }}
            onAssess={runAssessment}
            onRefreshControls={() => loadFrameworkDetail(selectedId)}
            t={t}
          />
        )}
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function MiniBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1" title={`${count}`}>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FrameworkDetail({
  frameworkId, frameworks, controls, controlsLoading, gapAnalysis, gapLoading,
  assessment, assessing, onBack, onAssess, onRefreshControls, t,
}: {
  frameworkId: string;
  frameworks: FrameworkSummary[];
  controls: ControlItem[];
  controlsLoading: boolean;
  gapAnalysis: GapAnalysis | null;
  gapLoading: boolean;
  assessment: AssessmentResult | null;
  assessing: boolean;
  onBack: () => void;
  onAssess: (id: string) => void;
  onRefreshControls: () => void;
  t: (key: string, fallback: string) => string;
}) {
  const fw = frameworks.find(f => f.id === frameworkId);
  const displayControls = assessment?.controls || controls.map(c => ({
    control_id: c.control_id,
    title: c.title,
    status: 'untested' as const,
    mapped_tools: c.mapped_tools.map(mt => mt.tool_name),
    category: c.category,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back', 'Back')}
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{fw?.name || frameworkId}</h2>
          <p className="text-gray-500 text-sm">{fw?.short_name} &middot; {fw?.total_controls} controls &middot; {fw?.mapped_tools} tools mapped</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onAssess(frameworkId)}
            disabled={assessing}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {assessing ? t('common.loading', 'Loading...') : t('compliance.runAssessment', 'Run Assessment')}
          </button>
          <button
            onClick={onRefreshControls}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition"
          >
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {assessment && (
        <div className={`bg-gradient-to-br ${scoreBg(assessment.score_pct)} border rounded-xl p-5 mb-6`}>
          <div className="flex items-center gap-6">
            <div>
              <div className={`text-4xl font-bold ${scoreColor(assessment.score_pct)}`}>{(assessment.score_pct ?? 0).toFixed(0)}%</div>
              <div className="text-sm text-gray-300 mt-1">{t('compliance.complianceScore', 'Compliance Score')}</div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-3">
              <ScoreTile label={t('compliance.passed', 'Passed')} count={assessment.passed} total={assessment.total_controls} color="text-green-400" />
              <ScoreTile label={t('compliance.partial', 'Partial')} count={assessment.partial} total={assessment.total_controls} color="text-yellow-400" />
              <ScoreTile label={t('compliance.failed', 'Failed')} count={assessment.failed} total={assessment.total_controls} color="text-red-400" />
              <ScoreTile label={t('compliance.untested', 'Untested')} count={assessment.untested} total={assessment.total_controls} color="text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {gapLoading && (
        <div className="text-center py-6 text-gray-500 text-sm">{t('compliance.loadingGap', 'Loading gap analysis...')}</div>
      )}
      {gapAnalysis && !gapLoading && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-3">
            {t('compliance.gapAnalysis', 'Gap Analysis')}
          </h3>
          <div className="flex items-center gap-6 mb-4">
            <div className="text-sm text-gray-400">
              <span className="text-green-400 font-semibold">{gapAnalysis.covered}</span> {t('compliance.controlsCovered', 'controls covered')}
            </div>
            <div className="text-sm text-gray-400">
              <span className="text-red-400 font-semibold">{gapAnalysis.gaps}</span> {t('compliance.gapsFound', 'gaps found')}
            </div>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${gapAnalysis.total_controls > 0 ? (gapAnalysis.covered / gapAnalysis.total_controls) * 100 : 0}%` }}
              />
            </div>
          </div>
          {gapAnalysis.gap_items.length > 0 && (
            <div className="space-y-2">
              {gapAnalysis.gap_items.map(g => (
                <div key={g.control_id} className="flex items-center justify-between bg-gray-950/40 rounded-lg p-3 border border-gray-800/50">
                  <div>
                    <span className="text-white text-sm font-mono mr-2">{g.control_id}</span>
                    <span className="text-gray-300 text-sm">{g.title}</span>
                    <span className="text-gray-600 text-xs ml-2">({g.category})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${severityColor(g.severity)}`}>{g.severity || '\u2014'}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/20">
                      {g.reason === 'no_tool_mapping' ? 'No tool' : g.reason === 'not_scanned' ? 'Not scanned' : 'No scans'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
            {t('compliance.controls', 'Controls')} ({displayControls.length})
          </h3>
        </div>
        {controlsLoading ? (
          <div className="text-center py-8 text-gray-500 text-sm">{t('common.loading', 'Loading...')}</div>
        ) : displayControls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">{t('compliance.noControls', 'No controls found')}</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {displayControls.map(ctrl => (
              <div key={ctrl.control_id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-800/30 transition-colors">
                <div className="w-20 font-mono text-xs text-gray-500 shrink-0">{ctrl.control_id}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{ctrl.title}</div>
                  <div className="text-xs text-gray-500">{ctrl.category || '\u2014'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ctrl.mapped_tools.length > 0 && (
                    <div className="flex gap-1">
                      {ctrl.mapped_tools.slice(0, 3).map((tool, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] rounded border border-cyan-500/20">
                          {tool}
                        </span>
                      ))}
                      {ctrl.mapped_tools.length > 3 && (
                        <span className="text-[10px] text-gray-500">+{ctrl.mapped_tools.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${statusBadge(ctrl.status)}`}>
                  {ctrl.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreTile({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  return (
    <div className="bg-gray-950/40 rounded-lg p-3 border border-gray-800/50">
      <div className={`text-xl font-bold ${color}`}>{count}</div>
      <div className="text-[11px] text-gray-500">{label} ({pct}%)</div>
    </div>
  );
}
