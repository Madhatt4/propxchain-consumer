// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { addChaseEntry, listChaseLog, listOpenNextActions, markChaseDone } from '../chaseLog.service';

const ROW = { id: 'n1', org_id: 'org', transaction_id: 'tx_1', listing_id: 'l1', author_user_id: 'u1', kind: 'call', body: 'Rang the seller', due_at: null, done_at: null, created_at: '2026-09-06T10:00:00Z', ledger_hash: null, ledger_pending: true };

/** A chain that records its calls and resolves to the given result at the end. */
function chain(result: { data: unknown; error: unknown }, calls: string[]) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'insert', 'update']) {
    q[m] = (...args: unknown[]) => { calls.push(`${m}:${JSON.stringify(args)}`); return q; };
  }
  q.single = () => Promise.resolve(result);
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return q;
}

describe('chaseLog.service', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInvoke.mockReset();
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  it('listChaseLog reads the deal newest first and maps rows', async () => {
    const calls: string[] = [];
    mockFrom.mockReturnValue(chain({ data: [ROW], error: null }, calls));
    const entries = await listChaseLog('tx_1');
    expect(entries[0]).toMatchObject({ id: 'n1', orgId: 'org', kind: 'call', body: 'Rang the seller', ledgerPending: true });
    expect(calls).toContain('eq:["transaction_id","tx_1"]');
    expect(calls).toContain('order:["created_at",{"ascending":false}]');
  });

  it('listOpenNextActions reads the agency\'s open next actions soonest first', async () => {
    const calls: string[] = [];
    mockFrom.mockReturnValue(chain({ data: [], error: null }, calls));
    await listOpenNextActions('org');
    expect(calls).toContain('eq:["org_id","org"]');
    expect(calls).toContain('eq:["kind","next_action"]');
    expect(calls).toContain('is:["done_at",null]');
  });

  it('addChaseEntry writes as the signed-in member, then anchors through the platform', async () => {
    const calls: string[] = [];
    mockFrom.mockReturnValue(chain({ data: ROW, error: null }, calls));
    mockInvoke.mockResolvedValue({ data: { ok: true, ledgerPending: false, ledgerHash: 'b'.repeat(64) }, error: null });
    const entry = await addChaseEntry({ orgId: 'org', transactionId: 'tx_1', listingId: 'l1', kind: 'call', body: '  Rang the seller ' });
    expect(calls[0]).toBe('insert:[{"org_id":"org","transaction_id":"tx_1","listing_id":"l1","author_user_id":"u1","kind":"call","body":"Rang the seller","due_at":null}]');
    expect(mockInvoke).toHaveBeenCalledWith('agent-delegation', { body: { action: 'anchor_note', noteId: 'n1' } });
    expect(entry.ledgerPending).toBe(false);
    expect(entry.ledgerHash).toBe('b'.repeat(64));
  });

  it('a failed anchor leaves the entry pending, never throws; signed out cannot write', async () => {
    const calls: string[] = [];
    mockFrom.mockReturnValue(chain({ data: ROW, error: null }, calls));
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const entry = await addChaseEntry({ orgId: 'org', transactionId: 'tx_1', listingId: null, kind: 'note', body: 'x' });
    expect(entry.ledgerPending).toBe(true);
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(addChaseEntry({ orgId: 'org', transactionId: 'tx_1', listingId: null, kind: 'note', body: 'x' })).rejects.toThrow('Sign in');
  });

  it('markChaseDone stamps done_at', async () => {
    const calls: string[] = [];
    mockFrom.mockReturnValue(chain({ data: null, error: null }, calls));
    await markChaseDone('n1');
    expect(calls[0].startsWith('update:[{"done_at":"')).toBe(true);
    expect(calls).toContain('eq:["id","n1"]');
  });
});
