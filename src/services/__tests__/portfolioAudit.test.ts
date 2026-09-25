import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditEvent } from '../transactionAudit';
import {
  aggregatePortfolioAudit,
  fetchPortfolioAudit,
  ANOMALY_EVENT_TYPES,
} from '../portfolioAudit';
import { icpService } from '../icp.service';

// ============================================
// MOCKS
// ============================================

const mockGetEventsByTransaction = vi.fn();
const mockGetAllTransactions = vi.fn();
const mockInitialize = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    ledgerManager: {
      getEventsByTransaction: (...args: unknown[]) => mockGetEventsByTransaction(...args),
    },
    getAllTransactions: (...args: unknown[]) => mockGetAllTransactions(...args),
    initialize: (...args: unknown[]) => mockInitialize(...args),
  },
}));

// transactionAudit.ts (imported for the AuditEvent type + sanitizeText) pulls
// in the supabase client at module load, which throws without env vars. Stub it.
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

// ============================================
// HELPERS
// ============================================

const NS_PER_MS = 1_000_000;

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    eventId: 1,
    transactionId: 'tx-1',
    eventType: 'transaction_created',
    timestamp: 1_000 * NS_PER_MS,
    caller: 'aaaaa-aa',
    details: 'created',
    metadata: null,
    ...overrides,
  };
}

describe('aggregatePortfolioAudit', () => {
  it('should total events, transactions and distinct event types', () => {
    // Arrange
    const events = [
      event({ eventId: 1, transactionId: 'tx-1', eventType: 'transaction_created' }),
      event({ eventId: 2, transactionId: 'tx-1', eventType: 'buyer_joined' }),
      event({ eventId: 3, transactionId: 'tx-2', eventType: 'transaction_created' }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.totalEvents).toBe(3);
    expect(result.totalTransactions).toBe(2);
    expect(result.distinctEventTypes).toBe(2); // transaction_created, buyer_joined
  });

  it('should surface anomaly events separately from progress events', () => {
    // Arrange
    const events = [
      event({ eventId: 1, eventType: 'transaction_created' }),
      event({ eventId: 2, eventType: 'joined_buyer_already_taken' }),
      event({ eventId: 3, eventType: 'lr_submission_failed' }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.totalAnomalies).toBe(2);
    expect(result.anomalies.map(a => a.eventType)).toEqual(
      expect.arrayContaining(['joined_buyer_already_taken', 'lr_submission_failed'])
    );
    [...ANOMALY_EVENT_TYPES].forEach(type => {
      expect(typeof type).toBe('string');
    });
  });

  it('should compute the earliest and latest timestamps in ms', () => {
    // Arrange
    const events = [
      event({ eventId: 1, timestamp: 5_000 * NS_PER_MS }),
      event({ eventId: 2, timestamp: 1_000 * NS_PER_MS }),
      event({ eventId: 3, timestamp: 9_000 * NS_PER_MS }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.earliestTimestamp).toBe(1_000);
    expect(result.latestTimestamp).toBe(9_000);
  });

  it('should group events per transaction, chronologically, with anomaly counts', () => {
    // Arrange
    const events = [
      event({ eventId: 2, transactionId: 'tx-1', timestamp: 2_000 * NS_PER_MS }),
      event({ eventId: 1, transactionId: 'tx-1', timestamp: 1_000 * NS_PER_MS }),
      event({
        eventId: 3,
        transactionId: 'tx-1',
        eventType: 'joined_buyer_already_taken',
        timestamp: 3_000 * NS_PER_MS,
      }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    const group = result.transactions.find(t => t.transactionId === 'tx-1');
    expect(group).toBeDefined();
    expect(group?.eventCount).toBe(3);
    expect(group?.anomalyCount).toBe(1);
    expect(group?.events.map(e => e.eventId)).toEqual([1, 2, 3]); // chronological
    expect(group?.firstTimestamp).toBe(1_000);
    expect(group?.lastTimestamp).toBe(3_000);
  });

  it('should sort transaction groups by most-recent activity first', () => {
    // Arrange
    const events = [
      event({ eventId: 1, transactionId: 'tx-old', timestamp: 1_000 * NS_PER_MS }),
      event({ eventId: 2, transactionId: 'tx-new', timestamp: 9_000 * NS_PER_MS }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.transactions[0].transactionId).toBe('tx-new');
  });

  it('should sort the event-type breakdown by frequency descending', () => {
    // Arrange
    const events = [
      event({ eventId: 1, eventType: 'document_uploaded' }),
      event({ eventId: 2, eventType: 'document_uploaded' }),
      event({ eventId: 3, eventType: 'transaction_created' }),
    ];

    // Act
    const result = aggregatePortfolioAudit(events, '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.eventTypeBreakdown[0]).toEqual({
      eventType: 'document_uploaded',
      count: 2,
    });
  });

  it('should return null timestamps and empty groups for an empty event set', () => {
    // Act
    const result = aggregatePortfolioAudit([], '2026-06-13T00:00:00.000Z');

    // Assert
    expect(result.totalEvents).toBe(0);
    expect(result.totalTransactions).toBe(0);
    expect(result.earliestTimestamp).toBeNull();
    expect(result.latestTimestamp).toBeNull();
    expect(result.transactions).toEqual([]);
  });
});

describe('fetchPortfolioAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize the raw Candid shape (bigint, Principal, optional metadata)', async () => {
    // Arrange — mimic transaction list + the @dfinity Candid decode shape
    mockGetAllTransactions.mockResolvedValue([{ id: 'tx-1' }]);
    mockGetEventsByTransaction.mockResolvedValue([
      {
        eventId: 7n,
        transactionId: 'tx-1',
        eventType: 'document_uploaded',
        timestamp: BigInt(2_000 * NS_PER_MS),
        caller: { toString: () => 'aaaaa-aa' },
        details: 'uploaded TA6',
        metadata: ['{"docType":"TA6"}'],
      },
    ]);

    // Act
    const result = await fetchPortfolioAudit();

    // Assert
    expect(result.totalEvents).toBe(1);
    const ev = result.transactions[0].events[0];
    expect(ev.eventId).toBe(7);
    expect(ev.timestamp).toBe(2_000 * NS_PER_MS);
    expect(ev.caller).toBe('aaaaa-aa');
    expect(ev.metadata).toBe('{&quot;docType&quot;:&quot;TA6&quot;}'); // sanitized
  });

  it('should query events for each transaction id (stringified) and merge them', async () => {
    // Arrange — numeric ids (mapped shape) must be stringified for the Text query
    mockGetAllTransactions.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetEventsByTransaction.mockImplementation((id: string) =>
      Promise.resolve([
        {
          eventId: Number(id),
          transactionId: id,
          eventType: 'transaction_created',
          timestamp: BigInt(1_000 * NS_PER_MS),
          caller: { toString: () => 'aaaaa-aa' },
          details: 'created',
          metadata: [],
        },
      ]),
    );

    // Act
    const result = await fetchPortfolioAudit();

    // Assert
    expect(mockGetEventsByTransaction).toHaveBeenCalledWith('1');
    expect(mockGetEventsByTransaction).toHaveBeenCalledWith('2');
    expect(result.totalEvents).toBe(2);
    expect(result.totalTransactions).toBe(2);
  });

  it('should skip a transaction whose event query rejects without blanking the report', async () => {
    // Arrange
    mockGetAllTransactions.mockResolvedValue([{ id: 'ok' }, { id: 'bad' }]);
    mockGetEventsByTransaction.mockImplementation((id: string) =>
      id === 'bad'
        ? Promise.reject(new Error('replica trap'))
        : Promise.resolve([
            {
              eventId: 1n,
              transactionId: 'ok',
              eventType: 'transaction_created',
              timestamp: 1_000n * BigInt(NS_PER_MS),
              caller: { toString: () => 'aaaaa-aa' },
              details: 'created',
              metadata: [],
            },
          ]),
    );

    // Act
    const result = await fetchPortfolioAudit();

    // Assert — the good transaction still lands; the bad one is silently dropped
    expect(result.totalEvents).toBe(1);
    expect(result.transactions[0].transactionId).toBe('ok');
  });

  it('should throw when getEventsByTransaction is missing from the binding', async () => {
    // Arrange
    const ledger = icpService.ledgerManager as unknown as Record<string, unknown>;
    const original = ledger.getEventsByTransaction;
    delete ledger.getEventsByTransaction;

    // Act / Assert
    await expect(fetchPortfolioAudit()).rejects.toThrow(/not available/);

    // Cleanup
    ledger.getEventsByTransaction = original;
  });
});
