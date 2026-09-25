// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "My tickets" — every support ticket the signed-in user has raised, newest
 * activity first. The ordering is the server's (`last_activity_at desc`), so a
 * ticket we have just answered surfaces without the user hunting for it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardSidebar from '../../components/navigation/DashboardSidebar';
import DashboardHeader from '../../components/navigation/DashboardHeader';
import { BlockingPill, TicketStatusPill, formatWhen } from '../../components/support/TicketChrome';
import { categoryLabel, listTickets, type SupportTicket } from '../../services/supportTicket.service';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '@/utils/logger';

const CARD = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg';

const TicketCard: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => (
  <Link
    to={`/dashboard/support/tickets/${ticket.id}`}
    className={`${CARD} block p-5 transition-colors hover:border-blue-400 dark:hover:border-blue-500`}
  >
    <div className="flex items-start justify-between gap-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">{ticket.subject}</h3>
      <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
        {ticket.blocks_transaction && <BlockingPill />}
        <TicketStatusPill status={ticket.status} />
      </div>
    </div>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
      {categoryLabel(ticket.category)} · Last activity {formatWhen(ticket.last_activity_at)}
    </p>
  </Link>
);

const EmptyState: React.FC = () => (
  <div className={`${CARD} p-8 text-center`}>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No tickets yet</h3>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
      Raise one from the support form and it will appear here with our replies.
    </p>
    <Link
      to="/dashboard/support"
      className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
    >
      Submit a support request
    </Link>
  </div>
);

const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const principalId = useAuthStore((s) => s.principalId);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setTickets(await listTickets());
    } catch (e) {
      logger.error('Could not load support tickets:', e);
      setError('We could not load your tickets. Please try again.');
    }
  }, []);

  useEffect(() => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void load();
  }, [load, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={principalId ? { principal: principalId, id: principalId } : null} title="PropXchain" subtitle="My tickets" />
      <div className="flex">
        <DashboardSidebar activeRoute="/dashboard/support" />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">My tickets</h2>
                <p className="text-gray-600 dark:text-gray-400">Everything you have raised with us, and where each one stands.</p>
              </div>
              <Link
                to="/dashboard/support"
                className="inline-flex min-h-11 items-center text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Back to Support Center
              </Link>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                {error}{' '}
                <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">
                  Retry
                </button>
              </div>
            )}

            {tickets === null && !error && <p className="text-gray-600 dark:text-gray-400">Loading your tickets…</p>}
            {tickets !== null && tickets.length === 0 && <EmptyState />}
            {tickets !== null && tickets.length > 0 && (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TicketListPage;
