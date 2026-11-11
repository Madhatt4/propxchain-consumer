// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTransaction = vi.fn();
const mockGetEvents = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: {
    transactionManager: { getTransaction: (...a: unknown[]) => mockGetTransaction(...a) },
    ledgerManager: { getEventsByTransaction: (...a: unknown[]) => mockGetEvents(...a) },
  },
}));

import { loadPhaseChecklistState } from '../phaseChecklistLoader';

const COMPLETED_TX = [{ status: { blockchain_completed: null }, buyer: 'buyer-p', seller: 'seller-p' }];

function lrEvent(details: string): Record<string, unknown> {
  return { eventType: 'lr_submission', timestamp: 2n, details };
}

describe('loadPhaseChecklistState — registration application', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTransaction.mockResolvedValue(COMPLETED_TX);
  });

  it('should not tick the registration application for a simulated pre-2026-11-11 submission', async () => {
    // Arrange
    mockGetEvents.mockResolvedValue([
      { eventType: 'blockchain_completed', timestamp: 1n, details: 'Completed' },
      lrEvent('Land Registry submission triggered'),
    ]);

    // Act
    const state = await loadPhaseChecklistState('TX-TEST-1');

    // Assert
    expect(state?.phase).toBe('completed');
    expect(state?.items.find((i) => i.id === 'land-registry')?.completed).toBe(false);
  });

  it("should tick it for the buyer's conveyancer's recorded application", async () => {
    // Arrange
    mockGetEvents.mockResolvedValue([
      { eventType: 'blockchain_completed', timestamp: 1n, details: 'Completed' },
      lrEvent("Registration application submitted to HM Land Registry by the buyer's conveyancer on 2026-11-12"),
    ]);

    // Act
    const state = await loadPhaseChecklistState('TX-TEST-1');

    // Assert
    expect(state?.items.find((i) => i.id === 'land-registry')?.completed).toBe(true);
    expect(state?.items.find((i) => i.id === 'land-registry-registered')?.completed).toBe(false);
  });
});
