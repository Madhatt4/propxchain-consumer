import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc, from, invoke, warn } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), invoke: vi.fn(), warn: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn, error: vi.fn(), info: vi.fn() } }));

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
    invoke.mockReset().mockResolvedValue({ data: { recorded: true, eventId: '7' }, error: null });
    warn.mockReset();
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

  it('should ask deal-attest to record the sign-off by id only, never the notes or hash', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 's1', signer_role: 'conveyancer', search_order_ids: ['o1', 'o2'], signed_at: 'x', record_hash: HASH }],
      error: null,
    });

    await signOffSearches('tx_1', 'All clear, Jane');

    expect(rpc).toHaveBeenCalledWith('sign_off_searches', { p_transaction_id: 'tx_1', p_notes: 'All clear, Jane' });
    expect(invoke).toHaveBeenCalledWith('deal-attest', { body: { kind: 'search_signoff', signOffId: 's1' } });
    const sent = JSON.stringify(invoke.mock.calls);
    expect(sent).not.toMatch(/Jane/);
    expect(sent).not.toContain(HASH);
  });

  it('should not fail the sign-off when the attestation call fails', async () => {
    rpc.mockResolvedValue({ data: [{ id: 's1' }], error: null });
    invoke.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(signOffSearches('tx_1', 'All clear, Jane')).resolves.toBeUndefined();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(warn).toHaveBeenCalledWith('[dealAttest] attestation not recorded', { kind: 'search_signoff', code: 'invoke_failed' });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/Jane/);
  });

  it('should surface the server refusal and attest nothing', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no search results are back yet' } });

    await expect(signOffSearches('tx_1', '')).rejects.toThrow(/no search results are back yet/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should ask deal-attest to record the revocation without the reason', async () => {
    rpc.mockResolvedValue({ data: HASH, error: null });

    await revokeSignOff('s1', 'new results arrived');

    expect(rpc).toHaveBeenCalledWith('revoke_search_signoff', { p_signoff_id: 's1', p_reason: 'new results arrived' });
    expect(invoke).toHaveBeenCalledWith('deal-attest', { body: { kind: 'search_signoff_revoked', signOffId: 's1' } });
    expect(JSON.stringify(invoke.mock.calls)).not.toMatch(/new results arrived/);
  });
});
