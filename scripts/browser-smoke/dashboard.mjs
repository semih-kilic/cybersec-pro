#!/usr/bin/env node
/**
 * Real-browser smoke test for the SaaS dashboard.
 *
 * Loads every dashboard route in headless Chromium as a logged-in user and
 * fails on: a React crash, an empty #root, an app console error, a 4xx/5xx
 * response, or an untranslated i18n key rendered as a raw dotted path.
 *
 * This catches the class of defect that unit tests, tsc and bundle inspection
 * all miss — it found a CSP blocking analytics, missing security headers on
 * the dashboard shell, and a dead Socket.IO retry storm.
 *
 * Usage:
 *   SMOKE_JWT="$(scripts/browser-smoke/mint-jwt.sh)" node scripts/browser-smoke/dashboard.mjs
 *
 * Env:
 *   SMOKE_JWT    required — access token placed in localStorage as `token`
 *   SMOKE_BASE   default https://app.cyber-sec-pro.com/dashboard
 *   SMOKE_TOOL / SMOKE_SCAN / SMOKE_PROJECT — ids for the parameterised routes
 *   CHROME_PATH  default /usr/bin/chromium
 */
import { chromium } from 'playwright-core';

const TOKEN = process.env.SMOKE_JWT;
if (!TOKEN) {
  console.error('SMOKE_JWT is required. See scripts/browser-smoke/README.md');
  process.exit(2);
}

const BASE = process.env.SMOKE_BASE || 'https://app.cyber-sec-pro.com/dashboard';
const TOOL = process.env.SMOKE_TOOL || 'f4c9e66f-b98e-4904-b2a9-cbf99338359a';
const SCAN = process.env.SMOKE_SCAN || '';
const PROJECT = process.env.SMOKE_PROJECT || '';

const ROUTES = [
  '', 'overview', 'tools', `tools/${TOOL}`, `tools/${TOOL}/run`,
  'scans', 'scans/new', ...(SCAN ? [`scans/${SCAN}`] : []),
  'targets', 'reports', 'schedule', 'terminal', 'settings', 'agents',
  'agent-jobs', 'projects', ...(PROJECT ? [`projects/${PROJECT}`] : []),
  'upgrade', 'billing', 'feedback', 'analytics', 'ai', 'purple-team',
  'pipeline-builder', 'workflows', 'admin', 'service-manager', 'god-mode',
  'threat-intel', 'vulnerabilities', 'news', 'learning', 'compliance',
  'community', 'cybersec-ai', 'scan-templates',
];

// Analytics and font hosts are outside our control; they must not fail a run.
const THIRD_PARTY = /cloudflareinsights|google-analytics|googletagmanager|www\.google\.com\/|doubleclick|gtag|fonts\.(googleapis|gstatic)/i;
const RAW_KEY = /\b(?:common|tools|scans|nav|dashboard|settings|reports)\.[a-z][a-zA-Z0-9_.]{2,}/g;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = [];
for (const route of ROUTES) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'tr-TR' });
  await ctx.addInitScript(
    ([t]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('cybersecpro_language', 'tr');
    },
    [TOKEN],
  );
  const page = await ctx.newPage();
  const errors = [];
  const failedReqs = [];

  page.on('console', (m) => {
    if (m.type() === 'error' && !THIRD_PARTY.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !THIRD_PARTY.test(r.url())) {
      failedReqs.push(`${r.status()} ${r.url().slice(0, 100)}`);
    }
  });

  try {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle', timeout: 40000 });
  } catch {
    // networkidle can time out on pages holding an SSE stream open; the DOM
    // assertions below decide pass/fail, not navigation timing.
  }
  await page.waitForTimeout(2000);

  const body = await page.evaluate(() => document.body.innerText || '');
  const rootLen = await page.evaluate(() => (document.getElementById('root')?.innerHTML || '').length);
  const crashed = /Page failed to load|Something went wrong|Minified React error/i.test(body);
  const rawKeys = [...new Set(body.match(RAW_KEY) || [])];

  results.push({ route: route || '(root)', crashed, rootLen, errors, failedReqs, rawKeys });
  await ctx.close();
}
await browser.close();

let bad = 0;
console.log('ROUTE'.padEnd(34) + 'DOM'.padEnd(9) + 'CRASH  ERR  HTTP>=400  RAWKEYS');
for (const r of results) {
  const problem = r.crashed || r.rootLen < 500 || r.errors.length || r.failedReqs.length || r.rawKeys.length;
  if (problem) bad++;
  console.log(
    `${problem ? 'x' : 'v'} ${r.route.padEnd(32)}${String(r.rootLen).padEnd(9)}${String(r.crashed).padEnd(7)}${String(r.errors.length).padEnd(5)}${String(r.failedReqs.length).padEnd(11)}${r.rawKeys.length}`,
  );
}

if (bad) {
  console.log('\n================ DETAIL ================');
  for (const r of results) {
    if (!(r.crashed || r.rootLen < 500 || r.errors.length || r.failedReqs.length || r.rawKeys.length)) continue;
    console.log(`\n### ${r.route}  (dom=${r.rootLen}, crashed=${r.crashed})`);
    for (const e of [...new Set(r.errors)].slice(0, 4)) console.log(`   ERR  ${e}`);
    for (const f of [...new Set(r.failedReqs)].slice(0, 6)) console.log(`   HTTP ${f}`);
    if (r.rawKeys.length) console.log(`   KEYS ${r.rawKeys.slice(0, 6).join(', ')}`);
  }
}

console.log(`\n${results.length - bad}/${results.length} routes clean`);
process.exit(bad ? 1 : 0);
