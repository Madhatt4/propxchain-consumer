/**
 * Where a next-step recommendation sends the user.
 *
 * Pure and separate from TransactionFlowPage so every action can be tested
 * against both journeys without mounting the page.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE:
 *
 * The first version of this mapping lived inline in the page and fell back to
 * `setDetailOpen(true)` for anything it could not map. `detailOpen` already
 * defaults to true, so that fallback was a no-op: four of the six canister
 * actions were buttons that did nothing at all when a buyer clicked them.
 *
 * A control that visibly does nothing is worse than the plain text it
 * replaced — text does not invite a click. So the contract here is stronger
 * than "map what we can":
 *
 *   resolve() NEVER returns null when there is at least one stage.
 *
 * Every action lands somewhere defensible, and `isFallback` tells the caller
 * whether it landed on a precise destination or merely somewhere sensible.
 */
import type { JourneyRole } from '../types/stage.types';

// One source of truth for the role — the same union the stage config uses.
export type { JourneyRole };

/**
 * The six action strings the canister emits
 * (packages/core/src/transaction_manager/next_step.mo). The service types
 * `action` as a bare string, so this union lives here as the local contract —
 * unknown strings are handled by the fallback rather than rejected.
 */
export type NextStepAction =
  | 'browse_conveyancer_panel'
  | 'fetch_hmlr_title'
  | 'invite_solicitor_by_email'
  | 'lookup_title_number'
  | 'send_nudge_message'
  | 'upload_required_document';

/** Minimal shape needed to resolve a destination. */
export interface ResolvableStage {
  id: string;
  status?: string;
}

export interface NextStepDestination {
  /** Stage to select and scroll to. */
  stageId: string;
  /**
   * False when the action has a precise, verified home. True when we only
   * put the user somewhere reasonable — the caller may want to explain
   * rather than silently move them.
   */
  isFallback: boolean;
}

/**
 * Precise destinations, verified against src/utils/stageConfig.ts.
 *
 * Deliberately absent:
 *
 * - Buyer title actions. `fetch_hmlr_title` / `lookup_title_number` are the
 *   seller's job — the buyer journey has no title stage at all (buyer-1 is
 *   "Property Matched"). Sending a buyer to a title form would be a wrong
 *   destination, not a missing one.
 * - Buyer `upload_required_document`. buyer-4 is "Review Seller's Pack" —
 *   reading, not uploading. Buyers do upload elsewhere (mortgage at buyer-2,
 *   survey at buyer-3) but which one depends on the blocker, and guessing
 *   between them is exactly the confident-but-wrong move to avoid.
 * - `send_nudge_message` for either side. Messaging is not a stage on this
 *   page, so there is no correct stage answer.
 *
 * All three fall through to the fallback, which is honest rather than silent.
 */
const PRECISE: Partial<Record<NextStepAction, Partial<Record<JourneyRole, string>>>> = {
  // Conveyancer stages: seller-5 "Conveyancer Review", buyer-5 "Conveyancer Enquiries".
  browse_conveyancer_panel: { seller: 'seller-5', buyer: 'buyer-5' },
  invite_solicitor_by_email: { seller: 'seller-5', buyer: 'buyer-5' },
  // seller-1 "List Property" holds PropertyDetailsForm — title number + HMLR pull.
  fetch_hmlr_title: { seller: 'seller-1' },
  lookup_title_number: { seller: 'seller-1' },
  // seller-3 "Property Info Forms" — where seller documents are filled in.
  upload_required_document: { seller: 'seller-3' },
};

/**
 * The stage the user is currently on, using the page's own definition
 * (TransactionFlowPage line ~531) rather than a second, divergent one.
 */
function currentStage(stages: readonly ResolvableStage[]): string | null {
  return stages.find((s) => s.status === 'active')?.id ?? stages[0]?.id ?? null;
}

/**
 * Resolve where a next-step action should take the user.
 *
 * Returns null ONLY when there are no stages to send them to — in which case
 * there is genuinely nowhere to go and the caller should not have rendered a
 * button in the first place.
 */
export function resolveNextStepDestination(
  action: string,
  journey: JourneyRole,
  stages: readonly ResolvableStage[],
): NextStepDestination | null {
  const precise = PRECISE[action as NextStepAction]?.[journey];
  if (precise && stages.some((s) => s.id === precise)) {
    return { stageId: precise, isFallback: false };
  }

  // Either the action has no precise home for this journey, or it does but
  // that stage is not visible on this transaction. Both mean "we do not know
  // exactly, but we still owe the user a response".
  const fallback = currentStage(stages);
  return fallback ? { stageId: fallback, isFallback: true } : null;
}
