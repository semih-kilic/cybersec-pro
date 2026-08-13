"use client";

import { useState } from "react";
import { Shield, Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface CheckResult {
  header: string;
  status: "pass" | "fail" | "warn";
  value?: string;
  recommendation?: string;
}

export default function HeaderSecurityChecker() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState("");

  const checkHeaders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`/api/v1/tools/header-check?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setError("Unable to analyze headers. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: CheckResult["status"]) => {
    if (status === "pass") return <CheckCircle size={16} className="text-emerald-400" />;
    if (status === "fail") return <XCircle size={16} className="text-red-400" />;
    return <AlertTriangle size={16} className="text-amber-400" />;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={20} className="text-[var(--color-neon)]" />
        <h3 className="text-lg font-bold">Header Security Checker</h3>
      </div>
      <p className="text-sm text-white/50 mb-4">
        Instantly analyze HTTP security headers of any public URL.
      </p>

      <form onSubmit={checkHeaders} className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--color-neon-dim)]"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          {loading ? "Checking..." : "Check"}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((result, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg bg-black/20 border border-white/5 p-3"
            >
              <div className="mt-0.5">{getStatusIcon(result.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white/80">{result.header}</span>
                  {result.value && (
                    <span className="text-xs text-white/40 truncate">{result.value}</span>
                  )}
                </div>
                {result.recommendation && (
                  <p className="text-xs text-white/50 mt-1">{result.recommendation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
