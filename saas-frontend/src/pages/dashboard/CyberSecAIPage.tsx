/**
 * CyberSec Pro AI — Autonomous Pentesting Page
 * Phase 6 — AI-powered vulnerability discovery and verification
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCyberSecAIJobs, useCreateCyberSecAIJob, useCyberSecAIJob } from '../../hooks/useApiQueries';

const STATUS_COLORS: Record<string, string> = {
  queued:    'bg-yellow-500/20 text-yellow-400',
  running:   'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed:    'bg-red-500/20 text-red-400',
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

  const jobs: Array<{
    id: string; target: string; job_type: string; status: string;
    findings_count: number; poc_verified_count: number;
    started_at?: string; completed_at?: string; created_at: string;
  }> = ((data as { cybersec_ai_jobs?: Array<{ id: string; target: string; job_type: string; status: string; findings_count: number; poc_verified_count: number; started_at?: string; completed_at?: string; created_at: string }> }) ?? {})?.cybersec_ai_jobs ?? [];

  const handleCreate = async () => {
    setFormErr('');
    if (!form.target.trim()) { setFormErr('Target URL or repository required'); return; }
    try {
      await createJob.mutateAsync({
        target: form.target.trim(),
        target_type: form.target_type,
        job_type: form.job_type,
        agents_config: form.agents,
      });
      setShowForm(false);
      setForm({ target: '', target_type: 'url', job_type: 'autonomous_pentest', agents: { recon: true, vuln_scan: true, exploit_verify: true, auto_fix: false } });
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Failed to create job');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">�</span> CyberSec Pro AI
          </h1>
          <p className="text-gray-400 text-sm mt-1">Autonomous AI-powered penetration testing, vulnerability discovery & PoC verification</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium"
        >
          + New AI Pentest Job
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'text-cyan-400' },
          { label: 'Running', value: jobs.filter(j => j.status === 'running').length, color: 'text-blue-400' },
          { label: 'Findings', value: jobs.reduce((a, j) => a + j.findings_count, 0), color: 'text-yellow-400' },
          { label: 'PoC Verified', value: jobs.reduce((a, j) => a + j.poc_verified_count, 0), color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* New job modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg space-y-4"
            >
              <h2 className="text-xl font-bold text-white">🤖 New CyberSec Pro AI Job</h2>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Target *</label>
                <input
                  type="text"
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  placeholder="https://example.com or github.com/owner/repo"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Target Type</label>
                  <select
                    value={form.target_type}
                    onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="url">Web URL</option>
                    <option value="repository">Git Repository</option>
                    <option value="api">REST API</option>
                    <option value="ip">IP / Network</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Job Type</label>
                  <select
                    value={form.job_type}
                    onChange={e => setForm(f => ({ ...f, job_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="autonomous_pentest">Autonomous Pentest</option>
                    <option value="vuln_scan">Vulnerability Scan</option>
                    <option value="code_review">Code Review</option>
                    <option value="api_audit">API Security Audit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">AI Agents</label>
                <div className="space-y-2">
                  {[
                    { key: 'recon', label: 'Reconnaissance', desc: 'Fingerprint target, enumerate services' },
                    { key: 'vuln_scan', label: 'Vulnerability Scanner', desc: 'Detect known CVEs and weaknesses' },
                    { key: 'exploit_verify', label: 'PoC Verification', desc: 'Confirm findings with safe exploits' },
                    { key: 'auto_fix', label: 'Auto-Fix (Beta)', desc: 'Generate remediation pull requests' },
                  ].map(agent => (
                    <label key={agent.key} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.agents[agent.key as keyof typeof form.agents]}
                        onChange={e => setForm(f => ({ ...f, agents: { ...f.agents, [agent.key]: e.target.checked } }))}
                        className="mt-0.5 accent-cyan-500"
                      />
                      <div>
                        <span className="text-white text-sm font-medium">{agent.label}</span>
                        <span className="block text-gray-500 text-xs">{agent.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {formErr && <p className="text-red-400 text-sm">{formErr}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={createJob.isPending}
                  className="flex-1 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 font-medium"
                >
                  {createJob.isPending ? '⏳ Queuing…' : '🚀 Launch Job'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setFormErr(''); }}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jobs list */}
      <div className="space-y-3">
        {isLoading && <div className="text-gray-500 text-sm">Loading jobs…</div>}
        {!isLoading && jobs.length === 0 && (
          <div className="p-8 bg-gray-800 rounded-xl border border-gray-700 text-center">
            <div className="text-4xl mb-3">🦅</div>
            <p className="text-white font-medium">No CyberSec Pro AI jobs yet</p>
            <p className="text-gray-400 text-sm mt-1">Launch your first autonomous pentest to discover vulnerabilities automatically.</p>
          </div>
        )}
        {jobs.map(job => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition cursor-pointer"
            onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-700 text-gray-400'}`}>
                  {job.status === 'running' ? '⚡ ' : ''}{job.status}
                </span>
                <div>
                  <p className="text-white font-medium text-sm">{job.target}</p>
                  <p className="text-gray-500 text-xs">{job.job_type.replace(/_/g, ' ')} · {new Date(job.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">{job.findings_count}</div>
                  <div className="text-gray-500 text-xs">Findings</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold">{job.poc_verified_count}</div>
                  <div className="text-gray-500 text-xs">PoC Verified</div>
                </div>
              </div>
            </div>
            {selectedJobId === job.id && <JobDetail jobId={job.id} />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

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
  if (isLoading) return <div className="mt-4 text-gray-500 text-sm">Loading details…</div>;
  if (!rawData) return null;
  const data = rawData as CyberSecAIJobDetail;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-gray-700 space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Target Type:</span> <span className="text-gray-300 ml-2">{data.target_type}</span></div>
        <div><span className="text-gray-500">Status:</span> <span className="text-gray-300 ml-2">{data.status}</span></div>
      </div>
      {data.agents_config && (
        <div>
          <p className="text-gray-500 text-xs mb-2">Active Agents:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.agents_config)
              .filter(([, v]) => v)
              .map(([k]) => (
                <span key={k} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">{k.replace(/_/g, ' ')}</span>
              ))}
          </div>
        </div>
      )}
      {data.results !== undefined && data.results !== null && (
        <div>
          <p className="text-gray-500 text-xs mb-2">Results:</p>
          <pre className="bg-gray-900 rounded-lg p-3 text-xs text-green-400 overflow-x-auto max-h-48">
            {JSON.stringify(data.results as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      )}
      {(data.status === 'queued' || data.status === 'running') && (
        <div className="flex items-center gap-2 text-blue-400 text-sm">
          <span className="animate-spin">⚙</span> Job is {data.status}… auto-refreshing
        </div>
      )}
    </motion.div>
  );
}
