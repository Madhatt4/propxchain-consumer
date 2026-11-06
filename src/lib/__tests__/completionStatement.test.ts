import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ledger, service } = vi.hoisted(() => {
  const ledgerMock = { getEventsByTransaction: vi.fn() };
  const serviceMock: { ledgerManager: typeof ledgerMock | null } = { ledgerManager: ledgerMock };
  return { ledger: ledgerMock, service: serviceMock };
});
vi.mock('@/services/icp.service', () => ({ icpService: service }));

import {
  completionStatementFromEvents,
  completionStatementText,
  readCompletionStatement,
  sellerConveyancerOf,
} from '../completionStatement';

const SELLER_CONV = 'seller-conv-principal';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
// 6 Nov 2026 12:00 UTC in canister nanoseconds.
const NOV_6_NS = BigInt(Date.UTC(2026, 10, 6, 12)) * 1_000_000n;

function docEvent(docType: string, hash: string, by: string, timestamp: bigint = NOV_6_NS): Record<string, unknown> {
  return {
    eventType: 'doc_registered',
    details: `Document ${docType} registered by ${by}`,
    metadata: [`docHash=${hash};docType=${docType}`],
    timestamp,
  };
}

describe('completionStatementFromEvents', () => {
  it('should return the statement registered by the seller\'s conveyancer', () => {
    const result = completionStatementFromEvents([docEvent('completion_statement', HASH_A, SELLER_CONV)], SELLER_CONV);
    expect(result).toEqual({ fileHash: HASH_A, uploadedAt: new Date(Date.UTC(2026, 10, 6, 12)), uploadedBy: SELLER_CONV });
  });

  it('should pick the latest statement when the firm uploaded a revised one', () => {
    const events = [
      docEvent('completion_statement', HASH_A, SELLER_CONV, NOV_6_NS),
      docEvent('completion_statement', HASH_B, SELLER_CONV, NOV_6_NS + 1_000_000_000n),
    ];
    expect(completionStatementFromEvents(events, SELLER_CONV)?.fileHash).toBe(HASH_B);
  });

  it('should ignore a statement registered by anyone other than the seller\'s conveyancer', () => {
    expect(completionStatementFromEvents([docEvent('completion_statement', HASH_A, 'buyer-principal')], SELLER_CONV)).toBeNull();
  });

  it('should ignore other document types and malformed hashes', () => {
    const events = [
      docEvent('tr1_transfer', HASH_A, SELLER_CONV),
      docEvent('completion_statement', 'not-a-hash', SELLER_CONV),
      { eventType: 'completion_side_confirmed', details: '', metadata: [], timestamp: NOV_6_NS },
    ];
    expect(completionStatementFromEvents(events, SELLER_CONV)).toBeNull();
  });

  it('should return null when no seller\'s conveyancer is on the deal', () => {
    expect(completionStatementFromEvents([docEvent('completion_statement', HASH_A, SELLER_CONV)], null)).toBeNull();
  });

  it('should return null for a reply that is not a list', () => {
    expect(completionStatementFromEvents(undefined, SELLER_CONV)).toBeNull();
  });
});

describe('sellerConveyancerOf', () => {
  it('should read the principal from a Candid opt record', () => {
    expect(sellerConveyancerOf([{ principal: { toText: () => SELLER_CONV } }])).toBe(SELLER_CONV);
  });

  it('should return null for an empty slot', () => {
    expect(sellerConveyancerOf([])).toBeNull();
    expect(sellerConveyancerOf(null)).toBeNull();
  });
});

describe('readCompletionStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.ledgerManager = ledger;
  });

  it('should read the deal\'s audit trail', async () => {
    ledger.getEventsByTransaction.mockResolvedValue([docEvent('completion_statement', HASH_A, SELLER_CONV)]);
    const result = await readCompletionStatement('tx-1', SELLER_CONV);
    expect(ledger.getEventsByTransaction).toHaveBeenCalledWith('tx-1');
    expect(result?.fileHash).toBe(HASH_A);
  });

  it('should throw when the audit trail cannot be asked, rather than report no statement', async () => {
    service.ledgerManager = null;
    await expect(readCompletionStatement('tx-1', SELLER_CONV)).rejects.toThrow('The audit trail is not available.');
  });

  it('should not ask the trail when there is no seller\'s conveyancer', async () => {
    expect(await readCompletionStatement('tx-1', null)).toBeNull();
    expect(ledger.getEventsByTransaction).not.toHaveBeenCalled();
  });
});

describe('completionStatementText', () => {
  it('should give the upload date in UK English', () => {
    const text = completionStatementText({ fileHash: HASH_A, uploadedAt: new Date(Date.UTC(2026, 10, 6, 12)), uploadedBy: SELLER_CONV });
    expect(text).toBe("Completion statement: uploaded by the seller's conveyancer on 6 November 2026. Its fingerprint is recorded on PropXchain.");
  });

  it('should say when nothing has been uploaded yet', () => {
    expect(completionStatementText(null)).toBe("Completion statement: not uploaded yet by the seller's conveyancer.");
  });
});
