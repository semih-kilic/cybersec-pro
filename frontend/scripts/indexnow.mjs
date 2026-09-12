#!/usr/bin/env node
/**
 * Notify IndexNow that the site changed.
 *
 * IndexNow is a push protocol: instead of waiting for a crawler to come back,
 * the site tells Bing and Yandex which URLs changed and they fetch them within
 * minutes. Bing's index is what Microsoft Copilot answers from, so this is the
 * shortest path from "deployed" to "an assistant can cite it".
 *
 * Ownership is proven by hosting the key at /<key>.txt, which is in public/.
 *
 * This is a one-way announcement to an external service, so it is NOT wired
 * into postbuild — run it deliberately after a deploy:
 *
 *   npm run indexnow            # every URL in the sitemap
 *   npm run indexnow -- <url>…  # just these
 *
 * Google does not participate; for Google the sitemap plus Search Console is
 * the route.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const KEY = '7adfb2b14c2de5cd058642ea00c2c75f';
const HOST = 'cyber-sec-pro.com';
const ORIGIN = `https://${HOST}`;

let urls = process.argv.slice(2);
if (!urls.length) {
  const xml = readFileSync(join(ROOT, 'out', 'sitemap.xml'), 'utf8');
  urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
}
if (!urls.length) {
  console.error('indexnow: no URLs — run `npm run build` first.');
  process.exit(1);
}

// IndexNow accepts up to 10,000 URLs per request; chunk anyway to stay polite.
const CHUNK = 1000;
let sent = 0;
for (let i = 0; i < urls.length; i += CHUNK) {
  const batch = urls.slice(i, i + CHUNK);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: batch }),
  });
  // 200 = accepted, 202 = accepted but key still being validated.
  if (res.status !== 200 && res.status !== 202) {
    console.error(`indexnow: batch ${i / CHUNK + 1} rejected — HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  sent += batch.length;
}
console.log(`indexnow: submitted ${sent} URLs (key at ${ORIGIN}/${KEY}.txt)`);
