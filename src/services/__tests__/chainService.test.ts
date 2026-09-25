import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getChain } from '../chainService';

const getSession = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: () => getSession() } } }));

describe('getChain txId forwarding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // getChain reads VITE_VMC_PROXY_URL to decide between calling the proxy
    // and returning the bundled SANDBOX_SAMPLE. Vitest has no proxy URL set
    // by default, so stub one to force the fetch path these tests assert on.
    vi.stubEnv('VITE_VMC_PROXY_URL', 'https://proxy.test');
    getSession.mockResolvedValue({ data: { session: { access_token: 'user-jwt' } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('includes txId in the proxy request when a transactionId is given', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'not_in_chain', chain: null }),
    } as Response);

    await getChain({ uprn: '100', transactionId: 'tx-9' });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('txId=tx-9');
  });

  it('omits txId from the proxy request when no transactionId is given', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'not_in_chain', chain: null }),
    } as Response);

    await getChain({ uprn: '100' });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('txId');
  });

  it('sends the signed-in user access token, since the proxy answers only a party to the deal', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ status: 'not_in_chain', chain: null }) } as Response);

    await getChain({ uprn: '100', transactionId: 'tx-9' });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-jwt');
  });

  it('sends no Authorization header when nobody is signed in, so the proxy answers 401', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ status: 'not_in_chain', chain: null }) } as Response);

    await getChain({ uprn: '100', transactionId: 'tx-9' });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
