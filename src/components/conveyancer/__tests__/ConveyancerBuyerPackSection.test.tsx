// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tabProps = vi.fn();
vi.mock('@/components/transaction/tabs/BuyerPackTab', () => ({
  BuyerPackTab: (props: Record<string, unknown>) => { tabProps(props); return <div data-testid="buyer-pack-tab" />; },
}));
vi.mock('@/hooks/useSubscription', () => ({ useIsTierAtLeast: () => false }));

import { TRANSACTION_TABS } from '@/components/transaction/tabs/transactionTabs.config';
import { ConveyancerBuyerPackSection } from '../ConveyancerBuyerPackSection';

describe('ConveyancerBuyerPackSection', () => {
  beforeEach(() => { tabProps.mockClear(); });

  it('renders the registry Buyer Pack section under "From the buyer" with the workspace deep link', () => {
    render(
      <MemoryRouter>
        <ConveyancerBuyerPackSection transactionId="tx_1785240435635640231" />
      </MemoryRouter>,
    );
    const entry = TRANSACTION_TABS.find((t) => t.id === 'buyer-pack');
    expect(entry?.minTier).toBe('starter');
    expect(screen.getByRole('heading', { name: 'From the buyer' })).toBeInTheDocument();
    expect(screen.getByTestId('buyer-pack-tab')).toBeInTheDocument();
    expect(tabProps).toHaveBeenCalledWith({ transactionId: 'tx_1785240435635640231', locked: false, requiredTier: 'starter' });
    expect(screen.getByRole('link', { name: 'Open in the transaction workspace' })).toHaveAttribute('href', '/transaction/tx_1785240435635640231/flow?tab=buyer-pack');
  });
});
