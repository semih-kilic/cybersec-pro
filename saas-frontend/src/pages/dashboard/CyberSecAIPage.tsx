/**
 * 🛡️ CyberSec Pro AI — Autonomous Pentesting
 *
 * V20 "Onyx" rewrite using Vision OS + SOC primitives.
 * Same business logic & data hooks as before — pure visual rebuild.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Plus,
  X,
  Loader2,
  ShieldCheck,
  Activity,
  Search,
  Bug,
  Wrench,
  AlertTriangle,
  Sparkles,
  Trash2,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  PageHeader,
  StatusPill,
  Section,
  DenseTable,
  DenseTableHead,
  DenseTH,
  DenseTR,
  DenseTD,
  KeyValueGrid,
  type Severity,
} from '../../components/vos';
import { StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useCyberSecAIJobs,
  useCreateCyberSecAIJob,
  useCyberSecAIJob,
  useCancelCyberSecAIJob,
  useDeleteCyberSecAIJob,
} from '../../hooks/useApiQueries';

type Job = {
  id: string;
  target: string;
  job_type: string;
  status: string;
  findings_count: number;
  poc_verified_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
};

const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  queued: 'warning',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelling: 'warning',
  cancelled: 'neutral',
};

export default function CyberSecAIPage() {
  const { data, isLoading } = useCyberSecAIJobs();
  const createJob = useCreateCyberSecAIJob();
  const deleteJob = useDeleteCyberSecAIJob();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    target: '',
    target_type: 'url',
    job_type: 'autonomous_pentest',
    agents: { recon: true, vuln_scan: true, exploit_verify: true, auto_fix: false },
  });
  const [formErr, setFormErr] = useState('');

  const jobs: Job[] =
    ((data as { cybersec_ai_jobs?: Job[] }) ?? {})?.cybersec_ai_jobs ?? [];

  const totalFindings = jobs.reduce((a, j) => a + j.findings_count, 0);
  const totalVerified = jobs.reduce((a, j) => a + j.poc_verified_count, 0);
  const running = jobs.filter((j) => j.status === 'running').length;

  const handleCreate = async () => {
    setFormErr('');
    if (!form.target.trim()) {
      setFormErr('Target URL or repository required');
      return;
    }
    try {
      await createJob.mutateAsync({
        target: form.target.trim(),
        target_type: form.target_type,
        job_type: form.job_type,
        agents_config: form.agents,
      });
      setShowForm(false);
      setForm({
        target: '',
        target_type: 'url',
        job_type: 'autonomous_pentest',
        agents: { recon: true, vuln_scan: true, exploit_verify: true, auto_fix: false },
      });
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Failed to create job');
    }
  };

  return (
    <div className="p-vos-8 space-y-vos-8 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Autonomous"
        icon={<Bot size={22} />}
        title="CyberSec Pro AI"
        description="Autonomous AI-powered penetration testing, vulnerability discovery, and proof-of-concept verification across your attack surface."
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New AI pentest job
          </button>
        }
      />

      {/* What is this? — explainer */}
      <div className="rounded-vos-xl border border-vos-border-1 bg-gradient-to-br from-vos-bg-elev-1 to-vos-bg-elev-2 p-vos-6">
        <div className="flex items-start gap-vos-4">
          <span className="size-10 shrink-0 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent">
            <Info size={18} />
          </span>
          <div className="space-y-vos-3">
            <div>
              <h3 className="text-vos-md font-semibold text-vos-text">What does CyberSec Pro AI do?</h3>
              <p className="text-vos-sm text-vos-text-2 mt-1 leading-relaxed">
                Point it at a URL, IP, or Git repository and a fleet of LLM-driven agents will
                <strong className="text-vos-text"> reconnoiter, fingerprint, attack, and verify </strong>
                vulnerabilities for you — then return a prioritised report with reproducible proof-of-concepts.
                Powered by the open-source <a href="https://github.com/usestrix/strix" target="_blank" rel="noopener noreferrer" className="text-vos-accent hover:underline inline-flex items-center gap-0.5">Strix engine <ExternalLink size={11} /></a>,
                hardened with our own scanners and LLM safeguards.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-vos-3 text-vos-xs">
              <div className="rounded-vos-md border border-vos-border-1 bg-vos-bg-1/40 p-vos-3">
                <div className="flex items-center gap-1.5 text-vos-accent font-semibold mb-1"><Search size={12}/> 1. Recon</div>
                <p className="text-vos-text-3 leading-snug">Crawls the target, maps endpoints, fingerprints stacks, finds exposed assets.</p>
              </div>
              <div className="rounded-vos-md border border-vos-border-1 bg-vos-bg-1/40 p-vos-3">
                <div className="flex items-center gap-1.5 text-vos-warning font-semibold mb-1"><Bug size={12}/> 2. Discover &amp; Exploit</div>
                <p className="text-vos-text-3 leading-snug">Runs OWASP-aligned attacks (SQLi, XSS, SSRF, IDOR, auth flaws…) and chains primitives.</p>
              </div>
              <div className="rounded-vos-md border border-vos-border-1 bg-vos-bg-1/40 p-vos-3">
                <div className="flex items-center gap-1.5 text-vos-success font-semibold mb-1"><ShieldCheck size={12}/> 3. Verify</div>
                <p className="text-vos-text-3 leading-snug">Reproduces each finding end-to-end so you only see exploitable, non-false-positive issues.</p>
              </div>
            </div>
            <p className="text-vos-xs text-vos-text-3">
              <AlertTriangle size={11} className="inline mr-1 -mt-0.5 text-vos-warning" />
              Only test systems you are authorised to test. All actions are logged and attributable to your account.
            </p>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-4">
        <StatCard
          title="Total Jobs"
          value={jobs.length}
          icon={<Sparkles size={16} />}
          variant="cyan"
        />
        <StatCard
          title="Active Now"
          value={running}
          icon={<Activity size={16} />}
          variant="cyan"
        />
        <StatCard
          title="Findings"
          value={totalFindings}
          icon={<Bug size={16} />}
          variant="amber"
        />
        <StatCard
          title="PoC Verified"
          value={totalVerified}
          icon={<ShieldCheck size={16} />}
          variant="red"
        />
      </div>

      {/* Jobs */}
      <Section
        title="Pentest Jobs"
        description="Click any row to inspect agent output and verified PoCs."
        bodyClassName="p-0"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-vos-12 text-vos-text-3">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-vos-8">
            <EmptyState
              title="No jobs yet"
              description="Launch your first autonomous pentest to discover vulnerabilities automatically."
            />
          </div>
        ) : (
          <DenseTable className="border-0 rounded-none">
            <DenseTableHead>
              <DenseTH>Status</DenseTH>
              <DenseTH>Target</DenseTH>
              <DenseTH>Type</DenseTH>
              <DenseTH className="text-right">Findings</DenseTH>
              <DenseTH className="text-right">Verified</DenseTH>
              <DenseTH>Created</DenseTH>
              <DenseTH className="text-right">Actions</DenseTH>
            </DenseTableHead>
            <tbody>
              {jobs.map((job) => (
                <>
                  <DenseTR
                    key={job.id}
                    onClick={() =>
                      setSelectedJobId(selectedJobId === job.id ? null : job.id)
                    }
                    highlighted={selectedJobId === job.id}
                  >
                    <DenseTD>
                      <StatusPill
                        tone={STATUS_TONE[job.status] ?? 'neutral'}
                        pulse={job.status === 'running'}
                      >
                        {job.status}
                      </StatusPill>
                    </DenseTD>
                    <DenseTD className="text-vos-text font-medium">
                      {job.target}
                    </DenseTD>
                    <DenseTD className="capitalize">
                      {job.job_type.replace(/_/g, ' ')}
                    </DenseTD>
                    <DenseTD className="text-right tabular-nums">
                      {job.findings_count > 0 ? (
                        <span className="text-vos-warning font-semibold">
                          {job.findings_count}
                        </span>
                      ) : (
                        <span className="text-vos-text-3">0</span>
                      )}
                    </DenseTD>
                    <DenseTD className="text-right tabular-nums">
                      {job.poc_verified_count > 0 ? (
                        <span className="text-vos-danger font-semibold">
                          {job.poc_verified_count}
                        </span>
                      ) : (
                        <span className="text-vos-text-3">0</span>
                      )}
                    </DenseTD>
                    <DenseTD className="text-vos-text-3 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleString()}
                    </DenseTD>
                    <DenseTD className="text-right" onClick={(e) => e.stopPropagation()}>
                      {['completed', 'failed', 'cancelled'].includes(job.status) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this job and its findings? This cannot be undone.')) {
                              deleteJob.mutate(job.id);
                              if (selectedJobId === job.id) setSelectedJobId(null);
                            }
                          }}
                          disabled={deleteJob.isPending}
                          aria-label="Delete job"
                          className="inline-flex items-center justify-center size-7 rounded-vos-sm text-vos-text-3 hover:text-vos-danger hover:bg-vos-danger/10 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-vos-text-3 text-vos-xs">—</span>
                      )}
                    </DenseTD>
                  </DenseTR>
                  {selectedJobId === job.id && (
                    <tr className="border-t border-vos-border-1 bg-vos-bg-elev-1/30">
                      <td colSpan={7} className="px-vos-6 py-vos-5">
                        <JobDetail jobId={job.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </DenseTable>
        )}
      </Section>

      {/* New job modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-md z-vos-modal flex items-center justify-center p-vos-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-vos-bg-elev-2 border border-vos-border-1 rounded-vos-2xl shadow-vos-4 w-full max-w-lg overflow-hidden"
            >
              <header className="flex items-center justify-between px-vos-6 py-vos-4 border-b border-vos-border-1">
                <div className="flex items-center gap-vos-3">
                  <span className="size-9 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent">
                    <Bot size={18} />
                  </span>
                  <h2 className="text-vos-md font-semibold text-vos-text">
                    New AI Pentest Job
                  </h2>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="size-8 rounded-vos-md hover:bg-vos-bg-elev-3 text-vos-text-3 hover:text-vos-text flex items-center justify-center"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="px-vos-6 py-vos-5 space-y-vos-5">
                <Field label="Target *">
                  <Input
                    value={form.target}
                    onChange={(v) => setForm((f) => ({ ...f, target: v }))}
                    placeholder="https://example.com or github.com/owner/repo"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-vos-4">
                  <Field label="Target Type">
                    <Select
                      value={form.target_type}
                      onChange={(v) => setForm((f) => ({ ...f, target_type: v }))}
                      options={[
                        ['url', 'Web URL'],
                        ['repository', 'Git Repository'],
                        ['api', 'REST API'],
                        ['ip', 'IP / Network'],
                      ]}
                    />
                  </Field>
                  <Field label="Job Type">
                    <Select
                      value={form.job_type}
                      onChange={(v) => setForm((f) => ({ ...f, job_type: v }))}
                      options={[
                        ['autonomous_pentest', 'Autonomous Pentest'],
                        ['vuln_scan', 'Vulnerability Scan'],
                        ['code_review', 'Code Review'],
                        ['api_audit', 'API Security Audit'],
                      ]}
                    />
                  </Field>
                </div>

                <Field label="AI Agents">
                  <div className="space-y-2">
                    {[
                      { key: 'recon', label: 'Reconnaissance', desc: 'Fingerprint target, enumerate services', icon: Search },
                      { key: 'vuln_scan', label: 'Vulnerability Scanner', desc: 'Detect known CVEs and weaknesses', icon: Bug },
                      { key: 'exploit_verify', label: 'PoC Verification', desc: 'Confirm findings with safe exploits', icon: ShieldCheck },
                      { key: 'auto_fix', label: 'Auto-Fix (Beta)', desc: 'Generate remediation pull requests', icon: Wrench },
                    ].map((agent) => {
                      const checked = form.agents[agent.key as keyof typeof form.agents];
                      const Icon = agent.icon;
                      return (
                        <label
                          key={agent.key}
                          className={`flex items-start gap-vos-3 p-vos-3 rounded-vos-md border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-vos-accent/5 border-vos-accent/30'
                              : 'bg-vos-bg-elev-3 border-vos-border-1 hover:border-vos-border-2'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                agents: { ...f.agents, [agent.key]: e.target.checked },
                              }))
                            }
                            className="mt-0.5 accent-vos-accent"
                          />
                          <Icon
                            size={16}
                            className={checked ? 'text-vos-accent' : 'text-vos-text-3'}
                          />
                          <div className="min-w-0">
                            <p className="text-vos-sm font-medium text-vos-text">
                              {agent.label}
                            </p>
                            <p className="text-vos-xs text-vos-text-3 mt-0.5">
                              {agent.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </Field>

                {formErr && (
                  <div className="flex items-center gap-2 px-vos-3 py-vos-2 rounded-vos-md bg-vos-danger/10 border border-vos-danger/20 text-vos-danger text-vos-xs">
                    <AlertTriangle size={14} />
                    {formErr}
                  </div>
                )}
              </div>

              <footer className="flex gap-vos-3 px-vos-6 py-vos-4 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-vos-4 h-9 rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-2 text-vos-text-2 text-vos-sm font-medium hover:border-vos-border-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createJob.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {createJob.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Queuing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Launch Job
                    </>
                  )}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── Job detail panel (inline expand) ───────── */

type CyberSecAIJobDetail = {
  id: string;
  target: string;
  target_type: string;
  job_type: string;
  status: string;
  agents_config?: Record<string, boolean>;
  results?: unknown;
  findings_count: number;
  poc_verified_count: number;
  started_at?: string;
  completed_at?: string;
};

type AIStep = { agent: string; status: string; output?: string; finding_count?: number; error?: string | null };
type AIFinding = { agent?: string; severity?: string; title?: string; evidence?: string; target?: string; verified?: boolean };
type AIResults = { steps?: AIStep[]; findings?: AIFinding[]; summary?: { agents_completed?: number; agents_total?: number }; error?: string };

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = {
  critical: 'danger', high: 'danger', medium: 'warning', low: 'info', info: 'neutral'
};

function JobDetail({ jobId }: { jobId: string }) {
  const { data: rawData, isLoading } = useCyberSecAIJob(jobId);
  const cancelJob = useCancelCyberSecAIJob();
  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-vos-text-3 text-vos-sm">
        <Loader2 size={14} className="animate-spin" /> Loading details…
      </div>
    );
  if (!rawData) return null;
  const data = rawData as CyberSecAIJobDetail;
  const results = (data.results as AIResults | null | undefined) ?? undefined;
  const isActive = data.status === 'queued' || data.status === 'running' || data.status === 'cancelling';

  return (
    <div className="space-y-vos-4">
      <div className="flex items-center justify-between gap-vos-3">
        <KeyValueGrid
          cols={4}
          items={[
            { label: 'Target Type', value: data.target_type },
            { label: 'Job Type', value: data.job_type.replace(/_/g, ' ') },
            { label: 'Findings', value: data.findings_count },
            { label: 'PoC Verified', value: data.poc_verified_count },
          ]}
        />
        {isActive && (
          <button
            onClick={() => cancelJob.mutate(data.id)}
            disabled={cancelJob.isPending || data.status === 'cancelling'}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-vos-md bg-vos-danger/10 text-vos-danger border border-vos-danger/30 text-vos-xs font-medium hover:bg-vos-danger/20 transition-colors disabled:opacity-50"
          >
            {cancelJob.isPending || data.status === 'cancelling' ? (
              <><Loader2 size={12} className="animate-spin" /> Cancelling…</>
            ) : (
              <>Stop job</>
            )}
          </button>
        )}
      </div>

      {data.agents_config && (
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
            Active Agents
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.agents_config)
              .filter(([, v]) => v)
              .map(([k]) => (
                <span
                  key={k}
                  className="inline-flex items-center px-2 h-6 rounded-vos-sm bg-vos-accent/10 text-vos-accent text-[11px] font-medium border border-vos-accent/20"
                >
                  {k.replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        </div>
      )}

      {results?.steps && results.steps.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
            Agent Pipeline
          </p>
          <div className="space-y-1.5">
            {results.steps.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-vos-3 h-9 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-vos-sm font-medium text-vos-text capitalize">{s.agent.replace(/_/g, ' ')}</span>
                  {typeof s.finding_count === 'number' && s.finding_count > 0 && (
                    <span className="text-vos-xs text-vos-text-3">· {s.finding_count} finding{s.finding_count === 1 ? '' : 's'}</span>
                  )}
                </div>
                <StatusPill
                  tone={s.status === 'done' ? 'success' : s.status === 'error' ? 'danger' : 'warning'}
                  pulse={s.status === 'running'}
                  label={s.status}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {results?.findings && results.findings.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
            Findings ({results.findings.length})
          </p>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {results.findings.slice(0, 100).map((f, i) => (
              <div key={i} className="flex items-start gap-2 p-vos-3 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1">
                <StatusPill tone={SEVERITY_TONE[(f.severity || 'info').toLowerCase()] || 'neutral'} label={f.severity || 'info'} />
                <div className="min-w-0 flex-1">
                  <div className="text-vos-sm font-medium text-vos-text truncate">{f.title || 'Finding'}</div>
                  {f.evidence && <div className="text-vos-xs text-vos-text-3 font-vos-mono truncate">{f.evidence}</div>}
                </div>
                {f.verified && (
                  <span className="text-vos-xs text-vos-success">verified</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results?.error && (
        <div className="p-vos-3 rounded-vos-md bg-vos-danger/10 border border-vos-danger/30 text-vos-xs text-vos-danger">
          {results.error}
        </div>
      )}

      {isActive && (
        <div className="flex items-center gap-2 text-vos-accent text-vos-xs">
          <Loader2 size={12} className="animate-spin" /> Job is {data.status}… auto-refreshing
        </div>
      )}
    </div>
  );
}

/* ───────── Form primitives (local) ───────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-sm text-vos-text focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

// silence unused Severity import in case heatmap added later
export type _ = Severity;
