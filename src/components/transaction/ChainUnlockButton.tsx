// PropXchain — SPDX-License-Identifier: Proprietary
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import stripePaymentService, { type VerifySessionResult } from '@/services/stripePayment.service';
import {
  VMC_STRIPE_SESSION_PARAM,
  loadChainUnlockPendingState,
  saveChainUnlockPendingState,
  clearChainUnlockPendingState,
} from '@/services/chainUnlockCheckoutResume';
import { logger } from '@/utils/logger';

const RETURN_PARAM = VMC_STRIPE_SESSION_PARAM;
const PRICE_GBP = 25;

type Status = 'idle' | 'redirecting' | 'confirming' | 'error';

const loadPending = loadChainUnlockPendingState;
const savePending = saveChainUnlockPendingState;
const clearPending = clearChainUnlockPendingState;
function readReturnParam(): string | null { return new URLSearchParams(window.location.search).get(RETURN_PARAM); }
function stripReturnParam(): void {
  const u = new URL(window.location.href); u.searchParams.delete(RETURN_PARAM);
  window.history.replaceState({}, '', u.toString());
}

export interface ChainUnlockButtonProps {
  transactionId: string;
  principalId: string;
  onUnlocked: () => void;
}

export function ChainUnlockButton({ transactionId, principalId, onUnlocked }: ChainUnlockButtonProps): JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>('');

  const confirm = useCallback(async (sessionId: string) => {
    setStatus('confirming');
    stripReturnParam();
    try {
      const v: VerifySessionResult = await stripePaymentService.verifySession(sessionId);
      if (v.verified && v.type === 'chain-unlock') { clearPending(); onUnlocked(); return; }
      setStatus('error'); setError('Payment could not be confirmed.');
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : 'Payment confirmation failed');
    }
  }, [onUnlocked]);

  // Passive orphan-resume: a pending stash exists but there's no
  // ?vmc_stripe_session_id in the URL, so this mount is NOT a fresh return
  // from Stripe — it's just a later visit to the transaction page (the user
  // may simply have abandoned checkout). An unverified result here is the
  // normal/expected case, not a failure worth surfacing: unlike confirm()
  // above (used on the active return path, where the URL param proves the
  // user just came back from Stripe), this must never flip status to
  // 'error' — that would reopen a persistent "Payment could not be
  // confirmed" banner on every mount for up to the 24h pending TTL. Verify
  // once (no double-verifySession — same rule M2 established for confirm()),
  // resume silently on a genuine confirmation, otherwise leave the pending
  // stash for the TTL to clean up and stay on the normal idle CTA. Mirrors
  // HMLRTitlePullButton.tsx / SearchesPanel.tsx's orphan-recovery branches.
  const confirmPassively = useCallback(async (sessionId: string) => {
    try {
      const v: VerifySessionResult = await stripePaymentService.verifySession(sessionId);
      if (v.verified && v.type === 'chain-unlock') { clearPending(); onUnlocked(); }
    } catch (e) {
      logger.info('Pending chain-unlock not yet paid', e);
    }
  }, [onUnlocked]);

  // Resume after Stripe: URL param, or an orphaned-but-paid pending session.
  useEffect(() => {
    const sid = readReturnParam();
    const pending = loadPending();
    if (sid && pending && pending.transactionId === transactionId) { void confirm(sid); return; }
    if (sid) { stripReturnParam(); return; }
    if (pending && pending.transactionId === transactionId && pending.sessionId) {
      void confirmPassively(pending.sessionId);
    }
  }, [transactionId, confirm, confirmPassively]);

  const handleClick = useCallback(async () => {
    setStatus('redirecting'); setError('');
    try {
      const { sessionId, url } = await stripePaymentService.prepareChainUnlockCheckoutSession({
        principalId, transactionId,
      });
      savePending({ transactionId, startedAt: new Date().toISOString(), sessionId });
      window.location.href = url; // control does not return
    } catch (e) {
      clearPending();
      setStatus('error'); setError(e instanceof Error ? e.message : 'Payment setup failed');
    }
  }, [principalId, transactionId]);

  const busy = status === 'redirecting' || status === 'confirming';
  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        {status === 'redirecting' ? 'Redirecting to payment…'
          : status === 'confirming' ? 'Confirming payment…'
          : `Unlock live chain — £${PRICE_GBP}`}
      </button>
      {status === 'error' && <p className="text-xs text-amber-700">{error}</p>}
    </div>
  );
}
