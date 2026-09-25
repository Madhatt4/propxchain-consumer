/**
 * Portfolio Audit Service
 *
 * Aggregates the platform-wide blockchain audit log into KPI stats,
 * per-transaction groupings, and surfaced anomalies. Built by listing all
 * transactions (admin-gated) and reading each one's `ledger_manager` event
 * log — see {@link fetchEventsViaTransactions} for why not the
 * controller-only `getAllAuditEvents`.
 *
 * Distinct from `transactionAudit.ts` (single-transaction report). This is the
 * portfolio-scale view: every event across every transaction, evidencing
 * blockchain-verified audit at scale.
 *
 * Contract: `() -> PortfolioAudit`. Admin-scoped — it reads the whole
 * transaction set, so callers MUST gate on admin authorization.
 */

import { icpService } from './icp.service';
import { logger } from '@/utils/logger';
import type { AuditEvent } from './transactionAudit';
import { sanitizeText } from './transactionAudit';

// Anomaly event types — recorded on-chain for integrity but NOT progress
// milestones. The per-transaction timeline buckets these into "Other"; at
// portfolio scale we surface them explicitly as integrity signals.
export const ANOMALY_EVENT_TYPES: ReadonlySet<string> = new Set([
  'joined_buyer_already_taken', // rejected self-assign — buyer slot already filled
  'lr_submission_failed',       // Land Registry submission rejected
]);

const LEDGER_MANAGER_CANISTER_ID =
  (import.meta.env.VITE_LEDGER_MANAGER_CANISTER_ID as string | undefined) ||
  'hty74-maaaa-aaaaa-qcxza-cai';

const NS_PER_MS = 1_000_000;

export interface TransactionGroup {
  transactionId: string;
  eventCount: number;
  firstTimestamp: number; // ms
  lastTimestamp: number;  // ms
  anomalyCount: number;
  events: AuditEvent[];   // chronological (oldest first)
}

export interface EventTypeCount {
  eventType: string;
  count: number;
}

export interface PortfolioAudit {
  generatedAt: string;
  totalEvents: number;
  totalTransactions: number;
  totalAnomalies: number;
  distinctEventTypes: number;
  earliestTimestamp: number | null; // ms
  latestTimestamp: number | null;   // ms
  eventTypeBreakdown: EventTypeCount[]; // sorted desc by count
  transactions: TransactionGroup[];     // sorted by lastTimestamp desc
  anomalies: AuditEvent[];              // most-recent first
  source: {
    canister: 'ledger_manager';
    canisterId: string;
    network: 'ic';
  };
}

/**
 * Normalize a raw Candid `AuditEvent` into the typed shape. `eventId`/`timestamp`
 * arrive as bigint, `caller` as a Principal, `metadata` as `[] | [string]`.
 */
function normalizeEvent(raw: Record<string, unknown>): AuditEvent {
  const metadataOpt = raw.metadata as unknown;
  let metadata: string | null = null;
  if (Array.isArray(metadataOpt) && metadataOpt.length > 0) {
    metadata = sanitizeText(String(metadataOpt[0]));
  } else if (typeof metadataOpt === 'string' && metadataOpt.length > 0) {
    metadata = sanitizeText(metadataOpt);
  }

  return {
    eventId: Number(raw.eventId),
    transactionId: String(raw.transactionId),
    eventType: String(raw.eventType),
    timestamp: Number(raw.timestamp), // nanoseconds
    caller: String(raw.caller),
    details: sanitizeText(String(raw.details ?? '')),
    metadata,
  };
}

function buildTransactionGroups(
  groupsMap: Map<string, AuditEvent[]>
): TransactionGroup[] {
  const groups: TransactionGroup[] = [];

  for (const [transactionId, evs] of groupsMap.entries()) {
    const sorted = evs.slice().sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0].timestamp / NS_PER_MS;
    const last = sorted[sorted.length - 1].timestamp / NS_PER_MS;
    const anomalyCount = sorted.filter(e =>
      ANOMALY_EVENT_TYPES.has(e.eventType)
    ).length;

    groups.push({
      transactionId,
      eventCount: sorted.length,
      firstTimestamp: first,
      lastTimestamp: last,
      anomalyCount,
      events: sorted,
    });
  }

  return groups.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

/**
 * Pure aggregation over a normalized event set. Exported for unit testing.
 */
export function aggregatePortfolioAudit(
  events: AuditEvent[],
  generatedAt: string
): PortfolioAudit {
  const groupsMap = new Map<string, AuditEvent[]>();
  const typeCounts = new Map<string, number>();
  const anomalies: AuditEvent[] = [];
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const e of events) {
    const ms = e.timestamp / NS_PER_MS;
    if (earliest === null || ms < earliest) earliest = ms;
    if (latest === null || ms > latest) latest = ms;

    const arr = groupsMap.get(e.transactionId) ?? [];
    arr.push(e);
    groupsMap.set(e.transactionId, arr);

    typeCounts.set(e.eventType, (typeCounts.get(e.eventType) ?? 0) + 1);
    if (ANOMALY_EVENT_TYPES.has(e.eventType)) anomalies.push(e);
  }

  const eventTypeBreakdown = [...typeCounts.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count);

  anomalies.sort((a, b) => b.timestamp - a.timestamp);

  return {
    generatedAt,
    totalEvents: events.length,
    totalTransactions: groupsMap.size,
    totalAnomalies: anomalies.length,
    distinctEventTypes: typeCounts.size,
    earliestTimestamp: earliest,
    latestTimestamp: latest,
    eventTypeBreakdown,
    transactions: buildTransactionGroups(groupsMap),
    anomalies,
    source: {
      canister: 'ledger_manager',
      canisterId: LEDGER_MANAGER_CANISTER_ID,
      network: 'ic',
    },
  };
}

// How many per-transaction event queries to run concurrently. Bounds the
// burst when fanning out across the whole portfolio.
const EVENT_FANOUT_CHUNK = 8;

interface LedgerLike {
  getEventsByTransaction: (transactionId: string) => Promise<unknown>;
}

/**
 * Read the platform-wide event set by listing all transactions
 * (`transaction_manager.getAllTransactions`, admin-gated) and reading each
 * one's event log via the open `getEventsByTransaction` query.
 *
 * Why not `ledger_manager.getAllAuditEvents`? That method asserts the caller
 * is the deploy-controller principal — it's a `query` func and so can't make
 * the cross-canister admin check — and therefore traps for ordinary app
 * admins. This fan-out works for any admin who can list transactions. Events
 * belonging to purged transactions aren't reachable this way (an acceptable
 * gap for the portfolio view); the controller-only `getAllAuditEvents`
 * remains the exhaustive source.
 */
async function fetchEventsViaTransactions(ledger: LedgerLike): Promise<AuditEvent[]> {
  const txns = (await icpService.getAllTransactions()) as Array<{ id?: unknown }>;
  const ids = txns
    .map(t => (t?.id === undefined || t?.id === null ? '' : String(t.id)))
    .filter(id => id.length > 0);

  const events: AuditEvent[] = [];
  for (let i = 0; i < ids.length; i += EVENT_FANOUT_CHUNK) {
    const batch = ids.slice(i, i + EVENT_FANOUT_CHUNK);
    const results = await Promise.all(
      batch.map(id =>
        Promise.resolve()
          .then(() => ledger.getEventsByTransaction(id))
          // A single transaction's query failing shouldn't blank the report.
          .catch(() => [] as unknown),
      ),
    );
    for (const result of results) {
      if (Array.isArray(result)) {
        for (const raw of result) {
          events.push(normalizeEvent(raw as Record<string, unknown>));
        }
      }
    }
  }
  return events;
}

/**
 * Fetch and aggregate the platform-wide audit log. Throws if the ledger
 * binding doesn't expose `getEventsByTransaction` (degrades gracefully at the
 * call site).
 */
export async function fetchPortfolioAudit(): Promise<PortfolioAudit> {
  const generatedAt = new Date().toISOString();

  if (!icpService.ledgerManager) {
    await icpService.initialize();
  }

  const ledger = icpService.ledgerManager as LedgerLike | null;
  if (typeof ledger?.getEventsByTransaction !== 'function') {
    throw new Error('Portfolio audit query is not available in this build');
  }

  logger.info('Fetching portfolio-wide audit events via transaction fan-out');
  const events = await fetchEventsViaTransactions(ledger);
  logger.info(`Portfolio audit: ${events.length} events across all transactions`);

  return aggregatePortfolioAudit(events, generatedAt);
}
