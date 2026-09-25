import { describe, it, expect, vi, beforeEach } from 'vitest';

// The paid pull must name the Stripe session that paid for it: the proxy
// claims that session's one-use credit before contacting HMLR (security
// scan 2026-09-23, H1). These tests pin the request the service sends.
vi.mock('../icp.service', () => ({ icpService: {} }));
vi.mock('../../utils/hashGenerator', () => ({
  generateBufferHash: vi.fn(),
  isValidSHA256Hash: vi.fn(() => true),
}));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'jwt-123' } }, error: null }),
    },
  },
}));

import { hmlrTitleService, HmlrPullError } from '../hmlrTitle.service';

const mockFetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('hmlrTitleService.pullTitleRegister — paid session', () => {
  it('sends the paying Stripe session to the proxy with the caller\'s JWT', async () => {
    // Stop after the proxy call: a refusal is enough to inspect the request.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => JSON.stringify({ error: 'payment_not_found' }),
    } as Response);

    await expect(
      hmlrTitleService.pullTitleRegister('GR506405', 'tx_1', { stripeSessionId: 'cs_test_abc' }),
    ).rejects.toBeInstanceOf(HmlrPullError);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/title\/GR506405$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
    expect(JSON.parse(String(init.body))).toEqual({ stripeSessionId: 'cs_test_abc' });
  });

  it('surfaces the proxy\'s refusal code as the error cause', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: 'credit_already_used' }),
    } as Response);

    const err = await hmlrTitleService
      .pullTitleRegister('GR506405', 'tx_1', { stripeSessionId: 'cs_test_abc' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HmlrPullError);
    expect((err as HmlrPullError).cause).toBe('credit_already_used');
  });
});
