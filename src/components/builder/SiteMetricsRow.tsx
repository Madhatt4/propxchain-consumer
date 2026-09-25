// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Site metrics row — plot status counts with at-risk emphasis.
 * The daily question is "what's bleeding today?" — at-risk dominates.
 */

import { useState, useEffect, useCallback } from 'react';

import { plotsService, type Plot } from '@/services/plots.service';

/** Legal statuses that count as "in conveyancing". */
const CONVEYANCING_STATUSES: ReadonlySet<string> = new Set([
  'aml_pending',
  'searches_ordered',
  'searches_received',
  'enquiries_raised',
  'enquiries_answered',
  'mortgage_offer_uploaded',
]);

interface SiteMetricsRowProps {
  siteId: string;
}

interface MetricsCounts {
  atRisk: number;
  reserved: number;
  inConveyancing: number;
  exchanged: number;
  completed: number;
}

function computeCounts(plots: Plot[]): MetricsCounts {
  let atRisk = 0;
  let reserved = 0;
  let inConveyancing = 0;
  let exchanged = 0;
  let completed = 0;

  for (const p of plots) {
    if (p.at_risk_flag) atRisk++;
    if (p.reservation_status === 'reserved') reserved++;
    if (CONVEYANCING_STATUSES.has(p.current_legal_status ?? '')) inConveyancing++;
    if (p.current_legal_status === 'exchanged') exchanged++;
    if (p.current_legal_status === 'completed') completed++;
  }

  return { atRisk, reserved, inConveyancing, exchanged, completed };
}

function SkeletonRow(): JSX.Element {
  return (
    <div className="flex items-center gap-6 animate-pulse">
      <div className="h-16 w-24 rounded-lg bg-[var(--bg-section)]" />
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-20 rounded bg-[var(--bg-section)]" />
        ))}
      </div>
    </div>
  );
}

interface SecondaryMetricProps {
  label: string;
  count: number;
}

function SecondaryMetric({ label, count }: SecondaryMetricProps): JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-lg font-semibold text-[var(--text-main)]">
        {count}
      </span>
      <span className="font-[DM_Sans] text-[0.875rem] text-[var(--text-secondary)]">
        {label}
      </span>
    </div>
  );
}

export default function SiteMetricsRow({ siteId }: SiteMetricsRowProps): JSX.Element | null {
  const [counts, setCounts] = useState<MetricsCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchMetrics = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const plots = await plotsService.getBySite(siteId);
      if (plots.length === 0) {
        setIsEmpty(true);
        return;
      }
      setCounts(computeCounts(plots));
    } catch {
      // Non-critical — silently degrade
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isEmpty) return null;
  if (isLoading) return <SkeletonRow />;
  if (!counts) return null;

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* At-risk: 2x size, only colored element */}
      <div className="rounded-lg bg-[#F0F5F0] px-5 py-3 dark:bg-[#F0F5F0]/10">
        <span className="font-[Fraunces] text-3xl font-bold text-[#5F8A68]">
          {counts.atRisk}
        </span>
        <p className="font-[DM_Sans] text-[0.875rem] text-[#5F8A68]">
          At risk
        </p>
      </div>

      {/* Secondary counts stacked to the right */}
      <div className="flex gap-5">
        <SecondaryMetric label="Reserved" count={counts.reserved} />
        <SecondaryMetric label="In conveyancing" count={counts.inConveyancing} />
        <SecondaryMetric label="Exchanged" count={counts.exchanged} />
        <SecondaryMetric label="Completed" count={counts.completed} />
      </div>
    </div>
  );
}
