// PropXchain — SPDX-License-Identifier: Proprietary
import { useCallback, useEffect, useState } from 'react';
import { isChainUnlocked } from '@/services/chainEntitlement.service';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { logger } from '@/utils/logger';

/**
 * Sentinel thrown by the poll loop below when isChainUnlocked still reads
 * false — distinguishes "keep retrying, grant not propagated yet" from any
 * other unexpected failure inside the retry loop.
 */
class GrantPropagationPendingError extends Error {}

export type GrantStatus = 'idle' | 'polling' | 'delayed';

export interface ChainGrantPoll {
  grantStatus: GrantStatus;
  /** Call after a Stripe-verified chain-unlock payment to start polling. */
  startPolling: () => void;
  /** Reset to idle, e.g. when the transaction being viewed changes. */
  reset: () => void;
}

/**
 * Polls the on-chain vmc-chain entitlement after a Stripe-verified payment
 * (bounded backoff, ~8s) instead of trusting the client-side redirect
 * immediately.
 *
 * The £25 grant is written by the async Stripe webhook, which can land a
 * beat after Stripe's own redirect+verify completes. Firing the paid VMC
 * proxy call (getChain) the instant the redirect is verified risks racing
 * that webhook — the proxy's own entitlement check would read the
 * not-yet-propagated grant and hard-402. Resolving only once isChainUnlocked
 * itself confirms true preserves the "no VMC call until paid" invariant
 * instead of merely trusting the redirect.
 */
export function useChainGrantPoll(transactionId: string, onConfirmed: () => void): ChainGrantPoll {
  const [grantStatus, setGrantStatus] = useState<GrantStatus>('idle');

  useEffect(() => {
    if (grantStatus !== 'polling') return;
    let active = true;
    retryWithBackoff<true>(
      async () => {
        const isEntitled = await isChainUnlocked(transactionId);
        if (!isEntitled) throw new GrantPropagationPendingError('vmc-chain grant not yet propagated');
        return true;
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 3000,
        jitter: false,
        isRetryable: (e) => e instanceof GrantPropagationPendingError,
      },
    )
      .then(() => {
        if (!active) return;
        onConfirmed();
        setGrantStatus('idle');
      })
      .catch((e: unknown) => {
        logger.warn('Chain-unlock grant did not propagate within the retry window', e);
        if (active) setGrantStatus('delayed');
      });
    return () => { active = false; };
  }, [grantStatus, transactionId, onConfirmed]);

  return {
    grantStatus,
    startPolling: useCallback(() => setGrantStatus('polling'), []),
    reset: useCallback(() => setGrantStatus('idle'), []),
  };
}
