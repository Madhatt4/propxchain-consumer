// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Pipeline kanban — read-only board showing all plots for a site
 * organised into 7 conveyancing pipeline columns.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { sitesService, type DevelopmentSite } from '@/services/sites.service';
import { plotsService, type Plot } from '@/services/plots.service';
import { plotTypesService } from '@/services/plot-types.service';
import KanbanColumn from '@/components/builder/KanbanColumn';
import PlotDetailDrawer from '@/components/builder/PlotDetailDrawer';

/** Column definition with label and filter predicate. */
interface ColumnDef {
  key: string;
  label: string;
  filter: (p: Plot) => boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'available',
    label: 'Available',
    filter: (p) =>
      p.reservation_status === 'available' && p.listing_status === 'published',
  },
  {
    key: 'reserved',
    label: 'Reserved',
    filter: (p) =>
      p.reservation_status === 'reserved' && !p.current_legal_status,
  },
  {
    key: 'aml_searches',
    label: 'AML & searches',
    filter: (p) =>
      ['aml_pending', 'searches_ordered', 'searches_received'].includes(
        p.current_legal_status ?? '',
      ),
  },
  {
    key: 'enquiries',
    label: 'Enquiries',
    filter: (p) =>
      ['enquiries_raised', 'enquiries_answered'].includes(
        p.current_legal_status ?? '',
      ),
  },
  {
    key: 'mortgage',
    label: 'Mortgage offer',
    filter: (p) =>
      ['mortgage_offer_uploaded', 'mortgage_approved'].includes(
        p.current_legal_status ?? '',
      ),
  },
  {
    key: 'exchanged',
    label: 'Exchanged',
    filter: (p) => p.current_legal_status === 'exchanged',
  },
  {
    key: 'completed',
    label: 'Completed',
    filter: (p) => p.current_legal_status === 'completed',
  },
];

const BUILD_PHASES = [
  'all',
  'foundation',
  'structure',
  'fit-out',
  'practical completion',
] as const;

type BuildPhase = (typeof BUILD_PHASES)[number];

export default function PipelineKanbanPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();

  const [site, setSite] = useState<DevelopmentSite | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plotTypeMap, setPlotTypeMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

  // Filters
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('all');

  const fetchData = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [siteData, plotsData, plotTypes] = await Promise.all([
        sitesService.getById(siteId),
        plotsService.getBySite(siteId),
        plotTypesService.getBySite(siteId),
      ]);
      setSite(siteData);
      setPlots(plotsData);
      const map = new Map<string, string>();
      for (const pt of plotTypes) {
        map.set(pt.id, pt.name);
      }
      setPlotTypeMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Published plots only, with filters applied. */
  const filteredPlots = useMemo((): Plot[] => {
    let result = plots.filter(
      (p) => p.listing_status === 'published' || p.reservation_status !== 'available',
    );
    if (atRiskOnly) {
      result = result.filter((p) => p.at_risk_flag);
    }
    if (buildPhase !== 'all') {
      const normalised = buildPhase.replace(/ /g, '_');
      result = result.filter((p) => p.current_build_status === normalised);
    }
    return result;
  }, [plots, atRiskOnly, buildPhase]);

  /** Bucket plots into columns. Unmatched go to Available. */
  const columnData = useMemo((): Map<string, Plot[]> => {
    const buckets = new Map<string, Plot[]>();
    for (const col of COLUMNS) {
      buckets.set(col.key, []);
    }

    for (const plot of filteredPlots) {
      let placed = false;
      // Check columns 2-7 first (non-fallback)
      for (let i = 1; i < COLUMNS.length; i++) {
        if (COLUMNS[i].filter(plot)) {
          buckets.get(COLUMNS[i].key)!.push(plot);
          placed = true;
          break;
        }
      }
      // Fallback: column 1 (Available) if explicitly matches OR unmatched
      if (!placed) {
        buckets.get('available')!.push(plot);
      }
    }
    return buckets;
  }, [filteredPlots]);

  if (isLoading) {
    return <SkeletonBoard />;
  }

  if (error || !site) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 text-center">
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

  if (plots.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <PageHeader site={site} siteId={siteId!} />
        <div className="mt-16 text-center">
          <p className="font-[DM_Sans] text-base text-[var(--text-secondary)]">
            No plots yet.
          </p>
          <Link
            to={`/builder/sites/${siteId}/plots/new`}
            className="mt-3 inline-flex items-center font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:text-[#0F766E]"
          >
            Create first plot
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader site={site} siteId={siteId!} />

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={atRiskOnly}
            onChange={(e) => setAtRiskOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-color)] text-[#0D9488] focus:ring-[#0D9488]"
          />
          At risk only
        </label>

        <select
          value={buildPhase}
          onChange={(e) => setBuildPhase(e.target.value as BuildPhase)}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 font-[DM_Sans] text-sm text-[var(--text-secondary)] dark:bg-[#0F1729]"
        >
          {BUILD_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {phase === 'all' ? 'All build phases' : phase.charAt(0).toUpperCase() + phase.slice(1)}
            </option>
          ))}
        </select>

        <select
          disabled
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 font-[DM_Sans] text-sm text-[var(--text-muted)] dark:bg-[#0F1729]"
        >
          <option>All conveyancers</option>
        </select>
      </div>

      {/* Kanban columns */}
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            label={col.label}
            plots={columnData.get(col.key) ?? []}
            siteId={siteId!}
            plotTypeMap={plotTypeMap}
            onPlotClick={setSelectedPlot}
          />
        ))}
      </div>

      {/* Plot detail drawer */}
      <PlotDetailDrawer
        isOpen={selectedPlot !== null}
        plot={selectedPlot}
        plotTypeName={
          selectedPlot?.plot_type_id
            ? (plotTypeMap.get(selectedPlot.plot_type_id) ?? null)
            : null
        }
        siteId={siteId!}
        onClose={() => setSelectedPlot(null)}
        onPlotUpdated={() => {
          setSelectedPlot(null);
          fetchData();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PageHeader({
  site,
  siteId,
}: {
  site: DevelopmentSite;
  siteId: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <Link
        to={`/builder/sites/${siteId}`}
        className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-section)] hover:text-[var(--text-main)]"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div>
        <h1 className="font-[Fraunces] text-2xl font-semibold text-[var(--text-main)]">
          {site.name}
        </h1>
        <p className="font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          Pipeline
        </p>
      </div>
    </div>
  );
}

function SkeletonBoard(): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-md bg-[var(--bg-section)]" />
        <div>
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--bg-section)]" />
          <div className="mt-1 h-4 w-20 animate-pulse rounded bg-[var(--bg-section)]" />
        </div>
      </div>
      <div className="mt-10 flex gap-4 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="min-w-[240px] w-[240px]">
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--bg-section)]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="h-20 animate-pulse rounded-md bg-[var(--bg-section)]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
