import { describe, it, expect } from 'vitest';

import {
  derivePhase,
  extractMilestonesFromEvents,
  emptyMilestones,
  statusIsCompleted,
  statusIsExchanged,
  PHASE_ORDER,
  type PhaseInput,
} from '../phase';

describe('derivePhase', () => {
  function baseInput(overrides: Partial<PhaseInput> = {}): PhaseInput {
    return {
      isCompleted: false,
      isExchanged: false,
      buyer: 'buyer-p',
      seller: 'seller-p',
      milestones: emptyMilestones(),
      ...overrides,
    };
  }

  it('returns #sellerPrep when buyer == seller and no milestones', () => {
    expect(derivePhase(baseInput({ buyer: 'same', seller: 'same' }))).toBe('sellerPrep');
  });

  it('returns #buyerSetup when buyer differs from seller but no milestones', () => {
    expect(derivePhase(baseInput())).toBe('buyerSetup');
  });

  it('returns #searches when searchesOrderedAt is set and buyer joined', () => {
    const input = baseInput({ milestones: { searchesOrderedAt: 1, contractDraftedAt: null } });
    expect(derivePhase(input)).toBe('searches');
  });

  it('returns #preContract when contractDraftedAt is set and buyer joined', () => {
    const input = baseInput({ milestones: { searchesOrderedAt: 1, contractDraftedAt: 2 } });
    expect(derivePhase(input)).toBe('preContract');
  });

  it('returns #preContract even without searches if contract is drafted (DIY supported)', () => {
    const input = baseInput({ milestones: { searchesOrderedAt: null, contractDraftedAt: 2 } });
    expect(derivePhase(input)).toBe('preContract');
  });

  it('returns #preCompletion when isExchanged is true, overriding milestone rules', () => {
    const input = baseInput({
      isExchanged: true,
      milestones: { searchesOrderedAt: 1, contractDraftedAt: 2 },
    });
    expect(derivePhase(input)).toBe('preCompletion');
  });

  it('returns #completed when isCompleted is true, overriding everything below', () => {
    const input = baseInput({
      isCompleted: true,
      isExchanged: true,
      milestones: { searchesOrderedAt: 1, contractDraftedAt: 2 },
    });
    expect(derivePhase(input)).toBe('completed');
  });

  it('ignores milestone timestamps when the buyer has not joined', () => {
    const input = baseInput({
      buyer: 'same',
      seller: 'same',
      milestones: { searchesOrderedAt: 1, contractDraftedAt: 2 },
    });
    expect(derivePhase(input)).toBe('sellerPrep');
  });
});

describe('extractMilestonesFromEvents', () => {
  it('returns null for both timestamps when no relevant events are present', () => {
    expect(
      extractMilestonesFromEvents([
        { eventType: 'transaction_created', timestamp: 100 },
        { eventType: 'document_uploaded', timestamp: 200 },
      ]),
    ).toEqual({ searchesOrderedAt: null, contractDraftedAt: null });
  });

  it('captures the earliest searches_ordered event', () => {
    const ms = extractMilestonesFromEvents([
      { eventType: 'searches_ordered', timestamp: 300 },
      { eventType: 'searches_ordered', timestamp: 100 },
      { eventType: 'searches_ordered', timestamp: 200 },
    ]);
    expect(ms.searchesOrderedAt).toBe(100);
  });

  it('uses party_signature as the contract drafted proxy', () => {
    const ms = extractMilestonesFromEvents([
      { eventType: 'party_signature', timestamp: 500 },
    ]);
    expect(ms.contractDraftedAt).toBe(500);
  });

  it('prefers contract_drafted over party_signature when both are present', () => {
    const ms = extractMilestonesFromEvents([
      { eventType: 'party_signature', timestamp: 500 },
      { eventType: 'contract_drafted', timestamp: 400 },
    ]);
    expect(ms.contractDraftedAt).toBe(400);
  });
});

describe('status helpers', () => {
  it('statusIsCompleted returns true for blockchain_completed', () => {
    expect(statusIsCompleted({ blockchain_completed: null })).toBe(true);
  });
  it('statusIsCompleted returns true for land_registry_registered', () => {
    expect(statusIsCompleted({ land_registry_registered: null })).toBe(true);
  });
  it('statusIsCompleted returns false for active', () => {
    expect(statusIsCompleted({ active: null })).toBe(false);
  });
  it('statusIsExchanged returns true for exchanged', () => {
    expect(statusIsExchanged({ exchanged: null })).toBe(true);
  });
  it('statusIsExchanged returns true for completion_initiated', () => {
    expect(statusIsExchanged({ completion_initiated: null })).toBe(true);
  });
  it('statusIsExchanged returns false for blockchain_completed', () => {
    expect(statusIsExchanged({ blockchain_completed: null })).toBe(false);
  });
  it('status helpers tolerate null/undefined input', () => {
    expect(statusIsCompleted(null)).toBe(false);
    expect(statusIsExchanged(undefined)).toBe(false);
  });
});

describe('PHASE_ORDER', () => {
  it('has exactly 6 phases in the documented order', () => {
    expect(PHASE_ORDER).toEqual([
      'sellerPrep',
      'buyerSetup',
      'searches',
      'preContract',
      'preCompletion',
      'completed',
    ]);
  });
});
