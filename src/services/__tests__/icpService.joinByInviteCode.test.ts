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

// The ledger refuses browser writes, so the join itself writes no audit event
// from here. The plain join assigns no buyer and the canister records nothing
// for it; a buyer arrives on-chain as buyer_self_assigned or buyer_assigned.
describe('icpService.joinTransactionByInviteCode — no browser ledger write', () => {
  const logEvent = vi.fn();
  const joinTransactionByInviteCode = vi.fn();
  const joinTransactionByInviteCodeAsBuyer = vi.fn();

  // `ledgerManager` and `transactionManager` are getters that read the private
  // *Actor fields, so tests write to the backing fields directly.
  type ICPServicePrivates = {
    transactionManagerActor: {
      joinTransactionByInviteCode: typeof joinTransactionByInviteCode;
      joinTransactionByInviteCodeAsBuyer: typeof joinTransactionByInviteCodeAsBuyer;
    } | null;
    ledgerManagerActor: { logEvent: typeof logEvent } | null;
  };

  beforeEach(() => {
    logEvent.mockReset().mockResolvedValue({ ok: BigInt(1) });
    joinTransactionByInviteCode.mockReset();
    joinTransactionByInviteCodeAsBuyer.mockReset();

    const internals = icpService as unknown as ICPServicePrivates;
    internals.transactionManagerActor = { joinTransactionByInviteCode, joinTransactionByInviteCodeAsBuyer };
    internals.ledgerManagerActor = { logEvent };
  });

  afterEach(() => {
    const internals = icpService as unknown as ICPServicePrivates;
    internals.transactionManagerActor = null;
    internals.ledgerManagerActor = null;
  });

  it('should return the joined deal and write no ledger event when the join succeeds', async () => {
    joinTransactionByInviteCode.mockResolvedValue(makeOkResult({ id: 'tx-042' }));

    const joined = await icpService.joinTransactionByInviteCode(VALID_CODE);
    await Promise.resolve();

    expect(joined).toMatchObject({ id: 'tx-042' });
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('should uppercase the invite code before the canister call', async () => {
    joinTransactionByInviteCode.mockResolvedValue(makeOkResult());

    await icpService.joinTransactionByInviteCode(VALID_CODE.toLowerCase());

    expect(joinTransactionByInviteCode).toHaveBeenCalledWith(VALID_CODE);
  });

  it('should throw the canister error', async () => {
    joinTransactionByInviteCode.mockResolvedValue({ err: 'Invite code not found' });

    await expect(icpService.joinTransactionByInviteCode(VALID_CODE)).rejects.toThrow('Invite code not found');
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('should refuse a malformed code without calling the canister', async () => {
    await expect(icpService.joinTransactionByInviteCode('not-a-code')).rejects.toThrow(/Invalid invite code format/i);

    expect(joinTransactionByInviteCode).not.toHaveBeenCalled();
  });

  it('should leave the buyer_self_assigned event to the canister on a buyer self-join', async () => {
    joinTransactionByInviteCodeAsBuyer.mockResolvedValue(makeOkResult({ id: 'tx-043' }));

    const joined = await icpService.joinTransactionByInviteCodeAsBuyer(VALID_CODE);
    await Promise.resolve();

    expect(joined).toMatchObject({ id: 'tx-043' });
    expect(logEvent).not.toHaveBeenCalled();
  });
});
