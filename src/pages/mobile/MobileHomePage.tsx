// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import NextStepCard from '@/components/common/NextStepCard';
import FaceIdToggle from '@/components/mobile/FaceIdToggle';
import { TRANSACTION_STATUS_LABEL, toTransactionStatus } from '@/types/transactionStatus';
import { useMobileTransactions } from './useMobileTransactions';

const LINK_BUTTON =
  'flex min-h-11 items-center justify-center rounded-lg border border-sage-light/40 bg-white px-4 py-2 font-sans text-sm font-medium text-stone-900 transition-colors hover:border-sage-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100';

/**
 * The home screen of the phone app: one question per transaction, "what
 * happens next". It reuses NextStepCard, which is driven by the canister's
 * rules engine, so the app and the website can never give different answers.
 *
 * Rendered at `/app`. After sign-in the router sends the native app here
 * instead of the desktop-style dashboard (see decideRoute).
 */
const MobileHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useMobileTransactions();

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-900" data-testid="mobile-home">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <header>
          <p className="font-sans text-xs uppercase tracking-wide text-stone-500 dark:text-slate-400">
            PropXchain
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight text-stone-900 dark:text-gray-100">
            What happens next
          </h1>
          <p className="mt-1 font-sans text-sm text-stone-600 dark:text-slate-300">
            The next step on each of your transactions.
          </p>
        </header>

        {isLoading && (
          <div
            role="status"
            aria-label="Loading your transactions"
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" aria-hidden />
          </div>
        )}

        {isError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
          >
            <p className="font-display font-medium">Couldn't load your transactions</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-rose-300 bg-white px-4 font-sans text-sm font-medium text-rose-900"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <section
            data-testid="mobile-home-empty"
            className="rounded-lg border border-sage-light/40 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <h2 className="font-display text-lg text-stone-900 dark:text-gray-100">
              You have no transactions yet
            </h2>
            <p className="mt-1 font-sans text-sm text-stone-600 dark:text-slate-300">
              Start a sale, or join one you have been invited to.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/start-transaction" className={LINK_BUTTON}>
                Start a sale
              </Link>
              <Link to="/join" className={LINK_BUTTON}>
                Join with an invite
              </Link>
            </div>
          </section>
        )}

        {!isLoading &&
          !isError &&
          data &&
          data.map((tx) => (
            <article
              key={tx.id}
              data-testid="mobile-home-transaction"
              className="flex flex-col gap-3 rounded-lg border border-sage-light/40 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <header className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg leading-tight text-stone-900 dark:text-gray-100">
                  {tx.propertyAddress || 'Property address not set'}
                </h2>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 font-sans text-xs font-medium text-stone-700 dark:bg-slate-700 dark:text-slate-300">
                  {TRANSACTION_STATUS_LABEL[toTransactionStatus(tx.status)]}
                </span>
              </header>
              <NextStepCard
                txId={tx.id}
                variant="compact"
                onAction={() => navigate(`/transaction/${tx.id}/flow`)}
              />
              <Link to={`/transaction/${tx.id}/flow`} className={LINK_BUTTON}>
                Open transaction
              </Link>
            </article>
          ))}
        <FaceIdToggle />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mx-auto flex max-w-md">
          <Link
            to="/dashboard/my-documents"
            className="flex min-h-14 flex-1 items-center justify-center font-sans text-sm font-medium text-stone-700 dark:text-slate-200"
          >
            Documents
          </Link>
          <Link
            to="/notifications"
            className="flex min-h-14 flex-1 items-center justify-center font-sans text-sm font-medium text-stone-700 dark:text-slate-200"
          >
            Notifications
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default MobileHomePage;
