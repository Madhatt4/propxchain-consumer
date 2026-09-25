// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { ReactNode } from 'react';
import { normalizeMaterialInfo } from '@/utils/materialInfo';
import type { MaterialInfo, MaterialInfoField, MaterialInfoSource } from '@/types/materialInfo.types';

const SOURCE_LABELS: Record<Exclude<MaterialInfoSource, 'missing'>, string> = {
  listing: 'from listing',
  epc: 'from EPC register',
  agent: 'confirmed by agent',
};

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function formatGbp(value: number): string {
  return GBP_FORMATTER.format(value);
}

function formatArea(value: number): string {
  return `${value} m²`;
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

/** Small pill naming where a Material Information value came from. */
function SourceBadge({ source }: { source: MaterialInfoSource }): JSX.Element | null {
  if (source === 'missing') return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-[#0D9488]/10 px-2 py-0.5 font-[DM_Sans] text-xs font-medium text-[#0D9488]">
      {SOURCE_LABELS[source]}
    </span>
  );
}

interface MaterialInfoRowProps<T> {
  label: string;
  field: MaterialInfoField<T>;
  format: (value: T) => string;
}

/** One label/value row: formatted value + source badge, or a muted "Not yet provided". */
function MaterialInfoRow<T>({ label, field: infoField, format }: MaterialInfoRowProps<T>): JSX.Element {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-[DM_Sans] text-sm text-[#6B7280]">{label}</span>
      <span className="font-[DM_Sans] text-sm text-[#1A1A1A]">
        {infoField.value !== null ? (
          <>
            {format(infoField.value)}
            <SourceBadge source={infoField.source} />
          </>
        ) : (
          <span className="italic text-[#9CA3AF]">Not yet provided</span>
        )}
      </span>
    </div>
  );
}

interface MaterialInfoSectionProps {
  heading: string;
  children: ReactNode;
}

/** Heading + divided rows for one Material Information part (A/B/C). */
function MaterialInfoSection({ heading, children }: MaterialInfoSectionProps): JSX.Element {
  return (
    <section className="mb-6">
      <h3 className="mb-2 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1A1A1A]">
        {heading}
      </h3>
      <div className="divide-y divide-[#E5E7EB]">{children}</div>
    </section>
  );
}

export interface MaterialInfoPanelProps {
  info: Partial<MaterialInfo>;
  tenure: string | null;
}

/** Read-only Material Information panel, shared by the public listing page and the
 *  agent's listing detail view. Pure props — no hooks, no service calls.
 *  `info` is normalized defensively: the DB column defaults a brand-new row
 *  to `{}`, which doesn't match the compile-time `MaterialInfo` shape. */
export function MaterialInfoPanel({ info: rawInfo, tenure }: MaterialInfoPanelProps): JSX.Element {
  const info = normalizeMaterialInfo(rawInfo);
  // Lease terms are only meaningless for a confirmed freehold; when tenure is
  // unknown (null) we still show the section so an agent can fill it in.
  const showLeaseSection = tenure !== 'freehold';

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
      <MaterialInfoSection heading="Part A">
        <MaterialInfoRow label="Price" field={info.price} format={formatGbp} />
        <MaterialInfoRow label="Tenure" field={info.tenure} format={(value) => value} />
        <MaterialInfoRow label="Council tax band" field={info.councilTaxBand} format={(value) => value} />
        <MaterialInfoRow label="EPC rating" field={info.epcRating} format={(value) => value} />
        <MaterialInfoRow label="Floor area" field={info.epcFloorAreaSqm} format={formatArea} />
      </MaterialInfoSection>

      {showLeaseSection && (
        <MaterialInfoSection heading="Part B">
          <MaterialInfoRow label="Lease years remaining" field={info.leaseYearsRemaining} format={(value) => `${value}`} />
          <MaterialInfoRow label="Ground rent" field={info.groundRentPerYear} format={formatGbp} />
          <MaterialInfoRow label="Service charge" field={info.serviceChargePerYear} format={formatGbp} />
        </MaterialInfoSection>
      )}

      <MaterialInfoSection heading="Part C">
        <MaterialInfoRow label="Flood risk" field={info.floodRisk} format={(value) => value} />
        <MaterialInfoRow label="Conservation area" field={info.conservationArea} format={formatBoolean} />
        <MaterialInfoRow label="Listed building" field={info.listedBuilding} format={(value) => value} />
      </MaterialInfoSection>
    </div>
  );
}

export default MaterialInfoPanel;
