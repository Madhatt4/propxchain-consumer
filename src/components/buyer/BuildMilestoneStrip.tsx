// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useState, useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { milestonesService } from '@/services/milestones.service';
import type { BuildMilestone } from '@/services/milestones.service';

interface BuildMilestoneStripProps {
  plotId: string;
  siteId: string;
}

/** Human-readable labels for built-in milestone types. */
const MILESTONE_LABELS: Record<string, string> = {
  foundation: 'Foundation poured',
  roof_on: 'Roof on',
  practical_completion: 'Practical completion',
  nhbc_signoff: 'NHBC sign-off',
};

/** Derive display label from a milestone row. */
function getLabel(m: BuildMilestone): string {
  if (m.milestone_type === 'custom' && m.custom_label) {
    return m.custom_label;
  }
  return MILESTONE_LABELS[m.milestone_type ?? ''] ?? m.custom_label ?? 'Milestone';
}

/** Calculate days between today and a target date string (YYYY-MM-DD). */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a date string as "30 May". */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type MilestoneStatus = 'completed' | 'upcoming' | 'overdue';

interface DisplayMilestone {
  id: string;
  label: string;
  status: MilestoneStatus;
  expectedDate: string | null;
  daysRemaining: number | null;
}

/** Classify and shape a milestone for display. */
function toDisplayMilestone(m: BuildMilestone): DisplayMilestone {
  const label = getLabel(m);

  if (m.actual_date) {
    return { id: m.id, label, status: 'completed', expectedDate: m.expected_date, daysRemaining: null };
  }

  if (m.expected_date) {
    const days = daysUntil(m.expected_date);
    const status: MilestoneStatus = days < 0 ? 'overdue' : 'upcoming';
    return { id: m.id, label, status, expectedDate: m.expected_date, daysRemaining: days };
  }

  return { id: m.id, label, status: 'upcoming', expectedDate: null, daysRemaining: null };
}

/** Render a single milestone inline. */
function MilestoneItem({ milestone }: { milestone: DisplayMilestone }): ReactElement {
  if (milestone.status === 'completed') {
    return (
      <span className="whitespace-nowrap text-[#10B981]">
        {milestone.label} &#10003;
      </span>
    );
  }

  if (milestone.status === 'overdue') {
    return (
      <span className="whitespace-nowrap text-[#5F8A68]">
        {milestone.label} &mdash; overdue
      </span>
    );
  }

  // upcoming
  const dateStr = milestone.expectedDate ? formatShortDate(milestone.expectedDate) : null;
  const daysStr =
    milestone.daysRemaining !== null && milestone.daysRemaining >= 0
      ? `(${milestone.daysRemaining} day${milestone.daysRemaining === 1 ? '' : 's'})`
      : null;

  return (
    <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">
      {milestone.label}
      {dateStr && <> expected {dateStr}</>}
      {daysStr && <> {daysStr}</>}
    </span>
  );
}

/**
 * Horizontal strip showing build progress milestones for a buyer's plot.
 * Fetches plot-specific and site-wide (plot_id IS NULL) milestones, deduplicates,
 * and renders them inline with pipe separators.
 */
export function BuildMilestoneStrip({ plotId, siteId }: BuildMilestoneStripProps): ReactElement | null {
  const [milestones, setMilestones] = useState<BuildMilestone[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMilestones(): Promise<void> {
      try {
        const [plotMs, siteMs] = await Promise.all([
          milestonesService.getByPlot(plotId),
          milestonesService.getBySite(siteId),
        ]);

        // Site-wide milestones have plot_id IS NULL
        const siteWide = siteMs.filter((m) => m.plot_id === null);

        // Deduplicate: plot-specific takes priority over site-wide by milestone_type
        const plotTypes = new Set(plotMs.map((m) => m.milestone_type));
        const merged = [
          ...plotMs,
          ...siteWide.filter((m) => !plotTypes.has(m.milestone_type)),
        ];

        if (!cancelled) {
          setMilestones(merged);
        }
      } catch {
        // Silently fail — strip is non-critical
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchMilestones();
    return (): void => {
      cancelled = true;
    };
  }, [plotId, siteId]);

  const displayMilestones = useMemo(
    () => milestones.map(toDisplayMilestone),
    [milestones],
  );

  if (isLoading) {
    return (
      <div className="h-8 rounded bg-[#84A98C]/5 animate-pulse" />
    );
  }

  if (displayMilestones.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto rounded-lg bg-[#84A98C]/5 px-4 py-2 text-sm font-['DM_Sans'] scrollbar-hide"
      role="list"
      aria-label="Build milestones"
    >
      {displayMilestones.map((m, i) => (
        <span key={m.id} className="flex items-center gap-2" role="listitem">
          {i > 0 && (
            <span className="text-gray-300 dark:text-gray-600 select-none" aria-hidden>|</span>
          )}
          <MilestoneItem milestone={m} />
        </span>
      ))}
    </div>
  );
}
