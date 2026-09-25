/**
 * Transaction Audit Service
 * Queries ICP canisters and Supabase to assemble a complete audit report.
 * All canister queries run in parallel via Promise.allSettled.
 * Each data field is attributed to its source (blockchain or Supabase).
 */

import { icpService } from './icp.service';
import { supabase } from '../lib/supabase';
import { logger } from '@/utils/logger';

// ============================================
// TYPES
// ============================================

export type IntegrityStatus = 'verified' | 'warning' | 'discrepancy';

export interface AuditEvent {
  eventId: number;
  transactionId: string;
  eventType: string;
  timestamp: number;
  caller: string;
  details: string;
  metadata: string | null;
}

export interface DocumentAuditEntry {
  id: number;
  fileName: string;
  docType: string;
  fileHash: string;
  fileSize: number;
  uploadedAt: number;
  uploadedBy: string;
  verified: boolean;
  verificationStatus: 'verified' | 'pending' | 'failed' | 'none';
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  transactionId: string;
  createdAt: string;
  source: 'supabase';
}

export interface CrossReferenceResult {
  paymentId: string;
  matchedOnChain: boolean;
  timestampDelta: number | null;
}

export interface IntegrityVerification {
  overallStatus: IntegrityStatus;
  documentHashesVerified: boolean;
  crossReferenceStatus: 'all_matched' | 'warnings' | 'discrepancies_found';
  crossReferences: CrossReferenceResult[];
  canisterAvailability: Record<string, boolean>;
}

export interface HmlrFetchAudit {
  titleNumber: string;
  responseHash: string;
  fetchedAt: number; // nanoseconds since epoch (canister Time.now())
  fetchedBy: string;
}

export interface AuditReport {
  reportGeneratedAt: string;
  transactionId: string;
  dataSources: {
    blockchain: {
      network: 'ic';
      canistersQueried: string[];
      controllerPrincipal: string;
      queryTimestamp: string;
    };
    supabase: {
      project: string;
      tablesQueried: string[];
    };
  };
  transaction: Record<string, unknown> | null;
  property: Record<string, unknown> | null;
  parties: Record<string, unknown>[];
  documents: DocumentAuditEntry[];
  verifications: Record<string, unknown>[];
  blockchainEventLog: AuditEvent[];
  landRegistry: Record<string, unknown> | null;
  hmlrFetch: HmlrFetchAudit | null;
  efficiencyMetrics: Record<string, unknown> | null;
  chainPosition: Record<string, unknown>[] | null;
  payments: PaymentRecord[];
  skillExecutions: Record<string, unknown>[];
  consentTrail: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  integrityVerification: IntegrityVerification;
  reportHash: string | null;
  errors: Record<string, string>;
}

// ============================================
// MILESTONE GROUPING
// ============================================

export interface Milestone {
  name: string;
  status: 'completed' | 'active' | 'pending';
  events: AuditEvent[];
}

const MILESTONE_MAP: Record<string, string> = {
  // Seller setup + progress
  transaction_created: 'Property Listed',
  // Stage-1 title pull — deliberately NOT the terminal 'Land Registry'
  // milestone (that's the AP1 submission at completion); mapping it there
  // would render a freshly-listed transaction as journey-complete.
  hmlr_register_fetched: 'Title Register Fetched',
  searches_ordered: 'Searches Ordered',
  seller_forms_completed: 'Seller Forms Complete',
  seller_conveyancer_confirmed: 'Providers Selected',

  // Buyer setup + progress
  buyer_joined: 'Buyer Joined',
  buyer_self_assigned: 'Buyer Joined',
  buyer_onboarded: 'Buyer Onboarded',
  mortgage_confirmed: 'Mortgage Confirmed',
  survey_completed: 'Survey Complete',
  sellers_pack_reviewed: 'Seller Pack Reviewed',
  buyer_conveyancer_confirmed: 'Providers Selected',

  // Shared milestones
  quote_requested: 'Quotes Requested',
  quote_received: 'Quotes Received',
  provider_selected: 'Providers Selected',
  conveyancer_selected: 'Providers Selected',
  document_uploaded: 'Documents Uploaded',
  document_verified: 'Documents Verified',
  aml_verified: 'AML Verified',
  stage_completed: 'Stages Completed',
  party_signature: 'Contracts Signed',
  contract_exchanged: 'Contracts Exchanged',
  blockchain_completed: 'Completion',
  lr_submission: 'Land Registry',
  lr_submission_failed: 'Land Registry',
  payment_recorded: 'Payment',
  // `joined_buyer_already_taken` is intentionally left unmapped → 'Other'. It
  // records a rejected self-assign attempt (the buyer slot was already filled),
  // which is an audit anomaly worth keeping on-chain but is NOT a progress
  // milestone — surfacing it as one would falsely imply a buyer joined.
};

const MILESTONE_ORDER = [
  'Property Listed', 'Title Register Fetched', 'Searches Ordered', 'Seller Forms Complete',
  'Buyer Joined', 'Buyer Onboarded', 'Mortgage Confirmed',
  'Survey Complete', 'Seller Pack Reviewed',
  'Quotes Requested', 'Quotes Received', 'Providers Selected',
  'Documents Uploaded', 'Documents Verified', 'AML Verified',
  'Stages Completed', 'Contracts Signed', 'Contracts Exchanged',
  'Payment', 'Completion', 'Land Registry', 'Other',
];

// Reaching either of these means the transaction has finished its journey, so
// the furthest-progressed milestone is itself "completed" rather than "active".
const TERMINAL_MILESTONES = new Set(['Completion', 'Land Registry']);

export function groupEventsIntoMilestones(events: AuditEvent[]): Milestone[] {
  const grouped = new Map<string, AuditEvent[]>();

  for (const event of events) {
    const milestoneName = MILESTONE_MAP[event.eventType] ?? 'Other';
    const existing = grouped.get(milestoneName) ?? [];
    existing.push(event);
    grouped.set(milestoneName, existing);
  }

  const present = MILESTONE_ORDER.filter(name => grouped.has(name));

  // Derive real status instead of marking everything "completed". The
  // transaction's current position is the furthest-progressed *progress*
  // milestone with events: everything before it is done, that frontier is
  // "active". If a terminal milestone was reached the whole journey is complete.
  // 'Other' is a catch-all for un-mapped/anomaly events — never the frontier.
  const progressMilestones = present.filter(name => name !== 'Other');
  const reachedTerminal = progressMilestones.some(name => TERMINAL_MILESTONES.has(name));
  const frontier = reachedTerminal
    ? null
    : progressMilestones[progressMilestones.length - 1] ?? null;

  return present.map(name => ({
    name,
    status: (name === frontier ? 'active' : 'completed') as Milestone['status'],
    // Order events within a milestone chronologically for a coherent timeline.
    events: (grouped.get(name) ?? [])
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp),
  }));
}

// ============================================
// CROSS-REFERENCE LOGIC
// ============================================

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

function crossReferencePayments(
  payments: PaymentRecord[],
  events: AuditEvent[]
): CrossReferenceResult[] {
  return payments.map(payment => {
    const matchingEvent = events.find(
      e => e.eventType === 'payment_recorded' && e.transactionId === payment.transactionId
    );

    if (!matchingEvent) {
      return { paymentId: payment.id, matchedOnChain: false, timestampDelta: null };
    }

    const paymentTime = new Date(payment.createdAt).getTime();
    const eventTime = matchingEvent.timestamp / 1_000_000; // nanoseconds to ms
    const delta = Math.abs(paymentTime - eventTime);

    return {
      paymentId: payment.id,
      matchedOnChain: true,
      timestampDelta: delta,
    };
  });
}

function computeIntegrity(
  crossRefs: CrossReferenceResult[],
  canisterAvailability: Record<string, boolean>,
  documents: DocumentAuditEntry[]
): IntegrityVerification {
  const allDocsVerified = documents.length === 0 || documents.every(d => d.verified);

  const hasDiscrepancy = crossRefs.some(cr => !cr.matchedOnChain);
  const hasWarning = crossRefs.some(
    cr => cr.matchedOnChain && cr.timestampDelta !== null && cr.timestampDelta > TIMESTAMP_TOLERANCE_MS
  );
  const anyCanisterDown = Object.values(canisterAvailability).some(v => !v);

  let crossRefStatus: IntegrityVerification['crossReferenceStatus'] = 'all_matched';
  if (hasDiscrepancy) crossRefStatus = 'discrepancies_found';
  else if (hasWarning) crossRefStatus = 'warnings';

  let overallStatus: IntegrityStatus = 'verified';
  if (hasDiscrepancy) overallStatus = 'discrepancy';
  else if (hasWarning || anyCanisterDown) overallStatus = 'warning';

  return {
    overallStatus,
    documentHashesVerified: allDocsVerified,
    crossReferenceStatus: crossRefStatus,
    crossReferences: crossRefs,
    canisterAvailability,
  };
}

// ============================================
// SHA-256 SELF-HASH
// ============================================

async function computeReportHash(report: Omit<AuditReport, 'reportHash'>): Promise<string | null> {
  try {
    const json = JSON.stringify(report);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

// ============================================
// SANITIZE TEXT (XSS prevention)
// ============================================

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ============================================
// MAIN FETCH FUNCTION
// ============================================

export async function fetchAuditReport(transactionId: string): Promise<AuditReport> {
  const startTime = new Date().toISOString();
  const errors: Record<string, string> = {};
  const canisterAvailability: Record<string, boolean> = {};

  logger.info(`Fetching audit report for transaction: ${transactionId}`);

  // `getEventsByTransaction` is not part of the published ledger_manager
  // binding yet — events are written via `logEvent`, but no read-back query
  // has shipped in @propxchain/core-client. Calling a method the actor doesn't
  // expose throws synchronously, and because this call is an *argument* to
  // Promise.allSettled the throw escapes the settle guard and crashes the whole
  // audit page (Retry just reproduces it). Guard it so the report degrades to
  // "event log unavailable" via the existing errors/canisterAvailability path,
  // and starts surfacing real events automatically once the query ships.
  const ledger = icpService.ledgerManager;
  const eventsQuery: Promise<unknown> =
    typeof ledger?.getEventsByTransaction === 'function'
      ? Promise.resolve().then(() => ledger.getEventsByTransaction(transactionId))
      : Promise.reject(new Error('Blockchain event log query is not available'));

  // Same guard pattern for getHmlrFetch — older published bindings may not
  // expose it, and a synchronous throw inside the allSettled argument list
  // would crash the whole page rather than degrade one section.
  const txm = icpService.transactionManager;
  const hmlrQuery: Promise<unknown> =
    typeof txm?.getHmlrFetch === 'function'
      ? Promise.resolve().then(() => txm.getHmlrFetch(transactionId))
      : Promise.reject(new Error('HMLR fetch query is not available'));

  // Phase 1: Parallel canister queries
  const [
    txResult,
    docsResult,
    eventsResult,
    chainResult,
    efficiencyResult,
    hmlrResult,
  ] = await Promise.allSettled([
    // 1. Transaction record (includes LandRegistryIntegration)
    icpService.transactionManager?.getTransaction(transactionId),
    // 2. Document inventory
    icpService.documentStorageActor?.getTransactionDocuments(transactionId),
    // 3. Audit event timeline (guarded — see eventsQuery above)
    eventsQuery,
    // 4. Chain position
    icpService.transactionManager?.getTransactionChain(transactionId),
    // 5. Efficiency metrics (uses caller principal for account lookup)
    icpService.ledgerManager?.getBlockchainEfficiencyMetrics(''),
    // 6. HMLR register-fetch milestone (guarded — see hmlrQuery above)
    hmlrQuery,
  ]);

  // Extract transaction data
  let transaction: Record<string, unknown> | null = null;
  let landRegistry: Record<string, unknown> | null = null;
  let parties: Record<string, unknown>[] = [];
  canisterAvailability['transaction_manager'] = txResult.status === 'fulfilled';

  // The raw actor returns Candid `opt Transaction` as `[] | [tx]` — unwrap
  // before reading fields, or every field is `undefined` and the page shows
  // "Address not available / Unknown status" for perfectly healthy records.
  const rawTx = txResult.status === 'fulfilled' ? txResult.value : null;
  const unwrappedTx = Array.isArray(rawTx) ? rawTx[0] ?? null : rawTx;

  if (txResult.status === 'fulfilled' && unwrappedTx) {
    const tx = unwrappedTx as unknown as Record<string, unknown>;
    transaction = tx;
    if (tx.landRegistryIntegration) {
      landRegistry = tx.landRegistryIntegration as Record<string, unknown>;
    }
    // Extract party info from buyers/sellers arrays
    const buyers = (tx.buyers as unknown[]) ?? [];
    const sellers = (tx.sellers as unknown[]) ?? [];
    parties = [...buyers, ...sellers].map(p => p as Record<string, unknown>);
  } else if (txResult.status === 'rejected') {
    errors['transaction_manager'] = String(txResult.reason);
  }

  // Extract documents
  let documents: DocumentAuditEntry[] = [];
  canisterAvailability['document_storage'] = docsResult.status === 'fulfilled';

  if (docsResult.status === 'fulfilled' && docsResult.value) {
    const docs = docsResult.value as unknown as Array<Record<string, unknown>>;
    documents = docs.map(doc => ({
      id: Number(doc.id),
      fileName: sanitizeText(String(doc.fileName ?? 'Unknown')),
      docType: sanitizeText(String(doc.docType ?? '')),
      fileHash: String(doc.fileHash ?? ''),
      fileSize: Number(doc.fileSize ?? 0),
      uploadedAt: Number(doc.uploadedAt ?? 0),
      uploadedBy: String(doc.uploadedBy ?? ''),
      verified: Boolean(doc.verified),
      verificationStatus: doc.verified ? 'verified' as const : 'pending' as const,
    }));
  } else if (docsResult.status === 'rejected') {
    errors['document_storage'] = String(docsResult.reason);
  }

  // Extract events
  let blockchainEventLog: AuditEvent[] = [];
  canisterAvailability['ledger_manager'] = eventsResult.status === 'fulfilled';

  if (eventsResult.status === 'fulfilled' && eventsResult.value) {
    const events = eventsResult.value as Array<Record<string, unknown>>;
    blockchainEventLog = events.map(e => ({
      eventId: Number(e.eventId),
      transactionId: String(e.transactionId),
      eventType: String(e.eventType),
      timestamp: Number(e.timestamp),
      caller: String(e.caller),
      details: sanitizeText(String(e.details)),
      metadata: e.metadata ? sanitizeText(String(e.metadata)) : null,
    }));
  } else if (eventsResult.status === 'rejected') {
    errors['ledger_manager'] = String(eventsResult.reason);
  }

  // Extract chain position
  let chainPosition: Record<string, unknown>[] | null = null;
  if (chainResult.status === 'fulfilled' && chainResult.value) {
    const result = chainResult.value as { ok?: unknown[]; err?: string };
    if (result.ok) {
      chainPosition = result.ok as Record<string, unknown>[];
    }
  }

  // Extract HMLR register-fetch record. The raw actor returns
  // `Result<?HmlrFetchRecord, Text>`: `{ ok: [] | [record] }` or `{ err }`.
  // Absent/erroring is normal (register not pulled yet) — degrade to null.
  let hmlrFetch: HmlrFetchAudit | null = null;
  if (hmlrResult.status === 'fulfilled' && hmlrResult.value) {
    const result = hmlrResult.value as { ok?: unknown };
    const record = Array.isArray(result.ok) ? result.ok[0] : undefined;
    if (record) {
      const r = record as Record<string, unknown>;
      hmlrFetch = {
        titleNumber: sanitizeText(String(r.titleNumber ?? '')),
        responseHash: String(r.responseHash ?? ''),
        fetchedAt: Number(r.fetchedAt ?? 0),
        fetchedBy: String(r.fetchedBy ?? ''),
      };
    }
  }

  // Extract efficiency metrics
  let efficiencyMetrics: Record<string, unknown> | null = null;
  if (efficiencyResult.status === 'fulfilled' && efficiencyResult.value) {
    efficiencyMetrics = efficiencyResult.value as unknown as Record<string, unknown>;
  }

  // Phase 2: Supabase queries (parallel)
  const [paymentsRes, skillsRes, consentRes, notificationsRes] = await Promise.allSettled([
    // Named columns, never '*': "Payment" also holds server-only columns that
    // clients cannot read (migration 20260917130000), so '*' would be refused.
    supabase.from('Payment').select('id, amount_pence, currency, status, transaction_id, created_at').eq('transaction_id', transactionId),
    supabase.from('skill_executions').select('*').eq('transaction_id', transactionId),
    supabase.from('consent_requests').select('*').eq('transaction_id', transactionId),
    supabase.from('notification_events').select('*').eq('transaction_id', transactionId),
  ]);

  const payments: PaymentRecord[] = [];
  if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) {
    for (const row of paymentsRes.value.data) {
      payments.push({
        id: row.id,
        // The column is amount_pence; `row.amount` never existed, so the audit
        // tab threw on amount.toLocaleString() for any transaction with a payment.
        amount: row.amount_pence / 100,
        currency: row.currency ?? 'GBP',
        status: row.status,
        transactionId: row.transaction_id,
        createdAt: row.created_at,
        source: 'supabase',
      });
    }
  } else if (paymentsRes.status === 'rejected') {
    errors['supabase_payments'] = 'Platform data unavailable';
  }

  const skillExecutions = skillsRes.status === 'fulfilled' && skillsRes.value.data
    ? skillsRes.value.data as Record<string, unknown>[]
    : [];
  if (skillsRes.status === 'rejected') errors['supabase_skills'] = 'Platform data unavailable';

  const consentTrail = consentRes.status === 'fulfilled' && consentRes.value.data
    ? consentRes.value.data as Record<string, unknown>[]
    : [];
  if (consentRes.status === 'rejected') errors['supabase_consent'] = 'Platform data unavailable';

  const notifications = notificationsRes.status === 'fulfilled' && notificationsRes.value.data
    ? notificationsRes.value.data as Record<string, unknown>[]
    : [];
  if (notificationsRes.status === 'rejected') errors['supabase_notifications'] = 'Platform data unavailable';

  // Phase 3: Cross-reference and integrity
  const crossRefs = crossReferencePayments(payments, blockchainEventLog);
  const integrity = computeIntegrity(crossRefs, canisterAvailability, documents);

  // Assemble report (without hash)
  const reportWithoutHash: Omit<AuditReport, 'reportHash'> = {
    reportGeneratedAt: startTime,
    transactionId,
    dataSources: {
      blockchain: {
        network: 'ic',
        canistersQueried: [
          'transaction_manager', 'document_storage', 'ledger_manager',
          'document_verification', 'user_management',
        ],
        controllerPrincipal: 'nfzga-dpxug-zxng7-gxx6c-plzm5-wn7bm-oj5k7-ky3sf-mmgp5-6asur-2qe',
        queryTimestamp: startTime,
      },
      supabase: {
        project: 'bhacvhrbdmlkawpkhklq',
        tablesQueried: ['Payment', 'skill_executions', 'consent_requests', 'notification_events'],
      },
    },
    transaction,
    property: null,
    parties,
    documents,
    verifications: [],
    blockchainEventLog,
    landRegistry,
    hmlrFetch,
    efficiencyMetrics,
    chainPosition,
    payments,
    skillExecutions: skillExecutions,
    consentTrail,
    notifications,
    integrityVerification: integrity,
    errors,
  };

  // Phase 4: SHA-256 self-hash
  const reportHash = await computeReportHash(reportWithoutHash);

  return { ...reportWithoutHash, reportHash };
}
