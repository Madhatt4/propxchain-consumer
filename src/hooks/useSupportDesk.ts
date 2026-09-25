// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The state behind the admin support desk: the queue, the selected thread,
 * and the two writes. Separate from the page so the rules — what a reply does
 * to the queue row, which error code says what — are testable without a
 * router or a rendered desk.
 *
 * The queue is read once, whole, and narrowed in the browser. Every write
 * answers with what it changed, so the row and the thread are patched from
 * that answer rather than by re-reading the list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  MAX_LIST_LIMIT,
  SupportAdminError,
  getAdminTicket,
  listAdminTickets,
  replyToAdminTicket,
  setTicketStatus,
  type AdminTicketSummary,
} from '../services/supportAdmin.service';
import type { SupportTicket, SupportTicketMessage, TicketStatus } from '../services/supportTicket.service';
import {
  ALL_QUEUE_FILTERS,
  DEFAULT_QUEUE_FILTERS,
  filterQueue,
  openTicketCount,
  replaceTicket,
  toggleQueueFilter,
} from '../components/admin/support/queue';

export interface UseSupportDeskResult {
  tickets: AdminTicketSummary[];
  visibleTickets: AdminTicketSummary[];
  openCount: number;
  filters: TicketStatus[];
  selectedId: string | null;
  ticket: SupportTicket | null;
  messages: SupportTicketMessage[];
  isQueueLoading: boolean;
  isThreadLoading: boolean;
  isBusy: boolean;
  error: string | null;
  /** The account can sign in but is not on the desk's admin list. */
  isForbidden: boolean;
  toggleFilter: (status: TicketStatus) => void;
  showAll: () => void;
  select: (id: string | null) => void;
  reply: (body: string) => Promise<void>;
  changeStatus: (status: TicketStatus) => Promise<void>;
  refresh: () => Promise<void>;
}

const MESSAGES: Record<string, string> = {
  forbidden: 'This account is not on the support desk admin list.',
  not_found: 'That ticket no longer exists.',
  rate_limited: 'Too many requests just now. Give it a moment and try again.',
  invalid_body: 'That reply is empty or too long to send.',
};

/** Turns a function error code into something an admin can act on. */
export function deskErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SupportAdminError) return MESSAGES[error.code] ?? fallback;
  return fallback;
}

export function useSupportDesk(enabled: boolean): UseSupportDeskResult {
  const [tickets, setTickets] = useState<AdminTicketSummary[]>([]);
  const [filters, setFilters] = useState<TicketStatus[]>([...DEFAULT_QUEUE_FILTERS]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setIsQueueLoading(true);
    try {
      const rows = await listAdminTickets({ limit: MAX_LIST_LIMIT });
      setTickets(rows);
      setError(null);
      setIsForbidden(false);
    } catch (e) {
      logger.error('Could not load the support queue:', e);
      setIsForbidden(e instanceof SupportAdminError && e.status === 403);
      setError(deskErrorMessage(e, 'We could not load the support queue.'));
    } finally {
      setIsQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const select = useCallback((id: string | null): void => {
    setSelectedId(id);
    setTicket(null);
    setMessages([]);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setIsThreadLoading(true);
    getAdminTicket(selectedId)
      .then((thread) => {
        if (cancelled) return;
        setTicket(thread.ticket);
        setMessages(thread.messages);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        logger.error('Could not load the ticket:', e);
        setError(deskErrorMessage(e, 'We could not load that ticket.'));
      })
      .finally(() => {
        if (!cancelled) setIsThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  /** Appends the stored reply and moves the row the function moved. */
  const reply = useCallback(
    async (body: string): Promise<void> => {
      if (!selectedId) return;
      setIsBusy(true);
      try {
        const result = await replyToAdminTicket(selectedId, body);
        setMessages((prev) => [...prev, result.message]);
        setTicket((prev) => (prev ? { ...prev, status: result.status, last_activity_at: result.message.created_at } : prev));
        setTickets((prev) =>
          replaceTicket(prev, {
            id: selectedId,
            status: result.status,
            last_activity_at: result.message.created_at,
          }),
        );
        setError(null);
      } catch (e) {
        logger.error('Could not send the reply:', e);
        setError(deskErrorMessage(e, 'Your reply was not sent. Try again.'));
        throw e;
      } finally {
        setIsBusy(false);
      }
    },
    [selectedId],
  );

  const changeStatus = useCallback(
    async (status: TicketStatus): Promise<void> => {
      if (!selectedId) return;
      setIsBusy(true);
      try {
        const updated = await setTicketStatus(selectedId, status);
        setTicket(updated);
        setTickets((prev) => replaceTicket(prev, updated));
        setError(null);
      } catch (e) {
        logger.error('Could not change the ticket status:', e);
        setError(deskErrorMessage(e, 'We could not move that ticket.'));
      } finally {
        setIsBusy(false);
      }
    },
    [selectedId],
  );

  const toggleFilter = useCallback((status: TicketStatus): void => {
    setFilters((prev) => toggleQueueFilter(prev, status));
  }, []);

  const showAll = useCallback((): void => {
    setFilters([...ALL_QUEUE_FILTERS]);
  }, []);

  const visibleTickets = useMemo(() => filterQueue(tickets, filters), [tickets, filters]);
  const openCount = useMemo(() => openTicketCount(tickets), [tickets]);

  return {
    tickets,
    visibleTickets,
    openCount,
    filters,
    selectedId,
    ticket,
    messages,
    isQueueLoading,
    isThreadLoading,
    isBusy,
    error,
    isForbidden,
    toggleFilter,
    showAll,
    select,
    reply,
    changeStatus,
    refresh,
  };
}
