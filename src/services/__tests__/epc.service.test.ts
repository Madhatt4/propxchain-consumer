import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn(async () => ({ data: null, error: null }));
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...(args as [])) } },
}));

import { lookupEpc } from '../epc.service';

describe('lookupEpc', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('should forward the abort signal to the edge-function invoke', async () => {
    // A stale scan must cancel the request itself, not just discard the
    // result — the EPC edge function is IP-rate-limited (30 req/5min).
    const controller = new AbortController();
    await lookupEpc('SG19 1AX', { signal: controller.signal });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, options] = mockInvoke.mock.calls[0] as unknown as [string, { signal?: AbortSignal }];
    expect(fn).toBe('epc-lookup');
    expect(options.signal).toBe(controller.signal);
  });

  it('should short-circuit without a network call when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await lookupEpc('SG19 1AX', { signal: controller.signal });
    expect(result).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should return null for a blank postcode without a network call', async () => {
    expect(await lookupEpc('   ')).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
