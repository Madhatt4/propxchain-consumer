// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockParties = vi.fn();
vi.mock('@/hooks/useListingParties', () => ({ useListingParties: (...args: unknown[]) => mockParties(...args) }));
const mockList = vi.fn();
const mockRequest = vi.fn();
vi.mock('@/services/delegation.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/delegation.service')>()),
  listDelegations: (...args: unknown[]) => mockList(...args),
  requestDelegation: (...args: unknown[]) => mockRequest(...args),
}));

import { DelegationError } from '@/services/delegation.service';
import ClientPanel from '../ClientPanel';

const sellerInvite = { id: 'i1', transaction_id: 'tx_1', invite_code: 'TX-AAAA-BBBB', role: 'seller', side: 'seller', recipient_name: 'Jane Seller', recipient_email: 'jane@example.test', email_sent: true, created_at: '2026-09-01T00:00:00Z' };

function renderPanel(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ClientPanel transactionId="tx_1" inviteCode="TX-AAAA-BBBB" listingId="l1" propertyAddress="14 Elm Road" />
    </QueryClientProvider>,
  );
}

describe('ClientPanel', () => {
  beforeEach(() => {
    mockParties.mockReset().mockReturnValue({ sellerInvite, buyerInvite: undefined, roles: [], isLoading: false });
    mockList.mockReset().mockResolvedValue([]);
    mockRequest.mockReset();
  });

  it('shows the invited seller with the ask button, and the uninvited buyer without one', async () => {
    renderPanel();
    expect(await screen.findByText('Jane Seller')).toBeInTheDocument();
    expect(screen.getByText('jane@example.test')).toBeInTheDocument();
    expect(screen.getByTestId('client-status-seller')).toHaveTextContent('Handles PropXchain themselves');
    expect(screen.getByRole('button', { name: 'Ask Jane to let you act for them' })).toBeInTheDocument();
    expect(screen.getByTestId('client-row-buyer')).toHaveTextContent('Not invited yet');
    expect(screen.queryByRole('button', { name: /act for them/ })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /act for them/ })).toHaveLength(1);
  });

  it('asking sends the request for that side and the status turns to waiting', async () => {
    mockRequest.mockResolvedValue({ delegationId: 'd1', clientEmailMasked: 'j•••@example.test' });
    mockList
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'd1', transactionId: 'tx_1', role: 'seller', state: 'requested', requestedAt: 'x', grantedAt: null, revokedAt: null }]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask Jane to let you act for them' }));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith({ transactionId: 'tx_1', listingId: 'l1', role: 'seller' }));
    expect(await screen.findByText('Asked, waiting for their tap')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /act for them/ })).toBeNull();
  });

  it('an active mandate shows as acting; a withdrawn one offers to ask again; a refusal is explained', async () => {
    mockList.mockResolvedValue([
      { id: 'd1', transactionId: 'tx_1', role: 'seller', state: 'revoked', requestedAt: 'x', grantedAt: 'y', revokedAt: 'z' },
    ]);
    mockRequest.mockRejectedValue(new DelegationError('agent_principal_unknown'));
    renderPanel();
    expect(await screen.findByText('Withdrew their mandate')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Jane to let you act for them' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Open the deal once in the workspace');
  });

  it('a failed delegation read is said, not hidden', async () => {
    mockList.mockRejectedValue(new Error('permission denied'));
    renderPanel();
    expect(await screen.findByTestId('client-error')).toHaveTextContent('Could not check who acts for whom');
  });
});
