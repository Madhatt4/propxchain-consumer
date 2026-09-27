import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, from, logEvent } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), logEvent: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) },
}));
vi.mock('@/services/icp.service', () => ({ icpService: { ledgerManager: { logEvent } } }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import {
  getDealSearchOrders,
  getMySignOffRole,
  getSignOffs,
  revokeSignOff,
  signOffSearches,
} from '../searchSignOff.service';

const HASH = 'a'.repeat(64);

describe('searchSignOff.service', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    logEvent.mockReset().mockResolvedValue({ ok: BigInt(1) });
  });

  it('should map the server search status rows', async () => {
    rpc.mockResolvedValue({
      data: [{ search_order_id: 'o1', provider: 'onesearch', ordered_at: '2026-09-01T00:00:00Z', has_results: true }],
      error: null,
    });

    const orders = await getDealSearchOrders('tx_1');

    expect(rpc).toHaveBeenCalledWith('transaction_search_status', { p_transaction_id: 'tx_1' });
    expect(orders).toEqual([{ searchOrderId: 'o1', provider: 'onesearch', orderedAt: '2026-09-01T00:00:00Z', hasResults: true }]);
  });

  it('should return null when the caller has no sign-off role', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await getMySignOffRole('tx_1')).toBeNull();
  });

  it('should read sign-offs for the deal newest first', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 's1', signer_user_id: 'u1', signer_role: 'buyer', search_order_ids: ['o1'], notes: null, signed_at: 'x', record_hash: HASH, revoked_at: null, revoke_reason: null }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const rows = await getSignOffs('tx_1');

    expect(from).toHaveBeenCalledWith('search_signoffs');
    expect(eq).toHaveBeenCalledWith('transaction_id', 'tx_1');
    expect(order).toHaveBeenCalledWith('signed_at', { ascending: false });
    expect(rows[0]).toMatchObject({ id: 's1', signerRole: 'buyer', recordHash: HASH, revokedAt: null });
  });

  it('should anchor the server hash on the ledger, with no names or notes', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 's1', signer_role: 'conveyancer', search_order_ids: ['o1', 'o2'], signed_at: 'x', record_hash: HASH }],
      error: null,
    });

    await signOffSearches('tx_1', 'All clear, Jane');

    expect(rpc).toHaveBeenCalledWith('sign_off_searches', { p_transaction_id: 'tx_1', p_notes: 'All clear, Jane' });
    const [txId, eventType, , payload] = logEvent.mock.calls[0];
    expect(txId).toBe('tx_1');
    expect(eventType).toBe('searches_signed_off');
    expect(JSON.parse(payload[0])).toEqual({ signOffId: 's1', signerRole: 'conveyancer', searchCount: 2, recordHash: HASH });
    expect(payload[0]).not.toMatch(/Jane/);
  });

  it('should surface the server refusal and log nothing', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no search results are back yet' } });

    await expect(signOffSearches('tx_1', '')).rejects.toThrow(/no search results are back yet/);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('should log the revocation hash', async () => {
    rpc.mockResolvedValue({ data: HASH, error: null });

    await revokeSignOff('tx_1', 's1', 'new results arrived');

    expect(rpc).toHaveBeenCalledWith('revoke_search_signoff', { p_signoff_id: 's1', p_reason: 'new results arrived' });
    expect(logEvent).toHaveBeenCalledWith('tx_1', 'searches_signoff_revoked', 'Search sign-off revoked', [
      JSON.stringify({ signOffId: 's1', revokeHash: HASH }),
    ]);
  });
});
