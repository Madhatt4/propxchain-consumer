// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Plot list page — shows all plots for a development site.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2, Copy, Check } from 'lucide-react';

import { plotsService, type Plot } from '@/services/plots.service';
import { plotTypesService, type PlotType } from '@/services/plot-types.service';
import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import { listingsService } from '@/services/listings.service';
import FirstTimePublishModal, {
  hasPublishedBefore,
} from '@/components/builder/FirstTimePublishModal';
import ReservePlotModal from '@/components/builder/ReservePlotModal';
import ReleaseReservationModal from '@/components/builder/ReleaseReservationModal';

/** Format pence as pounds string. */
function formatPrice(pence: number | null): string {
  if (pence === null) return '--';
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

/** Badge colour classes by status value. */
function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-[#0D9488]/20 text-[#0D9488]';
    case 'reserved':
      return 'bg-[#84A98C]/20 text-[#5F8A68] dark:text-[#84A98C]';
    default:
      return 'bg-[var(--bg-section)] text-[var(--text-secondary)]';
  }
}

function PlotTable({
  plots,
  plotTypeMap,
  siteId,
  onDelete,
  onPublish,
  onUnpublish,
  onReserve,
  onRelease,
}: {
  plots: Plot[];
  plotTypeMap: Map<string, string>;
  siteId: string;
  onDelete: (id: string) => void;
  onPublish: (plot: Plot) => void;
  onUnpublish: (plotId: string) => void;
  onReserve: (plot: Plot) => void;
  onRelease: (plot: Plot) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
      <table className="w-full text-left">
        <thead className="border-b border-[var(--border-color)] bg-[var(--bg-section)]">
          <tr>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Plot
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Type
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Price
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Listing
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Invite Code
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Reservation
            </th>
            <th className="px-4 py-3 font-[DM_Sans] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Actions
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
          {plots.map((plot) => (
            <PlotRow
              key={plot.id}
              plot={plot}
              typeName={plot.plot_type_id ? plotTypeMap.get(plot.plot_type_id) ?? '--' : '--'}
              siteId={siteId}
              onDelete={onDelete}
              onPublish={onPublish}
              onUnpublish={onUnpublish}
              onReserve={onReserve}
              onRelease={onRelease}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlotRow({
  plot,
  typeName,
  siteId,
  onDelete,
  onPublish,
  onUnpublish,
  onReserve,
  onRelease,
}: {
  plot: Plot;
  typeName: string;
  siteId: string;
  onDelete: (id: string) => void;
  onPublish: (plot: Plot) => void;
  onUnpublish: (plotId: string) => void;
  onReserve: (plot: Plot) => void;
  onRelease: (plot: Plot) => void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const isDraft = plot.listing_status === 'draft';
  const isPublished = plot.listing_status === 'published';
  const isAvailable = plot.reservation_status === 'available';
  const isReserved = plot.reservation_status === 'reserved';
  const isPending = plot.reservation_status === 'pending';
  const canRelease = isReserved || isPending;
  const canReserve = isPublished && isAvailable;

  function handleCopyCode(): void {
    if (!plot.invite_code) return;
    navigator.clipboard.writeText(plot.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <tr className="transition-colors hover:bg-[var(--bg-section)]">
      <td className="px-4 py-3">
        <Link
          to={`/builder/sites/${siteId}/plots/${plot.id}`}
          className="font-[Geist_Mono] text-sm font-medium text-[var(--text-main)] hover:text-[#0D9488]"
        >
          {plot.plot_number}
        </Link>
      </td>
      <td className="px-4 py-3 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
        {typeName}
      </td>
      <td className="px-4 py-3 font-[Geist_Mono] text-sm text-[var(--text-main)]">
        {formatPrice(plot.sale_price_pence)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium ${statusBadgeClasses(plot.listing_status)}`}
        >
          {plot.listing_status}
        </span>
      </td>
      <td className="px-4 py-3">
        {plot.invite_code ? (
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-section)] px-2 py-1 font-[Geist_Mono] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--border-light)] transition-colors"
            title="Click to copy"
          >
            {plot.invite_code}
            {copied ? (
              <Check className="h-3 w-3 text-[#10B981]" />
            ) : (
              <Copy className="h-3 w-3 text-[var(--text-muted)]" />
            )}
          </button>
        ) : (
          <span className="font-[DM_Sans] text-xs text-[var(--text-muted)]">--</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isReserved ? (
          <span className="inline-flex items-center rounded-full bg-[#84A98C]/20 px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium text-[#5F8A68] dark:text-[#84A98C]">
            Reserved
          </span>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-medium ${statusBadgeClasses(plot.reservation_status)}`}
          >
            {plot.reservation_status}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isDraft && (
            <button
              type="button"
              onClick={() => onPublish(plot)}
              className="rounded-md border border-[#0D9488] px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#0D9488] hover:bg-[#0D9488]/10 dark:border-[#0D9488] dark:text-[#0D9488]"
            >
              Publish
            </button>
          )}
          {isPublished && (
            <button
              type="button"
              onClick={() => onUnpublish(plot.id)}
              className="rounded-md border border-[var(--border-color)] px-3 py-1 font-[DM_Sans] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
            >
              Unpublish
            </button>
          )}
          {canReserve && (
            <button
              type="button"
              onClick={() => onReserve(plot)}
              className="rounded-md border border-[#84A98C] px-3 py-1 font-[DM_Sans] text-xs font-medium text-[#5F8A68] hover:bg-[#84A98C]/10 dark:border-[#84A98C] dark:text-[#84A98C] dark:hover:bg-[#84A98C]/10"
            >
              Reserve
            </button>
          )}
          {canRelease && (
            <button
              type="button"
              onClick={() => onRelease(plot)}
              className="rounded-md border border-red-300 px-3 py-1 font-[DM_Sans] text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Release
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onDelete(plot.id)}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete plot"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function EmptyState({ siteId }: { siteId: string }): JSX.Element {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-section)] p-12 text-center">
      <p className="font-[DM_Sans] text-sm text-[var(--text-secondary)]">
        No plots yet. Add your first plot to get started.
      </p>
      <Link
        to={`/builder/sites/${siteId}/plots/new`}
        className="mt-4 inline-flex items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
      >
        <Plus className="mr-1.5 h-4 w-4" /> New plot
      </Link>
    </div>
  );
}

export default function PlotListPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<DevelopmentSite | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plotTypeMap, setPlotTypeMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingPublishPlot, setPendingPublishPlot] = useState<Plot | null>(null);
  const [reservePlot, setReservePlot] = useState<Plot | null>(null);
  const [releasePlot, setReleasePlot] = useState<Plot | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [siteData, plotsData, typesData] = await Promise.all([
        sitesService.getById(siteId),
        plotsService.getBySite(siteId),
        plotTypesService.getBySite(siteId),
      ]);
      setSite(siteData);
      setPlots(plotsData);
      setPlotTypeMap(new Map(typesData.map((t: PlotType) => [t.id, t.name])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plots.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (plotId: string): Promise<void> => {
    if (!confirm('Delete this plot? This cannot be undone.')) return;
    try {
      await plotsService.delete(plotId);
      setPlots((prev) => prev.filter((p) => p.id !== plotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plot.');
    }
  };

  const executePublish = async (plot: Plot): Promise<void> => {
    if (!site) return;
    try {
      await listingsService.publishPlot(plot.id, site.slug ?? site.name, plot.plot_number);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish plot.');
    }
  };

  const handlePublish = (plot: Plot): void => {
    if (!hasPublishedBefore()) {
      setPendingPublishPlot(plot);
      setShowPublishModal(true);
    } else {
      executePublish(plot);
    }
  };

  const handlePublishConfirm = (): void => {
    setShowPublishModal(false);
    if (pendingPublishPlot) {
      executePublish(pendingPublishPlot);
      setPendingPublishPlot(null);
    }
  };

  const handlePublishCancel = (): void => {
    setShowPublishModal(false);
    setPendingPublishPlot(null);
  };

  const handleReserve = (plot: Plot): void => {
    setReservePlot(plot);
  };

  const handleReserveComplete = (): void => {
    setReservePlot(null);
    fetchData();
  };

  const handleReserveClose = (): void => {
    setReservePlot(null);
  };

  const handleRelease = (plot: Plot): void => {
    setReleasePlot(plot);
  };

  const handleReleaseComplete = (): void => {
    setReleasePlot(null);
    fetchData();
  };

  const handleReleaseClose = (): void => {
    setReleasePlot(null);
  };

  const handleUnpublish = async (plotId: string): Promise<void> => {
    try {
      await listingsService.unpublishPlot(plotId);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish plot.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error || !site || !siteId) {
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
            Plots
          </h1>
          <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            {site.name} &middot; {plots.length} plot{plots.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/builder/sites/${siteId}/plots/import`}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
          >
            Import CSV
          </Link>
          <Link
            to={`/builder/sites/${siteId}/plots/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New plot
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        {plots.length === 0 ? (
          <EmptyState siteId={siteId} />
        ) : (
          <PlotTable
            plots={plots}
            plotTypeMap={plotTypeMap}
            siteId={siteId}
            onDelete={handleDelete}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onReserve={handleReserve}
            onRelease={handleRelease}
          />
        )}
      </div>

      <FirstTimePublishModal
        isOpen={showPublishModal}
        onConfirm={handlePublishConfirm}
        onCancel={handlePublishCancel}
      />

      {reservePlot && siteId && (
        <ReservePlotModal
          isOpen={!!reservePlot}
          siteId={siteId}
          plotId={reservePlot.id}
          plotNumber={reservePlot.plot_number}
          inviteCode={reservePlot.invite_code}
          onClose={handleReserveClose}
          onComplete={handleReserveComplete}
        />
      )}

      {releasePlot && (
        <ReleaseReservationModal
          isOpen={!!releasePlot}
          plotId={releasePlot.id}
          plotNumber={releasePlot.plot_number}
          onClose={handleReleaseClose}
          onReleased={handleReleaseComplete}
        />
      )}
    </div>
  );
}
