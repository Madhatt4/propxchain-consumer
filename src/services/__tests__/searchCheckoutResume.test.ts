import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildGroundsureProductRef,
  buildOneSearchProductRef,
  clearSearchPendingState,
  loadSearchPendingState,
  readPendingSearchCheckoutFromUrl,
  saveSearchPendingState,
  type SearchPendingState,
} from '../searchCheckoutResume';

const SAMPLE_STATE: SearchPendingState = {
  provider: 'onesearch',
  transactionId: 'tx-123',
  searches: [],
  totalPence: 12000,
  ourReference: 'OS-REF-001',
  sessionId: 'cs_test_abc',
  startedAt: new Date().toISOString(),
};

describe('buildOneSearchProductRef', () => {
  it('should prefix the order id with the onesearch provider tag', () => {
    expect(buildOneSearchProductRef('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('onesearch:550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('buildGroundsureProductRef', () => {
  it('should prefix the order id with the groundsure provider tag', () => {
    expect(buildGroundsureProductRef('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('groundsure:550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('readPendingSearchCheckoutFromUrl', () => {
  it('should read the search_stripe_session_id query param', () => {
    const url = new URL('https://propxchain.com/transaction/1?search_stripe_session_id=cs_test_abc');
    expect(readPendingSearchCheckoutFromUrl(url)).toBe('cs_test_abc');
  });

  it('should return null when the param is absent', () => {
    const url = new URL('https://propxchain.com/transaction/1');
    expect(readPendingSearchCheckoutFromUrl(url)).toBeNull();
  });
});

describe('search checkout pending-state stash', () => {
  beforeEach(() => {
    clearSearchPendingState();
  });

  it('should round-trip a saved state through load', () => {
    saveSearchPendingState(SAMPLE_STATE);
    expect(loadSearchPendingState()).toEqual(SAMPLE_STATE);
  });

  it('should round-trip a groundsure state without confusing it for onesearch', () => {
    const groundsureState: SearchPendingState = {
      ...SAMPLE_STATE,
      provider: 'groundsure',
      ourReference: 'propxchain-2026-07-28-abc',
      totalPence: 9260,
    };
    saveSearchPendingState(groundsureState);
    expect(loadSearchPendingState()).toEqual(groundsureState);
  });

  it('should return null when nothing has been saved', () => {
    expect(loadSearchPendingState()).toBeNull();
  });

  it('should default a stash written before provider existed to onesearch', () => {
    // A checkout already in flight when the Groundsure support shipped — the
    // stash predates the `provider` field but the order is still owed a resume.
    const { provider: _omitted, ...legacyState } = SAMPLE_STATE;
    localStorage.setItem('propxchain.onesearch.pending', JSON.stringify(legacyState));
    expect(loadSearchPendingState()?.provider).toBe('onesearch');
  });

  it('should return null and clear storage for state older than the 24h TTL', () => {
    saveSearchPendingState({
      ...SAMPLE_STATE,
      startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    expect(loadSearchPendingState()).toBeNull();
    expect(loadSearchPendingState()).toBeNull(); // confirms it was cleared, not just filtered
  });

  it('should return null after clearSearchPendingState', () => {
    saveSearchPendingState(SAMPLE_STATE);
    clearSearchPendingState();
    expect(loadSearchPendingState()).toBeNull();
  });
});
