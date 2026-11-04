// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Free property report — shown on /property-check and inside a transaction,
 * to buyers and sellers alike.
 *
 * This shell handles data fetching (postcode → full intelligence report), the
 * outcode-completion prompt, loading, not-found and failed-load states, and
 * the PDF download. The report itself is the document-style `PropertyReport`
 * in ./report: one readable page with a section bar, real values per section
 * and who-to-ask checklists.
 *
 * Free, open-government UK data only. No paid searches, no valuation, no
 * portal listings. Each section degrades on its own when its source is down.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AlertCircle, Download, Loader2, RotateCcw } from 'lucide-react';
import type { FeatureCollection } from 'geojson';

import {
  getPropertyIntelligence,
  type PropertyIntelligenceReport,
} from '../../services/propertyIntelligenceService';
import { getPropertyGeometry } from '../../services/propertyGeometryService';
import type { CrossReferenceResult } from '../../services/formCrossReferenceService';
import { postcodeService } from '../../services/postcodeService';
import { LoadingHouse } from '../ui/LoadingHouse';

import HomeMoverReportPdf, { exportHomeMoverReportPdf } from './HomeMoverReportPdf';
import { PostcodeCompletionPrompt } from './PostcodeCompletionPrompt';
import { PropertyReport } from './report/PropertyReport';

interface PropertyIntelligenceCardProps {
  postcode: string | null | undefined;
  /** Property address line — disambiguates the EPC certificate on the postcode. */
  addressLine?: string | null;
  /** UPRN — resolves the property's exact point, so flood/heritage/planning and
   *  the map use the precise pin instead of the postcode centroid. */
  uprn?: string | null;
  /** Optional override for tests — skip the fetch and use this report directly. */
  reportOverride?: PropertyIntelligenceReport | null;
  /** Optional form cross-reference flags, shown under the summary. */
  anomalies?: CrossReferenceResult[];
  /** Show a "Download PDF" button that saves the printable report. Off by
   *  default so in-app dashboard usage is unchanged; /property-check turns it
   *  on. (The PDF used to be emailed from the browser via the waitlist Worker —
   *  removed, security scan 2026-09-23 H7: that route emailed any PDF to any
   *  address from our domain.) */
  downloadable?: boolean;
  /** Fires once each time a fresh report is fetched, so a parent can lift
   *  what it learned (e.g. the EPC band) into transaction state. */
  onReport?: (report: PropertyIntelligenceReport) => void;
}

const BTN =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#84A98C] bg-white px-4 py-2 font-[DM_Sans] text-sm font-semibold text-[#1A1A1A] transition-colors hover:border-[#0D9488] disabled:opacity-60 dark:bg-[#111827] dark:text-[#E5E7EB]';

function StatusPanel({ title, children }: { title: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#DAE5DC] bg-white px-6 py-10 text-center dark:border-[#1F2937] dark:bg-[#111827]" role="status" aria-live="polite">
      <AlertCircle className="h-10 w-10 text-[#B45309]" aria-hidden="true" />
      <p className="m-0 font-[Fraunces] text-xl font-bold text-[#1A1A1A] dark:text-[#F1F5F9]">{title}</p>
      <div className="max-w-md font-[DM_Sans] text-[15px] text-[#4B5563] dark:text-[#CBD5E1]">{children}</div>
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
  // User-completed override when the imported postcode is outcode-only. Lives
  // in component state so the parent doesn't need to thread it back.
  const [completedPostcode, setCompletedPostcode] = useState<string | null>(null);
  const effectivePostcode = completedPostcode ?? postcode ?? null;
  const needsCompletion = Boolean(postcode) && !completedPostcode && postcodeService.isOutcodeOnly(postcode ?? '');

  const [report, setReport] = useState<PropertyIntelligenceReport | null>(reportOverride ?? null);
  const [hasFailed, setHasFailed] = useState(false);
  // Bumped by "Try again" to re-run the fetch for the same address.
  const [attempt, setAttempt] = useState(0);
  // Ref so a parent passing an inline callback doesn't retrigger the fetch.
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;
  const [isLoading, setIsLoading] = useState<boolean>(reportOverride === undefined && Boolean(effectivePostcode) && !needsCompletion);

  useEffect(() => {
    if (reportOverride !== undefined) {
      setReport(reportOverride);
      setIsLoading(false);
      return;
    }
    // No postcode, or an outcode-only one: postcodes.io 404s on outcodes, so
    // wait for the completion prompt instead of burning a request.
    if (!effectivePostcode || postcodeService.isOutcodeOnly(effectivePostcode)) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setHasFailed(false);
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
        setHasFailed(true);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectivePostcode, addressLine, uprn, reportOverride, attempt]);

  // Designation boundaries for the section maps.
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
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

  // Printable PDF (only mounted/used when `downloadable` is set).
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
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
  const retry = (): void => setAttempt((n) => n + 1);

  if (!postcode) return null;

  if (needsCompletion) {
    return (
      <PostcodeCompletionPrompt
        outcode={postcode}
        reason="We only have the outcode from your listing. Add the rest for flood risk, sold prices, planning, and heritage data."
        ctaLabel="Show property intelligence"
        onComplete={setCompletedPostcode}
      />
    );
  }

  if (isLoading) {
    return (
      <LoadingHouse
        title="Pulling your property data…"
        detail="Gathering flood risk, sold prices, planning history, heritage and more from free government sources."
      />
    );
  }

  if (hasFailed) {
    return (
      <StatusPanel title="We couldn’t load this report">
        <>
          <p className="m-0">The government data services didn’t answer in time. Nothing is wrong with the address.</p>
          <button type="button" onClick={retry} className={`${BTN} mt-4`}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </>
      </StatusPanel>
    );
  }

  if (!report) return null;

  // No geocode: the postcode has a valid shape but postcodes.io doesn't know
  // it (a typo, or a not-yet-issued code). Say so rather than render blank.
  if (!report.location) {
    return (
      <StatusPanel title="We couldn’t find that postcode">
        {`${effectivePostcode ? `“${effectivePostcode}” doesn’t match a known UK postcode.` : 'That postcode isn’t recognised.'} Check it and try again.`}
      </StatusPanel>
    );
  }

  const actions = downloadable ? (
    <button type="button" onClick={handleDownload} disabled={isDownloading} className={BTN}>
      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
      {isDownloading ? 'Preparing your PDF…' : 'Download PDF'}
    </button>
  ) : undefined;

  return (
    <>
      <PropertyReport report={report} geometry={geometry} addressLine={addressLine} anomalies={anomalies} actions={actions} onRetry={reportOverride === undefined ? retry : undefined} />
      {downloadable && <HomeMoverReportPdf ref={pdfRef} report={report} addressLine={addressLine} />}
    </>
  );
}

export default PropertyIntelligenceCard;
