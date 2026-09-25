import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
import { supabase } from '@/lib/supabase';
import stripePaymentService from '../stripePayment.service';

/** Body the service actually POSTed, parsed back out of the fetch mock. */
function postedBody(): Record<string, unknown> {
  const call = vi.mocked(fetch).mock.calls[0];
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe('prepareChainUnlockCheckoutSession', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-jwt' } }, error: null,
    } as any);
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'cs_test_9', url: 'https://checkout.stripe.com/pay/cs_test_9' }),
    } as Response);
    window.history.pushState({}, '', '/');
  });

  it('posts type=chain-unlock with the transactionId and returns the session', async () => {
    const result = await stripePaymentService.prepareChainUnlockCheckoutSession({
      principalId: 'principal-abc', transactionId: 'tx-123',
    });

    expect(result).toEqual({ sessionId: 'cs_test_9', url: 'https://checkout.stripe.com/pay/cs_test_9' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/create-session'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(postedBody()).toMatchObject({
      principalId: 'principal-abc', type: 'chain-unlock', transactionId: 'tx-123',
    });
  });

  // Regression: payment-worker defaults an absent cancelPath to
  // /create-transaction, so cancelling a chain-unlock dumped the user on
  // "start a transaction" instead of the transaction they were paying for.
  it('should default cancelPath to the transaction page the user is on', async () => {
    window.history.pushState({}, '', '/transaction/tx-123/flow?tab=chain');

    await stripePaymentService.prepareChainUnlockCheckoutSession({
      principalId: 'principal-abc', transactionId: 'tx-123',
    });

    expect(postedBody().cancelPath).toBe('/transaction/tx-123/flow?tab=chain');
  });

  it('should let an explicit cancelPath override the current page', async () => {
    window.history.pushState({}, '', '/transaction/tx-123/flow');

    await stripePaymentService.prepareChainUnlockCheckoutSession({
      principalId: 'principal-abc', transactionId: 'tx-123', cancelPath: '/somewhere-else',
    });

    expect(postedBody().cancelPath).toBe('/somewhere-else');
  });

  // The path becomes part of Stripe's cancel_url, so it must never be able to
  // carry the user off-origin. An unsafe value is omitted rather than sent,
  // leaving payment-worker's own fallback as the last line of defence.
  it('should omit cancelPath rather than send a protocol-relative path', async () => {
    await stripePaymentService.prepareChainUnlockCheckoutSession({
      principalId: 'principal-abc', transactionId: 'tx-123', cancelPath: '//evil.example.com',
    });

    expect(postedBody().cancelPath).toBeUndefined();
  });
});
