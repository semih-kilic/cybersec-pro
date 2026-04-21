#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'src', 'pages');
const localesDir = path.join(root, 'src', 'i18n', 'locales');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

function ensurePath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (cur[last] === undefined) {
    cur[last] = value;
    return true;
  }
  return false;
}

function hasPath(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

function extractKeys(text) {
  const pairs = [];
  const patterns = [
    /t\(\s*'([^']+)'\s*,\s*'((?:\\'|[^'])*)'\s*\)/g,
    /t\(\s*"([^"]+)"\s*,\s*"((?:\\"|[^"])*)"\s*\)/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = m[1].trim();
      const fallback = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (key && fallback) pairs.push([key, fallback]);
    }
  }

  return pairs;
}

const files = walk(pagesDir);
const discovered = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [key, fallback] of extractKeys(text)) {
    if (!discovered.has(key)) discovered.set(key, fallback);
  }
}

const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
if (!localeFiles.includes('en.json')) {
  console.error('en.json not found in locales directory');
  process.exit(1);
}

const localeData = {};
for (const lf of localeFiles) {
  const full = path.join(localesDir, lf);
  localeData[lf] = JSON.parse(fs.readFileSync(full, 'utf8'));
}

let enAdded = 0;
for (const [key, fallback] of discovered.entries()) {
  if (ensurePath(localeData['en.json'], key, fallback)) enAdded++;
}

const addedPerLocale = {};
for (const lf of localeFiles) {
  if (lf === 'en.json') continue;
  let added = 0;
  for (const [key, fallback] of discovered.entries()) {
    if (!hasPath(localeData[lf], key)) {
      ensurePath(localeData[lf], key, fallback);
      added++;
    }
  }
  addedPerLocale[lf] = added;
}

for (const lf of localeFiles) {
  const full = path.join(localesDir, lf);
  fs.writeFileSync(full, JSON.stringify(localeData[lf], null, 2) + '\n');
}

console.log('=== i18n Key Sync ===');
console.log(`Files scanned: ${files.length}`);
console.log(`Keys discovered: ${discovered.size}`);
console.log(`Added to en.json: ${enAdded}`);
for (const [lf, count] of Object.entries(addedPerLocale)) {
  console.log(`Added to ${lf}: ${count}`);
}
