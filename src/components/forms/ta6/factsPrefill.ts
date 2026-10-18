// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// TA6 answers a confirmed certificate fact can fill (decision Q23, 2026-10-15).
// Only two are a clean fit:
//   - 11.3 "Has the electrical installation been tested (EICR)?" -> Yes, from
//     any confirmed EICR fact. The report date is not filled: a photo has none.
//   - 5.1 "Replacement windows or doors since 2002" -> ticked, from a confirmed
//     FENSA certificate (FENSA only exists for post-2002 work).
// 11.4 (heating) is left alone: a gas safety record is not a service record
// (Q24). The EPC has no TA6 question at all.
//
// Blanks only, and only from a fact the seller confirmed AFTER the form was
// last saved: without that, a seller who unticks a suggestion would find it
// ticked again on the next load. A form never saved has no such edit to
// protect, so every confirmed fact counts (an unsaved form's lastModifiedAt is
// the moment the page opened, which hid every earlier confirmation, 16 Oct).

import type { CurrentFact } from '../../../services/documentFacts.service';
import type { TA6PropertyInformation } from '../../../types/ta6.types';

/** Badge keys the sections look up. */
export const SUGGESTED_EICR = '11.3';
export const SUGGESTED_WINDOWS = '5.1.windows';

export interface FactsPrefill {
  form: TA6PropertyInformation;
  /** Which answers were filled, for the "suggested from your upload" badge. */
  suggested: string[];
}

function confirmedSince(facts: CurrentFact[], since: string | null): CurrentFact[] {
  const after = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
  return facts.filter(
    (f) => f.status === 'confirmed' && f.decidedAt !== null && Date.parse(f.decidedAt) > after,
  );
}

function alterationsUntouched(form: TA6PropertyInformation): boolean {
  const { otherDetails, ...ticks } = form.section5.q5_1Alterations;
  return otherDetails === null && Object.values(ticks).every((ticked) => ticked === false);
}

/** `savedAt`: when the stored form was last edited, null when it has never been saved. */
export function prefillTa6FromFacts(
  form: TA6PropertyInformation,
  facts: CurrentFact[],
  savedAt: string | null,
): FactsPrefill {
  const usable = confirmedSince(facts, savedAt);
  const suggested: string[] = [];
  let next = form;

  const hasEicr = usable.some((f) => f.factKey.startsWith('eicr.'));
  if (hasEicr && next.section11.q11_3Eicr === 'not-answered') {
    next = { ...next, section11: { ...next.section11, q11_3Eicr: 'yes' } };
    suggested.push(SUGGESTED_EICR);
  }

  const hasFensa = usable.some((f) => f.factKey === 'fensa.present' && f.value === 'true');
  if (hasFensa && alterationsUntouched(next)) {
    next = {
      ...next,
      section5: { ...next.section5, q5_1Alterations: { ...next.section5.q5_1Alterations, windowsPost2002: true } },
    };
    suggested.push(SUGGESTED_WINDOWS);
  }

  return { form: next, suggested };
}
