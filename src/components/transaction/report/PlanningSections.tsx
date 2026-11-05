// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Heritage-and-planning-rules and planning-applications sections. Every
 * designation here is a constraint (it limits what you can change), so the
 * colour is amber at most, never the red kept for hazards.
 */

import type { ReactElement } from 'react';
import type { FeatureCollection } from 'geojson';

import type { PlanningEntity, PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';
import { safeExternalUrl } from '@/utils/externalUrl';

import { CheckTable, ReportSection, Unavailable, type CheckRow } from './ReportParts';
import { ReportMap } from './ReportMap';
import { DESIGNATION_DATASETS, hasDataset } from './reportGeometry';
import { R } from './reportStyles';

function names(items: PlanningEntity[] | undefined): string {
  return (items ?? []).map((e) => e.name || e.reference).filter(Boolean).slice(0, 2).join(', ');
}

function designationRows(r: PropertyIntelligenceReport): CheckRow[] {
  const h = r.heritage;
  const listed = h?.listedBuildings ?? [];
  const whs = h?.worldHeritageSites ?? [];
  const env = r.environmental?.designations ?? [];
  const row = (check: string, present: boolean, result: string): CheckRow => ({ check, result: present ? result : 'None', tone: present ? 'constraint' : 'clear' });
  return [
    row('Listed building', listed.length > 0, listed[0]?.grade ? `Grade ${listed[0].grade}: ${names(listed)}` : names(listed)),
    row('Conservation area', (h?.conservationAreas.length ?? 0) > 0, names(h?.conservationAreas)),
    row('World heritage site', whs.length > 0, `${names(whs)}${whs[0]?.dataset === 'world-heritage-site-buffer-zone' ? ', buffer zone' : ''}`),
    row('Scheduled monument', (h?.scheduledMonuments?.length ?? 0) > 0, names(h?.scheduledMonuments)),
    row('Article 4 direction', r.article4?.status === 'restricted', names(r.article4?.directions)),
    row('Tree preservation order', r.treePreservation?.status === 'present', 'Applies'),
    row('Green belt, SSSI, national park, AONB, ancient woodland', env.length > 0, names(env)),
  ];
}

export function DesignationsSection({ report, geometry }: { report: PropertyIntelligenceReport; geometry: FeatureCollection | null }): ReactElement {
  if (report.coverageGap) {
    return (
      <ReportSection id="designations" title="Heritage and planning rules">
        <Unavailable title={`Not covered in ${report.coverageGap}.`}>Listing, conservation areas and other designations come from England’s planning data. Cadw holds the list of historic buildings in Wales; the council confirms conservation areas.</Unavailable>
      </ReportSection>
    );
  }
  const rows = designationRows(report);
  const applies = rows.filter((r) => r.tone === 'constraint');
  const loc = report.location;
  return (
    <ReportSection
      id="designations"
      title="Heritage and planning rules"
      lead={applies.length ? `${applies.map((r) => r.check.split(',')[0].toLowerCase()).join(', ').replace(/^./, (c) => c.toUpperCase())} ${applies.length === 1 ? 'applies' : 'apply'}.` : 'No designations found.'}
      rest={applies.length ? 'These limit what you can change; they are not a hazard.' : undefined}
      tone={applies.length ? 'constraint' : 'clear'}
      source="planning.data.gov.uk, including Historic England and Natural England data. Open Government Licence."
    >
      <div className={`mt-1 grid gap-6 ${loc && hasDataset(geometry, DESIGNATION_DATASETS) ? 'lg:grid-cols-2' : ''}`}>
        <CheckTable rows={rows} showMeaning={false} />
        {loc && hasDataset(geometry, DESIGNATION_DATASETS) && (
          <div className="mt-5">
            <ReportMap lat={loc.coordinates.lat} lng={loc.coordinates.lng} label={loc.postcode} geometry={geometry} datasets={[...DESIGNATION_DATASETS]} variant="boundary" caption="Designation boundaries around the property." heightClass="h-72 lg:h-96 2xl:h-[30rem]" />
          </div>
        )}
      </div>
      {applies.length > 0 && (
        <p className={`mt-4 max-w-[68ch] ${R.body}`}>
          In a conservation area you need permission to demolish most buildings, permitted development is narrower, and most tree work needs six weeks’ notice to the council. Listing applies building by building, so confirm the exact house with the council.
        </p>
      )}
    </ReportSection>
  );
}

const STATE_TONE = (s: string): string => {
  const v = s.toLowerCase();
  if (v.includes('refus')) return 'text-[#B91C1C] dark:text-[#F87171]';
  if (v.includes('approv') || v.includes('permit') || v.includes('grant')) return 'text-[#047857] dark:text-[#34D399]';
  return R.ink2;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function PlanningSection({ report, onRetry }: { report: PropertyIntelligenceReport; onRetry?: () => void }): ReactElement {
  const p = report.planningApplications;
  if (!p) {
    return (
      <ReportSection id="planning" title="Planning applications nearby">
        <Unavailable title="UK PlanIt didn’t respond when this report was made." onRetry={onRetry}>The rest of the report is unaffected.</Unavailable>
      </ReportSection>
    );
  }
  const shown = [...p.applications].sort((a, b) => a.distanceM - b.distanceM).slice(0, 12);
  return (
    <ReportSection
      id="planning"
      title="Planning applications nearby"
      lead={p.total === 0 ? 'No applications found nearby.' : `${p.total} ${p.total === 1 ? 'application' : 'applications'} within 300 m.`}
      tone={p.status === 'many' ? 'medium' : 'clear'}
      rest={p.total > 0 ? 'Check them for anything that would change the street or your view.' : undefined}
      source="UK PlanIt, from council planning registers."
    >
      {shown.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b ${R.rule}`}>
                <th scope="col" className={R.th}>Date</th>
                <th scope="col" className={R.th}>Proposal</th>
                <th scope="col" className={R.th}>Decision</th>
                <th scope="col" className={`${R.th} text-right`}>Distance</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const href = safeExternalUrl(a.url);
                return (
                  <tr key={a.uid} className={`border-b ${R.rule}`}>
                    <td className={`${R.td} ${R.mono} whitespace-nowrap`}>{formatDate(a.startDate)}</td>
                    <td className={R.td}>
                      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#0F766E] underline underline-offset-2 dark:text-[#14B8A6]">{a.description || a.reference}</a> : a.description || a.reference}
                      {a.address && <span className={`block text-[13px] ${R.muted}`}>{a.address}</span>}
                    </td>
                    <td className={`${R.td} whitespace-nowrap font-medium ${STATE_TONE(a.appState)}`}>{a.appState || 'Unknown'}</td>
                    <td className={`${R.td} ${R.mono} whitespace-nowrap text-right`}>{Math.round(a.distanceM)} m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {p.total > shown.length && <p className={`mt-2 ${R.source}`}>Showing the nearest {shown.length} of {p.total}.</p>}
        </div>
      )}
    </ReportSection>
  );
}
