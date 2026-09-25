// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Form PDF Export service (Ship 2.7).
 *
 * Generates downloadable PDFs of the Law Society conveyancing forms
 * (TA6, TA10, TA7) from the structured form data. Uses jsPDF for
 * layout — no network calls, all client-side.
 *
 * Each PDF carries a verification hash (SHA-256 of canonicalised JSON)
 * on its final page so recipients can confirm the content hasn't been
 * altered out-of-band. The same hash is exposed from generateVerificationHash
 * for use elsewhere (audit timeline, on-chain signing, etc).
 *
 * The TA6 layout is the 15-section 6th-edition record; its section builders
 * live in ta6PdfSections.ts and the shared primitives in pdfPrimitives.ts.
 *
 * See docs/Upgrades/propxchain-v3-roadmap.md Phase 2 Task 2.7.
 */

import { jsPDF } from 'jspdf';

import { buildTA6Sections } from './ta6PdfSections';
import { buildTA6Banner } from './ta6PdfShared';
import {
  formatCurrency,
  formatNumber,
  formatText,
  formatYesNo,
  generateVerificationHash,
} from './pdfPrimitives';

import type { PdfSection } from './pdfPrimitives';
import type { TA6PropertyInformation } from '../types/ta6.types';
import type { TA7LeaseholdInformation } from '../types/ta7.types';
import type { TA10FittingsAndContents } from '../types/ta10.types';

// Re-exported so existing importers keep the stable `formExportService` path.
export { generateVerificationHash, downloadBlob } from './pdfPrimitives';

export interface ExportContext {
  /** Property address shown in the header */
  propertyAddress: string;
  /** Seller name shown in the header (optional) */
  sellerName?: string;
  /** Transaction ID included in the footer for reference */
  transactionId?: string;
}

export interface ExportOptions {
  /** Include the verification hash + timestamp on the final page. Default true. */
  includeVerificationHash?: boolean;
  /** Additional notes appended after the main content (e.g. anomaly flags). */
  appendixNotes?: string[];
}

// ============================================
// TA7 / TA10 section → label mappings
// ============================================

function ta7Sections(form: TA7LeaseholdInformation): PdfSection[] {
  return [
    {
      title: 'Lease terms',
      rows: [
        ['Term (years)', formatNumber(form.leaseTermYears)],
        ['Start date', formatText(form.leaseStartDate)],
        ['Expiry date', formatText(form.leaseExpiryDate)],
      ],
    },
    {
      title: 'Rent & charges',
      rows: [
        ['Ground rent', formatCurrency(form.groundRentAmount)],
        ['Ground rent frequency', formatText(form.groundRentPaymentFrequency)],
        ['Service charge', formatCurrency(form.serviceChargeAmount)],
        ['Service charge frequency', formatText(form.serviceChargePaymentFrequency)],
      ],
    },
    {
      title: 'Parties',
      rows: [
        ['Freeholder', formatText(form.freeholder)],
        ['Managing agent', formatText(form.managingAgent)],
      ],
    },
    {
      title: 'Restrictions',
      rows: [
        ['Description', formatText(form.restrictions)],
        ['Alterations allowed', formatYesNo(form.alterationsAllowed)],
        ['Subletting allowed', formatYesNo(form.sublettingAllowed)],
        ['Pets allowed', formatYesNo(form.petsAllowed)],
      ],
    },
  ];
}

function ta10Sections(form: TA10FittingsAndContents): PdfSection[] {
  // TA10 is a big itemised list by room. Render each room as a section.
  const rooms = (form as unknown as { rooms?: Array<{ name?: string; items?: Array<{ name?: string; included?: boolean; notes?: string }> }> }).rooms ?? [];
  if (!rooms.length) {
    return [
      {
        title: 'Fittings & contents',
        rows: [['Items recorded', '0']],
      },
    ];
  }
  return rooms.map((room) => ({
    title: formatText(room.name) || 'Room',
    rows: (room.items ?? []).map((it) => [
      formatText(it.name),
      `${it.included ? 'Included' : 'Excluded'}${it.notes ? ` — ${it.notes}` : ''}`,
    ]),
  }));
}

// ============================================
// PDF rendering
// ============================================

const PAGE_MARGIN = 15; // mm
const LINE_HEIGHT = 6;
const TITLE_GAP = 4;

async function renderPdf(
  formName: string,
  form: unknown,
  context: ExportContext,
  sections: PdfSection[],
  options: ExportOptions,
  bannerText?: string,
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  let y = PAGE_MARGIN;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formName, PAGE_MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(context.propertyAddress || 'Property address not set', PAGE_MARGIN, y);
  y += 5;

  const subtitleParts = [new Date().toLocaleDateString('en-GB')];
  if (context.sellerName) subtitleParts.push(`Seller: ${context.sellerName}`);
  doc.setTextColor(100);
  doc.text(subtitleParts.join('  ·  '), PAGE_MARGIN, y);
  doc.setTextColor(0);
  y += 8;

  // Optional banner (TA6 links the record to the official form)
  if (bannerText) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    const bannerLines = doc.splitTextToSize(bannerText, contentWidth);
    doc.text(bannerLines, PAGE_MARGIN, y);
    y += LINE_HEIGHT * bannerLines.length + 3;
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  }

  // Section bodies
  for (const section of sections) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, PAGE_MARGIN, y);
    y += TITLE_GAP;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const [label, value] of section.rows) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      const text = label ? `${label}: ${value}` : value;
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, PAGE_MARGIN, y);
      y += LINE_HEIGHT * lines.length;
    }
    y += 3;
  }

  // Appendix notes
  if (options.appendixNotes && options.appendixNotes.length > 0) {
    doc.addPage();
    y = PAGE_MARGIN;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Appendix: Notes', PAGE_MARGIN, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const note of options.appendixNotes) {
      const lines = doc.splitTextToSize(`• ${note}`, contentWidth);
      if (y + LINE_HEIGHT * lines.length > pageHeight - 20) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      doc.text(lines, PAGE_MARGIN, y);
      y += LINE_HEIGHT * lines.length + 1;
    }
  }

  // Footer + verification hash (on the last page)
  const includeHash = options.includeVerificationHash !== false;
  if (includeHash) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    const hash = await generateVerificationHash(form);
    const ts = new Date().toISOString();
    doc.setTextColor(120);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const footerY = pageHeight - 15;
    doc.text(`PropXchain · generated ${ts}`, PAGE_MARGIN, footerY);
    if (context.transactionId) {
      doc.text(`Transaction ${context.transactionId}`, PAGE_MARGIN, footerY + 4);
    }
    doc.text(`Verification hash: ${hash}`, PAGE_MARGIN, footerY + 8);
    doc.setTextColor(0);
  }

  // Page numbers across every page
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 10,
      { align: 'right' },
    );
  }
  doc.setTextColor(0);

  return doc.output('blob');
}

// ============================================
// Public exports
// ============================================

export async function exportTA6ToPDF(
  form: TA6PropertyInformation,
  context: ExportContext,
  options: ExportOptions = {},
): Promise<Blob> {
  return renderPdf(
    'TA6 Property Information (6th edition)',
    form,
    context,
    buildTA6Sections(form),
    options,
    buildTA6Banner(form),
  );
}

export async function exportTA7ToPDF(
  form: TA7LeaseholdInformation,
  context: ExportContext,
  options: ExportOptions = {},
): Promise<Blob> {
  return renderPdf('TA7 Leasehold Information', form, context, ta7Sections(form), options);
}

export async function exportTA10ToPDF(
  form: TA10FittingsAndContents,
  context: ExportContext,
  options: ExportOptions = {},
): Promise<Blob> {
  return renderPdf('TA10 Fittings and Contents', form, context, ta10Sections(form), options);
}
