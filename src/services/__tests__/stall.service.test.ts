// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for stall.service.ts — mocks the Supabase client, same pattern as
 * enquiries.service.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  describeStage,
  describeStall,
  loadDealStage,
  loadDealStalls,
  longestWait,
  ownerSide,
  type DealStall,
} from '../stall.service';

const ROW = { signal: 'enquiry_unanswered', owner: 'seller_conveyancer', since: '2026-08-27T09:00:00Z', days: 9, detail: { label: 'enquiries waiting for an answer', open: 1 } };

describe('stall.service', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  it('loadDealStalls reads deal_stall and maps the label out of the detail', async () => {
    mockRpc.mockResolvedValue({ data: [ROW], error: null });
    const stalls = await loadDealStalls('tx_1');
    expect(mockRpc).toHaveBeenCalledWith('deal_stall', { p_transaction_id: 'tx_1' });
    expect(stalls).toEqual([{ signal: 'enquiry_unanswered', owner: 'seller_conveyancer', since: '2026-08-27T09:00:00Z', days: 9, label: 'enquiries waiting for an answer', detail: ROW.detail }]);
  });

  it('loadDealStalls: an unknown owner becomes none and a missing label falls back to the signal', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...ROW, owner: 'martian', detail: null }], error: null });
    const [stall] = await loadDealStalls('tx_1');
    expect(stall.owner).toBe('none');
    expect(stall.label).toBe('enquiry_unanswered');
  });

  it('loadDealStalls: signed out is an empty list without a call; an rpc error throws', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    expect(await loadDealStalls('tx_1')).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(loadDealStalls('tx_1')).rejects.toThrow('permission denied');
  });

  it('loadDealStage maps the row and returns null when the deal has no history', async () => {
    mockRpc.mockResolvedValue({ data: [{ stage: 'enquiries', entered_at: '2026-08-24T09:00:00Z', days: 12, benchmark_days: 14, sample_n: 0 }], error: null });
    expect(await loadDealStage('tx_1')).toEqual({ stage: 'enquiries', enteredAt: '2026-08-24T09:00:00Z', days: 12, benchmarkDays: 14, sampleN: 0 });
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await loadDealStage('tx_1')).toBeNull();
  });

  it('ownerSide puts the conveyancers on their side and leaves the agent unsided', () => {
    expect(ownerSide('seller_conveyancer')).toBe('seller');
    expect(ownerSide('buyer')).toBe('buyer');
    expect(ownerSide('estate_agent')).toBeNull();
    expect(ownerSide('none')).toBeNull();
  });

  it('longestWait picks the most days regardless of order', () => {
    const a: DealStall = { ...ROW, owner: 'seller_conveyancer', label: 'x', days: 3 };
    const b: DealStall = { ...a, signal: 'hmlr_not_fetched', days: 11 };
    expect(longestWait([a, b])?.signal).toBe('hmlr_not_fetched');
    expect(longestWait([])).toBeNull();
  });

  it('the copy names roles, never people, and pluralises days', () => {
    const stall: DealStall = { ...ROW, owner: 'seller_conveyancer', label: 'enquiries waiting for an answer' };
    expect(describeStall(stall)).toBe("Waiting on the seller's conveyancer: enquiries waiting for an answer, 9 days");
    expect(describeStall({ ...stall, owner: 'none', days: 1 })).toBe('Waiting: enquiries waiting for an answer, 1 day');
    expect(describeStage({ stage: 'enquiries', enteredAt: '', days: 12, benchmarkDays: 14, sampleN: 0 })).toBe('Enquiries: day 12 of a usual 14');
    expect(describeStage({ stage: 'searches', enteredAt: '', days: 30, benchmarkDays: 21, sampleN: 25 })).toBe('Searches: 30 days so far, past the usual 21');
  });
});
