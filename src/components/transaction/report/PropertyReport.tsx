// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The free property report as one readable document: a header with the
 * address, a section bar, then sections that each show the real values, one
 * plain sentence on what they mean, and their source. Replaces the earlier
 * grid of status tiles, which gave no verdict and hid the detail behind
 * clicks. Data fetching stays in PropertyIntelligenceCard.
 */

import type { ReactElement, ReactNode } from 'react';
import type { FeatureCollection } from 'geojson';

import type { CrossReferenceResult } from '../../../services/formCrossReferenceService';
import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';
import { AnomaliesSection } from '../PropertyIntelSections';

import { FloodSection, GroundSection } from './HazardSections';
import { DesignationsSection, PlanningSection } from './PlanningSections';
import { ReportNav, type NavItem } from './ReportNav';
import { R } from './reportStyles';
import { AskSection, SummarySection } from './SummarySections';
import { EnergySection, PricesSection } from './ValueSections';

const NAV: NavItem[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'flood', label: 'Flood' },
  { id: 'ground', label: 'Radon and ground' },
  { id: 'designations', label: 'Heritage and rules' },
  { id: 'prices', label: 'Sold prices' },
  { id: 'energy', label: 'Energy' },
  { id: 'planning', label: 'Planning' },
  { id: 'ask', label: 'Who to ask' },
];

/** Plain names for the provenance entries the service records. */
const SOURCE_NAMES: Record<string, string> = {
  'postcodes.io': 'postcodes.io',
  'os-open-uprn': 'OS Open UPRN',
  'hmlr-inspire-polygon': 'HM Land Registry title boundary',
  'environment.data.gov.uk/flood': 'Environment Agency flood warnings',
  'environment.data.gov.uk/surface-water': 'Environment Agency surface water',
  'planning.data.gov.uk/heritage': 'Heritage designations',
  'planning.data.gov.uk/article-4': 'Article 4 directions',
  'planning.data.gov.uk/flood-zone': 'Planning flood map',
  'planning.data.gov.uk/environmental': 'Landscape designations',
  'planning.data.gov.uk/tree-preservation': 'Tree preservation orders',
  'planning.data.gov.uk/brownfield': 'Brownfield register',
  'planning.data.gov.uk/local-planning-authority': 'Local planning authority',
  'planit.org.uk': 'UK PlanIt planning applications',
  'landregistry.data.gov.uk/ppd': 'HM Land Registry sold prices',
  'mining-remediation-authority/high-risk-area': 'Coal mining high risk areas',
  'bgs.ac.uk/radon': 'BGS radon atlas',
};

function SourcesNote({ report, onRetry }: { report: PropertyIntelligenceReport; onRetry?: () => void }): ReactElement {
  const failed = report.sources.filter((s) => !s.ok && !(s.error ?? '').startsWith('Not available for addresses in'));
  const fetched = new Date(report.fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <footer className={`border-t ${R.rule} py-6 ${R.source}`}>
      <p className="m-0">
        Checked {fetched} against free public data: Environment Agency, planning.data.gov.uk (including Historic England and Natural England), British Geological Survey and UKHSA, Mining Remediation Authority, HM Land Registry, the EPC register, UK PlanIt, OS Open UPRN and postcodes.io. Open Government Licence. Indicative only; official searches remain the record.
      </p>
      {failed.length > 0 && (
        <p className="m-0 mt-2">
          Didn’t answer this time: {failed.map((s) => SOURCE_NAMES[s.source] ?? s.source).join(', ')}.{' '}
          {onRetry && (
            <button type="button" onClick={onRetry} className="font-medium text-[#0F766E] underline underline-offset-2 dark:text-[#14B8A6]">
              Run the check again
            </button>
          )}
        </p>
      )}
    </footer>
  );
}

interface PropertyReportProps {
  report: PropertyIntelligenceReport;
  geometry: FeatureCollection | null;
  addressLine?: string | null;
  anomalies?: CrossReferenceResult[];
  /** Header actions, e.g. the PDF download button. */
  actions?: ReactNode;
  onRetry?: () => void;
}

export function PropertyReport({ report, geometry, addressLine, anomalies, actions, onRetry }: PropertyReportProps): ReactElement {
  const loc = report.location;
  const postcode = loc?.postcode ?? report.postcode;
  const place = [addressLine?.trim(), postcode].filter(Boolean).join(', ');
  return (
    <article aria-label="Property report" className={`overflow-hidden rounded-xl border ${R.rule} ${R.paper}`}>
      <header className="px-4 pb-5 pt-6 sm:px-7 lg:px-10">
        <p className={`m-0 text-sm ${R.ink2} ${R.mono}`}>{[place, loc?.admin_district].filter(Boolean).join(' · ')}</p>
        <h2 className="m-0 mt-1 font-[Fraunces] text-[2rem] font-black leading-[1.05] tracking-[-0.03em] text-[#1A1A1A] dark:text-[#F1F5F9]">Property report</h2>
        <ul className={`m-0 mt-3 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 font-[DM_Sans] text-sm ${R.ink2}`}>
          {loc?.admin_ward && <li>Ward <span className={`font-semibold ${R.ink}`}>{loc.admin_ward}</span></li>}
          {report.localPlanningAuthority && <li>Planning authority <span className={`font-semibold ${R.ink}`}>{report.localPlanningAuthority.name}</span></li>}
          {report.coordinateSource && (
            <li>Location <span className={`font-semibold ${R.ink}`}>{report.coordinateSource === 'os-open-uprn' ? 'exact address point' : 'postcode centre'}</span></li>
          )}
        </ul>
        {actions && <div className="mt-4 flex flex-wrap gap-2.5">{actions}</div>}
      </header>

      <ReportNav items={NAV} />

      <div className="px-4 sm:px-7 lg:px-10">
        <SummarySection report={report} geometry={geometry} placeName={place} />
        {anomalies && anomalies.length > 0 && (
          <div className="pb-6">
            <AnomaliesSection anomalies={anomalies} />
          </div>
        )}
        <FloodSection report={report} geometry={geometry} />
        <GroundSection report={report} />
        <DesignationsSection report={report} geometry={geometry} />
        <PricesSection report={report} />
        <EnergySection report={report} />
        <PlanningSection report={report} onRetry={onRetry} />
        <AskSection report={report} />
        <SourcesNote report={report} onRetry={onRetry} />
      </div>
    </article>
  );
}
