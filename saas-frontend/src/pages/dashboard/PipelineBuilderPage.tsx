import React, { useState, useReducer, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  tool: string;
  category: string;
  params: Record<string, string>;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
}

interface Pipeline {
  id?: string;
  name: string;
  steps: PipelineStep[];
  status: "draft" | "running" | "completed" | "failed";
}

interface ToolDef {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  defaultParams: Record<string, string>;
}

// ─── Pipeline Reducer ───────────────────────────────────────────────────────

type PipelineAction =
  | { type: "SET_NAME"; name: string }
  | { type: "ADD_STEP"; step: PipelineStep; afterIndex?: number }
  | { type: "REMOVE_STEP"; stepId: string }
  | { type: "MOVE_STEP"; stepId: string; direction: "up" | "down" }
  | { type: "UPDATE_STEP_PARAMS"; stepId: string; params: Record<string, string> }
  | { type: "SET_STEP_STATUS"; stepId: string; status: PipelineStep["status"]; output?: string }
  | { type: "SET_PIPELINE_STATUS"; status: Pipeline["status"] }
  | { type: "LOAD_PIPELINE"; pipeline: Pipeline }
  | { type: "RESET" };

function pipelineReducer(state: Pipeline, action: PipelineAction): Pipeline {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.name };
    case "ADD_STEP": {
      const newSteps = [...state.steps];
      const insertAt = action.afterIndex !== undefined ? action.afterIndex + 1 : newSteps.length;
      newSteps.splice(insertAt, 0, action.step);
      return { ...state, steps: newSteps };
    }
    case "REMOVE_STEP":
      return { ...state, steps: state.steps.filter((s) => s.id !== action.stepId) };
    case "MOVE_STEP": {
      const idx = state.steps.findIndex((s) => s.id === action.stepId);
      if (idx === -1) return state;
      const newIdx = action.direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= state.steps.length) return state;
      const newSteps = [...state.steps];
      [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
      return { ...state, steps: newSteps };
    }
    case "UPDATE_STEP_PARAMS":
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.stepId ? { ...s, params: action.params } : s
        ),
      };
    case "SET_STEP_STATUS":
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.stepId
            ? { ...s, status: action.status, output: action.output ?? s.output }
            : s
        ),
      };
    case "SET_PIPELINE_STATUS":
      return { ...state, status: action.status };
    case "LOAD_PIPELINE":
      return action.pipeline;
    case "RESET":
      return { name: "New Pipeline", steps: [], status: "draft" };
    default:
      return state;
  }
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const TOOL_DEFINITIONS: ToolDef[] = [
  // Reconnaissance
  { id: "subfinder", name: "subfinder", category: "Reconnaissance", description: "Passive subdomain discovery", icon: "🔍", defaultParams: { target: "", wordlist: "" } },
  { id: "amass", name: "amass", category: "Reconnaissance", description: "In-depth attack surface mapping", icon: "🌐", defaultParams: { target: "", mode: "passive" } },
  { id: "theharvester", name: "theHarvester", category: "Reconnaissance", description: "Email & subdomain harvesting", icon: "📧", defaultParams: { target: "", source: "all" } },
  { id: "sublist3r", name: "Sublist3r", category: "Reconnaissance", description: "Fast subdomain enumeration", icon: "📋", defaultParams: { target: "" } },
  // Scanning
  { id: "nmap", name: "nmap", category: "Scanning", description: "Network exploration & port scan", icon: "📡", defaultParams: { target: "", flags: "-sV -sC" } },
  { id: "masscan", name: "masscan", category: "Scanning", description: "High-speed port scanner", icon: "⚡", defaultParams: { target: "", ports: "0-65535", rate: "10000" } },
  { id: "nuclei", name: "nuclei", category: "Scanning", description: "Template-based vulnerability scanner", icon: "🎯", defaultParams: { target: "", templates: "" } },
  { id: "nikto", name: "nikto", category: "Scanning", description: "Web server scanner", icon: "🖥️", defaultParams: { target: "", port: "80" } },
  { id: "whatweb", name: "whatweb", category: "Scanning", description: "Web technology fingerprinting", icon: "🕸️", defaultParams: { target: "" } },
  { id: "httpx", name: "httpx", category: "Scanning", description: "Fast HTTP probing toolkit", icon: "🔗", defaultParams: { targets_file: "", status_code: "true" } },
  // Exploitation
  { id: "sqlmap", name: "sqlmap", category: "Exploitation", description: "Automatic SQL injection", icon: "💉", defaultParams: { url: "", level: "1", risk: "1" } },
  { id: "wfuzz", name: "wfuzz", category: "Exploitation", description: "Web application fuzzer", icon: "💥", defaultParams: { url: "", wordlist: "" } },
  { id: "ffuf", name: "ffuf", category: "Exploitation", description: "Fast web fuzzer", icon: "🌀", defaultParams: { url: "", wordlist: "" } },
  // Post-Exploitation
  { id: "linpeas", name: "linpeas", category: "Post-Exploitation", description: "Linux privilege escalation audit", icon: "🐧", defaultParams: { target: "" } },
  { id: "privesc-check", name: "privesc-check", category: "Post-Exploitation", description: "Windows privilege escalation check", icon: "🪟", defaultParams: { target: "" } },
  // Reporting
  { id: "pdf-report", name: "pdf-report", category: "Reporting", description: "Generate PDF report", icon: "📄", defaultParams: { template: "executive", title: "" } },
  { id: "csv-export", name: "csv-export", category: "Reporting", description: "Export results to CSV", icon: "📊", defaultParams: { output: "results.csv" } },
  { id: "slack-notify", name: "slack-notify", category: "Reporting", description: "Send Slack notification", icon: "🔔", defaultParams: { webhook: "", channel: "#security" } },
];

const CATEGORIES = ["Reconnaissance", "Scanning", "Exploitation", "Post-Exploitation", "Reporting"];

const CATEGORY_COLORS: Record<string, string> = {
  Reconnaissance: "cyan",
  Scanning: "emerald",
  Exploitation: "red",
  "Post-Exploitation": "amber",
  Reporting: "purple",
};

const MOCK_OUTPUT_LINES: string[] = [
  "[INFO] Initializing pipeline step...",
  "[INFO] Connecting to target...",
  "[INFO] Target identified. Starting scan.",
  "[INFO] Scanning ports 1-1000...",
  "[INFO] Port 22/tcp open - SSH",
  "[INFO] Port 80/tcp open - HTTP",
  "[INFO] Port 443/tcp open - HTTPS",
  "[INFO] Analyzing service versions...",
  "[INFO] Checking for known vulnerabilities...",
  "[INFO] Step completed successfully.",
];

// ─── i18n ───────────────────────────────────────────────────────────────────

const t = (key: string): string => {
  const dict: Record<string, string> = {
    "pipeline.title": "Pipeline Builder",
    "pipeline.description": "Chain security tools together into automated workflows",
    "pipeline.tools": "Tool Palette",
    "pipeline.canvas": "Pipeline Canvas",
    "pipeline.save": "Save Pipeline",
    "pipeline.run": "Run Pipeline",
    "pipeline.schedule": "Schedule",
    "pipeline.name_placeholder": "Enter pipeline name...",
    "pipeline.add_step": "Add Step",
    "pipeline.remove_step": "Remove",
    "pipeline.no_steps": "Drag tools from the palette or click + to add steps",
    "pipeline.step_config": "Step Configuration",
    "pipeline.parameters": "Parameters",
    "pipeline.timeout": "Timeout (seconds)",
    "pipeline.condition": "Condition to Proceed",
    "pipeline.save_success": "Pipeline saved successfully!",
    "pipeline.run_started": "Pipeline execution started...",
    "pipeline.search_tools": "Search tools...",
    "pipeline.estimated_duration": "Estimated Duration",
    "pipeline.pipeline_status": "Pipeline Status",
    "pipeline.execution_view": "Execution View",
    "pipeline.cancel": "Cancel",
    "pipeline.back_to_edit": "Back to Editor",
    "pipeline.schedule_cron": "Cron Expression",
    "pipeline.schedule_desc": "Set a cron schedule for this pipeline",
  };
  return dict[key] ?? key;
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function uid(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function estimateDuration(steps: PipelineStep[]): string {
  const ESTIMATES: Record<string, number> = {
    subfinder: 30, amass: 120, theharvester: 45, sublist3r: 20,
    nmap: 90, masscan: 15, nuclei: 180, nikto: 60, whatweb: 10, httpx: 25,
    sqlmap: 300, wfuzz: 120, ffuf: 60,
    linpeas: 45, "privesc-check": 30,
    "pdf-report": 10, "csv-export": 5, "slack-notify": 2,
  };
  const total = steps.reduce((acc, s) => acc + (ESTIMATES[s.tool] ?? 30), 0);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}m ${sec}s`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const StatusIcon: React.FC<{ status: PipelineStep["status"] }> = ({ status }) => {
  switch (status) {
    case "pending":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 bg-gray-800">
          <span className="h-2 w-2 rounded-full bg-gray-500" />
        </span>
      );
    case "running":
      return (
        <span className="flex h-5 w-5 items-center justify-center">
          <svg className="h-5 w-5 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      );
    case "completed":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20">
          <svg className="h-3.5 w-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
  }
};

const PipelineStatusBadge: React.FC<{ status: Pipeline["status"] }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-gray-700 text-gray-300" },
    running: { label: "Running", cls: "bg-cyan-500/20 text-cyan-400 animate-pulse" },
    completed: { label: "Completed", cls: "bg-emerald-500/20 text-emerald-400" },
    failed: { label: "Failed", cls: "bg-red-500/20 text-red-400" },
  };
  const s = map[status] ?? map.draft;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

// ─── Tool Palette ───────────────────────────────────────────────────────────

interface ToolPaletteProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddTool: (tool: ToolDef) => void;
}

const ToolPalette: React.FC<ToolPaletteProps> = ({ searchQuery, onSearchChange, onAddTool }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = TOOL_DEFINITIONS.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    tools: filtered.filter((t) => t.category === cat),
  })).filter((g) => g.tools.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">{t("pipeline.tools")}</h2>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t("pipeline.search_tools")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {grouped.map(({ cat, tools }) => {
          const isCollapsed = collapsed[cat];
          const color = CATEGORY_COLORS[cat] ?? "gray";
          return (
            <div key={cat} className="rounded-lg border border-gray-800 bg-gray-900/50">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [cat]: !isCollapsed }))}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full bg-${color}-400`} />
                  <span className="text-sm font-semibold text-gray-200">{cat}</span>
                  <span className="text-xs text-gray-500">({tools.length})</span>
                </div>
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isCollapsed && (
                <div className="space-y-1.5 px-2 pb-2">
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => onAddTool(tool)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-gray-800/50 px-3 py-2.5 text-left transition hover:border-gray-600 hover:bg-gray-800 group"
                    >
                      <span className="text-lg">{tool.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-200 group-hover:text-white">{tool.name}</p>
                        <p className="truncate text-xs text-gray-500">{tool.description}</p>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No tools match your search</p>
        )}
      </div>
    </div>
  );
};

// ─── Step Node ──────────────────────────────────────────────────────────────

interface StepNodeProps {
  step: PipelineStep;
  index: number;
  total: number;
  isSelected: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAfter: () => void;
}

const StepNode: React.FC<StepNodeProps> = ({
  step, index, total, isSelected, isRunning, onSelect, onRemove, onMoveUp, onMoveDown, onInsertAfter,
}) => {
  const catColor = CATEGORY_COLORS[step.category] ?? "gray";
  const borderColor =
    step.status === "running"
      ? "border-cyan-500 shadow-lg shadow-cyan-500/20"
      : step.status === "completed"
      ? "border-emerald-500/50"
      : step.status === "failed"
      ? "border-red-500/50"
      : isSelected
      ? "border-cyan-500/50"
      : "border-gray-700";

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-0.5 text-gray-600 transition hover:text-gray-300 disabled:opacity-30"
          title="Move up"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-0.5 text-gray-600 transition hover:text-gray-300 disabled:opacity-30"
          title="Move down"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div
        onClick={onSelect}
        className={`relative w-56 cursor-pointer rounded-xl border bg-gray-900 p-3 transition-all hover:bg-gray-800 ${borderColor} ${isRunning ? "ring-2 ring-cyan-500/30" : ""}`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-gray-500 border border-gray-700 transition hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50"
          title={t("pipeline.remove_step")}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{TOOL_DEFINITIONS.find((td) => td.id === step.tool)?.icon ?? "🔧"}</span>
            <span className="text-sm font-bold text-white">{step.tool}</span>
          </div>
          <StatusIcon status={step.status} />
        </div>

        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold bg-${catColor}-500/10 text-${catColor}-400`}>
          {step.category}
        </span>

        {Object.keys(step.params).length > 0 && (
          <div className="mt-2 space-y-0.5">
            {Object.entries(step.params)
              .filter(([, v]) => v)
              .slice(0, 2)
              .map(([k, v]) => (
                <p key={k} className="truncate text-[10px] text-gray-500">
                  <span className="text-gray-600">{k}:</span> {v}
                </p>
              ))}
          </div>
        )}
      </div>

      {index < total - 1 && (
        <div className="my-1 flex flex-col items-center">
          <div className="h-4 w-px bg-gray-700" />
          <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <div className="h-4 w-px bg-gray-700" />
        </div>
      )}

      {index === total - 1 && (
        <button
          onClick={onInsertAfter}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-gray-700 text-gray-600 transition hover:border-cyan-500 hover:text-cyan-400"
          title={t("pipeline.add_step")}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ─── Step Configuration Panel ───────────────────────────────────────────────

interface StepConfigProps {
  step: PipelineStep;
  onUpdate: (params: Record<string, string>) => void;
  onClose: () => void;
}

const StepConfigPanel: React.FC<StepConfigProps> = ({ step, onUpdate, onClose }) => {
  const [localParams, setLocalParams] = useState<Record<string, string>>({ ...step.params });
  const [timeout, setTimeout_] = useState("300");
  const [condition, setCondition] = useState("always");

  useEffect(() => {
    setLocalParams({ ...step.params });
  }, [step.id]);

  const handleChange = (key: string, value: string) => {
    setLocalParams((p) => {
      const next = { ...p, [key]: value };
      onUpdate(next);
      return next;
    });
  };

  const toolDef = TOOL_DEFINITIONS.find((td) => td.id === step.tool);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{t("pipeline.step_config")}: {step.tool}</h3>
        <button onClick={onClose} className="rounded p-1 text-gray-500 hover:text-white transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">{t("pipeline.parameters")}</label>
          {Object.entries(localParams).map(([key, value]) => (
            <div key={key} className="mb-2">
              <label className="mb-0.5 block text-[10px] text-gray-500 uppercase tracking-wide">{key}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={key}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">{t("pipeline.timeout")}</label>
          <input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout_(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">{t("pipeline.condition")}</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="always">Always proceed</option>
            <option value="on_success">Only on success</option>
            <option value="on_failure">Only on failure</option>
            <option value="manual">Require manual approval</option>
          </select>
        </div>
      </div>

      {toolDef && (
        <div className="mt-3 rounded-lg bg-gray-800/50 p-3">
          <p className="text-xs text-gray-400">{toolDef.description}</p>
        </div>
      )}
    </div>
  );
};

// ─── Execution View ─────────────────────────────────────────────────────────

interface ExecutionViewProps {
  pipeline: Pipeline;
  onCancel: () => void;
  onBack: () => void;
}

const ExecutionView: React.FC<ExecutionViewProps> = ({ pipeline, onCancel, onBack }) => {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToBottom = useCallback((id: string) => {
    logEndRefs.current[id]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    let mounted = true;
    let stepIndex = 0;

    const runStep = async () => {
      if (!mounted || stepIndex >= pipeline.steps.length) return;

      const step = pipeline.steps[stepIndex];
      setLogs((prev) => ({ ...prev, [step.id]: [] }));

      for (let lineIdx = 0; lineIdx < MOCK_OUTPUT_LINES.length; lineIdx++) {
        if (!mounted) return;
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        if (!mounted) return;
        setLogs((prev) => ({
          ...prev,
          [step.id]: [...(prev[step.id] ?? []), MOCK_OUTPUT_LINES[lineIdx]],
        }));
        scrollToBottom(step.id);
      }

      if (!mounted) return;
      const success = Math.random() > 0.15;
      setLogs((prev) => ({
        ...prev,
        [step.id]: [...(prev[step.id] ?? []), success ? "[OK] Step completed successfully." : "[FAIL] Step failed with errors."],
      }));

      window.dispatchEvent(
        new CustomEvent("pipeline-step-done", {
          detail: { stepId: step.id, success },
        })
      );

      stepIndex++;
      if (mounted && stepIndex < pipeline.steps.length) {
        setTimeout(runStep, 500);
      }
    };

    runStep();
    return () => {
      mounted = false;
    };
  }, [pipeline.steps, scrollToBottom]);

  const completedCount = pipeline.steps.filter((s) => s.status === "completed").length;
  const failedCount = pipeline.steps.filter((s) => s.status === "failed").length;
  const progressPct = pipeline.steps.length > 0 ? ((completedCount + failedCount) / pipeline.steps.length) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white">{t("pipeline.execution_view")}</h2>
          <PipelineStatusBadge status={pipeline.status} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            {t("pipeline.cancel")}
          </button>
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            {t("pipeline.back_to_edit")}
          </button>
        </div>
      </div>

      <div className="mb-4 px-6 pt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
          <span>{completedCount + failedCount} / {pipeline.steps.length} steps</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {pipeline.steps.map((step, i) => {
          const stepLogs = logs[step.id] ?? [];
          return (
            <div key={step.id} className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-800/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                  <span className="text-sm">{TOOL_DEFINITIONS.find((td) => td.id === step.tool)?.icon}</span>
                  <span className="text-sm font-semibold text-white">{step.tool}</span>
                  <StatusIcon status={step.status} />
                </div>
                <span className={`text-xs font-medium ${
                  step.status === "completed" ? "text-emerald-400" : step.status === "failed" ? "text-red-400" : step.status === "running" ? "text-cyan-400" : "text-gray-500"
                }`}>
                  {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-black/50 p-3 font-mono text-xs leading-relaxed">
                {stepLogs.length === 0 && step.status === "pending" && (
                  <span className="text-gray-600">Waiting...</span>
                )}
                {stepLogs.map((line, li) => (
                  <div key={li} className={
                    line.includes("[FAIL]") ? "text-red-400" : line.includes("[OK]") ? "text-emerald-400" : "text-green-400"
                  }>
                    <span className="mr-1 select-none text-gray-700">&gt;</span>
                    {line}
                  </div>
                ))}
                <div ref={(el) => { logEndRefs.current[step.id] = el; }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Schedule Modal ─────────────────────────────────────────────────────────

interface ScheduleModalProps {
  onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ onClose }) => {
  const [cron, setCron] = useState("0 2 * * 1");
  const [saved, setSaved] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-bold text-white">{t("pipeline.schedule")}</h3>
        <p className="mb-4 text-sm text-gray-400">{t("pipeline.schedule_desc")}</p>

        <label className="mb-1 block text-xs font-medium text-gray-400">{t("pipeline.schedule_cron")}</label>
        <input
          type="text"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />

        <p className="mb-4 text-xs text-gray-500">
          {cron === "0 2 * * 1" && "Runs every Monday at 2:00 AM"}
          {cron === "0 0 * * *" && "Runs daily at midnight"}
          {cron === "0 */6 * * *" && "Runs every 6 hours"}
        </p>

        {saved ? (
          <p className="text-sm text-emerald-400">Schedule saved!</p>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => { setSaved(true); setTimeout(onClose, 800); }}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Save Schedule
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PipelineBuilderPage() {
  const [pipeline, dispatch] = useReducer(pipelineReducer, {
    name: "New Pipeline",
    steps: [],
    status: "draft",
  });
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"edit" | "execute">("edit");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 2500);
  }, []);

  const handleAddTool = useCallback(
    (toolDef: ToolDef) => {
      const step: PipelineStep = {
        id: uid(),
        tool: toolDef.id,
        category: toolDef.category,
        params: { ...toolDef.defaultParams },
        status: "pending",
      };
      const selIdx = selectedStepId ? pipeline.steps.findIndex((s) => s.id === selectedStepId) : undefined;
      dispatch({ type: "ADD_STEP", step, afterIndex: selIdx });
      setSelectedStepId(step.id);
    },
    [selectedStepId, pipeline.steps]
  );

  const handleSave = useCallback(async () => {
    if (pipeline.steps.length === 0) {
      toast("Add at least one step before saving.");
      return;
    }
    try {
      const res = await fetch("/api/v1/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pipeline),
      });
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: "LOAD_PIPELINE", pipeline: { ...pipeline, id: data.id } });
      }
    } catch {
      // Backend not available, mock save
    }
    toast(t("pipeline.save_success"));
  }, [pipeline, toast]);

  const handleRun = useCallback(() => {
    if (pipeline.steps.length === 0) {
      toast("Add at least one step before running.");
      return;
    }
    dispatch({ type: "SET_PIPELINE_STATUS", status: "running" });
    pipeline.steps.forEach((s) => dispatch({ type: "SET_STEP_STATUS", stepId: s.id, status: "pending" }));
    setView("execute");

    let stepIdx = 0;
    const runNext = () => {
      if (stepIdx >= pipeline.steps.length) {
        dispatch({ type: "SET_PIPELINE_STATUS", status: "completed" });
        return;
      }
      const step = pipeline.steps[stepIdx];
      dispatch({ type: "SET_STEP_STATUS", stepId: step.id, status: "running" });

      const duration = 1500 + Math.random() * 2500;
      setTimeout(() => {
        const success = Math.random() > 0.1;
        dispatch({
          type: "SET_STEP_STATUS",
          stepId: step.id,
          status: success ? "completed" : "failed",
          output: success ? "Step completed successfully." : "Step failed.",
        });
        stepIdx++;
        if (success && stepIdx < pipeline.steps.length) {
          setTimeout(runNext, 300);
        } else if (!success) {
          dispatch({ type: "SET_PIPELINE_STATUS", status: "failed" });
        } else {
          dispatch({ type: "SET_PIPELINE_STATUS", status: "completed" });
        }
      }, duration);
    };
    setTimeout(runNext, 500);
    toast(t("pipeline.run_started"));
  }, [pipeline, toast]);

  const handleInsertAfter = useCallback(
    (afterIndex: number) => {
      setSelectedStepId(null);
      void afterIndex;
    },
    []
  );

  const selectedStep = pipeline.steps.find((s) => s.id === selectedStepId);

  if (view === "execute") {
    return (
      <div className="flex h-screen flex-col bg-gray-950 text-white">
        <ExecutionView
          pipeline={pipeline}
          onCancel={() => {
            dispatch({ type: "SET_PIPELINE_STATUS", status: "draft" });
            setView("edit");
          }}
          onBack={() => setView("edit")}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      {/* Toast */}
      {showToast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-emerald-600/25 transition-all">
          {showToast}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{t("pipeline.title")}</h1>
          <p className="text-sm text-gray-500">{t("pipeline.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <PipelineStatusBadge status={pipeline.status} />
          <span className="text-xs text-gray-500">
            {pipeline.steps.length} step{pipeline.steps.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tool Palette */}
        <aside className="w-72 shrink-0 border-r border-gray-800 overflow-hidden">
          <ToolPalette searchQuery={searchQuery} onSearchChange={setSearchQuery} onAddTool={handleAddTool} />
        </aside>

        {/* Right Panel - Canvas + Config */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <main className="flex-1 overflow-y-auto">
            {pipeline.steps.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-gray-900/50">
                  <svg className="h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="mb-2 text-sm font-medium text-gray-400">{t("pipeline.no_steps")}</p>
                <p className="text-xs text-gray-600">Or click a tool in the palette to get started</p>
              </div>
            ) : (
              <div className="flex flex-col items-center p-8">
                {/* Start node */}
                <div className="mb-1 flex items-center gap-2">
                  <div className="h-4 w-px bg-gray-700" />
                  <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <div className="h-4 w-px bg-gray-700" />
                </div>
                <div className="mb-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  START
                </div>

                {pipeline.steps.map((step, i) => (
                  <StepNode
                    key={step.id}
                    step={step}
                    index={i}
                    total={pipeline.steps.length}
                    isSelected={step.id === selectedStepId}
                    isRunning={step.status === "running"}
                    onSelect={() => setSelectedStepId(step.id === selectedStepId ? null : step.id)}
                    onRemove={() => {
                      dispatch({ type: "REMOVE_STEP", stepId: step.id });
                      if (step.id === selectedStepId) setSelectedStepId(null);
                    }}
                    onMoveUp={() => dispatch({ type: "MOVE_STEP", stepId: step.id, direction: "up" })}
                    onMoveDown={() => dispatch({ type: "MOVE_STEP", stepId: step.id, direction: "down" })}
                    onInsertAfter={() => handleInsertAfter(i)}
                  />
                ))}

                <div className="my-2 flex flex-col items-center">
                  <div className="h-4 w-px bg-gray-700" />
                  <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <div className="h-4 w-px bg-gray-700" />
                </div>
                <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
                  END
                </div>
              </div>
            )}
          </main>

          {/* Config Sidebar */}
          {selectedStep && (
            <aside className="w-80 shrink-0 border-l border-gray-800 overflow-y-auto p-4">
              <StepConfigPanel
                step={selectedStep}
                onUpdate={(params) => dispatch({ type: "UPDATE_STEP_PARAMS", stepId: selectedStep.id, params })}
                onClose={() => setSelectedStepId(null)}
              />
            </aside>
          )}
        </div>
      </div>

      {/* Bottom Panel */}
      <footer className="border-t border-gray-800 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <input
              type="text"
              value={pipeline.name}
              onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
              placeholder={t("pipeline.name_placeholder")}
              className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("pipeline.estimated_duration")}: <strong className="text-gray-300">{estimateDuration(pipeline.steps)}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSchedule(true)}
              disabled={pipeline.steps.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t("pipeline.schedule")}
            </button>

            <button
              onClick={handleSave}
              disabled={pipeline.steps.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {t("pipeline.save")}
            </button>

            <button
              onClick={handleRun}
              disabled={pipeline.steps.length === 0 || pipeline.status === "running"}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {t("pipeline.run")}
            </button>
          </div>
        </div>
      </footer>

      {/* Schedule Modal */}
      {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} />}
    </div>
  );
}
