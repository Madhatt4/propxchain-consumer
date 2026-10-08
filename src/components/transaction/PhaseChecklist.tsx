// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Phase Checklist display (Ship 4a).
 *
 * Shows the 3–5 key actions for the current phase, each marked completed or
 * pending based on audit-event derivation. Sits inside the PhaseIndicator
 * section — "you are here, here's what's left".
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { PhaseChecklistState } from '../../services/phaseChecklist';
import { loadPhaseChecklistState } from '../../services/phaseChecklistLoader';

interface PhaseChecklistProps {
  transactionId: string;
  /** Test override — skip the live fetch and render the given state. */
  stateOverride?: PhaseChecklistState | null;
  /** Bump to force a silent refetch after an audit event lands on chain.
   *  See PhaseIndicator for the pattern. */
  refreshKey?: number;
  /** Locally-derived audit events merged with the live ledger fetch so
   *  the checklist ticks items even when the canister write is still in
   *  flight or failed silently. */
  extraEvents?: Array<{ eventType: string; timestamp: number }>;
}

export function PhaseChecklist({
  transactionId,
  stateOverride,
  refreshKey,
  extraEvents,
}: PhaseChecklistProps): ReactElement | null {
  const [state, setState] = useState<PhaseChecklistState | null>(stateOverride ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(stateOverride === undefined);

  useEffect(() => {
    if (stateOverride !== undefined) {
      setState(stateOverride);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    // Only show the skeleton on the initial load; silent refetch on refreshKey bumps.
    setIsLoading((prev) => (state === null ? true : prev));

    void (async () => {
      try {
        const next = await loadPhaseChecklistState(transactionId, extraEvents);
        if (cancelled) return;
        setState(next);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setState(null);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, stateOverride, refreshKey, extraEvents]);

  if (isLoading) {
    return (
      <div
        className="mb-4 h-24 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-hidden="true"
      />
    );
  }

  if (!state || state.items.length === 0) return null;

  const completedCount = state.items.filter((i) => i.completed).length;
  const pct = Math.round(state.progress * 100);

  return (
    <section
      className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3"
      aria-label="Phase checklist"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          This phase
        </span>
        <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
          {completedCount} of {state.items.length} done · {pct}%
        </span>
      </div>
      <ul className="space-y-1.5">
        {state.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 font-[DM_Sans] text-sm"
          >
            <CheckGlyph done={item.completed} />
            <span
              className={
                item.completed
                  ? 'text-gray-500 line-through dark:text-gray-500'
                  : 'text-gray-700 dark:text-gray-200'
              }
            >
              {item.label}
            </span>
            {item.completed && item.completedAt !== null && (
              <span className="ml-auto font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">
                {formatTimestamp(item.completedAt)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckGlyph({ done }: { done: boolean }): ReactElement {
  if (done) {
    return (
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488] dark:text-[#14B8A6]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-label="done"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <span
      className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600"
      aria-label="pending"
    />
  );
}

function formatTimestamp(ms: number): string {
  // The ledger manager uses Time.time nanoseconds. If the value looks bigger
  // than Y2100 in ms, scale down.
  const scaled = ms > 4_102_444_800_000 ? Math.floor(ms / 1_000_000) : ms;
  try {
    return new Date(scaled).toLocaleDateString();
  } catch {
    return '';
  }
}

export default PhaseChecklist;
