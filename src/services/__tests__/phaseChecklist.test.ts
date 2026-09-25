import { describe, it, expect } from 'vitest';

import {
  getChecklistForPhase,
  deriveChecklistState,
} from '../phaseChecklist';

describe('getChecklistForPhase', () => {
  it('returns at least one item per phase', () => {
    const phases = ['sellerPrep', 'buyerSetup', 'searches', 'preContract', 'preCompletion', 'completed'] as const;
    for (const p of phases) {
      expect(getChecklistForPhase(p).length).toBeGreaterThan(0);
    }
  });

  it('gives stable shape for sellerPrep', () => {
    const items = getChecklistForPhase('sellerPrep');
    expect(items.find((i) => i.id === 'property-listed')).toBeDefined();
    expect(items.find((i) => i.id === 'seller-forms')).toBeDefined();
  });
});

describe('deriveChecklistState', () => {
  it('marks everything pending when there are no events', () => {
    const state = deriveChecklistState('sellerPrep', []);
    expect(state.items.every((i) => !i.completed)).toBe(true);
    expect(state.progress).toBe(0);
  });

  it('marks items completed when a matching event is present', () => {
    const state = deriveChecklistState('sellerPrep', [
      { eventType: 'transaction_created', timestamp: 1000 },
      { eventType: 'seller_forms_completed', timestamp: 2000 },
    ]);
    const listed = state.items.find((i) => i.id === 'property-listed');
    const forms = state.items.find((i) => i.id === 'seller-forms');
    expect(listed?.completed).toBe(true);
    expect(listed?.completedAt).toBe(1000);
    expect(forms?.completed).toBe(true);
    expect(forms?.completedAt).toBe(2000);
  });

  it('picks the earliest matching event when multiple are present', () => {
    const state = deriveChecklistState('buyerSetup', [
      { eventType: 'buyer_joined', timestamp: 500 },
      { eventType: 'buyer_joined', timestamp: 200 },
      { eventType: 'buyer_joined', timestamp: 800 },
    ]);
    const joined = state.items.find((i) => i.id === 'buyer-joined');
    expect(joined?.completedAt).toBe(200);
  });

  it('calculates progress as completed/total', () => {
    const state = deriveChecklistState('searches', [
      { eventType: 'searches_ordered', timestamp: 1 },
    ]);
    // searches phase has 3 items; one complete = 1/3 ≈ 0.333
    expect(state.progress).toBeGreaterThan(0.3);
    expect(state.progress).toBeLessThan(0.4);
  });

  it('accepts provider_selected as an alternative trigger for seller-solicitor', () => {
    const state = deriveChecklistState('sellerPrep', [
      { eventType: 'provider_selected', timestamp: 100 },
    ]);
    const sellerSol = state.items.find((i) => i.id === 'seller-solicitor');
    expect(sellerSol?.completed).toBe(true);
  });
});
