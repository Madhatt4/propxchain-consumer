import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('../../config/features', () => ({ FEATURE_FLAGS: { GROUNDSURE_ENABLED: true } }));

describe('groundsureService.placeOrder — pending-payment flow', () => {
  beforeEach(() => {
    // groundsure.service.ts reads VITE_GROUNDSURE_WORKER_URL into a
    // module-level const at import time, so the env var must be set
    // and the module re-imported fresh for each test to pick it up.
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    import.meta.env.VITE_GROUNDSURE_WORKER_URL = 'https://groundsure.test';
  });

  it('should return a pending_payment result with the row id and price, not an already-placed order', async () => {
    const { supabase } = await import('../../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-jwt' } },
      error: null,
    } as any);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ourReference: 'propxchain-2026-07-02-abc',
        retailGbp: 49,
        status: 'pending_payment',
      }),
    } as Response);

    const { groundsureService } = await import('../groundsure.service');

    const result = await groundsureService.placeOrder({
      address: '1 Test St',
      wkt: 'POLYGON((0 0,1 0,1 1,0 1,0 0))',
      items: [{ reportType: 'georisk_res' }],
    });

    expect(result).toEqual({
      success: true,
      id: '550e8400-e29b-41d4-a716-446655440000',
      ourReference: 'propxchain-2026-07-02-abc',
      retailGbp: 49,
      // Always an array, never absent: "the worker said nothing was dropped"
      // and "this worker is too old to say" mean the same thing to the caller,
      // and an optional field invites a truthiness check that treats [] as a
      // reduction.
      dropped: [],
      status: 'pending_payment',
    });
  });
});
