import { describe, it, expect, beforeEach } from 'vitest';

import {
  evaluateTrigger,
  lastBlockerKey,
  readLastBlocker,
  writeLastBlocker,
  NO_BLOCKER,
} from '../moveNarrator.detection';

describe('moveNarrator.detection — evaluateTrigger', () => {
  it('should treat the first observation (no stored blocker) as baseline, not a fire', () => {
    // Arrange / Act
    const decision = evaluateTrigger({
      currentBlocker: 'no_solicitor',
      lastBlocker: null,
      isPremium: true,
    });

    // Assert
    expect(decision).toBe('update_only');
  });

  it('should fire when a premium user\'s blocker changes to a real blocker', () => {
    const decision = evaluateTrigger({
      currentBlocker: 'hmlr_not_fetched',
      lastBlocker: 'no_solicitor',
      isPremium: true,
    });

    expect(decision).toBe('fire');
  });

  it('should never fire for a free-tier user, only record the change', () => {
    const decision = evaluateTrigger({
      currentBlocker: 'hmlr_not_fetched',
      lastBlocker: 'no_solicitor',
      isPremium: false,
    });

    expect(decision).toBe('update_only');
  });

  it('should be a no-op when the blocker is unchanged (dedup)', () => {
    const decision = evaluateTrigger({
      currentBlocker: 'no_solicitor',
      lastBlocker: 'no_solicitor',
      isPremium: true,
    });

    expect(decision).toBe('noop');
  });

  it('should record but never fire when the blocker clears to none', () => {
    const decision = evaluateTrigger({
      currentBlocker: NO_BLOCKER,
      lastBlocker: 'hmlr_not_fetched',
      isPremium: true,
    });

    expect(decision).toBe('update_only');
  });

  it('should no-op on an empty/unknown current blocker rather than firing', () => {
    const decision = evaluateTrigger({
      currentBlocker: '',
      lastBlocker: 'no_solicitor',
      isPremium: true,
    });

    expect(decision).toBe('noop');
  });
});

describe('moveNarrator.detection — lastBlocker storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should namespace the storage key per transaction', () => {
    expect(lastBlockerKey('tx_abc')).toBe('moveNarrator:lastBlocker:tx_abc');
  });

  it('should return null before any blocker has been recorded', () => {
    expect(readLastBlocker('tx_abc')).toBeNull();
  });

  it('should round-trip a recorded blocker', () => {
    writeLastBlocker('tx_abc', 'no_solicitor');

    expect(readLastBlocker('tx_abc')).toBe('no_solicitor');
  });

  it('should keep blockers isolated between transactions', () => {
    writeLastBlocker('tx_one', 'no_solicitor');
    writeLastBlocker('tx_two', 'hmlr_not_fetched');

    expect(readLastBlocker('tx_one')).toBe('no_solicitor');
    expect(readLastBlocker('tx_two')).toBe('hmlr_not_fetched');
  });
});
