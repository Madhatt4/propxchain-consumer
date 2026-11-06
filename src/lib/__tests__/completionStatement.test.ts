import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ledger, service } = vi.hoisted(() => {
  const ledgerMock = { getEventsByTransaction: vi.fn() };
  const serviceMock: { ledgerManager: typeof ledgerMock | null } = { ledgerManager: ledgerMock };
  return { ledger: ledgerMock, service: serviceMock };
});
vi.mock('@/services/icp.service', () => ({ icpService: service }));

import {
  STATEMENT_UNATTRIBUTED,
  STATEMENT_UNREADABLE,
  completionStatementFromEvents,
  completionStatementText,
  readCompletionStatement,
  readStatementHashForCompletion,
  sellerConveyancerOf,
  statementHashForCompletion,
  statementUploaderOf,
} from '../completionStatement';

const SELLER_CONV = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
const BUYER = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
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
    expect(completionStatementFromEvents([docEvent('completion_statement', HASH_A, BUYER)], SELLER_CONV)).toBeNull();
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

describe('statementUploaderOf', () => {
  // Pinned to transaction_manager/audit_text.mo, docRegistered:
  //   "Document " # safe(docType) # " registered by " # uploadedBy,
  it('should read the principal from the exact canister sentence', () => {
    expect(statementUploaderOf(`Document completion_statement registered by ${SELLER_CONV}`)).toBe(SELLER_CONV);
  });

  it.each([
    ['other wording', `Completion statement uploaded by ${SELLER_CONV}`],
    ['trailing text', `Document completion_statement registered by ${SELLER_CONV} (bot)`],
    ['another document type', `Document tr1_transfer registered by ${SELLER_CONV}`],
    ['a word, not a principal', 'Document completion_statement registered by someone'],
    ['nothing', undefined],
  ])('should read %s as unknown', (_label, details) => {
    expect(statementUploaderOf(details)).toBeNull();
  });

  it('should find no statement when the sentence does not match (fail closed)', () => {
    const event = { ...docEvent('completion_statement', HASH_A, SELLER_CONV), details: `Uploaded by ${SELLER_CONV}` };
    expect(completionStatementFromEvents([event], SELLER_CONV)).toBeNull();
  });
});

describe('statementHashForCompletion', () => {
  it("should give the seller's conveyancer's statement hash", () => {
    expect(statementHashForCompletion([docEvent('completion_statement', HASH_A, SELLER_CONV)], SELLER_CONV)).toBe(HASH_A);
  });

  it('should give null for the deal-facts fallback when there is no statement', () => {
    expect(statementHashForCompletion([], SELLER_CONV)).toBeNull();
    expect(statementHashForCompletion([], null)).toBeNull();
  });

  it("should refuse when a statement exists but the seller's conveyancer is unknown", () => {
    expect(() => statementHashForCompletion([docEvent('completion_statement', HASH_A, SELLER_CONV)], null)).toThrow(STATEMENT_UNATTRIBUTED);
  });

  it('should refuse when the trail reply is not a list', () => {
    expect(() => statementHashForCompletion(undefined, SELLER_CONV)).toThrow(STATEMENT_UNREADABLE);
  });

  it('should refuse when the trail read fails', async () => {
    ledger.getEventsByTransaction.mockRejectedValueOnce(new Error('network'));
    await expect(readStatementHashForCompletion('tx-1', SELLER_CONV)).rejects.toThrow(STATEMENT_UNREADABLE);
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
    await expect(readCompletionStatement('tx-1', SELLER_CONV)).rejects.toThrow(STATEMENT_UNREADABLE);
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
