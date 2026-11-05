// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { PropertyIntelligenceReport } from '../../services/propertyIntelligenceService';

const MAX_NEXT_STEPS = 5;

/** Short, conditional "what to check next" prompts driven by the findings. */
export function buildNextSteps(r: PropertyIntelligenceReport): string[] {
  const steps: string[] = [];
  if (r.coverageGap)
    steps.push(`The flood, heritage and planning designation checks don’t cover ${r.coverageGap} yet. Your conveyancer’s local searches will confirm them.`);
  if (r.article4?.status === 'restricted')
    steps.push('Permitted-development rights are restricted here (Article 4) — budget for a full planning application before extending or altering.');
  if (r.floodZone?.status && r.floodZone.status !== 'none')
    steps.push('This property sits in a flood zone — order a flood report and get insurance quotes early, before you commit.');
  if (r.surfaceWater && (r.surfaceWater.band === 'high' || r.surfaceWater.band === 'medium'))
    steps.push('Surface water flood risk is raised here — ask the seller about past flooding and get insurance quotes early.');
  if (r.coalMining?.inHighRiskArea)
    steps.push('In a coal mining high risk area — ask your conveyancer to order a CON29M coal mining search.');
  if (r.heritage && (r.heritage.status === 'listed_building' || r.heritage.status === 'both'))
    steps.push('Heritage designation applies — alterations will need listed-building or conservation-area consent.');
  if (r.treePreservation?.status === 'present')
    steps.push('Protected trees (TPO) on or near the plot — you need council consent to fell, top or lop them.');
  if (r.radon && r.radon.classMax >= 2)
    steps.push('In a radon affected area — ask whether the home has been tested for radon, and consider a test.');
  if (r.brownfield?.status === 'present')
    steps.push('On the brownfield land register — ask about ground conditions and any previous use of the site.');
  if (r.planningApplications?.status === 'many')
    steps.push('Several recent planning applications nearby — review them for developments that could affect the property.');
  if (steps.length === 0)
    steps.push('No major flags on the free public data. Still order the official local searches to confirm before exchange.');
  // The page has room for five lines. Trim the flags, never the official-searches
  // line: it matters most on exactly the reports with the most flags.
  return [
    ...steps.slice(0, MAX_NEXT_STEPS - 1),
    'This is indicative intel from free open-government sources — your official searches remain the authoritative record.',
  ];
}
