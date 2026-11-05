// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** The report's opening summary and its closing who-to-ask checklists. */

import type { ReactElement } from 'react';
import type { FeatureCollection } from 'geojson';

import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';

import { ReportSection } from './ReportParts';
import { ReportMap } from './ReportMap';
import { buildAskLists, buildClears, buildStandouts, type AskItem } from './reportFindings';
import { R, TONE_FILL, TONE_TEXT } from './reportStyles';

function sentenceList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function SummarySection({ report, geometry, placeName }: { report: PropertyIntelligenceReport; geometry: FeatureCollection | null; placeName: string }): ReactElement {
  const standouts = buildStandouts(report);
  const clears = buildClears(report);
  const loc = report.location;
  return (
    <ReportSection id="summary" title={standouts.length ? `What stands out at ${placeName}` : `Nothing stands out at ${placeName}`}>
      <div className={`mt-4 grid gap-6 ${loc ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''}`}>
        <div>
          {standouts.length > 0 ? (
            <>
              <p className={R.finding}>
                {standouts.length === 1 ? 'One thing is worth raising before you offer:' : `${standouts.length} things are worth raising before you offer:`}
              </p>
              <ul className="mt-3 list-none space-y-3 p-0">
                {standouts.map((s) => (
                  <li key={s.key} className="grid grid-cols-[auto_1fr] gap-x-3">
                    <span aria-hidden="true" className={`mt-[7px] h-2.5 w-2.5 rounded-sm ${TONE_FILL[s.severity]}`} />
                    <span>
                      <a href={`#report-${s.section}`} className={`font-[DM_Sans] text-[15px] font-semibold no-underline hover:underline ${TONE_TEXT[s.severity]}`}>
                        {s.title}
                        <span className="sr-only">{s.severity === 'high' ? ' (serious)' : s.severity === 'medium' ? ' (moderate)' : ' (limits changes)'}</span>
                      </a>
                      <span className={`block ${R.body}`}>{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={R.finding}>None of the free checks found a flood, ground or planning issue here.</p>
          )}
          {clears.length > 0 && (
            <p className={`mt-4 ${R.body}`}>
              Came back clear: {sentenceList(clears)}.
            </p>
          )}
          {report.coverageGap && (
            <p className={`mt-4 ${R.body}`}>
              Flood, heritage and planning designation checks use data that covers England only, so they are not shown for this address in {report.coverageGap}.
            </p>
          )}
          <p className={`mt-4 ${R.source}`}>None of this replaces your conveyancer’s official searches.</p>
        </div>
        {loc && (
          <ReportMap lat={loc.coordinates.lat} lng={loc.coordinates.lng} label={loc.postcode} geometry={geometry} datasets={[]} variant="street" caption="The plot and its roads." heightClass="h-64 lg:h-full lg:min-h-[16rem] 2xl:min-h-[22rem]" />
        )}
      </div>
    </ReportSection>
  );
}

function AskColumn({ title, items }: { title: string; items: AskItem[] }): ReactElement {
  return (
    <div>
      <h3 className={`border-b-2 border-[#1A1A1A] pb-2 dark:border-[#E5E7EB] ${R.h3}`}>{title}</h3>
      <ol className="mt-3 space-y-3 pl-5">
        {items.map((item) => (
          <li key={item.q} className={R.body}>
            <span className={`font-semibold ${R.ink}`}>{item.q}</span>
            <span className={`block text-[13px] ${R.muted}`}>{item.why}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AskSection({ report }: { report: PropertyIntelligenceReport }): ReactElement {
  const lists = buildAskLists(report);
  return (
    <ReportSection id="ask" title="Who to ask, and what" rest="Built from the findings above, so the questions are about this address.">
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <AskColumn title="The seller" items={lists.seller} />
        <AskColumn title="Your conveyancer" items={lists.conveyancer} />
        <AskColumn title="Your surveyor" items={lists.surveyor} />
      </div>
    </ReportSection>
  );
}
