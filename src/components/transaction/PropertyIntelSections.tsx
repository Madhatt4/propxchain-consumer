// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Pure summary helpers for the free property report (status and one-line
 * finding per source), used by the PDF summary, plus the form-anomalies list.
 * The on-screen report itself is the document in ./report.
 *
 * Everything here renders free, open-government UK data only. No paid
 * searches, no valuation model, no portal listings.
 */

import type { ReactElement, ReactNode } from 'react';

import type {
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
} from '../../services/propertyIntelligenceService';
import type { CrossReferenceResult } from '../../services/formCrossReferenceService';

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

// ============================================
// Per-source detail sections
// ============================================

// ============================================
// EPC (energy performance) + £/m²
// ============================================

// ============================================
// Anomalies (seller TA6/TA7 cross-reference)
// ============================================

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
