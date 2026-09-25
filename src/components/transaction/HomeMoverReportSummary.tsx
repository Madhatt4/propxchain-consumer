// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Home Mover Report — the one-page summary: brand header, at-a-glance RAG table,
 * key numbers, recent sold prices and conditional next steps, plus the closing
 * sources/company footer the PDF ends with. Inline styles only (html2pdf).
 */

import React from 'react';

import type { PropertyIntelligenceReport } from '../../services/propertyIntelligenceService';
import {
  type Status,
  type Tone,
  heritageSummaryStatus,
  article4SummaryStatus,
  treePreservationSummaryStatus,
  brownfieldSummaryStatus,
  floodZoneSummaryStatus,
  environmentalSummaryStatus,
  planningSummaryStatus,
  epcTone,
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
  formatPrice,
} from './PropertyIntelSections';
import { placeLine } from './homeMoverReportFormat';
import { INK, PAPER_ROW, STYLES, TEAL, statusMeta } from './homeMoverReportStyles';

interface GlanceRow {
  label: string;
  finding: string;
  status: Status | Tone;
}

/** Build the at-a-glance rows in the same order as the on-screen tiles. */
function buildRows(r: PropertyIntelligenceReport): GlanceRow[] {
  return [
    { label: 'Flood risk (live warnings)', finding: floodSummaryText(r.flood), status: r.flood?.status ?? 'unknown' },
    { label: 'Flood zone', finding: floodZoneSummaryText(r.floodZone), status: floodZoneSummaryStatus(r.floodZone) },
    { label: 'Heritage / listed status', finding: heritageSummaryText(r.heritage), status: heritageSummaryStatus(r.heritage) },
    { label: 'Permitted development', finding: article4SummaryText(r.article4), status: article4SummaryStatus(r.article4) },
    { label: 'Tree preservation (TPO)', finding: treePreservationSummaryText(r.treePreservation), status: treePreservationSummaryStatus(r.treePreservation) },
    { label: 'Brownfield land', finding: brownfieldSummaryText(r.brownfield), status: brownfieldSummaryStatus(r.brownfield) },
    { label: 'Environmental designations', finding: environmentalSummaryText(r.environmental), status: environmentalSummaryStatus(r.environmental) },
    { label: 'Planning applications nearby', finding: planningSummaryText(r.planningApplications), status: planningSummaryStatus(r.planningApplications) },
    { label: 'Energy rating (EPC)', finding: epcSummaryText(r.epc), status: epcTone(r.epc) },
    { label: 'Sold prices (this postcode)', finding: priceSummaryText(r.pricePaid), status: 'info' },
  ];
}

/** Short, conditional "what to check next" prompts driven by the findings. */
function buildNextSteps(r: PropertyIntelligenceReport): string[] {
  const steps: string[] = [];
  if (r.article4?.status === 'restricted')
    steps.push('Permitted-development rights are restricted here (Article 4) — budget for a full planning application before extending or altering.');
  if (r.floodZone?.status && r.floodZone.status !== 'none')
    steps.push('This property sits in a flood zone — order a flood report and get insurance quotes early, before you commit.');
  if (r.heritage && (r.heritage.status === 'listed_building' || r.heritage.status === 'both'))
    steps.push('Heritage designation applies — alterations will need listed-building or conservation-area consent.');
  if (r.treePreservation?.status === 'present')
    steps.push('Protected trees (TPO) on or near the plot — you need council consent to fell, top or lop them.');
  if (r.brownfield?.status === 'present')
    steps.push('On the brownfield land register — ask about ground conditions and any previous use of the site.');
  if (r.planningApplications?.status === 'many')
    steps.push('Several recent planning applications nearby — review them for developments that could affect the property.');
  if (steps.length === 0)
    steps.push('No major flags on the free public data. Still order the official local searches to confirm before exchange.');
  steps.push('This is indicative intel from free open-government sources — your conveyancer’s official searches remain the authoritative record.');
  return steps.slice(0, 5);
}

const Header: React.FC<{ addressLine?: string | null; report: PropertyIntelligenceReport }> = ({ addressLine, report }) => {
  const generated = new Date(report.fetchedAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div style={{ background: `linear-gradient(120deg, ${INK} 0%, #0B3A38 55%, ${TEAL} 100%)`, borderRadius: '12px', padding: '12px 16px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7FF0DE' }}>
          Free property intelligence — official UK sources
        </p>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em', color: '#fff' }}>
          Prop<span style={{ color: '#00D4B8' }}>X</span>chain
        </span>
      </div>
      <h1 style={{ ...STYLES.h1, marginTop: '3px' }}>Home Mover Report</h1>
      <p style={{ margin: '5px 0 0', fontSize: '13px', fontWeight: 600 }}>
        {placeLine(report, addressLine)}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#B8EFE6' }}>
        {report.localPlanningAuthority ? `${report.localPlanningAuthority.name} • ` : ''}Generated {generated}
      </p>
    </div>
  );
};

const GlanceTable: React.FC<{ report: PropertyIntelligenceReport }> = ({ report }) => (
  <div style={STYLES.section}>
    <h2 style={STYLES.h2}>At a glance</h2>
    <table style={STYLES.table}>
      <thead>
        <tr>
          <th style={{ ...STYLES.th, width: '46%' }}>Check</th>
          <th style={STYLES.th}>What we found</th>
          <th style={{ ...STYLES.th, width: '72px', textAlign: 'right' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {buildRows(report).map((row, i) => {
          const meta = statusMeta(row.status);
          const zebra = i % 2 === 1 ? { background: PAPER_ROW } : {};
          return (
            <tr key={row.label} style={zebra}>
              <td style={{ ...STYLES.td, fontWeight: 600, color: INK }}>{row.label}</td>
              <td style={STYLES.td}>{row.finding}</td>
              <td style={{ ...STYLES.td, textAlign: 'right' }}>
                <span style={{ ...STYLES.chip, background: meta.color }}>{meta.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const KeyNumbers: React.FC<{ report: PropertyIntelligenceReport }> = ({ report }) => {
  const epc = report.epc;
  const price = report.pricePaid;
  const band = epc ? `${epc.currentBand}${epc.potentialBand ? ` → ${epc.potentialBand}` : ''}` : '—';
  const cards: Array<{ label: string; value: string }> = [
    { label: 'EPC band (now → potential)', value: band },
    { label: 'Floor area', value: epc?.floorAreaSqm ? `${epc.floorAreaSqm} m²` : '—' },
    { label: 'Est. £/m²', value: report.valuePerSqm ? formatPrice(report.valuePerSqm) : '—' },
    { label: 'Latest sale', value: price?.latestSale ? formatPrice(price.latestSale.amount) : '—' },
  ];
  return (
    <div style={STYLES.section}>
      <h2 style={STYLES.h2}>Key numbers</h2>
      <div style={STYLES.numGrid}>
        {cards.map((c) => (
          <div key={c.label} style={STYLES.numCard}>
            <p style={STYLES.numLabel}>{c.label}</p>
            <p style={STYLES.numValue}>{c.value}</p>
          </div>
        ))}
      </div>
      <p style={{ ...STYLES.muted, marginTop: '6px' }}>
        £/m² is a rough indicator from the latest postcode sale ÷ EPC floor area — not a valuation.
      </p>
    </div>
  );
};

const PriceTable: React.FC<{ report: PropertyIntelligenceReport }> = ({ report }) => {
  const sales = report.pricePaid?.sales ?? [];
  if (sales.length === 0) return null;
  return (
    <div style={STYLES.section}>
      <h2 style={STYLES.h2}>Recent sold prices on this postcode</h2>
      <table style={STYLES.table}>
        <thead>
          <tr>
            <th style={STYLES.th}>Address</th>
            <th style={STYLES.th}>Type</th>
            <th style={STYLES.th}>Date</th>
            <th style={{ ...STYLES.th, textAlign: 'right' }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {sales.slice(0, 6).map((s, i) => (
            <tr key={`${s.paon}-${s.date}-${i}`} style={i % 2 === 1 ? { background: PAPER_ROW } : {}}>
              <td style={{ ...STYLES.td, color: INK }}>{[s.paon, s.street].filter(Boolean).join(' ')}</td>
              <td style={{ ...STYLES.td, textTransform: 'capitalize' }}>{s.propertyType ?? '—'}</td>
              <td style={STYLES.td}>{s.date}</td>
              <td style={{ ...STYLES.td, textAlign: 'right', fontWeight: 600 }}>{formatPrice(s.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NextSteps: React.FC<{ report: PropertyIntelligenceReport }> = ({ report }) => (
  <div style={STYLES.section}>
    <h2 style={STYLES.h2}>What to check next</h2>
    <ul style={{ margin: 0, paddingLeft: '16px' }}>
      {buildNextSteps(report).map((s, i) => (
        <li key={i} style={STYLES.bullet}>{s}</li>
      ))}
    </ul>
  </div>
);

export const Footer: React.FC<{ report: PropertyIntelligenceReport }> = ({ report }) => {
  const ok = report.sources.filter((s) => s.ok).length;
  return (
    // paddingBottom: html2canvas paints text a few px low, and the page node has no
    // bottom padding of its own (see homeMoverReportStyles), so without this the
    // last line is clipped at the canvas edge. On the footer, not the page, so it
    // travels with the footer when html2pdf moves it to a fresh page.
    <div style={{ ...STYLES.section, borderTop: `1.5px solid ${TEAL}`, paddingTop: '8px', paddingBottom: '8px', marginTop: '12px' }}>
      <p style={{ ...STYLES.muted, margin: 0 }}>
        Compiled from {ok} live UK open-government sources: HM Land Registry, Environment Agency,
        planning.data.gov.uk, UK PlanIt, Ordnance Survey and the EPC register. Indicative only —
        not a formal search, survey or valuation.
      </p>
      <p style={{ ...STYLES.muted, margin: '4px 0 0' }}>
        PropXchain Ltd • Company No. 17018978 • propxchain.com
      </p>
    </div>
  );
};

interface SummaryPageProps {
  report: PropertyIntelligenceReport;
  addressLine?: string | null;
}

/** Page one: header, at-a-glance table, key numbers, sold prices, next steps. */
export const SummaryPage: React.FC<SummaryPageProps> = ({ report, addressLine }) => (
  <>
    <Header addressLine={addressLine} report={report} />
    <GlanceTable report={report} />
    <KeyNumbers report={report} />
    <PriceTable report={report} />
    <NextSteps report={report} />
  </>
);
