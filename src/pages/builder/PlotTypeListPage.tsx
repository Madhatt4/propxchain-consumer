// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * List page showing all plot types for a development site.
 * Route: /builder/sites/:siteId/plot-types
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Bed, Bath, PencilLine } from 'lucide-react';

import { plotTypesService, type PlotType } from '@/services/plot-types.service';

function formatPrice(pence: number | null): string {
  if (pence === null) return '--';
  return `\u00A3${(pence / 100).toLocaleString('en-GB')}`;
}

function PlotTypeCard({ plotType, siteId }: { plotType: PlotType; siteId: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 dark:hover:border-[#0D9488]/40 dark:hover:bg-[#0D9488]/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-[Fraunces] text-lg font-semibold text-[var(--text-main)]">
            {plotType.name}
          </h3>
          {plotType.description && (
            <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)] line-clamp-2">
              {plotType.description}
            </p>
          )}
        </div>
        <Link
          to={`/builder/sites/${siteId}/plot-types/${plotType.id}/edit`}
          className="ml-3 inline-flex min-h-10 items-center rounded-md border border-[var(--border-color)] px-3 py-2 font-[DM_Sans] text-sm text-[var(--text-secondary)] transition-colors hover:border-[#0D9488] hover:text-[#0D9488] dark:hover:border-[#0D9488] dark:hover:text-[#0D9488]"
        >
          <PencilLine className="mr-1.5 h-4 w-4" />
          Edit
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {plotType.bedrooms !== null && (
          <span className="inline-flex items-center gap-1.5 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            <Bed className="h-4 w-4" />
            {plotType.bedrooms} bed
          </span>
        )}
        {plotType.bathrooms !== null && (
          <span className="inline-flex items-center gap-1.5 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
            <Bath className="h-4 w-4" />
            {plotType.bathrooms} bath
          </span>
        )}
        {plotType.base_price_pence !== null && (
          <span className="ml-auto font-[DM_Sans] text-base font-semibold text-[var(--text-main)]">
            {formatPrice(plotType.base_price_pence)}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ siteId }: { siteId: string }): JSX.Element {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-section)] p-8 text-center">
      <p className="font-[DM_Sans] text-sm text-[var(--text-secondary)]">
        No plot types yet. Create your first house type to get started.
      </p>
      <Link
        to={`/builder/sites/${siteId}/plot-types/new`}
        className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        New plot type
      </Link>
    </div>
  );
}

export default function PlotTypeListPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();
  const [plotTypes, setPlotTypes] = useState<PlotType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlotTypes = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await plotTypesService.getBySite(siteId);
      setPlotTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plot types.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchPlotTypes();
  }, [fetchPlotTypes]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="font-[DM_Sans] text-base text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchPlotTypes}
          className="mt-4 inline-flex items-center rounded-lg bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
        >
          Retry
        </button>
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
        <h1 className="flex-1 font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          Plot types
        </h1>
        {plotTypes.length > 0 && (
          <Link
            to={`/builder/sites/${siteId}/plot-types/new`}
            className="inline-flex min-h-11 items-center rounded-md bg-[#0D9488] px-5 py-2.5 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New plot type
          </Link>
        )}
      </div>

      {/* List or empty */}
      {plotTypes.length === 0 ? (
        <EmptyState siteId={siteId!} />
      ) : (
        <ul className="mt-6 space-y-3">
          {plotTypes.map((pt) => (
            <li key={pt.id}>
              <PlotTypeCard plotType={pt} siteId={siteId!} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
