"use client";

import { useState } from "react";
import { Search, Globe, Loader2, AlertTriangle, ExternalLink } from "lucide-react";

export default function OnlineSubdomainFinder() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`/api/v1/tools/sublist3r?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error("Tool execution failed");
      const data = await res.json();
      const subdomains = data.subdomains || data.data || [];
      setResults(Array.isArray(subdomains) ? subdomains : []);
    } catch {
      setError("Unable to fetch subdomains. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={20} className="text-[var(--color-neon)]" />
        <h3 className="text-lg font-bold">Online Subdomain Finder</h3>
      </div>
      <p className="text-sm text-white/50 mb-4">
        Discover subdomains without installing anything. Free, no sign-up required.
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Scanning..." : "Find"}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-white/60 mb-2">{results.length} subdomains found:</p>
          <div className="flex flex-wrap gap-2">
            {results.map((sub, i) => (
              <span
                key={i}
                className="rounded-lg bg-black/30 border border-white/10 px-3 py-1.5 text-xs font-mono text-[var(--color-neon)]/80 hover:border-[var(--color-neon-dim)] transition cursor-pointer"
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/5">
        <a
          href="/dashboard/login"
          className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white transition"
        >
          <ExternalLink size={12} />
          Sign in for unlimited scans and advanced features
        </a>
      </div>
    </div>
  );
}
