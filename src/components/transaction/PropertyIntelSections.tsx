// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Presentational building blocks for the free property-intelligence panel.
 *
 * These are the leaf components and pure helpers the panel is assembled
 * from — RAG tiles, the per-source detail cards, the trusted-sources strip,
 * and the technical sources footer. Kept separate from the shell
 * (`PropertyIntelligenceCard`) so the data-fetching container stays small
 * and each piece is independently readable.
 *
 * Everything here renders free, open-government UK data only. No paid
 * searches, no valuation model, no portal listings.
 */

import type { ReactElement, ReactNode } from 'react';

import type {
  PropertyIntelligenceReport,
  FloodRiskData,
  HeritageData,
  Article4Data,
  TreePreservationData,
  BrownfieldData,
  FloodZoneData,
  EnvironmentalData,
  PlanningApplicationsData,
  PricePaidData,
  EpcCertificate,
  EpcBand,
} from '../../services/propertyIntelligenceService';
import type { CrossReferenceResult } from '../../services/formCrossReferenceService';
import { safeExternalUrl } from '@/utils/externalUrl';

// ============================================
// Shared status model
// ============================================

export type Status = 'low' | 'medium' | 'high' | 'unknown';
/** Tone adds a neutral 'info' option for non-risk categories (e.g. sold prices). */
export type Tone = Status | 'info';

export function heritageSummaryStatus(data: HeritageData | null | undefined): Status {
  if (!data) return 'unknown';
  switch (data.status) {
    case 'none':
      return 'low';
    case 'in_conservation_area':
      return 'medium';
    case 'listed_building':
    case 'both':
      return 'high';
    default:
      return 'unknown';
  }
}

export function article4SummaryStatus(data: Article4Data | null | undefined): Status {
  if (!data) return 'unknown';
  // A restriction worth attention (it can block permitted-development works),
  // not a hazard — amber, not red.
  return data.status === 'restricted' ? 'medium' : 'low';
}

export function treePreservationSummaryStatus(data: TreePreservationData | null | undefined): Status {
  if (!data) return 'unknown';
  return data.status === 'present' ? 'medium' : 'low';
}

export function brownfieldSummaryStatus(data: BrownfieldData | null | undefined): Status {
  if (!data) return 'unknown';
  // Informational, not a hazard: previously-developed land flagged for attention.
  return data.status === 'present' ? 'medium' : 'low';
}

export function floodZoneSummaryStatus(data: FloodZoneData | null | undefined): Status {
  if (!data) return 'unknown';
  switch (data.status) {
    case 'none':
      return 'low';
    case 'zone_2':
    case 'zone_present':
      return 'medium';
    case 'zone_3':
      return 'high';
    default:
      return 'unknown';
  }
}

export function environmentalSummaryStatus(data: EnvironmentalData | null | undefined): Status {
  if (!data) return 'unknown';
  switch (data.status) {
    case 'none':
      return 'low';
    case 'single':
      return 'medium';
    case 'multiple':
      return 'high';
    default:
      return 'unknown';
  }
}

export function planningSummaryStatus(data: PlanningApplicationsData | null | undefined): Status {
  if (!data) return 'unknown';
  switch (data.status) {
    case 'none':
      return 'low';
    case 'some':
      return 'medium';
    case 'many':
      return 'high';
    default:
      return 'unknown';
  }
}

// ============================================
// At-a-glance summary text per category (for the hero tiles)
// ============================================

export function floodSummaryText(data: FloodRiskData | null | undefined): string {
  if (!data) return 'Source unavailable';
  const live = data.activeWarnings.filter((w) => w.severity !== 'no_longer_in_force');
  if (live.length === 0) return 'No active warnings';
  return `${live.length} active ${live.length === 1 ? 'warning' : 'warnings'}`;
}

export function floodZoneSummaryText(data: FloodZoneData | null | undefined): string {
  if (!data) return 'Source unavailable';
  switch (data.status) {
    case 'none':
      return 'Not in a flood zone';
    case 'zone_2':
      return 'In Flood Zone 2';
    case 'zone_3':
      return 'In Flood Zone 3';
    default:
      return 'Flood zone present';
  }
}

export function article4SummaryText(data: Article4Data | null | undefined): string {
  if (!data) return 'Source unavailable';
  if (data.status === 'none') return 'Full PD rights';
  const n = data.directions.length;
  return `${n} Article 4 direction${n === 1 ? '' : 's'}`;
}

export function treePreservationSummaryText(data: TreePreservationData | null | undefined): string {
  if (!data) return 'Source unavailable';
  if (data.status === 'none') return 'No TPO zone';
  const n = data.zones.length;
  return `${n} TPO zone${n === 1 ? '' : 's'}`;
}

export function brownfieldSummaryText(data: BrownfieldData | null | undefined): string {
  if (!data) return 'Source unavailable';
  return data.status === 'present' ? 'On brownfield register' : 'Not on register';
}

export function heritageSummaryText(data: HeritageData | null | undefined): string {
  if (!data) return 'Source unavailable';
  switch (data.status) {
    case 'none':
      return 'No designations';
    case 'in_conservation_area':
      return 'Conservation area';
    case 'listed_building':
      return 'Listed building';
    case 'both':
      return 'Listed + conservation';
    default:
      return '—';
  }
}

export function environmentalSummaryText(data: EnvironmentalData | null | undefined): string {
  if (!data) return 'Source unavailable';
  const n = data.designations.length;
  if (n === 0) return 'No designations';
  return `${n} designation${n === 1 ? '' : 's'}`;
}

export function planningSummaryText(data: PlanningApplicationsData | null | undefined): string {
  if (!data) return 'Source unavailable';
  if (data.total === 0) return 'None nearby';
  return `${data.total} nearby`;
}

export function priceSummaryText(data: PricePaidData | null | undefined): string {
  if (!data) return 'Source unavailable';
  if (data.sales.length === 0) return 'No recorded sales';
  if (data.averagePrice !== null) return `Avg ${formatPrice(data.averagePrice)}`;
  return `${data.sales.length} sales`;
}

export function epcSummaryText(epc: EpcCertificate | null | undefined): string {
  if (!epc) return 'Source unavailable';
  return `Band ${epc.currentBand}`;
}

/** Tone for the EPC dot: A–C good, D–E middling, F–G poor (also MEES fails). */
export function epcTone(epc: EpcCertificate | null | undefined): Tone {
  if (!epc) return 'info';
  if (['A', 'B', 'C'].includes(epc.currentBand)) return 'low';
  if (['D', 'E'].includes(epc.currentBand)) return 'medium';
  return 'high';
}

// ============================================
// Small helpers
// ============================================

export function datasetLabel(dataset: string): string {
  switch (dataset) {
    case 'green-belt':
      return 'Green Belt';
    case 'site-of-special-scientific-interest':
      return 'SSSI';
    case 'area-of-outstanding-natural-beauty':
      return 'AONB';
    case 'national-park':
      return 'National Park';
    case 'ancient-woodland':
      return 'Ancient Woodland';
    default:
      return dataset;
  }
}

export function planningStateColor(state: string): string {
  const lower = state.toLowerCase();
  if (lower.includes('approved') || lower.includes('permitted') || lower.includes('granted')) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (lower.includes('refused') || lower.includes('rejected')) {
    return 'text-red-600 dark:text-red-400';
  }
  if (lower.includes('withdrawn')) {
    return 'text-gray-500 dark:text-gray-400';
  }
  return 'text-amber-600 dark:text-amber-400';
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function formatPrice(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function toneDotClass(tone: Tone): string {
  switch (tone) {
    case 'low':
      return 'bg-emerald-400';
    case 'medium':
      return 'bg-amber-400';
    case 'high':
      return 'bg-red-400';
    case 'info':
      return 'bg-teal-300';
    default:
      return 'bg-gray-400';
  }
}

function statusChipClass(status: Status): string {
  switch (status) {
    case 'low':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'medium':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'high':
      return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  }
}

// ============================================
// Hero RAG tile
// ============================================

interface CategoryTileProps {
  /** Visible heading on the tile, e.g. "Flood risk". */
  title: string;
  /** Tone for the status dot. */
  tone: Tone;
  /** One-line plain-language summary, e.g. "No active warnings". */
  summary: string;
  /**
   * When set, the tile is a risk category and exposes an accessible
   * `"{riskLabel} risk: {status}"` label (consumed by tests + screen readers).
   */
  riskLabel?: string;
  /** Risk status used only when `riskLabel` is set. */
  status?: Status;
  /** When set, the tile is a selectable button that drives the detail pane. */
  onSelect?: () => void;
  /** Whether this tile is the currently-selected source. */
  active?: boolean;
}

export function CategoryTile({
  title,
  tone,
  summary,
  riskLabel,
  status,
  onSelect,
  active,
}: CategoryTileProps): ReactElement {
  const ariaLabel = riskLabel && status ? `${riskLabel} risk: ${status}` : title;
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-[DM_Sans] text-xs font-medium text-white/85">{title}</span>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClass(tone)}`} aria-hidden="true" />
      </div>
      <span className="mt-1 block font-[DM_Sans] text-sm font-semibold leading-tight text-white">
        {summary}
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
          active
            ? 'border-white/70 bg-white/25 ring-1 ring-white/60'
            : 'border-white/15 bg-white/10 hover:bg-white/20'
        }`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5" aria-label={ariaLabel}>
      {inner}
    </div>
  );
}

// ============================================
// Detail card wrapper + status chip
// ============================================

function StatusChip({ status }: { status: Status }): ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-[DM_Sans] text-[11px] font-medium uppercase tracking-wide ${statusChipClass(status)}`}
    >
      {status}
    </span>
  );
}

export function DetailCard({
  title,
  status,
  children,
}: {
  title: string;
  status?: Status;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-[Fraunces] text-sm font-semibold text-gray-900 dark:text-gray-50">
          {title}
        </h3>
        {status && <StatusChip status={status} />}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="font-[DM_Sans] text-sm text-gray-500 dark:text-gray-400">{children}</p>
  );
}

// ============================================
// Per-source detail sections
// ============================================

export function FloodRiskSection({ data }: { data: FloodRiskData | null }): ReactElement {
  return (
    <DetailCard title="Flood risk" status={data ? data.status : undefined}>
      {!data && <EmptyNote>Environment Agency data unavailable. Try again shortly.</EmptyNote>}
      {data && data.activeWarnings.length === 0 && (
        <EmptyNote>No active flood warnings within 10km.</EmptyNote>
      )}
      {data && data.activeWarnings.length > 0 && (
        <ul className="divide-y divide-gray-200/70 dark:divide-gray-800">
          {data.activeWarnings.map((w, idx) => (
            <li key={`${w.timeRaised}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
              <div className="font-[DM_Sans] text-sm font-medium text-gray-900 dark:text-gray-50">
                {w.area}
              </div>
              <div className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
                Severity {w.severityLevel} · {w.severity.replace(/_/g, ' ')} · raised{' '}
                {new Date(w.timeRaised).toLocaleString()}
              </div>
              {w.description && (
                <div className="mt-1 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                  {w.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

export function FloodZoneSection({ data }: { data: FloodZoneData | null }): ReactElement {
  return (
    <DetailCard title="Flood zone (planning)" status={data ? floodZoneSummaryStatus(data) : undefined}>
      {!data && <EmptyNote>Planning flood-zone data unavailable.</EmptyNote>}
      {data && data.zones.length === 0 && (
        <EmptyNote>Property is not in a designated flood risk zone.</EmptyNote>
      )}
      {data && data.zones.length > 0 && (
        <ul className="space-y-1">
          {data.zones.map((z) => (
            <li key={z.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
              {z.name}
              {z.reference && (
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({z.reference})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

// Every data-driven link on this page goes through here or safeExternalUrl:
// source URLs come from third-party APIs and must never render as javascript:.
function SourceLink({ href }: { href: string }): ReactElement | null {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-2 text-xs text-[#0D9488] hover:underline dark:text-[#14B8A6]"
    >
      source
    </a>
  );
}

export function HeritageSection({ data }: { data: HeritageData | null }): ReactElement {
  return (
    <DetailCard title="Heritage" status={data ? heritageSummaryStatus(data) : undefined}>
      {!data && <EmptyNote>planning.data.gov.uk data unavailable.</EmptyNote>}
      {data &&
        data.listedBuildings.length === 0 &&
        data.conservationAreas.length === 0 &&
        (data.scheduledMonuments?.length ?? 0) === 0 &&
        (data.worldHeritageSites?.length ?? 0) === 0 && (
          <EmptyNote>
            No listed buildings, conservation areas, scheduled monuments or World Heritage Sites
            intersect this location.
          </EmptyNote>
        )}
      {data && data.listedBuildings.length > 0 && (
        <div>
          <div className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Listed building ({data.listedBuildings.length})
          </div>
          <ul className="mt-1 space-y-1">
            {data.listedBuildings.map((b) => (
              <li key={b.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {b.name}
                {b.grade && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Grade {b.grade}
                  </span>
                )}
                {b.documentUrl && <SourceLink href={b.documentUrl} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && data.conservationAreas.length > 0 && (
        <div className="mt-2">
          <div className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Conservation area ({data.conservationAreas.length})
          </div>
          <ul className="mt-1 space-y-1">
            {data.conservationAreas.map((c) => (
              <li key={c.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {c.name}
                {c.documentUrl && <SourceLink href={c.documentUrl} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && (data.scheduledMonuments?.length ?? 0) > 0 && (
        <div className="mt-2">
          <div className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Scheduled monument ({data.scheduledMonuments?.length})
          </div>
          <ul className="mt-1 space-y-1">
            {(data.scheduledMonuments ?? []).map((m) => (
              <li key={m.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {m.name}
                {m.documentUrl && <SourceLink href={m.documentUrl} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && (data.worldHeritageSites?.length ?? 0) > 0 && (
        <div className="mt-2">
          <div className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            World Heritage Site ({data.worldHeritageSites?.length})
          </div>
          <ul className="mt-1 space-y-1">
            {(data.worldHeritageSites ?? []).map((w) => (
              <li key={w.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {w.name}
                {w.documentUrl && <SourceLink href={w.documentUrl} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DetailCard>
  );
}

export function Article4Section({ data }: { data: Article4Data | null }): ReactElement {
  return (
    <DetailCard title="Permitted development (Article 4)" status={data ? article4SummaryStatus(data) : undefined}>
      {!data && <EmptyNote>planning.data.gov.uk data unavailable.</EmptyNote>}
      {data && data.directions.length === 0 && (
        <EmptyNote>
          No Article 4 directions intersect this location — permitted-development rights are not
          restricted here. Confirm against the official local search.
        </EmptyNote>
      )}
      {data && data.directions.length > 0 && (
        <>
          <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
            An Article 4 direction removes some permitted-development rights — planning permission
            may be needed for works that would otherwise be automatic. Indicative; the official
            local search is authoritative.
          </p>
          <ul className="mt-2 space-y-2">
            {data.directions.map((d) => (
              <li key={d.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-50">{d.name}</span>
                {d.documentUrl && <SourceLink href={d.documentUrl} />}
                {d.detail && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {truncate(d.detail, 220)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

export function TreePreservationSection({ data }: { data: TreePreservationData | null }): ReactElement {
  return (
    <DetailCard title="Tree preservation (TPO)" status={data ? treePreservationSummaryStatus(data) : undefined}>
      {!data && <EmptyNote>planning.data.gov.uk data unavailable.</EmptyNote>}
      {data && data.zones.length === 0 && (
        <EmptyNote>
          No Tree Preservation Order zone intersects this location. Confirm against the official
          local search.
        </EmptyNote>
      )}
      {data && data.zones.length > 0 && (
        <>
          <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
            A Tree Preservation Order means consent is needed to fell, top or lop the protected
            trees. Indicative; the official local search is authoritative.
          </p>
          <ul className="mt-2 space-y-1">
            {data.zones.map((z) => (
              <li key={z.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {z.name}
                {z.reference && (
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({z.reference})</span>
                )}
                {z.documentUrl && <SourceLink href={z.documentUrl} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

export function BrownfieldSection({ data }: { data: BrownfieldData | null }): ReactElement {
  return (
    <DetailCard title="Brownfield land" status={data ? brownfieldSummaryStatus(data) : undefined}>
      {!data && <EmptyNote>planning.data.gov.uk data unavailable.</EmptyNote>}
      {data && data.sites.length === 0 && (
        <EmptyNote>Not on a local authority brownfield (previously-developed) land register.</EmptyNote>
      )}
      {data && data.sites.length > 0 && (
        <>
          <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
            On a brownfield (previously-developed) land register. Indicative of development history —
            not a contamination assessment.
          </p>
          <ul className="mt-2 space-y-1">
            {data.sites.map((s) => (
              <li key={s.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                {s.name}
                {s.documentUrl && <SourceLink href={s.documentUrl} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

export function EnvironmentalSection({ data }: { data: EnvironmentalData | null }): ReactElement {
  return (
    <DetailCard
      title="Environmental designations"
      status={data ? environmentalSummaryStatus(data) : undefined}
    >
      {!data && <EmptyNote>Environmental designation data unavailable.</EmptyNote>}
      {data && data.designations.length === 0 && (
        <EmptyNote>
          No Green Belt, SSSI, AONB, National Park, or ancient woodland intersects this location.
        </EmptyNote>
      )}
      {data && data.designations.length > 0 && (
        <ul className="space-y-1">
          {data.designations.map((d) => (
            <li key={d.entity} className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {datasetLabel(d.dataset)}
              </span>
              <span className="ml-2">{d.name}</span>
              {d.documentUrl && <SourceLink href={d.documentUrl} />}
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

export function PlanningApplicationsSection({
  data,
}: {
  data: PlanningApplicationsData | null;
}): ReactElement {
  return (
    <DetailCard
      title="Planning applications (within 300m)"
      status={data ? planningSummaryStatus(data) : undefined}
    >
      {!data && <EmptyNote>UK PlanIt data unavailable.</EmptyNote>}
      {data && data.applications.length === 0 && (
        <EmptyNote>No recent planning applications found nearby.</EmptyNote>
      )}
      {data && data.applications.length > 0 && (
        <>
          <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
            Showing {data.applications.length} of {data.total} applications, most recent first.
          </p>
          <ul className="mt-2 divide-y divide-gray-200/70 dark:divide-gray-800">
            {data.applications.slice(0, 10).map((app) => (
              <li key={app.uid || app.reference} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-[DM_Sans] text-xs font-medium text-gray-700 dark:text-gray-300">
                    {app.reference}
                  </span>
                  <span
                    className={`font-[DM_Sans] text-xs font-medium ${planningStateColor(app.appState)}`}
                  >
                    {app.appState}
                  </span>
                </div>
                {app.description && (
                  <p className="mt-1 font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">
                    {truncate(app.description, 160)}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-between font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {app.distanceM}m away
                    {app.startDate && ` · raised ${app.startDate}`}
                  </span>
                  {safeExternalUrl(app.url) && (
                    <a
                      href={safeExternalUrl(app.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0D9488] hover:underline dark:text-[#14B8A6]"
                    >
                      view on council site
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

export function PriceHistorySection({ data }: { data: PricePaidData | null }): ReactElement {
  return (
    <DetailCard title="Sale history (this postcode)">
      {!data && <EmptyNote>Land Registry price-paid data unavailable.</EmptyNote>}
      {data && data.sales.length === 0 && (
        <EmptyNote>No recent sales recorded at this postcode.</EmptyNote>
      )}
      {data && data.sales.length > 0 && (
        <>
          <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
            {data.sales.length} sales found · average{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {formatPrice(data.averagePrice)}
            </span>
            {data.latestSale && (
              <>
                {' '}
                · most recent {formatPrice(data.latestSale.amount)} on {data.latestSale.date}
              </>
            )}
          </p>
          <ul className="mt-2 space-y-1">
            {data.sales.slice(0, 8).map((s, idx) => (
              <li
                key={`${s.date}-${s.paon}-${idx}`}
                className="flex items-center justify-between font-[DM_Sans] text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {s.paon}
                  {s.street && ` ${s.street}`}
                  {s.propertyType && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      ({s.propertyType})
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-gray-600 dark:text-gray-400">
                  {formatPrice(s.amount)}
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{s.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
  );
}

// ============================================
// EPC (energy performance) + £/m²
// ============================================

function epcBandClass(band: EpcBand): string {
  switch (band) {
    case 'A':
      return 'bg-emerald-600 text-white';
    case 'B':
      return 'bg-emerald-500 text-white';
    case 'C':
      return 'bg-lime-500 text-white';
    case 'D':
      return 'bg-yellow-400 text-gray-900';
    case 'E':
      return 'bg-amber-500 text-white';
    case 'F':
      return 'bg-orange-500 text-white';
    case 'G':
      return 'bg-red-600 text-white';
  }
}

function EpcBandBadge({ band }: { band: EpcBand }): ReactElement {
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-[Fraunces] text-sm font-bold ${epcBandClass(band)}`}
      aria-label={`EPC band ${band}`}
    >
      {band}
    </span>
  );
}

export function EpcSection({
  epc,
  valuePerSqm,
}: {
  epc: EpcCertificate | null;
  valuePerSqm: number | null;
}): ReactElement {
  return (
    <DetailCard title="Energy performance (EPC)">
      {!epc && <EmptyNote>No EPC found for this property on the register.</EmptyNote>}
      {epc && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <EpcBandBadge band={epc.currentBand} />
              <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
                Current
                {epc.currentRating !== null && (
                  <span className="ml-1 text-gray-700 dark:text-gray-300">{epc.currentRating}</span>
                )}
              </span>
            </div>
            {epc.potentialBand && (
              <div className="flex items-center gap-2">
                <EpcBandBadge band={epc.potentialBand} />
                <span className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
                  Potential
                  {epc.potentialRating !== null && (
                    <span className="ml-1 text-gray-700 dark:text-gray-300">
                      {epc.potentialRating}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-[DM_Sans] text-sm">
            {epc.floorAreaSqm !== null && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Floor area</dt>
                <dd className="tabular-nums text-gray-800 dark:text-gray-200">
                  {epc.floorAreaSqm} m²
                </dd>
              </div>
            )}
            {valuePerSqm !== null && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Est. £/m²</dt>
                <dd className="tabular-nums text-gray-800 dark:text-gray-200">
                  {formatPrice(valuePerSqm)}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-[DM_Sans] text-[11px] font-medium ${
                epc.meetsMees
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              {epc.meetsMees ? 'Meets MEES (band E+)' : 'Below MEES (band F/G)'}
            </span>
            {epc.lodgementDate && (
              <span className="font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">
                Lodged {epc.lodgementDate}
              </span>
            )}
          </div>

          {valuePerSqm !== null && (
            <p className="font-[DM_Sans] text-[11px] text-gray-400 dark:text-gray-500">
              £/m² estimated from the most recent postcode sale ÷ this EPC&apos;s floor area. An
              indicator, not a valuation.
            </p>
          )}
        </div>
      )}
    </DetailCard>
  );
}

// ============================================
// Anomalies (seller TA6/TA7 cross-reference)
// ============================================

export function AnomalyCountBadge({ anomalies }: { anomalies: CrossReferenceResult[] }): ReactElement {
  const n = anomalies.length;
  const hasCritical = anomalies.some((a) => a.severity === 'critical');
  const hasWarning = anomalies.some((a) => a.severity === 'warning');
  const tone = hasCritical
    ? 'bg-red-500/20 text-red-50 border-red-300/40'
    : hasWarning
      ? 'bg-amber-500/20 text-amber-50 border-amber-200/40'
      : 'bg-white/15 text-white border-white/30';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-[DM_Sans] text-xs font-medium ${tone}`}
      aria-label={`Anomalies: ${n}`}
    >
      Anomalies: {n}
    </span>
  );
}

export function AnomaliesSection({
  anomalies,
}: {
  anomalies: CrossReferenceResult[];
}): ReactElement | null {
  if (anomalies.length === 0) return null;
  return (
    <div className="md:col-span-2" aria-label="Form cross-reference anomalies">
      <DetailCard title={`Anomalies (${anomalies.length})`}>
        <p className="font-[DM_Sans] text-xs text-gray-500 dark:text-gray-400">
          Cross-reference between seller-declared TA6/TA7 answers and property intel sources.
        </p>
        <ul className="mt-2 divide-y divide-gray-200/70 dark:divide-gray-800">
          {anomalies.map((a, idx) => (
            <li key={`${a.formField}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    a.severity === 'critical'
                      ? 'bg-red-500'
                      : a.severity === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-[#0D9488]'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {a.severity} · {a.formSection}
                </span>
              </div>
              <p className="mt-1 font-[DM_Sans] text-sm text-gray-900 dark:text-gray-100">
                {a.message}
              </p>
              <p className="mt-1 font-[DM_Sans] text-xs text-gray-600 dark:text-gray-300">
                {a.suggestedAction}
              </p>
            </li>
          ))}
        </ul>
      </DetailCard>
    </div>
  );
}

// ============================================
// Trusted sources strip + technical footer
// ============================================

const TRUSTED_SOURCES: ReadonlyArray<{ name: string; detail: string }> = [
  { name: 'HM Land Registry', detail: 'Sold prices' },
  { name: 'Environment Agency', detail: 'Flood warnings' },
  { name: 'MHCLG Planning Data', detail: 'Heritage · flood zones' },
  { name: 'MHCLG EPC register', detail: 'Energy performance' },
  { name: 'Natural England', detail: 'Environmental designations' },
  { name: 'UK PlanIt', detail: 'Planning applications' },
  { name: 'Ordnance Survey', detail: 'Geocoding' },
];

export function TrustedSourcesStrip(): ReactElement {
  return (
    <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
      <p className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Verified open data from official UK sources
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TRUSTED_SOURCES.map((s) => (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-[DM_Sans] text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            title={s.detail}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" aria-hidden="true" />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SourcesFooter({ report }: { report: PropertyIntelligenceReport }): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
      <span className="font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">Endpoints:</span>
      {report.sources.map((s) => (
        <span
          key={s.source}
          className={`font-[DM_Sans] text-xs ${
            s.ok ? 'text-gray-500 dark:text-gray-400' : 'text-red-500 dark:text-red-400'
          }`}
          title={s.error ?? ''}
        >
          {s.source}
          {!s.ok && ' (error)'}
        </span>
      ))}
      <span className="ml-auto font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">
        Fetched {new Date(report.fetchedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}
