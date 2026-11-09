/**
 * Which completed stages a client can reopen through the stage card's
 * "Review or update" button, and which of those need a confirm first.
 *
 * Reopening only puts the stage into edit mode (useTransactionFlow's
 * editingStageIds): it never un-completes the stage and writes nothing by
 * itself. The stage component then renders its input UI again with current
 * values, and anything saved from there is the user's own action.
 *
 * Real deals change after a stage is ticked: a corrected TA6, a renewed
 * mortgage offer (live test 2026-11-09 on tx_1791543160237401939 found no way
 * back into either panel once its stage had collapsed to a one-line summary).
 */

/** Stage IDs whose content components understand the `isEditing` prop and
 *  re-render their input UI with current values pre-filled.
 *
 *  Tier A — provider stages: edits trigger a ConfirmEditDialog because
 *  swapping a provider mid-transaction cancels the existing quote request.
 *  Tier B (TA6/TA10/TA7 forms) and Tier C (Mortgage/Funding) reopen directly —
 *  funding lives in the Buyer Pack so the edit re-opens pre-filled from the server.
 *  Exchange (seller-6/buyer-6) and Completion (seller-7/buyer-7) stay out:
 *  their completion is a chain fact, and nothing in their panels may undo it. */
const REOPENABLE_STAGE_IDS: ReadonlySet<string> = new Set([
  'seller-1', // List Property
  // seller-2 (Searches) intentionally omitted: the stage-card edit
  // doesn't re-render SearchesPanel content (browser-harness confirmed
  // 2026-05-21). Its edit lives in the panel's OrderConfirmation card as a
  // "Re-order searches" link, which calls onClearProvider.
  'seller-3', // TA6/TA10/TA7 forms: replace an upload, edit online, Check my answers
  'buyer-2',  // Mortgage / Funding: wallet send, offer expiry and its AI read
  'buyer-3',  // Survey
  // Conveyancer stages keep their confirm-gated edit: it re-opens the estimate
  // request only. The joined firm is read from the chain and edit mode
  // cannot remove it, so the stage stays complete.
  'seller-5',
  'buyer-5',
]);

/** Subset of REOPENABLE_STAGE_IDS that need a ConfirmEditDialog before
 *  entering edit mode, because a change has real-world consequences
 *  (cancelling a provider's quote request, etc.). */
const CONFIRM_BEFORE_REOPEN_STAGE_IDS: ReadonlySet<string> = new Set(['buyer-3', 'seller-5', 'buyer-5']);

/** True when a completed stage offers "Review or update". */
export function canReopenStage(stageId: string): boolean {
  return REOPENABLE_STAGE_IDS.has(stageId);
}

/** True when reopening the stage must be confirmed first. */
export function reopenNeedsConfirm(stageId: string): boolean {
  return CONFIRM_BEFORE_REOPEN_STAGE_IDS.has(stageId);
}
