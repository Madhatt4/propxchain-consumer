/**
 * Move Narrator — blocker-change detection (pure logic + per-tx storage).
 *
 * The Narrator pushes a warm, plain-English update to premium customers when a
 * transaction's blocker changes. This module owns the two decisions that gate
 * that push, kept free of React and network code so they are trivially
 * testable:
 *
 *   1. `evaluateTrigger` — given the current blocker, the last one we recorded
 *      for this transaction, and whether the user is premium, decide whether to
 *      fire a run, silently record the change, or do nothing.
 *   2. The `lastBlocker` localStorage map — the memory that makes (1) idempotent
 *      across re-renders and refetches.
 *
 * Design choices (confirmed with product):
 *   - First observation is a BASELINE: when nothing is stored we record the
 *     current blocker and do NOT fire. The card already shows the current
 *     blocker (pull); the Narrator is the push-on-*change*.
 *   - A clear to `none` is recorded but never narrated.
 *   - Free-tier users record the change (so a later upgrade only narrates new
 *     changes) but never fire.
 */

/** The canister's sentinel for "no blocker" — never narrated. */
export const NO_BLOCKER = 'none';

export type TriggerDecision = 'fire' | 'update_only' | 'noop';

export interface TriggerInput {
  /** The blocker from the current `getNextStep` recommendation. */
  currentBlocker: string;
  /** The blocker we last recorded for this tx, or null if none recorded yet. */
  lastBlocker: string | null;
  /** Whether the current user is on a premium (paid) tier. */
  isPremium: boolean;
}

/**
 * Decide what to do for a single observed blocker.
 *
 * - `fire`        — premium user, the blocker genuinely changed to a real
 *                   blocker. Start a narration run.
 * - `update_only` — record the new blocker but don't narrate (baseline, a
 *                   clear-to-none, or a free-tier user).
 * - `noop`        — nothing to do (unchanged, or an empty/unknown blocker).
 */
export function evaluateTrigger({
  currentBlocker,
  lastBlocker,
  isPremium,
}: TriggerInput): TriggerDecision {
  // Guard against an empty/unknown blocker — never act on it.
  if (!currentBlocker) return 'noop';

  // First time we've seen this transaction: record the baseline, don't push.
  if (lastBlocker === null) return 'update_only';

  // Unchanged since last time — dedup, do nothing.
  if (currentBlocker === lastBlocker) return 'noop';

  // Changed, but cleared to "no blocker" — record it, never narrate.
  if (currentBlocker === NO_BLOCKER) return 'update_only';

  // A real, changed blocker: premium users get the push; free tier just records.
  return isPremium ? 'fire' : 'update_only';
}

const LAST_BLOCKER_PREFIX = 'moveNarrator:lastBlocker:';

/** localStorage key holding the last recorded blocker for a transaction. */
export function lastBlockerKey(txId: string): string {
  return `${LAST_BLOCKER_PREFIX}${txId}`;
}

/**
 * Safe localStorage accessor. The marketing build prerenders routes in Node
 * where `window`/`localStorage` is absent; detection simply no-ops there.
 */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The last blocker recorded for this tx, or null if none / storage unavailable. */
export function readLastBlocker(txId: string): string | null {
  return storage()?.getItem(lastBlockerKey(txId)) ?? null;
}

/** Record the current blocker for this tx so the next change can be detected. */
export function writeLastBlocker(txId: string, blocker: string): void {
  storage()?.setItem(lastBlockerKey(txId), blocker);
}
