// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Home Mover Report — printable report: a one-page summary (this file) followed
 * by detail pages (HomeMoverReportDetail) that list what every check found. An
 * inline-styled A4 DOM node, parked off-screen, that html2pdf.js rasterises to
 * a downloadable PDF (same approach as AuditPdfRenderer — html2pdf renders from
 * the DOM, not Tailwind, so everything here is inline styles; the shared styles
 * live in homeMoverReportStyles). The summary condenses the interactive card
 * into a digest a mover can save, print, or hand to their conveyancer.
 *
 * The off-screen positioning lives on a WRAPPER, never on the node handed to
 * html2pdf: html2pdf copies the node with cloneNode (inline styles included)
 * into its own capture container, so a `left:-100000px` on the node itself is
 * cloned too and the capture comes out as a zero-height, blank page.
 */

import React, { forwardRef } from 'react';

import { logger } from '@/utils/logger';
import type { PropertyIntelligenceReport } from '../../services/propertyIntelligenceService';
import { DetailPages } from './HomeMoverReportDetail';
import { Footer, SummaryPage } from './HomeMoverReportSummary';
import { placeLine } from './homeMoverReportFormat';
import { OFFSCREEN, STYLES } from './homeMoverReportStyles';

interface HomeMoverReportPdfProps {
  report: PropertyIntelligenceReport;
  addressLine?: string | null;
}

const HomeMoverReportPdf = forwardRef<HTMLDivElement, HomeMoverReportPdfProps>(
  ({ report, addressLine }, ref) => (
    // The wrapper does the hiding (see the file header): the page stays laid
    // out so html2canvas can measure it, but far enough left that it never
    // paints or scrolls. aria-hidden keeps screen readers off the duplicate.
    <div style={OFFSCREEN} aria-hidden="true">
      <div ref={ref} style={STYLES.page}>
        <SummaryPage report={report} addressLine={addressLine} />
        <DetailPages report={report} placeLine={placeLine(report, addressLine)} />
        <Footer report={report} />
      </div>
    </div>
  ),
);

HomeMoverReportPdf.displayName = 'HomeMoverReportPdf';

/** Sanitise a postcode into a safe filename fragment. */
function fileStem(report: PropertyIntelligenceReport): string {
  const pc = (report.location?.postcode ?? report.postcode ?? 'property').replace(/[^A-Za-z0-9]/g, '-');
  return `propxchain-report-${pc}`.toLowerCase();
}

/** Shared html2pdf options — a fixed A4 portrait render at 2× for crisp text. */
function pdfOptions(report: PropertyIntelligenceReport): Record<string, unknown> {
  return {
    margin: 0,
    // css: honour pageBreakBefore on the detail header and pageBreakInside on
    // sections, so pages break between sections, never through one.
    pagebreak: { mode: ['css', 'legacy'] },
    filename: `${fileStem(report)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };
}

/** Download the report as a PDF — the free report's only delivery path. */
export async function exportHomeMoverReportPdf(
  containerRef: React.RefObject<HTMLDivElement | null>,
  report: PropertyIntelligenceReport,
): Promise<void> {
  const el = containerRef.current;
  if (!el) return;
  try {
    await document.fonts.ready;
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf().set(pdfOptions(report)).from(el).save();
  } catch (err) {
    logger.error('Home Mover Report PDF export failed', { error: err });
    throw err;
  }
}

export default HomeMoverReportPdf;
