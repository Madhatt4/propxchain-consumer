import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SearchPackageBuilder from '../SearchPackageBuilder';

const hookState = { current: { quote: null as unknown, isQuoting: true, linePence: new Map<string, number>(), unpriceable: new Set<string>() } };

vi.mock('../useTmGroupCatalogueQuote', () => ({
  useTmGroupCatalogueQuote: () => hookState.current,
}));

const PROPS = { postcode: 'SG19 1EX', localAuthority: 'Central Bedfordshire' };

describe('SearchPackageBuilder while the catalogue quote is in flight', () => {
  it('should replace the whole card with the centred spinning house and the wait expectation', () => {
    hookState.current = { quote: null, isQuoting: true, linePence: new Map(), unpriceable: new Set() };

    render(<SearchPackageBuilder {...PROPS} />);

    // Marc, 2026-08-18: centre of the card, not a line tucked into the price
    // panel at the bottom. So the search list must NOT be there yet.
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Getting a live price for this property');
    expect(status).toHaveTextContent(/up to 20 seconds/);
    expect(status.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByText('Standard bundle — always included')).toBeNull();
  });

  it('should show the search list once the quote has arrived', () => {
    hookState.current = {
      quote: { success: true, lines: [], unpricedProductTypes: [] },
      isQuoting: false,
      linePence: new Map([['PSReport12', 8340]]),
      unpriceable: new Set(),
    };

    render(<SearchPackageBuilder {...PROPS} />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Standard bundle — always included')).toBeInTheDocument();
    // Line price AND total — the standard bundle is the only priced line here.
    expect(screen.getAllByText('£83.40').length).toBeGreaterThanOrEqual(1);
  });
});
