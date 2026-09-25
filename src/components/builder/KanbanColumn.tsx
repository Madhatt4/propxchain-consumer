// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Single column for the pipeline kanban board.
 */

import KanbanCard from './KanbanCard';

import type { Plot } from '@/services/plots.service';

interface KanbanColumnProps {
  label: string;
  plots: Plot[];
  siteId: string;
  plotTypeMap: Map<string, string>;
  onPlotClick: (plot: Plot) => void;
}

export default function KanbanColumn({
  label,
  plots,
  siteId,
  plotTypeMap,
  onPlotClick,
}: KanbanColumnProps): JSX.Element {
  return (
    <div className="flex min-w-[240px] w-[240px] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <h3 className="font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </h3>
        <span className="inline-flex items-center rounded-full bg-[var(--bg-section)] px-2 py-0.5 font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)]">
          {plots.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {plots.map((plot) => (
          <KanbanCard
            key={plot.id}
            plot={plot}
            siteId={siteId}
            plotTypeName={plot.plot_type_id ? (plotTypeMap.get(plot.plot_type_id) ?? null) : null}
            stageLabel={label}
            onClick={() => onPlotClick(plot)}
          />
        ))}
      </div>
    </div>
  );
}
