// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * How many support tickets are sitting unanswered — the badge on the link to
 * the support desk.
 *
 * Only `open` is counted. `awaiting_user` is a ticket the customer owes us a
 * reply on, so counting it would make a queue that is actually clear look like
 * work. The count is read with the function's own status filter rather than by
 * pulling the whole queue for a number.
 *
 * A failure is swallowed on purpose: the badge is decoration on a dashboard
 * that works without it, and an admin who is not on the desk's list gets a
 * 403 here that must not turn into an error banner on a page about something
 * else.
 */
import { useEffect, useState } from 'react';
import { MAX_LIST_LIMIT, listAdminTickets } from '../services/supportAdmin.service';

export function useOpenTicketCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listAdminTickets({ status: 'open', limit: MAX_LIST_LIMIT })
      .then((tickets) => {
        if (!cancelled) setCount(tickets.length);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}
