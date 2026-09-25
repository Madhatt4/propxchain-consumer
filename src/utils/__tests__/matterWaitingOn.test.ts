import { describe, it, expect } from 'vitest';

import { getWaitingOn, sortByWaitingOn, type WaitingOn } from '../matterWaitingOn';

const NO_DOCS = { hasTR1: false, hasAP1: false };
const BOTH_DOCS = { hasTR1: true, hasAP1: true };

describe('getWaitingOn', () => {
  it.each([
    ['exchanged', 'AP1 preparation follows exchange'],
    ['completion_initiated', 'the milestone label is literally "Awaiting AP1 submission"'],
  ])('should put %s on the conveyancer — %s', (status) => {
    expect(getWaitingOn(status, NO_DOCS)).toBe('you');
  });

  it.each([
    ['active', 'awaiting the seller\'s documents and the search provider'],
  ])('should put %s on someone else — %s', (status) => {
    expect(getWaitingOn(status, NO_DOCS)).toBe('others');
  });

  it('should treat a registered matter as finished', () => {
    expect(getWaitingOn('land_registry_registered', BOTH_DOCS)).toBe('done');
  });

  it('should keep a completed matter on the conveyancer while the AP1 is outstanding', () => {
    // Completion is recorded but step 5 — submit to HMLR — is still theirs.
    expect(getWaitingOn('blockchain_completed', NO_DOCS)).toBe('you');
  });

  it('should call a completed matter done once the AP1 is in', () => {
    expect(getWaitingOn('blockchain_completed', BOTH_DOCS)).toBe('done');
  });

  it('should not claim an unknown status needs the conveyancer', () => {
    // Guessing 'you' would push a matter to the top of the desk on no evidence.
    expect(getWaitingOn('something-new', NO_DOCS)).toBe('others');
    // The eight statuses the consumer used to invent fall here too.
    expect(getWaitingOn('contract-prep', NO_DOCS)).toBe('others');
    expect(getWaitingOn('completed', BOTH_DOCS)).toBe('others');
    expect(getWaitingOn('', NO_DOCS)).toBe('others');
  });
});

describe('sortByWaitingOn', () => {
  const of = (w: WaitingOn) => ({ w });
  const waitingOnOf = (item: { w: WaitingOn }): WaitingOn => item.w;

  it('should put what needs you first, then others, then done', () => {
    const sorted = sortByWaitingOn(
      [of('done'), of('others'), of('you'), of('done'), of('you')],
      waitingOnOf,
    );

    expect(sorted.map((i) => i.w)).toEqual(['you', 'you', 'others', 'done', 'done']);
  });

  it('should preserve the original order within a group', () => {
    // Otherwise the desk reshuffles under the cursor on every poll.
    const a = { w: 'you' as WaitingOn, id: 'a' };
    const b = { w: 'you' as WaitingOn, id: 'b' };
    const c = { w: 'you' as WaitingOn, id: 'c' };

    expect(sortByWaitingOn([a, b, c], waitingOnOf).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('should not mutate the array it was given', () => {
    const input = [of('done'), of('you')];
    const before = input.map((i) => i.w);

    sortByWaitingOn(input, waitingOnOf);

    expect(input.map((i) => i.w)).toEqual(before);
  });

  it('should handle an empty desk', () => {
    expect(sortByWaitingOn([], waitingOnOf)).toEqual([]);
  });
});

describe('sortByWaitingOn with the longest wait first', () => {
  it('orders the longer wait first inside a group and keeps the group order', () => {
    const items = [
      { id: 'a', w: 'others' as const, d: 3 },
      { id: 'b', w: 'you' as const, d: 2 },
      { id: 'c', w: 'you' as const, d: 9 },
      { id: 'd', w: 'others' as const, d: 0 },
    ];
    const ordered = sortByWaitingOn(items, (i) => i.w, (i) => i.d);
    expect(ordered.map((i) => i.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('equal waits keep arrival order', () => {
    const items = [{ id: 'a', w: 'you' as const, d: 4 }, { id: 'b', w: 'you' as const, d: 4 }];
    expect(sortByWaitingOn(items, (i) => i.w, (i) => i.d).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
