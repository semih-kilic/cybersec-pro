"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Search, Terminal, Play, Shield, Loader2 } from "lucide-react";

const NetworkMesh = dynamic(() => import("@/components/three/NetworkMesh"), { ssr: false });

interface Tool {
  id?: string;
  name: string;
  category: string;
  description: string;
  command?: string;
  plan_required?: string;
}

interface ToolsResponse {
  categories: Record<string, Tool[]>;
  category_list: string[];
  total_tools: number;
  success: boolean;
}

export default function ToolsPage() {
  const t = useTranslations("tools");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalTools, setTotalTools] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v2/tools?plan=trial");
        if (!res.ok) throw new Error("Failed to fetch tools");
        const data: ToolsResponse = await res.json();
        if (cancelled) return;

        const tools: Tool[] = [];
        const catEntries = data.categories || {};
        for (const [cat, catTools] of Object.entries(catEntries)) {
          for (const tool of catTools) {
            tools.push({ ...tool, category: cat });
          }
        }
        // Sort alphabetically
        tools.sort((a, b) => a.name.localeCompare(b.name));

        setAllTools(tools);
        setCategories(data.category_list || Object.keys(catEntries).sort());
        setTotalTools(data.total_tools || tools.length);
        setLoading(false);
      } catch {
        // Fallback if API unavailable
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return allTools.filter((tool) => {
      const q = search.toLowerCase();
      const matchSearch = !q || tool.name.toLowerCase().includes(q) ||
        (tool.description || "").toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q);
      const matchCategory = category === "All" || tool.category === category;
      return matchSearch && matchCategory;
    });
  }, [search, category, allTools]);

  // Paginate for performance
  const [visibleCount, setVisibleCount] = useState(60);
  const visibleTools = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <>
      <NetworkMesh />
      <section className="relative pb-8 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">
            <Shield size={14} className="inline mr-1" />
            {totalTools > 0 ? `${totalTools} Verified Tools` : t("badge")}
          </span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>

          {/* Stats bar */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-[var(--color-neon)]">{totalTools}</span>
              <span className="text-white/40">Tools</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-[var(--color-neon)]">{categories.length}</span>
              <span className="text-white/40">Categories</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-[var(--color-neon)]">100%</span>
              <span className="text-white/40">Kali Linux</span>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Search & Filter */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(60); }}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--color-neon-dim)]"
            />
          </div>
          <div className="text-sm text-white/40">
            {filtered.length} of {totalTools} tools
          </div>
        </div>

        {/* Category bar */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => { setCategory("All"); setVisibleCount(60); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              category === "All"
                ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                : "border border-white/10 text-white/50 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
            }`}
          >
            {t("allCategories")} ({totalTools})
          </button>
          {categories.map((cat) => {
            const count = allTools.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setVisibleCount(60); }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  category === cat
                    ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                    : "border border-white/10 text-white/50 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Tools Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="text-[var(--color-neon)] animate-spin" />
            <p className="text-sm text-white/40">Loading {totalTools || ""} tools...</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleTools.map((tool) => (
                <div key={`${tool.category}-${tool.name}`} className="glass-card group flex flex-col gap-3 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white">{tool.name}</h3>
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">{tool.category}</span>
                  </div>
                  <p className="text-sm text-white/50 line-clamp-2">{tool.description || `${tool.name} security tool`}</p>
                  {tool.command && (
                    <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-neon)]/70">
                      <Terminal size={12} className="shrink-0 text-white/30" />
                      <code className="truncate">{tool.command}</code>
                    </div>
                  )}
                  <a
                    href="/dashboard/login"
                    className="btn-primary mt-1 justify-center py-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Play size={12} /> {t("runTool")}
                  </a>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 60)}
                  className="px-6 py-3 rounded-xl border border-white/10 text-sm text-white/60 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)] transition"
                >
                  Load More ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}

            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-16 text-center text-white/40">
                No tools found matching your search.
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
