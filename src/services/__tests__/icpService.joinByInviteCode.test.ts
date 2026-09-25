import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// wrapWriteCall goes through a rate limiter + queue in production. Replace it
// with a pass-through so we can exercise the method's branching directly.
vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';

const VALID_CODE = 'TX-ABCD-1234';

function makeOkResult(overrides: Record<string, unknown> = {}): { ok: Record<string, unknown> } {
  return {
    ok: {
      id: 'tx-001',
      propertyId: 'prop-001',
      propertyAddress: '1 Test Lane',
      postcode: 'SW1A 1AA',
      titleNumber: 'TT-1',
      seller: { toString: () => 'seller-principal' },
      buyer: { toString: () => 'buyer-principal' },
      amount: BigInt(100000),
      status: { active: null },
      inviteCode: VALID_CODE,
      createdAt: BigInt(Date.now()) * BigInt(1_000_000),
      mode: 'standard',
      transactionType: 'residential',
      userRole: 'buyer',
      propertyType: 'house',
      propertyCategory: 'freehold',
      ...overrides,
    },
  };
}

describe('icpService.joinTransactionByInviteCode — audit wiring', () => {
  const logEvent = vi.fn();
  const joinTransactionByInviteCode = vi.fn();

  // `ledgerManager` and `transactionManager` are getters that read the private
  // *Actor fields, so tests write to the backing fields directly.
  type ICPServicePrivates = {
    transactionManagerActor: { joinTransactionByInviteCode: typeof joinTransactionByInviteCode } | null;
    ledgerManagerActor: { logEvent: typeof logEvent } | null;
  };

  beforeEach(() => {
    logEvent.mockReset().mockResolvedValue({ ok: BigInt(1) });
    joinTransactionByInviteCode.mockReset();

    const internals = icpService as unknown as ICPServicePrivates;
    internals.transactionManagerActor = { joinTransactionByInviteCode };
    internals.ledgerManagerActor = { logEvent };
  });

  afterEach(() => {
    const internals = icpService as unknown as ICPServicePrivates;
    internals.transactionManagerActor = null;
    internals.ledgerManagerActor = null;
  });

  it('fires buyer_joined logEvent with the transaction id when join succeeds', async () => {
    joinTransactionByInviteCode.mockResolvedValue(makeOkResult({ id: 'tx-042' }));

    await icpService.joinTransactionByInviteCode(VALID_CODE);

    // logEvent is fire-and-forget; flush microtasks so the catch-chain resolves.
    await Promise.resolve();

    expect(logEvent).toHaveBeenCalledTimes(1);
    const [txId, eventType, details, metadata] = logEvent.mock.calls[0];
    expect(txId).toBe('tx-042');
    expect(eventType).toBe('buyer_joined');
    expect(details).toContain(VALID_CODE);
    expect(metadata).toEqual([]);
  });

  it('uppercases the invite code before the canister call and audit message', async () => {
    joinTransactionByInviteCode.mockResolvedValue(makeOkResult());

    await icpService.joinTransactionByInviteCode(VALID_CODE.toLowerCase());
    await Promise.resolve();

    expect(joinTransactionByInviteCode).toHaveBeenCalledWith(VALID_CODE);
    expect(logEvent.mock.calls[0][2]).toContain(VALID_CODE);
  });

  it('does NOT fire logEvent when the canister returns err', async () => {
    joinTransactionByInviteCode.mockResolvedValue({ err: 'Invite code not found' });

    await expect(
      icpService.joinTransactionByInviteCode(VALID_CODE),
    ).rejects.toThrow('Invite code not found');

    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does NOT fire logEvent when the code format is invalid (no canister call made)', async () => {
    await expect(
      icpService.joinTransactionByInviteCode('not-a-code'),
    ).rejects.toThrow(/Invalid invite code format/i);

    expect(joinTransactionByInviteCode).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not propagate logEvent rejections (fire-and-forget)', async () => {
    joinTransactionByInviteCode.mockResolvedValue(makeOkResult());
    logEvent.mockRejectedValueOnce(new Error('ledger canister unreachable'));

    await expect(
      icpService.joinTransactionByInviteCode(VALID_CODE),
    ).resolves.toMatchObject({ id: 'tx-001' });

    // Flush microtasks so the catch handler runs before the test ends.
    await Promise.resolve();
    expect(logEvent).toHaveBeenCalledTimes(1);
  });
});
