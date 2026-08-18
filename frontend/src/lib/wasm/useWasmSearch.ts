"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Tool {
  id?: string;
  name: string;
  category: string;
  description: string;
  command?: string;
  plan_required?: string;
}

interface WasmSearchResult {
  id: string;
  name: string;
  category: string;
  score: number;
}

let wasmModule: any = null;
let engine: any = null;
let loadPromise: Promise<void> | null = null;

async function loadWasm(): Promise<void> {
  if (wasmModule) return;

  const mod = await import("./cybersec_wasm.js");
  await mod.default("/cybersec_wasm_bg.wasm");
  wasmModule = mod;
}

function initEngine(tools: Tool[]): void {
  if (!wasmModule) return;

  const toolsData = tools.map((t, i) => ({
    id: t.id || `tool-${i}`,
    name: t.name,
    category: t.category,
    description: t.description || "",
    tags: [],
  }));

  engine = new wasmModule.ToolSearchEngine(JSON.stringify(toolsData));
}

export function useWasmSearch(tools: Tool[]) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef(engine);

  useEffect(() => {
    if (tools.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        await loadWasm();
        if (cancelled) return;

        initEngine(tools);
        engineRef.current = engine;
        setReady(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load WASM");
          console.warn("WASM search unavailable, falling back to JS:", e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tools]);

  const search = useCallback(
    (query: string, categoryFilter: string): Tool[] => {
      if (!ready || !engineRef.current) {
        // Fallback to JS
        const q = query.toLowerCase();
        return tools.filter((tool) => {
          const matchSearch =
            !q ||
            tool.name.toLowerCase().includes(q) ||
            (tool.description || "").toLowerCase().includes(q) ||
            tool.category.toLowerCase().includes(q);
          const matchCategory =
            categoryFilter === "All" || tool.category === categoryFilter;
          return matchSearch && matchCategory;
        });
      }

      const catFilter = categoryFilter === "All" ? "" : categoryFilter;
      const results: WasmSearchResult[] = engineRef.current.search(query, catFilter);

      // Map results back to full tool objects
      const toolMap = new Map(tools.map((t, i) => [t.id || `tool-${i}`, t]));
      return results
        .map((r) => toolMap.get(r.id))
        .filter(Boolean) as Tool[];
    },
    [ready, tools]
  );

  const getCategories = useCallback((): string[] => {
    if (!ready || !engineRef.current) {
      const cats = new Set(tools.map((t) => t.category));
      return Array.from(cats).sort();
    }
    return engineRef.current.get_all_categories();
  }, [ready, tools]);

  return { ready, error, search, getCategories };
}
