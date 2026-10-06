// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetAllCanisterCycles = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: { getAllCanisterCycles: (...args: unknown[]) => mockGetAllCanisterCycles(...args) },
}));

const mockGetCanisterHealth = vi.fn();
vi.mock('../../services/cyclesHealth', async () => {
  const actual = await vi.importActual<typeof import('../../services/cyclesHealth')>('../../services/cyclesHealth');
  return { ...actual, getCanisterHealth: (...args: unknown[]) => mockGetCanisterHealth(...args) };
});

// History is written only by the monorepo's daily cron. The browser must
// never try to call record_cycle_balance — authenticated lost EXECUTE on it
// in the 2026-08-22 lockdown migration, so the call would fail every time.
const mockRpc = vi.fn<(...args: unknown[]) => unknown>();
const mockSchema = vi.fn((..._args: unknown[]) => ({ rpc: mockRpc }));
vi.mock('../../lib/supabase', () => ({
  supabase: { schema: (...args: unknown[]) => mockSchema(...args), rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { useCyclesHealth } from '../useCyclesHealth';
import type { CanisterHealth } from '../../services/cyclesHealth';

const T = 1_000_000_000_000;

function health(name: string, id: string, balanceT: number): CanisterHealth {
  return {
    canisterName: name,
    canisterId: id,
    currentBalanceT: balanceT,
    burnRatePerDay: null,
    daysLeft: null,
    thresholdT: 0.5,
    status: 'grey',
    history: [{ measuredAt: new Date('2026-10-05T00:00:00Z'), balanceT, balanceCycles: balanceT * T }],
  };
}

describe('useCyclesHealth', () => {
  beforeEach(() => {
    mockGetAllCanisterCycles.mockReset();
    mockGetCanisterHealth.mockReset();
    mockRpc.mockReset();
    mockSchema.mockClear();
  });

  it('should load history on mount and expose it by canister name', async () => {
    mockGetCanisterHealth.mockResolvedValue([health('ledger_manager', 'hty74', 4.4)]);

    const { result } = renderHook(() => useCyclesHealth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.list).toHaveLength(1);
    expect(result.current.healthByCanister.ledger_manager.canisterId).toBe('hty74');
    expect(result.current.error).toBeNull();
  });

  it('should surface a history load failure as an error string', async () => {
    mockGetCanisterHealth.mockRejectedValue(new Error('relation "public.cycles_history" does not exist'));

    const { result } = renderHook(() => useCyclesHealth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('does not exist');
    expect(result.current.list).toEqual([]);
  });

  it('should append a live point on liveRefresh without writing to Supabase', async () => {
    mockGetCanisterHealth.mockResolvedValue([health('ledger_manager', 'hty74', 4.4)]);
    mockGetAllCanisterCycles.mockResolvedValue({
      ledger_manager: { canisterId: 'hty74', cycles: BigInt(4.3 * T) },
      frontend: { canisterId: '', cycles: BigInt(0), error: 'no getCycles' },
    });

    const { result } = renderHook(() => useCyclesHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.liveRefresh(); });

    expect(result.current.healthByCanister.ledger_manager.history).toHaveLength(2);
    expect(result.current.healthByCanister.ledger_manager.currentBalanceT).toBeCloseTo(4.3);
    expect(result.current.list.map((c) => c.canisterName)).toEqual(['ledger_manager']);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSchema).not.toHaveBeenCalled();
  });

  it('should keep prior canisters that the live query did not return', async () => {
    mockGetCanisterHealth.mockResolvedValue([health('ledger_manager', 'hty74', 4.4), health('frontend', 'u4idr', 0.5)]);
    mockGetAllCanisterCycles.mockResolvedValue({
      ledger_manager: { canisterId: 'hty74', cycles: BigInt(4.3 * T) },
    });

    const { result } = renderHook(() => useCyclesHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.liveRefresh(); });

    expect(result.current.healthByCanister.frontend.history).toHaveLength(1);
    expect(result.current.list).toHaveLength(2);
  });

  it('should report a live query failure without dropping the loaded history', async () => {
    mockGetCanisterHealth.mockResolvedValue([health('ledger_manager', 'hty74', 4.4)]);
    mockGetAllCanisterCycles.mockRejectedValue(new Error('agent timeout'));

    const { result } = renderHook(() => useCyclesHealth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.liveRefresh(); });

    expect(result.current.error).toBe('agent timeout');
    expect(result.current.list).toHaveLength(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
