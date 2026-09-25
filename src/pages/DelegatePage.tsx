// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The confirm page a client lands on from the hand-over email (spec
 * docs/plans/2026-09-06-agent-crm-spec.md, R2.2). The email tap only signs
 * them in; the grant happens on the button here, because mail scanners open
 * links. Plain words, roles only, and the way out is on the same page.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DelegationError, grantDelegation, loadDelegationStatus, revokeDelegation, type DelegationOutcome, type DelegationStatus } from '@/services/delegation.service';
import { logger } from '@/utils/logger';

const CTA_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E] disabled:opacity-60';
const SECONDARY_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-[#E5E7EB] px-6 py-2.5 font-[DM_Sans] text-sm font-medium text-[#1A1A1A] hover:bg-[#FAFAF8] disabled:opacity-60 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800';

const ERROR_COPY: Record<string, string> = {
  wrong_party: 'This request was sent to the other side of the deal. Sign in with the account the email was sent to.',
  forbidden: 'This request was addressed to someone else.',
  join_failed: "We could not add you to the deal just now. Try again in a moment.",
  no_invite: 'Your agent needs to send you the invitation to the deal first.',
  agent_principal_unknown: 'Your agent is not on this deal yet. Ask them to open it once, then try again.',
  wrong_state: 'This request has already been answered.',
  unauthorized: 'Sign in with the account the email was sent to, then try again.',
  empty_response: 'Something went wrong. Try again in a moment.',
  request_failed: 'Something went wrong. Try again in a moment.',
};

function describeError(err: unknown): string {
  const code = err instanceof DelegationError ? err.code : 'request_failed';
  return ERROR_COPY[code] ?? ERROR_COPY.request_failed;
}

/** DealSide is seller | buyer: the buyer's side of a deal is their purchase. */
function sideWord(role: DelegationStatus['role']): string {
  return role === 'seller' ? 'sale' : 'purchase';
}

export default function DelegatePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<DelegationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('not_found');
      setIsLoading(false);
      return;
    }
    void (async () => {
      try {
        const s = await loadDelegationStatus(id);
        if (active) setStatus(s);
      } catch (err) {
        logger.warn('delegation status unavailable', err);
        if (active) setError(err instanceof DelegationError && err.code === 'not_found' ? 'not_found' : describeError(err));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const act = async (fn: () => Promise<DelegationOutcome>): Promise<void> => {
    if (!status) return;
    setIsBusy(true);
    setError(null);
    try {
      const outcome = await fn();
      // The outcome carries whether the ledger anchor is still being written.
      setStatus({ ...status, state: outcome.state, ledgerPending: outcome.ledgerPending });
    } catch (err) {
      logger.warn('delegation action failed', err);
      setError(describeError(err));
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">One moment…</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center" data-testid="delegate-missing">
        <h1 className="font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">We could not find that request</h1>
        <p className="mt-2 font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">
          {error === 'not_found' ? 'The link may be old, or the request may have been withdrawn.' : error}
        </p>
        <Link to="/dashboard" className={`mt-6 ${SECONDARY_CLASS}`}>Go to my dashboard</Link>
      </div>
    );
  }

  const where = status.propertyAddress ?? `your ${sideWord(status.role)}`;
  const dealLink = `/transaction/${encodeURIComponent(status.transactionId)}/flow`;

  return (
    <div className="mx-auto max-w-xl px-6 py-16" data-testid="delegate-page" data-state={status.state}>
      <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Your estate agent</p>
      {status.state === 'requested' && (
        <>
          <h1 className="mt-1 font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Let {status.agencyName} act for you on {where}?
          </h1>
          <ul className="mt-6 space-y-2 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
            <li>They can fill in forms, upload documents and order searches for you.</li>
            <li>Anything with legal weight still comes to you to confirm. Nothing is signed for you.</li>
            <li>Everything they do in your name is recorded, and you can withdraw this at any time.</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className={CTA_CLASS} disabled={isBusy} onClick={() => void act(() => grantDelegation(status.id))}>
              {isBusy ? 'Confirming…' : `Yes, let ${status.agencyName} act for me`}
            </button>
            <Link to="/dashboard" className={SECONDARY_CLASS}>Not now</Link>
          </div>
        </>
      )}
      {status.state === 'active' && (
        <>
          <h1 className="mt-1 font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {status.agencyName} can now act for you on {where}
          </h1>
          <p className="mt-4 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
            You will be asked to confirm anything that carries legal weight. Everything done in your name is on the deal&apos;s audit trail.
            {status.ledgerPending ? ' The record is being written now.' : ''}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={dealLink} className={CTA_CLASS}>Open my deal</Link>
            <button type="button" className={SECONDARY_CLASS} disabled={isBusy} onClick={() => void act(() => revokeDelegation(status.id))}>
              {isBusy ? 'Withdrawing…' : 'Withdraw this'}
            </button>
          </div>
        </>
      )}
      {status.state === 'revoked' && (
        <>
          <h1 className="mt-1 font-[Fraunces] text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {status.agencyName} no longer acts for you on {where}
          </h1>
          <p className="mt-4 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
            The withdrawal is on the deal&apos;s audit trail. Your agent can ask again if you change your mind.
          </p>
          <Link to={dealLink} className={`mt-8 ${CTA_CLASS}`}>Open my deal</Link>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 font-[DM_Sans] text-sm text-[#9A3412] dark:text-[#FDBA74]">{error}</p>
      )}
    </div>
  );
}
