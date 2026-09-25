import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import GroundsureBundlePicker from '../GroundsureBundlePicker';
import {
  groundsureBundles,
  groundsureRegionals,
  groundsureSingles,
  grossPence,
  vatPenceOn,
} from '../../../services/searchProviderData';

const HOMEBUYERS_PENCE = 9260; // Groundsure Pricing Schedule 2026-04-01, RRP ex-VAT
/** VAT-inclusive charge for Homebuyers alone: £92.60 + £18.52 = £111.12. */
const HOMEBUYERS_INC_VAT_PENCE = 11112;
const CON29M_COAL_PENCE = 4325;
const COAL_CERT_PENCE = 1650;

/** Product names carry '(', ')' and '+', which are regex operators. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof GroundsureBundlePicker>> = {},
) {
  const onOrder = vi.fn();
  render(
    <GroundsureBundlePicker
      postcode="LS1 1AA"
      areaCapabilities={[]}
      onOrder={onOrder}
      isOrdering={false}
      {...overrides}
    />,
  );
  return { onOrder };
}

describe('GroundsureBundlePicker', () => {
  it('should disable ordering until a bundle or search is picked', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: /pick a bundle or a search/i })).toBeDisabled();
  });

  // Changed 2026-08-21: the Groundsure rate card is still ex-VAT, but PropXchain
  // sells as principal so VAT is added on top and the ORDERED total is gross.
  // groundsure-worker stamps the same gross figure as retail_gbp, and
  // payment-worker charges it verbatim — so this is the number Stripe takes.
  it('should order a bundle at its RRP plus 20% VAT', () => {
    const { onOrder } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /Homebuyers/ }));
    fireEvent.click(screen.getByRole('button', { name: /Order 1 search — £111\.12/ }));

    expect(onOrder).toHaveBeenCalledTimes(1);
    const [items, totalPence] = onOrder.mock.calls[0];
    expect(totalPence).toBe(HOMEBUYERS_INC_VAT_PENCE);
    expect(totalPence).toBe(HOMEBUYERS_PENCE * 1.2);
    expect(items.map((i: { id: string }) => i.id)).toEqual(['groundsure-homebuyers']);
  });

  it('should pre-tick the coal searches with a visible reason in a coal area', () => {
    renderPicker({ areaCapabilities: ['coal-mining'] });

    const coal = screen.getByRole('checkbox', {
      name: /CON29M Official Coal Mining Search/,
    });
    expect(coal).toBeChecked();
    expect(screen.getAllByText(/known coal mining risk/i).length).toBeGreaterThan(0);
  });

  it('should leave area searches unticked when the area has no flagged risk', () => {
    renderPicker({ areaCapabilities: [] });
    expect(
      screen.getByRole('checkbox', { name: /CON29M Official Coal Mining Search/ }),
    ).not.toBeChecked();
    expect(screen.queryByText(/known coal mining risk/i)).not.toBeInTheDocument();
  });

  it('should order a bundle plus its pre-ticked area searches as one basket', () => {
    const { onOrder } = renderPicker({ areaCapabilities: ['coal-mining'] });

    fireEvent.click(screen.getByRole('button', { name: /Homebuyers/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Order 3 searches/ }));

    const [items, totalPence] = onOrder.mock.calls[0];
    expect(items.map((i: { id: string }) => i.id).sort()).toEqual([
      'groundsure-con29m-coal',
      'groundsure-georisk-cert-coal-brine',
      'groundsure-homebuyers',
    ]);
    // Net sum x 1.2. VAT is applied ONCE to the summed net rather than per line,
    // so a three-item basket cannot drift from its own total by rounding.
    const netPence = HOMEBUYERS_PENCE + CON29M_COAL_PENCE + COAL_CERT_PENCE;
    expect(totalPence).toBe(netPence + Math.round(netPence * 0.2));
  });

  it('should not silently re-tick a recommendation the user deliberately removed', () => {
    const { onOrder } = renderPicker({ areaCapabilities: ['coal-mining'] });

    const coal = screen.getByRole('checkbox', { name: /CON29M Official Coal Mining Search/ });
    fireEvent.click(coal);
    expect(coal).not.toBeChecked();

    // A later unrelated interaction must not resurrect it.
    fireEvent.click(screen.getByRole('button', { name: /Homebuyers/ }));
    expect(screen.getByRole('checkbox', { name: /CON29M Official Coal Mining Search/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /^Order 2 searches/ }));
    const [items] = onOrder.mock.calls[0];
    expect(items.map((i: { id: string }) => i.id)).not.toContain('groundsure-con29m-coal');
  });

  it('should offer every non-bundle Groundsure product as a tick box', () => {
    renderPicker();
    // Bundles render as buttons, so every check box is a single or a regional
    // — the full product list the handoff asks for, nothing omitted.
    const nonBundles = [...groundsureSingles, ...groundsureRegionals];
    expect(screen.getAllByRole('checkbox')).toHaveLength(nonBundles.length);
    for (const item of nonBundles) {
      expect(
        screen.getByRole('checkbox', { name: new RegExp(escapeRegExp(item.name)) }),
      ).toBeInTheDocument();
    }
  });

  // Homescreen RRP £62.95 ex-VAT -> £12.59 VAT -> £75.54 charged.
  it('should state every price VAT-inclusive, with the VAT disclosed inside the total', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Homescreen/ }));

    // The basket line is the gross figure, not the £62.95 rate-card net.
    const totalRow = screen.getByText('Total').closest('div') as HTMLElement;
    expect(within(totalRow).getByText('£75.54')).toBeInTheDocument();
    expect(screen.getByText('includes £12.59 VAT')).toBeInTheDocument();

    // The old net-plus-VAT breakdown is gone: showing gross lines AND a VAT
    // row reads as VAT charged twice.
    expect(screen.queryByText('Subtotal (RRP)')).not.toBeInTheDocument();
    expect(screen.queryByText('VAT (20%)')).not.toBeInTheDocument();
    expect(screen.queryByText('ex VAT')).not.toBeInTheDocument();
  });

  it('should never show a net price anywhere in the basket', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Homescreen/ }));

    // £62.95 is the rate-card net. It is the number this change exists to stop
    // showing, so assert its absence rather than only the gross's presence.
    expect(screen.queryByText('£62.95')).not.toBeInTheDocument();
  });

  it('should keep every catalogue price exactly divisible into VAT, so grossed lines sum to the total', () => {
    // The picker prints gross PER LINE but computes Total as net + VAT(net),
    // mirroring groundsure-worker so Stripe can never disagree. Those two agree
    // only while each line's VAT lands on a whole penny; a price like £10.01
    // would round per-line and the lines a customer adds up would miss the
    // Total by a penny. This pins the property the display relies on.
    const catalogue = [...groundsureBundles, ...groundsureSingles, ...groundsureRegionals];
    expect(catalogue.length).toBeGreaterThan(0);

    // Integer arithmetic on purpose: `pricePence * VAT_RATE` is floating point
    // and can leave a 1e-13 residue on a value whose VAT really is whole, which
    // would fail this spuriously. VAT is a fifth, so "whole-penny VAT" is
    // exactly "divisible by 5" and needs no float at all.
    for (const item of catalogue) {
      expect(
        item.pricePence % 5,
        `${item.name} (${item.pricePence}p) does not divide into whole-penny VAT`,
      ).toBe(0);
    }

    // And the property that follows from it, asserted directly on the whole basket.
    const netTotal = catalogue.reduce((sum, item) => sum + item.pricePence, 0);
    const summedGrossLines = catalogue.reduce((sum, item) => sum + grossPence(item.pricePence), 0);
    expect(summedGrossLines).toBe(netTotal + vatPenceOn(netTotal));
  });
});
