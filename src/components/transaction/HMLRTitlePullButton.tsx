// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * HMLR Title Pull Button — Tier 1 entry point.
 *
 * Drops into the transaction property-details view. Handles the complete
 * "get a title report" flow:
 *
 *   click → Stripe £7 → return → verify (mints the pull credit) → pull
 *                                  ├── success → render
 *                                  ├── unregistered → refund + default msg
 *                                  └── HMLR error → refund + retry prompt
 *
 * Every pull is paid for, and the server enforces it: the proxy claims the
 * paid session's one-use credit before it contacts HMLR, and
 * /refund-session only refunds a credit that never delivered a register
 * (security scan 2026-09-23, H1). The old "premium entitled → free pull"
 * branch is gone: nobody held that grant and the server does not honour it.
 *
 * Stripe pattern: standard auto-capture Checkout (existing worker behaviour),
 * refund on non-success outcomes. Manual-capture migration is a Tier 2
 * polish item — auto-refund is fine at launch volume since the only
 * realistic refund trigger is the unregistered-property case.
 *
 * State across the Stripe redirect lives in localStorage under
 * HMLR_PENDING_KEY so we can resume after the user returns to PropXchain
 * — even if they closed the tab during the Stripe flow and opened a
 * fresh one. Pending state expires after PENDING_STATE_TTL_MS so we
 * don't accumulate orphans if the user abandons checkout entirely.
 *
 * Edge cases handled:
 *   - Happy path: PaymentSuccessPage redirects with ?hmlr_stripe_session_id
 *     → button useEffect detects, resumes immediately
 *   - Closed tab before PaymentSuccessPage redirect: user reopens, no
 *     URL param, but localStorage has pending state → button verifies
 *     session is paid on mount, resumes automatically
 *   - Double-click on the button: pending state existing blocks a new
 *     checkout from being created until pending is consumed or expires
 *   - Different browser entirely: localStorage doesn't transfer, user
 *     re-clicks button — currently kicks off a NEW £7 checkout. Server-
 *     side unconsumed-session detection is a Tier 2 cleanup item.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { icpService } from '@/services/icp.service';
import {
  hmlrTitleService,
  HmlrPullError,
  type HmlrTitlePullResult,
} from '@/services/hmlrTitle.service';
import stripePaymentService, {
  type VerifySessionResult,
} from '@/services/stripePayment.service';
import HMLRRegisterView from '@/components/documents/HMLRRegisterView';
import { logger } from '@/utils/logger';
import { supabase } from '@/lib/supabase';
import {
  claimResume,
  clearPendingState,
  getPendingTitlePull,
  hasPendingTitlePull,
  isResumeInFlight,
  loadPendingState,
  onResumeReleased,
  releaseResume,
  savePendingState,
  type PendingTitlePull,
} from '@/services/hmlrPullPending';

// ============================================
// PROPS
// ============================================

export interface HMLRTitlePullButtonProps {
  titleNumber: string;
  transactionId: string;
  /** Called once a pull succeeds — for parent-side dashboard refresh, optional */
  onSuccess?: (result: HmlrTitlePullResult) => void;
  /** Override the £7 default for tests; not surfaced in production UI */
  feeGbp?: number;
  /**
   * 'compact' renders the idle button as a text link ("Get it for £7") for a
   * Sales pack row. Flow, payment and modals are identical to 'default'.
   */
  variant?: 'default' | 'compact';
}

// ============================================
// CONSTANTS
// ============================================

const PULL_FEE_GBP_DEFAULT = 7;
const STRIPE_TIER = 'hmlr-pull';
const RETURN_QUERY_PARAM = 'hmlr_stripe_session_id';

const DEFAULT_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400';
// Matches the Sales pack row actions (PackRow ACTION).
const COMPACT_BUTTON_CLASS =
  'whitespace-nowrap text-[13px] font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline dark:text-teal-300';

/**
 * Phrases the HMLR proxy surfaces when a title isn't registered. Keep
 * patterns lowercase; we lowercase the incoming message before testing.
 */
const UNREGISTERED_TITLE_PATTERNS = [
  'no matching title',
  'title not found',
  'title number does not exist',
  'not registered',
  'no record',
];

// ============================================
// STATE TYPES
// ============================================

type FlowStatus =
  | 'idle'
  | 'redirecting-to-stripe'
  | 'returning-from-stripe'
  | 'pulling'
  | 'success'
  | 'unregistered'
  | 'cannot-deliver'
  | 'queued'
  | 'error';

/** Terminal failure statuses a resolved pull can land on. */
type PullFailureStatus = 'unregistered' | 'cannot-deliver' | 'queued' | 'error';

/** busy = another button (or tab) holds the deal's resume claim. */
type ResumeOutcome = 'resumed' | 'not-paid' | 'busy';

// ============================================
// HELPERS
// ============================================

function looksUnregistered(message: string): boolean {
  const lower = message.toLowerCase();
  return UNREGISTERED_TITLE_PATTERNS.some((pattern) =>
    lower.includes(pattern),
  );
}

/**
 * Map a thrown pull error to its terminal UI status. The service throws a
 * typed HmlrPullError with a stable `cause` for non-deliverable HMLR
 * TypeCodes (20 cannot-deliver, 10 queued); genuine "not registered" is
 * detected by message pattern; everything else is a generic error.
 */
function classifyPullFailure(err: unknown): PullFailureStatus {
  if (err instanceof HmlrPullError) {
    if (err.cause === 'hmlr_cannot_deliver') return 'cannot-deliver';
    if (err.cause === 'hmlr_queued') return 'queued';
    if (looksUnregistered(err.message)) return 'unregistered';
  }
  return 'error';
}

function readStripeSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(RETURN_QUERY_PARAM);
}

function stripReturnParamFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(RETURN_QUERY_PARAM);
  window.history.replaceState({}, '', url.toString());
}

/** Whether the Checkout Session is paid for a title pull; unverifiable reads as not paid. */
async function isSessionPaid(sessionId: string): Promise<boolean> {
  try {
    const verification: VerifySessionResult = await stripePaymentService.verifySession(sessionId);
    return verification.verified && verification.tier === STRIPE_TIER;
  } catch (err) {
    // Session not yet paid, expired, or unverifiable. Leave pending state in
    // place — user may be mid-payment elsewhere — and let the TTL clean up.
    logger.info('Pending HMLR session not yet paid', {
      sessionId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Refund a completed Stripe session via the payment worker. Surfaces a
 * warning instead of throwing so we don't lose the user-facing "your card
 * was not charged" promise — manual ops can pick up the rare orphans.
 */
async function refundStripeSession(sessionId: string): Promise<boolean> {
  const workerUrl = import.meta.env.VITE_PAYMENT_WORKER_URL;
  if (!workerUrl) {
    logger.warn(
      'Cannot refund: VITE_PAYMENT_WORKER_URL not configured',
      { sessionId },
    );
    return false;
  }
  try {
    // Payment worker (audit #47) requires Supabase JWT. Read session here
    // rather than throw — refund is a best-effort cleanup; if the user
    // has no Supabase session the refund just falls back to manual ops.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      logger.warn('Cannot refund: no Supabase session for Authorization', { sessionId });
      return false;
    }
    const response = await fetch(`${workerUrl}/refund-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) {
      logger.error('Stripe refund failed', {
        sessionId,
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Stripe refund call errored', { sessionId, err });
    return false;
  }
}

// ============================================
// COMPONENT
// ============================================

export default function HMLRTitlePullButton({
  titleNumber,
  transactionId,
  onSuccess,
  feeGbp = PULL_FEE_GBP_DEFAULT,
  variant = 'default',
}: HMLRTitlePullButtonProps): JSX.Element {
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [result, setResult] = useState<HmlrTitlePullResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [needsRefund, setNeedsRefund] = useState<boolean>(false);
  // True when localStorage has unconsumed pending pull state for this
  // transaction. Used to switch the button into "resume" mode and to
  // block double-charge via a fresh checkout.
  const [hasPendingPull, setHasPendingPull] = useState<boolean>(false);
  // True when a completed pull marker exists for this (transaction,
  // title) pair in localStorage. Drives the "View existing Title" path
  // so users who already paid don't get re-charged on revisit.
  const [hasExistingPull, setHasExistingPull] = useState<boolean>(false);
  // Synchronous guard: the resume-pending branch awaits verifySession before
  // any status change disables the button, so a fast double click could
  // otherwise run two checkouts or two resumes.
  const isClickInFlight = useRef(false);
  // Another button or tab is resuming this deal's paid pull; wait for it.
  const [isWaitingOnResume, setWaitingOnResume] = useState<boolean>(false);
  // Held in a ref so a caller's inline onSuccess does not re-create the
  // resume callbacks and re-run the mount-time resume effect every render.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const trimmedTitleNumber = titleNumber.trim().toUpperCase();
  const titleNumberLooksValid = /^[A-Z]{1,3}\d{1,6}$/.test(trimmedTitleNumber);

  /**
   * Verify the paid session and pull. Only ever called by resumeAfterStripe,
   * which holds the deal's resume claim for the whole of it.
   */
  const pullPaidSession = useCallback(
    async (stripeSessionId: string, pending: PendingTitlePull): Promise<void> => {
      setStatus('returning-from-stripe');
      stripReturnParamFromUrl();

      try {
        // Verifying the paid session also mints its pull credit — the
        // browser usually gets here before Stripe's webhook does.
        await stripePaymentService.verifySession(stripeSessionId);
        setStatus('pulling');
        const pullResult = await hmlrTitleService.pullTitleRegister(
          pending.titleNumber,
          pending.transactionId,
          { stripeSessionId },
        );
        clearPendingState();
        setHasPendingPull(false);
        setResult(pullResult);
        setStatus('success');
        setHasExistingPull(true); // mark cached so re-clicks view, not re-pay
        onSuccessRef.current?.(pullResult);
      } catch (err) {
        clearPendingState();
        setHasPendingPull(false);
        const message =
          err instanceof Error ? err.message : String(err);

        // Route to the right modal by failure kind. The classifier handles
        // non-deliverable HMLR TypeCodes (20 cannot-deliver, 10 queued) via
        // the typed cause, genuine "not registered" by message pattern, and
        // everything else as a generic error. Every paid-flow failure
        // refunds the £7 — the user never pays for a report they can't see.
        setErrorMessage(message);
        setStatus(classifyPullFailure(err));
        setNeedsRefund(true);
        const refunded = await refundStripeSession(stripeSessionId);
        setNeedsRefund(!refunded);
      }
    },
    [],
  );

  /**
   * Resume after Stripe return. The claim is taken synchronously, before any
   * verifySession, and released only after the pull and any refund settle,
   * so a second mounted button can never verify, pull or refund the same
   * session. `shouldCheckPaid` first confirms the session is paid (the
   * orphan and manual-resume paths); the URL-return path skips it.
   */
  const resumeAfterStripe = useCallback(
    async (stripeSessionId: string, pending: PendingTitlePull, shouldCheckPaid: boolean): Promise<ResumeOutcome> => {
      if (!claimResume(pending.transactionId)) {
        setHasPendingPull(true);
        setWaitingOnResume(true);
        return 'busy';
      }
      try {
        if (shouldCheckPaid && !(await isSessionPaid(stripeSessionId))) return 'not-paid';
        await pullPaidSession(stripeSessionId, pending);
        return 'resumed';
      } finally {
        releaseResume(pending.transactionId);
      }
    },
    [pullPaidSession],
  );

  // When another button's resume for this deal settles, pick up its outcome:
  // no longer pending, and (on success) a pull to view rather than re-buy.
  useEffect(() => {
    return onResumeReleased(transactionId, () => {
      setWaitingOnResume(isResumeInFlight(transactionId));
      setHasPendingPull(hasPendingTitlePull(transactionId));
      if (hmlrTitleService.hasCompletedPull(transactionId, trimmedTitleNumber)) {
        setHasExistingPull(true);
        return;
      }
      void hmlrTitleService
        .findPullByTitleNumber(trimmedTitleNumber)
        .then((row) => { if (row) setHasExistingPull(true); })
        .catch(() => undefined);
    });
  }, [transactionId, trimmedTitleNumber]);

  // Detect post-Stripe return on mount.
  //
  // Two paths:
  //   1. URL has ?hmlr_stripe_session_id=... (PaymentSuccessPage just
  //      redirected the user here) — resume immediately.
  //   2. URL is clean but localStorage has pending state matching this
  //      transaction — user closed the tab during the Stripe flow and
  //      came back later. Verify the session is paid; if yes, resume.
  //      If not yet paid, leave pending state in place (the user might
  //      be mid-payment in another tab) — the button just stays idle.
  // Mount-time + title-change: surface a "View existing Title" affordance.
  // Two-stage check:
  //   1. Sync localStorage marker (this transaction, this device) — fast,
  //      handles the close-modal-then-click-again flow within the session.
  //   2. Async Supabase query against the hmlr_pulls index — finds pulls
  //      this same user did under any other transaction or browser, so a
  //      title that's been pulled once never gets re-charged to the same
  //      user. RLS scopes the query to auth.uid().
  useEffect(() => {
    let cancelled = false;
    const localHit = hmlrTitleService.hasCompletedPull(transactionId, trimmedTitleNumber);
    setHasExistingPull(localHit);

    // Skip the async lookup if the title number isn't valid yet (avoids
    // a network round trip on every keystroke) or we've already hit
    // locally.
    if (localHit || !titleNumberLooksValid) return;

    void hmlrTitleService
      .findPullByTitleNumber(trimmedTitleNumber)
      .then((row) => {
        if (cancelled || !row) return;
        setHasExistingPull(true);
      })
      .catch(() => {
        // Silent — fall back to the £7 path
      });

    return () => {
      cancelled = true;
    };
  }, [transactionId, trimmedTitleNumber, titleNumberLooksValid]);

  useEffect(() => {
    const stripeSessionId = readStripeSessionIdFromUrl();
    const pending = loadPendingState();

    if (stripeSessionId) {
      if (!pending || pending.transactionId !== transactionId) {
        logger.warn('Stripe return query param present but no matching pending state', {
          stripeSessionId,
          transactionId,
          hasPending: Boolean(pending),
        });
        stripReturnParamFromUrl();
        return;
      }
      void resumeAfterStripe(stripeSessionId, pending, false);
      return;
    }

    // No URL param. Check for orphaned-but-paid pending state; if it is
    // paid, resume (resumeAfterStripe verifies under the claim).
    if (pending && pending.transactionId === transactionId) {
      setHasPendingPull(true);
      if (pending.sessionId) void resumeAfterStripe(pending.sessionId, pending, true);
    }
  }, [transactionId, resumeAfterStripe]);

  // Main click handler
  const runClick = useCallback(async () => {
    if (!titleNumberLooksValid) {
      setStatus('error');
      setErrorMessage(
        `Title number "${titleNumber}" is not in the expected HMLR ` +
          `format (1-3 letters then 1-6 digits, e.g. GR506405).`,
      );
      return;
    }

    // "View existing Title" path — a previous pull exists for this
    // title (either local marker for this transaction, or a row in
    // hmlr_pulls for any of the user's transactions). Re-load and
    // re-render without charging. If neither source can re-fetch the
    // file, fall through to the paid flow so the user isn't stuck.
    if (hasExistingPull && !hasPendingPull) {
      setStatus('pulling');
      try {
        // Try local first (same transaction, this device).
        let existing = await hmlrTitleService.loadExistingTitlePull(
          transactionId,
          trimmedTitleNumber,
        );
        // Fall back to the cross-transaction index in Supabase.
        if (!existing) {
          const row = await hmlrTitleService.findPullByTitleNumber(trimmedTitleNumber);
          if (row) {
            existing = await hmlrTitleService.loadPullByIndexRow(row);
          }
        }
        if (existing) {
          setResult(existing);
          setStatus('success');
          return;
        }
        logger.warn(
          'View existing Title: marker / index hit but file fetch returned null; falling back to fresh pull',
        );
        setHasExistingPull(false);
        setStatus('idle');
      } catch (err) {
        logger.warn('View existing Title: cache load threw; falling back', err);
        setHasExistingPull(false);
        setStatus('idle');
      }
      // Falls through to the paid flow below.
    }

    // Resume-pending path: if localStorage has pending state for this
    // transaction, try to resume it before kicking off a new checkout.
    // Avoids double-charging if the user paid in another tab and came
    // back. Cleared TTL ensures stale states don't block legitimate
    // re-pulls forever.
    const existingPending = getPendingTitlePull(transactionId);
    if (existingPending) {
      // A mount-time resume (here or in another tab) already holds the
      // claim: never clear its record or open a second checkout.
      if (isResumeInFlight(transactionId)) {
        setWaitingOnResume(true);
        return;
      }
      if (existingPending.sessionId) {
        const outcome = await resumeAfterStripe(existingPending.sessionId, existingPending, true);
        if (outcome !== 'not-paid') return;
      }
      // Pending state exists but unrecoverable. Clear and start fresh.
      clearPendingState();
      setHasPendingPull(false);
    }

    setErrorMessage('');
    setResult(null);
    setNeedsRefund(false);

    // Paid flow — Stripe → return → pull
    setStatus('redirecting-to-stripe');
    try {
      const userPrincipal = await icpService.getUserPrincipal();
      // Use prepareCheckoutSession so we capture sessionId BEFORE the
      // redirect. Lets us stash it in pending state so the orphan
      // auto-resume path can verify the session later if the user
      // closes the tab during Stripe checkout.
      const { sessionId, url } =
        await stripePaymentService.prepareCheckoutSession({
          principalId: userPrincipal,
          tier: STRIPE_TIER,
          amount: feeGbp,
        });
      const isSaved = savePendingState({
        titleNumber: trimmedTitleNumber,
        transactionId,
        startedAt: new Date().toISOString(),
        sessionId,
      });
      // Without the pending record the return cannot resume the pull, so
      // never send the user to pay (pre-extraction this threw here too).
      if (!isSaved) throw new Error('this browser would not save the pull, so it could not continue after payment');
      setHasPendingPull(true);
      window.location.href = url;
      // Control does not return after the redirect.
    } catch (err) {
      clearPendingState();
      setHasPendingPull(false);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Payment setup failed: ${message}`);
      setStatus('error');
    }
  }, [
    resumeAfterStripe,
    titleNumberLooksValid,
    trimmedTitleNumber,
    titleNumber,
    transactionId,
    feeGbp,
    // State the handler now branches on. Without these in the deps the
    // useCallback closure captures the initial `false` and the "View
    // existing Title" path never fires when the async mount effect
    // promotes hasExistingPull to true.
    hasExistingPull,
    hasPendingPull,
  ]);

  const handleClick = useCallback(async () => {
    if (isClickInFlight.current) return;
    isClickInFlight.current = true;
    try {
      await runClick();
    } finally {
      isClickInFlight.current = false;
    }
  }, [runClick]);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
    setResult(null);
    setNeedsRefund(false);
    // Defensive — if a flow completed without explicit pending clear,
    // ensure the resume-pending UI doesn't get stuck on.
    if (loadPendingState() === null) {
      setHasPendingPull(false);
    }
  }, []);

  // ============================================
  // RENDER
  // ============================================

  const busy =
    isWaitingOnResume ||
    status === 'redirecting-to-stripe' ||
    status === 'returning-from-stripe' ||
    status === 'pulling';

  const buttonLabel = (() => {
    switch (status) {
      case 'redirecting-to-stripe':
        return 'Redirecting to payment…';
      case 'returning-from-stripe':
        return 'Confirming payment…';
      case 'pulling':
        return 'Pulling title from HM Land Registry…';
      default:
        if (isWaitingOnResume) return 'Confirming payment…';
        if (hasPendingPull) return 'Resume pending title pull';
        if (hasExistingPull) return 'View existing Title';
        return variant === 'compact' ? `Get it for £${feeGbp}` : `Get Title Report — £${feeGbp}`;
    }
  })();

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !titleNumberLooksValid}
        className={variant === 'compact' ? COMPACT_BUTTON_CLASS : DEFAULT_BUTTON_CLASS}
      >
        {buttonLabel}
      </button>

      {!titleNumberLooksValid && titleNumber.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Title number format looks wrong. Expected: 1-3 letters then 1-6
          digits, e.g. GR506405.
        </p>
      )}

      {status === 'unregistered' && (
        <Modal onClose={reset}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This property is not registered with HM Land Registry
          </h2>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            About 15% of land in England &amp; Wales remains unregistered —
            typically older rural properties, land that hasn't changed
            hands since 1990, or some leasehold edge cases.{' '}
            {needsRefund ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Your card was charged but our automatic refund did not
                complete. Please contact support quoting the title number
                so we can refund manually.
              </span>
            ) : (
              <span className="font-medium">
                Your £{feeGbp} has been refunded.
              </span>
            )}
          </p>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            If you believe this is an error, double-check the title number
            and try again. If the property genuinely has no registered
            title, your conveyancer can advise — first registration may be
            possible.
          </p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Reference: {errorMessage}
          </p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {status === 'cannot-deliver' && (
        <Modal onClose={reset}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This title can't be delivered electronically
          </h2>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            HM Land Registry holds a record for this property, but it's a
            paper-only or pre-digital title that can't be returned through the
            online service. An Official Copy (OC1) can be ordered by post —
            your conveyancer can arrange this.{' '}
            {needsRefund ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Your card was charged but our automatic refund did not
                complete. Please contact support quoting the title number so we
                can refund manually.
              </span>
            ) : (
              <span className="font-medium">
                Your £{feeGbp} has been refunded.
              </span>
            )}
          </p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Reference: {errorMessage}</p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {status === 'queued' && (
        <Modal onClose={reset}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            HM Land Registry is temporarily unavailable
          </h2>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            The Land Registry service is out-of-hours or briefly queued, so we
            couldn't retrieve the title right now. This usually clears within a
            few minutes.{' '}
            {needsRefund ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Your card was charged but our automatic refund did not
                complete. Please contact support so we can refund manually.
              </span>
            ) : (
              <span className="font-medium">
                Your £{feeGbp} has been refunded — you won't be charged unless a
                report is delivered.
              </span>
            )}
          </p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Reference: {errorMessage}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleClick}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </Modal>
      )}

      {status === 'error' && (
        <Modal onClose={reset}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Title report couldn't be generated
          </h2>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            {errorMessage || 'An unexpected error occurred.'}
          </p>
          {needsRefund && (
            <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-400">
              Your card was charged but our automatic refund did not
              complete. Please contact support so we can refund manually.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleClick}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </Modal>
      )}

      {status === 'success' && result && (
        <Modal onClose={reset} wide>
          {result.warnings.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Audit warnings</p>
              <ul className="mt-1 list-disc pl-5">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <HMLRRegisterView
            register={result.register}
            responseHash={result.responseHash}
            canisterDocId={result.canisterDocId}
          />
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================
// LIGHTWEIGHT MODAL — replace with your project's modal component
// when one is settled on. Self-contained here so the button has no
// hard dependency on a shadcn/ui or radix Dialog import.
// ============================================

function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      // z-[60] beats TopBar's z-50 + backdrop-blur stacking context, which
      // was clipping the top of tall modals (the HMLR Official Copy is
      // ~3000px tall — the title number and "A. PROPERTY" section were
      // hidden behind the sticky header).
      // items-start + pt-8 lets long modals scroll from the top so the
      // user can read the header sections first instead of starting
      // mid-document.
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-8 sm:pt-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[calc(100vh-4rem)] w-full overflow-y-auto rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl ${
          wide ? 'max-w-5xl' : 'max-w-lg'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
