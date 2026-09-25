// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for partyInvite.service.ts — mocks Supabase client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
  },
}));

import { partyInviteService } from '../partyInvite.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('partyInviteService.send', () => {
  it('should invoke send-party-invite with the snake_case body', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, invite_id: 'inv-1' }, error: null });

    const result = await partyInviteService.send({
      transactionId: 'tx1',
      inviteCode: 'code-1',
      role: 'buyer',
      side: 'buyer',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane@example.com',
      listingId: 'listing-1',
      propertyAddress: '1 Example Street, SG19 1AB',
    });

    expect(result).toEqual({ ok: true, error: null });
    expect(mockInvoke).toHaveBeenCalledWith('send-party-invite', {
      body: {
        transaction_id: 'tx1',
        invite_code: 'code-1',
        role: 'buyer',
        side: 'buyer',
        recipient_name: 'Jane Doe',
        recipient_email: 'jane@example.com',
        listing_id: 'listing-1',
        property_address: '1 Example Street, SG19 1AB',
      },
    });
  });

  it('should omit the optional side field when not provided', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, invite_id: 'inv-2' }, error: null });

    await partyInviteService.send({
      transactionId: 'tx1',
      inviteCode: 'code-2',
      role: 'conveyancer',
      recipientName: 'Firm LLP',
      recipientEmail: 'firm@example.com',
      listingId: 'listing-1',
      propertyAddress: '1 Example Street, SG19 1AB',
    });

    expect(mockInvoke).toHaveBeenCalledWith('send-party-invite', {
      body: {
        transaction_id: 'tx1',
        invite_code: 'code-2',
        role: 'conveyancer',
        recipient_name: 'Firm LLP',
        recipient_email: 'firm@example.com',
        listing_id: 'listing-1',
        property_address: '1 Example Street, SG19 1AB',
      },
    });
  });

  it('should parse the FunctionsHttpError response body for the real reason', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'not_a_party' }) },
      },
    });

    const result = await partyInviteService.send({
      transactionId: 'tx1',
      inviteCode: 'code-1',
      role: 'buyer',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane@example.com',
      listingId: 'listing-1',
      propertyAddress: '1 Example Street, SG19 1AB',
    });

    expect(result).toEqual({ ok: false, error: 'not_a_party' });
  });

  it('should fall back to the generic message when the error body cannot be parsed', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => { throw new Error('not json'); } },
      },
    });

    const result = await partyInviteService.send({
      transactionId: 'tx1',
      inviteCode: 'code-1',
      role: 'buyer',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane@example.com',
      listingId: 'listing-1',
      propertyAddress: '1 Example Street, SG19 1AB',
    });

    expect(result).toEqual({ ok: false, error: 'Edge Function returned a non-2xx status code' });
  });

  it('should fall back to the generic message when the error has no context', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'network down' } });

    const result = await partyInviteService.send({
      transactionId: 'tx1',
      inviteCode: 'code-1',
      role: 'buyer',
      recipientName: 'Jane Doe',
      recipientEmail: 'jane@example.com',
      listingId: 'listing-1',
      propertyAddress: '1 Example Street, SG19 1AB',
    });

    expect(result).toEqual({ ok: false, error: 'network down' });
  });

  it('should never throw even when invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));

    await expect(
      partyInviteService.send({
        transactionId: 'tx1',
        inviteCode: 'code-1',
        role: 'buyer',
        recipientName: 'Jane Doe',
        recipientEmail: 'jane@example.com',
        listingId: 'listing-1',
        propertyAddress: '1 Example Street, SG19 1AB',
      }),
    ).resolves.toEqual({ ok: false, error: 'boom' });
  });
});

describe('partyInviteService.listForTransaction', () => {
  it('should select rows for the transaction under RLS (own invites)', async () => {
    const rows = [
      {
        id: 'inv-1',
        transaction_id: 'tx1',
        invite_code: 'TX-0001-0001',
        role: 'buyer',
        side: 'buyer',
        recipient_name: 'Jane Doe',
        recipient_email: 'jane@example.com',
        email_sent: true,
        created_at: '2026-08-24T00:00:00Z',
      },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await partyInviteService.listForTransaction('tx1');

    expect(result).toEqual(rows);
    expect(mockEq).toHaveBeenCalledWith('transaction_id', 'tx1');
  });

  it('should throw on supabase error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    await expect(partyInviteService.listForTransaction('tx1')).rejects.toThrow(
      'Failed to fetch party invites: db error',
    );
  });

  it('should return an empty array when there are no rows', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await partyInviteService.listForTransaction('tx1');
    expect(result).toEqual([]);
  });
});
