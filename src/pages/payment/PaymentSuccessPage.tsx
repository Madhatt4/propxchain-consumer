/**
 * Payment Success Page
 * Handles the Stripe redirect after a successful add-on payment (HMLR title
 * pull, VMC chain unlock, search order):
 * - Waits for auth store to initialize (restores ICP identity)
 * - Verifies session via Worker
 * - Routes back to the transaction that started the checkout, else dashboard
 *
 * Creating a transaction is free (2026-10-15), so no checkout ends here with a
 * transaction still to create.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stripePaymentService } from '@/services/stripePayment.service';
import { useAuthStore } from '@/stores/authStore';
import { loadSearchPendingState } from '@/services/searchCheckoutResume';
import { loadChainUnlockPendingState } from '@/services/chainUnlockCheckoutResume';
import { logger } from '@/utils/logger';

export default function PaymentSuccessPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string>('');

  const isInitialized = useAuthStore((s) => s.isInitialized);

  // Wait for auth store to initialize before processing payment
  useEffect(() => {
    if (!isInitialized) return;

    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      navigate('/dashboard', { replace: true });
      return;
    }

    processPayment(sessionId);
  }, [isInitialized]);

  async function processPayment(sessionId: string): Promise<void> {
    const principalId = useAuthStore.getState().principalId;

    if (!principalId) {
      localStorage.setItem('onboardingComplete', 'true');
      navigate('/dashboard', { replace: true });
      return;
    }

    try {
      // Step 1: Verify payment via Worker
      setStatus('verifying');
      logger.info('Verifying Stripe session:', sessionId);

      const verification = await stripePaymentService.verifySession(sessionId);

      if (!verification.verified) {
        logger.warn('Payment not verified, redirecting to dashboard anyway');
        navigate('/dashboard', { replace: true });
        return;
      }

      logger.info('Payment verified:', verification);

      // Tier-aware routing — HMLR title pulls return to their originating
      // transaction page so HMLRTitlePullButton can resume the flow via
      // the ?hmlr_stripe_session_id query param. Other tiers fall through
      // to the existing transaction-creation logic below.
      if (verification.tier === 'hmlr-pull') {
        const pendingRaw = localStorage.getItem('propxchain.hmlr.pull.pending');
        if (!pendingRaw) {
          // No client-side pending state (e.g. user paid on phone, opened
          // dashboard on laptop). Route to dashboard; user re-clicks the
          // title button which will detect the unconsumed paid session
          // and resume rather than charging again.
          logger.warn('HMLR pull paid but no pending state on this device — routing to dashboard');
          navigate('/dashboard', { replace: true });
          return;
        }
        try {
          const pending = JSON.parse(pendingRaw) as { transactionId: string };
          navigate(
            `/transaction/${pending.transactionId}?hmlr_stripe_session_id=${sessionId}`,
            { replace: true },
          );
        } catch {
          logger.error('Could not parse HMLR pending state, falling back to dashboard');
          navigate('/dashboard', { replace: true });
        }
        return;
      }

      // VMC chain-unlock checkout (ChainUnlockButton, one-off £25 per
      // transaction) routes back to its originating transaction page the
      // same way — ChainUnlockButton's own resume effect (mounted there)
      // reads this same pending-state stash to verify the session and
      // reveal the live chain. Mirrors the search-order branch immediately
      // below (Stripe's success_url is a single URL for every session type,
      // so this page is always the first stop regardless of what was being
      // checked out).
      if (verification.type === 'chain-unlock') {
        const pending = loadChainUnlockPendingState();
        if (!pending) {
          // No client-side pending state (e.g. user paid on phone, opened
          // dashboard on laptop). Route to dashboard — same rationale as
          // the search-order and HMLR-pull cases below.
          logger.warn('Chain-unlock paid but no pending state on this device — routing to dashboard');
          navigate('/dashboard', { replace: true });
          return;
        }
        navigate(
          `/transaction/${pending.transactionId}?vmc_stripe_session_id=${sessionId}`,
          { replace: true },
        );
        return;
      }

      // Search-order checkout (OneSearch/Groundsure via SearchesPanel,
      // Task 9) routes back to its originating transaction page the same
      // way — SearchesPanel's own resume effect (mounted there) re-verifies
      // the session and reads this same pending-state stash to rebuild its
      // confirmation UI and running total. Stripe's success_url is a single
      // URL for every session type, so this page is always the first stop
      // regardless of what was being checked out.
      if (verification.type === 'search') {
        const pending = loadSearchPendingState();
        if (!pending) {
          // No client-side pending state (e.g. user paid on phone, opened
          // dashboard on laptop). Route to dashboard — SearchesPanel's own
          // orphan-recovery path only fires when its pending stash exists
          // on this device, so there's nowhere useful to send them without
          // it, same as the hmlr-pull case above.
          // A client who paid from the emailed link (agent CRM) has no stash
          // either: their agent's screen settles the order. Send them to the
          // deal so they see it, not to an unrelated dashboard.
          if (verification.onBehalfOf && verification.transactionId) {
            navigate(`/transaction/${verification.transactionId}`, { replace: true });
            return;
          }
          logger.warn('Search checkout paid but no pending state on this device — routing to dashboard');
          navigate('/dashboard', { replace: true });
          return;
        }
        navigate(
          `/transaction/${pending.transactionId}?search_stripe_session_id=${sessionId}`,
          { replace: true },
        );
        return;
      }

      // Any other session type has nowhere specific to return to.
      setStatus('success');
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);

    } catch (err: unknown) {
      logger.error('Payment processing error:', err);
      // Even on error, redirect to dashboard — payment was already taken
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Processing error');
      setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        {(status === 'verifying' || !isInitialized) && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verifying Payment
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we confirm your payment...
            </p>
          </div>
        )}

        {status === 'success' && isInitialized && (
          <div className="text-center">
            <div className="text-green-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Successful!
            </h2>
            <div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Payment confirmed! Redirecting to dashboard...
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === 'error' && isInitialized && (
          <div className="text-center">
            <div className="text-yellow-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Received
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your payment was successful but we could not confirm it just now.
              Your order is safe; open the transaction from the dashboard.
            </p>
            <p className="text-xs text-red-500 mb-4">{error}</p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
