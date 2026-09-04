import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/Toast';

// Shown on a completed/failed scan. Two jobs:
//  1. "Re-scan" — re-run the same tool+target+parameters, tagging the new scan
//     with parameters._rescan_of so it can later be diffed against this one.
//     The run itself goes through the normal, fully-guarded start_scan path.
//  2. Verification — when THIS scan is itself a re-scan, fetch the backend diff
//     and show which findings are fixed / still present / newly appeared.

type Diff = {
  baseline_scan_id: string;
  baseline_at?: string;
  current_at?: string;
  target: string;
  tool_name: string;
  fixed: string[];
  still_present: string[];
  new_findings: string[];
  counts: { fixed: number; still_present: number; new: number; baseline_total: number; current_total: number };
};

type LoadedScan = {
  tool_id?: string;
  tool_name?: string;
  target?: string;
  parameters?: Record<string, unknown>;
  is_rescan?: boolean;
  status?: string;
};

// Internal keys that must never be re-sent as scan parameters.
const INTERNAL_PARAM_KEYS = ['_scan_engine', '_rescan_of', 'sweep_id', 'kind'];

export default function RescanVerification({ scanId, status }: { scanId: string; status: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [scan, setScan] = useState<LoadedScan | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [authzStatement, setAuthzStatement] = useState('');
  const [authzLoading, setAuthzLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const terminal = status === 'completed' || status === 'failed';

  useEffect(() => {
    if (!scanId || !terminal) return;
    let cancelled = false;
    api.getScan(scanId).then((res) => {
      if (cancelled) return;
      const s = (res.data as { scan?: LoadedScan } | undefined)?.scan;
      if (!s) return;
      setScan(s);
      if (s.is_rescan) {
        setDiffLoading(true);
        api.getScanDiff(scanId).then((dr) => {
          if (cancelled) return;
          if (dr.data) setDiff(dr.data as Diff);
          setDiffLoading(false);
        });
      }
    });
    return () => { cancelled = true; };
  }, [scanId, terminal]);

  function openConfirm() {
    setShowConfirm(true);
    const t = (scan?.target || '').trim();
    if (!t) return;
    setAuthzLoading(true);
    const jwt = localStorage.getItem('token') || '';
    fetch('/api/v1/authorizations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ target: t }),
    })
      .then((r) => r.json())
      .then((d) => setAuthzStatement(d.scope_statement || ''))
      .catch(() => {})
      .finally(() => setAuthzLoading(false));
  }

  async function runRescan() {
    if (!scan) return;
    const tool = scan.tool_id || scan.tool_name;
    const target = (scan.target || '').trim();
    if (!tool || !target) { toast.error('Re-scan failed', 'Original scan is missing tool or target.'); return; }
    if (!authzStatement) { toast.warning('Please wait', 'Authorization scope is still loading.'); return; }
    // Reuse the original parameters minus internal bookkeeping keys, then link
    // the new run back to this scan as its baseline.
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(scan.parameters || {})) {
      if (!INTERNAL_PARAM_KEYS.includes(k)) cleaned[k] = v;
    }
    cleaned._rescan_of = scanId;
    setStarting(true);
    const res = await api.executeScan(tool, target, cleaned, undefined, 'local', { confirmed: true, scope_statement: authzStatement });
    setStarting(false);
    const newId = res.data?.scan_id;
    if (res.error || !newId) {
      toast.error('Re-scan failed', res.error || 'Could not start the re-scan.');
      return;
    }
    toast.success('Re-scan started', 'Comparing against this scan when it finishes.');
    navigate(`/dashboard/scans/${newId}`);
  }

  if (!terminal) return null;

  return (
    <div className="mt-4 space-y-4">
      {/* Verification result (only when this scan is a re-scan) */}
      {scan?.is_rescan && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">🔁 Doğrulama (Re-scan karşılaştırması)</h3>
            {diff?.baseline_scan_id && (
              <button onClick={() => navigate(`/dashboard/scans/${diff.baseline_scan_id}`)}
                className="text-[11px] text-gray-500 hover:text-gray-300">Temel taramayı gör ↗</button>
            )}
          </div>
          {diffLoading ? (
            <div className="text-gray-500 text-sm">Karşılaştırılıyor…</div>
          ) : !diff ? (
            <div className="text-gray-500 text-sm">Karşılaştırma yüklenemedi.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Düzeldi" value={diff.counts.fixed} tone="green" />
                <Stat label="Hâlâ var" value={diff.counts.still_present} tone="amber" />
                <Stat label="Yeni" value={diff.counts.new} tone="red" />
              </div>
              <FindingList title="✅ Düzelen bulgular" items={diff.fixed} tone="green" empty="Düzelen bulgu yok." />
              <FindingList title="⚠️ Hâlâ mevcut" items={diff.still_present} tone="amber" empty="Devam eden bulgu yok." />
              <FindingList title="🆕 Yeni bulgular" items={diff.new_findings} tone="red" empty="Yeni bulgu yok." />
              <p className="text-[11px] text-gray-600 mt-3">
                Temel: {diff.baseline_at?.replace('T', ' ') || '—'} · {diff.counts.baseline_total} bulgu → Şimdi: {diff.current_at?.replace('T', ' ') || '—'} · {diff.counts.current_total} bulgu
              </p>
            </>
          )}
        </div>
      )}

      {/* Re-scan action */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {!showConfirm ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-semibold">🔁 Yeniden Tara</h3>
              <p className="text-gray-500 text-xs mt-1">Aynı araç ve hedefle tekrar çalıştır; biten tarama bu taramayla karşılaştırılır (düzelen/kalan/yeni).</p>
            </div>
            <button onClick={openConfirm}
              className="shrink-0 px-4 py-2 rounded-lg bg-kali-blue text-white text-sm font-semibold hover:bg-blue-600 transition">
              Yeniden Tara
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-white font-semibold">🔁 Yeniden taramayı onayla</h3>
            <label className="flex items-start gap-2 p-3 rounded-lg border border-yellow-600/25 bg-yellow-500/5">
              <span className="text-[11px] text-gray-400 leading-relaxed">
                {authzLoading ? 'Yetki kapsamı yükleniyor…' : (authzStatement || 'Yetki kapsamı yüklenemedi.')}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button onClick={runRescan} disabled={starting || authzLoading || !authzStatement}
                className="px-4 py-2 rounded-lg bg-kali-blue text-white text-sm font-semibold hover:bg-blue-600 transition disabled:opacity-40">
                {starting ? 'Başlatılıyor…' : 'Onayla ve Yeniden Tara'}
              </button>
              <button onClick={() => setShowConfirm(false)} disabled={starting}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm">İptal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'text-green-400 bg-green-500/10 border-green-500/20',
  amber: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONES[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function FindingList({ title, items, tone, empty }: { title: string; items: string[]; tone: string; empty: string }) {
  const color = tone === 'green' ? 'text-green-400' : tone === 'amber' ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="mb-3">
      <div className={`text-xs font-semibold mb-1 ${color}`}>{title} <span className="text-gray-600">({items.length})</span></div>
      {items.length === 0 ? (
        <div className="text-[11px] text-gray-600">{empty}</div>
      ) : (
        <ul className="space-y-0.5 max-h-40 overflow-y-auto">
          {items.map((f, i) => (
            <li key={i} className="text-[11px] text-gray-400 font-mono truncate" title={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
