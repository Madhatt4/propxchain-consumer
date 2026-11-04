// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Wording for the report's ground and water checks (surface water, coal
 * mining, radon). Pure helpers, so the on-screen card (GroundRiskSections.tsx)
 * and the PDF read the same words. The wording is deliberately careful about
 * what each source can and cannot say (see groundRiskService.ts): radon is a
 * 1 km square, not the home, and being outside a coal high risk area is not
 * the same as being outside the coalfield.
 */

import type { CoalMiningRisk, RadonRisk, SurfaceWaterRisk } from '../../services/groundRiskService';

import type { Status } from './PropertyIntelSections';

// --- Surface water -----------------------------------------------------------

/** Annual chance per Environment Agency risk band definitions. */
const SURFACE_WATER_BANDS: Record<SurfaceWaterRisk['band'], { label: string; chance: string; status: Status }> = {
  high: { label: 'High risk', chance: 'more than a 3.3% chance of flooding each year', status: 'high' },
  medium: { label: 'Medium risk', chance: 'between a 1% and 3.3% chance of flooding each year', status: 'medium' },
  low: { label: 'Low risk', chance: 'between a 0.1% and 1% chance of flooding each year', status: 'low' },
  very_low: { label: 'Very low risk', chance: 'less than a 0.1% chance of flooding each year', status: 'low' },
};

export function surfaceWaterSummaryStatus(data: SurfaceWaterRisk | null | undefined): Status {
  return data ? SURFACE_WATER_BANDS[data.band].status : 'unknown';
}

export function surfaceWaterSummaryText(data: SurfaceWaterRisk | null | undefined): string {
  return data ? SURFACE_WATER_BANDS[data.band].label : 'Source unavailable';
}

export function surfaceWaterDetailText(data: SurfaceWaterRisk | null | undefined): string {
  if (!data) return 'Surface water flood data is unavailable for this address.';
  const band = SURFACE_WATER_BANDS[data.band];
  return `${band.label} of flooding from surface water (heavy rain that cannot drain away): ${band.chance}. This describes the location, not whether the building itself floods.`;
}

// --- Coal mining -------------------------------------------------------------

export function coalMiningSummaryStatus(data: CoalMiningRisk | null | undefined): Status {
  if (!data) return 'unknown';
  return data.inHighRiskArea ? 'high' : 'low';
}

export function coalMiningSummaryText(data: CoalMiningRisk | null | undefined): string {
  if (!data) return 'Source unavailable';
  return data.inHighRiskArea ? 'In a high risk area' : 'Not in a high risk area';
}

export function coalMiningDetailText(data: CoalMiningRisk | null | undefined): string {
  if (!data) return 'Coal mining data is unavailable for this address.';
  return data.inHighRiskArea
    ? 'This location is in a coal mining Development High Risk Area, where past mining may affect the ground. Ask your conveyancer to order a CON29M coal mining search.'
    : 'This location is not in a coal mining Development High Risk Area. The coalfield is wider than these areas, so your conveyancer will still decide whether a mining search is needed.';
}

// --- Radon -------------------------------------------------------------------

export function radonSummaryStatus(data: RadonRisk | null | undefined): Status {
  if (!data) return 'unknown';
  if (data.classMax >= 4) return 'high';
  // Class 2 and above is a Radon Affected Area (1% or more of homes above the action level).
  return data.classMax >= 2 ? 'medium' : 'low';
}

export function radonSummaryText(data: RadonRisk | null | undefined): string {
  return data ? `Class ${data.classMax} of 6` : 'Source unavailable';
}

export function radonDetailText(data: RadonRisk | null | undefined): string {
  if (!data) return 'Radon data is unavailable for this address.';
  const square = data.gridSquare ? ` (${data.gridSquare})` : '';
  return `${data.description} This is the highest level anywhere in the surrounding 1 km grid square${square}, not a measurement of this home. A radon test gives a property-level answer.`;
}

// --- Sources -----------------------------------------------------------------

export const GROUND_RISK_SOURCES = {
  surfaceWater: 'Environment Agency, Risk of Flooding from Surface Water (NaFRA2). Open Government Licence.',
  coalMining: 'Contains Mining Remediation Authority data. Open Government Licence.',
  radon: 'Contains British Geological Survey materials © UKRI and UKHSA data. Open Government Licence.',
} as const;
