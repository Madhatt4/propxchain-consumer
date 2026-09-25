// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Milestone management page — list view grouped by month.
 * Route: /builder/sites/:siteId/milestones
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  Calendar,
} from 'lucide-react';

import {
  milestonesService,
  type BuildMilestone,
  type CreateMilestoneInput,
  type UpdateMilestoneInput,
} from '@/services/milestones.service';
import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import { plotsService, type Plot } from '@/services/plots.service';
import MilestoneEntryModal from '@/components/builder/MilestoneEntryModal';

type ScopeFilter = 'all' | 'site' | 'plot';

export default function MilestonesPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();

  const [site, setSite] = useState<DevelopmentSite | null>(null);
  const [milestones, setMilestones] = useState<BuildMilestone[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<BuildMilestone | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [siteData, msData, plotData] = await Promise.all([
        sitesService.getById(siteId),
        milestonesService.getBySite(siteId),
        plotsService.getBySite(siteId),
      ]);
      setSite(siteData);
      setMilestones(msData);
      setPlots(plotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = milestones.filter((m) => {
    if (scopeFilter === 'site') return m.plot_id === null;
    if (scopeFilter === 'plot') return m.plot_id !== null;
    return true;
  });

  const grouped = groupByMonth(filtered);

  async function handleSave(input: CreateMilestoneInput | UpdateMilestoneInput): Promise<void> {
    if (editingMilestone) {
      await milestonesService.update(editingMilestone.id, input as UpdateMilestoneInput);
    } else {
      await milestonesService.create(input as CreateMilestoneInput);
    }
    setShowModal(false);
    setEditingMilestone(null);
    await fetchData();
  }

  async function handleMarkComplete(id: string): Promise<void> {
    await milestonesService.markComplete(id);
    await fetchData();
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Delete this milestone?')) return;
    await milestonesService.delete(id);
    await fetchData();
  }

  function openEdit(m: BuildMilestone): void {
    setEditingMilestone(m);
    setShowModal(true);
  }

  function openCreate(): void {
    setEditingMilestone(null);
    setShowModal(true);
  }

  function plotLabel(plotId: string | null): string {
    if (!plotId) return 'All plots';
    const plot = plots.find((p) => p.id === plotId);
    return plot ? `Plot ${plot.plot_number}` : 'Specific plot';
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="py-12 text-center">
        <p className="font-[DM_Sans] text-base text-red-600 dark:text-red-400">
          {error || 'Site not found.'}
        </p>
        <Link
          to="/builder"
          className="mt-4 inline-flex items-center font-[DM_Sans] text-sm text-[#0D9488] hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to sites
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/builder/sites/${siteId}`}
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
            Build milestones
          </h1>
          <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            {site.name}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
        >
          <Plus className="h-4 w-4" />
          Add milestone
        </button>
      </div>

      {/* Scope filter */}
      <div className="mt-6 flex gap-2">
        {(['all', 'site', 'plot'] as ScopeFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setScopeFilter(f)}
            className={`rounded-full px-3 py-1 font-[DM_Sans] text-xs font-medium transition-colors ${
              scopeFilter === f
                ? 'bg-[#0D9488] text-white'
                : 'bg-[var(--bg-section)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'site' ? 'Site-wide' : 'Plot-specific'}
          </button>
        ))}
      </div>

      {/* Milestones grouped by month */}
      {grouped.length === 0 ? (
        <div className="mt-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <p className="mt-3 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            No milestones yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(({ month, items }) => (
            <div key={month}>
              <h3 className="mb-3 font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
                {month}
              </h3>
              <div className="space-y-2">
                {items.map((m) => (
                  <MilestoneRow
                    key={m.id}
                    milestone={m}
                    plotLabel={plotLabel(m.plot_id)}
                    onEdit={() => openEdit(m)}
                    onDelete={() => handleDelete(m.id)}
                    onMarkComplete={() => handleMarkComplete(m.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && siteId && (
        <MilestoneEntryModal
          siteId={siteId}
          plots={plots.map((p) => ({ id: p.id, plot_number: p.plot_number }))}
          milestone={editingMilestone}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingMilestone(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface MilestoneRowProps {
  milestone: BuildMilestone;
  plotLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onMarkComplete: () => void;
}

function MilestoneRow({
  milestone,
  plotLabel,
  onEdit,
  onDelete,
  onMarkComplete,
}: MilestoneRowProps): JSX.Element {
  const isComplete = Boolean(milestone.actual_date);
  const displayName = milestone.custom_label || typeLabel(milestone.milestone_type);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
      {/* Status icon */}
      {isComplete ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[#10B981]" />
      ) : (
        <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-[var(--border-color)]" />
      )}

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p
          className={`font-[DM_Sans] text-sm font-medium ${
            isComplete
              ? 'text-[var(--text-secondary)] line-through'
              : 'text-[var(--text-main)]'
          }`}
        >
          {displayName}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-3 font-[DM_Sans] text-xs text-[var(--text-secondary)]">
          <span>{plotLabel}</span>
          <span>Target: {formatDate(milestone.expected_date)}</span>
          {isComplete && (
            <span className="text-[#10B981]">
              Completed: {formatDate(milestone.actual_date)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!isComplete && (
          <button
            type="button"
            onClick={onMarkComplete}
            title="Mark complete"
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-green-50 hover:text-[#10B981] dark:hover:bg-green-900/20"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function typeLabel(type: string | null): string {
  switch (type) {
    case 'foundation':
      return 'Foundation';
    case 'roof_on':
      return 'Structure / Roof';
    case 'practical_completion':
      return 'Practical completion';
    case 'nhbc_signoff':
      return 'NHBC sign-off';
    default:
      return 'Milestone';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface MonthGroup {
  month: string;
  items: BuildMilestone[];
}

function groupByMonth(milestones: BuildMilestone[]): MonthGroup[] {
  const map = new Map<string, BuildMilestone[]>();
  for (const m of milestones) {
    const key = m.expected_date
      ? new Date(m.expected_date + 'T00:00:00').toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
      : 'No date';
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([month, items]) => ({ month, items }));
}
