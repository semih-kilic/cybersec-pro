#!/usr/bin/env node
/**
 * Generate sitemap.xml from what the build actually produced.
 *
 * The previous sitemap was a hand-maintained file in public/. It drifted: by
 * the time anyone checked, 969 of its 1918 URLs were 404s — it still listed
 * 181 tool pages per locale when the catalogue had been curated down to 88 —
 * and 193 real pages, including every blog post and every locale home page,
 * were missing from it entirely. A sitemap that is half dead links is worse
 * than no sitemap: it is the first thing a crawler checks, and it is how
 * search and AI crawlers judge whether the rest of the site is worth trusting.
 *
 * So this walks `out/` instead of being written by hand. Every entry is a page
 * that exists, because it was read off disk after the build made it.
 *
 * Each URL also carries `xhtml:link rel="alternate" hreflang` entries for
 * every locale the same page exists in, plus `x-default` pointing at English.
 * That is what tells a crawler the ten locale copies are one page in ten
 * languages rather than ten near-duplicates competing with each other.
 *
 * Runs as `postbuild`, so `npm run build` cannot produce a stale sitemap.
 */
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const ORIGIN = process.env.SITE_ORIGIN || 'https://cyber-sec-pro.com';
const LOCALES = ['en', 'tr', 'de', 'fr', 'es', 'ar', 'ja', 'zh', 'ru', 'ko'];
const DEFAULT_LOCALE = 'en';

/** Pages that exist but should never be advertised to a crawler. */
const EXCLUDE = [
  /^404(\/|$)/,
  /^_not-found(\/|$)/,
  /^_next(\/|$)/,
  /(^|\/)admin(\/|$)/,
  /(^|\/)success(\/|$)/, // post-checkout page, not an entry point
];

/** Crawl priority by page shape. Ordering matters — first match wins. */
const PRIORITY = [
  [/^$/, 1.0], // locale home
  [/^tools$/, 0.9],
  [/^(pricing|security|trust-center)$/, 0.9],
  [/^tools\/[^/]+$/, 0.8],
  [/^blog$/, 0.8],
  [/^blog\/[^/]+$/, 0.7],
  [/^(docs|api-reference)$/, 0.7],
  [/^(about|contact|careers)$/, 0.6],
  [/^(privacy|terms)$/, 0.3],
];

const CHANGEFREQ = [
  [/^$/, 'daily'],
  [/^(blog|tools)$/, 'weekly'],
  [/^blog\/[^/]+$/, 'monthly'],
  [/^(privacy|terms)$/, 'yearly'],
];

const pick = (table, path, fallback) => {
  for (const [re, value] of table) if (re.test(path)) return value;
  return fallback;
};

/** Every directory under out/ that holds an index.html, as a URL path. */
function collectPages(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (existsSync(join(full, 'index.html'))) {
      acc.push(relative(OUT, full).split(sep).join('/'));
    }
    collectPages(full, acc);
  }
  return acc;
}

if (!existsSync(OUT)) {
  console.error('generate-sitemap: out/ not found — run `next build` first.');
  process.exit(1);
}

const all = collectPages(OUT);
if (existsSync(join(OUT, 'index.html'))) all.push('');

/**
 * Group by the page's path with its locale stripped, so the ten language
 * copies of one page collapse into a single entry carrying ten alternates.
 * A path with no known locale prefix (the bare `/about/` style) is dropped:
 * those are exactly the URLs the old sitemap advertised into a 404.
 */
const groups = new Map();
for (const page of all) {
  const [head, ...rest] = page.split('/');
  if (!LOCALES.includes(head)) continue;
  const key = rest.join('/');
  if (EXCLUDE.some((re) => re.test(key))) continue;
  if (!groups.has(key)) groups.set(key, new Map());
  groups.get(key).set(head, page);
}

const lastmod = new Date().toISOString().slice(0, 10);
const url = (p) => `${ORIGIN}/${p ? p + '/' : ''}`;

const entries = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([key, byLocale]) => {
    const alternates = LOCALES.filter((l) => byLocale.has(l))
      .map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(byLocale.get(l))}"/>`,
      )
      .join('\n');
    const xDefault = byLocale.has(DEFAULT_LOCALE)
      ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url(byLocale.get(DEFAULT_LOCALE))}"/>`
      : '';

    return [...byLocale.values()].sort().map(
      (page) => `  <url>
    <loc>${url(page)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${pick(CHANGEFREQ, key, 'monthly')}</changefreq>
    <priority>${pick(PRIORITY, key, 0.5).toFixed(1)}</priority>
${alternates}${xDefault}
  </url>`,
    );
  });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

writeFileSync(join(OUT, 'sitemap.xml'), xml);
console.log(
  `generate-sitemap: ${entries.length} URLs across ${groups.size} pages x ${LOCALES.length} locales -> out/sitemap.xml`,
);
