import { describe, it, expect } from 'vitest';

import { normalizeScansPayload } from '../useApiQueries';

describe('normalizeScansPayload', () => {
  it('returns direct arrays unchanged', () => {
    const input = [{ id: 'scan-1', status: 'running' }];
    expect(normalizeScansPayload(input)).toEqual(input);
  });

  it('extracts scans from object payloads', () => {
    const input = { scans: [{ id: 'scan-2', status: 'completed' }] };
    expect(normalizeScansPayload(input)).toEqual(input.scans);
  });

  it('returns empty array for invalid payloads', () => {
    expect(normalizeScansPayload(null)).toEqual([]);
    expect(normalizeScansPayload(undefined)).toEqual([]);
    expect(normalizeScansPayload({})).toEqual([]);
    expect(normalizeScansPayload({ scans: null })).toEqual([]);
    expect(normalizeScansPayload({ scans: 'invalid' })).toEqual([]);
  });
});
