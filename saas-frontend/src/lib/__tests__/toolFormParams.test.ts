import { describe, it, expect } from 'vitest';

import {
  coerceParamDefault,
  getFormMeta,
  isSecretParam,
  parseFormParameters,
  parseObjectParameters,
  resolveSelectOption,
  toParameterMap,
} from '../toolFormParams';

/** The shape the backend seeds for every `ht_*` and curated tool. */
const formShaped = {
  form: [
    { name: 'target', label: 'Target host', type: 'url', required: true },
    { name: 'api_key', label: 'API key', type: 'text' },
    { name: 'mode', label: 'Mode', type: 'select', options: [{ label: 'Fast scan', value: 'fast' }] },
    { name: 'threads', label: 'Threads', type: 'number', default: 10 },
  ],
  danger_level: 'medium',
  target_types: ['ip', 'domain'],
};

describe('parseFormParameters', () => {
  it('returns null for a tool that is not form-shaped, and [] for one with no fields', () => {
    // The tool detail page branches on this difference: null falls through to
    // the static config, [] deliberately stays empty.
    expect(parseFormParameters({ target: { type: 'string' } })).toBeNull();
    expect(parseFormParameters(null)).toBeNull();
    expect(parseFormParameters([{ name: 'x' }])).toBeNull();
    expect(parseFormParameters({ form: [] })).toEqual([]);
  });

  it('maps url, email and password onto the text renderer', () => {
    const params = parseFormParameters({
      form: [
        { name: 'a', type: 'url' },
        { name: 'b', type: 'email' },
        { name: 'c', type: 'password' },
        { name: 'd', type: 'select' },
      ],
    })!;
    expect(params.map((p) => p.type)).toEqual(['text', 'text', 'text', 'select']);
  });

  it('flags credential fields as secret, by type and by name', () => {
    const params = parseFormParameters({
      form: [
        { name: 'target', type: 'text' },
        { name: 'api_key', type: 'text' },
        { name: 'passphrase', type: 'text' },
        { name: 'auth_token', type: 'text' },
        { name: 'db_credential', type: 'text' },
        { name: 'plain', type: 'password' },
      ],
    })!;
    expect(params.filter((p) => p.secret).map((p) => p.name)).toEqual([
      'api_key',
      'passphrase',
      'auth_token',
      'db_credential',
      'plain',
    ]);
  });

  it('falls back to the default for a missing placeholder, and keeps both as strings', () => {
    const [p] = parseFormParameters({ form: [{ name: 'threads', type: 'number', default: 10 }] })!;
    expect(p.default).toBe('10');
    expect(p.placeholder).toBe('10');
  });

  it('skips entries with no usable name', () => {
    const params = parseFormParameters({
      form: [{ name: '' }, { label: 'orphan' }, null, 'nonsense', { name: 'real' }],
    })!;
    expect(params.map((p) => p.name)).toEqual(['real']);
  });

  it('drops non-numeric min and max rather than handing them to a number input', () => {
    const [p] = parseFormParameters({
      form: [{ name: 'n', type: 'number', min: '1', max: 20 }],
    })!;
    expect(p.min).toBeUndefined();
    expect(p.max).toBe(20);
  });
});

describe('getFormMeta', () => {
  it('reads the keys that sit beside the field list', () => {
    expect(getFormMeta(formShaped)).toEqual({
      target_types: ['ip', 'domain'],
      danger_level: 'medium',
    });
  });

  it('survives a tool with no metadata at all', () => {
    expect(getFormMeta({ form: [] })).toEqual({ target_types: undefined, danger_level: undefined });
    expect(getFormMeta(null)).toEqual({});
    expect(getFormMeta([1, 2])).toEqual({});
  });

  // The regression this module exists for: the scan page used to overwrite
  // `tool.parameters` with the flattened field map, after which the metadata
  // it read from that same object was gone.
  it('still reads the metadata after the fields have been flattened separately', () => {
    const params = parseFormParameters(formShaped)!;
    expect(params).toHaveLength(4);
    expect(getFormMeta(formShaped).target_types).toEqual(['ip', 'domain']);
  });
});

describe('parseObjectParameters', () => {
  it('handles the plain-object shape the catalogue uses for simple tools', () => {
    const [p] = parseObjectParameters({ target: { type: 'string', required: true } });
    expect(p).toMatchObject({ name: 'target', type: 'string', required: true, group: 'General' });
  });

  it('never renders the form metadata keys as inputs', () => {
    const params = parseObjectParameters({
      target: { type: 'string' },
      form: [{ name: 'x' }],
      danger_level: 'high',
      target_types: ['ip'],
    });
    expect(params.map((p) => p.name)).toEqual(['target']);
  });

  it('flags a credential key even when it carries a description', () => {
    const [p] = parseObjectParameters({ api_key: { type: 'string', description: 'Service key' } });
    expect(p.secret).toBe(true);
  });

  it('returns [] for arrays, null and primitives', () => {
    expect(parseObjectParameters([])).toEqual([]);
    expect(parseObjectParameters(null)).toEqual([]);
    expect(parseObjectParameters('target')).toEqual([]);
  });
});

describe('resolveSelectOption', () => {
  it('resolves curated { label, value } options — rendering these raw throws React #31', () => {
    expect(resolveSelectOption({ label: 'Fast scan', value: 'fast' }, 0)).toEqual({
      value: 'fast',
      label: 'Fast scan',
      key: 'fast-0',
    });
  });

  it('takes the first word of a legacy string option as the value', () => {
    expect(resolveSelectOption('aws  Amazon Web Services', 2)).toEqual({
      value: 'aws',
      label: 'aws  Amazon Web Services',
      key: 'aws-2',
    });
  });

  it('falls back to the value when an object carries no label', () => {
    expect(resolveSelectOption({ value: 'gcp' }, 1).label).toBe('gcp');
  });
});

describe('coerceParamDefault', () => {
  it('passes booleans and numbers through untouched', () => {
    expect(coerceParamDefault(false)).toBe(false);
    expect(coerceParamDefault(0)).toBe(0);
  });

  it('unwraps a { label, value } default to its value', () => {
    expect(coerceParamDefault({ label: 'Fast', value: 'fast' })).toBe('fast');
  });

  it('returns undefined for null and undefined, not the string "null"', () => {
    expect(coerceParamDefault(null)).toBeUndefined();
    expect(coerceParamDefault(undefined)).toBeUndefined();
  });
});

describe('toParameterMap', () => {
  it('keys the flattened fields by name for map-shaped renderers', () => {
    const map = toParameterMap(parseFormParameters(formShaped)!);
    expect(Object.keys(map)).toEqual(['target', 'api_key', 'mode', 'threads']);
    expect(map.api_key.secret).toBe(true);
  });
});

describe('isSecretParam', () => {
  it('matches the documented credential name patterns, case-insensitively', () => {
    expect(isSecretParam('API_KEY', 'text')).toBe(true);
    expect(isSecretParam('apikey', 'text')).toBe(true);
    expect(isSecretParam('Password', 'text')).toBe(true);
    expect(isSecretParam('target', 'password')).toBe(true);
    expect(isSecretParam('target', 'text')).toBe(false);
    expect(isSecretParam(undefined, undefined)).toBe(false);
  });
});
