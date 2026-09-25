// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The audit row a search order leaves on the deal records INTENT at checkout
 * time. It used to be written 'ordered' before anyone had paid, so every
 * abandoned checkout left the trail claiming a search had been bought. It is
 * promoted to 'ordered' by payment-worker's /verify-session, once Stripe says
 * the money moved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));

import { searchOrderService } from '../searchOrder.service';

const PAYLOAD = {
  transactionId: 'tx_1',
  provider: 'groundsure',
  packageType: 'custom' as const,
  searches: [],
  subtotalPence: 10000,
  vatPence: 2000,
  priority: false,
  priorityFeePence: 0,
  totalPence: 12000,
  orderedBy: 'seller' as const,
  postcode: 'SG19 1EX',
  localAuthority: null,
};

function captureInsert(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  mockFrom.mockReturnValue({
    insert: (row: Record<string, unknown>) => {
      rows.push(row);
      return { select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) };
    },
  });
  return rows;
}

describe('searchOrderService.createOrder', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('writes the row as requested by default, so an abandoned checkout never claims a sale', async () => {
    const rows = captureInsert();
    const res = await searchOrderService.createOrder(PAYLOAD);
    expect(res).toMatchObject({ success: true, orderId: 'row-1' });
    expect(mockFrom).toHaveBeenCalledWith('search_orders');
    expect(rows[0].status).toBe('requested');
    expect(rows[0].transaction_id).toBe('tx_1');
    expect(rows[0].total_pence).toBe(12000);
  });

  it('writes ordered only when a caller asks for it outright, which only a path owing nothing does', async () => {
    const rows = captureInsert();
    await searchOrderService.createOrder({ ...PAYLOAD, status: 'ordered' });
    expect(rows[0].status).toBe('ordered');
  });

  it('reports a failed insert rather than pretending an order exists', async () => {
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'permission denied' } }) }) }),
    });
    expect(await searchOrderService.createOrder(PAYLOAD)).toEqual({ success: false, error: 'permission denied' });
  });
});
