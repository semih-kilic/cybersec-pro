/**
 * FoundingMemberPanel — superadmin control card for the 10-spot lifetime-deal
 * offer. Shows live spot usage and a manual open/close toggle (audit-logged).
 */
import { useCallback, useEffect, useState } from 'react';

interface FmStatus {
  flag: string;
  enabled: boolean;
  claimed: number;
  total_spots: number;
  remaining: number;
  available: boolean;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function FoundingMemberPanel() {
  const [status, setStatus] = useState<FmStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/v1/superadmin/founding-member', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { setStatus(d); setError(''); })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = () => {
    if (!status || busy) return;
    const next = !status.enabled;
    setBusy(true);
    fetch('/api/v1/superadmin/founding-member', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ enabled: next, reason: next ? 'Reopened by superadmin' : 'Closed by superadmin' }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        load();
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
            <span aria-hidden>👑</span> Founding Member Offer
          </h3>
          <p className="mt-1 text-xs text-white/50">
            10-spot lifetime deal ($19/month, first year). Auto-closes when all spots are claimed.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy || !status}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
            status?.enabled
              ? 'bg-red-500/90 text-white hover:bg-red-500'
              : 'bg-emerald-500/90 text-black hover:bg-emerald-500'
          }`}
        >
          {busy ? '...' : status?.enabled ? 'Close Offer' : 'Open Offer'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {status && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Status</div>
            <div className={`mt-0.5 text-lg font-bold ${status.available ? 'text-emerald-400' : 'text-red-400'}`}>
              {status.available ? 'Live' : 'Closed'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Admin Toggle</div>
            <div className={`mt-0.5 text-lg font-bold ${status.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
              {status.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Claimed</div>
            <div className="mt-0.5 text-lg font-bold text-white">{status.claimed} / {status.total_spots}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Remaining</div>
            <div className="mt-0.5 text-lg font-bold text-cyan-400">{status.remaining}</div>
          </div>
        </div>
      )}
    </div>
  );
}
