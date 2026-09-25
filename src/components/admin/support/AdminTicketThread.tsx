// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The right pane of the support desk: one ticket, its thread, what triage
 * made of it, and the two things an admin can do — reply, or move its status.
 *
 * The bubbles follow the customer's own ticket screen: their words on the
 * right, ours on the left, and anything the assistant said muted so it never
 * reads as a member of staff having already answered. Keeping the two screens
 * identical means an admin is looking at what the customer is looking at.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { BlockingPill, TicketStatusPill, formatWhen } from '../../support/TicketChrome';
import TicketMessageBubble from '../../support/TicketMessageBubble';
import { ADMIN_AUTHOR_LABELS, toThread } from '../../support/ticketThread';
import {
  TICKET_STATUSES,
  categoryLabel,
  statusLabel,
  type SupportTicket,
  type SupportTicketMessage,
  type TicketStatus,
} from '../../../services/supportTicket.service';
import AdminReplyBox from './AdminReplyBox';
import TriageSummary from './TriageSummary';
import { UrgencyDots } from './TicketQueue';

const CARD = 'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800';

interface StatusSelectProps {
  status: string;
  disabled: boolean;
  onChange: (status: TicketStatus) => void;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ status, disabled, onChange }) => (
  <div className="flex items-center gap-2">
    <label htmlFor="admin-ticket-status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Status
    </label>
    <select
      id="admin-ticket-status"
      value={status}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TicketStatus)}
      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      {TICKET_STATUSES.map((value) => (
        <option key={value} value={value}>
          {statusLabel(value)}
        </option>
      ))}
    </select>
  </div>
);

interface AdminTicketThreadProps {
  ticket: SupportTicket;
  messages: readonly SupportTicketMessage[];
  isBusy: boolean;
  onReply: (body: string) => Promise<void>;
  onStatusChange: (status: TicketStatus) => void;
}

const AdminTicketThread: React.FC<AdminTicketThreadProps> = ({
  ticket,
  messages,
  isBusy,
  onReply,
  onStatusChange,
}) => (
  <section aria-label="Selected ticket" className="space-y-6">
    <header className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyDots urgency={ticket.urgency} />
          {ticket.blocks_transaction && <BlockingPill />}
          <TicketStatusPill status={ticket.status} />
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {categoryLabel(ticket.category)} · {ticket.name} · {ticket.email} · Raised {formatWhen(ticket.created_at)}
      </p>
      {ticket.transaction_id && (
        <p className="mt-1 text-sm">
          <Link
            to={`/transaction/${ticket.transaction_id}/flow`}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
          >
            Open transaction {ticket.transaction_id}
          </Link>
          {ticket.stage && <span className="text-gray-600 dark:text-gray-400"> · stage {ticket.stage}</span>}
        </p>
      )}
      {ticket.page_path && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">Raised from {ticket.page_path}</p>
      )}
    </header>

    <div className={CARD}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Triage</h3>
      <TriageSummary triage={ticket.triage} />
    </div>

    <div className={`${CARD} space-y-4`}>
      {toThread(ticket, messages).map((bubble) => (
        <TicketMessageBubble key={bubble.key} bubble={bubble} authorLabels={ADMIN_AUTHOR_LABELS} />
      ))}
    </div>

    <div className={`${CARD} space-y-4`}>
      <AdminReplyBox key={ticket.id} email={ticket.email} disabled={isBusy} onSend={onReply} />
      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
        <StatusSelect status={ticket.status} disabled={isBusy} onChange={onStatusChange} />
      </div>
    </div>
  </section>
);

export default AdminTicketThread;
