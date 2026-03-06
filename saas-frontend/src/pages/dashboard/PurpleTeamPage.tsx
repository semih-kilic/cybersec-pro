import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

// ═══════════════════════════════════════════════════════════
// API Helper (matches existing api.ts pattern)
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api/v1';

async function ptFetch<T>(endpoint: string, opts: RequestInit = {}): Promise<T | null> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════

interface AttackChain {
  id: string;
  name: string;
  description: string;
  severity: string;
  steps_count: number;
  mitre_tactics: string[];
  tools_used: string[];
}

interface Playbook {
  id: string;
  name: string;
  trigger: string;
  severity: string;
  mitre_techniques: string[];
  response_actions_count: number;
  auto_actions: number;
  detection_logic: Record<string, unknown>;
}

interface Exercise {
  id: string;
  name: string;
  attack_chain_id: string;
  target: string;
  status: string;
  started_at: string;
  completed_at: string;
  total_steps: number;
  completed_steps: number;
  detected_attacks: number;
  missed_attacks: number;
  risk_score: number;
  red_team_results: StepResult[];
  blue_team_alerts: BlueAlert[];
  gap_analysis: GapAnalysis;
  coverage_map: Record<string, TacticCoverage>;
}

interface StepResult {
  step_index: number;
  phase: string;
  technique_id: string;
  technique_name: string;
  tool: string;
  command: string;
  status: string;
  output: string;
  findings: Finding[];
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  detected_by_blue: boolean;
}

interface Finding {
  type: string;
  severity: string;
  detail?: string;
  port?: number;
  service?: string;
  host?: string;
}

interface BlueAlert {
  id: string;
  timestamp: string;
  playbook_name: string;
  severity: string;
  trigger_details: Record<string, unknown>;
  response_actions_taken: ActionRecord[];
  response_actions_pending: ActionRecord[];
}

interface ActionRecord {
  action: string;
  description: string;
  status: string;
  result?: string;
}

interface GapAnalysis {
  total_attacks: number;
  detected: number;
  missed: number;
  detection_rate: number;
  missed_techniques: { technique_id: string; technique_name: string; tool: string; phase: string }[];
  recommendations: { priority: string; area: string; description: string; mitre_reference: string }[];
}

interface TacticCoverage {
  name: string;
  total_techniques: number;
  tested: number;
  detected: number;
  missed: number;
  techniques: Record<string, { name: string; status: string; subtechniques_count: number }>;
}

interface DashboardStats {
  total_exercises: number;
  running: number;
  completed: number;
  total_attack_steps: number;
  total_detected: number;
  total_missed: number;
  detection_rate: number;
  average_risk_score: number;
  available_chains: number;
  available_playbooks: number;
}

interface MitreTactic {
  name: string;
  techniques: { id: string; name: string; subtechniques_count: number }[];
  total: number;
}

// ═══════════════════════════════════════════════════════════
// Utility Components
// ═══════════════════════════════════════════════════════════

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[severity] || colors.info}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-cyan-500/20 text-cyan-400 animate-pulse',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    pending: 'bg-gray-500/20 text-gray-400',
    cancelled: 'bg-yellow-500/20 text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded ${colors[status] || colors.pending}`}>
      {status.toUpperCase()}
    </span>
  );
}

function StatCard({ label, value, icon, color = 'cyan' }: { label: string; value: string | number; icon: string; color?: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
    red: 'from-red-500/10 to-red-600/5 border-red-500/20',
    green: 'from-green-500/10 to-green-600/5 border-green-500/20',
    yellow: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.cyan} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MITRE ATT&CK Heat Map Component
// ═══════════════════════════════════════════════════════════

function MitreHeatMap({ coverage, matrix }: { coverage: Record<string, TacticCoverage>; matrix: Record<string, MitreTactic> }) {
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);

  // Ordered tactics for visual layout
  const tacticOrder = [
    'TA0043', 'TA0042', 'TA0001', 'TA0002', 'TA0003', 'TA0004',
    'TA0005', 'TA0006', 'TA0007', 'TA0008', 'TA0009', 'TA0011',
    'TA0010', 'TA0040',
  ];

  const getCellColor = (status: string) => {
    switch (status) {
      case 'detected': return 'bg-green-500/70 hover:bg-green-500/90';
      case 'missed': return 'bg-red-500/70 hover:bg-red-500/90';
      case 'not_tested': return 'bg-gray-700/40 hover:bg-gray-600/60';
      default: return 'bg-gray-800/40';
    }
  };

  const selectedCoverage = selectedTactic ? coverage[selectedTactic] : null;

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🗺️</span>
        <h3 className="text-lg font-bold text-white">MITRE ATT&CK Coverage Matrix</h3>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/70 inline-block" /> Detected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/70 inline-block" /> Missed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700/40 inline-block border border-gray-600" /> Not Tested</span>
        </div>
      </div>

      {/* Tactic columns */}
      <div className="grid grid-cols-14 gap-1 mb-4" style={{ gridTemplateColumns: `repeat(${tacticOrder.length}, minmax(0, 1fr))` }}>
        {tacticOrder.map(tid => {
          const tactic = matrix[tid] || coverage[tid];
          const cov = coverage[tid];
          if (!tactic) return null;
          const detected = cov?.detected || 0;
          const missed = cov?.missed || 0;
          const total = tactic.total || cov?.total_techniques || 0;
          const tested = cov?.tested || 0;
          return (
            <div
              key={tid}
              className={`cursor-pointer rounded-lg p-2 border transition-all ${
                selectedTactic === tid
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
              }`}
              onClick={() => setSelectedTactic(selectedTactic === tid ? null : tid)}
            >
              <div className="text-[10px] font-bold text-gray-300 mb-1 truncate" title={tactic.name}>
                {(tactic.name as string).split(' ').slice(0, 2).join(' ')}
              </div>
              <div className="text-[9px] text-gray-500 mb-1">{tid}</div>
              {/* Mini grid */}
              <div className="flex flex-wrap gap-[2px]">
                {(tactic.techniques || Object.entries(cov?.techniques || {}).map(([id, t]) => ({ id, ...t }))).slice(0, 12).map((tech: any, i: number) => {
                  const techCov = cov?.techniques?.[tech.id];
                  const status = techCov?.status || 'not_tested';
                  return (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-sm ${getCellColor(status)}`}
                      title={`${tech.id}: ${tech.name} — ${status}`}
                    />
                  );
                })}
              </div>
              <div className="mt-1 text-[9px] text-gray-400">
                {tested}/{total} tested
                {detected > 0 && <span className="text-green-400 ml-1">✓{detected}</span>}
                {missed > 0 && <span className="text-red-400 ml-1">✗{missed}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded detail for selected tactic */}
      {selectedTactic && selectedCoverage && (
        <div className="border-t border-gray-700/50 pt-3 mt-2">
          <h4 className="text-sm font-bold text-cyan-400 mb-2">
            {selectedCoverage.name} — Techniques ({selectedCoverage.total_techniques})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto">
            {Object.entries(selectedCoverage.techniques).map(([techId, tech]) => (
              <div
                key={techId}
                className={`p-2 rounded border text-xs ${getCellColor(tech.status)} border-gray-600/30`}
              >
                <div className="font-mono text-[10px] text-gray-300">{techId}</div>
                <div className="text-white truncate" title={tech.name}>{tech.name}</div>
                <div className="text-[10px] mt-1">
                  {tech.status === 'detected' && '✅ Detected'}
                  {tech.status === 'missed' && '❌ Missed'}
                  {tech.status === 'not_tested' && '⬜ Not Tested'}
                  {tech.subtechniques_count > 0 && (
                    <span className="text-gray-400 ml-1">({tech.subtechniques_count} sub)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// Attack Chain Selector
// ═══════════════════════════════════════════════════════════

function ChainSelector({ chains, onSelect }: { chains: AttackChain[]; onSelect: (chain: AttackChain) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {chains.map(chain => (
        <div
          key={chain.id}
          className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-cyan-500/50 transition-all cursor-pointer group"
          onClick={() => onSelect(chain)}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{chain.name}</h4>
            <SeverityBadge severity={chain.severity} />
          </div>
          <p className="text-xs text-gray-400 mb-3">{chain.description}</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {chain.tools_used.map(tool => (
              <span key={tool} className="bg-gray-700/50 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">{tool}</span>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{chain.steps_count} steps</span>
            <span>{chain.mitre_tactics.length} tactics</span>
          </div>
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// Exercise Detail Panel
// ═══════════════════════════════════════════════════════════

function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'alerts' | 'gaps' | 'coverage'>('timeline');

  const detectionRate = exercise.total_steps > 0
    ? Math.round(exercise.detected_attacks / exercise.total_steps * 100)
    : 0;

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-purple-500/5 to-cyan-500/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white">{exercise.name}</h3>
            <p className="text-xs text-gray-400">Target: {exercise.target} • Chain: {exercise.attack_chain_id}</p>
          </div>
          <StatusBadge status={exercise.status} />
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress: {exercise.completed_steps}/{exercise.total_steps}</span>
            <span>Detection: {detectionRate}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${exercise.total_steps > 0 ? (exercise.completed_steps / exercise.total_steps) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Risk Score" value={exercise.risk_score?.toFixed(1) || '0'} icon="⚠️" color="red" />
          <StatCard label="Detected" value={exercise.detected_attacks} icon="🛡️" color="green" />
          <StatCard label="Missed" value={exercise.missed_attacks} icon="💀" color="red" />
          <StatCard label="Detection Rate" value={`${detectionRate}%`} icon="📊" color={detectionRate >= 70 ? 'green' : detectionRate >= 40 ? 'yellow' : 'red'} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/50">
        {(['timeline', 'alerts', 'gaps', 'coverage'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'timeline' && '🔴 '}
            {tab === 'alerts' && '🔵 '}
            {tab === 'gaps' && '📋 '}
            {tab === 'coverage' && '🗺️ '}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {exercise.red_team_results?.map((step, i) => (
              <div
                key={i}
                className={`border rounded-lg p-3 ${
                  step.detected_by_blue
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.detected_by_blue ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white">{step.technique_name || step.technique_id}</span>
                      <span className="text-xs text-gray-500 ml-2">[{step.technique_id}]</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{step.duration_seconds?.toFixed(1)}s</span>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-400 mb-1 bg-gray-800/50 rounded px-2 py-1 truncate">
                  $ {step.command}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-500">Phase: <span className="text-gray-300">{step.phase}</span></span>
                  <span className="text-gray-500">Tool: <span className="text-cyan-400 font-mono">{step.tool}</span></span>
                  {step.findings?.length > 0 && (
                    <span className="text-yellow-400">{step.findings.length} findings</span>
                  )}
                  {step.detected_by_blue ? (
                    <span className="text-green-400 font-bold">🛡️ DETECTED</span>
                  ) : (
                    <span className="text-red-400 font-bold">💀 MISSED</span>
                  )}
                </div>
                {step.output && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">View Output</summary>
                    <pre className="mt-1 text-[10px] text-gray-400 bg-gray-900 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                      {step.output.substring(0, 3000)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            {(!exercise.red_team_results || exercise.red_team_results.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                {exercise.status === 'running' ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                    <span>Attack chain executing...</span>
                  </div>
                ) : 'No attack steps yet'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {exercise.blue_team_alerts?.map((alert, i) => (
              <div key={i} className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">🔵</span>
                    <span className="text-sm font-bold text-white">{alert.playbook_name}</span>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Tool detected: <span className="text-cyan-400 font-mono">{String(alert.trigger_details?.tool_detected || '')}</span>
                  {' • '}Confidence: <span className="text-yellow-400">{(Number(alert.trigger_details?.confidence || 0) * 100).toFixed(0)}%</span>
                </div>

                {/* Response actions */}
                {alert.response_actions_taken?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-bold text-green-400 mb-1">✅ Auto-Executed:</div>
                    {alert.response_actions_taken.map((a, j) => (
                      <div key={j} className="text-xs text-gray-300 ml-3">• {a.description}</div>
                    ))}
                  </div>
                )}
                {alert.response_actions_pending?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-bold text-yellow-400 mb-1">⏳ Pending Approval:</div>
                    {alert.response_actions_pending.map((a, j) => (
                      <div key={j} className="text-xs text-gray-300 ml-3">• {a.description}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(!exercise.blue_team_alerts || exercise.blue_team_alerts.length === 0) && (
              <div className="text-center text-gray-500 py-8">No alerts generated</div>
            )}
          </div>
        )}

        {activeTab === 'gaps' && exercise.gap_analysis && (
          <div>
            {/* Detection summary */}
            <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-3">
                <div>
                  <div className="text-2xl font-bold text-white">{exercise.gap_analysis.total_attacks}</div>
                  <div className="text-xs text-gray-400">Total Attacks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{exercise.gap_analysis.detected}</div>
                  <div className="text-xs text-gray-400">Detected</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{exercise.gap_analysis.missed}</div>
                  <div className="text-xs text-gray-400">Missed</div>
                </div>
              </div>
              <div className="text-center">
                <span className={`text-3xl font-bold ${
                  exercise.gap_analysis.detection_rate >= 70 ? 'text-green-400' :
                  exercise.gap_analysis.detection_rate >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {exercise.gap_analysis.detection_rate}%
                </span>
                <div className="text-xs text-gray-400">Detection Rate</div>
              </div>
            </div>

            {/* Missed techniques */}
            {exercise.gap_analysis.missed_techniques?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold text-red-400 mb-2">❌ Missed Attack Techniques</h4>
                <div className="space-y-1">
                  {exercise.gap_analysis.missed_techniques.map((mt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-red-500/5 border border-red-500/20 rounded p-2">
                      <span className="font-mono text-red-300">{mt.technique_id}</span>
                      <span className="text-white">{mt.technique_name}</span>
                      <span className="text-gray-500">via {mt.tool}</span>
                      <span className="text-gray-600 ml-auto">{mt.phase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {exercise.gap_analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-cyan-400 mb-2">💡 Recommendations</h4>
                <div className="space-y-2">
                  {exercise.gap_analysis.recommendations.map((rec, i) => (
                    <div key={i} className={`border rounded-lg p-3 ${
                      rec.priority === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                      rec.priority === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                      'border-yellow-500/30 bg-yellow-500/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={rec.priority} />
                        <span className="text-sm font-bold text-white">{rec.area}</span>
                      </div>
                      <p className="text-xs text-gray-300">{rec.description}</p>
                      <span className="text-[10px] text-gray-500 font-mono">Ref: {rec.mitre_reference}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && exercise.coverage_map && Object.keys(exercise.coverage_map).length > 0 && (
          <MitreHeatMap coverage={exercise.coverage_map} matrix={exercise.coverage_map as any} />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════

export default function PurpleTeamPage() {
  useDocumentTitle('Purple Team — CyberSec Pro');
  const { t: _t } = useTranslation();

  // State
  const [tab, setTab] = useState<'dashboard' | 'exercise' | 'matrix' | 'playbooks'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chains, setChains] = useState<AttackChain[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [mitreMatrix, setMitreMatrix] = useState<Record<string, MitreTactic>>({});

  // New exercise form
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedChain, setSelectedChain] = useState<AttackChain | null>(null);
  const [starting, setStarting] = useState(false);

  // Load everything
  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, chainsRes, playbooksRes, exercisesRes, matrixRes] = await Promise.all([
      ptFetch<DashboardStats>('/purple-team/dashboard'),
      ptFetch<AttackChain[]>('/purple-team/chains'),
      ptFetch<Playbook[]>('/purple-team/playbooks'),
      ptFetch<Exercise[]>('/purple-team/exercises'),
      ptFetch<Record<string, MitreTactic>>('/purple-team/mitre-matrix'),
    ]);
    if (statsRes) setStats(statsRes);
    if (chainsRes) setChains(chainsRes);
    if (playbooksRes) setPlaybooks(playbooksRes);
    if (exercisesRes) setExercises(exercisesRes);
    if (matrixRes) setMitreMatrix(matrixRes);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh for running exercises
  useEffect(() => {
    const running = exercises.some(e => e.status === 'running');
    if (!running) return;
    const interval = setInterval(async () => {
      const res = await ptFetch<Exercise[]>('/purple-team/exercises');
      if (res) {
        setExercises(res);
        // Update selected exercise too
        if (selectedExercise) {
          const updated = res.find(e => e.id === selectedExercise.id);
          if (updated) setSelectedExercise(updated);
        }
      }
      const statsRes = await ptFetch<DashboardStats>('/purple-team/dashboard');
      if (statsRes) setStats(statsRes);
    }, 3000);
    return () => clearInterval(interval);
  }, [exercises, selectedExercise]);

  // Start exercise
  const startExercise = async () => {
    if (!selectedChain || !newTarget.trim()) return;
    setStarting(true);
    const res = await ptFetch<Exercise>('/purple-team/exercises', {
      method: 'POST',
      body: JSON.stringify({
        chain_id: selectedChain.id,
        target: newTarget.trim(),
        name: newName.trim() || undefined,
      }),
    });
    if (res) {
      setExercises(prev => [res, ...prev]);
      setSelectedExercise(res);
      setShowNewExercise(false);
      setNewTarget('');
      setNewName('');
      setSelectedChain(null);
      setTab('exercise');
    }
    setStarting(false);
  };

  // View exercise detail
  const viewExercise = async (ex: Exercise) => {
    const detail = await ptFetch<Exercise>(`/purple-team/exercises/${ex.id}`);
    if (detail) {
      setSelectedExercise(detail);
      setTab('exercise');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              🛡️ Purple Team
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full border border-purple-500/30 font-mono">
              DoD GRADE
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Red Team Attack → Blue Team Detect → Purple Team Coordinate • MITRE ATT&CK Framework
          </p>
        </div>
        <button
          onClick={() => setShowNewExercise(true)}
          className="bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 hover:from-red-600 hover:via-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-purple-500/20"
        >
          + New Exercise
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
        {([
          { id: 'dashboard' as const, label: '📊 Dashboard', },
          { id: 'exercise' as const, label: '🎯 Exercises', },
          { id: 'matrix' as const, label: '🗺️ ATT&CK Matrix', },
          { id: 'playbooks' as const, label: '📋 Playbooks', },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              tab === t.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD TAB ═══ */}
      {tab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Exercises" value={stats.total_exercises} icon="🎯" color="purple" />
            <StatCard label="Running" value={stats.running} icon="⚡" color="cyan" />
            <StatCard label="Detection Rate" value={`${stats.detection_rate}%`} icon="🛡️"
              color={stats.detection_rate >= 70 ? 'green' : stats.detection_rate >= 40 ? 'yellow' : 'red'} />
            <StatCard label="Avg Risk Score" value={stats.average_risk_score.toFixed(1)} icon="⚠️"
              color={stats.average_risk_score <= 30 ? 'green' : stats.average_risk_score <= 60 ? 'yellow' : 'red'} />
            <StatCard label="Attack Steps" value={stats.total_attack_steps} icon="💣" color="red" />
          </div>

          {/* Red vs Blue Scoreboard */}
          <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              ⚔️ Red Team vs Blue Team Scoreboard
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold text-red-400">{stats.total_missed}</div>
                <div className="flex items-center justify-center gap-1 text-xs text-red-300 mt-1">
                  <span>🔴</span> Red Team Wins (Undetected)
                </div>
              </div>
              <div className="w-px h-12 bg-gray-700" />
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.total_detected}</div>
                <div className="flex items-center justify-center gap-1 text-xs text-blue-300 mt-1">
                  <span>🔵</span> Blue Team Wins (Detected)
                </div>
              </div>
            </div>
            {/* Visual bar */}
            <div className="mt-3 h-4 bg-gray-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all"
                style={{ width: `${stats.total_attack_steps > 0 ? (stats.total_missed / stats.total_attack_steps) * 100 : 50}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                style={{ width: `${stats.total_attack_steps > 0 ? (stats.total_detected / stats.total_attack_steps) * 100 : 50}%` }}
              />
            </div>
          </div>

          {/* Recent Exercises */}
          <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-3">📜 Recent Exercises</h3>
            {exercises.length > 0 ? (
              <div className="space-y-2">
                {exercises.slice(0, 10).map(ex => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 hover:border-purple-500/30 cursor-pointer transition-all"
                    onClick={() => viewExercise(ex)}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={ex.status} />
                      <div>
                        <div className="text-sm font-bold text-white">{ex.name}</div>
                        <div className="text-xs text-gray-500">{ex.target} • {new Date(ex.started_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-400">✓{ex.detected_attacks}</span>
                      <span className="text-red-400">✗{ex.missed_attacks}</span>
                      <span className="text-gray-400">{ex.total_steps} steps</span>
                      {ex.risk_score > 0 && (
                        <span className={`font-bold ${ex.risk_score <= 30 ? 'text-green-400' : ex.risk_score <= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                          Risk: {ex.risk_score.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No exercises yet. Click "New Exercise" to start your first Purple Team operation.
              </div>
            )}
          </div>

          {/* Available chains summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-2">🔴 Available Attack Chains</h3>
              <div className="text-3xl font-bold text-red-400">{stats.available_chains}</div>
              <p className="text-xs text-gray-500 mt-1">Pre-built multi-step attack scenarios</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-2">🔵 Detection Playbooks</h3>
              <div className="text-3xl font-bold text-blue-400">{stats.available_playbooks}</div>
              <p className="text-xs text-gray-500 mt-1">Automated detection & response rules</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXERCISES TAB ═══ */}
      {tab === 'exercise' && (
        <div className="space-y-6">
          {selectedExercise ? (
            <div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1"
              >
                ← Back to list
              </button>
              <ExerciseDetail exercise={selectedExercise} />
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700/50 rounded-xl hover:border-purple-500/30 cursor-pointer transition-all"
                  onClick={() => viewExercise(ex)}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={ex.status} />
                    <div>
                      <div className="text-sm font-bold text-white">{ex.name}</div>
                      <div className="text-xs text-gray-500">{ex.target} • Chain: {ex.attack_chain_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-400">✓ {ex.detected_attacks}</span>
                    <span className="text-red-400">✗ {ex.missed_attacks}</span>
                    <span className="text-gray-400">{ex.completed_steps}/{ex.total_steps}</span>
                  </div>
                </div>
              ))}
              {exercises.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-4xl mb-3">🎯</div>
                  <p>No exercises yet. Launch your first Purple Team operation!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ MITRE ATT&CK MATRIX TAB ═══ */}
      {tab === 'matrix' && (
        <div className="space-y-4">
          <MitreHeatMap
            coverage={selectedExercise?.coverage_map || {}}
            matrix={mitreMatrix}
          />
          <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">📊 Matrix Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                <div className="text-2xl font-bold text-white">{Object.keys(mitreMatrix).length}</div>
                <div className="text-xs text-gray-400">Tactics</div>
              </div>
              <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                <div className="text-2xl font-bold text-cyan-400">
                  {Object.values(mitreMatrix).reduce((sum, t) => sum + (t.total || 0), 0)}
                </div>
                <div className="text-xs text-gray-400">Techniques</div>
              </div>
              <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{chains.length}</div>
                <div className="text-xs text-gray-400">Attack Chains</div>
              </div>
              <div className="text-center p-3 bg-gray-800/30 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{playbooks.length}</div>
                <div className="text-xs text-gray-400">Detection Rules</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PLAYBOOKS TAB ═══ */}
      {tab === 'playbooks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attack Chains */}
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-red-400">🔴</span> Red Team Attack Chains
              </h3>
              <div className="space-y-2">
                {chains.map(chain => (
                  <div key={chain.id} className="border border-gray-700/30 rounded-lg p-3 hover:border-red-500/30 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{chain.name}</span>
                      <SeverityBadge severity={chain.severity} />
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{chain.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{chain.steps_count} steps</span>
                      <span>•</span>
                      <span>{chain.tools_used.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection Playbooks */}
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">🔵</span> Blue Team Detection Playbooks
              </h3>
              <div className="space-y-2">
                {playbooks.map(pb => (
                  <div key={pb.id} className="border border-gray-700/30 rounded-lg p-3 hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{pb.name}</span>
                      <SeverityBadge severity={pb.severity} />
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{pb.trigger}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{pb.response_actions_count} actions</span>
                      <span>•</span>
                      <span className="text-green-400">{pb.auto_actions} auto</span>
                      <span>•</span>
                      <span className="font-mono">{pb.mitre_techniques.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW EXERCISE MODAL ═══ */}
      {showNewExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🎯 New Purple Team Exercise
              </h2>
              <button onClick={() => { setShowNewExercise(false); setSelectedChain(null); }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Step 1: Select Chain */}
            {!selectedChain ? (
              <div>
                <h3 className="text-sm font-bold text-gray-300 mb-3">Select Attack Chain:</h3>
                <ChainSelector chains={chains} onSelect={setSelectedChain} />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected chain summary */}
                <div className="bg-gray-800/50 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white">{selectedChain.name}</span>
                      <SeverityBadge severity={selectedChain.severity} />
                    </div>
                    <button onClick={() => setSelectedChain(null)} className="text-xs text-gray-400 hover:text-white">Change</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{selectedChain.description}</p>
                </div>

                {/* Target input */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Target (IP or Domain):</label>
                  <input
                    type="text"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    placeholder="e.g. scanme.nmap.org or 192.168.1.1"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Name input (optional) */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-1">Exercise Name (optional):</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="My Purple Team Exercise"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Launch button */}
                <button
                  onClick={startExercise}
                  disabled={!newTarget.trim() || starting}
                  className="w-full bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 hover:from-red-600 hover:via-purple-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-purple-500/20"
                >
                  {starting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Launching Exercise...
                    </span>
                  ) : (
                    '🚀 Launch Purple Team Exercise'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
