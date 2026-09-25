import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRecordQuoteRequested = vi.fn();
const mockRecordQuoteReceived = vi.fn();
const mockRecordConveyancerSelected = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    get transactionManager() {
      return {
        recordQuoteRequested: (...args: unknown[]) => mockRecordQuoteRequested(...args),
        recordQuoteReceived: (...args: unknown[]) => mockRecordQuoteReceived(...args),
        recordConveyancerSelected: (...args: unknown[]) => mockRecordConveyancerSelected(...args),
      };
    },
  },
}));

const mockSupabaseFrom = vi.fn();
const mockSupabaseInvoke = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockSupabaseInvoke(...args) },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { conveyancerQuoteService, __testing__ } from '../conveyancerQuote.service';
import type { ConveyancerQuote } from '../../components/providers/types';

// Helper: build a row that mirrors what Supabase returns
function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'q-1',
    transaction_id: 'tx-1',
    conveyancer_id: 'conv-1',
    conveyancer_panel: { practice_name: 'Test Firm LLP' },
    status: 'quoted',
    property_address: '1 High St, Bedford',
    title_number: 'BD12345',
    tenure: 'freehold',
    transaction_type: 'purchase',
    legal_fee: 50000,
    disbursements_estimate: 15000,
    vat: 10000,
    estimated_weeks: 8,
    conditions: 'Standard',
    quoted_at: '2026-05-20T10:00:00Z',
    accepted_at: null,
    created_at: '2026-05-19T09:00:00Z',
    ...overrides,
  };
}

function makeQuote(overrides: Partial<ConveyancerQuote> = {}): ConveyancerQuote {
  return {
    id: 'q-1',
    transactionId: 'tx-1',
    conveyancerId: 'conv-1',
    conveyancerName: 'Test Firm LLP',
    status: 'quoted',
    propertyAddress: '1 High St, Bedford',
    titleNumber: 'BD12345',
    tenure: 'freehold',
    transactionType: 'purchase',
    legalFee: 50000,
    disbursementsEstimate: 15000,
    vat: 10000,
    estimatedWeeks: 8,
    conditions: 'Standard',
    quotedAt: '2026-05-20T10:00:00Z',
    createdAt: '2026-05-19T09:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockRecordQuoteRequested.mockReset().mockResolvedValue({ ok: null });
  mockRecordQuoteReceived.mockReset().mockResolvedValue({ ok: null });
  mockRecordConveyancerSelected.mockReset().mockResolvedValue({ ok: null });
  mockSupabaseFrom.mockReset();
  mockSupabaseInvoke.mockReset();
  __testing__.auditedQuoteIds.clear();
});

describe('pure helpers', () => {
  it('totalAmountPence sums legal + disbursements + vat', () => {
    expect(__testing__.totalAmountPence(makeQuote())).toBe(75000n);
  });

  it('totalAmountPence treats undefined components as zero', () => {
    expect(
      __testing__.totalAmountPence(
        makeQuote({ legalFee: undefined, disbursementsEstimate: undefined, vat: undefined }),
      ),
    ).toBe(0n);
  });

  it('canonicalQuoteJson is deterministic and key-ordered', () => {
    const a = __testing__.canonicalQuoteJson(makeQuote());
    const b = __testing__.canonicalQuoteJson(makeQuote());
    expect(a).toBe(b);
    // First key must be conveyancerId (proves fixed order)
    expect(a.startsWith('{"conveyancerId":')).toBe(true);
  });

  it('canonicalQuoteJson serialises missing fields as null, not omitted', () => {
    const json = __testing__.canonicalQuoteJson(makeQuote({ conditions: undefined, estimatedWeeks: undefined }));
    expect(json).toContain('"conditions":null');
    expect(json).toContain('"estimatedWeeks":null');
  });

  it('sha256Hex produces a 64-char hex string', async () => {
    const hash = await __testing__.sha256Hex('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('sha256Hex is deterministic for identical input', async () => {
    const [a, b] = await Promise.all([__testing__.sha256Hex('x'), __testing__.sha256Hex('x')]);
    expect(a).toBe(b);
  });

  it('mapQuoteRow handles a fully-populated row', () => {
    const mapped = __testing__.mapQuoteRow(makeRow() as never);
    expect(mapped).toMatchObject({
      id: 'q-1',
      transactionId: 'tx-1',
      conveyancerId: 'conv-1',
      conveyancerName: 'Test Firm LLP',
      status: 'quoted',
      legalFee: 50000,
    });
  });

  it('mapQuoteRow falls back to "Unknown" when practice_name is missing', () => {
    const mapped = __testing__.mapQuoteRow(makeRow({ conveyancer_panel: null }) as never);
    expect(mapped.conveyancerName).toBe('Unknown');
  });
});

describe('auditQuoteRequested', () => {
  it('calls actor.recordQuoteRequested with txId + conveyancerId', async () => {
    await __testing__.auditQuoteRequested('tx-1', 'conv-1');
    expect(mockRecordQuoteRequested).toHaveBeenCalledWith('tx-1', 'conv-1');
  });

  it('does not throw when actor returns err', async () => {
    mockRecordQuoteRequested.mockResolvedValueOnce({ err: 'Access denied' });
    await expect(__testing__.auditQuoteRequested('tx-1', 'conv-1')).resolves.toBeUndefined();
  });

  it('does not throw when actor rejects', async () => {
    mockRecordQuoteRequested.mockRejectedValueOnce(new Error('network'));
    await expect(__testing__.auditQuoteRequested('tx-1', 'conv-1')).resolves.toBeUndefined();
  });
});

describe('auditQuoteReceived', () => {
  it('passes txId, conveyancerId, hash, and total pence amount', async () => {
    await __testing__.auditQuoteReceived(makeQuote());
    expect(mockRecordQuoteReceived).toHaveBeenCalledTimes(1);
    const [txId, conveyancerId, hash, amount] = mockRecordQuoteReceived.mock.calls[0];
    expect(txId).toBe('tx-1');
    expect(conveyancerId).toBe('conv-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(amount).toBe(75000n);
  });

  it('dedupes — second call for the same quoteId is a no-op', async () => {
    await __testing__.auditQuoteReceived(makeQuote());
    await __testing__.auditQuoteReceived(makeQuote());
    expect(mockRecordQuoteReceived).toHaveBeenCalledTimes(1);
  });

  it('skips when total amount is zero', async () => {
    await __testing__.auditQuoteReceived(makeQuote({ legalFee: 0, disbursementsEstimate: 0, vat: 0 }));
    expect(mockRecordQuoteReceived).not.toHaveBeenCalled();
  });

  it('does not mark as audited when actor returns err', async () => {
    mockRecordQuoteReceived.mockResolvedValueOnce({ err: 'Transaction not found' });
    await __testing__.auditQuoteReceived(makeQuote());
    expect(__testing__.auditedQuoteIds.has('q-1')).toBe(false);
  });
});

describe('auditConveyancerSelected', () => {
  it('passes txId, conveyancerId, accepted hash, and final pence amount', async () => {
    await __testing__.auditConveyancerSelected(makeQuote());
    expect(mockRecordConveyancerSelected).toHaveBeenCalledTimes(1);
    const [txId, conveyancerId, hash, amount] = mockRecordConveyancerSelected.mock.calls[0];
    expect(txId).toBe('tx-1');
    expect(conveyancerId).toBe('conv-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(amount).toBe(75000n);
  });

  it('does not throw on err', async () => {
    mockRecordConveyancerSelected.mockResolvedValueOnce({ err: 'Access denied' });
    await expect(__testing__.auditConveyancerSelected(makeQuote())).resolves.toBeUndefined();
  });
});

describe('requestQuotes integration', () => {
  it('fires audit for every conveyancerId in payload after the edge function succeeds', async () => {
    mockSupabaseInvoke.mockResolvedValueOnce({ data: { jobId: 'job-1' }, error: null });

    const result = await conveyancerQuoteService.requestQuotes({
      transactionId: 'tx-1',
      conveyancerIds: ['conv-1', 'conv-2', 'conv-3'],
      transactionType: 'purchase',
      partyName: 'Marc',
      partyEmail: 'marc@example.com',
      propertyAddress: '1 High St',
    });
    await vi.waitFor(() => expect(mockRecordQuoteRequested).toHaveBeenCalledTimes(3));

    expect(result.success).toBe(true);
    expect(mockRecordQuoteRequested).toHaveBeenCalledWith('tx-1', 'conv-1');
    expect(mockRecordQuoteRequested).toHaveBeenCalledWith('tx-1', 'conv-2');
    expect(mockRecordQuoteRequested).toHaveBeenCalledWith('tx-1', 'conv-3');
  });

  it('does not fire audit if the edge function errors', async () => {
    mockSupabaseInvoke.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });

    const result = await conveyancerQuoteService.requestQuotes({
      transactionId: 'tx-1',
      conveyancerIds: ['conv-1'],
      transactionType: 'purchase',
      partyName: 'Marc',
      partyEmail: 'marc@example.com',
      propertyAddress: '1 High St',
    });

    expect(result.success).toBe(false);
    expect(mockRecordQuoteRequested).not.toHaveBeenCalled();
  });
});

describe('getQuotesForTransaction integration', () => {
  it('fires audit only for quoted-status quotes', async () => {
    const rows = [
      makeRow({ id: 'q-1', status: 'quoted' }),
      makeRow({ id: 'q-2', status: 'requested' }),
      makeRow({ id: 'q-3', status: 'quoted' }),
    ];
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    });

    await conveyancerQuoteService.getQuotesForTransaction('tx-1');
    await vi.waitFor(() => expect(mockRecordQuoteReceived).toHaveBeenCalledTimes(2));
  });
});

describe('acceptQuote integration', () => {
  it('accepts via the edge function and fires the on-chain audit', async () => {
    mockSupabaseInvoke.mockResolvedValue({ data: { success: true, emailSent: true }, error: null });
    const selectChain = {
      eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeRow({ status: 'accepted' }), error: null }) }),
    };
    const selectFn = vi.fn().mockReturnValue(selectChain);
    mockSupabaseFrom.mockReturnValue({ select: selectFn });

    const result = await conveyancerQuoteService.acceptQuote('q-1');
    await vi.waitFor(() => expect(mockRecordConveyancerSelected).toHaveBeenCalledTimes(1));

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(mockSupabaseInvoke).toHaveBeenCalledWith('accept-conveyancer-quote', { body: { quoteId: 'q-1' } });
    const [txId, conveyancerId, hash, amount] = mockRecordConveyancerSelected.mock.calls[0];
    expect(txId).toBe('tx-1');
    expect(conveyancerId).toBe('conv-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(amount).toBe(75000n);
  });

  it('returns error and skips audit if the accept function fails', async () => {
    mockSupabaseInvoke.mockResolvedValue({ data: null, error: new Error('edge down') });

    const result = await conveyancerQuoteService.acceptQuote('q-1');
    await Promise.resolve();

    expect(result.success).toBe(false);
    expect(mockRecordConveyancerSelected).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});
