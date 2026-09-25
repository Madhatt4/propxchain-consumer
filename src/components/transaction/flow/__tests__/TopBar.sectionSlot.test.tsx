/**
 * The context strip used to hard-code the Transaction Wallet and ID & AML
 * shortcuts. Both are now entries in the tab registry, rendered in the section
 * menu — and below lg, in the drawer whose opener TransactionTabs portals in
 * here. What the strip owes it is the slot to land in.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));
vi.mock('../../RemindersMenu', () => ({ RemindersMenu: () => <div>REMINDERS</div> }));
vi.mock('../../../../hooks/useAnimatedCounter', () => ({ useAnimatedCounter: (n: number) => n }));

import { TopBar, TRANSACTION_NAV_SLOT_ID } from '../TopBar';

describe('TopBar — section nav slot', () => {
  it('should expose the section-nav slot in the context strip', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/transaction/TX-7/flow?tab=overview']}>
        <TopBar
          transactionId="TX-7"
          propertyAddress="1 Test Street"
          postcode="SG19 1EX"
          sellerName="Marc"
          buyerName={null}
          stages={[]}
          totalCostPence={0}
          propxchainFeePence={0}
          providerSelections={new Map()}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector(`#${TRANSACTION_NAV_SLOT_ID}`)).toBeInTheDocument();
  });

  it('should keep the slot present even with no transaction, so the nav cannot silently vanish', () => {
    const { container } = render(
      <MemoryRouter>
        <TopBar
          transactionId=""
          propertyAddress="1 Test Street"
          postcode="SG19 1EX"
          sellerName="Marc"
          buyerName={null}
          stages={[]}
          totalCostPence={0}
          propxchainFeePence={0}
          providerSelections={new Map()}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector(`#${TRANSACTION_NAV_SLOT_ID}`)).toBeInTheDocument();
    expect(screen.queryByText('REMINDERS')).not.toBeInTheDocument();
  });
});
