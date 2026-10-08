// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { logger } from '@/utils/logger';
import type { PhaseChecklistState } from './phaseChecklist';
import { loadPhaseChecklistState } from './phaseChecklistLoader';
import { loadDealStage, loadDealStalls, type DealStage, type DealStall } from './stall.service';

/**
 * The agreed completion date, or null until one is set (it is agreed at
 * exchange; before then the field is empty).
 */
export function formatTargetDate(completionDate: unknown): string | null {
  if (typeof completionDate !== 'string' || completionDate.trim() === '') return null;
  const date = new Date(completionDate);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB');
}

export interface DealAnalytics {
  checklist: PhaseChecklistState | null;
  stage: DealStage | null;
  stalls: DealStall[];
}

/**
 * Every number on the Analytics page is read, never guessed: the phase and
 * checklist come from the audit trail, the waits and stage benchmark from the
 * stall service. (The viewer's next move is NextStepCard's own read of the
 * canister's next-step engine, which knows which side the viewer is on.)
 */
export async function loadDealAnalytics(transactionId: string): Promise<DealAnalytics> {
  const [checklist, stage, stalls] = await Promise.all([
    loadPhaseChecklistState(transactionId).catch((error: unknown) => {
      logger.warn('Phase checklist unavailable', error);
      return null;
    }),
    loadDealStage(transactionId).catch((error: unknown) => {
      logger.warn('Stage unavailable', error);
      return null;
    }),
    loadDealStalls(transactionId).catch((error: unknown) => {
      logger.warn('Stalls unavailable', error);
      return [] as DealStall[];
    }),
  ]);
  return { checklist, stage, stalls: [...stalls].sort((a, b) => b.days - a.days) };
}
