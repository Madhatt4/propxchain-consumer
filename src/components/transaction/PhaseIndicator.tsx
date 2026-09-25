// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 phase progress indicator.
 *
 * Renders a 6-segment horizontal progress bar showing the transaction's
 * derived phase. Phase is a DISPLAY field — it does not gate any UI.
 * As of Ship 2d, derivation runs client-side via
 * frontend/src/services/phase.ts, reading from the Transaction record (for
 * status + principals) and the ledger_manager audit event stream (for
 * milestone timestamps). The previous canister-side `getCurrentPhase` call
 * is no longer used.
 * See the v3 phase-model design (monorepo).
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { icpService } from '../../services/icp.service';
import {
  derivePhase,
  extractMilestonesFromEvents,
  PHASE_LABELS,
  PHASE_ORDER,
  statusIsCompleted,
  statusIsExchanged,
  type Phase,
} from '../../services/phase';

interface PhaseIndicatorProps {
  transactionId: string;
  /** Optional override — skip the fetch and render the given phase directly (useful in tests). */
  phaseOverride?: Phase | null;
  /** Bump to force a silent refetch after an audit event lands on chain.
   *  The first fetch shows the skeleton; subsequent refetches keep the
   *  current phase visible so the UI doesn't flash back to loading on
   *  every stage completion. */
  refreshKey?: number;
  /** Locally-derived audit events (from completedStages / providerSelections)
   *  merged with the live ledger fetch so the phase advances even when the
   *  canister write is still in flight. */
  extraEvents?: Array<{ eventType: string; timestamp: number }>;
}

export function PhaseIndicator({ transactionId, phaseOverride, refreshKey, extraEvents }: PhaseIndicatorProps): ReactElement | null {
  const [phase, setPhase] = useState<Phase | null>(phaseOverride ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(phaseOverride === undefined);

  useEffect(() => {
    if (phaseOverride !== undefined) {
      setPhase(phaseOverride);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    // Only show the skeleton on the initial load; silent refetch on refreshKey bumps.
    setIsLoading((prev) => (phase === null ? true : prev));

    void (async () => {
      try {
        const [txResult, eventsResult] = await Promise.allSettled([
          icpService.transactionManager?.getTransaction(transactionId),
          icpService.ledgerManager?.getEventsByTransaction(transactionId),
        ]);

        if (cancelled) return;

        // Transaction record: getTransaction returns `opt Transaction`, which
        // decodes as `[]` or `[Transaction]` from the Motoko Opt type.
        const txRaw =
          txResult.status === 'fulfilled' ? txResult.value : null;
        const tx = Array.isArray(txRaw) ? (txRaw[0] as Record<string, unknown> | undefined) : (txRaw as Record<string, unknown> | null | undefined);
        if (!tx) {
          setPhase(null);
          setIsLoading(false);
          return;
        }

        const eventsRaw = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
        const ledgerEvents = Array.isArray(eventsRaw)
          ? eventsRaw.map((e) => ({
              eventType: String(e.eventType ?? ''),
              timestamp: Number(e.timestamp ?? 0),
            }))
          : [];
        // Merge ledger events with locally-derived synthetic events. Ledger
        // is canonical; synthetic closes the window between a local stage
        // completion and the logEvent write landing on chain.
        const events = extraEvents ? [...ledgerEvents, ...extraEvents] : ledgerEvents;

        const milestones = extractMilestonesFromEvents(events);
        const status = tx.status as Parameters<typeof statusIsCompleted>[0];

        const derived = derivePhase({
          isCompleted: statusIsCompleted(status),
          isExchanged: statusIsExchanged(status),
          buyer: String(tx.buyer ?? ''),
          seller: String(tx.seller ?? ''),
          milestones,
        });

        setPhase(derived);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setPhase(null);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, phaseOverride, refreshKey, extraEvents]);

  if (isLoading) {
    return (
      <div
        className="mb-4 h-14 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-hidden="true"
      />
    );
  }

  if (phase === null) {
    return null;
  }

  const currentIndex = PHASE_ORDER.indexOf(phase);
  const currentLabel = PHASE_LABELS[phase];

  return (
    <div
      className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-4 py-3"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={PHASE_ORDER.length}
      aria-valuenow={currentIndex + 1}
      aria-valuetext={`Phase ${currentIndex + 1} of ${PHASE_ORDER.length}: ${currentLabel}`}
      aria-label="Transaction phase"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Phase {currentIndex + 1} of {PHASE_ORDER.length}
        </span>
        <span className="font-[Fraunces] text-sm font-semibold text-[#0D9488] dark:text-[#14B8A6]">
          {currentLabel}
        </span>
      </div>
      <div className="flex gap-1.5">
        {PHASE_ORDER.map((p, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const segmentClass = isCompleted
            ? 'bg-[#0D9488] dark:bg-[#14B8A6]'
            : isCurrent
              ? 'bg-[#0D9488] dark:bg-[#14B8A6] ring-2 ring-[#0D9488]/30 dark:ring-[#14B8A6]/30'
              : 'bg-gray-200 dark:bg-gray-700';
          return (
            <div
              key={p}
              className={`h-2 flex-1 rounded-full transition-colors ${segmentClass}`}
              title={PHASE_LABELS[p]}
            />
          );
        })}
      </div>
    </div>
  );
}

export default PhaseIndicator;
