import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TmGroupQuoteSummary, { TMGROUP_SUPPLIER_TERMS_URL } from '../TmGroupQuoteSummary';

const BASE = {
  quote: null,
  orderable: false,
  totalPence: 0,
  disbursementPence: 0,
  postcode: 'SG19 1EX',
  localAuthority: 'Central Bedfordshire',
  isOrdering: false,
  canOrder: false,
  onOrder: vi.fn(),
};

// The in-flight state is NOT tested here. #212 moved the spinner up to the whole
// card (SearchPackageBuilder renders LoadingHouse and hides the list), leaving
// this component's `isQuoting` branch unreachable in the app. That behaviour is
// covered by SearchPackageBuilder.quoting.test.tsx; asserting it here again
// would test a line no user can reach.
describe('TmGroupQuoteSummary refresh', () => {
  // 2026-08-19: Marc's first catalogue quote of the day came back with five
  // lines unpriced; two minutes later the same address priced in full. The
  // person must be able to ask again without reloading the page.
  const PARTIAL = {
    success: true as const,
    isComplete: false,
    unpricedProductTypes: ['PSReport12', 'Con29DW'],
    lines: [],
    grossPence: 0,
  };

  it('should offer Refresh quote and call onRefresh when a line is unpriced', () => {
    const onRefresh = vi.fn();
    render(
      <TmGroupQuoteSummary {...BASE} isQuoting={false} quote={PARTIAL} hasUnpricedLines onRefresh={onRefresh} />,
    );

    screen.getByRole('button', { name: /Refresh quote/ }).click();

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // The copy sends people to the button first, not to their address.
    expect(screen.getByText(/Press Refresh quote to ask again/)).toBeInTheDocument();
  });

  it('should still offer Refresh quote on an orderable basket when some catalogue line is unpriced', () => {
    render(
      <TmGroupQuoteSummary
        {...BASE}
        isQuoting={false}
        quote={{ ...PARTIAL, unpricedProductTypes: ['CDSHWayEnR'] }}
        orderable
        totalPence={48000}
        hasUnpricedLines
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Refresh quote/ })).toBeInTheDocument();
  });

  it('should not offer Refresh quote while quoting, when fully priced, or without a handler', () => {
    const { rerender } = render(
      <TmGroupQuoteSummary {...BASE} isQuoting quote={PARTIAL} hasUnpricedLines onRefresh={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Refresh quote/ })).toBeNull();

    rerender(
      <TmGroupQuoteSummary
        {...BASE}
        isQuoting={false}
        quote={{ ...PARTIAL, isComplete: true, unpricedProductTypes: [] }}
        orderable
        totalPence={48000}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Refresh quote/ })).toBeNull();

    rerender(<TmGroupQuoteSummary {...BASE} isQuoting={false} quote={PARTIAL} hasUnpricedLines />);
    expect(screen.queryByRole('button', { name: /Refresh quote/ })).toBeNull();
  });
});

describe('TmGroupQuoteSummary supplier terms', () => {
  // The tmGroup reseller agreement (cl. 5.1.1) requires every customer to agree to
  // tmGroup's supplier terms before the purchase contract forms.
  const COMPLETE = {
    success: true as const,
    isComplete: true,
    unpricedProductTypes: [],
    lines: [],
    grossPence: 48000,
  };
  const READY = { ...BASE, isQuoting: false, quote: COMPLETE, orderable: true, canOrder: true, totalPence: 48000 };

  it('should keep Order searches disabled until the supplier terms are ticked', () => {
    const onOrder = vi.fn();
    render(<TmGroupQuoteSummary {...READY} onOrder={onOrder} />);

    const order = screen.getByRole('button', { name: /Order searches/ });
    expect(order).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(order).toBeEnabled();

    fireEvent.click(order);
    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('should disable Order searches again when the terms are unticked', () => {
    render(<TmGroupQuoteSummary {...READY} />);
    const box = screen.getByRole('checkbox');

    fireEvent.click(box);
    fireEvent.click(box);

    expect(screen.getByRole('button', { name: /Order searches/ })).toBeDisabled();
  });

  it('should keep Order searches disabled with the terms ticked when the quote is not orderable', () => {
    render(<TmGroupQuoteSummary {...READY} orderable={false} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: /Order searches/ })).toBeDisabled();
  });

  it('should link to the tmGroup supplier terms in a new tab', () => {
    render(<TmGroupQuoteSummary {...READY} />);

    const link = screen.getByRole('link', { name: /tmGroup supplier terms/ });
    expect(link).toHaveAttribute('href', TMGROUP_SUPPLIER_TERMS_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
