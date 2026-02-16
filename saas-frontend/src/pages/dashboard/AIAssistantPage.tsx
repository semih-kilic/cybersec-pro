import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface Suggestion {
  tool_name: string;
  tool_id: string | null;
  reason: string;
  category: string;
  available: boolean;
  plan_required: string;
}

interface Remediation {
  priority: number;
  issue: string;
  severity: string;
  fix: string;
  code_example: string;
  references: string[];
  estimated_effort: string;
}

export default function AIAssistantPage() {
  const [target, setTarget] = useState('');
  const [context, setContext] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [scanPlan, setScanPlan] = useState<{ recommended_order: string[] } | null>(null);
  const [targetType, setTargetType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Remediation tab
  const [scanId, setScanId] = useState('');
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [remediationSummary, setRemediationSummary] = useState('');
  const [remLoading, setRemLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'suggest' | 'remediate'>('suggest');

  const handleSuggest = async () => {
    if (!target.trim()) return;
    setLoading(true);
    setError('');
    setSuggestions([]);
    
    const res = await api.aiSuggestTools(target, context);
    if (res.data) {
      setSuggestions(res.data.suggestions || []);
      setScanPlan(res.data.scan_plan || null);
      setTargetType(res.data.target_type || '');
    } else {
      setError(res.error || 'Failed to get suggestions');
    }
    setLoading(false);
  };

  const handleRemediate = async () => {
    if (!scanId.trim()) return;
    setRemLoading(true);
    setError('');
    setRemediations([]);
    
    const res = await api.aiRemediation(scanId);
    if (res.data) {
      setRemediations(res.data.remediations || []);
      setRemediationSummary(res.data.executive_summary || '');
    } else {
      setError(res.error || 'Failed to get remediations');
    }
    setRemLoading(false);
  };

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          🤖 AI Security Assistant
        </h1>
        <p className="text-gray-400 mt-1">AI-powered tool recommendations and remediation guidance</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('suggest')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'suggest'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🔍 Tool Suggestions
        </button>
        <button
          onClick={() => setActiveTab('remediate')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'remediate'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🛡️ Auto-Remediation
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggest' && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Enter Target for Analysis</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target (IP, Domain, or URL)</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g., example.com, 192.168.1.0/24, https://app.example.com"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Context (optional)</label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., web application, internal network, API server"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSuggest}
                disabled={loading || !target.trim()}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 transition"
              >
                {loading ? '🔄 Analyzing...' : '🤖 Get AI Recommendations'}
              </button>
            </div>
          </div>

          {targetType && (
            <div className="bg-gray-800/30 rounded-lg px-4 py-2 text-sm text-gray-300">
              Detected target type: <span className="text-cyan-400 font-medium">{targetType}</span>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">🎯 Recommended Tools</h2>
              <div className="grid gap-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 flex items-start gap-4">
                    <div className="text-2xl font-bold text-gray-600 w-8">{i + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">{s.tool_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{s.category}</span>
                        {!s.available && (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            Requires {s.plan_required}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{s.reason}</p>
                    </div>
                    {s.tool_id && (
                      <Link
                        to={`/dashboard/tools/${s.tool_id}/run`}
                        className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition whitespace-nowrap"
                      >
                        Run →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {scanPlan && scanPlan.recommended_order.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-3">📋 Recommended Scan Order</h2>
              <div className="flex flex-wrap gap-2">
                {scanPlan.recommended_order.map((tool, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-medium">
                      {i + 1}. {tool}
                    </span>
                    {i < scanPlan.recommended_order.length - 1 && (
                      <span className="text-gray-600">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remediation Tab */}
      {activeTab === 'remediate' && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Enter Scan ID for Remediation Analysis</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={scanId}
                onChange={(e) => setScanId(e.target.value)}
                placeholder="Paste scan ID from completed scan"
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleRemediate()}
              />
              <button
                onClick={handleRemediate}
                disabled={remLoading || !scanId.trim()}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition"
              >
                {remLoading ? '🔄 Analyzing...' : '🛡️ Get Remediation Plan'}
              </button>
            </div>
          </div>

          {remediationSummary && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-1">Executive Summary</h3>
              <p className="text-gray-300 text-sm">{remediationSummary}</p>
            </div>
          )}

          {remediations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">🔧 Remediation Plan</h2>
              {remediations.map((r, i) => (
                <div key={i} className={`rounded-xl p-5 border ${severityColors[r.severity] || severityColors.info}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">#{r.priority}</span>
                      <span className="font-semibold">{r.issue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold">{r.severity}</span>
                      <span className="text-xs text-gray-400">⏱ {r.estimated_effort}</span>
                    </div>
                  </div>
                  <p className="text-sm mb-3">{r.fix}</p>
                  <div className="bg-gray-900/50 rounded-lg p-3 mb-2">
                    <code className="text-xs text-green-400 font-mono break-all">{r.code_example}</code>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.references.map((ref, j) => (
                      <span key={j} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
