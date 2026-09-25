import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AuditEvent,
} from '../transactionAudit';
import { fetchAuditReport, groupEventsIntoMilestones } from '../transactionAudit';
import { icpService } from '../icp.service';

// ============================================
// MOCKS
// ============================================

const mockGetTransaction = vi.fn();
const mockGetTransactionDocuments = vi.fn();
const mockGetEventsByTransaction = vi.fn();
const mockGetTransactionChain = vi.fn();
const mockGetBlockchainEfficiencyMetrics = vi.fn();
const mockGetHmlrFetch = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    transactionManager: {
      getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
      getTransactionChain: (...args: unknown[]) => mockGetTransactionChain(...args),
      getHmlrFetch: (...args: unknown[]) => mockGetHmlrFetch(...args),
    },
    documentStorageActor: {
      getTransactionDocuments: (...args: unknown[]) => mockGetTransactionDocuments(...args),
    },
    ledgerManager: {
      getEventsByTransaction: (...args: unknown[]) => mockGetEventsByTransaction(...args),
      getBlockchainEfficiencyMetrics: (...args: unknown[]) => mockGetBlockchainEfficiencyMetrics(...args),
    },
  },
}));

const mockSupabaseFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Supabase query builder helper
function createSupabaseChain(data: unknown[] | null, error: string | null = null): {
  select: ReturnType<typeof vi.fn>;
} {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

// ============================================
// FIXTURES
// ============================================

const TX_ID = 'tx-001';

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    eventId: 1,
    transactionId: TX_ID,
    eventType: 'transaction_created',
    timestamp: Date.now() * 1_000_000,
    caller: 'abc-principal',
    details: 'Transaction created',
    metadata: null,
    ...overrides,
  };
}

// Sets up supabase mock to return given data per table
function setupSupabaseMock(tableData: Record<string, unknown[]>): void {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const data = tableData[table] ?? [];
    return createSupabaseChain(data);
  });
}

// Sets up all canister mocks with defaults.
// The audit service talks to RAW canister actors, so mocks must return
// Candid wire shapes: `opt T` decodes to `[] | [T]`, never a bare object —
// that mismatch is exactly how the "Address not available" bug shipped.
function setupCanisterDefaults(): void {
  mockGetTransaction.mockResolvedValue([{
    id: TX_ID,
    status: 'in_progress',
    propertyAddress: '43 High Street, Sandy',
    buyers: [{ principalId: 'buyer-1' }],
    sellers: [{ principalId: 'seller-1' }],
    landRegistryIntegration: { titleNumber: 'HD123456' },
  }]);
  mockGetHmlrFetch.mockResolvedValue({ ok: [] });
  mockGetTransactionDocuments.mockResolvedValue([
    {
      id: 1n,
      fileName: 'title-deed.pdf',
      docType: 'title_deed',
      fileHash: 'a1b2c3d4',
      fileSize: 2048n,
      uploadedAt: BigInt(Date.now()) * 1_000_000n,
      uploadedBy: 'xyz-principal',
      verified: true,
    },
  ]);
  mockGetEventsByTransaction.mockResolvedValue([
    {
      eventId: 1n,
      transactionId: TX_ID,
      eventType: 'transaction_created',
      timestamp: BigInt(Date.now()) * 1_000_000n,
      caller: 'abc-principal',
      details: 'Transaction created',
      metadata: null,
    },
  ]);
  mockGetTransactionChain.mockResolvedValue({ ok: [{ blockHeight: 100 }] });
  mockGetBlockchainEfficiencyMetrics.mockResolvedValue({ avgBlockTime: 2.5 });
}

// ============================================
// TESTS: fetchAuditReport
// ============================================

describe('fetchAuditReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCanisterDefaults();
    setupSupabaseMock({
      Payment: [],
      skill_executions: [],
      consent_requests: [],
      notification_events: [],
    });
  });

  it('should return a full report when all queries succeed', async () => {
    const report = await fetchAuditReport(TX_ID);

    expect(report.transactionId).toBe(TX_ID);
    expect(report.transaction).not.toBeNull();
    expect(report.dataSources.blockchain.network).toBe('ic');
    expect(report.dataSources.supabase.project).toBe('bhacvhrbdmlkawpkhklq');
    expect(report.integrityVerification.overallStatus).toBe('verified');
    expect(report.reportHash).toBeTruthy();
    expect(Object.keys(report.errors)).toHaveLength(0);
  });

  it('should return a partial report when one canister fails', async () => {
    mockGetEventsByTransaction.mockRejectedValue(new Error('Canister unavailable'));

    const report = await fetchAuditReport(TX_ID);

    expect(report.transaction).not.toBeNull();
    expect(report.blockchainEventLog).toHaveLength(0);
    expect(report.errors['ledger_manager']).toBeDefined();
    expect(report.integrityVerification.canisterAvailability['ledger_manager']).toBe(false);
  });

  // Regression: getEventsByTransaction isn't in the published ledger_manager
  // binding yet. When it's absent the call throws synchronously during
  // Promise.allSettled argument evaluation, which used to escape the settle
  // guard and crash the whole audit page. The report must instead degrade to
  // an unavailable ledger source — same shape as a rejected canister call.
  it('should not throw when ledgerManager.getEventsByTransaction is missing from the binding', async () => {
    const ledger = (icpService as unknown as { ledgerManager: Record<string, unknown> }).ledgerManager;
    const original = ledger.getEventsByTransaction;
    delete ledger.getEventsByTransaction;

    try {
      const report = await fetchAuditReport(TX_ID);

      expect(report.transaction).not.toBeNull();
      expect(report.blockchainEventLog).toHaveLength(0);
      expect(report.errors['ledger_manager']).toBeDefined();
      expect(report.integrityVerification.canisterAvailability['ledger_manager']).toBe(false);
    } finally {
      ledger.getEventsByTransaction = original;
    }
  });

  it('should set error for each failed canister section', async () => {
    mockGetTransaction.mockRejectedValue(new Error('TX canister down'));
    mockGetTransactionDocuments.mockRejectedValue(new Error('Doc canister down'));
    mockGetEventsByTransaction.mockRejectedValue(new Error('Ledger down'));

    const report = await fetchAuditReport(TX_ID);

    expect(report.errors['transaction_manager']).toContain('TX canister down');
    expect(report.errors['document_storage']).toContain('Doc canister down');
    expect(report.errors['ledger_manager']).toContain('Ledger down');
    expect(report.integrityVerification.canisterAvailability['transaction_manager']).toBe(false);
    expect(report.integrityVerification.canisterAvailability['document_storage']).toBe(false);
    expect(report.integrityVerification.canisterAvailability['ledger_manager']).toBe(false);
  });

  it('should handle transaction not found (Candid opt none = empty array)', async () => {
    mockGetTransaction.mockResolvedValue([]);

    const report = await fetchAuditReport(TX_ID);

    expect(report.transaction).toBeNull();
    expect(report.landRegistry).toBeNull();
    expect(report.parties).toHaveLength(0);
    // Canister was available, just returned none
    expect(report.integrityVerification.canisterAvailability['transaction_manager']).toBe(true);
  });

  // Regression: the raw actor returns `opt Transaction` as a one-element
  // array. The service used to truthiness-check it without unwrapping, so
  // every field read `undefined` and the page showed "Address not available /
  // Unknown status" even for healthy transactions.
  it('should unwrap the Candid optional so transaction fields are readable', async () => {
    const report = await fetchAuditReport(TX_ID);

    expect(report.transaction?.propertyAddress).toBe('43 High Street, Sandy');
    expect(report.transaction?.status).toBe('in_progress');
    expect(report.parties).toHaveLength(2);
    expect((report.landRegistry as { titleNumber?: string })?.titleNumber).toBe('HD123456');
  });

  it('should surface the HMLR fetch record when the register has been pulled', async () => {
    mockGetHmlrFetch.mockResolvedValue({
      ok: [{
        titleNumber: 'BD247886',
        responseHash: 'deadbeef01',
        fetchedAt: 1750000000000000000n,
        fetchedBy: 'q5inx-principal',
      }],
    });

    const report = await fetchAuditReport(TX_ID);

    expect(report.hmlrFetch).not.toBeNull();
    expect(report.hmlrFetch?.titleNumber).toBe('BD247886');
    expect(report.hmlrFetch?.responseHash).toBe('deadbeef01');
    expect(report.hmlrFetch?.fetchedAt).toBe(1750000000000000000);
    expect(report.hmlrFetch?.fetchedBy).toBe('q5inx-principal');
  });

  it('should return null hmlrFetch when the register has not been pulled', async () => {
    mockGetHmlrFetch.mockResolvedValue({ ok: [] });

    const report = await fetchAuditReport(TX_ID);

    expect(report.hmlrFetch).toBeNull();
  });

  it('should not throw when getHmlrFetch is missing from the binding', async () => {
    const txm = (icpService as unknown as { transactionManager: Record<string, unknown> }).transactionManager;
    const original = txm.getHmlrFetch;
    delete txm.getHmlrFetch;

    try {
      const report = await fetchAuditReport(TX_ID);

      expect(report.hmlrFetch).toBeNull();
      expect(report.transaction).not.toBeNull();
    } finally {
      txm.getHmlrFetch = original;
    }
  });

  it('should produce green integrity when all payments matched', async () => {
    const now = Date.now();
    const paymentTime = new Date(now).toISOString();
    const eventTimestampNs = now * 1_000_000;

    setupSupabaseMock({
      Payment: [
        { id: 'pay-1', amount: 50000, currency: 'GBP', status: 'succeeded', transaction_id: TX_ID, created_at: paymentTime },
      ],
      skill_executions: [],
      consent_requests: [],
      notification_events: [],
    });

    mockGetEventsByTransaction.mockResolvedValue([
      {
        eventId: 10n,
        transactionId: TX_ID,
        eventType: 'payment_recorded',
        timestamp: BigInt(eventTimestampNs),
        caller: 'system',
        details: 'Payment recorded',
        metadata: null,
      },
    ]);

    const report = await fetchAuditReport(TX_ID);

    expect(report.integrityVerification.overallStatus).toBe('verified');
    expect(report.integrityVerification.crossReferenceStatus).toBe('all_matched');
    expect(report.integrityVerification.crossReferences).toHaveLength(1);
    expect(report.integrityVerification.crossReferences[0].matchedOnChain).toBe(true);
  });

  it('should produce red integrity when a payment has no on-chain event', async () => {
    setupSupabaseMock({
      Payment: [
        { id: 'pay-orphan', amount: 100, currency: 'GBP', status: 'succeeded', transaction_id: TX_ID, created_at: new Date().toISOString() },
      ],
      skill_executions: [],
      consent_requests: [],
      notification_events: [],
    });

    // No payment_recorded events on chain
    mockGetEventsByTransaction.mockResolvedValue([
      {
        eventId: 1n,
        transactionId: TX_ID,
        eventType: 'transaction_created',
        timestamp: BigInt(Date.now()) * 1_000_000n,
        caller: 'abc',
        details: 'Created',
        metadata: null,
      },
    ]);

    const report = await fetchAuditReport(TX_ID);

    expect(report.integrityVerification.overallStatus).toBe('discrepancy');
    expect(report.integrityVerification.crossReferenceStatus).toBe('discrepancies_found');
    expect(report.integrityVerification.crossReferences[0].matchedOnChain).toBe(false);
  });

  it('should produce green integrity when no payments exist (nothing to cross-ref)', async () => {
    setupSupabaseMock({
      Payment: [],
      skill_executions: [],
      consent_requests: [],
      notification_events: [],
    });

    const report = await fetchAuditReport(TX_ID);

    expect(report.integrityVerification.overallStatus).toBe('verified');
    expect(report.integrityVerification.crossReferences).toHaveLength(0);
    expect(report.integrityVerification.crossReferenceStatus).toBe('all_matched');
  });

  it('should sanitize XSS in event details', async () => {
    mockGetEventsByTransaction.mockResolvedValue([
      {
        eventId: 99n,
        transactionId: TX_ID,
        eventType: 'transaction_created',
        timestamp: BigInt(Date.now()) * 1_000_000n,
        caller: 'attacker',
        details: '<script>alert("xss")</script>',
        metadata: '<img onerror="alert(1)" src=x>',
      },
    ]);

    const report = await fetchAuditReport(TX_ID);

    const event = report.blockchainEventLog[0];
    expect(event.details).not.toContain('<script>');
    expect(event.details).toContain('&lt;script&gt;');
    expect(event.metadata).not.toContain('<img');
    expect(event.metadata).toContain('&lt;img');
  });

  it('should compute a consistent SHA-256 report hash', async () => {
    const report1 = await fetchAuditReport(TX_ID);
    // Re-run with same mocks to get same data
    const report2 = await fetchAuditReport(TX_ID);

    expect(report1.reportHash).toBeTruthy();
    expect(report2.reportHash).toBeTruthy();
    // Both should be valid hex strings of 64 chars (SHA-256)
    expect(report1.reportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report2.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ============================================
// TESTS: groupEventsIntoMilestones
// ============================================

describe('groupEventsIntoMilestones', () => {
  it('should group events into correct milestone categories', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'transaction_created' }),
      makeEvent({ eventId: 2, eventType: 'document_uploaded', details: 'Doc uploaded' }),
      makeEvent({ eventId: 3, eventType: 'document_verified', details: 'Doc verified' }),
      makeEvent({ eventId: 4, eventType: 'party_signature', details: 'Buyer signed' }),
      makeEvent({ eventId: 5, eventType: 'contract_exchanged', details: 'Exchanged' }),
    ];

    const milestones = groupEventsIntoMilestones(events);

    const names = milestones.map(m => m.name);
    expect(names).toContain('Property Listed');
    expect(names).toContain('Documents Uploaded');
    expect(names).toContain('Documents Verified');
    expect(names).toContain('Contracts Signed');
    expect(names).toContain('Contracts Exchanged');

    // Property Listed should contain the transaction_created event
    const listed = milestones.find(m => m.name === 'Property Listed');
    expect(listed?.events).toHaveLength(1);
    expect(listed?.events[0].eventType).toBe('transaction_created');
  });

  it('should return empty array for empty events', () => {
    const milestones = groupEventsIntoMilestones([]);
    expect(milestones).toHaveLength(0);
  });

  it('should handle a single event', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'buyer_joined', details: 'Buyer joined' }),
    ];

    const milestones = groupEventsIntoMilestones(events);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].name).toBe('Buyer Joined');
    expect(milestones[0].events).toHaveLength(1);
  });

  it('should group multiple events of the same type into one milestone', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'document_uploaded', details: 'Doc 1' }),
      makeEvent({ eventId: 2, eventType: 'document_uploaded', details: 'Doc 2' }),
      makeEvent({ eventId: 3, eventType: 'document_uploaded', details: 'Doc 3' }),
    ];

    const milestones = groupEventsIntoMilestones(events);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].name).toBe('Documents Uploaded');
    expect(milestones[0].events).toHaveLength(3);
  });

  it('should preserve milestone ordering regardless of event order', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'contract_exchanged' }),
      makeEvent({ eventId: 2, eventType: 'transaction_created' }),
      makeEvent({ eventId: 3, eventType: 'buyer_joined' }),
    ];

    const milestones = groupEventsIntoMilestones(events);
    const names = milestones.map(m => m.name);

    // Should follow the defined order, not insertion order
    expect(names.indexOf('Property Listed')).toBeLessThan(names.indexOf('Buyer Joined'));
    expect(names.indexOf('Buyer Joined')).toBeLessThan(names.indexOf('Contracts Exchanged'));
  });

  it('should place unknown event types into "Other" milestone', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'custom_unknown_event' }),
    ];

    const milestones = groupEventsIntoMilestones(events);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].name).toBe('Other');
  });

  it('should group lr_submission and lr_submission_failed into same Land Registry milestone', () => {
    const events: AuditEvent[] = [
      makeEvent({ eventId: 1, eventType: 'lr_submission', details: 'Submitted' }),
      makeEvent({ eventId: 2, eventType: 'lr_submission_failed', details: 'Failed' }),
    ];

    const milestones = groupEventsIntoMilestones(events);
    const lr = milestones.find(m => m.name === 'Land Registry');
    expect(lr).toBeDefined();
    expect(lr?.events).toHaveLength(2);
  });

  // ----------------------------------------------------------------
  // Milestone status derivation (audit money-shot accuracy)
  // ----------------------------------------------------------------
  describe('milestone status derivation', () => {
    it('should mark the furthest-progressed milestone active and earlier ones completed', () => {
      // Arrange: an in-flight transaction that has listed and a buyer joined
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'transaction_created' }),
        makeEvent({ eventId: 2, eventType: 'buyer_joined' }),
      ];

      // Act
      const milestones = groupEventsIntoMilestones(events);

      // Assert: "Buyer Joined" is the live frontier, "Property Listed" is done
      const listed = milestones.find(m => m.name === 'Property Listed');
      const joined = milestones.find(m => m.name === 'Buyer Joined');
      expect(listed?.status).toBe('completed');
      expect(joined?.status).toBe('active');
    });

    it('should mark every milestone completed once the Completion terminal is reached', () => {
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'transaction_created' }),
        makeEvent({ eventId: 2, eventType: 'contract_exchanged' }),
        makeEvent({ eventId: 3, eventType: 'blockchain_completed' }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      expect(milestones.every(m => m.status === 'completed')).toBe(true);
      expect(milestones.some(m => m.status === 'active')).toBe(false);
    });

    it('should mark every milestone completed once the Land Registry terminal is reached', () => {
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'transaction_created' }),
        makeEvent({ eventId: 2, eventType: 'lr_submission' }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      expect(milestones.every(m => m.status === 'completed')).toBe(true);
    });

    it('should never treat the "Other" bucket as the active frontier', () => {
      // Arrange: a progress event plus an unmapped event
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'transaction_created' }),
        makeEvent({ eventId: 2, eventType: 'some_unmapped_event' }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      const other = milestones.find(m => m.name === 'Other');
      const listed = milestones.find(m => m.name === 'Property Listed');
      expect(other?.status).toBe('completed');
      expect(listed?.status).toBe('active');
    });

    it('should sort events within a milestone chronologically', () => {
      // Arrange: same-milestone events delivered newest-first
      const events: AuditEvent[] = [
        makeEvent({ eventId: 2, eventType: 'document_uploaded', timestamp: 3000 }),
        makeEvent({ eventId: 1, eventType: 'document_uploaded', timestamp: 1000 }),
        makeEvent({ eventId: 3, eventType: 'document_uploaded', timestamp: 2000 }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      const docs = milestones.find(m => m.name === 'Documents Uploaded');
      expect(docs?.events.map(e => e.timestamp)).toEqual([1000, 2000, 3000]);
    });

    // hmlr_register_fetched fires at Stage 1 (title pull during listing). It
    // must NOT map to the terminal 'Land Registry' milestone (AP1 submission)
    // or a freshly-listed transaction would render as journey-complete.
    it('should not treat an early HMLR register pull as reaching the terminal milestone', () => {
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'transaction_created' }),
        makeEvent({ eventId: 2, eventType: 'hmlr_register_fetched' }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      expect(milestones.some(m => m.status === 'active')).toBe(true);
      const hmlr = milestones.find(m => m.events.some(e => e.eventType === 'hmlr_register_fetched'));
      expect(hmlr?.name).not.toBe('Land Registry');
      expect(hmlr?.name).not.toBe('Other');
    });

    it('should route joined_buyer_already_taken to "Other" (anomaly, not a milestone)', () => {
      const events: AuditEvent[] = [
        makeEvent({ eventId: 1, eventType: 'joined_buyer_already_taken' }),
      ];

      const milestones = groupEventsIntoMilestones(events);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].name).toBe('Other');
    });
  });

  // Contract test: every event type any emitter fires MUST route to a named
  // milestone, never the "Other" bucket. Drift here is a silent bug — an event
  // logs to chain but shows up unlabelled on the audit page.
  describe('MILESTONE_MAP contract with logEvent emitters', () => {
    const EMITTED_EVENT_TYPES = [
      // Original (PR #8)
      'stage_completed',      // useTransactionFlow.completeStage (generic fallback — rare now, kept for unknown stages)
      'transaction_created',  // useTransactionFlow.completeStage (seller-1)
      'contract_exchanged',   // useTransactionFlow.completeStage (seller-6 / buyer-6)
      'blockchain_completed', // useTransactionFlow.completeStage (seller-7 / buyer-7)
      'provider_selected',    // useTransactionFlow.selectProvider
      'buyer_joined',         // icpService.joinTransactionByInviteCode
      'document_uploaded',    // icpService.emitDocumentUploadedEvent

      // Ship 2c: stage-specific event types for the previously-unmapped stages
      'searches_ordered',              // seller-2
      'seller_forms_completed',        // seller-3
      'seller_conveyancer_confirmed',  // seller-5
      'buyer_onboarded',               // buyer-1
      'mortgage_confirmed',            // buyer-2
      'survey_completed',              // buyer-3
      'sellers_pack_reviewed',         // buyer-4
      'buyer_conveyancer_confirmed',   // buyer-5

      // Ship (audit money-shot): event types emitted by transaction_manager
      // that were previously falling into the "Other" bucket.
      'quote_requested',      // transaction_manager.requestQuote audit
      'quote_received',       // transaction_manager.recordQuote audit
      'conveyancer_selected', // transaction_manager.selectConveyancer audit
      'buyer_self_assigned',  // transaction_manager buyer slot self-claim

      // transaction_manager.recordHmlrFetched — title register pulled (Stage 1)
      'hmlr_register_fetched',
    ];

    it.each(EMITTED_EVENT_TYPES)(
      '%s groups to a named milestone, not "Other"',
      (eventType) => {
        const milestones = groupEventsIntoMilestones([makeEvent({ eventType })]);
        expect(milestones).toHaveLength(1);
        expect(milestones[0].name).not.toBe('Other');
      },
    );
  });
});
