/**
 * Request validation for the move-narrator edge function.
 *
 * Manual validation (the Deno edge runtime pattern in this repo — see
 * epc-lookup) rather than Zod, but exhaustive: every action's required fields
 * are checked and a precise error is returned before any upstream call.
 */

import type {
  DeliverAction,
  FireAction,
  MonitorFireAction,
  NarratorRequest,
  NextStepRecommendation,
  NextStepUrgency,
  StatusAction,
  TransactionContext,
} from './types.ts';

export class ValidationError extends Error {}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new ValidationError(`${field} must be a non-empty string`);
  return v;
}

/** Optional, telemetry-only — see StatusAction/DeliverAction in types.ts. */
function optionalStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

// Chunk 2 precondition #2: blocker/previousBlocker were unconstrained client
// strings. Real key shapes sourced from `next_step.mo` (grep `blocker = `):
// "no_solicitor", "no_title_number", "hmlr_not_fetched", "artifacts_missing",
// "counterparty_idle", "none" — all snake_case, well under 64 chars. Capped
// generously above the longest real key so a legitimate new blocker key never
// trips this without a code change signalling it.
const BLOCKER_KEY_MAX_LENGTH = 64;
const BLOCKER_KEY_PATTERN = /^[a-z0-9_]*$/;

/**
 * Validate a blocker key. `allowEmpty` is true only for `previousBlocker`
 * (a transaction's very first blocker has no predecessor) — `blocker` itself
 * must always be present (enforced by the caller via `str()` first).
 */
function blockerKey(v: string, field: string, { allowEmpty }: { allowEmpty: boolean }): string {
  if (!allowEmpty && v === '') throw new ValidationError(`${field} must be a non-empty string`);
  if (v.length > BLOCKER_KEY_MAX_LENGTH) {
    throw new ValidationError(`${field} must be at most ${BLOCKER_KEY_MAX_LENGTH} characters`);
  }
  if (!BLOCKER_KEY_PATTERN.test(v)) {
    throw new ValidationError(`${field} must match ^[a-z0-9_]*$ (snake_case blocker key)`);
  }
  return v;
}

function validateUrgency(v: unknown, field: string): NextStepUrgency {
  if (v !== 'blocking' && v !== 'soon' && v !== 'later') {
    throw new ValidationError(`${field} must be blocking|soon|later`);
  }
  return v;
}

function validateTransaction(v: unknown): TransactionContext {
  const t = v as Record<string, unknown>;
  if (!t || typeof t !== 'object') throw new ValidationError('transaction must be an object');
  const role = t.role;
  if (role !== 'buyer' && role !== 'seller') throw new ValidationError('transaction.role must be "buyer" or "seller"');
  const rawPreviousBlocker = typeof t.previousBlocker === 'string' ? t.previousBlocker : '';
  return {
    txId: str(t.txId, 'transaction.txId'),
    url: str(t.url, 'transaction.url'),
    role,
    propertyAddress: str(t.propertyAddress, 'transaction.propertyAddress'),
    previousBlocker: blockerKey(rawPreviousBlocker, 'transaction.previousBlocker', { allowEmpty: true }),
  };
}

function validateNextStep(v: unknown): NextStepRecommendation {
  const n = v as Record<string, unknown>;
  if (!n || typeof n !== 'object') throw new ValidationError('getNextStep must be an object');
  const urgency = validateUrgency(n.urgency, 'getNextStep.urgency');
  if (!Array.isArray(n.options)) throw new ValidationError('getNextStep.options must be an array');
  return {
    blocker: blockerKey(str(n.blocker, 'getNextStep.blocker'), 'getNextStep.blocker', { allowEmpty: false }),
    blockerLabel: str(n.blockerLabel, 'getNextStep.blockerLabel'),
    why: str(n.why, 'getNextStep.why'),
    urgency,
    partial: Boolean(n.partial),
    options: n.options as NextStepRecommendation['options'],
  };
}

// NOTE (audit 2026-07-25, finding #2): there was a validateRecipient() here
// that accepted `recipient.email` / `recipient.mobile` from the request body.
// Validating those fields was never the problem — accepting them at all was:
// it let the caller choose where PropXchain-branded email and SMS were sent.
// The recipient is now derived from the authenticated session in index.ts and
// is deliberately absent from the request shape, so there is nothing to parse.

export function validateRequest(body: unknown): NarratorRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (b.action) {
    case 'fire':
      return { action: 'fire', transaction: validateTransaction(b.transaction), getNextStep: validateNextStep(b.getNextStep) } as FireAction;
    case 'status':
      return { action: 'status', sessionId: str(b.sessionId, 'sessionId'), txId: optionalStr(b.txId) } as StatusAction;
    case 'deliver':
      return { action: 'deliver', sessionId: str(b.sessionId, 'sessionId'), txId: optionalStr(b.txId) } as DeliverAction;
    default:
      throw new ValidationError('action must be one of: fire, status, deliver');
  }
}

/**
 * `monitor_fire` (chunk 2): the transaction-monitor cron's server-to-server
 * nudge request. Validated separately from `validateRequest` above — it is
 * never reachable via the user-JWT path (see index.ts's Bearer-secret
 * routing) and is deliberately not a member of `NarratorRequest`.
 */
export function validateMonitorFireRequest(body: unknown): MonitorFireAction {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.action !== 'monitor_fire') throw new ValidationError('action must be monitor_fire');
  const rawPreviousBlocker = typeof b.previousBlocker === 'string' ? b.previousBlocker : '';
  return {
    action: 'monitor_fire',
    txId: str(b.txId, 'txId'),
    blocker: blockerKey(str(b.blocker, 'blocker'), 'blocker', { allowEmpty: false }),
    previousBlocker: blockerKey(rawPreviousBlocker, 'previousBlocker', { allowEmpty: true }),
    urgency: validateUrgency(b.urgency, 'urgency'),
  };
}
