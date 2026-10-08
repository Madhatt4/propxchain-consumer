// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Live phase + checklist for one transaction, read from the canister and the
 * audit trail. Shared by the PhaseChecklist card and the Analytics page so
 * both derive "where are we, what's left" the same way.
 */

import { icpService } from './icp.service';
import {
  PHASE_ORDER,
  derivePhase,
  extractMilestonesFromEvents,
  statusIsCompleted,
  statusIsExchanged,
  type Phase,
} from './phase';
import { deriveChecklistState, type PhaseChecklistState } from './phaseChecklist';

/** Null when the transaction cannot be read (not a party, transient error). */
export async function loadPhaseChecklistState(
  transactionId: string,
  extraEvents?: Array<{ eventType: string; timestamp: number }>,
): Promise<PhaseChecklistState | null> {
  const [txResult, eventsResult] = await Promise.allSettled([
    icpService.transactionManager?.getTransaction(transactionId),
    icpService.ledgerManager?.getEventsByTransaction(transactionId),
  ]);

  const txRaw = txResult.status === 'fulfilled' ? txResult.value : null;
  const tx = Array.isArray(txRaw)
    ? (txRaw[0] as Record<string, unknown> | undefined)
    : (txRaw as Record<string, unknown> | null | undefined);
  if (!tx) return null;

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
  const phase: Phase = derivePhase({
    isCompleted: statusIsCompleted(status),
    isExchanged: statusIsExchanged(status),
    buyer: String(tx.buyer ?? ''),
    seller: String(tx.seller ?? ''),
    milestones,
  });

  return deriveChecklistState(phase, events);
}

/**
 * Whole-deal progress, 0..1: each phase before completion is an equal step,
 * and the current phase counts for the share of its checklist that is done.
 */
export function overallProgress(state: PhaseChecklistState): number {
  if (state.phase === 'completed') return 1;
  const steps = PHASE_ORDER.length - 1;
  const index = PHASE_ORDER.indexOf(state.phase);
  if (index < 0) return 0;
  return Math.min(1, (index + state.progress) / steps);
}
