// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** The Flood and the Radon-and-ground sections of the property report. */

import type { ReactElement } from 'react';
import type { FeatureCollection } from 'geojson';

import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';
import { GROUND_RISK_SOURCES } from '../groundRiskWording';

import { CheckTable, ReportSection, RiskScale, Unavailable, type CheckRow } from './ReportParts';
import { ReportMap } from './ReportMap';
import { FLOOD_DATASETS, hasDataset } from './reportGeometry';
import type { Tone } from './reportStyles';

const SURFACE_STEPS = ['Very low', 'Low', 'Medium', 'High'] as const;
const SURFACE_INDEX = { very_low: 0, low: 1, medium: 2, high: 3 } as const;
const SURFACE_TONE: Record<keyof typeof SURFACE_INDEX, Tone> = { very_low: 'clear', low: 'clear', medium: 'medium', high: 'high' };
const SURFACE_CHANCE = {
  very_low: 'Less than a 0.1% chance each year.',
  low: 'Between a 0.1% and 1% chance each year.',
  medium: 'Between a 1% and 3.3% chance each year.',
  high: 'More than a 3.3% chance each year.',
} as const;

interface SectionProps {
  report: PropertyIntelligenceReport;
  geometry: FeatureCollection | null;
}

function floodZoneRow(r: PropertyIntelligenceReport): CheckRow {
  const z = r.floodZone;
  if (!z) return { check: 'Rivers and sea (planning flood map)', result: 'Not available', tone: 'unknown' };
  const ref = z.zones[0]?.reference;
  switch (z.status) {
    case 'zone_3':
      return { check: 'Rivers and sea (planning flood map)', result: 'Flood Zone 3', meaning: 'High probability: 1 in 100 or more each year from rivers, 1 in 200 from the sea.', tone: 'high' };
    case 'zone_2':
      return { check: 'Rivers and sea (planning flood map)', result: 'Flood Zone 2', meaning: 'Medium probability: between 1 in 1,000 and 1 in 100 each year.', tone: 'medium' };
    case 'zone_present':
      return { check: 'Rivers and sea (planning flood map)', result: `Inside a flood zone${ref ? ` (ref ${ref})` : ''}`, meaning: 'Zone 2 or 3: a 1 in 1,000 or greater chance each year, ignoring defences.', tone: 'medium' };
    default:
      return { check: 'Rivers and sea (planning flood map)', result: 'Flood Zone 1', meaning: 'Outside Zones 2 and 3, the lowest probability.', tone: 'clear' };
  }
}

function warningsRow(r: PropertyIntelligenceReport): CheckRow {
  if (!r.flood) return { check: 'Live warnings within 10 km', result: 'Not available', tone: 'unknown' };
  const live = r.flood.activeWarnings.filter((w) => w.severity !== 'no_longer_in_force');
  if (live.length === 0) return { check: 'Live warnings within 10 km', result: 'None in force', meaning: 'Checked when this report was made.', tone: 'clear' };
  return {
    check: 'Live warnings within 10 km',
    result: `${live.length} in force`,
    meaning: live.slice(0, 2).map((w) => w.area).join('; '),
    tone: live.some((w) => w.severity !== 'alert') ? 'high' : 'medium',
  };
}

export function FloodSection({ report, geometry }: SectionProps): ReactElement {
  const gap = report.coverageGap;
  const sw = report.surfaceWater;
  const zone = floodZoneRow(report);
  const rows: CheckRow[] = [
    zone,
    sw
      ? { check: 'Surface water', result: SURFACE_STEPS[SURFACE_INDEX[sw.band]], meaning: SURFACE_CHANCE[sw.band], tone: SURFACE_TONE[sw.band] }
      : { check: 'Surface water', result: 'Not available', tone: 'unknown' },
    warningsRow(report),
  ];
  const worst = rows.some((r) => r.tone === 'high') ? 'high' : rows.some((r) => r.tone === 'medium') ? 'medium' : 'clear';
  const lead = worst === 'clear' ? 'No flood risk found.' : worst === 'high' ? 'Serious flood risk at this address.' : 'Some flood risk at this address.';
  const loc = report.location;

  if (gap) {
    return (
      <ReportSection id="flood" title="Flood">
        <Unavailable title={`Not covered in ${gap}.`}>The flood map and surface water data we use cover England only. Natural Resources Wales and SEPA publish flood maps for Wales and Scotland.</Unavailable>
      </ReportSection>
    );
  }
  return (
    <ReportSection id="flood" title="Flood" lead={lead} tone={worst} rest={worst === 'clear' ? undefined : 'Get a buildings insurance quote before you commit.'} source="Environment Agency: flood map for planning, Risk of Flooding from Surface Water (NaFRA2) and flood monitoring. Open Government Licence.">
      {sw && (
        <RiskScale
          label={`Surface water flood risk: ${SURFACE_STEPS[SURFACE_INDEX[sw.band]]}`}
          caption="Surface water (heavy rain that cannot drain away)"
          value={SURFACE_STEPS[SURFACE_INDEX[sw.band]]}
          steps={SURFACE_STEPS}
          active={SURFACE_INDEX[sw.band]}
          tone={SURFACE_TONE[sw.band]}
        />
      )}
      <CheckTable rows={rows} />
      {loc && hasDataset(geometry, FLOOD_DATASETS) && (
        <div className="mt-6">
          <ReportMap lat={loc.coordinates.lat} lng={loc.coordinates.lng} label={loc.postcode} geometry={geometry} datasets={[...FLOOD_DATASETS]} variant="boundary" caption="The flood zone drawn on the map, with the property marked." />
        </div>
      )}
    </ReportSection>
  );
}

const RADON_STEPS = ['<1%', '1–3%', '3–5%', '5–10%', '10–30%', '30%+'] as const;

export function GroundSection({ report }: { report: PropertyIntelligenceReport }): ReactElement {
  const radon = report.radon;
  const radonTone: Tone = !radon ? 'unknown' : radon.classMax >= 4 ? 'high' : radon.classMax >= 2 ? 'medium' : 'clear';
  const rows: CheckRow[] = [
    report.coalMining
      ? report.coalMining.inHighRiskArea
        ? { check: 'Coal mining high risk area', result: 'Inside one', meaning: 'Ask your conveyancer for a CON29M mining search.', tone: 'high' }
        : { check: 'Coal mining high risk area', result: 'Not in one', meaning: 'The coalfield is wider than these areas; your conveyancer decides on a mining search.', tone: 'clear' }
      : { check: 'Coal mining high risk area', result: 'Not available', tone: 'unknown' },
    report.brownfield
      ? report.brownfield.status === 'present'
        ? { check: 'Brownfield land register', result: 'Listed', meaning: 'Previously developed land; ask what it was used for.', tone: 'medium' }
        : { check: 'Brownfield land register', result: 'Not listed', tone: 'clear' }
      : { check: 'Brownfield land register', result: report.coverageGap ? `Not covered in ${report.coverageGap}` : 'Not available', tone: 'unknown' },
  ];
  const flagged = radonTone !== 'clear' && radonTone !== 'unknown' ? radon : null;
  const rowTone: Tone = rows.some((r) => r.tone === 'high') ? 'high' : rows.some((r) => r.tone === 'medium') ? 'medium' : 'clear';
  // A check that did not load must never read as "nothing found".
  const isIncomplete = !radon || rows.some((r) => r.tone === 'unknown');
  const lead = flagged
    ? `Radon class ${flagged.classMax} of 6 for this 1 km square.`
    : rowTone !== 'clear'
      ? 'Something to check below.'
      : isIncomplete
        ? 'Some ground checks didn’t load.'
        : 'Nothing found.';
  return (
    <ReportSection
      id="ground"
      title="Radon and ground"
      lead={lead}
      tone={flagged ? radonTone : rowTone !== 'clear' ? rowTone : isIncomplete ? 'unknown' : 'clear'}
      source={`${GROUND_RISK_SOURCES.radon} ${GROUND_RISK_SOURCES.coalMining} Brownfield: planning.data.gov.uk.`}
    >
      {radon ? (
        <>
          <RiskScale
            label={`Radon class ${radon.classMax} of 6`}
            caption={<>Share of homes above the radon action level, 1 km square <span className="font-['Geist_Mono',monospace]">{radon.gridSquare}</span></>}
            value={`Class ${radon.classMax} of 6`}
            steps={RADON_STEPS}
            active={radon.classMax - 1}
            tone={radonTone}
          />
          <p className="mt-3 max-w-[68ch] font-[DM_Sans] text-[15px] leading-relaxed text-[#4B5563] dark:text-[#CBD5E1]">
            This is the highest band anywhere in the square, not a measurement of this home. A three-month radon test gives the answer for the house itself; a radon sump is the usual fix for a high reading.
          </p>
        </>
      ) : (
        <Unavailable title="Radon data unavailable for this address." />
      )}
      <CheckTable rows={rows} />
    </ReportSection>
  );
}
