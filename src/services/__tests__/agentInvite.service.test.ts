// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke, getSession, buildPrincipalProof } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  buildPrincipalProof: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke }, auth: { getSession } } }));
vi.mock('../principalProof', () => ({ buildPrincipalProof }));

import { AgentInviteError, openInvite, sendAgentInvite, type AgentInvite } from '../agentInvite.service';

const NOW = new Date('2026-11-07T12:00:00Z');
const invite = (over: Partial<AgentInvite>): AgentInvite => ({
  id: 'i1', agentEmail: 'a@b.co', agencyName: null, status: 'pending', createdAt: '2026-11-07T10:00:00Z', expiresAt: '2026-11-21T10:00:00Z', ...over,
});

describe('openInvite', () => {
  it('should pick the pending invite that is still in date', () => {
    expect(openInvite([invite({ status: 'cancelled' }), invite({ id: 'i2' })], NOW)?.id).toBe('i2');
  });

  it('should ignore an expired, accepted or cancelled invite', () => {
    expect(openInvite([invite({ expiresAt: '2026-11-01T00:00:00Z' }), invite({ status: 'accepted' })], NOW)).toBeNull();
    expect(openInvite([], NOW)).toBeNull();
  });
});

describe('sendAgentInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { user: { id: 'seller-user' } } } });
    buildPrincipalProof.mockResolvedValue({ principal: 'p', publicKeyDer: 'k', signature: 's' });
  });

  it('should sign a proof bound to the deal and the seller, and send it with the invite', async () => {
    invoke.mockResolvedValue({ data: { inviteId: 'i1', expiresAt: 'x' }, error: null });
    await sendAgentInvite({ transactionId: 'tx_1', agentEmail: 'a@b.co', agencyName: '', propertyAddress: '12 High St' });
    expect(buildPrincipalProof).toHaveBeenCalledWith('agent-invite:create:tx_1:seller-user');
    expect(invoke).toHaveBeenCalledWith('agent-invite', {
      body: { action: 'create', transactionId: 'tx_1', agentEmail: 'a@b.co', agencyName: null, propertyAddress: '12 High St', principal: 'p', publicKeyDer: 'k', signature: 's' },
    });
  });

  it('should surface the function\'s own error code', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: () => Promise.resolve({ error: 'invite_pending' }) } } });
    await expect(sendAgentInvite({ transactionId: 'tx_1', agentEmail: 'a@b.co' })).rejects.toEqual(new AgentInviteError('invite_pending'));
  });

  it('should refuse without a session or an identity', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(sendAgentInvite({ transactionId: 'tx_1', agentEmail: 'a@b.co' })).rejects.toHaveProperty('code', 'unauthorized');
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } } });
    buildPrincipalProof.mockRejectedValue(new Error('no_identity'));
    await expect(sendAgentInvite({ transactionId: 'tx_1', agentEmail: 'a@b.co' })).rejects.toHaveProperty('code', 'no_identity');
  });
});
