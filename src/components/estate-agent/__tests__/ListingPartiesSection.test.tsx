// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PartyRoleRow } from '@/services/partyRole.service';
import type { PartyInviteRow } from '@/services/partyInvite.service';

vi.mock('@/services/partyRole.service', () => ({
  partyRoleService: { listForTransaction: vi.fn() },
}));

vi.mock('@/services/partyInvite.service', () => ({
  partyInviteService: { listForTransaction: vi.fn(), send: vi.fn() },
}));

import { partyRoleService } from '@/services/partyRole.service';
import { partyInviteService } from '@/services/partyInvite.service';
import ListingPartiesSection from '../ListingPartiesSection';

const mockListRoles = vi.mocked(partyRoleService.listForTransaction);
const mockListInvites = vi.mocked(partyInviteService.listForTransaction);
const mockSend = vi.mocked(partyInviteService.send);

function roleRow(overrides: Partial<PartyRoleRow>): PartyRoleRow {
  return {
    transaction_id: 'tx-1',
    principal: 'p-1',
    role: 'seller',
    side: 'seller',
    invited_by_principal: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function inviteRow(overrides: Partial<PartyInviteRow>): PartyInviteRow {
  return {
    id: 'inv-1',
    transaction_id: 'tx-1',
    invite_code: 'TX-0001-0001',
    role: 'seller',
    side: 'seller',
    recipient_name: 'Jane Seller',
    recipient_email: 'jane@example.com',
    email_sent: true,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderSection(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ListingPartiesSection
        transactionId="tx-1"
        inviteCode="TX-0001-0001"
        listingId="row-1"
        propertyAddress="1 High St, Sandy"
      />
    </QueryClientProvider>,
  );
}

describe('ListingPartiesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the seller as joined when a seller party role row exists', async () => {
    mockListRoles.mockResolvedValue([roleRow({ role: 'seller' })]);
    mockListInvites.mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText(/seller/i)).toBeInTheDocument();
    expect(screen.getByText(/joined/i)).toBeInTheDocument();
  });

  it('shows the seller as invited — pending with a re-send button when only an invite row exists', async () => {
    mockListRoles.mockResolvedValue([]);
    mockListInvites.mockResolvedValue([inviteRow({ role: 'seller' })]);
    renderSection();

    expect(await screen.findByText(/invited.*pending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-send/i })).toBeInTheDocument();
  });

  it('shows the buyer as not invited when there is no role or invite row', async () => {
    mockListRoles.mockResolvedValue([roleRow({ role: 'seller' })]);
    mockListInvites.mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText(/not invited/i)).toBeInTheDocument();
  });

  it('lists conveyancer rows read-only when present', async () => {
    mockListRoles.mockResolvedValue([roleRow({ role: 'conveyancer', principal: 'conv-1' })]);
    mockListInvites.mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText(/conveyancer/i)).toBeInTheDocument();
  });

  it('surfaces a resend error under the relevant chip when the resend fails', async () => {
    mockListRoles.mockResolvedValue([]);
    mockListInvites.mockResolvedValue([inviteRow({ role: 'seller' })]);
    mockSend.mockResolvedValue({ ok: false, error: 'rate_limited' });
    renderSection();

    const resendButton = await screen.findByRole('button', { name: /re-send/i });
    fireEvent.click(resendButton);

    expect(await screen.findByText('rate_limited')).toBeInTheDocument();
  });

  it('invite-buyer form calls partyInviteService.send with role buyer', async () => {
    mockListRoles.mockResolvedValue([]);
    mockListInvites.mockResolvedValue([]);
    mockSend.mockResolvedValue({ ok: true, error: null });
    renderSection();

    await screen.findAllByText(/not invited/i);

    fireEvent.change(screen.getByLabelText(/buyer name/i), { target: { value: 'Bob Buyer' } });
    fireEvent.change(screen.getByLabelText(/buyer email/i), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /invite buyer/i }));

    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          inviteCode: 'TX-0001-0001',
          role: 'buyer',
          side: 'buyer',
          recipientName: 'Bob Buyer',
          recipientEmail: 'bob@example.com',
          listingId: 'row-1',
          propertyAddress: '1 High St, Sandy',
        }),
      ),
    );
  });
});
