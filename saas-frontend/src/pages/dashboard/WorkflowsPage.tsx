import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/Toast';

// A curated "playbook": several tools run one after another on a single target.
type WorkflowStep = { tool: string; label: string; params: Record<string, unknown> };
type Workflow = {
  id: string; name: string; description: string; category: string;
  icon: string; danger: string; target_types: string[]; steps: WorkflowStep[];
};
type StepState = WorkflowStep & { status: 'pending' | 'running' | 'done' | 'failed'; output: string; scanId?: string };

const DANGER_STYLE: Record<string, string> = {
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
};
const STATUS_ICON: Record<string, string> = { pending: '○', running: '◌', done: '✅', failed: '❌' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [target, setTarget] = useState('');
  const [authzStatement, setAuthzStatement] = useState('');
  const [authzConfirmed, setAuthzConfirmed] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [running, setRunning] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(null);

  useEffect(() => {
    api.listWorkflows().then((res) => {
      if (res.data?.workflows) setWorkflows(res.data.workflows);
      setLoading(false);
    });
  }, []);

  // Load the canonical authorization statement whenever the target changes.
  useEffect(() => {
    setAuthzConfirmed(false);
    setAuthzStatement('');
    const t = target.trim();
    if (!t) return;
    let cancelled = false;
    const jwt = localStorage.getItem('token') || '';
    fetch('/api/v1/authorizations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ target: t }),
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAuthzStatement(d.scope_statement || ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [target]);

  const grouped = useMemo(() => {
    const m: Record<string, Workflow[]> = {};
    for (const w of workflows) (m[w.category] ||= []).push(w);
    return m;
  }, [workflows]);

  function pick(wf: Workflow) {
    if (running) return;
    setSelected(wf);
    setSteps(wf.steps.map((s) => ({ ...s, status: 'pending', output: '' })));
    setOpenStep(null);
  }

  function patchStep(i: number, patch: Partial<StepState>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function run() {
    if (!selected) return;
    const t = target.trim();
    if (!t) { toast.warning('Target Required', 'Enter a target for this workflow.'); return; }
    if (!authzConfirmed) { toast.warning('Confirmation Required', 'Confirm ownership/authorization first.'); return; }
    setRunning(true);
    setSteps(selected.steps.map((s) => ({ ...s, status: 'pending', output: '' })));
    for (let i = 0; i < selected.steps.length; i++) {
      const step = selected.steps[i];
      patchStep(i, { status: 'running', output: '' });
      setOpenStep(i);
      const res = await api.executeScan(step.tool, t, step.params, undefined, 'local', { confirmed: true, scope_statement: authzStatement });
      if (res.error || !res.data) {
        patchStep(i, { status: 'failed', output: res.error || 'Failed to start' });
        continue;
      }
      const scanId = res.data.scan_id || (res.data as { scan?: { id?: string } }).scan?.id;
      if (!scanId) { patchStep(i, { status: 'failed', output: 'No scan id returned' }); continue; }
      patchStep(i, { scanId });
      // Poll for completion (up to ~5 min per step).
      let final: string = 'running';
      for (let p = 0; p < 120; p++) {
        await sleep(2500);
        const sr = await api.getScan(scanId);
        const sc = (sr.data as { scan?: { status?: string; output?: string } } | undefined)?.scan;
        if (sc) {
          patchStep(i, { output: sc.output || '' });
          if (['completed', 'failed', 'cancelled', 'timeout'].includes(sc.status || '')) { final = sc.status || 'failed'; break; }
        }
      }
      patchStep(i, { status: final === 'completed' ? 'done' : 'failed' });
    }
    setRunning(false);
    toast.success('Workflow Complete', `${selected.name} finished.`);
  }

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const progress = steps.length ? Math.round(((steps.filter((s) => s.status === 'done' || s.status === 'failed').length) / steps.length) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">⚡ İş Akışları (Workflows)</h1>
        <p className="text-gray-500 text-sm mt-1">Tek tıkla, birden fazla aracı sırayla aynı hedefte çalıştıran hazır denetim şablonları.</p>
      </div>

      {loading ? (
        <div className="text-gray-500">Yükleniyor…</div>
      ) : !selected ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((wf) => (
                  <button key={wf.id} onClick={() => pick(wf)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-kali-blue transition group">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{wf.icon}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${DANGER_STYLE[wf.danger] || DANGER_STYLE.low}`}>{wf.danger}</span>
                    </div>
                    <h3 className="text-white font-semibold group-hover:text-kali-blue transition">{wf.name}</h3>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">{wf.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {wf.steps.map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">{s.tool}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <button onClick={() => { if (!running) { setSelected(null); setSteps([]); } }} disabled={running}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-40">← Tüm iş akışları</button>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{selected.icon}</span>
              <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
            </div>
            <p className="text-gray-500 text-sm mb-4">{selected.description}</p>

            <label className="block text-xs text-gray-400 mb-1">🎯 Hedef <span className="text-red-400">*</span></label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} disabled={running}
              placeholder="örn. example.com, https://app.example.com, 192.168.1.10"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition disabled:opacity-50" />

            <label className={`mt-3 flex items-start gap-2 p-3 rounded-lg border transition ${authzConfirmed ? 'bg-green-500/5 border-green-500/25' : 'bg-yellow-500/5 border-yellow-600/25'}`}>
              <input type="checkbox" checked={authzConfirmed} disabled={running || !authzStatement}
                onChange={(e) => setAuthzConfirmed(e.target.checked)} className="mt-1" />
              <span className="text-[11px] text-gray-400 leading-relaxed">
                {authzStatement || (target.trim() ? 'Yetki kapsamı yükleniyor…' : 'Hedef girince yetki kapsamı yüklenir.')}
              </span>
            </label>

            <button onClick={run} disabled={running || !target.trim() || !authzConfirmed}
              className="mt-4 w-full py-3 rounded-lg bg-kali-blue text-white font-semibold hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
              {running ? `Çalışıyor… (${doneCount}/${selected.steps.length})` : `▶ İş Akışını Başlat (${selected.steps.length} adım)`}
            </button>
          </div>

          {steps.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {running && (
                <div className="h-1 bg-gray-800"><div className="h-full bg-kali-blue transition-all" style={{ width: `${progress}%` }} /></div>
              )}
              {steps.map((s, i) => (
                <div key={i} className="border-b border-gray-800 last:border-0">
                  <button onClick={() => setOpenStep(openStep === i ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition text-left">
                    <span className={`text-lg ${s.status === 'running' ? 'animate-spin' : ''}`}>{STATUS_ICON[s.status]}</span>
                    <span className="font-mono text-sm text-gray-300">{s.tool}</span>
                    <span className="text-xs text-gray-500 flex-1">{s.label}</span>
                    {s.scanId && <span className="text-[10px] text-gray-600">#{s.scanId.slice(0, 8)}</span>}
                  </button>
                  {openStep === i && (
                    <pre className="px-4 pb-3 text-[11px] text-gray-400 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto bg-black/30">
                      {s.output || (s.status === 'running' ? 'Çalışıyor…' : 'Çıktı yok.')}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
