// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Free property-intelligence panel — the scroll-reveal "everything we know
 * about this property" section on the transaction flow dashboard, shown to
 * buyers and sellers alike.
 *
 * This shell handles data fetching (postcode → full intelligence report),
 * the outcode-completion prompt, and loading/empty states. The visual
 * pieces — hero, RAG tiles, per-source detail cards, trusted-sources strip —
 * live in `PropertyIntelSections`.
 *
 * Free, open-government UK data only (HMLR price paid, EA flood, MHCLG
 * planning/heritage/flood-zones, Natural England designations, UK PlanIt).
 * No paid searches, no valuation, no portal listings — those are a separate
 * layer. The card degrades gracefully when any single source is unavailable.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AlertCircle, Download, Loader2 } from 'lucide-react';

import {
  getPropertyIntelligence,
  type PropertyIntelligenceReport,
} from '../../services/propertyIntelligenceService';
import { getPropertyGeometry } from '../../services/propertyGeometryService';
import type { FeatureCollection } from 'geojson';

// Client-only: lazy so Leaflet (needs window) stays out of prerender/SSR.
const PropertyMap = lazy(() => import('../property/PropertyMap'));

/** Categories with planning-designation boundary geometry. A tile becomes an
 *  interactive map-layer toggle only when the property actually intersects one
 *  of its datasets. */
const LAYER_CATEGORIES: ReadonlyArray<{ key: string; datasets: string[] }> = [
  { key: 'flood-zone', datasets: ['flood-risk-zone'] },
  {
    key: 'heritage',
    datasets: ['conservation-area', 'listed-building', 'park-and-garden', 'scheduled-monument', 'world-heritage-site'],
  },
  {
    key: 'environment',
    datasets: ['green-belt', 'site-of-special-scientific-interest', 'area-of-outstanding-natural-beauty', 'national-park', 'ancient-woodland'],
  },
];

function datasetsInGeometry(g: FeatureCollection | null): Set<string> {
  const present = new Set<string>();
  for (const f of g?.features ?? []) {
    const d = (f.properties as Record<string, unknown> | null)?.['dataset'];
    if (typeof d === 'string') present.add(d);
  }
  return present;
}
import type { CrossReferenceResult } from '../../services/formCrossReferenceService';
import { postcodeService } from '../../services/postcodeService';
import { LoadingHouse } from '../ui/LoadingHouse';
import { PostcodeCompletionPrompt } from './PostcodeCompletionPrompt';
import HomeMoverReportPdf, {
  exportHomeMoverReportPdf,
} from './HomeMoverReportPdf';
import {
  CategoryTile,
  AnomalyCountBadge,
  FloodRiskSection,
  FloodZoneSection,
  HeritageSection,
  Article4Section,
  TreePreservationSection,
  BrownfieldSection,
  EnvironmentalSection,
  PlanningApplicationsSection,
  PriceHistorySection,
  EpcSection,
  AnomaliesSection,
  TrustedSourcesStrip,
  SourcesFooter,
  heritageSummaryStatus,
  article4SummaryStatus,
  treePreservationSummaryStatus,
  brownfieldSummaryStatus,
  floodZoneSummaryStatus,
  environmentalSummaryStatus,
  planningSummaryStatus,
  floodSummaryText,
  floodZoneSummaryText,
  heritageSummaryText,
  article4SummaryText,
  treePreservationSummaryText,
  brownfieldSummaryText,
  environmentalSummaryText,
  planningSummaryText,
  priceSummaryText,
  epcSummaryText,
  epcTone,
} from './PropertyIntelSections';

interface PropertyIntelligenceCardProps {
  postcode: string | null | undefined;
  /** Property address line — disambiguates the EPC certificate on the postcode. */
  addressLine?: string | null;
  /** UPRN — resolves the property's exact point, so flood/heritage/planning and
   *  the map use the precise pin instead of the postcode centroid. */
  uprn?: string | null;
  /** Optional override for tests — skip the fetch and use this report directly. */
  reportOverride?: PropertyIntelligenceReport | null;
  /** Optional flags surfaced under an "Anomalies" detail card. */
  anomalies?: CrossReferenceResult[];
  /** Show a "Download your report" button that saves the printable PDF.
   *  Off by default so in-app dashboard usage is unchanged; the landing page's
   *  free Home Mover Report turns it on. (The PDF used to be emailed from the
   *  browser via the waitlist Worker — removed, security scan 2026-09-23 H7:
   *  that route emailed any PDF to any address from our domain.) */
  downloadable?: boolean;
  /** Fires once each time a fresh report is fetched, so a parent can lift
   *  what it learned (e.g. the EPC band) into transaction state. */
  onReport?: (report: PropertyIntelligenceReport) => void;
}

/** In-hero download button for the printable report. */
function DownloadReportButton({
  isDownloading,
  onDownload,
}: {
  isDownloading: boolean;
  onDownload: () => void;
}): ReactElement {
  return (
    <div className="relative mt-4">
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/30 disabled:opacity-60"
      >
        {isDownloading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isDownloading ? 'Preparing your PDF…' : 'Download your report (PDF)'}
      </button>
    </div>
  );
}

export function PropertyIntelligenceCard({
  postcode,
  addressLine,
  uprn,
  reportOverride,
  anomalies,
  downloadable,
  onReport,
}: PropertyIntelligenceCardProps): ReactElement | null {
  // User-completed override when the imported postcode is outcode-only.
  // Lives in component state so the parent doesn't need to thread it back
  // through the listing; persistence is out of scope (postcodes.io is the
  // free tier, no audit need). When set, takes precedence over the prop.
  const [completedPostcode, setCompletedPostcode] = useState<string | null>(null);
  const effectivePostcode = completedPostcode ?? postcode ?? null;
  const needsCompletion =
    Boolean(postcode) && !completedPostcode && postcodeService.isOutcodeOnly(postcode ?? '');

  const [report, setReport] = useState<PropertyIntelligenceReport | null>(reportOverride ?? null);
  // Ref so a parent passing an inline callback doesn't retrigger the fetch.
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;
  const [isLoading, setIsLoading] = useState<boolean>(
    reportOverride === undefined && Boolean(effectivePostcode) && !needsCompletion,
  );

  useEffect(() => {
    if (reportOverride !== undefined) {
      setReport(reportOverride);
      setIsLoading(false);
      return;
    }
    if (!effectivePostcode) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    // Skip the fetch entirely until the user completes an outcode-only postcode.
    // postcodes.io 404s on outcode-only inputs — fetching here just burns a
    // request and renders a silent null card, which is worse than telling the
    // user what to do.
    if (postcodeService.isOutcodeOnly(effectivePostcode)) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getPropertyIntelligence(effectivePostcode, addressLine ?? undefined, uprn ?? undefined)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setIsLoading(false);
        onReportRef.current?.(r);
      })
      .catch(() => {
        if (cancelled) return;
        setReport(null);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectivePostcode, addressLine, uprn, reportOverride]);

  // Boundary geometry for the map. The card opens on the Location (street map)
  // view — the universal "where is it" entry point; the user clicks the other
  // source tiles from there.
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [selected, setSelected] = useState<string>('location');

  // Printable PDF (only mounted/used when `downloadable` is set).
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleDownload = async (): Promise<void> => {
    if (!report) return;
    setIsDownloading(true);
    try {
      await exportHomeMoverReportPdf(pdfRef, report);
    } catch {
      // exportHomeMoverReportPdf has already logged it; the button re-enables
      // so the visitor can simply try again.
    } finally {
      setIsDownloading(false);
    }
  };
  const lat = report?.location?.coordinates.lat;
  const lng = report?.location?.coordinates.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setGeometry(null);
      return;
    }
    let cancelled = false;
    getPropertyGeometry(lat, lng)
      .then((g) => {
        if (!cancelled) setGeometry(g);
      })
      .catch(() => {
        if (!cancelled) setGeometry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (!postcode) return null;

  // Outcode-only postcode (e.g. from a Rightmove import that only had "SG19").
  // Surface a one-input prompt so the user can unlock the intel panel. Once
  // they submit, completedPostcode is set and the effect above kicks off the
  // real fetch.
  if (needsCompletion) {
    return (
      <PostcodeCompletionPrompt
        outcode={postcode!}
        reason="We only have the outcode from your listing. Add the rest for flood risk, sold prices, planning, and heritage data."
        ctaLabel="Show property intelligence"
        onComplete={setCompletedPostcode}
      />
    );
  }

  if (isLoading) {
    // First open of the Property tab fans out to ~10 open-gov sources, so this
    // can take a few seconds. Tell the user what's happening rather than show a
    // silent grey box that reads as broken.
    return (
      <LoadingHouse
        title="Pulling your property data…"
        detail="Gathering flood risk, sold prices, planning history, heritage and more from free government sources."
      />
    );
  }

  if (!report) return null;

  // No geocode → every downstream source is null too. This happens when the
  // postcode is a valid *shape* but postcodes.io doesn't recognise it (a typo,
  // or a not-yet-issued code) — the form's format check passes but the lookup
  // 404s. Surface that instead of rendering a silent blank, which otherwise
  // reads as "broken" to a user who simply mistyped their postcode. (A single
  // failing source while location IS present still renders: that card degrades,
  // the rest stay rich. A hard fetch failure returns null above and stays null.)
  if (!report.location) {
    return (
      <div
        className="flex h-72 w-full flex-col items-center justify-center gap-4 rounded-2xl bg-gray-100 px-6 text-center dark:bg-gray-800"
        role="status"
        aria-live="polite"
      >
        <AlertCircle className="h-12 w-12 text-amber-500" aria-hidden="true" />
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          We couldn&apos;t find that postcode
        </p>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {effectivePostcode
            ? `“${effectivePostcode}” doesn’t match a known UK postcode.`
            : 'That postcode isn’t recognised.'}{' '}
          Check it and try again.
        </p>
      </div>
    );
  }

  const hasAnomalies = Boolean(anomalies && anomalies.length > 0);
  const floodStatus = report.flood?.status ?? 'unknown';

  const present = datasetsInGeometry(geometry);
  const selectedCat = LAYER_CATEGORIES.find((c) => c.key === selected);
  const selectedDatasets = selectedCat?.datasets ?? [];
  // Show the map when the selected source has a boundary to draw, or for the
  // dedicated Location tile (a detailed street map of the plot).
  const showMap = selected === 'location' || selectedDatasets.some((d) => present.has(d));
  const mapVariant: 'boundary' | 'street' = selected === 'location' ? 'street' : 'boundary';
  const pick = (key: string): { onSelect: () => void; active: boolean } => ({
    onSelect: () => setSelected(key),
    active: selected === key,
  });
  const detail = ((): ReactElement | null => {
    switch (selected) {
      case 'location':
        return null;
      case 'flood-zone':
        return <FloodZoneSection data={report.floodZone} />;
      case 'heritage':
        return <HeritageSection data={report.heritage} />;
      case 'article-4':
        return <Article4Section data={report.article4} />;
      case 'tpo':
        return <TreePreservationSection data={report.treePreservation} />;
      case 'brownfield':
        return <BrownfieldSection data={report.brownfield} />;
      case 'environment':
        return <EnvironmentalSection data={report.environmental} />;
      case 'planning':
        return <PlanningApplicationsSection data={report.planningApplications} />;
      case 'epc':
        return <EpcSection epc={report.epc} valuePerSqm={report.valuePerSqm} />;
      case 'sold-prices':
        return <PriceHistorySection data={report.pricePaid} />;
      default:
        return <FloodRiskSection data={report.flood} />;
    }
  })();

  return (
    <section
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/40"
      aria-label="Property intelligence"
    >
      {/* Hero — the scroll-reveal payoff. Address + at-a-glance RAG tiles. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 to-emerald-700 px-5 py-6 sm:px-6 dark:from-teal-900 dark:to-emerald-950">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[DM_Sans] text-xs font-medium uppercase tracking-wide text-teal-100/80">
              Free property intelligence
            </p>
            <h2 className="mt-1 font-[Fraunces] text-xl font-semibold text-white sm:text-2xl">
              Everything we know about this property
            </h2>
            <p className="mt-1 font-[DM_Sans] text-sm text-teal-50/90">
              {report.location.admin_district}, {report.location.postcode}
            </p>
            {report.localPlanningAuthority && (
              <p className="mt-0.5 font-[DM_Sans] text-xs text-teal-100/70">
                Local planning authority: {report.localPlanningAuthority.name}
              </p>
            )}
          </div>
          {hasAnomalies && <AnomalyCountBadge anomalies={anomalies ?? []} />}
        </div>

        {downloadable && <DownloadReportButton isDownloading={isDownloading} onDownload={handleDownload} />}

        {/* Two columns: selectable source tiles on the left; the selected
            source's detail on the right — the map for designations with a
            boundary, the data card otherwise. Replaces the old long scroll. */}
        <div className="relative mt-5 grid gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-2 content-start gap-2.5 lg:col-span-5">
            <CategoryTile title="Location" tone="info" summary="Plot & roads" {...pick('location')} />
            <CategoryTile
              title="Flood risk"
              riskLabel="Flood"
              status={floodStatus}
              tone={floodStatus}
              summary={floodSummaryText(report.flood)}
              {...pick('flood-risk')}
            />
            <CategoryTile
              title="Flood zone"
              riskLabel="Flood zone"
              status={floodZoneSummaryStatus(report.floodZone)}
              tone={floodZoneSummaryStatus(report.floodZone)}
              summary={floodZoneSummaryText(report.floodZone)}
              {...pick('flood-zone')}
            />
            <CategoryTile
              title="Heritage"
              riskLabel="Heritage"
              status={heritageSummaryStatus(report.heritage)}
              tone={heritageSummaryStatus(report.heritage)}
              summary={heritageSummaryText(report.heritage)}
              {...pick('heritage')}
            />
            <CategoryTile
              title="Permitted dev"
              riskLabel="Permitted development"
              status={article4SummaryStatus(report.article4)}
              tone={article4SummaryStatus(report.article4)}
              summary={article4SummaryText(report.article4)}
              {...pick('article-4')}
            />
            <CategoryTile
              title="Trees (TPO)"
              riskLabel="Tree preservation"
              status={treePreservationSummaryStatus(report.treePreservation)}
              tone={treePreservationSummaryStatus(report.treePreservation)}
              summary={treePreservationSummaryText(report.treePreservation)}
              {...pick('tpo')}
            />
            <CategoryTile
              title="Brownfield"
              riskLabel="Brownfield"
              status={brownfieldSummaryStatus(report.brownfield)}
              tone={brownfieldSummaryStatus(report.brownfield)}
              summary={brownfieldSummaryText(report.brownfield)}
              {...pick('brownfield')}
            />
            <CategoryTile
              title="Environment"
              riskLabel="Environment"
              status={environmentalSummaryStatus(report.environmental)}
              tone={environmentalSummaryStatus(report.environmental)}
              summary={environmentalSummaryText(report.environmental)}
              {...pick('environment')}
            />
            <CategoryTile
              title="Planning"
              riskLabel="Planning"
              status={planningSummaryStatus(report.planningApplications)}
              tone={planningSummaryStatus(report.planningApplications)}
              summary={planningSummaryText(report.planningApplications)}
              {...pick('planning')}
            />
            <CategoryTile
              title="Energy (EPC)"
              tone={epcTone(report.epc)}
              summary={epcSummaryText(report.epc)}
              {...pick('epc')}
            />
            <CategoryTile
              title="Sold prices"
              tone="info"
              summary={priceSummaryText(report.pricePaid)}
              {...pick('sold-prices')}
            />
          </div>

          <div className="lg:col-span-7">
            {showMap && (
              <div className={selected === 'location' ? 'h-[26rem]' : 'mb-3 h-64'}>
                <Suspense
                  fallback={<div className="h-full w-full animate-pulse rounded-lg bg-white/10" />}
                >
                  <PropertyMap
                    key={mapVariant}
                    lat={report.location.coordinates.lat}
                    lng={report.location.coordinates.lng}
                    label={report.location.postcode}
                    geometry={geometry}
                    activeDatasets={selectedDatasets}
                    variant={mapVariant}
                  />
                </Suspense>
              </div>
            )}
            {detail && <div className="max-h-[26rem] overflow-y-auto">{detail}</div>}
          </div>
        </div>
      </div>

      {/* Anomalies (form cross-reference flags) stay always-visible below the
          hero — they are warnings, not something to hide behind a tab. */}
      {hasAnomalies && (
        <div className="px-5 py-5">
          <AnomaliesSection anomalies={anomalies ?? []} />
        </div>
      )}

      <TrustedSourcesStrip />
      <SourcesFooter report={report} />

      {downloadable && <HomeMoverReportPdf ref={pdfRef} report={report} addressLine={addressLine} />}
    </section>
  );
}

export default PropertyIntelligenceCard;
