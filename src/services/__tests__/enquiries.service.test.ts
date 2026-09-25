// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for enquiries.service.ts — mocks the Supabase client, same pattern as
 * conveyancerBrief.service.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  EnquiryError,
  answerEnquiry,
  checkEnquiry,
  fileToBase64,
  listEnquiries,
  myPartyOn,
  raiseEnquiry,
  transcribeEnquiries,
} from '../enquiries.service';

const ENQUIRY = {
  id: 'e1000000-0000-0000-0000-000000000001', transaction_id: 'tx_1', parent_id: null, category: 'ta6_alterations',
  raised_by_user_id: 'u4', raised_by_side: 'buyer', question: 'Was consent obtained?', question_hash: 'a'.repeat(64),
  status: 'raised', transcribed: false, source_document_id: null, ledger_pending: false,
  created_at: '2026-09-05T10:00:00Z', raised_at: '2026-09-05T10:00:00Z', answered_at: null, closed_at: null, updated_at: '2026-09-05T10:00:00Z',
};

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'in']) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return q;
}

describe('enquiries.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset(); mockFrom.mockReset(); mockRpc.mockReset();
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  it('raiseEnquiry posts the raise action and returns the row', async () => {
    mockInvoke.mockResolvedValue({ data: { enquiry: ENQUIRY }, error: null });
    const row = await raiseEnquiry({ transactionId: 'tx_1', category: 'ta6_alterations', question: 'Was consent obtained?' });
    expect(mockInvoke).toHaveBeenCalledWith('enquiries', { body: { action: 'raise', transactionId: 'tx_1', category: 'ta6_alterations', question: 'Was consent obtained?' } });
    expect(row.id).toBe(ENQUIRY.id);
  });

  it('non-2xx becomes EnquiryError with the status and the body code', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: { status: 403, json: () => Promise.resolve({ error: 'forbidden', reason: 'only a conveyancer' }) } },
    });
    await expect(answerEnquiry({ enquiryId: ENQUIRY.id, answer: 'Yes', evidence: [] })).rejects.toMatchObject({ status: 403, code: 'forbidden', reason: 'only a conveyancer' });
    const err = await answerEnquiry({ enquiryId: ENQUIRY.id, answer: 'Yes', evidence: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(EnquiryError);
  });

  it('checkEnquiry calls enquiry-check with the draft or the id', async () => {
    mockInvoke.mockResolvedValue({ data: { check: { result: { covered: [], conflicts: [], missing: [] } }, reused: false, dropped: 0 }, error: null });
    await checkEnquiry({ transactionId: 'tx_1', category: 'title', question: 'Title number?' });
    expect(mockInvoke).toHaveBeenLastCalledWith('enquiry-check', { body: { transactionId: 'tx_1', category: 'title', question: 'Title number?' } });
    await checkEnquiry({ enquiryId: ENQUIRY.id });
    expect(mockInvoke).toHaveBeenLastCalledWith('enquiry-check', { body: { enquiryId: ENQUIRY.id } });
  });

  it('transcribeEnquiries sends the base64 PDF and returns drafts', async () => {
    mockInvoke.mockResolvedValue({ data: { drafts: [{ category: 'title', question: 'Q1' }], dropped: 1, sourceDocumentId: null }, error: null });
    const r = await transcribeEnquiries({ transactionId: 'tx_1', pdfBase64: 'JVBERi0=', filename: 'enq.pdf' });
    expect(r.drafts).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith('enquiries', { body: { action: 'transcribe', transactionId: 'tx_1', pdfBase64: 'JVBERi0=', filename: 'enq.pdf' } });
  });

  it('listEnquiries reads the table under RLS ordered by creation', async () => {
    mockFrom.mockReturnValue(chain({ data: [ENQUIRY], error: null }));
    const rows = await listEnquiries('tx_1');
    expect(mockFrom).toHaveBeenCalledWith('enquiries');
    expect(rows[0].id).toBe(ENQUIRY.id);
  });

  it('myPartyOn asks the server who I am on the deal', async () => {
    mockRpc.mockResolvedValue({ data: [{ role: 'conveyancer', side: 'buyer' }], error: null });
    expect(await myPartyOn('tx_1')).toEqual({ role: 'conveyancer', side: 'buyer' });
    expect(mockRpc).toHaveBeenCalledWith('enquiry_party', { p_transaction_id: 'tx_1' });
  });

  it('myPartyOn returns null when the server says nobody', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await myPartyOn('tx_1')).toBeNull();
  });

  it('myPartyOn returns null without a session and never asks the server', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    expect(await myPartyOn('tx_1')).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('myPartyOn surfaces a lookup failure as an error, not as not-a-party', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(myPartyOn('tx_1')).rejects.toThrow('Failed to resolve your role on this transaction: boom');
  });

  it('fileToBase64 strips the data-URL prefix', async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', { type: 'application/pdf' });
    expect(await fileToBase64(file)).toBe('JVBERg==');
  });
});

describe('plain English (agent CRM spec I1)', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockFrom.mockReset();
  });

  it('reads the cached line for an enquiry, null when there is none', async () => {
    const { getEnquiryExplanation } = await import('../enquiries.service');
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enquiry_id: 'e1', plain_english: 'Plain.', model: 'm', created_at: 'x' }, error: null }) }) }) });
    expect((await getEnquiryExplanation('e1'))?.plain_english).toBe('Plain.');
    expect(mockFrom).toHaveBeenCalledWith('enquiry_explanations');
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) });
    expect(await getEnquiryExplanation('e1')).toBeNull();
  });

  it('asks the platform to write the line once when the cache has none', async () => {
    const { explainEnquiry } = await import('../enquiries.service');
    mockInvoke.mockResolvedValue({ data: { explanation: { plain_english: 'Fresh.', model: 'm' }, generated: true }, error: null });
    expect(await explainEnquiry('e1')).toEqual({ plain_english: 'Fresh.', model: 'm' });
    expect(mockInvoke).toHaveBeenCalledWith('enquiries', { body: { action: 'explain', enquiryId: 'e1' } });
  });
});

describe('confirmEnquiryNote (agent CRM 7b)', () => {
  it("asks the platform to make the agent's draft the client's own", async () => {
    mockInvoke.mockReset();
    const { confirmEnquiryNote } = await import('../enquiries.service');
    const note = { id: 'n2', enquiry_id: 'e1', side: 'seller', body: 'x', evidence: [], created_at: 'x', pending_confirmation: false, drafted_for_user_id: 'u1', confirmed_at: 'y' };
    mockInvoke.mockResolvedValue({ data: { note }, error: null });
    expect(await confirmEnquiryNote('n2')).toEqual(note);
    expect(mockInvoke).toHaveBeenCalledWith('enquiries', { body: { action: 'note_confirm', noteId: 'n2' } });
  });
});
