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
  completionStatementLines,
  completionStatementsFromEvents,
  firstConfirmedAtMs,
  readCompletionStatements,
  readStatementHashForCompletion,
  sellerConveyancerOf,
  statementHashForCompletion,
  statementUploaderOf,
  statementView,
} from '../completionStatement';

const SELLER_CONV = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
const BUYER = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOV_6 = Date.UTC(2026, 10, 6, 12);
const HOUR = 3_600_000;
const ns = (ms: number): bigint => BigInt(ms) * 1_000_000n;

function docEvent(docType: string, hash: string, by: string, atMs: number = NOV_6): Record<string, unknown> {
  return {
    eventType: 'doc_registered',
    details: `Document ${docType} registered by ${by}`,
    metadata: [`docHash=${hash};docType=${docType}`],
    timestamp: ns(atMs),
  };
}

const context = (over: Partial<Parameters<typeof statementHashForCompletion>[1]> = {}): Parameters<typeof statementHashForCompletion>[1] => ({
  sellerConveyancer: SELLER_CONV,
  isSellerConveyancerActing: true,
  firstConfirmedAt: null,
  ...over,
});

describe('completionStatementsFromEvents', () => {
  it("should return the seller's conveyancer's statements, oldest first", () => {
    const events = [docEvent('completion_statement', HASH_B, SELLER_CONV, NOV_6 + HOUR), docEvent('completion_statement', HASH_A, SELLER_CONV)];
    expect(completionStatementsFromEvents(events, SELLER_CONV).map((s) => s.fileHash)).toEqual([HASH_A, HASH_B]);
    expect(completionStatementFromEvents(events, SELLER_CONV)?.fileHash).toBe(HASH_B);
  });

  it("should ignore statements from anyone else, other types and malformed hashes", () => {
    const events = [
      docEvent('completion_statement', HASH_A, BUYER),
      docEvent('tr1_transfer', HASH_A, SELLER_CONV),
      docEvent('completion_statement', 'not-a-hash', SELLER_CONV),
    ];
    expect(completionStatementsFromEvents(events, SELLER_CONV)).toEqual([]);
  });

  it("should return nothing when no seller's conveyancer is on the deal, or the reply is not a list", () => {
    expect(completionStatementsFromEvents([docEvent('completion_statement', HASH_A, SELLER_CONV)], null)).toEqual([]);
    expect(completionStatementsFromEvents(undefined, SELLER_CONV)).toEqual([]);
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
  ])('should read %s as unknown, so no statement is found', (_label, details) => {
    expect(statementUploaderOf(details)).toBeNull();
    const event = { ...docEvent('completion_statement', HASH_A, SELLER_CONV), details };
    expect(completionStatementsFromEvents([event], SELLER_CONV)).toEqual([]);
  });
});

describe('statementView', () => {
  const early = { fileHash: HASH_A, uploadedAt: new Date(NOV_6), uploadedBy: SELLER_CONV };
  const late = { fileHash: HASH_B, uploadedAt: new Date(NOV_6 + 2 * HOUR), uploadedBy: SELLER_CONV };

  it('should treat the latest statement as the one in force while nobody has confirmed', () => {
    expect(statementView([early, late], null)).toEqual({ recorded: late, late: null });
  });

  it('should record only the statement uploaded before the first confirmation', () => {
    expect(statementView([early, late], NOV_6 + HOUR)).toEqual({ recorded: early, late });
  });

  it('should record none when every statement came after the first confirmation', () => {
    expect(statementView([late], NOV_6 + HOUR)).toEqual({ recorded: null, late });
  });

  it('should take the earliest side confirmation', () => {
    expect(firstConfirmedAtMs([NOV_6 + HOUR, NOV_6, undefined])).toBe(NOV_6);
    expect(firstConfirmedAtMs([undefined, null])).toBeNull();
  });
});

describe('statementHashForCompletion', () => {
  const events = [docEvent('completion_statement', HASH_A, SELLER_CONV), docEvent('completion_statement', HASH_B, SELLER_CONV, NOV_6 + 2 * HOUR)];

  it('should give the latest statement hash while nobody has confirmed', () => {
    expect(statementHashForCompletion(events, context())).toBe(HASH_B);
  });

  it('should give the statement in force at the first confirmation, never a later one', () => {
    expect(statementHashForCompletion(events, context({ firstConfirmedAt: NOV_6 + HOUR }))).toBe(HASH_A);
  });

  it('should fall back to the deal facts when a later statement is the only one', () => {
    expect(statementHashForCompletion([events[1]], context({ firstConfirmedAt: NOV_6 + HOUR }))).toBeNull();
  });

  it("should ignore statements and fall back when no seller's conveyancer is on the deal", () => {
    expect(statementHashForCompletion(events, context({ sellerConveyancer: null, isSellerConveyancerActing: false }))).toBeNull();
  });

  it("should refuse when a seller's conveyancer is acting but cannot be resolved", () => {
    expect(() => statementHashForCompletion(events, context({ sellerConveyancer: null }))).toThrow(STATEMENT_UNATTRIBUTED);
  });

  it('should refuse when the trail reply is not a list', () => {
    expect(() => statementHashForCompletion(undefined, context())).toThrow(STATEMENT_UNREADABLE);
  });
});

describe('reading the trail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.ledgerManager = ledger;
  });

  it("should read the deal's audit trail", async () => {
    ledger.getEventsByTransaction.mockResolvedValue([docEvent('completion_statement', HASH_A, SELLER_CONV)]);
    expect((await readCompletionStatements('tx-1', SELLER_CONV)).map((s) => s.fileHash)).toEqual([HASH_A]);
    expect(ledger.getEventsByTransaction).toHaveBeenCalledWith('tx-1');
  });

  it('should throw when the audit trail cannot be asked, rather than report no statement', async () => {
    service.ledgerManager = null;
    await expect(readCompletionStatements('tx-1', SELLER_CONV)).rejects.toThrow(STATEMENT_UNREADABLE);
  });

  it('should refuse when the trail read fails at confirm time', async () => {
    ledger.getEventsByTransaction.mockRejectedValueOnce(new Error('network'));
    await expect(readStatementHashForCompletion('tx-1', context())).rejects.toThrow(STATEMENT_UNREADABLE);
  });

  it("should not ask the trail when no seller's conveyancer is on the deal", async () => {
    expect(await readStatementHashForCompletion('tx-1', context({ sellerConveyancer: null, isSellerConveyancerActing: false }))).toBeNull();
    expect(ledger.getEventsByTransaction).not.toHaveBeenCalled();
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

describe('completionStatementLines', () => {
  const statement = { fileHash: HASH_A, uploadedAt: new Date(NOV_6), uploadedBy: SELLER_CONV };

  it('should give the upload date in UK English', () => {
    expect(completionStatementLines({ recorded: statement, late: null }, false)).toEqual([
      "Completion statement: uploaded by the seller's conveyancer on 6 November 2026. Its fingerprint is recorded on PropXchain.",
    ]);
  });

  it('should say when nothing has been uploaded yet', () => {
    expect(completionStatementLines({ recorded: null, late: null }, false)).toEqual([
      "Completion statement: not uploaded yet by the seller's conveyancer.",
    ]);
  });

  it('should mark a statement uploaded after confirmation as not the recorded one', () => {
    expect(completionStatementLines({ recorded: null, late: statement }, true)).toEqual([
      'Completion statement: none was uploaded before completion was confirmed, so the deal details were recorded instead.',
      'A statement uploaded on 6 November 2026: uploaded after completion was confirmed — not the recorded statement.',
    ]);
  });
});
