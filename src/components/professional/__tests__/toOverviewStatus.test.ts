import { describe, it, expect } from 'vitest';

import { toOverviewStatus } from '../toOverviewStatus';

/**
 * The panel falls back to 'active' for any status it does not recognise, so a
 * wrong mapping here never throws — it quietly misreports the stats, since
 * derivePhase reads this alongside the ledger milestones. These pin the two
 * real equivalences and, just as importantly, that the fallback only catches
 * genuinely pre-exchange states.
 */
describe('toOverviewStatus', () => {
  it('should map an exchanged listing or plot to exchanged', () => {
    expect(toOverviewStatus('exchanged')).toBe('exchanged');
  });

  it('should map a completed listing or plot to blockchain_completed', () => {
    expect(toOverviewStatus('completed')).toBe('blockchain_completed');
  });

  it.each([
    'draft',
    'for_sale',
    'under_offer',
    'sold_stc',
    'withdrawn',
  ])('should treat the pre-exchange agent status %s as active', (status) => {
    expect(toOverviewStatus(status)).toBe('active');
  });

  it('should treat a plot with no legal status yet as active', () => {
    // plots.current_legal_status is null until conveyancing starts.
    expect(toOverviewStatus(null)).toBe('active');
    expect(toOverviewStatus(undefined)).toBe('active');
  });

  it('should not smuggle an unknown status through as itself', () => {
    // The panel would silently fall back to 'active' anyway; returning the
    // raw string would just move the guess one layer down.
    expect(toOverviewStatus('some_future_status')).toBe('active');
  });
});
