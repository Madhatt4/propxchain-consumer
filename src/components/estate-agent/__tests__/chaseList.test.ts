// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { describeChaseList, toChaseList } from '../chaseList';
import type { DealStall } from '@/services/stall.service';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const row = (id: string, transactionId: string | null): AgentListingRow =>
  ({ id, transaction_id: transactionId, status: 'sold_stc', listing: { address: `${id} High St`, price: 300000 } }) as unknown as AgentListingRow;

const stall = (days: number, owner: DealStall['owner'] = 'buyer'): DealStall =>
  ({ signal: 'buyer_pack_untouched', owner, since: '', days, label: 'buyer pack not started', detail: {} });

describe('toChaseList', () => {
  it('keeps live sales only, longest wait first, nothing-waiting last in listing order', () => {
    const listings = [row('a', 'tx_a'), row('b', null), row('c', 'tx_c'), row('d', 'tx_d'), row('e', 'tx_e')];
    const chase = toChaseList(listings, { tx_a: [stall(3)], tx_c: [stall(2), stall(11, 'seller_conveyancer')], tx_e: [] });
    expect(chase.map((e) => e.row.id)).toEqual(['c', 'a', 'd', 'e']);
    expect(chase[0].wait?.days).toBe(11);
    expect(chase[0].wait?.owner).toBe('seller_conveyancer');
    expect(chase[2].wait).toBeNull();
  });

  it('is empty when no listing has a sale behind it', () => {
    expect(toChaseList([row('a', null)], {})).toEqual([]);
  });
});

describe('describeChaseList', () => {
  it('counts sales and how many are waiting on someone', () => {
    const chase = toChaseList([row('a', 'tx_a'), row('b', 'tx_b'), row('c', 'tx_c')], { tx_a: [stall(3)], tx_b: [stall(1)] });
    expect(describeChaseList(chase)).toBe('3 live sales · 2 waiting on someone');
    expect(describeChaseList(toChaseList([row('a', 'tx_a')], {}))).toBe('1 live sale · nothing waiting');
    expect(describeChaseList(chase, true)).toBe('3 live sales · checking who they are waiting on');
  });
});

describe('toChaseList with desk signals', () => {
  const NOW = '2026-09-06T12:00:00.000Z';
  it('an overdue next action counts like a stall of the same length, and the mandate rides along', () => {
    const listings = [row('a', 'tx_a'), row('b', 'tx_b'), row('c', 'tx_c')];
    const desk = {
      actingForByTx: { tx_b: ['seller' as const] },
      nextDueByTx: { tx_b: '2026-09-01T09:00:00.000Z', tx_c: '2026-09-09T09:00:00.000Z' },
    };
    const chase = toChaseList(listings, { tx_a: [stall(3)] }, desk, NOW);
    expect(chase.map((e) => e.row.id)).toEqual(['b', 'a', 'c']);
    expect(chase[0].overdueDays).toBe(5);
    expect(chase[0].actingFor).toEqual(['seller']);
    expect(chase[2].overdueDays).toBe(0);
    expect(chase[2].nextDue).toBe('2026-09-09T09:00:00.000Z');
  });
});
