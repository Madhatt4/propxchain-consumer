// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The support desk. Route: `/admin/support`.
 *
 * Tickets get their own desk rather than a tab on the DevOps board because
 * the board has no PropXchain session, so it could never call the function
 * that emails the customer — board replies reached nobody. Here the admin is
 * already signed in, so every reply goes out as an email as well as a thread
 * message.
 *
 * The gate below decides which screen renders, nothing more. Who may read or
 * answer a ticket is decided by the function against the verified session, so
 * an admin here who is not on its list gets a plain 403 and is told so.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import TicketQueue from '../../components/admin/support/TicketQueue';
import AdminTicketThread from '../../components/admin/support/AdminTicketThread';
import { useSupportDesk } from '../../hooks/useSupportDesk';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { usePrincipalId } from '../../stores/authStore';
import { isAdminPrincipal } from '../../constants/adminPrincipals';

const PANE = 'min-w-0';

const Placeholder: React.FC = () => (
  <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-600">
    <p className="text-sm text-gray-600 dark:text-gray-400">
      Pick a ticket from the queue to read it and answer.
    </p>
  </div>
);

const SupportDeskPage: React.FC = () => {
  const navigate = useNavigate();
  const principalId = usePrincipalId();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  // The env allowlist is the same fallback the admin dashboard keeps for when
  // the canister query fails transiently, so the desk cannot be the one admin
  // screen that locks out on a bad round trip.
  const isAllowed = isAdmin || isAdminPrincipal(principalId);

  const desk = useSupportDesk(isAllowed);

  useEffect(() => {
    if (!isAdminLoading && !isAllowed) navigate('/dashboard');
  }, [isAdminLoading, isAllowed, navigate]);

  if (!isAllowed) return null;

  const hasSelection = desk.selectedId !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppTopBar title="Support desk" backTo="/admin" backLabel="Back to admin dashboard" isAdmin />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support desk</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Every customer ticket, most urgent first. Replying here emails the customer.
          </p>
        </div>

        {desk.error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
          >
            {desk.error}{' '}
            {!desk.isForbidden && (
              <button
                type="button"
                onClick={() => void desk.refresh()}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-6">
          {/* Mobile shows one pane at a time; the desk is two panes from lg up. */}
          <div className={`${PANE} ${hasSelection ? 'hidden lg:block' : 'block'}`}>
            <TicketQueue
              tickets={desk.visibleTickets}
              selectedId={desk.selectedId}
              filters={desk.filters}
              isLoading={desk.isQueueLoading}
              onToggleFilter={desk.toggleFilter}
              onShowAll={desk.showAll}
              onSelect={desk.select}
            />
          </div>

          <div className={`${PANE} ${hasSelection ? 'mt-0 block' : 'hidden lg:block'}`}>
            {hasSelection && (
              <button
                type="button"
                onClick={() => desk.select(null)}
                className="mb-4 inline-flex min-h-11 items-center text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900 lg:hidden dark:text-gray-300 dark:hover:text-white"
              >
                Back to the queue
              </button>
            )}

            {!hasSelection && <Placeholder />}
            {hasSelection && desk.isThreadLoading && !desk.ticket && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading this ticket…</p>
            )}
            {desk.ticket && (
              <AdminTicketThread
                ticket={desk.ticket}
                messages={desk.messages}
                isBusy={desk.isBusy}
                onReply={desk.reply}
                onStatusChange={(status) => void desk.changeStatus(status)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SupportDeskPage;
