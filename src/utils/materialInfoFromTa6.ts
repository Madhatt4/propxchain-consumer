// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { TA6PropertyInformation, TA6AnswerValue, TA6HeatingType, TA6ParkingType, TA6SewerageSource } from '@/types/ta6.types';
import type { SellerPartB } from '@/types/materialInfo.types';

const HEATING: Record<TA6HeatingType, string> = {
  'gas-central': 'Gas central heating',
  oil: 'Oil',
  lpg: 'LPG',
  electric: 'Electric',
  'heat-pump-air': 'Air source heat pump',
  'heat-pump-ground': 'Ground source heat pump',
  'solid-fuel': 'Solid fuel',
  'solar-thermal': 'Solar thermal',
  'district-heating': 'District heating',
  other: 'Other',
};

const PARKING: Record<TA6ParkingType, string> = {
  garage: 'Garage',
  driveway: 'Driveway',
  allocated: 'Allocated space',
  'on-road': 'On-road',
  permit: 'Permit parking',
  none: 'None',
  other: 'Other',
};

const SEWERAGE: Record<TA6SewerageSource, string> = {
  mains: 'Mains',
  'septic-tank': 'Septic tank',
  cesspool: 'Cesspool',
  'sewage-treatment-plant': 'Sewage treatment plant',
  other: 'Other',
};

/** Only a definite yes/no says anything; "not known" and unanswered stay blank. */
function mains(answer: TA6AnswerValue | undefined, no: string): string | undefined {
  if (answer === 'yes') return 'Mains';
  if (answer === 'no') return no;
  return undefined;
}

function list<T extends string>(values: T[] | undefined, labels: Record<T, string>): string | undefined {
  const named = [...new Set((values ?? []).map((v) => labels[v]).filter(Boolean))];
  return named.length > 0 ? named.join(', ') : undefined;
}

/**
 * NTS Material Information Part B values the seller has already given on
 * their TA6 (§10 parking, §11 services, §12 connections), so an agent never
 * re-asks them. Pure: no provider names, meter numbers or locations leave
 * the form, only the kind of supply.
 */
export function partBFromTa6(ta6: TA6PropertyInformation | null | undefined): SellerPartB {
  if (!ta6) return {};
  const s10 = ta6.section10;
  const s11 = ta6.section11;
  const s12 = ta6.section12;
  const out: SellerPartB = {
    electricity: mains(s12?.mainsElectricity?.connected, 'Not mains'),
    water: mains(s12?.mainsWater?.connected, 'Private supply'),
    sewerage: s11?.q11_6SewerageSource
      ? SEWERAGE[s11.q11_6SewerageSource]
      : mains(s12?.mainsSewerage?.connected, 'Not mains'),
    heating: list(s11?.q11_4HeatingSystems?.map((h) => h.heatingType), HEATING),
    broadband:
      s12?.broadband?.connected === 'yes' ? 'Connected' : s12?.broadband?.connected === 'no' ? 'Not connected' : undefined,
    parking: list(s10?.q10_1Arrangements, PARKING),
  };
  for (const key of Object.keys(out) as (keyof SellerPartB)[]) if (out[key] === undefined) delete out[key];
  return out;
}
