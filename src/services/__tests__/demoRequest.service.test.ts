import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import { requestDemo } from '../demoRequest.service';

const INPUT = { company: 'Example Homes', name: 'Sam Builder', email: 'sam@example.com', website: '' };

describe('requestDemo', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should post the request to the demo-request edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const ok = await requestDemo(INPUT);

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('demo-request', { body: INPUT });
  });

  it('should return false when the function reports an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('502') });

    expect(await requestDemo(INPUT)).toBe(false);
  });

  it('should return false when the email was not sent', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

    expect(await requestDemo(INPUT)).toBe(false);
  });

  it('should return false when the network call throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));

    expect(await requestDemo(INPUT)).toBe(false);
  });
});
