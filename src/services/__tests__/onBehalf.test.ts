// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) }, from: (...args: unknown[]) => mockFrom(...args) },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
let currentUserId: string | null = 'u-agent';
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ supabaseUser: currentUserId ? { id: currentUserId } : null }) },
}));
const mockList = vi.fn();
vi.mock('../delegation.service', () => ({ listDelegations: (...args: unknown[]) => mockList(...args) }));

import { actingSidesFor, forgetActingFor, recordOnBehalf } from '../onBehalf';

function memberOf(orgIds: string[]): void {
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => Promise.resolve({ data: orgIds.map((o) => ({ organisation_id: o })), error: null }) }),
  });
}

const row = (over: Record<string, unknown>) => ({
  id: 'd1', transactionId: 'tx_1', role: 'seller', state: 'active', requestedAt: 'x', grantedAt: 'y', revokedAt: null,
  granteeOrgId: 'org-a', grantorUserId: 'u-client', ...over,
});

describe('onBehalf', () => {
  beforeEach(() => {
    forgetActingFor();
    mockInvoke.mockReset();
    mockFrom.mockReset();
    mockList.mockReset();
    currentUserId = 'u-agent';
  });

  it('records nothing for anyone whose agency holds no mandate on the deal, or who is not signed in', async () => {
    memberOf([]);
    mockList.mockResolvedValue([row({})]);
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    forgetActingFor();
    currentUserId = null;
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    expect(await recordOnBehalf('', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('an agency member records with the side they act for, from the data, and the lookup is cached across saves', async () => {
    memberOf(['org-a']);
    mockList.mockResolvedValue([row({})]);
    mockInvoke.mockResolvedValue({ data: { ok: true, role: 'seller' }, error: null });
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('agent-delegation', {
      body: { action: 'on_behalf', transactionId: 'tx_1', role: 'seller', kind: 'fill_pack_form', subject: 'ta6' },
    });
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'listing')).toBe(true);
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(await actingSidesFor('tx_1')).toEqual(['seller']);
  });

  it('the side is explicit: a seller-only mandate never records a buyer-side action, and both sides need both mandates', async () => {
    memberOf(['org-a']);
    mockList.mockResolvedValue([row({})]);
    expect(await recordOnBehalf('tx_1', 'buyer', 'fill_pack_form', 'ta6')).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
    forgetActingFor('tx_1');
    mockList.mockResolvedValue([row({}), row({ id: 'd2', role: 'buyer' })]);
    expect(await actingSidesFor('tx_1')).toEqual(['seller', 'buyer']);
  });

  it('someone else signing in on the same browser never inherits the mandate of whoever was signed in before', async () => {
    memberOf(['org-a']);
    mockList.mockResolvedValue([row({})]);
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(true);
    currentUserId = 'u-other';
    memberOf([]);
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('a revoked mandate counts for nothing after forgetting; a lookup failure, a platform refusal or a throw is false, never an exception', async () => {
    memberOf(['org-a']);
    mockList.mockResolvedValue([row({ state: 'revoked' })]);
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    forgetActingFor('tx_1');
    mockList.mockRejectedValue(new Error('rls'));
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'ta6')).toBe(false);
    forgetActingFor('tx_1');
    mockList.mockResolvedValue([row({})]);
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'no_mandate' } });
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'listing')).toBe(false);
    mockInvoke.mockRejectedValue(new Error('network'));
    expect(await recordOnBehalf('tx_1', 'seller', 'fill_pack_form', 'listing')).toBe(false);
  });
});
