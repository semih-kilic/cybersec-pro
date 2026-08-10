"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { blogPostsList } from "@/lib/blog-posts";
import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
const MatrixRain = dynamic(() => import("@/components/three/MatrixRain"), { ssr: false });
import { Clock, Mail, ExternalLink, Loader2 } from "lucide-react";

type FeedItem = {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  category: string;
  published_at: string;
  published_ts: number;
  tags: string[];
};

const CATEGORY_OPTIONS = ["All", "Breaches", "Vulnerabilities", "Malware", "Research", "Policy", "Tools"] as const;
type CategoryFilter = (typeof CATEGORY_OPTIONS)[number];

const categoryColors: Record<string, string> = {
  Breaches: "#ef476f",
  Vulnerabilities: "var(--color-neon)",
  Malware: "var(--color-purple)",
  Research: "var(--color-cyan)",
  Policy: "var(--color-orange)",
  Tools: "#ffd166",
};

const INITIAL_COUNT = 9;
const FEED_URL = "/api/v1/blog/feed?limit=60";

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function BlogPage() {
  const t = useTranslations("blog");
  const locale = useLocale();
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("All");
  const [showAll, setShowAll] = useState(false);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "submitting" | "ok" | "already" | "error">("idle");
  const [subMessage, setSubMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FEED_URL, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items?: FeedItem[] };
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (cancelled) return;
        setFeedError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === "All") return items;
    return items.filter((p) => p.category.toLowerCase() === activeFilter.toLowerCase());
  }, [items, activeFilter]);

  const featured = useMemo(() => items.slice(0, 3), [items]);
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (subState === "submitting") return;
    const trimmed = email.trim();
    if (!trimmed) {
      setSubState("error");
      setSubMessage("Please enter your email.");
      return;
    }
    setSubState("submitting");
    setSubMessage("");
    try {
      const res = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "blog" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already_subscribed?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        if (data.already_subscribed) {
          setSubState("already");
          setSubMessage("You're already subscribed — thanks!");
        } else {
          setSubState("ok");
          setSubMessage("Subscribed! Check your inbox for a welcome email.");
          setEmail("");
        }
      } else {
        setSubState("error");
        setSubMessage(data.error || `Could not subscribe (${res.status}).`);
      }
    } catch (err) {
      setSubState("error");
      setSubMessage(err instanceof Error ? err.message : "Network error.");
    }
  }

  return (
    <>
      <MatrixRain />
      <section className="relative pb-16 pt-32 text-center">
        <RevealOnScroll>
          <span className="badge mb-6">{t("badge")}</span>
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-white/55">{t("subtitle")}</p>
        </RevealOnScroll>
      </section>

            {/* Latest tutorials (internal guides) */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <RevealOnScroll>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{t("tutorialsTitle")}</h2>
            <span className="text-xs text-white/40">{blogPostsList.length} guides</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {blogPostsList.map((post) => (
              <Link
                key={post.slug}
                href={`/${locale}/blog/${post.slug}/`}
                className="glass-card flex h-full flex-col gap-4 p-6 cursor-pointer hover:border-white/10 transition block"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: `${categoryColors[post.category] || "var(--color-neon)"}20`,
                      color: categoryColors[post.category] || "var(--color-neon)",
                    }}
                  >
                    {post.category}
                  </span>
                  <span className="text-[11px] text-white/25">{formatDate(post.date)}</span>
                </div>
                <h3 className="text-lg font-bold text-white line-clamp-3">{post.title}</h3>
                <p className="text-sm leading-relaxed text-white/50 line-clamp-3">{post.excerpt}</p>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Clock size={12} /> {post.readTime} {t("minRead")}
                  </span>
                  <span className="text-xs font-semibold text-[var(--color-neon)]">{t("readMore")}</span>
                </div>
              </Link>
            ))}
          </div>
        </RevealOnScroll>
      </section>

{activeFilter === "All" && featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <RevealOnScroll>
            <h2 className="mb-6 text-xl font-bold text-white">Latest from the security community</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {featured.map((post) => (
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={post.id}
                  className="glass-card p-6 border-[var(--color-neon)]/10 hover:border-[var(--color-neon)]/30 transition cursor-pointer block"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `${categoryColors[post.category] || "var(--color-neon)"}20`,
                        color: categoryColors[post.category] || "var(--color-neon)",
                      }}
                    >
                      {post.category}
                    </span>
                    <span className="text-[10px] text-white/40">{post.source}</span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-white leading-snug line-clamp-3">{post.title}</h3>
                  <p className="mt-2 text-xs text-white/40 line-clamp-2">{post.summary}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-white/30">
                    <span>{formatDate(post.published_at)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {estimateReadTime(post.summary)} min
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </RevealOnScroll>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveFilter(cat);
                setShowAll(false);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeFilter === cat
                  ? "bg-[var(--color-neon)] text-[var(--color-bg)]"
                  : "border border-white/10 text-white/40 hover:border-[var(--color-neon-dim)] hover:text-[var(--color-neon)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="mx-auto max-w-6xl px-6 pb-12 flex items-center justify-center text-white/40">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading latest stories…
        </section>
      ) : feedError ? (
        <section className="mx-auto max-w-6xl px-6 pb-12 text-center text-sm text-white/50">
          Could not load the feed right now. Please try again later.
        </section>
      ) : (
        <>
          <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <RevealOnScroll key={post.id}>
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card flex h-full flex-col gap-4 p-6 cursor-pointer hover:border-white/10 transition block"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `${categoryColors[post.category] || "var(--color-neon)"}20`,
                        color: categoryColors[post.category] || "var(--color-neon)",
                      }}
                    >
                      {post.category}
                    </span>
                    <span className="text-[11px] text-white/25">{formatDate(post.published_at)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white line-clamp-3">{post.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50 line-clamp-3">{post.summary}</p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="flex items-center gap-1 text-xs text-white/30">
                      <Clock size={12} /> {estimateReadTime(post.summary)} {t("minRead")}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-neon)] hover:underline">
                      {post.source} <ExternalLink size={12} />
                    </span>
                  </div>
                </a>
              </RevealOnScroll>
            ))}
          </section>

          {!showAll && filtered.length > INITIAL_COUNT && (
            <div className="text-center pb-12">
              <button onClick={() => setShowAll(true)} className="btn-primary text-sm">
                Load More Articles ({filtered.length - INITIAL_COUNT} remaining)
              </button>
            </div>
          )}
        </>
      )}

      <section className="mx-auto max-w-2xl px-6 pb-28">
        <RevealOnScroll>
          <div className="glass-card p-8 text-center border-[var(--color-neon)]/20">
            <Mail size={32} className="mx-auto text-[var(--color-neon)] mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Stay Updated</h2>
            <p className="text-sm text-white/50 mb-6">
              Get the latest cybersecurity insights, tool guides, and platform updates delivered to your inbox.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2 max-w-md mx-auto" noValidate>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={subState === "submitting"}
                placeholder="your@email.com"
                aria-label="Email address"
                required
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-neon)]/50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={subState === "submitting"}
                className="btn-primary text-sm whitespace-nowrap disabled:opacity-60"
              >
                {subState === "submitting" ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={14} className="animate-spin" /> Subscribing…
                  </span>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
            {subMessage && (
              <p
                className={`mt-3 text-xs ${
                  subState === "ok" || subState === "already"
                    ? "text-[var(--color-neon)]"
                    : subState === "error"
                    ? "text-rose-400"
                    : "text-white/40"
                }`}
              >
                {subMessage}
              </p>
            )}
            <p className="mt-3 text-[11px] text-white/25">No spam. Unsubscribe anytime. We respect your privacy.</p>
          </div>
        </RevealOnScroll>
      </section>
    </>
  );
}
