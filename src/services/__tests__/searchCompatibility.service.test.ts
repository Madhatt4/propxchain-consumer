import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchCompatibilityService,
  decorateSearchCompatibility,
  remainingValidityWeeks,
  MIN_COMPATIBLE_MATCHES,
} from '../searchCompatibility.service';
import { supabase } from '../../lib/supabase';
import { MIN_PANEL_MATCHES } from '../lenderPanel.service';
import type { Provider } from '../../components/providers/types';
import type { SearchDeclaration } from '../searchCompatibility.service';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

function mockSelect(rows: unknown[], error: { message: string } | null = null): void {
  const chain = {
    select: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
}

function makeProvider(id: string): Provider {
  return {
    id, name: `Firm ${id}`, logo: 'FF', tagline: 'x', tier: 1, price: 0,
    turnaround: 'Quote', rating: 4, reviews: 10,
    features: ['a', 'b', 'c', 'd'], regulated: 'CLC #1',
  };
}

function makeDeclaration(overrides: Partial<SearchDeclaration> = {}): SearchDeclaration {
  return {
    conveyancerId: 'a',
    acceptsSellerOrderedSearches: true,
    requiresOwnPanelProvider: false,
    reorderThresholdWeeks: null,
    ...overrides,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('remainingValidityWeeks', () => {
  it('should return the remaining weeks for a mid-life search', () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    // Issued 13 weeks ago: 26 - 13 = 13 weeks left.
    const issued = new Date(now.getTime() - 13 * WEEK_MS).toISOString();
    expect(remainingValidityWeeks(issued, now)).toBeCloseTo(13, 5);
  });

  it('should return a value at or below zero for an expired search', () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    // Issued 30 weeks ago — well past the 26-week validity window.
    const issued = new Date(now.getTime() - 30 * WEEK_MS).toISOString();
    expect(remainingValidityWeeks(issued, now)).toBeLessThanOrEqual(0);
  });

  it('should ignore any later refresh and compute solely from the original issue date', () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    // Imagine a refresh happened 2 weeks ago (24 weeks after the original) —
    // the function takes no refresh param, so it must still measure age from
    // the ORIGINAL date, not re-clock to a fresher-looking 2-weeks-old value.
    const original = new Date(now.getTime() - 24 * WEEK_MS).toISOString();
    expect(remainingValidityWeeks(original, now)).toBeCloseTo(2, 5);
  });

  it('should return NaN for an unparseable date string rather than a misleadingly large number', () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    expect(remainingValidityWeeks('not-a-date', now)).toBeNaN();
  });
});

describe('decorateSearchCompatibility', () => {
  const now = new Date('2026-08-29T00:00:00.000Z');

  it('should mark every firm not_applicable when there are no pack searches', () => {
    const providers = [makeProvider('a'), makeProvider('b')];
    const declarations = [makeDeclaration({ conveyancerId: 'a' })];
    const out = decorateSearchCompatibility(providers, declarations, {
      originalSearchIssuedAt: null,
      now,
    });
    expect(out[0].searchCompatibility).toBe('not_applicable');
    expect(out[1].searchCompatibility).toBe('not_applicable');
  });

  it('should mark every firm unknown — never accepts — when originalSearchIssuedAt is an unparseable junk string', () => {
    // Safety-critical: this is the one failure the feature must never have.
    // An unparseable date must not silently resolve to "accepts" (NaN <=
    // threshold is false, so a naive implementation would fall through to
    // accepts here) — it must degrade exactly like a missing declaration.
    const providers = [makeProvider('a'), makeProvider('b')];
    const declarations = [
      // 'a' would otherwise clearly accept: declares acceptance, no own-panel
      // requirement, no threshold at all. If the guard is missing, this is
      // exactly the case that would wrongly resolve to 'accepts'.
      makeDeclaration({ conveyancerId: 'a', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null }),
    ];
    const out = decorateSearchCompatibility(providers, declarations, {
      originalSearchIssuedAt: 'not-a-real-date',
      now,
    });
    expect(out[0].searchCompatibility).toBe('unknown');
    expect(out[0].searchCompatibility).not.toBe('accepts');
    expect(out[1].searchCompatibility).toBe('unknown');
    expect(out[0].searchCompatibilityReason).toBe("Hasn't told us");
  });

  it('should mark a firm unknown when it has no declaration row, never accepts', () => {
    const providers = [makeProvider('a')];
    const issued = new Date(now.getTime() - 4 * WEEK_MS).toISOString();
    const out = decorateSearchCompatibility(providers, [], { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('unknown');
    expect(out[0].searchCompatibilityReason).toBe("Hasn't told us");
  });

  it('should mark a firm reorders when it requires its own panel provider, even if it accepts seller searches', () => {
    const providers = [makeProvider('a')];
    const issued = new Date(now.getTime() - 4 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: true,
      requiresOwnPanelProvider: true,
    })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('reorders');
    expect(out[0].searchCompatibilityReason).toBe('Will order fresh searches');
  });

  it('should mark a firm reorders when it does not accept seller-ordered searches', () => {
    const providers = [makeProvider('a')];
    const issued = new Date(now.getTime() - 4 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: false,
      requiresOwnPanelProvider: false,
    })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('reorders');
  });

  it('should mark a firm reorders when remaining validity is at or below its reorder threshold', () => {
    const providers = [makeProvider('a')];
    // 20 weeks elapsed -> 6 weeks remaining.
    const issued = new Date(now.getTime() - 20 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: true,
      requiresOwnPanelProvider: false,
      reorderThresholdWeeks: 6,
    })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('reorders');
  });

  it('should mark a firm accepts when remaining validity is above its reorder threshold', () => {
    const providers = [makeProvider('a')];
    // 10 weeks elapsed -> 16 weeks remaining.
    const issued = new Date(now.getTime() - 10 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: true,
      requiresOwnPanelProvider: false,
      reorderThresholdWeeks: 6,
    })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('accepts');
    expect(out[0].searchCompatibilityReason).toBe('Accepts your existing searches');
  });

  it('should ignore a null reorder threshold and accept regardless of remaining validity', () => {
    const providers = [makeProvider('a')];
    // 25 weeks elapsed -> 1 week remaining, but no threshold declared.
    const issued = new Date(now.getTime() - 25 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: true,
      requiresOwnPanelProvider: false,
      reorderThresholdWeeks: null,
    })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('accepts');
  });

  it('should not mutate the input providers', () => {
    const input = [makeProvider('a')];
    const issued = new Date(now.getTime() - 4 * WEEK_MS).toISOString();
    decorateSearchCompatibility(input, [], { originalSearchIssuedAt: issued, now });
    expect(input[0].searchCompatibility).toBeUndefined();
  });

  it('should decide each provider independently', () => {
    const providers = [makeProvider('a'), makeProvider('b')];
    const issued = new Date(now.getTime() - 4 * WEEK_MS).toISOString();
    const declarations = [makeDeclaration({ conveyancerId: 'a', acceptsSellerOrderedSearches: true })];
    const out = decorateSearchCompatibility(providers, declarations, { originalSearchIssuedAt: issued, now });
    expect(out[0].searchCompatibility).toBe('accepts');
    expect(out[1].searchCompatibility).toBe('unknown');
  });
});

describe('searchCompatibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCompatibilityService.clearCache();
  });

  it('should return declarations mapped from snake_case rows and cache the result', async () => {
    mockSelect([
      {
        conveyancer_id: 'a',
        accepts_seller_ordered_searches: true,
        requires_own_panel_provider: false,
        reorder_threshold_weeks: 4,
      },
    ]);
    const first = await searchCompatibilityService.getDeclarations();
    expect(first).toEqual([{
      conveyancerId: 'a',
      acceptsSellerOrderedSearches: true,
      requiresOwnPanelProvider: false,
      reorderThresholdWeeks: 4,
    }]);
    await searchCompatibilityService.getDeclarations();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('should throw a readable error when the query fails', async () => {
    mockSelect([], { message: 'boom' });
    await expect(searchCompatibilityService.getDeclarations()).rejects.toThrow(/boom/);
  });
});

describe('MIN_COMPATIBLE_MATCHES', () => {
  it('should stay equal to MIN_PANEL_MATCHES so the two fallback thresholds cannot silently diverge', () => {
    // Deliberately coupled, not a coincidence: the brief for this feature
    // asked for the same fallback-banner UX as the lender panel, so this
    // asserts equality against the real constant rather than a literal —
    // if MIN_PANEL_MATCHES ever changes, this test forces a conscious choice
    // here too instead of the two thresholds quietly drifting apart.
    expect(MIN_COMPATIBLE_MATCHES).toBe(MIN_PANEL_MATCHES);
  });
});
