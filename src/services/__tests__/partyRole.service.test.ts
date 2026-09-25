import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: (...a: unknown[]) => mockLoggerError(...a),
    warn: (...a: unknown[]) => mockLoggerWarn(...a),
    debug: vi.fn(),
  },
}));
const mockUpsert = vi.fn();
const mockGetSession = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a), select: (...a: unknown[]) => mockSelect(...a) }),
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  },
}));
const mockBuildPrincipalProof = vi.fn();
vi.mock('../principalProof', () => ({
  buildPrincipalProof: (message: string) => mockBuildPrincipalProof(message),
}));
const mockGetStorePrincipalId = vi.fn();
vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: () => mockGetStorePrincipalId(),
}));

import { partyRoleService } from '../partyRole.service';

const PROOF = { principal: 'p1', publicKeyDer: 'a2V5', signature: 'c2ln' };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
  mockBuildPrincipalProof.mockResolvedValue(PROOF);
  mockGetStorePrincipalId.mockReturnValue('p1');
});

describe('partyRoleService.recordMyRole', () => {
  it('should upsert my role row keyed on (transaction, principal)', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const ok = await partyRoleService.recordMyRole({
      transactionId: 'tx1', principal: 'p1', role: 'estate_agent', side: 'seller', invitedBy: 'p0',
    });
    expect(ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      { transaction_id: 'tx1', principal: 'p1', role: 'estate_agent', side: 'seller', invited_by_principal: 'p0', user_id: 'uid-1' },
      { onConflict: 'transaction_id,principal' },
    );
  });

  it('should return false without throwing when there is no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(partyRoleService.recordMyRole({ transactionId: 'tx1', principal: 'p1', role: 'other' })).resolves.toBe(
      false,
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('should log at error (not warn) and return false when the write is denied by row-level security', async () => {
    mockUpsert.mockResolvedValue({
      error: { code: '42501', message: 'new row violates row-level security policy for table "transaction_party_roles"' },
    });

    const ok = await partyRoleService.recordMyRole({ transactionId: 'tx-denied', principal: 'p1', role: 'other' });

    expect(ok).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const [message] = mockLoggerError.mock.calls[0];
    expect(message).toContain('tx-denied');
    expect(message).not.toMatch(/p1/);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('should still detect a denial by message when the code is missing', async () => {
    mockUpsert.mockResolvedValue({
      error: { message: 'permission denied for table transaction_party_roles due to row-level security' },
    });

    const ok = await partyRoleService.recordMyRole({ transactionId: 'tx-denied-2', principal: 'p1', role: 'other' });

    expect(ok).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('should keep the existing warn behaviour and return false for a non-RLS failure', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'boom' } });

    const ok = await partyRoleService.recordMyRole({ transactionId: 'tx1', principal: 'p1', role: 'other' });

    expect(ok).toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledWith('[partyRole] could not record role', { message: 'boom' });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});

describe('partyRoleService.listForTransaction', () => {
  it('should select rows for the transaction under RLS', async () => {
    const rows = [
      {
        transaction_id: 'tx1',
        principal: 'p1',
        role: 'estate_agent',
        side: 'seller',
        invited_by_principal: 'p0',
        created_at: '2026-08-24T00:00:00Z',
      },
    ];
    mockEq.mockResolvedValue({ data: rows, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await partyRoleService.listForTransaction('tx1');

    expect(result).toEqual(rows);
    expect(mockSelect).toHaveBeenCalledWith('transaction_id, principal, role, side, invited_by_principal, created_at');
    expect(mockEq).toHaveBeenCalledWith('transaction_id', 'tx1');
  });

  it('should throw on supabase error', async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: 'RLS violation' } });
    mockSelect.mockReturnValue({ eq: mockEq });

    await expect(partyRoleService.listForTransaction('tx1')).rejects.toThrow(
      'Failed to fetch party roles: RLS violation',
    );
  });

  it('should return an empty array when there are no rows', async () => {
    mockEq.mockResolvedValue({ data: null, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await partyRoleService.listForTransaction('tx1');
    expect(result).toEqual([]);
  });
});

describe('partyRoleService.recordRoleFromChain', () => {
  it('should sign the purpose-bound message and post the proof to record-party-role without naming a role', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, role: 'seller', side: 'seller', created: true }, error: null });

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(mockBuildPrincipalProof).toHaveBeenCalledWith('record-party-role:tx_1:uid-1');
    expect(mockInvoke).toHaveBeenCalledWith('record-party-role', { body: { transactionId: 'tx_1', ...PROOF } });
    expect(outcome).toEqual({ ok: true, role: 'seller', side: 'seller', created: true });
  });

  it('should return no_session without signing when nobody is signed in to Supabase', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(outcome).toEqual({ ok: false, error: 'no_session' });
    expect(mockBuildPrincipalProof).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should surface the proof failure code and not call the function', async () => {
    mockBuildPrincipalProof.mockRejectedValueOnce(new Error('unsupported_identity'));

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(outcome).toEqual({ ok: false, error: 'unsupported_identity' });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });

  it("should read the function's refusal code out of a non-2xx response body", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: () => Promise.resolve({ error: 'not_a_principal_party' }) },
      },
    });

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(outcome).toEqual({ ok: false, error: 'not_a_principal_party' });
  });

  it('should fall back to the transport message when the body is not JSON', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Failed to send a request to the Edge Function',
        context: { json: () => Promise.reject(new Error('x')) },
      },
    });

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(outcome).toEqual({ ok: false, error: 'Failed to send a request to the Edge Function' });
  });

  it('should treat a 2xx body without ok/role/side as a failure rather than a recorded row', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    const outcome = await partyRoleService.recordRoleFromChain('tx_1');

    expect(outcome).toEqual({ ok: false, error: 'unexpected_response' });
  });
});

describe('partyRoleService.ensureMyRoleFromChain', () => {
  function rowsForMe(present: boolean): void {
    mockEq.mockResolvedValue({
      data: present
        ? [{ transaction_id: 'tx_1', principal: 'p1', role: 'seller', side: 'seller', invited_by_principal: null, created_at: 'now' }]
        : [],
      error: null,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
  }

  it('should do nothing when I already have a row on this deal', async () => {
    rowsForMe(true);

    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('partyRole:ensured:tx_1')).toBe('1');
  });

  it('should ask the chain-verified writer when I have no row, and not ask again this session once it succeeds', async () => {
    rowsForMe(false);
    mockInvoke.mockResolvedValue({ data: { ok: true, role: 'buyer', side: 'buyer', created: true }, error: null });

    await partyRoleService.ensureMyRoleFromChain('tx_1');
    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('should not ask again this session after a settled refusal such as not being a principal party', async () => {
    rowsForMe(false);
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ error: 'not_a_principal_party' }) } },
    });

    await partyRoleService.ensureMyRoleFromChain('tx_1');
    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('should leave a transient failure retryable on the next visit', async () => {
    rowsForMe(false);
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ error: 'chain_read_failed' }) } },
    });

    await partyRoleService.ensureMyRoleFromChain('tx_1');
    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('partyRole:ensured:tx_1')).toBeNull();
  });

  it('should do nothing without a principal in the auth store', async () => {
    mockGetStorePrincipalId.mockReturnValue(null);

    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should give up quietly when the row check itself fails', async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: 'network' } });
    mockSelect.mockReturnValue({ eq: mockEq });

    await partyRoleService.ensureMyRoleFromChain('tx_1');

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
