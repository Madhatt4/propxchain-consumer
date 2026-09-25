import { describe, it, expect } from 'vitest';

import {
  SEARCH_DEFINITIONS,
  deriveSearchesState,
  orderedCount,
  earliestExpiry,
} from '../searchesService';

const DAY = 24 * 60 * 60 * 1000;

describe('SEARCH_DEFINITIONS', () => {
  it('contains the 7 standard UK conveyancing searches', () => {
    const ids = SEARCH_DEFINITIONS.map((s) => s.id);
    expect(ids).toContain('local-authority');
    expect(ids).toContain('water-drainage');
    expect(ids).toContain('environmental');
    expect(ids).toContain('chancel');
    expect(ids).toContain('coal-mining');
    expect(ids).toContain('os1-priority');
    expect(ids).toContain('k16-bankruptcy');
    expect(ids).toHaveLength(7);
  });

  it('flags situational searches with a conditional string', () => {
    const coal = SEARCH_DEFINITIONS.find((s) => s.id === 'coal-mining');
    const k16 = SEARCH_DEFINITIONS.find((s) => s.id === 'k16-bankruptcy');
    expect(coal?.conditional).toBeDefined();
    expect(k16?.conditional).toBeDefined();
  });
});

describe('deriveSearchesState', () => {
  it('marks every search notOrdered with no events', () => {
    const states = deriveSearchesState([], 100 * DAY);
    expect(states.every((s) => s.status === 'notOrdered')).toBe(true);
    expect(states.every((s) => s.orderedAt === null)).toBe(true);
  });

  it('marks every search ordered when searches_ordered fires', () => {
    const states = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      10 * DAY,
    );
    expect(states.every((s) => s.status === 'ordered' || s.status === 'expiringSoon' || s.status === 'expired')).toBe(
      true,
    );
    expect(states.every((s) => s.orderedAt === 0)).toBe(true);
  });

  it('computes expectedBy and expiresAt from typical durations', () => {
    const states = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      0,
    );
    const local = states.find((s) => s.id === 'local-authority')!;
    expect(local.expectedBy).toBe(21 * DAY);
    expect(local.expiresAt).toBe((21 + 180) * DAY);
  });

  it('flags expiringSoon when expiry is within 30 days', () => {
    // OS1 has a 42-day validity; at day 13 since order, expiry (43 days away) is close but not under 30.
    // At day 25 since order, expiry is 18 days away → expiringSoon.
    const os1 = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      25 * DAY,
    ).find((s) => s.id === 'os1-priority')!;
    expect(os1.status).toBe('expiringSoon');
  });

  it('flags expired once now is past expiresAt', () => {
    const os1 = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      100 * DAY,
    ).find((s) => s.id === 'os1-priority')!;
    expect(os1.status).toBe('expired');
  });

  it('uses the earliest searches_ordered timestamp when multiple fire', () => {
    const states = deriveSearchesState(
      [
        { eventType: 'searches_ordered', timestamp: 500 },
        { eventType: 'searches_ordered', timestamp: 100 },
        { eventType: 'searches_ordered', timestamp: 300 },
      ],
      1000,
    );
    expect(states.every((s) => s.orderedAt === 100)).toBe(true);
  });

  it('computes daysUntilExpiry as a non-negative integer', () => {
    const states = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      30 * DAY,
    );
    const local = states.find((s) => s.id === 'local-authority')!;
    // 21 + 180 - 30 = 171
    expect(local.daysUntilExpiry).toBe(171);
  });
});

describe('orderedCount + earliestExpiry helpers', () => {
  it('orderedCount returns 0 when no searches are ordered', () => {
    expect(orderedCount(deriveSearchesState([], 0))).toBe(0);
  });

  it('orderedCount returns all 7 when searches_ordered fires', () => {
    const states = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      10 * DAY,
    );
    expect(orderedCount(states)).toBe(7);
  });

  it('earliestExpiry returns the shortest-lived validity (OS1 or K16 at 42 days)', () => {
    const states = deriveSearchesState(
      [{ eventType: 'searches_ordered', timestamp: 0 }],
      0,
    );
    // Shortest validity is OS1/K16: 1 + 42 = 43 days.
    expect(earliestExpiry(states)).toBe(43 * DAY);
  });

  it('earliestExpiry returns null if no searches are ordered', () => {
    expect(earliestExpiry(deriveSearchesState([], 0))).toBeNull();
  });
});
