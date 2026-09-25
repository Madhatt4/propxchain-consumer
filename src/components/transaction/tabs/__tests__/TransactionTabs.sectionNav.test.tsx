/**
 * The sections live in a left-hand menu on the page at lg and up, and in a
 * slide-out drawer below that, opened from the transaction context strip.
 * These cover both: that every section in the registry is listed, that the
 * menu survives a missing strip slot, that the drawer opener portals into the
 * strip, and that choosing a section switches it in place.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TransactionTabs } from '../TransactionTabs';
import { TRANSACTION_TABS } from '../transactionTabs.config';
import { TRANSACTION_NAV_SLOT_ID } from '../../flow/TopBar';

vi.mock('@/hooks/useSubscription', () => ({
  useIsTierAtLeast: () => true,
  useCanAccessFeature: () => true,
}));

function renderTabs(entry = '/t', transactionId = 'tx-1'): void {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <TransactionTabs context={{ transactionId }} overview={<p>Active stage detail</p>} />
    </MemoryRouter>,
  );
}

/** Stands in for the context strip, which the flow page renders, not the tabs. */
function mountSlot(): HTMLElement {
  const slot = document.createElement('div');
  slot.id = TRANSACTION_NAV_SLOT_ID;
  document.body.appendChild(slot);
  return slot;
}

/** The persistent left menu — the drawer, when open, is a second such nav. */
function menu(): HTMLElement {
  return screen.getAllByRole('navigation', { name: 'Transaction sections' })[0];
}

/** The drawer, identified by the close button only it carries. */
function drawer(): HTMLElement {
  const nav = screen.getByRole('button', { name: 'Close menu' }).closest('nav');
  if (!nav) throw new Error('drawer nav not found');
  return nav;
}

const item = (scope: HTMLElement, label: string): HTMLElement =>
  within(scope).getByRole('button', { name: `Open ${label}` });

describe('TransactionTabs section navigation', () => {
  beforeEach(() => {
    document.getElementById(TRANSACTION_NAV_SLOT_ID)?.remove();
  });

  it('lists every registered section in the side menu', () => {
    renderTabs();

    for (const tab of TRANSACTION_TABS) {
      expect(item(menu(), tab.label)).toBeInTheDocument();
    }
  });

  it('keeps the side menu on the page when the context strip slot is absent', () => {
    renderTabs();

    // The menu is the primary navigation; unlike the drawer opener it must not
    // depend on a slot owned by another component.
    expect(menu()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open transaction sections menu' })).not
      .toBeInTheDocument();
  });

  it('marks the active section in the menu', () => {
    renderTabs('/t?tab=wallet');

    expect(item(menu(), 'Transaction Wallet')).toHaveAttribute('aria-current', 'true');
    expect(item(menu(), 'Chain')).not.toHaveAttribute('aria-current');
  });

  it('switches section when a menu item is chosen', () => {
    renderTabs();

    fireEvent.click(item(menu(), 'Chain'));

    expect(screen.queryByText('Active stage detail')).not.toBeInTheDocument();
    expect(item(menu(), 'Chain')).toHaveAttribute('aria-current', 'true');
  });

  it('offers the blockchain audit as a link out, not a section', () => {
    renderTabs();

    const audit = within(menu()).getByRole('link', { name: 'View the blockchain audit trail' });
    expect(audit).toHaveAttribute('href', '/transaction/tx-1/audit');
    // A route of its own — it must never pick up the active-section state.
    expect(audit).not.toHaveAttribute('aria-current');
  });

  it('omits the audit link when there is no transaction to audit', () => {
    renderTabs('/t', '');

    expect(
      screen.queryByRole('link', { name: 'View the blockchain audit trail' }),
    ).not.toBeInTheDocument();
  });

  it('portals the drawer opener into the context strip', () => {
    const slot = mountSlot();
    renderTabs();

    expect(slot).toContainElement(
      screen.getByRole('button', { name: 'Open transaction sections menu' }),
    );
  });

  it('opens a drawer with the full section list, and closes it on a choice', () => {
    mountSlot();
    renderTabs();

    fireEvent.click(screen.getByRole('button', { name: 'Open transaction sections menu' }));

    const open = drawer();
    for (const tab of TRANSACTION_TABS) {
      expect(item(open, tab.label)).toBeInTheDocument();
    }
    expect(
      within(open).getByRole('link', { name: 'View the blockchain audit trail' }),
    ).toBeInTheDocument();

    fireEvent.click(item(open, 'Chain'));

    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    expect(item(menu(), 'Chain')).toHaveAttribute('aria-current', 'true');
  });

  it('closes the drawer on Escape, without picking a section', () => {
    mountSlot();
    renderTabs();

    fireEvent.click(screen.getByRole('button', { name: 'Open transaction sections menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    // Escaping is not a choice — the active section must be untouched.
    expect(screen.getByText('Active stage detail')).toBeInTheDocument();
  });

  it('shows a back-to-Overview link on non-overview sections and returns on click', () => {
    renderTabs('/t?tab=wallet');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    expect(screen.getByText('Active stage detail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
  });
});
