// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMandate = vi.fn();
vi.mock('@/hooks/useMandate', () => ({ useMandate: (...args: unknown[]) => mockMandate(...args) }));
const mockOrg = vi.fn();
vi.mock('@/hooks/useEstateAgentOrg', () => ({ useEstateAgentOrg: () => mockOrg() }));

const listAgentInvites = vi.fn();
const sendAgentInvite = vi.fn();
const cancelAgentInvite = vi.fn();
vi.mock('@/services/agentInvite.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/agentInvite.service')>();
  return {
    ...actual,
    listAgentInvites: (...a: unknown[]) => listAgentInvites(...a),
    sendAgentInvite: (...a: unknown[]) => sendAgentInvite(...a),
    cancelAgentInvite: (...a: unknown[]) => cancelAgentInvite(...a),
  };
});

import { AddEstateAgentPanel } from '../AddEstateAgentPanel';
import { AgentInviteError } from '@/services/agentInvite.service';

const FUTURE = new Date(Date.now() + 7 * 86400000).toISOString();

function renderPanel(dealSide: 'seller' | 'buyer' | 'other' = 'seller'): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AddEstateAgentPanel transactionId="tx_1" dealSide={dealSide} />
    </QueryClientProvider>,
  );
}

describe('AddEstateAgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMandate.mockReturnValue({ actingFor: [], grantedByMe: null, agencyName: null, isLoading: false });
    mockOrg.mockReturnValue({ organisationId: null });
    listAgentInvites.mockResolvedValue([]);
  });

  it('should let the seller invite their agent by email; the address is the server\'s to add', async () => {
    sendAgentInvite.mockResolvedValue({ inviteId: 'i1', expiresAt: FUTURE });
    renderPanel();
    fireEvent.change(await screen.findByLabelText(/Agent.s email/), { target: { value: 'agent@agency.co.uk' } });
    fireEvent.change(screen.getByLabelText(/Agency name/), { target: { value: 'Smith & Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(sendAgentInvite).toHaveBeenCalledWith({
      transactionId: 'tx_1', agentEmail: 'agent@agency.co.uk', agencyName: 'Smith & Co',
    }));
    expect(listAgentInvites).toHaveBeenCalledTimes(2);
  });

  it('should show a pending invitation with a way to cancel it', async () => {
    listAgentInvites.mockResolvedValue([{ id: 'i1', agentEmail: 'agent@agency.co.uk', agencyName: null, status: 'pending', createdAt: '2026-11-07T10:00:00Z', expiresAt: FUTURE }]);
    cancelAgentInvite.mockResolvedValue(undefined);
    renderPanel();
    expect(await screen.findByTestId('agent-invite-pending')).toHaveTextContent('Invitation sent to agent@agency.co.uk');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() => expect(cancelAgentInvite).toHaveBeenCalledWith('i1'));
  });

  it('should offer the form again once an invitation has expired', async () => {
    listAgentInvites.mockResolvedValue([{ id: 'i1', agentEmail: 'a@b.co', agencyName: null, status: 'pending', createdAt: '2026-10-01T10:00:00Z', expiresAt: '2026-10-15T10:00:00Z' }]);
    renderPanel();
    expect(await screen.findByTestId('add-estate-agent')).toBeInTheDocument();
  });

  it('should explain a refusal in words', async () => {
    sendAgentInvite.mockRejectedValue(new AgentInviteError('not_the_seller'));
    renderPanel();
    fireEvent.change(await screen.findByLabelText(/Agent.s email/), { target: { value: 'agent@agency.co.uk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the seller on this sale can add an estate agent.');
  });

  it('should stay hidden once an agency acts for the seller, for the agent, and for the buyer', () => {
    mockMandate.mockReturnValue({ actingFor: [], grantedByMe: { id: 'd1' }, agencyName: 'Smith & Co', isLoading: false });
    const { unmount } = render(<QueryClientProvider client={new QueryClient()}><AddEstateAgentPanel transactionId="tx_1" dealSide="seller" /></QueryClientProvider>);
    expect(screen.queryByTestId('add-estate-agent')).not.toBeInTheDocument();
    unmount();

    mockMandate.mockReturnValue({ actingFor: ['seller'], grantedByMe: null, agencyName: null, isLoading: false });
    renderPanel();
    expect(screen.queryByTestId('add-estate-agent')).not.toBeInTheDocument();

    mockMandate.mockReturnValue({ actingFor: [], grantedByMe: null, agencyName: null, isLoading: false });
    renderPanel('buyer');
    expect(screen.queryByTestId('add-estate-agent')).not.toBeInTheDocument();
    renderPanel('other');
    expect(screen.queryByTestId('add-estate-agent')).not.toBeInTheDocument();
    expect(listAgentInvites).not.toHaveBeenCalled();
  });

  it('should say the invitations could not be loaded instead of offering the form', async () => {
    listAgentInvites.mockRejectedValue(new Error('load_failed'));
    renderPanel();
    expect(await screen.findByTestId('agent-invite-load-error')).toHaveTextContent('Couldn\u2019t load your agent invitations');
    expect(screen.queryByTestId('add-estate-agent')).not.toBeInTheDocument();
  });

  it('should tell the seller plainly when another agency already lists the sale', async () => {
    sendAgentInvite.mockRejectedValue(new AgentInviteError('deal_already_listed', 'Other Agency'));
    renderPanel();
    fireEvent.change(await screen.findByLabelText(/Agent.s email/), { target: { value: 'agent@agency.co.uk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Other Agency already has this sale in its PropXchain listings');
  });
});
