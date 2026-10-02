/**
 * The context strip used to hard-code the Transaction Wallet and ID & AML
 * shortcuts. Both are now entries in the tab registry, rendered in the section
 * menu — and below lg, in the drawer whose opener TransactionTabs portals in
 * here. What the strip owes it is the slot to land in.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));
vi.mock('../../RemindersMenu', () => ({ RemindersMenu: () => <div>REMINDERS</div> }));
const adminState = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: adminState.isAdmin, role: null, isLoading: false }) }));
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => mockNavigate }));
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
          providerSelections={new Map()}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector(`#${TRANSACTION_NAV_SLOT_ID}`)).toBeInTheDocument();
    expect(screen.queryByText('REMINDERS')).not.toBeInTheDocument();
  });
});

describe('TopBar — View as conveyancer', () => {
  const renderBar = () =>
    render(
      <MemoryRouter>
        <TopBar
          transactionId="TX-7"
          propertyAddress="1 Test Street"
          postcode="SG19 1EX"
          sellerName="Marc"
          buyerName={null}
          stages={[]}
          totalCostPence={0}
          providerSelections={new Map()}
        />
      </MemoryRouter>,
    );

  it('should not show the button to non-admins', () => {
    adminState.isAdmin = false;
    renderBar();
    expect(screen.queryByRole('button', { name: /view as conveyancer/i })).not.toBeInTheDocument();
  });

  it('should open the conveyancer matter screen for admins', () => {
    adminState.isAdmin = true;
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /view as conveyancer/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/conveyancer?tx=TX-7');
  });
});
