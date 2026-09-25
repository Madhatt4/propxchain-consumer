// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Who owes the next action on a conveyancing matter.
 *
 * A conveyancer with thirty matters opens the portal to ask one question:
 * which of these is blocked on *me*, and which is blocked on somebody else.
 * The list previously answered neither — it showed address, price, status and
 * a milestone label in whatever order the transactions arrived.
 *
 * Derived from the transaction status plus the conveyancer's own generated
 * documents, both of which the list already has: status comes with the
 * transaction, and TR1/AP1 presence is read from localStorage. Deliberately
 * no per-matter document fetch — answering this for a whole desk would
 * otherwise cost one ICP round-trip per matter on every list render.
 *
 * The mapping follows ConveyancerDashboard's own five-step Workflow so the
 * list and the detail view cannot disagree about whose move it is:
 *
 *   1 Review seller documents  — seller uploads        -> others
 *   2 Prepare TR1              — conveyancer generates -> you
 *   3 Confirm exchange         — conveyancer confirms  -> you
 *   4 Prepare AP1              — conveyancer generates -> you
 *   5 Submit to HMLR           — conveyancer submits   -> you
 *
 * 'others' covers both the seller and third parties (search providers): for
 * ordering they are the same thing — not your move. The existing milestone
 * label already says which, so nothing is lost by grouping them here.
 */
export type WaitingOn = 'you' | 'others' | 'done';

interface ConveyancerDocState {
  /** TR1 transfer deed generated or uploaded by the conveyancer. */
  hasTR1: boolean;
  /** AP1 application generated or uploaded by the conveyancer. */
  hasAP1: boolean;
}

export function getWaitingOn(status: string, docs: ConveyancerDocState): WaitingOn {
  switch (status) {
    // Registered at HM Land Registry — the end of the line, nothing owed.
    case 'land_registry_registered':
      return 'done';

    // Completion recorded. Done only once the AP1 is actually in; until then
    // step 5 is still the conveyancer's to submit.
    case 'blockchain_completed':
      return docs.hasAP1 ? 'done' : 'you';

    // Post-exchange: steps 4 and 5, both the conveyancer's.
    case 'exchanged':
    case 'completion_initiated':
      return 'you';

    // Pre-exchange: the seller owes documents and searches sit with the
    // provider. The chain has no "contract prep" state, so the TR1 step is
    // read from the documents on the matter, not from here.
    case 'active':
      return 'others';

    // An unrecognised status must not claim the conveyancer owes something we
    // cannot identify — that would push a matter to the top of their desk on
    // a guess. Sort it with the rest and let the milestone label speak.
    default:
      return 'others';
  }
}

/** Sort weight: what needs you first, then what does not, then what is finished. */
const ORDER: Record<WaitingOn, number> = { you: 0, others: 1, done: 2 };

/**
 * Order matters by whose move it is; inside each group the longest wait first
 * (stall attribution, spec 2026-09-05, surface 3), then the original order so
 * the list does not reshuffle on every poll. `waitDaysOf` is optional: without
 * it the groups keep arrival order, as before.
 */
export function sortByWaitingOn<T>(
  items: readonly T[],
  waitingOnOf: (item: T) => WaitingOn,
  waitDaysOf?: (item: T) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byGroup = ORDER[waitingOnOf(a.item)] - ORDER[waitingOnOf(b.item)];
      if (byGroup !== 0) return byGroup;
      const byWait = (waitDaysOf?.(b.item) ?? 0) - (waitDaysOf?.(a.item) ?? 0);
      return byWait !== 0 ? byWait : a.index - b.index;
    })
    .map(({ item }) => item);
}
