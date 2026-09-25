// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Pure helpers and limits shared across the Home Mover Report PDF modules —
 * kept out of the component files so fast refresh sees only components there.
 */

import type { PlanningEntity, PropertyIntelligenceReport } from '../../services/propertyIntelligenceService';

/** Per-list caps. Applications and sales match the on-screen panels exactly;
 *  designation lists are capped so one dense conservation area can't run to
 *  pages — the note below each capped list points at the online report. */
export const MAX_ENTITIES = 10;
export const MAX_APPLICATIONS = 10;
export const MAX_SALES = 8;

export const UNAVAILABLE_PLANNING = 'planning.data.gov.uk data unavailable.';

/** "(REF-1)" — the reference suffix zones and TPOs carry on screen. */
export const reference = (e: PlanningEntity): string | null => (e.reference ? `(${e.reference})` : null);

/** "12, Central Bedfordshire, SG18 0AA" — shared by the summary header and the detail pages. */
export function placeLine(report: PropertyIntelligenceReport, addressLine?: string | null): string {
  const loc = report.location;
  const where = loc ? `${loc.admin_district}, ${loc.postcode}` : report.postcode;
  return `${addressLine ? `${addressLine}, ` : ''}${where}`;
}
