// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMandate = vi.fn();
vi.mock('@/hooks/useMandate', () => ({ useMandate: (...args: unknown[]) => mockMandate(...args) }));
const mockRevoke = vi.fn();
vi.mock('@/services/delegation.service', () => ({ revokeDelegation: (...args: unknown[]) => mockRevoke(...args) }));
const mockForget = vi.fn();
vi.mock('@/services/onBehalf', () => ({ forgetActingFor: (...args: unknown[]) => mockForget(...args) }));

import { MandateBanners } from '../MandateBanners';
import { sidesPhrase } from '../mandateCopy';

function renderBanners(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MandateBanners transactionId="tx_1" myRole="seller" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MandateBanners', () => {
  beforeEach(() => {
    mockMandate.mockReset();
    mockRevoke.mockReset();
    mockForget.mockReset();
  });

  it('tells an agent whom they act for and that it is recorded', () => {
    mockMandate.mockReturnValue({ actingFor: ['seller'], grantedByMe: null, agencyName: null, isLoading: false });
    renderBanners();
    const banner = screen.getByTestId('acting-for-banner');
    expect(banner).toHaveAttribute('data-side', 'seller');
    expect(banner).toHaveTextContent('Acting for the seller on this deal.');
    expect(banner).toHaveTextContent('recorded in their name');
    expect(screen.getByRole('link', { name: 'Back to your pipeline' })).toHaveAttribute('href', '/estate-agent/pipeline');
  });

  it('names both sides once the agency acts for both, seller first', () => {
    expect(sidesPhrase(['buyer', 'seller'])).toBe('the seller and the buyer');
    expect(sidesPhrase(['buyer'])).toBe('the buyer');
    mockMandate.mockReturnValue({ actingFor: ['seller', 'buyer'], grantedByMe: null, agencyName: null, isLoading: false });
    renderBanners();
    expect(screen.getByTestId('acting-for-banner')).toHaveTextContent('Acting for the seller and the buyer on this deal.');
  });

  it('tells a client who can act for them, with the withdrawal one click away and the record cache cleared after it', async () => {
    mockMandate.mockReturnValue({ actingFor: [], grantedByMe: { id: 'd1', transactionId: 'tx_1', role: 'seller', state: 'active' }, agencyName: 'Smith & Co', isLoading: false });
    mockRevoke.mockResolvedValue({ state: 'revoked', ledgerPending: false });
    renderBanners();
    expect(screen.getByTestId('client-mandate-banner')).toHaveTextContent('Smith & Co can act for you on this deal.');
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this' }));
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('d1'));
    await waitFor(() => expect(mockForget).toHaveBeenCalledWith('tx_1'));
  });

  it('shows nothing when there is no mandate either way', () => {
    mockMandate.mockReturnValue({ actingFor: [], grantedByMe: null, agencyName: null, isLoading: false });
    renderBanners();
    expect(screen.queryByTestId('acting-for-banner')).toBeNull();
    expect(screen.queryByTestId('client-mandate-banner')).toBeNull();
  });
});
