import { describe, it, expect } from 'vitest';

import { NO_EVIDENCE, stagesDoneByEvidence, type StageEvidence } from '../stageEvidence';

const withEvidence = (over: Partial<StageEvidence>): StageEvidence => ({ ...NO_EVIDENCE, ...over });

describe('stagesDoneByEvidence', () => {
  it('should mark nothing done with no evidence', () => {
    expect(stagesDoneByEvidence(NO_EVIDENCE)).toEqual(new Set());
  });

  it('should mark each stage done from its own item', () => {
    const done = stagesDoneByEvidence(withEvidence({
      hasListing: true,
      hasOrderedSearches: true,
      hasPropertyForms: true,
      pack: new Map([['mortgage', 'ready'], ['survey', 'in_progress']]),
    }));
    expect(done).toEqual(new Set(['seller-1', 'seller-2', 'seller-3', 'buyer-2', 'buyer-3']));
  });

  it('should mark each stage done from the ledger event its completion writes', () => {
    const done = stagesDoneByEvidence(withEvidence({
      eventTypes: new Set(['searches_ordered', 'seller_forms_completed', 'mortgage_confirmed', 'survey_completed', 'sellers_pack_reviewed']),
    }));
    expect(done).toEqual(new Set(['seller-2', 'seller-3', 'buyer-2', 'buyer-3', 'buyer-4']));
  });

  it('should not mark Mortgage / Funding done while the mortgage is only in progress', () => {
    expect(stagesDoneByEvidence(withEvidence({ pack: new Map([['mortgage', 'in_progress']]) })).has('buyer-2')).toBe(false);
  });

  it('should not mark Property Survey done before one is booked', () => {
    expect(stagesDoneByEvidence(withEvidence({ pack: new Map([['survey', 'not_started']]) })).has('buyer-3')).toBe(false);
  });

  it('should not tick List Property from the transaction_created event alone', () => {
    expect(stagesDoneByEvidence(withEvidence({ eventTypes: new Set(['transaction_created']) })).has('seller-1')).toBe(false);
  });
});
