// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for startSale.service.ts — mocks icpService, partyRoleService,
 * estateAgentListingsService and partyInviteService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const {
  mockCreateTransactionWithInvite,
  mockRequireTransactionManager,
  mockRecordMyRole,
  mockLinkTransaction,
  mockSetStatus,
  mockSend,
  mockSetListingData,
} = vi.hoisted(() => ({
  mockCreateTransactionWithInvite: vi.fn(),
  mockRequireTransactionManager: vi.fn(),
  mockRecordMyRole: vi.fn(),
  mockLinkTransaction: vi.fn(),
  mockSetStatus: vi.fn(),
  mockSend: vi.fn(),
  mockSetListingData: vi.fn(),
}));

vi.mock('@/services/icp.service', () => ({
  icpService: {
    requireTransactionManager: mockRequireTransactionManager,
    setListingData: mockSetListingData,
  },
}));

vi.mock('@/services/partyRole.service', () => ({
  partyRoleService: {
    recordMyRole: mockRecordMyRole,
  },
}));

vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: {
    linkTransaction: mockLinkTransaction,
    setStatus: mockSetStatus,
  },
}));

vi.mock('@/services/partyInvite.service', () => ({
  partyInviteService: {
    send: mockSend,
  },
}));

import { startSaleService, type StartSaleProgress } from '../startSale.service';

function fakeListing(overrides: Partial<AgentListingRow['listing']> = {}): AgentListingRow {
  return {
    id: 'listing-1',
    organisation_id: 'org-1',
    slug: null,
    status: 'draft',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: {
      address: '1 Test Street',
      postcode: 'SG19 1AB',
      price: 250000,
      propertyType: 'Detached',
      tenure: 'freehold',
      ...overrides,
    } as AgentListingRow['listing'],
    provenance: {},
    material_info: {} as AgentListingRow['material_info'],
    transaction_id: null,
    published_at: null,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
  };
}

const baseInput = {
  listing: fakeListing(),
  agentPrincipal: '2vxsx-fae',
  sellerName: 'Jane Seller',
  sellerEmail: 'jane@example.com',
};

describe('startSaleService.startSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetListingData.mockResolvedValue(undefined);
  });

  it('should write the listing, with the agent material info folded in, on chain before linking', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({ createTransactionWithInvite: mockCreateTransactionWithInvite });
    mockRecordMyRole.mockResolvedValue(true);
    mockLinkTransaction.mockResolvedValue(undefined);
    mockSetStatus.mockResolvedValue(undefined);
    mockSend.mockResolvedValue({ ok: true, error: null });
    const listing = fakeListing();
    listing.material_info = {
      councilTaxBand: { value: 'D', source: 'agent' },
      groundRentPerYear: { value: 250, source: 'agent' },
    } as unknown as AgentListingRow['material_info'];

    await startSaleService.startSale({ ...baseInput, listing }, () => undefined);

    expect(mockSetListingData).toHaveBeenCalledWith(
      'tx_1',
      expect.objectContaining({ address: '1 Test Street', councilTaxBand: 'D', groundRentPerYear: 250 }),
    );
    expect(mockSetListingData.mock.invocationCallOrder[0]).toBeLessThan(mockLinkTransaction.mock.invocationCallOrder[0]);
  });

  it('should run all four steps and return the transaction id and invite code on the happy path', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({
      createTransactionWithInvite: mockCreateTransactionWithInvite,
    });
    mockRecordMyRole.mockResolvedValue(true);
    mockLinkTransaction.mockResolvedValue(undefined);
    mockSetStatus.mockResolvedValue(undefined);
    mockSend.mockResolvedValue({ ok: true, error: null });

    const progress: Array<{ step: number; status: string }> = [];
    const result = await startSaleService.startSale(baseInput, (p) => progress.push(p));

    expect(result).toEqual({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    expect(progress).toEqual([
      { step: 1, status: 'pending' },
      { step: 1, status: 'success', created: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } },
      { step: 2, status: 'pending' },
      { step: 2, status: 'success' },
      { step: 3, status: 'pending' },
      { step: 3, status: 'success' },
      { step: 4, status: 'pending' },
      { step: 4, status: 'success' },
    ]);
    expect(mockLinkTransaction).toHaveBeenCalledWith('listing-1', 'tx_1');
    expect(mockSetStatus).toHaveBeenCalledWith('listing-1', 'under_offer');
    // Load-bearing for RLS: the listing must be linked to the transaction
    // (the caller's provable relationship to it) before the role insert is
    // attempted, or the tightened transaction_party_roles policy denies it.
    expect(mockLinkTransaction.mock.invocationCallOrder[0]).toBeLessThan(mockRecordMyRole.mock.invocationCallOrder[0]);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx_1',
        inviteCode: 'TX-AAAA-1111',
        role: 'seller',
        side: 'seller',
        recipientName: 'Jane Seller',
        recipientEmail: 'jane@example.com',
        listingId: 'listing-1',
        propertyAddress: '1 Test Street',
      }),
    );
  });

  it('should fail step 1 and call nothing else when the canister returns err', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ err: 'canister rejected' });
    mockRequireTransactionManager.mockResolvedValue({
      createTransactionWithInvite: mockCreateTransactionWithInvite,
    });

    const progress: Array<{ step: number; status: string; error?: string }> = [];
    await expect(startSaleService.startSale(baseInput, (p) => progress.push(p))).rejects.toThrow(
      'canister rejected',
    );

    expect(progress).toEqual([
      { step: 1, status: 'pending' },
      { step: 1, status: 'failed', error: 'canister rejected' },
    ]);
    expect(mockRecordMyRole).not.toHaveBeenCalled();
    expect(mockLinkTransaction).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should link the listing, then retry recordMyRole once, and fail step 2 when both attempts return false', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({
      createTransactionWithInvite: mockCreateTransactionWithInvite,
    });
    mockLinkTransaction.mockResolvedValue(undefined);
    mockRecordMyRole.mockResolvedValue(false);

    const progress: Array<{ step: number; status: string; error?: string }> = [];
    await expect(startSaleService.startSale(baseInput, (p) => progress.push(p))).rejects.toThrow();

    expect(mockLinkTransaction).toHaveBeenCalledWith('listing-1', 'tx_1');
    expect(mockRecordMyRole).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([
      { step: 1, status: 'pending' },
      { step: 1, status: 'success', created: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } },
      { step: 2, status: 'pending' },
      { step: 2, status: 'failed', error: expect.any(String) },
    ]);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('should surface a clean step-2 failure when linkTransaction rejects with a unique-constraint message, without ever recording the role', async () => {
    // estateAgentListingsService.linkTransaction converts a 23505
    // (agent_listings_transaction_id_uidx) violation into this message —
    // this test confirms the saga propagates it as a step-2 failure (the
    // link now runs before the role write) rather than an unhandled throw,
    // and never reaches recordMyRole, setStatus (step 3), or step 4.
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({
      createTransactionWithInvite: mockCreateTransactionWithInvite,
    });
    mockLinkTransaction.mockRejectedValue(new Error('This listing is already linked to a sale.'));

    const progress: Array<{ step: number; status: string; error?: string }> = [];
    await expect(startSaleService.startSale(baseInput, (p) => progress.push(p))).rejects.toThrow(
      'This listing is already linked to a sale.',
    );

    expect(progress).toEqual([
      { step: 1, status: 'pending' },
      { step: 1, status: 'success', created: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } },
      { step: 2, status: 'pending' },
      { step: 2, status: 'failed', error: 'This listing is already linked to a sale.' },
    ]);
    expect(mockRecordMyRole).not.toHaveBeenCalled();
    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should still return the result when only the email step fails', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({
      createTransactionWithInvite: mockCreateTransactionWithInvite,
    });
    mockRecordMyRole.mockResolvedValue(true);
    mockLinkTransaction.mockResolvedValue(undefined);
    mockSetStatus.mockResolvedValue(undefined);
    mockSend.mockResolvedValue({ ok: false, error: 'rate_limited' });

    const progress: Array<{ step: number; status: string; error?: string }> = [];
    const result = await startSaleService.startSale(baseInput, (p) => progress.push(p));

    expect(result).toEqual({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    expect(progress).toEqual([
      { step: 1, status: 'pending' },
      { step: 1, status: 'success', created: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } },
      { step: 2, status: 'pending' },
      { step: 2, status: 'success' },
      { step: 3, status: 'pending' },
      { step: 3, status: 'success' },
      { step: 4, status: 'pending' },
      { step: 4, status: 'failed', error: 'rate_limited' },
    ]);
  });

  // #251: Retry used to re-invoke the saga from step 1. If step 1 had already
  // minted the on-chain transaction and a later step failed, that created a
  // SECOND transaction and left the first with no listing link and no party
  // roles - and, because the listing was by then linked to the orphan, the
  // retry's own step 2 failed too.
  it('should report the ids step 1 minted, so a caller can resume instead of restarting', async () => {
    mockCreateTransactionWithInvite.mockResolvedValue({ ok: ['tx_1', 'TX-AAAA-1111'] });
    mockRequireTransactionManager.mockResolvedValue({ createTransactionWithInvite: mockCreateTransactionWithInvite });
    mockLinkTransaction.mockRejectedValue(new Error('This listing is already linked to a sale.'));

    const progress: StartSaleProgress[] = [];
    await expect(startSaleService.startSale(baseInput, (p) => progress.push(p))).rejects.toThrow();

    const created = progress.find((p) => p.step === 1 && p.status === 'success')?.created;
    expect(created).toEqual({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    expect(progress.some((p) => p.step === 2 && p.status === 'failed')).toBe(true);
  });

  it('should skip step 1 entirely when resumed, minting no second transaction', async () => {
    mockRequireTransactionManager.mockResolvedValue({ createTransactionWithInvite: mockCreateTransactionWithInvite });
    mockRecordMyRole.mockResolvedValue(true);
    mockLinkTransaction.mockResolvedValue(undefined);
    mockSetStatus.mockResolvedValue(undefined);
    mockSend.mockResolvedValue({ ok: true, error: null });

    const progress: StartSaleProgress[] = [];
    const result = await startSaleService.startSale(
      { ...baseInput, resume: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } },
      (p) => progress.push(p),
    );

    expect(mockCreateTransactionWithInvite).not.toHaveBeenCalled();
    expect(result).toEqual({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    // Step 1 still reads as done, and the rest run against the SAME transaction.
    expect(progress[0]).toEqual({ step: 1, status: 'success', created: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } });
    expect(mockLinkTransaction).toHaveBeenCalledWith('listing-1', 'tx_1');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' }));
  });

  it('should resume through a step-3 failure too, still without re-creating the transaction', async () => {
    mockRequireTransactionManager.mockResolvedValue({ createTransactionWithInvite: mockCreateTransactionWithInvite });
    mockRecordMyRole.mockResolvedValue(true);
    mockLinkTransaction.mockResolvedValue(undefined);
    mockSetStatus.mockRejectedValue(new Error('status update failed'));

    const progress: StartSaleProgress[] = [];
    await expect(
      startSaleService.startSale({ ...baseInput, resume: { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' } }, (p) => progress.push(p)),
    ).rejects.toThrow('status update failed');

    expect(mockCreateTransactionWithInvite).not.toHaveBeenCalled();
    expect(progress.some((p) => p.step === 3 && p.status === 'failed')).toBe(true);
  });
});
