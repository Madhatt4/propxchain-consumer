// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Derives the progress-timeline steps for one plot from its listing,
 * reservation and legal status. Same vocabulary as the pipeline kanban
 * columns, so a plot sits at the same stage on the timeline and the board.
 */

import type { Plot } from '@/services/plots.service';

export interface PlotStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
}

const LEGAL_STAGES: Array<{ label: string; statuses: string[] }> = [
  { label: 'AML & searches', statuses: ['aml_pending', 'searches_ordered', 'searches_received'] },
  { label: 'Enquiries', statuses: ['enquiries_raised', 'enquiries_answered'] },
  { label: 'Mortgage', statuses: ['mortgage_offer_uploaded', 'mortgage_approved'] },
  { label: 'Exchanged', statuses: ['exchanged'] },
  { label: 'Completed', statuses: ['completed'] },
];

/** Index of the plot's current stage: 0 listed, 1 reserved, 2+ legal stages. */
export function plotStageIndex(plot: Plot): number {
  const legal = LEGAL_STAGES.findIndex((s) => s.statuses.includes(plot.current_legal_status ?? ''));
  if (legal >= 0) return legal + 2;
  if (plot.reservation_status === 'reserved') return 1;
  return plot.listing_status === 'published' ? 0 : -1;
}

export function plotSteps(plot: Plot): PlotStep[] {
  const labels = ['Listed', 'Reserved', ...LEGAL_STAGES.map((s) => s.label)];
  const current = plotStageIndex(plot);
  const isDone = plot.current_legal_status === 'completed';
  return labels.map((label, i) => ({
    label,
    status: i < current || (isDone && i === current) ? 'completed' : i === current ? 'active' : 'pending',
  }));
}

export function plotCompletionPercent(plot: Plot): number {
  const total = LEGAL_STAGES.length + 2;
  const current = plotStageIndex(plot);
  if (plot.current_legal_status === 'completed') return 100;
  return Math.round((Math.max(current, 0) / (total - 1)) * 100);
}

/** Whole days until expected practical completion, floored at 0. */
export function daysToCompletion(plot: Plot, now: Date = new Date()): number {
  if (!plot.expected_practical_completion) return 0;
  const target = new Date(plot.expected_practical_completion).getTime();
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}
