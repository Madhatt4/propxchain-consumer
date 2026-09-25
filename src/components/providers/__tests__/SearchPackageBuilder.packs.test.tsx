import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchPackageBuilder from '../SearchPackageBuilder';

const hookState = {
  current: {
    quote: null as unknown,
    isQuoting: false,
    linePence: new Map<string, number>(),
    unpriceable: new Set<string>(),
  },
};

vi.mock('../useTmGroupCatalogueQuote', () => ({
  useTmGroupCatalogueQuote: () => hookState.current,
}));

const PROPS = { postcode: 'SG19 1EX', localAuthority: 'Central Bedfordshire' };

/** Every line in the official Homebuyers pack, plus the standard bundle's own. */
const PRICED = new Map<string, number>([
  ['TMGLLC1', 3600],
  ['TMGCon29', 0],
  ['Con29DW', 6540],
  ['GSEnviro', 9260],
  ['PSReport12', 8340],
  ['EnviroschR', 6810],
]);

function renderPriced(): void {
  hookState.current = {
    quote: { success: true, lines: [], unpricedProductTypes: [] },
    isQuoting: false,
    linePence: PRICED,
    unpriceable: new Set(),
  };
  render(<SearchPackageBuilder {...PROPS} />);
}

describe('SearchPackageBuilder tmGroup pack selection', () => {
  it('should default to build-your-own so no pack is chosen on the customer’s behalf', () => {
    renderPriced();

    expect(screen.getByLabelText(/Build your own/)).toBeChecked();
    expect(screen.getByText('Standard bundle — always included')).toBeInTheDocument();
  });

  it('should replace the standard bundle when a pack is chosen, not add to it', () => {
    renderPriced();

    fireEvent.click(screen.getByRole('radio', { name: /Official — Homebuyers/ }));

    expect(screen.getByText('Official — Homebuyers — included')).toBeInTheDocument();
    // The regulated personal search and the Landmark environmental belong to the
    // standard bundle, NOT to this pack. Merging the two would sell two
    // environmental reports on one property and charge for both.
    expect(screen.queryByText('Regulated Personal Local Search')).toBeNull();
    expect(screen.queryByText('Landmark Envirosearch Residential')).toBeNull();
    expect(screen.getByText('Register of Local Land Charges (official)')).toBeInTheDocument();
    expect(screen.getByText('Groundsure Homebuyers')).toBeInTheDocument();
  });

  it('should not offer a pack search as an unticked optional extra as well', () => {
    renderPriced();

    fireEvent.click(screen.getByRole('radio', { name: /Official — Homebuyers/ }));

    // GSEnviro is inside the pack; it must not also appear as a checkbox that
    // reads "not included" for something they are buying.
    expect(screen.queryByRole('checkbox', { name: /Groundsure Homebuyers/ })).toBeNull();
  });

  it('should offer every pack now tmGroup has activated all the codes', () => {
    // Until 2026-09-01 the three regulated packs rendered disabled, naming
    // CDSRegWDR as what they waited on. That code was never missing from
    // tmGroup's catalogue — it was not activated on our DEMO20 account.
    renderPriced();

    expect(screen.getByRole('radio', { name: /Regulated — Homebuyers/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Official — Homebuyers/ })).toBeEnabled();
    expect(screen.queryByText(/waiting on tmGroup to confirm/)).toBeNull();
  });

  it('should warn that official packs carry council and water fees on top', () => {
    renderPriced();

    expect(
      screen.getAllByText(/Council and water authority fees are charged on top at cost/).length,
    ).toBeGreaterThan(0);
  });

  it('should show a dash rather than a total when a pack line could not be priced', () => {
    hookState.current = {
      quote: { success: true, lines: [], unpricedProductTypes: ['GSEnviro'] },
      isQuoting: false,
      linePence: PRICED,
      unpriceable: new Set(['GSEnviro']),
    };

    render(<SearchPackageBuilder {...PROPS} />);

    // A total that silently omits an unpriced search is worse than no total.
    const packRow = screen.getByRole('radio', { name: /Official — Homebuyers/ }).closest('label');
    expect(packRow).not.toBeNull();
    expect(packRow!.textContent).toContain('—');
  });
});

describe('SearchPackageBuilder pack safety (Yoda, PR #261)', () => {
  it('should show a real basket, never an empty one, before a pack is chosen', () => {
    // The fail-closed path this guarded — an unavailable pack emptying the
    // basket — is unit-tested against a synthetic pack in tmGroupPacks.test.ts,
    // because every real pack now resolves. What still matters here is that the
    // card never renders a basket with nothing in it.
    renderPriced();

    expect(screen.getByLabelText(/Build your own/)).toBeChecked();
    expect(screen.getByText('Standard bundle — always included')).toBeInTheDocument();
    expect(screen.getByText('Regulated Personal Local Search')).toBeInTheDocument();
  });

  it('should show a dash, not a low total, when the quote has not returned every pack line', () => {
    // GSEnviro absent from linePence but NOT flagged unpriceable: summing `?? 0`
    // would render a plausible, wrong, too-cheap price.
    const partial = new Map<string, number>([
      ['TMGLLC1', 3600],
      ['TMGCon29', 0],
      ['Con29DW', 6540],
    ]);
    hookState.current = {
      quote: { success: true, lines: [], unpricedProductTypes: [] },
      isQuoting: false,
      linePence: partial,
      unpriceable: new Set<string>(),
    };

    render(<SearchPackageBuilder {...PROPS} />);

    const row = screen.getByRole('radio', { name: /Official — Homebuyers/ }).closest('label');
    expect(row!.textContent).toContain('—');
    expect(row!.textContent).not.toContain('£101.40');
  });
});
