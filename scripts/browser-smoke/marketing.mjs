#!/usr/bin/env node
/**
 * Real-browser smoke test for the public marketing site.
 *
 * Loads the main English pages plus the drift-prone trio (home, trust-center,
 * security) in every locale, and fails on: a non-2xx page, an app console
 * error, a 4xx/5xx subrequest, a next-intl MISSING_MESSAGE, or a reappearance
 * of a compliance claim we deliberately softened.
 *
 * That last check is the point: the Trust Center once advertised audits and
 * certifications that are not held. If any of those strings come back — from a
 * revert, a bad merge, or an untranslated locale falling back to stale copy —
 * this fails rather than quietly shipping a false claim.
 *
 * Usage:
 *   node scripts/browser-smoke/marketing.mjs
 *
 * Env:
 *   SMOKE_MARKETING_BASE  default https://cyber-sec-pro.com
 *   CHROME_PATH           default /usr/bin/chromium
 */
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_MARKETING_BASE || 'https://cyber-sec-pro.com';

const PAGES = [
  '', 'tools', 'tools/nmap', 'tools/mini-tools', 'security', 'trust-center',
  'docs', 'api-reference', 'about', 'contact', 'careers', 'blog',
  'privacy', 'terms', 'success',
];
const LOCALE_PAGES = ['', 'trust-center', 'security'];
const LOCALES = ['en', 'tr', 'de', 'fr', 'es', 'ar', 'ja', 'ko', 'ru', 'zh'];

const THIRD_PARTY = /cloudflareinsights|google-analytics|googletagmanager|www\.google\.com\/|doubleclick|gtag|fonts\.(googleapis|gstatic)/i;

// Claims removed in the Trust Center honesty pass — none of these are held.
const FABRICATED = /Ernst & Young|BSI Group|Cobalt\.io|NCC Group|Bishop Fox|Mandiant|Type II Certified|Level 1 Service Provider|CSA STAR Level 2/i;

const targets = [];
for (const p of PAGES) targets.push(['en', p]);
for (const l of LOCALES) if (l !== 'en') for (const p of LOCALE_PAGES) targets.push([l, p]);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = [];
for (const [locale, p] of targets) {
  const url = `${BASE}/${locale}${p ? '/' + p : ''}`;
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];

  page.on('console', (m) => {
    if (m.type() === 'error' && !THIRD_PARTY.test(m.text())) errors.push(m.text().slice(0, 180));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 180)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !THIRD_PARTY.test(r.url())) {
      failed.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 90)}`);
    }
  });

  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    status = resp ? resp.status() : 0;
  } catch {
    // fall through to the DOM assertions
  }
  await page.waitForTimeout(1200);

  const body = await page.evaluate(() => document.body.innerText || '');
  const missingMsg = (body.match(/MISSING_MESSAGE/g) || []).length;
  const fabricated = FABRICATED.test(body);

  results.push({ url: `${locale}/${p}`, status, len: body.length, errors, failed, missingMsg, fabricated });
  await ctx.close();
}
await browser.close();

const isBad = (r) => r.status >= 400 || r.len < 400 || r.errors.length || r.failed.length || r.missingMsg || r.fabricated;

let bad = 0;
console.log('PAGE'.padEnd(26) + 'HTTP  TEXT     ERR  HTTP>=400  MISSING  FALSE-CLAIM');
for (const r of results) {
  if (isBad(r)) bad++;
  console.log(
    `${isBad(r) ? 'x' : 'v'} ${r.url.padEnd(24)}${String(r.status).padEnd(6)}${String(r.len).padEnd(9)}${String(r.errors.length).padEnd(5)}${String(r.failed.length).padEnd(11)}${String(r.missingMsg).padEnd(9)}${r.fabricated}`,
  );
}

if (bad) {
  console.log('\n================ DETAIL ================');
  for (const r of results) {
    if (!isBad(r)) continue;
    console.log(`\n### ${r.url} (http=${r.status}, text=${r.len})`);
    for (const e of [...new Set(r.errors)].slice(0, 3)) console.log(`   ERR  ${e}`);
    for (const f of [...new Set(r.failed)].slice(0, 5)) console.log(`   HTTP ${f}`);
    if (r.fabricated) console.log('   FALSE-CLAIM: a softened Trust Center claim has reappeared');
  }
}

console.log(`\n${results.length - bad}/${results.length} pages clean`);
process.exit(bad ? 1 : 0);
