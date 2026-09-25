// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The hook calls getAllCanisterCycles (light, used by both summary + enriched
// fetch) and getCanisterFullStatus (the enriched, per-canister management call).
// The whole point of the migration is that the enriched call only runs when the
// Canisters tab is visited — and only once per canister, not multiplied by the
// summary fetch.
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getAllCanisterCycles: vi.fn(),
    getCanisterFullStatus: vi.fn(),
    getAllTransactions: vi.fn(),
    getBudgetStatus: vi.fn(),
  },
}));

vi.mock('@/services/supabase.auth.service', () => ({
  supabaseAuthService: { getEmailRegistrations: vi.fn() },
}));

vi.mock('@/services/message.service', () => ({
  messageService: {
    getStats: vi.fn(),
    getMyThreads: vi.fn(),
    getUnreadCount: vi.fn(),
  },
}));

import { icpService } from '@/services/icp.service';
import { useAdminDashboard } from '../useAdminDashboard';

const CANISTER_IDS: Record<string, { cycles: bigint; canisterId: string }> = {
  user_management: { cycles: BigInt(5_000_000_000_000), canisterId: 'aaaaa-aa' },
  transactions: { cycles: BigInt(3_000_000_000_000), canisterId: 'bbbbb-bb' },
  documents: { cycles: BigInt(4_000_000_000_000), canisterId: 'ccccc-cc' },
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAdminDashboard — canister fetch dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(icpService.getAllCanisterCycles).mockResolvedValue(CANISTER_IDS);
    vi.mocked(icpService.getAllTransactions).mockResolvedValue([]);
    vi.mocked(icpService.getBudgetStatus).mockResolvedValue(null);
    vi.mocked(icpService.getCanisterFullStatus).mockResolvedValue({
      cycles: BigInt(5_000_000_000_000),
      memorySize: BigInt(1024),
      freezingThreshold: 2_592_000,
      controllers: ['ctrl-1'],
      status: 'running',
      moduleHash: null,
    });
  });

  it('does not run enriched management-status enrichment on mount (summary uses the light fetch only)', async () => {
    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    // Summary loads on mount; wait for it.
    await waitFor(() => expect(result.current.summary).not.toBeNull());

    // The summary path must NOT have triggered any enriched per-canister calls.
    expect(icpService.getCanisterFullStatus).not.toHaveBeenCalled();
  });

  it('runs the enriched status enrichment exactly once per canister after visiting the Canisters tab', async () => {
    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(icpService.getCanisterFullStatus).not.toHaveBeenCalled();

    // Visit the Canisters tab — this enables the enriched query.
    act(() => {
      result.current.setActiveTab('canisters');
    });

    await waitFor(() => expect(result.current.canisters.length).toBe(3));

    // Enriched fetch runs once per canister — NOT multiplied by the summary
    // fetch (which used the light getAllCanisterCycles only).
    const canisterCount = Object.keys(CANISTER_IDS).length;
    expect(icpService.getCanisterFullStatus).toHaveBeenCalledTimes(canisterCount);

    // Each canister id was enriched exactly once.
    for (const { canisterId } of Object.values(CANISTER_IDS)) {
      expect(icpService.getCanisterFullStatus).toHaveBeenCalledWith(canisterId);
    }
  });

  it('still produces summary data when getAllCanisterCycles rejects (cards never blank)', async () => {
    // Regression: an unguarded rejection here used to fail the whole summary
    // query, leaving SummaryCards with null data → blank header cards.
    vi.mocked(icpService.getAllCanisterCycles).mockRejectedValue(new Error('boom'));
    vi.mocked(icpService.getAllTransactions).mockResolvedValue([
      { status: 'active' } as never,
    ]);

    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    // Canister portion degrades to 0 (and logs), but the card row still renders
    // with the data that did load.
    expect(result.current.summary?.totalCanisters).toBe(0);
    expect(result.current.summary?.activeTransactions).toBe(1);
  });

  it('does not fetch until ready is true', async () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useAdminDashboard({ ready }),
      { wrapper, initialProps: { ready: false } },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(icpService.getAllCanisterCycles).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();

    rerender({ ready: true });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(icpService.getAllCanisterCycles).toHaveBeenCalled();
  });

  it('resolves summary via timeout when a summary call hangs (cards never stuck on skeletons)', async () => {
    // Regression: a hanging IC call (e.g. an expired/invalid session) can't be
    // rescued by .catch and used to leave the summary query pending forever.
    vi.useFakeTimers();
    // getAllCanisterCycles never settles (summary wraps it in withTimeout).
    vi.mocked(icpService.getAllCanisterCycles).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    // Advance past the per-call timeout so the hung call resolves to its fallback.
    await vi.advanceTimersByTimeAsync(8500);
    vi.useRealTimers();

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    // Canister portion falls back to 0; the rest of the summary still renders.
    expect(result.current.summary?.totalCanisters).toBe(0);
  });

  it('derives active-transaction count from the transactions query, not a summary refetch', async () => {
    vi.mocked(icpService.getAllTransactions).mockResolvedValue([
      { status: 'active' } as never,
      { status: 'blockchain_completed' } as never,
      { status: 'exchanged' } as never,
    ]);

    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    // active = completion not yet recorded on chain → 2 of the 3 above.
    await waitFor(() => expect(result.current.summary?.activeTransactions).toBe(2));
  });
});
