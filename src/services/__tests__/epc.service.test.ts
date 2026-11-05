import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn(async () => ({ data: null, error: null }));
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...(args as [])) } },
}));

import { listPostcodeAddresses, lookupEpc } from '../epc.service';

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

describe('listPostcodeAddresses', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should ask the edge function for the address list of the postcode', async () => {
    mockInvoke.mockResolvedValue({ data: { addresses: [] }, error: null } as never);
    await listPostcodeAddresses(' SG19 1AB ');
    const [fn, options] = mockInvoke.mock.calls[0] as unknown as [string, { body: unknown }];
    expect(fn).toBe('epc-lookup');
    expect(options.body).toEqual({ postcode: 'SG19 1AB', mode: 'addresses' });
  });

  it('should keep well-formed homes and drop malformed rows', async () => {
    const home = { label: '12 Mill Lane', line1: '12 Mill Lane', uprn: '100012345678' };
    mockInvoke.mockResolvedValue({ data: { addresses: [home, { label: 3 }, null] }, error: null } as never);
    expect(await listPostcodeAddresses('SG19 1AB')).toEqual([home]);
  });

  it('should return null when the function errors, so the form falls back to typing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('500') } as never);
    expect(await listPostcodeAddresses('SG19 1AB')).toBeNull();
  });

  it('should return null when the call throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));
    expect(await listPostcodeAddresses('SG19 1AB')).toBeNull();
  });
});
