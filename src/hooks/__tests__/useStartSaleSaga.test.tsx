// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The retry contract (#251). Step 1 mints an on-chain transaction, so every
 * later attempt for the same listing must resume it rather than mint another:
 * pressing Retry, closing the modal and starting again, or leaving the listing
 * page entirely and coming back, which unmounts the hook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { StartSaleInput, StartSaleProgress } from '@/services/startSale.service';

const mockStartSale = vi.fn();
vi.mock('@/services/startSale.service', () => ({
  startSaleService: { startSale: (...args: unknown[]) => mockStartSale(...args) },
}));
vi.mock('@/services/partyInvite.service', () => ({ partyInviteService: { send: vi.fn() } }));

import { useStartSaleSaga } from '../useStartSaleSaga';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const MINTED = { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' };

function listing(id = 'listing-1'): AgentListingRow {
  return {
    id,
    organisation_id: 'org-1',
    slug: null,
    status: 'draft',
    source: 'manual',
    source_url: null,
    listing: { address: '1 Test Street', postcode: 'SG19 1AB', price: 250000, propertyType: 'Detached', tenure: 'freehold' },
    provenance: {},
    material_info: {},
    transaction_id: null,
    published_at: null,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
  } as unknown as AgentListingRow;
}

function renderSaga(id = 'listing-1') {
  return renderHook(() =>
    useStartSaleSaga({ listing: listing(id), agentPrincipal: '2vxsx-fae', onComplete: vi.fn(), onClose: vi.fn() }),
  );
}

/** Step 1 succeeds (reporting what it minted), then the saga fails at step 2. */
function mintsThenFailsAtStepTwo(): void {
  mockStartSale.mockImplementationOnce(async (_input: StartSaleInput, onProgress: (p: StartSaleProgress) => void) => {
    onProgress({ step: 1, status: 'success', created: MINTED });
    onProgress({ step: 2, status: 'failed', error: 'RLS denied the role insert' });
    throw new Error('RLS denied the role insert');
  });
}

const inputOf = (call: number): StartSaleInput => mockStartSale.mock.calls[call][0] as StartSaleInput;

describe('useStartSaleSaga — retry resumes rather than restarts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('runs the retry at all, and hands it the transaction step 1 already minted', async () => {
    mintsThenFailsAtStepTwo();
    const { result } = renderSaga();

    await act(async () => { await result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(inputOf(0).resume).toBeUndefined();

    mockStartSale.mockResolvedValueOnce(MINTED);
    await act(async () => { result.current.handleRetry(); });

    // The double-submit guard has to have cleared, or Retry is dead and #251 stands.
    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(2));
    expect(inputOf(1).resume).toEqual(MINTED);
    await waitFor(() => expect(result.current.phase).toBe('success'));
  });

  it('resumes a fresh submit after the agent closed the modal, instead of minting a second transaction', async () => {
    mintsThenFailsAtStepTwo();
    const { result } = renderSaga();

    await act(async () => { await result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(result.current.phase).toBe('failed'));

    act(() => { result.current.handleClose(); });
    expect(result.current.phase).toBe('form');

    mockStartSale.mockResolvedValueOnce(MINTED);
    await act(async () => { await result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(2));
    expect(inputOf(1).resume).toEqual(MINTED);
  });

  it('resumes after the hook itself is unmounted and remounted, which is leaving the page and coming back', async () => {
    mintsThenFailsAtStepTwo();
    const first = renderSaga();
    await act(async () => { await first.result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(first.result.current.phase).toBe('failed'));
    first.unmount();

    mockStartSale.mockResolvedValueOnce(MINTED);
    const second = renderSaga();
    await act(async () => { await second.result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(2));
    expect(inputOf(1).resume).toEqual(MINTED);
  });

  it('never resumes onto a different listing, and forgets everything once the sale is done', async () => {
    mintsThenFailsAtStepTwo();
    const { result, unmount } = renderSaga('listing-1');
    await act(async () => { await result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    unmount();

    // A different property must mint its own transaction.
    mockStartSale.mockResolvedValueOnce({ transactionId: 'tx_2', inviteCode: 'TX-BBBB-2222' });
    const other = renderSaga('listing-2');
    await act(async () => { await other.result.current.runSaga('Sam Seller', 'sam@example.com'); });
    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(2));
    expect(inputOf(1).resume).toBeUndefined();
    await waitFor(() => expect(other.result.current.phase).toBe('success'));

    // Finishing listing-2 clears only listing-2; listing-1 is still unfinished.
    act(() => { other.result.current.handleDone(); });
    const back = renderSaga('listing-1');
    mockStartSale.mockResolvedValueOnce(MINTED);
    await act(async () => { await back.result.current.runSaga('Jane Seller', 'jane@example.com'); });
    await waitFor(() => expect(mockStartSale).toHaveBeenCalledTimes(3));
    expect(inputOf(2).resume).toEqual(MINTED);
  });
});
