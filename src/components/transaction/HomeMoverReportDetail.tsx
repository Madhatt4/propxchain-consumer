// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Home Mover Report — detail pages. Follows the one-page summary and walks
 * every check in the same order as the on-screen tiles, listing what each
 * source actually returned (warnings, designations, applications, sales, the
 * EPC certificate) with the same empty-state wording as the interactive card.
 * The interactive map is the one thing that stays online-only: html2canvas
 * cannot rasterise cross-origin map tiles.
 *
 * Starts on a fresh page (pageBreakBefore) and keeps each section whole
 * (pageBreakInside on STYLES.section), so html2pdf breaks between sections.
 */

import React from 'react';

import type {
  EpcCertificate,
  FloodWarning,
  PlanningApplication,
  PriceSale,
  PropertyIntelligenceReport,
} from '../../services/propertyIntelligenceService';
import { datasetLabel, formatPrice, truncate } from './PropertyIntelSections';
import { MAX_APPLICATIONS, MAX_ENTITIES, MAX_SALES, UNAVAILABLE_PLANNING, reference } from './homeMoverReportFormat';
import { EntityList, MoreNote, Note, Section } from './homeMoverReportPrimitives';
import { HAIRLINE, INK, MUTED, PAPER_ROW, STYLES, TEAL } from './homeMoverReportStyles';

const FloodRiskDetail: React.FC<{ data: PropertyIntelligenceReport['flood'] }> = ({ data }) => (
  <Section title="Flood risk (live warnings)">
    {!data && <Note>Environment Agency data unavailable.</Note>}
    {data && data.activeWarnings.length === 0 && <Note>No active flood warnings within 10km.</Note>}
    {data && data.activeWarnings.length > 0 && (
      <div>
        {data.activeWarnings.slice(0, MAX_ENTITIES).map((w: FloodWarning, i) => (
          <div key={`${w.timeRaised}-${i}`} style={STYLES.item}>
            <p style={STYLES.itemTitle}>{w.area}</p>
            <p style={STYLES.itemMeta}>
              Severity {w.severityLevel} · {w.severity.replace(/_/g, ' ')} · raised{' '}
              {new Date(w.timeRaised).toLocaleString('en-GB')}
            </p>
            {w.description && <p style={{ margin: '1px 0 0' }}>{truncate(w.description, 200)}</p>}
          </div>
        ))}
        <MoreNote total={data.activeWarnings.length} shown={Math.min(data.activeWarnings.length, MAX_ENTITIES)} />
      </div>
    )}
  </Section>
);

const FloodZoneDetail: React.FC<{ data: PropertyIntelligenceReport['floodZone'] }> = ({ data }) => (
  <Section title="Flood zone (planning)">
    {!data && <Note>Planning flood-zone data unavailable.</Note>}
    {data && data.zones.length === 0 && <Note>Property is not in a designated flood risk zone.</Note>}
    {data && <EntityList items={data.zones} extra={reference} />}
  </Section>
);

const HeritageDetail: React.FC<{ data: PropertyIntelligenceReport['heritage'] }> = ({ data }) => {
  const monuments = data?.scheduledMonuments ?? [];
  const whs = data?.worldHeritageSites ?? [];
  const isEmpty =
    !!data && data.listedBuildings.length === 0 && data.conservationAreas.length === 0 && monuments.length === 0 && whs.length === 0;
  return (
    <Section title="Heritage">
      {!data && <Note>{UNAVAILABLE_PLANNING}</Note>}
      {isEmpty && (
        <Note>No listed buildings, conservation areas, scheduled monuments or World Heritage Sites intersect this location.</Note>
      )}
      {data && (
        <div>
          <EntityList items={data.listedBuildings} heading="Listed building" extra={(e) => (e.grade ? `— Grade ${e.grade}` : null)} />
          <EntityList items={data.conservationAreas} heading="Conservation area" />
          <EntityList items={monuments} heading="Scheduled monument" />
          <EntityList items={whs} heading="World Heritage Site" />
        </div>
      )}
    </Section>
  );
};

const Article4Detail: React.FC<{ data: PropertyIntelligenceReport['article4'] }> = ({ data }) => (
  <Section title="Permitted development (Article 4)">
    {!data && <Note>{UNAVAILABLE_PLANNING}</Note>}
    {data && data.directions.length === 0 && (
      <Note>
        No Article 4 directions intersect this location — permitted-development rights are not restricted here.
        Confirm against the official local search.
      </Note>
    )}
    {data && <EntityList items={data.directions} withDetail />}
  </Section>
);

const TreePreservationDetail: React.FC<{ data: PropertyIntelligenceReport['treePreservation'] }> = ({ data }) => (
  <Section title="Tree preservation (TPO)">
    {!data && <Note>{UNAVAILABLE_PLANNING}</Note>}
    {data && data.zones.length === 0 && (
      <Note>No Tree Preservation Order zone intersects this location. Confirm against the official local search.</Note>
    )}
    {data && <EntityList items={data.zones} extra={reference} />}
  </Section>
);

const BrownfieldDetail: React.FC<{ data: PropertyIntelligenceReport['brownfield'] }> = ({ data }) => (
  <Section title="Brownfield land">
    {!data && <Note>{UNAVAILABLE_PLANNING}</Note>}
    {data && data.sites.length === 0 && (
      <Note>Not on a local authority brownfield (previously-developed) land register.</Note>
    )}
    {data && <EntityList items={data.sites} />}
  </Section>
);

const EnvironmentalDetail: React.FC<{ data: PropertyIntelligenceReport['environmental'] }> = ({ data }) => (
  <Section title="Environmental designations">
    {!data && <Note>Environmental designation data unavailable.</Note>}
    {data && data.designations.length === 0 && (
      <Note>No Green Belt, SSSI, AONB, National Park, or ancient woodland intersects this location.</Note>
    )}
    {data && <EntityList items={data.designations} extra={(e) => `· ${datasetLabel(e.dataset)}`} />}
  </Section>
);

const ApplicationItem: React.FC<{ app: PlanningApplication }> = ({ app }) => (
  <div style={STYLES.item}>
    <p style={STYLES.itemTitle}>
      {app.reference}
      <span style={{ color: TEAL, fontWeight: 700, fontSize: '10px', marginLeft: '8px' }}>{app.appState}</span>
    </p>
    {app.description && <p style={{ margin: '1px 0 0' }}>{truncate(app.description, 160)}</p>}
    <p style={STYLES.itemMeta}>
      {app.distanceM}m away{app.startDate ? ` · raised ${app.startDate}` : ''}
    </p>
  </div>
);

/** The one list long enough to be worth flowing across a page break: the
 *  section itself may split (items never do), and the heading is grouped with
 *  the first item so it can't be orphaned at the foot of a page. */
const PlanningDetail: React.FC<{ data: PropertyIntelligenceReport['planningApplications'] }> = ({ data }) => {
  const apps = data?.applications.slice(0, MAX_APPLICATIONS) ?? [];
  const [first, ...rest] = apps;
  return (
    <div style={{ ...STYLES.section, pageBreakInside: 'auto' }}>
      <div style={{ pageBreakInside: 'avoid' }}>
        <h2 style={STYLES.h2}>Planning applications (within 300m)</h2>
        {!data && <Note>UK PlanIt data unavailable.</Note>}
        {data && data.applications.length === 0 && <Note>No recent planning applications found nearby.</Note>}
        {data && first && <Note>Showing {apps.length} of {data.total} applications, most recent first.</Note>}
        {first && <ApplicationItem app={first} />}
      </div>
      {rest.map((app) => (
        <ApplicationItem key={app.uid || app.reference} app={app} />
      ))}
    </div>
  );
};

const SaleHistoryDetail: React.FC<{ data: PropertyIntelligenceReport['pricePaid'] }> = ({ data }) => (
  <Section title="Sale history (this postcode)">
    {!data && <Note>Land Registry price-paid data unavailable.</Note>}
    {data && data.sales.length === 0 && <Note>No recent sales recorded at this postcode.</Note>}
    {data && data.sales.length > 0 && (
      <div>
        <Note>
          {data.sales.length} sales found · average {formatPrice(data.averagePrice)}
          {data.latestSale ? ` · most recent ${formatPrice(data.latestSale.amount)} on ${data.latestSale.date}` : ''}
        </Note>
        <table style={{ ...STYLES.table, marginTop: '4px' }}>
          <thead>
            <tr>
              <th style={STYLES.th}>Address</th>
              <th style={STYLES.th}>Type</th>
              <th style={STYLES.th}>Date</th>
              <th style={{ ...STYLES.th, textAlign: 'right' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.slice(0, MAX_SALES).map((s: PriceSale, i) => (
              <tr key={`${s.paon}-${s.date}-${i}`} style={i % 2 === 1 ? { background: PAPER_ROW } : {}}>
                <td style={{ ...STYLES.td, color: INK }}>{[s.paon, s.street].filter(Boolean).join(' ')}</td>
                <td style={{ ...STYLES.td, textTransform: 'capitalize' }}>{s.propertyType ?? '—'}</td>
                <td style={STYLES.td}>{s.date}</td>
                <td style={{ ...STYLES.td, textAlign: 'right', fontWeight: 600 }}>{formatPrice(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <MoreNote total={data.sales.length} shown={Math.min(data.sales.length, MAX_SALES)} />
      </div>
    )}
  </Section>
);

const EpcDetail: React.FC<{ epc: EpcCertificate | null }> = ({ epc }) => (
  <Section title="Energy performance (EPC)">
    {!epc && <Note>No EPC found for this property on the register.</Note>}
    {epc && (
      <div>
        <div style={{ ...STYLES.numGrid, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div style={STYLES.numCard}>
            <p style={STYLES.numLabel}>Current</p>
            <p style={STYLES.numValue}>Band {epc.currentBand}{epc.currentRating !== null ? ` · ${epc.currentRating}` : ''}</p>
          </div>
          <div style={STYLES.numCard}>
            <p style={STYLES.numLabel}>Potential</p>
            <p style={STYLES.numValue}>
              {epc.potentialBand ? `Band ${epc.potentialBand}${epc.potentialRating !== null ? ` · ${epc.potentialRating}` : ''}` : '—'}
            </p>
          </div>
          <div style={STYLES.numCard}>
            <p style={STYLES.numLabel}>Floor area</p>
            <p style={STYLES.numValue}>{epc.floorAreaSqm !== null ? `${epc.floorAreaSqm} m²` : '—'}</p>
          </div>
        </div>
        <p style={{ ...STYLES.muted, margin: '5px 0 0' }}>
          {epc.meetsMees ? 'Meets MEES (band E+)' : 'Below MEES (band F/G)'}
          {epc.lodgementDate ? ` · Lodged ${epc.lodgementDate}` : ''} · Certificate address: {epc.address}
        </p>
      </div>
    )}
  </Section>
);

interface DetailPagesProps {
  report: PropertyIntelligenceReport;
  /** "12, Central Bedfordshire, SG18 0AA" — the same line the summary header shows. */
  placeLine: string;
}

/** Everything after the summary page, in tile order. */
export const DetailPages: React.FC<DetailPagesProps> = ({ report, placeLine }) => (
  <div>
    <div style={{ pageBreakBefore: 'always', borderBottom: `2px solid ${TEAL}`, paddingBottom: '6px' }}>
      <p style={{ margin: 0, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.09em', color: TEAL, fontWeight: 700 }}>
        Home Mover Report — detail
      </p>
      <p style={{ margin: '3px 0 0', fontSize: '13px', fontWeight: 600, color: INK }}>{placeLine}</p>
      <p style={{ ...STYLES.muted, margin: '3px 0 0', color: MUTED, borderTop: `1px solid ${HAIRLINE}`, paddingTop: '3px' }}>
        What each check found, in the same order as the summary. Long lists are capped at {MAX_ENTITIES}; the
        online report shows the full set, plus the interactive map of the plot and its surroundings.
      </p>
    </div>
    <FloodRiskDetail data={report.flood} />
    <FloodZoneDetail data={report.floodZone} />
    <HeritageDetail data={report.heritage} />
    <Article4Detail data={report.article4} />
    <TreePreservationDetail data={report.treePreservation} />
    <BrownfieldDetail data={report.brownfield} />
    <EnvironmentalDetail data={report.environmental} />
    <PlanningDetail data={report.planningApplications} />
    <EpcDetail epc={report.epc} />
    <SaleHistoryDetail data={report.pricePaid} />
  </div>
);

export default DetailPages;
