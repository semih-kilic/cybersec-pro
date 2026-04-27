"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import {
  Shield,
  Terminal,
  ArrowLeft,
  Play,
  Tag,
  Package,
  Layers,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const NetworkMesh = dynamic(() => import("@/components/three/NetworkMesh"), { ssr: false });

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  plan_required?: string;
  is_active?: boolean;
  command_template?: string | null;
  binary_name?: string | null;
  group?: string | null;
  kali_package?: string | null;
  business_category?: string | null;
  subcategory?: string | null;
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  team: "Team",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  trial: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  starter: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  professional: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  team: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  enterprise: "text-rose-400 border-rose-400/30 bg-rose-400/10",
};

export default function ToolDetailPage({ slug }: { slug: string }) {
  const locale = useLocale();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v2/tools?plan=trial");
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();

        const allTools: Tool[] = [];
        for (const cat of Object.values(data.categories || {})) {
          const c = cat as { tools?: Tool[] };
          for (const t of c.tools || []) allTools.push(t);
        }

        const found =
          allTools.find((t) => nameToSlug(t.name) === slug) ??
          allTools.find((t) => t.id === slug) ??
          allTools.find((t) => t.name.toLowerCase() === slug.toLowerCase());

        if (cancelled) return;
        if (found) {
          setTool(found);
        } else {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <>
        <NetworkMesh />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Loader2 size={36} className="animate-spin text-[var(--color-neon)]" />
          <p className="text-sm text-white/40">Loading tool details…</p>
        </div>
      </>
    );
  }

  if (notFound || !tool) {
    return (
      <>
        <NetworkMesh />
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <AlertTriangle size={48} className="text-amber-400" />
          <h1 className="text-3xl font-extrabold">Tool Not Found</h1>
          <p className="text-white/50">
            The tool <span className="font-mono text-[var(--color-neon)]">{slug}</span> was not found in our arsenal.
          </p>
          <Link href={`/${locale}/tools/`} className="btn-primary">
            <ArrowLeft size={16} /> Back to Arsenal
          </Link>
        </div>
      </>
    );
  }

  const planKey = tool.plan_required ?? "starter";
  const planLabel = PLAN_LABELS[planKey] ?? planKey;
  const planColor = PLAN_COLORS[planKey] ?? PLAN_COLORS.starter;
  const displayCategory = tool.business_category || tool.category;

  return (
    <>
      <NetworkMesh />

      <section className="mx-auto max-w-4xl px-6 pb-28 pt-32">
        <RevealOnScroll>
          {/* Breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-xs text-white/40">
            <Link href={`/${locale}/`} className="hover:text-[var(--color-neon)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href={`/${locale}/tools/`} className="hover:text-[var(--color-neon)] transition-colors">
              Arsenal
            </Link>
            <span>/</span>
            <span className="text-white/70">{tool.name}</span>
          </nav>

          {/* Header */}
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${planColor}`}>
                  {planLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                  {displayCategory}
                </span>
                {tool.subcategory && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40">
                    {tool.subcategory}
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-extrabold md:text-5xl">{tool.name}</h1>
            </div>

            <a
              href="/dashboard/login"
              className="btn-primary shrink-0 self-start"
            >
              <Play size={16} /> Launch Tool
            </a>
          </div>

          {/* Description */}
          <div className="glass-card mb-8 p-6">
            <p className="leading-relaxed text-white/70">{tool.description || `${tool.name} is a professional security tool available in CyberSec Pro's cloud arsenal.`}</p>
          </div>

          {/* Details grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {tool.command_template && (
              <div className="glass-card p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  <Terminal size={14} />
                  Command Template
                </div>
                <code className="block overflow-x-auto rounded-lg bg-black/30 px-4 py-3 font-mono text-sm text-[var(--color-neon)]/80">
                  {tool.command_template}
                </code>
              </div>
            )}

            {tool.binary_name && (
              <div className="glass-card p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  <Shield size={14} />
                  Binary
                </div>
                <code className="font-mono text-sm text-white/80">{tool.binary_name}</code>
              </div>
            )}

            {tool.kali_package && (
              <div className="glass-card p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  <Package size={14} />
                  Kali Package
                </div>
                <code className="font-mono text-sm text-white/80">{tool.kali_package}</code>
              </div>
            )}

            {tool.group && (
              <div className="glass-card p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  <Layers size={14} />
                  Category Group
                </div>
                <span className="text-sm text-white/80 capitalize">{tool.group.replace(/-/g, " ")}</span>
              </div>
            )}

            <div className="glass-card p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                <Tag size={14} />
                Required Plan
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${planColor}`}>
                {planLabel}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="glass-card p-8 text-center">
            <h2 className="mb-2 text-2xl font-extrabold">Ready to use {tool.name}?</h2>
            <p className="mb-6 text-white/50">
              Run {tool.name} and 395 other tools directly in your browser — no setup, no VMs.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/dashboard/login" className="btn-primary">
                <Play size={16} /> Start for Free
              </a>
              <Link href={`/${locale}/tools/`} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                <ExternalLink size={14} /> Explore All Tools
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
