// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * One support ticket and its thread. The user's own words sit on the right,
 * ours on the left, and anything the assistant said is muted so it never reads
 * as a member of staff answering.
 *
 * The opening message is the ticket's own `body`, not a row in
 * `support_ticket_messages` — the create action stores it on the ticket. Every
 * reply goes through the function's `reply` action, which also reopens the
 * ticket, so the thread is re-read afterwards rather than patched by hand.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSidebar from '../../components/navigation/DashboardSidebar';
import DashboardHeader from '../../components/navigation/DashboardHeader';
import { BlockingPill, TicketStatusPill, formatWhen } from '../../components/support/TicketChrome';
import TicketMessageBubble from '../../components/support/TicketMessageBubble';
import { toThread } from '../../components/support/ticketThread';
import {
  MAX_BODY,
  categoryLabel,
  closeTicket,
  getTicket,
  replyToTicket,
  type SupportTicket,
  type SupportTicketMessage,
} from '../../services/supportTicket.service';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '@/utils/logger';

const CARD = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg';

interface ReplyBoxProps {
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

const ReplyBox: React.FC<ReplyBoxProps> = ({ disabled, onSend }) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="ticket-reply" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Your reply
      </label>
      <textarea
        id="ticket-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={MAX_BODY}
        disabled={disabled}
        placeholder="Add anything that would help us answer…"
        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <button
        type="submit"
        disabled={disabled || sending || body.trim().length === 0}
        className="min-h-[44px] rounded-lg bg-gray-700 px-6 py-2 font-semibold text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
};

const TicketPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const principalId = useAuthStore((s) => s.principalId);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ticketId: string): Promise<void> => {
    try {
      setError(null);
      const thread = await getTicket(ticketId);
      setTicket(thread.ticket);
      setMessages(thread.messages);
    } catch (e) {
      logger.error('Could not load support ticket:', e);
      setError('We could not load this ticket. It may not be yours, or it may have been removed.');
    }
  }, []);

  useEffect(() => {
    if (!useAuthStore.getState().isAuthenticated) {
      navigate('/login');
      return;
    }
    if (id) void load(id);
  }, [id, load, navigate]);

  const send = async (body: string): Promise<void> => {
    if (!id) return;
    try {
      await replyToTicket(id, body);
      await load(id);
    } catch (e) {
      logger.error('Could not send the reply:', e);
      setError('Your reply was not sent. Please try again.');
    }
  };

  const close = async (): Promise<void> => {
    if (!id) return;
    try {
      setTicket(await closeTicket(id));
    } catch (e) {
      logger.error('Could not close the ticket:', e);
      setError('We could not close this ticket. Please try again.');
    }
  };

  const closed = ticket?.status === 'closed';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={principalId ? { principal: principalId, id: principalId } : null} title="PropXchain" subtitle="Support ticket" />
      <div className="flex">
        <DashboardSidebar activeRoute="/dashboard/support" />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Link
              to="/dashboard/support/tickets"
              className="mb-6 inline-flex min-h-11 items-center text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Back to my tickets
            </Link>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                {error}
              </div>
            )}

            {!ticket && !error && <p className="text-gray-600 dark:text-gray-400">Loading this ticket…</p>}

            {ticket && (
              <>
                <div className={`${CARD} mb-6 p-6`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h2>
                    <div className="flex flex-wrap gap-2">
                      {ticket.blocks_transaction && <BlockingPill />}
                      <TicketStatusPill status={ticket.status} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {categoryLabel(ticket.category)} · Raised {formatWhen(ticket.created_at)}
                  </p>
                </div>

                <div className={`${CARD} mb-6 space-y-4 p-6`}>
                  {toThread(ticket, messages).map((bubble) => (
                    <TicketMessageBubble key={bubble.key} bubble={bubble} />
                  ))}
                </div>

                <div className={`${CARD} p-6`}>
                  {closed ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This ticket is closed. Raise a new one from the{' '}
                      <Link to="/dashboard/support" className="underline underline-offset-2">
                        Support Center
                      </Link>{' '}
                      if you need us again.
                    </p>
                  ) : (
                    <>
                      <ReplyBox disabled={false} onSend={send} />
                      <button
                        type="button"
                        onClick={() => void close()}
                        className="mt-4 min-h-[44px] text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      >
                        Close this ticket
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TicketPage;
