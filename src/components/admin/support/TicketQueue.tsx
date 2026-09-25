// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The left pane of the support desk: the filter chips and the queue itself.
 *
 * Urgency is drawn as dots rather than a number. The customer-facing ticket
 * screens hide it altogether — it is a triage score, not a promise about
 * response time — but on the desk it is exactly what decides what gets
 * answered next, so it earns a place here and nowhere else.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { BlockingPill, TicketStatusPill, formatWhen } from '../../support/TicketChrome';
import { categoryLabel, type TicketStatus } from '../../../services/supportTicket.service';
import type { AdminTicketSummary } from '../../../services/supportAdmin.service';
import { QUEUE_FILTERS, isShowingAll } from './queue';

const MAX_URGENCY = 3;

const CHIP_BASE =
  'inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors';
const CHIP_ON = 'border-blue-600 bg-blue-600 text-white';
const CHIP_OFF =
  'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

/** 0-3 filled dots. Labelled for screen readers, which cannot count dots. */
export const UrgencyDots: React.FC<{ urgency: number }> = ({ urgency }) => {
  const filled = Math.min(MAX_URGENCY, Math.max(0, Math.round(urgency)));
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Urgency ${filled} of ${MAX_URGENCY}`}>
      {Array.from({ length: MAX_URGENCY }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${
            i < filled ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
      ))}
    </span>
  );
};

interface FilterChipsProps {
  selected: readonly TicketStatus[];
  onToggle: (status: TicketStatus) => void;
  onShowAll: () => void;
}

const FilterChips: React.FC<FilterChipsProps> = ({ selected, onToggle, onShowAll }) => {
  const all = isShowingAll(selected);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter the queue by status">
      {QUEUE_FILTERS.map((filter) => {
        const on = selected.includes(filter.id);
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(filter.id)}
            className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
          >
            {filter.label}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={all}
        onClick={onShowAll}
        className={`${CHIP_BASE} ${all ? CHIP_ON : CHIP_OFF}`}
      >
        All
      </button>
    </div>
  );
};

interface QueueRowProps {
  ticket: AdminTicketSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * The transaction link sits beside the row rather than inside it. The row is
 * a button, and a link nested in a button is neither valid HTML nor reachable
 * by keyboard, so the one control that leaves the desk gets its own.
 */
const QueueRow: React.FC<QueueRowProps> = ({ ticket, isSelected, onSelect }) => (
  <li
    className={`rounded-lg border transition-colors ${
      isSelected
        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
        : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500'
    }`}
  >
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      aria-current={isSelected ? 'true' : undefined}
      className="w-full p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UrgencyDots urgency={ticket.urgency} />
          <span className="truncate font-semibold text-gray-900 dark:text-white">{ticket.subject}</span>
        </div>
        <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
          {ticket.blocks_transaction && <BlockingPill />}
          <TicketStatusPill status={ticket.status} />
        </div>
      </div>
      <p className="mt-2 truncate text-sm text-gray-600 dark:text-gray-400">
        {categoryLabel(ticket.category)} · {ticket.email}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        {formatWhen(ticket.last_activity_at)}
        {ticket.message_count > 0 && ` · ${ticket.message_count} repl${ticket.message_count === 1 ? 'y' : 'ies'}`}
      </p>
    </button>
    {ticket.transaction_id && (
      <p className="px-4 pb-3 text-xs">
        <Link
          to={`/transaction/${ticket.transaction_id}/flow`}
          className="text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
        >
          Transaction {ticket.transaction_id}
        </Link>
      </p>
    )}
  </li>
);

interface TicketQueueProps {
  tickets: readonly AdminTicketSummary[];
  selectedId: string | null;
  filters: readonly TicketStatus[];
  isLoading: boolean;
  onToggleFilter: (status: TicketStatus) => void;
  onShowAll: () => void;
  onSelect: (id: string) => void;
}

const TicketQueue: React.FC<TicketQueueProps> = ({
  tickets,
  selectedId,
  filters,
  isLoading,
  onToggleFilter,
  onShowAll,
  onSelect,
}) => (
  <section aria-label="Support queue" className="space-y-4">
    <FilterChips selected={filters} onToggle={onToggleFilter} onShowAll={onShowAll} />

    {isLoading && <p className="text-sm text-gray-600 dark:text-gray-400">Loading the queue…</p>}

    {!isLoading && tickets.length === 0 && (
      <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Nothing in this queue. Try another filter.
      </p>
    )}

    {tickets.length > 0 && (
      <ul className="space-y-3">
        {tickets.map((ticket) => (
          <QueueRow key={ticket.id} ticket={ticket} isSelected={ticket.id === selectedId} onSelect={onSelect} />
        ))}
      </ul>
    )}
  </section>
);

export default TicketQueue;
