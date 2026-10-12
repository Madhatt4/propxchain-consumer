// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { describeSearchAge, searchAgeFromEvents } from '../searchAge';

const NOW = Date.UTC(2026, 9, 11);
const daysAgo = (d: number): number => NOW - d * 86_400_000;

describe('searchAgeFromEvents', () => {
  it('is null until searches are ordered', () => {
    expect(searchAgeFromEvents([{ eventType: 'transaction_created', timestamp: daysAgo(300) }], NOW)).toBeNull();
  });
  it('dates from the earliest searches_ordered event', () => {
    const age = searchAgeFromEvents(
      [
        { eventType: 'searches_ordered', timestamp: daysAgo(30) },
        { eventType: 'searches_ordered', timestamp: daysAgo(130) },
      ],
      NOW,
    );
    expect(age).toMatchObject({ state: 'ageing', ageDays: 130, daysLeft: 53 });
  });
  it('reads nanosecond ledger timestamps', () => {
    const ns = daysAgo(10) * 1_000_000;
    expect(searchAgeFromEvents([{ eventType: 'searches_ordered', timestamp: ns }], NOW)).toMatchObject({ state: 'ok', ageDays: 10 });
  });
  it('matches the monitor thresholds: ageing at 122 days, expired at 183', () => {
    const at = (d: number) => searchAgeFromEvents([{ eventType: 'searches_ordered', timestamp: daysAgo(d) }], NOW)?.state;
    expect([at(121), at(122), at(182), at(183)]).toEqual(['ok', 'ageing', 'ageing', 'expired']);
  });
  it('says what to do in each state', () => {
    const ageing = searchAgeFromEvents([{ eventType: 'searches_ordered', timestamp: daysAgo(125) }], NOW)!;
    expect(describeSearchAge(ageing)).toMatch(/125 days old.*in 58 days/);
    const expired = searchAgeFromEvents([{ eventType: 'searches_ordered', timestamp: daysAgo(200) }], NOW)!;
    expect(describeSearchAge(expired)).toMatch(/past the six months/);
  });
});
