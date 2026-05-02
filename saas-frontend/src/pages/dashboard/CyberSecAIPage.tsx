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
};

export default function CyberSecAIPage() {
  const { data, isLoading } = useCyberSecAIJobs();
  const createJob = useCreateCyberSecAIJob();
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
                  </DenseTR>
                  {selectedJobId === job.id && (
                    <tr className="border-t border-vos-border-1 bg-vos-bg-elev-1/30">
                      <td colSpan={6} className="px-vos-6 py-vos-5">
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

function JobDetail({ jobId }: { jobId: string }) {
  const { data: rawData, isLoading } = useCyberSecAIJob(jobId);
  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-vos-text-3 text-vos-sm">
        <Loader2 size={14} className="animate-spin" /> Loading details…
      </div>
    );
  if (!rawData) return null;
  const data = rawData as CyberSecAIJobDetail;

  return (
    <div className="space-y-vos-4">
      <KeyValueGrid
        cols={4}
        items={[
          { label: 'Target Type', value: data.target_type },
          { label: 'Job Type', value: data.job_type.replace(/_/g, ' ') },
          { label: 'Findings', value: data.findings_count },
          { label: 'PoC Verified', value: data.poc_verified_count },
        ]}
      />

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

      {data.results !== undefined && data.results !== null && (
        <div>
          <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
            Results
          </p>
          <pre className="bg-vos-bg-elev-1 rounded-vos-md p-vos-3 text-[11px] text-vos-text-2 overflow-x-auto max-h-64 font-vos-mono border border-vos-border-1">
            {JSON.stringify(data.results as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      )}

      {(data.status === 'queued' || data.status === 'running') && (
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
