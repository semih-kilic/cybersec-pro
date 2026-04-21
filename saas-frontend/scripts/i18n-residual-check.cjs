#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'src', 'i18n', 'locales');
const baseLocale = 'en';
const targetLocales = ['de', 'es', 'fr', 'it'];

function loadLocale(locale) {
  const filePath = path.join(localesDir, `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function flattenLeafPaths(obj, prefix = '', out = []) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.push(prefix);
    return out;
  }

  for (const key of Object.keys(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    flattenLeafPaths(obj[key], next, out);
  }

  return out;
}

function run() {
  const base = loadLocale(baseLocale);
  const allPaths = flattenLeafPaths(base);

  let remainingTotal = 0;
  const byScope = new Map();

  for (const locale of targetLocales) {
    const current = loadLocale(locale);

    for (const keyPath of allPaths) {
      const baseValue = getValue(base, keyPath);
      const currentValue = getValue(current, keyPath);

      if (currentValue === baseValue) {
        remainingTotal += 1;
        const scope = keyPath.split('.')[0];
        byScope.set(scope, (byScope.get(scope) || 0) + 1);
      }
    }
  }

  const sortedScopes = Array.from(byScope.entries()).sort((a, b) => b[1] - a[1]);
  const reportPath = path.join(root, 'i18n-residual-report.json');

  console.log('=== i18n Residual Check ===');
  console.log(`Base locale: ${baseLocale}`);
  console.log(`Target locales: ${targetLocales.join(', ')}`);
  console.log(`Scopes scanned: ${Object.keys(base).length}`);
  console.log(`Same-as-English residual keys: ${remainingTotal}`);

  if (sortedScopes.length > 0) {
    console.log('\nTop residual scopes:');
    for (const [scope, count] of sortedScopes.slice(0, 10)) {
      console.log(`- ${scope}: ${count}`);
    }
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        baseLocale,
        targetLocales,
        scopesScanned: Object.keys(base).length,
        sameAsEnglishResidualKeys: remainingTotal,
        topResidualScopes: sortedScopes.slice(0, 10).map(([scope, count]) => ({ scope, count })),
      },
      null,
      2
    )
  );
  console.log(`\nDetailed JSON report: ${path.relative(root, reportPath)}`);

  if (remainingTotal > 0) {
    process.exitCode = 1;
  }
}

run();
