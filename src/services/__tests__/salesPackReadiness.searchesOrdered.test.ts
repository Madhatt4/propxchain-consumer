// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * A `search_orders` row is written when checkout opens, before anyone has
 * paid, so the row existing does not mean searches were ordered. These cover
 * the statuses the readiness meter is allowed to count — the sibling file
 * covers the pure scoring function, which takes the booleans already decided.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/rightmoveStorage', () => ({
  syncListingFromChain: vi.fn(async () => null),
  getTitleNumber: vi.fn(() => null),
}));
vi.mock('../hmlrTitle.service', () => ({
  hmlrTitleService: {
    getStoredRegisterForTransaction: vi.fn(async () => null),
    findPullByTitleNumber: vi.fn(async () => null),
  },
}));
vi.mock('../searchOrder.service', () => ({
  searchOrderService: { getOrdersForTransaction: vi.fn(async () => searchOrders) },
}));
vi.mock('../onesearchResults', () => ({
  fetchReturnedOneSearchResults: vi.fn(async () => []),
}));
vi.mock('../documentShare.service', () => ({
  documentShareService: { listMyGrants: vi.fn(async () => []) },
}));
vi.mock('../icp.service', () => ({
  icpService: {
    getTA6: vi.fn(async () => null),
    getTA10: vi.fn(async () => null),
    getTA7: vi.fn(async () => null),
    ledgerManager: { getEventsByTransaction: vi.fn(async () => ledgerEvents) },
  },
}));

import { loadPackReadinessInputs } from '../salesPackReadiness';

let searchOrders: Array<{ status: string }> = [];
let ledgerEvents: Array<{ eventType?: string }> = [];

beforeEach(() => {
  searchOrders = [];
  ledgerEvents = [];
});

async function searchesOrdered(): Promise<boolean> {
  const inputs = await loadPackReadinessInputs('tx-1');
  return inputs.searchesOrdered;
}

describe('readiness: searches ordered', () => {
  it('should not count a row still awaiting payment confirmation', async () => {
    searchOrders = [{ status: 'requested' }];

    expect(await searchesOrdered()).toBe(false);
  });

  it('should not count a row whose checkout was abandoned', async () => {
    searchOrders = [{ status: 'abandoned' }];

    expect(await searchesOrdered()).toBe(false);
  });

  it('should not count an order that never reached the supplier', async () => {
    searchOrders = [{ status: 'failed' }];

    expect(await searchesOrdered()).toBe(false);
  });

  it.each(['ordered', 'in_progress', 'completed'])(
    'should count a row at %s',
    async (status) => {
      searchOrders = [{ status }];

      expect(await searchesOrdered()).toBe(true);
    },
  );

  it('should count a paid order sitting alongside an abandoned one', async () => {
    searchOrders = [{ status: 'abandoned' }, { status: 'ordered' }];

    expect(await searchesOrdered()).toBe(true);
  });

  it('should still fall back to the searches_ordered ledger event', async () => {
    searchOrders = [{ status: 'abandoned' }];
    ledgerEvents = [{ eventType: 'searches_ordered' }];

    expect(await searchesOrdered()).toBe(true);
  });

  it('should be false when there is no order and no event', async () => {
    expect(await searchesOrdered()).toBe(false);
  });
});
