"use client";

import { useState } from "react";
import { Globe, Loader2, AlertTriangle, Copy } from "lucide-react";

interface DnsRecord {
  type: string;
  value: string;
  ttl?: number;
}

export default function DnsLookupTool() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    setError("");
    setRecords([]);

    try {
      const res = await fetch(`/api/v1/tools/dns-lookup?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      setError("DNS lookup failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={20} className="text-[var(--color-neon)]" />
        <h3 className="text-lg font-bold">DNS Lookup Tool</h3>
      </div>
      <p className="text-sm text-white/50 mb-4">
        Free online DNS lookup. Check A, AAAA, MX, TXT, NS records instantly.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--color-neon-dim)]"
        />
        <button
          type="submit"
          disabled={loading || !domain.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          {loading ? "Looking up..." : "Lookup"}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-4 space-y-2">
          {records.map((record, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-black/20 border border-white/5 p-3"
            >
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-mono text-white/60">
                {record.type}
              </span>
              <span className="flex-1 text-sm font-mono text-white/80 break-all">{record.value}</span>
              {record.ttl && (
                <span className="text-xs text-white/40">TTL: {record.ttl}</span>
              )}
              <button
                onClick={() => copyToClipboard(record.value)}
                className="text-white/30 hover:text-white transition"
              >
                <Copy size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
