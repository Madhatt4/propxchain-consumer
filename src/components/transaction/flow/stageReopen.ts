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
 *  List Property (seller-1), the TA6/TA10/TA7 forms (seller-3) and Mortgage /
 *  Funding (buyer-2) reopen directly; funding lives in the Buyer Pack, so its
 *  edit re-opens pre-filled from the server. The provider stages (survey and
 *  the two conveyancer stages) also reopen, but only after a confirm: see
 *  CONFIRM_BEFORE_REOPEN_STAGE_IDS.
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

/** The provider stages: a subset of REOPENABLE_STAGE_IDS that need a
 *  ConfirmEditDialog before entering edit mode, because swapping a provider
 *  mid-transaction cancels the existing quote request. */
const CONFIRM_BEFORE_REOPEN_STAGE_IDS: ReadonlySet<string> = new Set(['buyer-3', 'seller-5', 'buyer-5']);

/** True when a completed stage offers "Review or update". */
export function canReopenStage(stageId: string): boolean {
  return REOPENABLE_STAGE_IDS.has(stageId);
}

/** True when reopening the stage must be confirmed first. */
export function reopenNeedsConfirm(stageId: string): boolean {
  return CONFIRM_BEFORE_REOPEN_STAGE_IDS.has(stageId);
}
