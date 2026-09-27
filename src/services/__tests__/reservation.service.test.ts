import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every supabase call is recorded as { table, op, payload, filters } so the
// tests can assert which plot writes happened and under what conditions.
interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

const { calls, snapshotError, plotCode } = vi.hoisted(() => ({
  calls: [] as Call[],
  snapshotError: { value: null as null | { message: string } },
  plotCode: { value: 'TX-ABCD-EFGH' as string | null },
}));

function builder(table: string): Record<string, unknown> {
  const call: Call = { table, op: '', filters: [] };
  calls.push(call);
  const result = (): { data: unknown; error: unknown } => {
    if (call.op === 'upsert') return { data: null, error: snapshotError.value };
    if (call.op === 'update' && call.filters.some(([k, v]) => k === 'reservation_status' && v === 'available')) {
      return { data: [{ id: 'plot-1' }], error: null }; // setPending succeeds
    }
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {
    update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), b),
    upsert: (payload: unknown) => ((call.op = 'upsert'), (call.payload = payload), b),
    insert: (payload: unknown) => ((call.op = 'insert'), (call.payload = payload), b),
    eq: (k: string, v: unknown) => (call.filters.push([k, v]), b),
    is: (k: string, v: unknown) => (call.filters.push([k, v]), b),
    select: () => b,
    then: (resolve: (r: unknown) => void) => resolve(result()),
  };
  return b;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    auth: { getUser: async () => ({ data: { user: { id: 'dev-1' } } }) },
  },
}));

vi.mock('@/services/plots.service', () => ({
  plotsService: {
    getById: async () => ({ id: 'plot-1-abcdef', plot_number: '7', plot_type_id: null, invite_code: plotCode.value }),
  },
}));
vi.mock('@/services/plot-types.service', () => ({ plotTypesService: { getById: vi.fn() } }));
vi.mock('@/services/sites.service', () => ({
  sitesService: { getById: async () => ({ name: 'Site', address: '1 Road' }) },
}));

import { reservationService } from '../reservation.service';

const INPUT = { plotId: 'plot-1', siteId: 'site-1', buyerName: 'B', buyerEmail: ' Buyer@Example.com ' };

function rollbacks(): Call[] {
  return calls.filter(
    (c) =>
      c.table === 'plots' &&
      c.op === 'update' &&
      (c.payload as { reservation_status?: string }).reservation_status === 'available',
  );
}

describe('reservationService.reservePlot rollback', () => {
  beforeEach(() => {
    calls.length = 0;
    snapshotError.value = null;
    plotCode.value = 'TX-ABCD-EFGH';
  });

  it('should return the plot to available when the snapshot step fails', async () => {
    snapshotError.value = { message: 'snapshot table down' };

    await expect(reservationService.reservePlot(INPUT, vi.fn())).rejects.toThrow(/snapshot/);

    expect(rollbacks()).toHaveLength(1);
    expect(rollbacks()[0].filters).toContainEqual(['reservation_status', 'pending']);
  });

  it('should return the plot to available when the plot has no invite code', async () => {
    plotCode.value = null;

    await expect(reservationService.reservePlot(INPUT, vi.fn())).rejects.toThrow(/invite code/);

    expect(rollbacks()).toHaveLength(1);
  });

  it('should hold the plot for the named buyer and hand back its code', async () => {
    const result = await reservationService.reservePlot(INPUT, vi.fn());

    expect(result.inviteCode).toBe('TX-ABCD-EFGH');
    const hold = calls.find((c) => c.table === 'plots' && c.op === 'update');
    expect(hold?.payload).toEqual({ reservation_status: 'pending', reserved_for_email: 'buyer@example.com' });
    expect(rollbacks()).toHaveLength(0);
  });
});

describe('reservationService.releaseReservation', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('should clear the buyer hold so no one can claim with the old email', async () => {
    await reservationService.releaseReservation('plot-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({ reservation_status: 'available', reserved_for_email: null });
  });
});
