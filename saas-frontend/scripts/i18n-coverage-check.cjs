#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'src', 'pages');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

function analyzeFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const hasUseTranslation = /useTranslation\s*\(/.test(text);
  const hasTCalls = /\bt\s*\(/.test(text);

  const probableHardcoded = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('t(')) continue;
    if (/^\s*\/\//.test(line)) continue;
    if (/^\s*import\s+/.test(line)) continue;
    if (/^\s*<[^>]+>[^<{][A-Za-z][^<{]*<\//.test(line)) {
      probableHardcoded.push(i + 1);
    }
    if (/placeholder=\"[A-Za-z]/.test(line) || /title=\"[A-Za-z]/.test(line)) {
      probableHardcoded.push(i + 1);
    }
  }

  return {
    filePath: path.relative(root, filePath),
    hasUseTranslation,
    hasTCalls,
    probableHardcodedLines: Array.from(new Set(probableHardcoded)).slice(0, 20),
  };
}

const files = walk(pagesDir);
const report = files.map(analyzeFile);

const withoutI18n = report.filter(r => !r.hasUseTranslation);
const withNoTCalls = report.filter(r => r.hasUseTranslation && !r.hasTCalls);
const withHardcoded = report.filter(r => r.probableHardcodedLines.length > 0);

console.log('=== i18n Coverage Report ===');
console.log(`Pages scanned: ${report.length}`);
console.log(`Without useTranslation: ${withoutI18n.length}`);
console.log(`With useTranslation but no t() calls: ${withNoTCalls.length}`);
console.log(`With probable hardcoded UI text: ${withHardcoded.length}`);

if (withoutI18n.length) {
  console.log('\n-- Without useTranslation --');
  for (const r of withoutI18n.slice(0, 30)) console.log(r.filePath);
}

if (withNoTCalls.length) {
  console.log('\n-- useTranslation present but no t() calls --');
  for (const r of withNoTCalls.slice(0, 30)) console.log(r.filePath);
}

if (withHardcoded.length) {
  console.log('\n-- Probable hardcoded text lines --');
  for (const r of withHardcoded.slice(0, 30)) {
    console.log(`${r.filePath}: ${r.probableHardcodedLines.join(', ')}`);
  }
}

const outPath = path.join(root, 'i18n-coverage-report.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
console.log(`\nDetailed JSON report: ${path.relative(root, outPath)}`);
