// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Where the seller of an agent-led sale lands from their estate agent's
 * emailed invite. The deal's invite code is the buyer's only (Marc,
 * 2026-11-19), so the seller needs none: they sign in with the email the
 * invite went to and press one button. The button signs the principal proof
 * and calls the monorepo's record-party-role function, which hands them the
 * seller slot on chain. The click is never automatic, because mail scanners
 * open links.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import RequirePrincipal from '@/components/auth/RequirePrincipal';
import RequireProfile from '@/components/auth/RequireProfile';
import { useNoIndex } from '@/hooks/useNoIndex';
import { icpService } from '@/services/icp.service';
import { partyRoleService } from '@/services/partyRole.service';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { storePendingInviteUrl } from '@/utils/pendingInviteUrl';

const CTA_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E] disabled:opacity-60';
const SECONDARY_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-[#E5E7EB] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-[#1A1A1A] hover:bg-[#FAFAF8] dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800';

const WRONG_ACCOUNT = 'This invite is for someone else. Sign in with the email address your estate agent sent it to.';
const TRY_AGAIN = 'We could not hand the sale over to you just now. Try again in a moment.';

const ERROR_COPY: Record<string, string> = {
  email_unverified: 'Confirm your email address first. Open the confirmation email we sent you, then try again.',
  agent_flow_owns_roles: WRONG_ACCOUNT,
  not_a_principal_party: WRONG_ACCOUNT,
  transaction_not_found: 'We could not find this sale. Ask your estate agent to send the invite again.',
  rate_limited: 'Too many tries. Wait a few minutes, then try again.',
};

/** Why the canister refused the handover, in plain words (seller_handover.mo). */
function handoverRefusedCopy(detail: string | undefined): string {
  const reason = (detail ?? '').toLowerCase();
  if (reason.includes('already been handed over')) return 'This sale has already been handed over to its seller.';
  if (reason.includes('after contract exchange')) return 'Contracts have been exchanged, so the seller can no longer change.';
  if (reason.includes('buyer cannot')) return 'You are the buyer on this deal, so you cannot take it over as the seller.';
  return 'We could not hand this sale over to you. Ask your estate agent for help.';
}

function sellerAcceptErrorCopy(error: string, detail?: string): string {
  if (error === 'handover_refused') return handoverRefusedCopy(detail);
  return ERROR_COPY[error] ?? TRY_AGAIN;
}

function dealPath(transactionId: string): string {
  return `/transaction/${encodeURIComponent(transactionId)}/flow`;
}

function SellerInviteAccept({ transactionId }: { transactionId: string }): JSX.Element {
  const navigate = useNavigate();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Best-effort: before the handover the seller is usually not allowed to
  // read the deal, so the page reads fine without the address.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const tx = (await icpService.getTransaction(transactionId)) as { propertyAddress?: unknown } | null;
        if (active && tx && typeof tx.propertyAddress === 'string' && tx.propertyAddress) setAddress(tx.propertyAddress);
      } catch (err) {
        logger.info('seller invite: the deal is not readable before the handover', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [transactionId]);

  const accept = async (): Promise<void> => {
    setIsBusy(true);
    setError(null);
    const outcome = await partyRoleService.recordRoleFromChain(transactionId);
    if (outcome.ok) {
      navigate(dealPath(transactionId), { replace: true });
      return;
    }
    setError(sellerAcceptErrorCopy(outcome.error, outcome.detail));
    setIsBusy(false);
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-16" data-testid="seller-invite-page">
      <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Your sale</p>
      <h1 className="mt-1 font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
        {address ?? 'Take over your sale'}
      </h1>
      <p className="mt-4 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
        Your estate agent invited you to take over this sale. They stay on the deal as your agent.
      </p>
      <button type="button" className={`mt-8 ${CTA_CLASS}`} disabled={isBusy} onClick={() => void accept()}>
        {isBusy ? 'Taking over…' : 'Accept and take over as the seller'}
      </button>
      {error && (
        <p role="alert" className="mt-4 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">{error}</p>
      )}
    </div>
  );
}

function OneMoment(): JSX.Element {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">One moment…</p>
    </div>
  );
}

export default function SellerInvitePage(): JSX.Element {
  const { transactionId } = useParams<{ transactionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  useNoIndex();

  const isSignedOut = isInitialized && !isLoading && !isAuthenticated;

  // Signed out: keep this page as the place to come back to, then register
  // (or sign in from there), as JoinTransactionPage does for invitees.
  useEffect(() => {
    if (!isSignedOut || !transactionId) return;
    storePendingInviteUrl(location.pathname);
    const params = new URLSearchParams({ invite: transactionId, role: 'seller' });
    navigate(`/register?${params.toString()}`, { replace: true });
  }, [isSignedOut, transactionId, location.pathname, navigate]);

  if (!transactionId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">We could not find that invite</h1>
        <Link to="/dashboard" className={`mt-6 ${SECONDARY_CLASS}`}>Go to my dashboard</Link>
      </div>
    );
  }
  if (!isAuthenticated) return <OneMoment />;

  return (
    <RequirePrincipal>
      <RequireProfile>
        <SellerInviteAccept transactionId={transactionId} />
      </RequireProfile>
    </RequirePrincipal>
  );
}
