import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { supabase } from '@/lib/supabase';
import stripePaymentService from '../stripePayment.service';

describe('prepareSearchCheckoutSession', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-jwt' } },
      error: null,
    } as any);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should post type=search with the given productRef and return the session', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' }),
    } as Response);

    const result = await stripePaymentService.prepareSearchCheckoutSession({
      principalId: 'principal-abc',
      productRef: 'groundsure:550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result).toEqual({ sessionId: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/create-session'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    // Asserted field-by-field rather than as an exact JSON string: the service
    // now also sends a cancelPath (defaulted to the current page) so that
    // cancelling checkout returns the user where they were.
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      principalId: 'principal-abc',
      type: 'search',
      productRef: 'groundsure:550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('should default to type=search when the caller omits type — existing Groundsure/OneSearch callers must be unaffected', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'cs_test_456', url: 'https://checkout.stripe.com/pay/cs_test_456' }),
    } as Response);

    await stripePaymentService.prepareSearchCheckoutSession({
      principalId: 'principal-abc',
      productRef: 'onesearch:550e8400-e29b-41d4-a716-446655440001',
    });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ type: 'search' });
  });

  it('should pass the caller-supplied type through — e.g. type=aml so payment-worker prices aml_checks, not groundsure_orders', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'cs_test_789', url: 'https://checkout.stripe.com/pay/cs_test_789' }),
    } as Response);

    await stripePaymentService.prepareSearchCheckoutSession({
      principalId: 'principal-abc',
      type: 'aml',
      productRef: 'aml:chk-1',
    });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ type: 'aml', productRef: 'aml:chk-1' });
  });

  it('should reject a redirect URL that is not a trusted Stripe host', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'cs_test_123', url: 'https://evil.example.com/pay' }),
    } as Response);

    await expect(
      stripePaymentService.prepareSearchCheckoutSession({
        principalId: 'principal-abc',
        productRef: 'groundsure:550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toThrow('Invalid payment redirect URL');
  });
});

describe("prepareSearchCheckoutSession — in the client's name (agent CRM, spec I3)", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'test-jwt' } }, error: null } as any);
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'cs_test_9', url: 'https://checkout.stripe.com/pay/cs_test_9' }) } as Response);
  });

  it('should tell the worker whom to bill and on which deal, and nothing extra otherwise', async () => {
    await stripePaymentService.prepareSearchCheckoutSession({ principalId: 'p', productRef: 'groundsure:row-1', onBehalfOf: 'seller', transactionId: 'tx_1' });
    const assisted = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(assisted).toMatchObject({ type: 'search', onBehalfOf: 'seller', transactionId: 'tx_1' });

    await stripePaymentService.prepareSearchCheckoutSession({ principalId: 'p', productRef: 'groundsure:row-1' });
    const own = JSON.parse(String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body));
    expect(own).not.toHaveProperty('onBehalfOf');
    expect(own).not.toHaveProperty('transactionId');
  });
});
