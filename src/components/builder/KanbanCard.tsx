// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Single plot card for the pipeline kanban board.
 */

import { useMemo } from 'react';

import type { Plot } from '@/services/plots.service';

interface KanbanCardProps {
  plot: Plot;
  siteId: string;
  plotTypeName: string | null;
  stageLabel: string;
  onClick: () => void;
}

/** Calculate days elapsed from a date string to now. */
function daysElapsed(from: string | null): number {
  if (!from) return 0;
  const start = new Date(from).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

export default function KanbanCard({
  plot,
  plotTypeName,
  stageLabel,
  onClick,
}: KanbanCardProps): JSX.Element {
  const days = useMemo(
    () => daysElapsed(plot.reserved_at ?? plot.updated_at),
    [plot.reserved_at, plot.updated_at],
  );

  const isAtRisk = plot.at_risk_flag;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-md px-3 py-3 text-left',
        'bg-[var(--bg-card)] dark:bg-[#0F1729]',
        'hover:bg-[#F0F5F0] dark:hover:bg-[#141F33]',
        'transition-colors cursor-pointer',
        isAtRisk ? 'border-l-[3px] border-[#5F8A68]' : '',
      ].join(' ')}
    >
      {/* Top row: type name + plot number */}
      <div className="flex items-start justify-between">
        <span className="font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          {plotTypeName ?? 'Untyped'}
        </span>
        <span className="font-mono text-lg font-bold text-[var(--text-main)]">
          {plot.plot_number}
        </span>
      </div>

      {/* Buyer / reserved label */}
      {plot.reservation_status === 'reserved' && (
        <p className="mt-1 font-[Fraunces] text-base text-[var(--text-main)]">
          Reserved
        </p>
      )}

      {/* Bottom row: stage label + days pill */}
      <div className="mt-2 flex items-center justify-between">
        <span className="font-[DM_Sans] text-xs text-[var(--text-secondary)]">
          {stageLabel}
        </span>
        {days > 0 && (
          <span className="rounded-full bg-[var(--bg-section)] px-2 py-0.5 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
            {days}d
          </span>
        )}
      </div>
    </button>
  );
}
