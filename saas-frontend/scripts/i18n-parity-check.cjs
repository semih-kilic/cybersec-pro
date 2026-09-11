#!/usr/bin/env node
/**
 * Fails when any locale has drifted from en.json.
 *
 * i18n-coverage-check.cjs reports hardcoded strings in components and always
 * exits 0, so nothing was actually gating locale drift: `common.workflows`
 * sat missing from six locales unnoticed. This check is the gate.
 *
 * Exits 1 on missing keys, or on a key whose value is not a string where
 * en.json has one (a shape mismatch breaks interpolation at runtime).
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const REFERENCE = 'en';

/** Flatten to dotted paths so array entries are compared element-wise too. */
function flatten(value, prefix = '', out = {}) {
  if (value !== null && typeof value === 'object') {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [`${prefix}[${i}]`, v])
      : Object.entries(value).map(([k, v]) => [prefix ? `${prefix}.${k}` : k, v]);
    for (const [key, child] of entries) flatten(child, key, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

const reference = flatten(
  JSON.parse(fs.readFileSync(path.join(localesDir, `${REFERENCE}.json`), 'utf8')),
);
const referenceKeys = Object.keys(reference);

const locales = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json'))
  .filter((l) => l !== REFERENCE)
  .sort();

let failed = false;

console.log(`i18n parity against ${REFERENCE}.json (${referenceKeys.length} keys)\n`);

for (const locale of locales) {
  const target = flatten(
    JSON.parse(fs.readFileSync(path.join(localesDir, `${locale}.json`), 'utf8')),
  );

  const missing = referenceKeys.filter((k) => !(k in target));
  const mistyped = referenceKeys.filter(
    (k) => k in target && typeof reference[k] === 'string' && typeof target[k] !== 'string',
  );

  if (missing.length || mistyped.length) {
    failed = true;
    console.error(`  FAIL ${locale}: ${missing.length} missing, ${mistyped.length} wrong type`);
    for (const k of missing.slice(0, 10)) console.error(`         missing: ${k}`);
    if (missing.length > 10) console.error(`         ...and ${missing.length - 10} more`);
    for (const k of mistyped.slice(0, 10)) console.error(`         wrong type: ${k}`);
  } else {
    console.log(`  ok   ${locale}`);
  }
}

if (failed) {
  console.error('\nLocale drift detected. Add the missing keys before merging.');
  process.exit(1);
}

console.log(`\nAll ${locales.length} locales match ${REFERENCE}.json.`);
