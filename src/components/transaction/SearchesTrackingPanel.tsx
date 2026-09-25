// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Searches tracking panel (Ship 4c).
 *
 * Shows the seven standard UK conveyancing searches with their typical
 * return windows, validity periods, and current status derived from the
 * transaction's audit event stream. Read-only surface for users who want
 * to understand the search lifecycle — does not interact with the
 * provider-selection SearchesPanel at components/providers/.
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { icpService } from '../../services/icp.service';
import {
  deriveSearchesState,
  earliestExpiry,
  orderedCount,
  type SearchState,
} from '../../services/searchesService';

interface SearchesTrackingPanelProps {
  transactionId: string;
  /** Test override — skip the fetch and render these states directly. */
  statesOverride?: SearchState[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function SearchesTrackingPanel({
  transactionId,
  statesOverride,
}: SearchesTrackingPanelProps): ReactElement | null {
  const [states, setStates] = useState<SearchState[] | null>(statesOverride ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(statesOverride === undefined);

  useEffect(() => {
    if (statesOverride !== undefined) {
      setStates(statesOverride);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const eventsResult = await icpService.ledgerManager?.getEventsByTransaction(transactionId);
        if (cancelled) return;

        const events = Array.isArray(eventsResult)
          ? eventsResult.map((e) => ({
              eventType: String(e.eventType ?? ''),
              timestamp: normaliseTimestamp(Number(e.timestamp ?? 0)),
            }))
          : [];

        // Don't render the searches table before it's actionable. UK
        // conveyancing searches are a buyer-side / solicitor-side concern
        // ordered after the buyer joins and instructs their conveyancer.
        // Showing 7 "Not ordered" rows on a fresh sellerPrep transaction is
        // clutter — users see it before they can do anything about it.
        const searchesOrdered = events.some((e) => e.eventType === 'searches_ordered');
        if (!searchesOrdered) {
          setStates([]);
          setIsLoading(false);
          return;
        }

        setStates(deriveSearchesState(events, Date.now()));
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setStates(null);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId, statesOverride]);

  if (isLoading) {
    return (
      <div
        className="mb-4 h-24 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-hidden="true"
      />
    );
  }

  // Hidden entirely when no searches have been ordered yet (sellerPrep /
  // buyerSetup phases). The panel re-appears once a searches_ordered audit
  // event fires — at that point the tracking info is actionable.
  if (!states || states.length === 0) return null;

  const ordered = orderedCount(states);
  const nextExpiry = earliestExpiry(states);
  const daysUntilEarliest =
    nextExpiry !== null ? Math.max(0, Math.floor((nextExpiry - Date.now()) / DAY_MS)) : null;

  return (
    <section
      className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3"
      aria-label="Property searches tracking"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Property searches
        </span>
        <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
          {ordered} of {states.length} ordered
          {daysUntilEarliest !== null && ordered > 0 && (
            <>
              {' '}· earliest expiry in {daysUntilEarliest}d
            </>
          )}
        </span>
      </div>
      <ul className="space-y-2">
        {states.map((s) => (
          <li
            key={s.id}
            className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-50">
                {s.label}
              </span>
              <StatusBadge status={s.status} />
            </div>
            <p className="mt-0.5 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
              {s.description}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
              <span>
                Typical return:{' '}
                <span className="text-gray-700 dark:text-gray-300">{s.typicalReturnDays}d</span>
              </span>
              <span>
                Validity:{' '}
                <span className="text-gray-700 dark:text-gray-300">{s.validityDays}d</span>
              </span>
              {s.daysUntilExpiry !== null && s.status !== 'notOrdered' && (
                <span>
                  Expires in{' '}
                  <span className="text-gray-700 dark:text-gray-300">{s.daysUntilExpiry}d</span>
                </span>
              )}
            </div>
            {s.conditional && (
              <p className="mt-1 font-[DM_Sans] text-xs italic text-gray-400 dark:text-gray-500">
                {s.conditional}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: SearchState['status'] }): ReactElement {
  const { label, classes } = statusLabelAndClasses(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-[DM_Sans] text-xs font-medium ${classes}`}
      aria-label={`search status ${status}`}
    >
      {label}
    </span>
  );
}

function statusLabelAndClasses(status: SearchState['status']): { label: string; classes: string } {
  switch (status) {
    case 'notOrdered':
      return { label: 'Not ordered', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
    case 'ordered':
      return {
        label: 'Ordered',
        classes: 'bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]',
      };
    case 'expiringSoon':
      return { label: 'Expiring soon', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
    case 'expired':
      return { label: 'Expired', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  }
}

function normaliseTimestamp(ts: number): number {
  return ts > 4_102_444_800_000 ? Math.floor(ts / 1_000_000) : ts;
}

export default SearchesTrackingPanel;
