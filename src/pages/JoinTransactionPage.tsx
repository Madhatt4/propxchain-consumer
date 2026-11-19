import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import TransactionInvite from '../components/TransactionInvite';
import { readInviteContext } from '@/utils/inviteContext';
import { storePendingInviteUrl } from '@/utils/pendingInviteUrl';
import { Transaction } from '../types/transaction.types';

// shadcn-ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/utils/logger';
import { useIsAuthenticated as useStoreIsAuthenticated } from '../stores/authStore';
import { Logo } from '@/components/brand/Logo';
import { normaliseInviteCode } from '@/utils/inviteCode';

/**
 * Seller invites emailed before 2026-11-19 open /join/<code>?role=seller. The
 * code is the buyer's only now (Marc, 2026-11-19), so such a link goes to the
 * seller's accept page for its deal instead. Null when the code no longer
 * resolves (a buyer has used it up), or the lookup fails.
 */
async function sellerInviteTransactionId(code: string): Promise<string | null> {
  try {
    const { icpService } = await import('../services/icp.service');
    await icpService.initialize();
    const tx = (await icpService.getTransactionByInviteCode(normaliseInviteCode(code) ?? code)) as { id?: unknown } | null;
    return tx && tx.id !== undefined && tx.id !== null ? String(tx.id) : null;
  } catch (err) {
    logger.warn('JoinTransactionPage: old seller link did not resolve', err);
    return null;
  }
}

const JoinTransactionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const storeIsAuthenticated = useStoreIsAuthenticated();
  const [isReady, setIsReady] = useState(false);
  const [initialInviteCode, setInitialInviteCode] = useState<string>('');
  const rightmoveUrl = searchParams.get('rm') || undefined;
  const inviteContext = readInviteContext(searchParams);
  const isOldSellerLink = inviteContext.role === 'seller' && Boolean(id);
  const [isSellerLinkStale, setIsSellerLinkStale] = useState(false);

  useEffect(() => {
    if (!storeIsAuthenticated || !isOldSellerLink || !id) return;
    let active = true;
    void (async () => {
      const transactionId = await sellerInviteTransactionId(decodeURIComponent(id));
      if (!active) return;
      if (transactionId) navigate(`/seller-invite/${encodeURIComponent(transactionId)}`, { replace: true });
      else setIsSellerLinkStale(true);
    })();
    return () => {
      active = false;
    };
  }, [storeIsAuthenticated, isOldSellerLink, id, navigate]);

  useEffect(() => {
    if (!storeIsAuthenticated) {
      // Not logged in - store invite code for after login, then redirect.
      // pendingInviteCode is kept for back-compat with anything still
      // reading just the bare code; pendingInviteUrl carries the full
      // path + role/side/by/rm query string so the post-login seam can
      // send the user straight back to this exact invite.
      logger.info('JoinTransactionPage: Not authenticated, redirecting to login');
      if (id) {
        localStorage.setItem('pendingInviteCode', id);
      }
      storePendingInviteUrl(location.pathname + location.search);
      // Invitees register properly (name, email, password, role) rather than
      // signing in; the role from the agent's link pre-selects the picker.
      const registerParams = new URLSearchParams();
      if (id) registerParams.set('invite', id);
      if (inviteContext.role) registerParams.set('role', inviteContext.role);
      navigate(`/register?${registerParams.toString()}`);
      return;
    }

    logger.info('JoinTransactionPage: Authenticated, showing page');
    setIsReady(true);

    // Check for pending invite code (from before login redirect)
    const pendingCode = localStorage.getItem('pendingInviteCode');
    if (pendingCode) {
      setInitialInviteCode(pendingCode);
      localStorage.removeItem('pendingInviteCode');
    } else if (id) {
      // Use invite code from URL
      setInitialInviteCode(decodeURIComponent(id));
    }
  }, [id, storeIsAuthenticated, navigate, location.pathname, location.search, inviteContext.role]);

  const handleJoinSuccess = (_transaction: Transaction) => {
    // Navigate to the main dashboard where the joined transaction will appear
    navigate('/dashboard');
  };

  if (isReady && isOldSellerLink) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          {isSellerLinkStale ? (
            <>
              <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">This invite link is out of date</h1>
              <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
                Ask your estate agent to send you the invite again.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => navigate('/dashboard')}>Go to my dashboard</Button>
            </>
          ) : (
            <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">One moment…</p>
          )}
        </main>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-4 text-center">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Back to Dashboard
              </Button>
              <div>
                <Logo variant="mark" tone="onLight" to="/" className="h-11 w-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Join Transaction</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Join a Transaction
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            You've been invited to join a property transaction on PropXchain
          </p>
        </div>

        {/* TransactionInvite Component - pre-filled with invite code if available */}
        <TransactionInvite
          onJoinSuccess={handleJoinSuccess}
          onClose={() => navigate('/dashboard')}
          initialCode={initialInviteCode}
          rightmoveUrl={rightmoveUrl}
        />

        {/* Information Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>What happens when I join?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>You'll be added to the transaction as a participant with your selected role</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>You can view transaction progress and milestones in real-time</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Upload and share documents securely on the blockchain</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Communicate with other parties while maintaining GDPR compliance</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Sign contracts electronically when ready</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="border-2 mt-6">
          <CardContent className="p-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Secure & Private
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your data is encrypted and stored on the Internet Computer blockchain. Only authorized
                  participants can access transaction details. Your Internet Identity ensures secure authentication
                  without passwords.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default JoinTransactionPage;
