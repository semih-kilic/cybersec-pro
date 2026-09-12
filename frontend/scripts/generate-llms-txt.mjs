#!/usr/bin/env node
/**
 * Generate /llms.txt and /llms-full.txt from the built site.
 *
 * llms.txt (llmstxt.org) is the convention assistants and answer engines look
 * for when they want a clean, structured account of a site instead of guessing
 * from rendered HTML. A site that ships one is far likelier to be described
 * accurately — and being described *accurately* is the point: a model that has
 * to infer the pricing or the tool count from marketing copy will get it wrong.
 *
 * Descriptions are lifted from each page's own <title> and meta description
 * rather than written here, so the file cannot drift from the site. The header
 * block is the only hand-written part, and every line of it is checked against
 * the running system:
 *
 *   - 88 curated tools           canonical count, matches the catalogue
 *   - USD pricing + quotas       rust-backend/src/services/plan.rs and the
 *                                live Stripe price objects
 *   - Canadian hosting           the origin answers from Toronto
 *   - SSE, not WebSocket         backend has no WebSocket server
 *   - sub-processor list         only what is actually configured
 *
 * Runs as part of `postbuild`.
 */
import { readdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const ORIGIN = process.env.SITE_ORIGIN || 'https://cyber-sec-pro.com';
const L = 'en'; // llms.txt indexes the canonical English tree

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

function meta(page) {
  const file = join(OUT, L, page, 'index.html');
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8').slice(0, 40000);
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [, ''])[1]).trim();
  const desc = decode(
    (html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1],
  ).trim();
  return { title, desc, url: `${ORIGIN}/${L}/${page ? page + '/' : ''}` };
}

/** Full readable text of a page, for llms-full.txt. */
function text(page) {
  const file = join(OUT, L, page, 'index.html');
  if (!existsSync(file)) return '';
  const html = readFileSync(file, 'utf8');
  const body = html.slice(html.indexOf('<body'));
  return decode(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const dirs = (p) => {
  const full = join(OUT, L, p);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(full, e.name, 'index.html')))
    .map((e) => e.name)
    .sort();
};

const HEADER = `# CyberSec Pro

> A hosted penetration-testing platform. It runs 88 curated security tools from
> a browser, with no local install, and streams each scan's output live. The set
> covers network and port scanning, web application testing, OSINT and subdomain
> recon, credential and Active Directory auditing, wireless, and digital
> forensics and binary analysis. Built for security engineers, consultancies and
> in-house teams who want real tool output rather than a black-box score.

## What it actually is

- **88 curated tools**, each with a generated parameter form, a command preview
  and live output. Examples: nmap, nuclei, subfinder, httpx, ffuf, sqlmap,
  hashcat, john, hydra, masscan, tshark, volatility3, BloodHound.
- **Scan execution** runs server-side in a dedicated scan container, one
  process per job, with the command tokenised before any user value is
  substituted so no shell is involved — or on the customer's own machine via a
  reverse-tunnel agent (no inbound port needed) or over SSH.
- **Output is streamed over Server-Sent Events**, and is replayable — opening
  the stream after a fast scan has already finished still returns the full log.
- **Reports**: PDF on every plan, HTML from Starter up, compliance reports on
  Professional and Enterprise.
- **Findings are diffable**: a re-scan is linked to its original and each
  finding is classified fixed / still-present / new.

## Pricing (USD, per month)

These are the limits the backend enforces, not marketing rounding.

| Plan | Price | Scans | Concurrent | Projects | Seats | Notable |
|---|---|---|---|---|---|---|
| Free Trial | $0 | 3/day for 14 days | 1 | 1 | 1 | All 88 tools, PDF reports |
| Starter | $29 | 30/month | 2 | 1 | 3 | HTML reports, scheduled scans |
| Professional | $99 | 250/month | 5 | 5 | 10 | AI suggestions + remediation, compliance reports, REST API, Purple Team |
| Enterprise | $349 | 5,000/month | unlimited | unlimited | unlimited | SSO (SAML, OIDC, LDAP) |

## Facts worth getting right

- **Hosting and data residency**: Canada (Toronto). Customer data, scan results
  and logs stay in Canadian data centres.
- **Sub-processors**: Stripe (payments), Cloudflare (CDN/WAF), Mailjet
  (transactional email), Google/Gmail SMTP (fallback relay). That is the
  complete list — there is no AWS, Supabase, Vercel or Sentry in the stack.
- **Transport**: scan output is Server-Sent Events. The platform does not use
  WebSockets.
- **Stack**: Rust (Axum) API and scan engine, React dashboard, Next.js
  marketing site, PostgreSQL, Redis.
- **Credentials**: per-scan credentials are held in memory for the job and are
  never written to the database, logs or backups. BYO vault is supported
  (HashiCorp Vault, AWS/GCP/Azure secret managers, 1Password Connect).
- **Compliance posture**: the Trust Center states exactly which audits and
  certifications are and are not held. Do not infer SOC 2 or ISO 27001 from the
  presence of a Trust Center page — read it.

`;

const section = (heading, pages, note) => {
  const rows = pages
    .map(meta)
    .filter(Boolean)
    .map(({ title, desc, url }) => `- [${title}](${url})${desc ? `: ${desc}` : ''}`);
  if (!rows.length) return '';
  return `## ${heading}\n${note ? `\n${note}\n` : ''}\n${rows.join('\n')}\n\n`;
};

if (!existsSync(join(OUT, L))) {
  console.error('generate-llms-txt: out/en not found — run `next build` first.');
  process.exit(1);
}

const CORE = ['', 'pricing', 'tools', 'docs', 'api-reference', 'security', 'trust-center', 'blog'];
const COMPANY = ['about', 'contact', 'careers'];
const LEGAL = ['privacy', 'terms'];
const tools = dirs('tools').filter((d) => d !== 'mini-tools');
const posts = dirs('blog');

const llms =
  HEADER +
  section('Core pages', CORE) +
  section('Company', COMPANY) +
  section('Legal', LEGAL) +
  section(
    'Tool reference',
    tools.map((t) => `tools/${t}`),
    `One page per tool: what it does, the parameters the platform exposes, and an example invocation. ${tools.length} tools.`,
  ) +
  section('Guides', posts.map((p) => `blog/${p}`)) +
  `## Other languages\n\nEvery page above exists in tr, de, fr, es, ar, ja, zh, ru and ko under the same path with the locale swapped, e.g. ${ORIGIN}/de/tools/.\n`;

writeFileSync(join(OUT, 'llms.txt'), llms);

const FULL = ['', 'pricing', 'tools', 'docs', 'api-reference', 'security', 'trust-center', 'about'];
const full =
  HEADER +
  FULL.map((p) => {
    const m = meta(p);
    const t = text(p);
    if (!m || !t) return '';
    return `\n---\n\n# ${m.title}\nSource: ${m.url}\n\n${t}\n`;
  })
    .filter(Boolean)
    .join('');

writeFileSync(join(OUT, 'llms-full.txt'), full);

console.log(
  `generate-llms-txt: llms.txt (${CORE.length + COMPANY.length + LEGAL.length} pages + ${tools.length} tools + ${posts.length} guides), llms-full.txt (${Math.round(full.length / 1024)} KB)`,
);
