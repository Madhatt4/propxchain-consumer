// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));
const mockProof = vi.fn();
vi.mock('../principalProof', () => ({ buildPrincipalProof: (...args: unknown[]) => mockProof(...args) }));
const mockJoin = vi.fn();
const mockJoinAsBuyer = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: {
    joinTransactionByInviteCode: (...args: unknown[]) => mockJoin(...args),
    joinTransactionByInviteCodeAsBuyer: (...args: unknown[]) => mockJoinAsBuyer(...args),
  },
}));

import { DelegationError, grantDelegation, loadDelegationStatus, requestDelegation, revokeDelegation, sendPaymentLink } from '../delegation.service';

const ID = 'd1000000-0000-0000-0000-000000000001';
const STATUS = { id: ID, transactionId: 'tx_1', role: 'seller', state: 'requested', agencyName: 'Smith & Co', propertyAddress: '14 Elm Road', inviteCode: 'TX-AAAA-BBBB', grantedAt: null, revokedAt: null, ledgerPending: false };

function failure(body: Record<string, unknown>) {
  return { data: null, error: { context: { json: () => Promise.resolve(body) } } };
}

describe('delegation.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockProof.mockReset().mockResolvedValue({ principal: 'p', publicKeyDer: 'k', signature: 's' });
    mockJoin.mockReset().mockResolvedValue({ ok: {} });
    mockJoinAsBuyer.mockReset().mockResolvedValue({ ok: {} });
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  it('loadDelegationStatus asks the platform and unwraps the delegation', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, delegation: STATUS }, error: null });
    expect(await loadDelegationStatus(ID)).toEqual(STATUS);
    expect(mockInvoke).toHaveBeenCalledWith('agent-delegation', { body: { action: 'status', delegationId: ID } });
  });

  it('grantDelegation signs a proof bound to the delegation and the user', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'active', ledgerPending: false }, error: null });
    expect(await grantDelegation(ID)).toMatchObject({ state: 'active', ledgerPending: false });
    expect(mockProof).toHaveBeenCalledWith(`agent-delegation:grant:${ID}:u1`);
    expect(mockInvoke).toHaveBeenCalledWith('agent-delegation', { body: { action: 'grant', delegationId: ID, principal: 'p', publicKeyDer: 'k', signature: 's' } });
  });

  it('grantDelegation joins by the invite code first when the client is not on the deal yet, then grants again', async () => {
    mockInvoke
      .mockResolvedValueOnce(failure({ error: 'not_yet_on_chain', inviteCode: 'TX-AAAA-BBBB' }))
      .mockResolvedValueOnce({ data: { ok: true, delegation: STATUS }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, state: 'active', ledgerPending: true }, error: null });
    expect(await grantDelegation(ID)).toMatchObject({ state: 'active', ledgerPending: true });
    expect(mockJoin).toHaveBeenCalledWith('TX-AAAA-BBBB');
    expect(mockJoinAsBuyer).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('grantDelegation uses the buyer join for a buyer delegation and surfaces the platform error code otherwise', async () => {
    mockInvoke
      .mockResolvedValueOnce(failure({ error: 'not_yet_on_chain', inviteCode: 'TX-CCCC-DDDD' }))
      .mockResolvedValueOnce({ data: { ok: true, delegation: { ...STATUS, role: 'buyer' } }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, state: 'active', ledgerPending: false }, error: null });
    await grantDelegation(ID);
    expect(mockJoinAsBuyer).toHaveBeenCalledWith('TX-CCCC-DDDD');
    mockInvoke.mockReset().mockResolvedValue(failure({ error: 'wrong_party' }));
    await expect(grantDelegation(ID)).rejects.toMatchObject({ name: 'DelegationError', code: 'wrong_party' });
  });

  it('an empty 2xx body is a platform fault, not a state', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(loadDelegationStatus(ID)).rejects.toMatchObject({ code: 'empty_response' });
  });

  it('signed out cannot grant; revoke and request go straight through', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(grantDelegation(ID)).rejects.toBeInstanceOf(DelegationError);
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'revoked', ledgerPending: false }, error: null });
    expect(await revokeDelegation(ID)).toMatchObject({ state: 'revoked', ledgerPending: false });
    mockInvoke.mockResolvedValue({ data: { ok: true, delegationId: ID, clientEmailMasked: 'm•••@x.test' }, error: null });
    expect(await requestDelegation({ transactionId: 'tx_1', listingId: 'l1', role: 'seller' })).toEqual({ ok: true, delegationId: ID, clientEmailMasked: 'm•••@x.test' });
  });
});

describe('sendPaymentLink', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('asks the platform to email the client the Stripe page for the session, and returns where it went', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, sentTo: 'm***@example.com', amountPence: 16668 }, error: null });
    const res = await sendPaymentLink({ transactionId: 'tx_1', role: 'seller', sessionId: 'cs_test_1', propertyAddress: '14 Elm Road' });
    expect(res).toMatchObject({ sentTo: 'm***@example.com', amountPence: 16668 });
    expect(mockInvoke).toHaveBeenCalledWith('agent-delegation', {
      body: { action: 'send_payment_link', transactionId: 'tx_1', role: 'seller', sessionId: 'cs_test_1', propertyAddress: '14 Elm Road' },
    });
  });

  it("surfaces the platform's refusal as a coded error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'session_not_open' }) } } });
    await expect(sendPaymentLink({ transactionId: 'tx_1', role: 'seller', sessionId: 'cs_test_1', propertyAddress: '14 Elm Road' }))
      .rejects.toMatchObject({ code: 'session_not_open' });
  });
});
