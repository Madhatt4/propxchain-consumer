// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Shared inline styles for the Home Mover Report PDF. html2pdf rasterises the
 * DOM, not Tailwind, so every style the PDF needs is inline and lives here so
 * the summary page and the detail pages stay visually one document.
 */

import type { Status, Tone } from './PropertyIntelSections';

// PropXchain brand palette (from marketing-landing.css light theme).
export const INK = '#0A0F1E'; // brand ink navy
export const TEAL = '#0D9488'; // brand teal (deep)
export const TEXT = '#15181D'; // brand body text
export const MUTED = '#5B6472';
export const PAPER = '#F4F1EA'; // warm paper
export const PAPER_ROW = '#FAF8F2'; // zebra stripe
export const HAIRLINE = '#E7E1D4'; // warm border

/** Off-screen parking for the A4 page. Fixed so it never affects document flow;
 *  a negative offset never creates a scrollbar. Applied to the wrapper only. */
export const OFFSCREEN = { position: 'fixed' as const, left: '-100000px', top: 0 };

// Vertical rhythm is budgeted so the summary page's WORST case — 10 glance
// rows, 6 sales, 5 next-step bullets — fits one A4 page (297mm = 1123 CSS px).
// Measured against a real report before the tightening: 1211px with only 2
// bullets, so the footer spilled onto a near-empty second page. Change a size
// here and re-check the total against that budget.
//
// No minHeight on the page: html2pdf sizes a page as floor(canvasWidth × 297/210)
// px, one pixel SHORT of what a 297mm-tall node rasterises to, so a full-height
// node always paginates into a second, blank page. The PDF page is white anyway;
// let the node be content-height and jsPDF pads the rest. No bottom padding
// either: when the last page fills exactly, trailing padding is the only thing
// left over, and html2pdf gives it a blank page of its own.
export const STYLES = {
  page: { width: '210mm', boxSizing: 'border-box' as const, fontFamily: 'DM Sans, sans-serif', color: TEXT, background: '#fff', padding: '10mm 14mm 0', fontSize: '11.5px', lineHeight: 1.35 },
  h1: { fontFamily: 'Fraunces, serif', fontSize: '19px', fontWeight: 600, color: '#fff', margin: 0 },
  h2: { fontFamily: 'Fraunces, serif', fontSize: '13.5px', fontWeight: 600, margin: '0 0 5px', color: INK, borderBottom: `2px solid ${TEAL}`, paddingBottom: '3px' },
  section: { marginTop: '11px', pageBreakInside: 'avoid' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10.5px' },
  th: { textAlign: 'left' as const, borderBottom: `1.5px solid ${TEAL}`, padding: '4px 5px', fontSize: '9px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: TEAL, fontWeight: 700 },
  td: { borderBottom: `1px solid ${HAIRLINE}`, padding: '4px 5px', verticalAlign: 'top' as const, color: TEXT },
  // html2canvas paints this font's glyphs ~4px lower than the browser does,
  // whatever the line-height; in a tight pill that hung the label off the bottom
  // edge. Zero top / 7px bottom padding puts the PAINTED text in the middle of
  // the pill. This node only ever renders through html2canvas, so tune for it.
  chip: { display: 'inline-block', padding: '0 7px 7px', borderRadius: '9999px', fontSize: '9.5px', lineHeight: 1, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
  numGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
  numCard: { background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: '9px', padding: '7px 10px' },
  numLabel: { fontSize: '8.5px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: MUTED, margin: 0 },
  numValue: { fontSize: '15px', fontWeight: 700, color: TEAL, margin: '2px 0 0', fontFamily: 'Fraunces, serif' },
  bullet: { margin: '0 0 4px', paddingLeft: '2px', color: TEXT },
  muted: { color: MUTED, fontSize: '10px' },
  // Detail-page building blocks.
  subhead: { fontSize: '9px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: TEAL, fontWeight: 700, margin: '6px 0 2px' },
  list: { margin: 0, paddingLeft: '14px' },
  item: { padding: '4px 0', borderBottom: `1px solid ${HAIRLINE}`, pageBreakInside: 'avoid' as const },
  itemTitle: { margin: 0, fontWeight: 600, color: INK },
  itemMeta: { margin: '1px 0 0', color: MUTED, fontSize: '10px' },
} as const;

/** RAG chip label + colour for a category status. Clear/Check/Attention keep
 *  the universal traffic-light semantics; brand teal carries the neutral case. */
export function statusMeta(status: Status | Tone): { label: string; color: string } {
  switch (status) {
    case 'low':
      return { label: 'Clear', color: '#0F9D77' };
    case 'medium':
      return { label: 'Check', color: '#C77700' };
    case 'high':
      return { label: 'Attention', color: '#D64545' };
    case 'info':
      return { label: 'Info', color: TEAL };
    default:
      return { label: 'No data', color: '#9AA3AF' };
  }
}
