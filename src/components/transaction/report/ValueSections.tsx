// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Sold prices (chart and table) and Energy (EPC rating ladder) sections. */

import { lazy, Suspense, useState, type ReactElement } from 'react';

import type { EpcBand, PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';

import { ReportSection, Unavailable } from './ReportParts';
import { R } from './reportStyles';

const PriceChart = lazy(() => import('./PriceChart'));

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const monthYear = (iso: string): string => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
/** Land Registry property type codes in plain words. */
function propertyType(t: string | null): string {
  if (!t) return 'Not recorded';
  if (t === 'otherPropertyType') return 'Other';
  if (t === 'flat-maisonette') return 'Flat or maisonette';
  return t.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function PricesSection({ report }: { report: PropertyIntelligenceReport }): ReactElement {
  const p = report.pricePaid;
  const [showAll, setShowAll] = useState(false);
  const postcode = report.location?.postcode ?? report.postcode;
  if (!p) {
    return (
      <ReportSection id="prices" title={`Sold prices on ${postcode}`}>
        <Unavailable title="HM Land Registry didn’t respond when this report was made." />
      </ReportSection>
    );
  }
  const sales = [...p.sales].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sales[0];
  const oldest = sales[sales.length - 1];
  const rows = showAll ? sales : sales.slice(0, 10);
  return (
    <ReportSection
      id="prices"
      title={`Sold prices on ${postcode}`}
      lead={sales.length === 0 ? 'No recorded sales on this postcode.' : undefined}
      rest={latest ? `${sales.length} ${sales.length === 1 ? 'sale' : 'sales'} recorded since ${new Date(oldest.date).getFullYear()}. The most recent was ${GBP.format(latest.amount)} in ${monthYear(latest.date)}.` : undefined}
      tone="clear"
      source="HM Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right. Open Government Licence."
    >
      {sales.length > 1 && (
        <figure className={`mt-5 rounded-lg border ${R.rule} ${R.paper} px-3 pb-2 pt-3`}>
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded bg-[#EEF2EE] dark:bg-[#1F2937]" />}>
            <PriceChart sales={sales} />
          </Suspense>
          <figcaption className={`mt-1 px-1 ${R.source}`}>Each dot is one sale; the latest is in teal. Property types are mixed, so read this as the postcode’s range, not a trend.</figcaption>
        </figure>
      )}
      {sales.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b ${R.rule}`}>
                <th scope="col" className={R.th}>Date</th>
                <th scope="col" className={R.th}>Address</th>
                <th scope="col" className={R.th}>Type</th>
                <th scope="col" className={`${R.th} text-right`}>Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.date}-${s.paon}-${s.amount}`} className={`border-b ${R.rule}`}>
                  <td className={`${R.td} ${R.mono} whitespace-nowrap`}>{monthYear(s.date)}</td>
                  <td className={R.td}>{[s.paon, s.street].filter(Boolean).join(' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                  <td className={`${R.td} ${R.ink2}`}>{propertyType(s.propertyType)}</td>
                  <td className={`${R.td} ${R.mono} whitespace-nowrap text-right`}>{GBP.format(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length > 10 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 font-[DM_Sans] text-sm font-medium text-[#0F766E] underline underline-offset-2 dark:text-[#14B8A6]">
              {showAll ? 'Show the latest 10' : `Show all ${sales.length} sales`}
            </button>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/** Official EPC band colours and score floors. */
const BANDS: ReadonlyArray<{ band: EpcBand; min: string; color: string; width: string }> = [
  { band: 'A', min: '92+', color: '#008054', width: '34%' },
  { band: 'B', min: '81–91', color: '#19B459', width: '42%' },
  { band: 'C', min: '69–80', color: '#8DCE46', width: '50%' },
  { band: 'D', min: '55–68', color: '#FFD500', width: '58%' },
  { band: 'E', min: '39–54', color: '#FCAA65', width: '66%' },
  { band: 'F', min: '21–38', color: '#EF8023', width: '74%' },
  { band: 'G', min: '1–20', color: '#E9153B', width: '82%' },
];

export function EnergySection({ report }: { report: PropertyIntelligenceReport }): ReactElement {
  const epc = report.epc;
  if (!epc) {
    const didFail = report.sources.some((s) => s.source === 'get-energy-performance-data.communities.gov.uk' && !s.ok);
    return (
      <ReportSection id="energy" title="Energy">
        {didFail ? (
          <Unavailable title="The energy certificate register didn’t respond when this report was made." />
        ) : (
          <Unavailable title="No energy certificate found for this address.">The register may hold one under a different address format, or the house may never have been assessed.</Unavailable>
        )}
      </ReportSection>
    );
  }
  const lodged = epc.lodgementDate ? new Date(epc.lodgementDate) : null;
  const expired = lodged ? Date.now() - lodged.getTime() > 10 * 365.25 * 24 * 3600 * 1000 : false;
  return (
    <ReportSection
      id="energy"
      title="Energy"
      lead={`Energy rating ${epc.currentBand}${epc.currentRating ? ` (${epc.currentRating})` : ''}.`}
      tone={'EFG'.includes(epc.currentBand) ? 'medium' : 'clear'}
      rest={epc.potentialBand ? `It could reach ${epc.potentialBand} with the recommended improvements.` : undefined}
      source="Energy Performance of Buildings Register, MHCLG."
    >
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <ol className="m-0 list-none space-y-1 p-0" aria-label="Energy rating scale">
          {BANDS.map((b) => {
            const isCurrent = b.band === epc.currentBand;
            const isPotential = b.band === epc.potentialBand;
            return (
              <li key={b.band} className="flex items-center gap-3">
                <span className="flex h-7 items-center justify-between rounded-sm px-2 font-['Geist_Mono',monospace] text-[13px] font-medium text-[#1A1A1A]" style={{ width: b.width, background: b.color }}>
                  <span>{b.min}</span>
                  <span className="font-bold">{b.band}</span>
                </span>
                <span className={`font-[DM_Sans] text-[13px] font-semibold ${R.ink}`}>
                  {isCurrent && `Current${epc.currentRating ? ` ${epc.currentRating}` : ''}`}
                  {isCurrent && isPotential && ' · '}
                  {isPotential && `Potential${epc.potentialRating ? ` ${epc.potentialRating}` : ''}`}
                </span>
              </li>
            );
          })}
        </ol>
        <dl className={`m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 self-start ${R.body}`}>
          <dt className={R.muted}>Floor area</dt>
          <dd className={`m-0 ${R.ink} ${R.mono}`}>{epc.floorAreaSqm ? `${epc.floorAreaSqm} m²` : 'Not recorded'}</dd>
          <dt className={R.muted}>Assessed</dt>
          <dd className={`m-0 ${R.ink} ${R.mono}`}>{lodged ? monthYear(epc.lodgementDate as string) : 'Not recorded'}{expired ? ' (over 10 years, expired)' : ''}</dd>
          <dt className={R.muted}>Letting standard</dt>
          <dd className={`m-0 ${R.ink}`}>{epc.meetsMees ? 'Meets the minimum (E or better)' : 'Below the minimum for letting (F or G)'}</dd>
          {report.valuePerSqm && (
            <>
              <dt className={R.muted}>Latest sale per m²</dt>
              <dd className={`m-0 ${R.ink} ${R.mono}`}>{GBP.format(report.valuePerSqm)}</dd>
            </>
          )}
        </dl>
      </div>
    </ReportSection>
  );
}
