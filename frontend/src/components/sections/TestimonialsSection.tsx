"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
import { Rss, ExternalLink, Shield, Clock, AlertTriangle } from "lucide-react";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  sourceIcon: string;
  date: string;
}

const RSS_FEEDS = [
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", icon: "🔐" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", icon: "💻" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", icon: "🛡️" },
];

// Static fallback links (used only when RSS fetch fails / blocked by CORS in static export).
// We deliberately avoid fabricated headlines: only point users to the real source homepages.
const FALLBACK_NEWS: NewsItem[] = [
  { title: "Visit The Hacker News for the latest cybersecurity stories", link: "https://thehackernews.com", source: "The Hacker News", sourceIcon: "🔐", date: new Date().toLocaleDateString() },
  { title: "Visit BleepingComputer for breaking security news", link: "https://www.bleepingcomputer.com", source: "BleepingComputer", sourceIcon: "💻", date: new Date().toLocaleDateString() },
  { title: "Visit Krebs on Security for in-depth investigations", link: "https://krebsonsecurity.com", source: "Krebs on Security", sourceIcon: "🛡️", date: new Date().toLocaleDateString() },
];

async function fetchRSS(feed: typeof RSS_FEEDS[0]): Promise<NewsItem[]> {
  try {
    // Use a CORS proxy for client-side RSS fetching
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");
    const items = doc.querySelectorAll("item");
    const news: NewsItem[] = [];
    items.forEach((item, i) => {
      if (i >= 3) return; // max 3 per feed
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      if (title && link) {
        news.push({
          title,
          link,
          source: feed.name,
          sourceIcon: feed.icon,
          date: pubDate ? new Date(pubDate).toLocaleDateString() : new Date().toLocaleDateString(),
        });
      }
    });
    return news;
  } catch {
    return [];
  }
}

export default function TestimonialsSection() {
  const t = useTranslations("testimonials");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(RSS_FEEDS.map(fetchRSS));
        const all = results.flat();
        // Interleave sources and take top 5
        const sorted = all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (!cancelled) {
          setNews(sorted.length > 0 ? sorted.slice(0, 5) : FALLBACK_NEWS);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNews(FALLBACK_NEWS);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll className="section-heading mb-16">
          <span className="badge mb-4">
            <Shield size={14} className="inline mr-1" />
            Threat Intelligence
          </span>
          <h2>Today&apos;s Top Cyber Security News</h2>
          <p className="mt-2 text-white/40 text-sm">Real-time threat intelligence from trusted sources</p>
        </RevealOnScroll>

        {/* Source indicators */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {RSS_FEEDS.map((feed) => (
            <div key={feed.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/50">
              <span>{feed.icon}</span>
              <span>{feed.name}</span>
              <Rss size={10} className="text-[var(--color-neon)]" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            // Skeleton loading
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
              </div>
            ))
          ) : (
            news.map((item, i) => (
              <RevealOnScroll key={`${item.source}-${i}`}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card flex items-start gap-4 p-6 group hover:border-[var(--color-neon)]/30 transition-all"
                >
                  {/* Rank badge */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-neon)]/10 flex items-center justify-center font-mono font-bold text-[var(--color-neon)] text-lg">
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm md:text-base font-semibold text-white group-hover:text-[var(--color-neon)] transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        {item.sourceIcon} {item.source}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {item.date}
                      </span>
                    </div>
                  </div>

                  <ExternalLink size={16} className="flex-shrink-0 text-white/20 group-hover:text-[var(--color-neon)] transition mt-1" />
                </a>
              </RevealOnScroll>
            ))
          )}
        </div>

        {/* Threat alert banner */}
        <RevealOnScroll>
          <div className="mt-10 glass-card border-yellow-500/20 p-6 flex items-center gap-4">
            <AlertTriangle size={24} className="text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Stay protected against emerging threats</p>
              <p className="text-xs text-white/40 mt-1">
                CyberSec Pro continuously monitors threat feeds and updates its 89 tools to protect against the latest vulnerabilities.
              </p>
            </div>
            <a
              href="/dashboard/login"
              className="ml-auto flex-shrink-0 px-4 py-2 bg-[var(--color-neon)] text-[var(--color-bg)] rounded-lg text-xs font-bold hover:shadow-[0_0_20px_var(--color-neon-glow)] transition"
            >
              Start Scanning
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
