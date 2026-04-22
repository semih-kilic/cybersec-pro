import { describe, it, expect } from 'vitest';

import { normalizeAgentsPayload } from '../useApiQueries';

describe('normalizeAgentsPayload', () => {
  it('returns direct arrays unchanged', () => {
    const input = [{ id: 'a1', status: 'online' }];
    expect(normalizeAgentsPayload(input)).toEqual(input);
  });

  it('extracts agents from object payloads', () => {
    const input = { agents: [{ id: 'a2', status: 'offline' }] };
    expect(normalizeAgentsPayload(input)).toEqual(input.agents);
  });

  it('returns empty array for invalid payloads', () => {
    expect(normalizeAgentsPayload(null)).toEqual([]);
    expect(normalizeAgentsPayload(undefined)).toEqual([]);
    expect(normalizeAgentsPayload({})).toEqual([]);
    expect(normalizeAgentsPayload({ agents: null })).toEqual([]);
    expect(normalizeAgentsPayload({ agents: 'invalid' })).toEqual([]);
  });
});
