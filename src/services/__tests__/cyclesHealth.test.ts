// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The history table lives in the devops_board schema (written by the
// monorepo's daily cycles-monitor cron), NOT in public. A query against
// public.cycles_history fails with "relation does not exist" — these tests
// pin the schema so nobody "fixes" the service back onto public.
const mockSchema = vi.fn();
const mockFrom = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    schema: (...args: unknown[]) => mockSchema(...args),
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  computeBurnRate,
  getCanisterHealth,
  getCyclesHistory,
  type Measurement,
} from '../cyclesHealth';

interface QueryResult { data: unknown; error: { message: string } | null }

function thenableQuery(result: QueryResult): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.gte = () => q;
  q.eq = () => q;
  q.limit = () => q;
  q.order = () => q;
  q.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const ROWS = [
  { measured_at: '2026-10-01T00:00:00Z', canister_name: 'ledger_manager', canister_id: 'hty74', balance_cycles: '4500000000000', balance_t: '4.5' },
  { measured_at: '2026-10-06T00:00:00Z', canister_name: 'ledger_manager', canister_id: 'hty74', balance_cycles: '4400000000000', balance_t: '4.4' },
  { measured_at: '2026-10-06T00:00:00Z', canister_name: 'frontend', canister_id: 'u4idr', balance_cycles: 522000000000, balance_t: 0.522 },
];

function point(daysAgo: number, balanceT: number): Measurement {
  return {
    measuredAt: new Date(Date.UTC(2026, 9, 6) - daysAgo * 86_400_000),
    balanceT,
    balanceCycles: balanceT * 1_000_000_000_000,
  };
}

describe('cyclesHealth service', () => {
  beforeEach(() => {
    mockSchema.mockReset();
    mockFrom.mockReset();
    mockSchema.mockReturnValue({ from: (...args: unknown[]) => mockFrom(...args) });
  });

  it('should read cycles_history from the devops_board schema, never public', async () => {
    mockFrom.mockReturnValue(thenableQuery({ data: ROWS, error: null }));

    await getCyclesHistory();

    expect(mockSchema).toHaveBeenCalledWith('devops_board');
    expect(mockFrom).toHaveBeenCalledWith('cycles_history');
  });

  it('should group rows by canister and coerce numeric strings', async () => {
    mockFrom.mockReturnValue(thenableQuery({ data: ROWS, error: null }));

    const grouped = (await getCyclesHistory()) as Record<string, Measurement[]>;

    expect(Object.keys(grouped).sort()).toEqual(['frontend', 'ledger_manager']);
    expect(grouped.ledger_manager).toHaveLength(2);
    expect(grouped.ledger_manager[1].balanceT).toBe(4.4);
    expect(grouped.ledger_manager[1].balanceCycles).toBe(4_400_000_000_000);
    expect(grouped.frontend[0].measuredAt).toBeInstanceOf(Date);
  });

  it('should throw the Supabase error message when the history query fails', async () => {
    mockFrom.mockReturnValue(thenableQuery({ data: null, error: { message: 'permission denied for table cycles_history' } }));

    await expect(getCyclesHistory()).rejects.toThrow('permission denied for table cycles_history');
  });

  it('should return an empty object when there are no rows', async () => {
    mockFrom.mockReturnValue(thenableQuery({ data: [], error: null }));

    expect(await getCyclesHistory()).toEqual({});
  });

  it('should attach the canister id from the newest row and sort red before green', async () => {
    mockFrom.mockReturnValue(thenableQuery({ data: ROWS, error: null }));

    const health = await getCanisterHealth();

    expect(health.map((h) => h.canisterName)).toEqual(['frontend', 'ledger_manager']);
    expect(health[0].status).toBe('grey');
    expect(health[1].canisterId).toBe('hty74');
    expect(health[1].status).toBe('green');
  });
});

describe('computeBurnRate', () => {
  it('should be grey with no measurements', () => {
    expect(computeBurnRate([])).toEqual({ currentBalanceT: 0, burnRatePerDay: null, daysLeft: null, status: 'grey' });
  });

  it('should be grey with a single healthy point and red with a single point under threshold', () => {
    expect(computeBurnRate([point(0, 3)]).status).toBe('grey');
    expect(computeBurnRate([point(0, 0.2)]).status).toBe('red');
  });

  it('should treat a net top-up across the window as no signal', () => {
    const r = computeBurnRate([point(5, 1), point(0, 2)]);
    expect(r.burnRatePerDay).toBeNull();
    expect(r.status).toBe('grey');
  });

  it('should compute burn rate and runway from the window endpoints', () => {
    const r = computeBurnRate([point(10, 5), point(0, 4)]);
    expect(r.burnRatePerDay).toBeCloseTo(0.1);
    expect(r.daysLeft).toBeCloseTo(40);
    expect(r.status).toBe('green');
  });

  it('should go amber under 30 days and red under 7 days of runway', () => {
    expect(computeBurnRate([point(10, 2), point(0, 1)]).status).toBe('amber');
    expect(computeBurnRate([point(1, 2), point(0, 1)]).status).toBe('red');
  });

  it('should be grey when all measurements share one timestamp', () => {
    expect(computeBurnRate([point(0, 2), point(0, 1)]).status).toBe('grey');
  });
});
