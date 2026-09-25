// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tabProps = vi.fn();
vi.mock('@/components/transaction/tabs/EnquiriesTab', () => ({
  EnquiriesTab: (props: Record<string, unknown>) => { tabProps(props); return <div data-testid="enquiries-tab" />; },
}));
const isTierAtLeast = vi.fn<(tier: string) => boolean>();
vi.mock('@/hooks/useSubscription', () => ({ useIsTierAtLeast: (tier: string) => isTierAtLeast(tier) }));

import { TRANSACTION_TABS, isTabUnlocked } from '@/components/transaction/tabs/transactionTabs.config';
import { ConveyancerEnquiriesSection } from '../ConveyancerEnquiriesSection';

const registryEntry = TRANSACTION_TABS.find((t) => t.id === 'enquiries');

function renderSection(): void {
  render(
    <MemoryRouter>
      <ConveyancerEnquiriesSection transactionId="tx_1788298187019483408" />
    </MemoryRouter>,
  );
}

describe('ConveyancerEnquiriesSection', () => {
  beforeEach(() => { tabProps.mockClear(); isTierAtLeast.mockReset(); });

  it('renders the registry Enquiries section with the registry tier and the workspace deep link', () => {
    isTierAtLeast.mockReturnValue(false);
    renderSection();
    expect(registryEntry?.minTier).toBe('starter');
    expect(screen.getByRole('heading', { name: 'Enquiries' })).toBeInTheDocument();
    expect(screen.getByTestId('enquiries-tab')).toBeInTheDocument();
    expect(tabProps).toHaveBeenCalledWith({ transactionId: 'tx_1788298187019483408', locked: false, requiredTier: registryEntry?.minTier });
    expect(screen.getByRole('link', { name: 'Open in the transaction workspace' })).toHaveAttribute('href', '/transaction/tx_1788298187019483408/flow?tab=enquiries');
  });

});

describe('isTabUnlocked (the rule both surfaces share)', () => {
  it('opens starter sections to everyone and premium sections only to premium', () => {
    expect(isTabUnlocked('starter', false)).toBe(true);
    expect(isTabUnlocked('starter', true)).toBe(true);
    expect(isTabUnlocked('premium', false)).toBe(false);
    expect(isTabUnlocked('premium', true)).toBe(true);
  });
});
