// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * TA6 §5.2 — one row of alteration paperwork. The slot alone could not say
 * what a document was, so each row now carries what it is (`kind`), what
 * "other" means (`kindDetails`) and which 5.1 change it covers (`relatesTo`).
 * All three stay null until the seller says, so nothing is invented. Mirrors
 * `AlterationDocument` in the canister's forms_types.mo; labels here are
 * PropXchain paraphrase and are shared by the form and the PDF.
 */
import type { TA6AlterationTypes } from './ta6.sections';
import type { TA6DocumentValue } from './ta6.types';

export type TA6AlterationDocumentKind =
  | 'planning-permission'
  | 'building-regs-approval'
  | 'building-regs-completion'
  | 'competent-person-certificate'
  | 'listed-building-consent'
  | 'conservation-area-consent'
  | 'other';

/** The 5.1 tick-set as a value, so a row can point at one tick. */
export type TA6AlterationKind =
  | 'windows-post-2002'
  | 'conservatory'
  | 'extension'
  | 'loft-conversion'
  | 'garage-conversion'
  | 'internal-walls-removed'
  | 'change-of-use'
  | 'structural-roof-works'
  | 'other';

export interface TA6AlterationDocument {
  kind: TA6AlterationDocumentKind | null;
  /** What the paperwork is when `kind` is 'other'. */
  kindDetails: string | null;
  relatesTo: TA6AlterationKind | null;
  document: TA6DocumentValue;
}

/** Selector order, following the 5.2 wording. */
export const TA6_ALTERATION_DOCUMENT_KINDS: readonly TA6AlterationDocumentKind[] = [
  'planning-permission',
  'building-regs-approval',
  'building-regs-completion',
  'competent-person-certificate',
  'listed-building-consent',
  'conservation-area-consent',
  'other',
];

export const TA6_ALTERATION_DOCUMENT_KIND_LABELS: Record<TA6AlterationDocumentKind, string> = {
  'planning-permission': 'Planning permission',
  'building-regs-approval': 'Building regulations approval',
  'building-regs-completion': 'Building regulations completion certificate',
  'competent-person-certificate': 'Competent-person certificate (FENSA, CERTASS, Gas Safe, NICEIC)',
  'listed-building-consent': 'Listed building consent',
  'conservation-area-consent': 'Conservation area consent',
  other: 'Other paperwork',
};

export const TA6_ALTERATION_KIND_LABELS: Record<TA6AlterationKind, string> = {
  'windows-post-2002': 'Replacement windows, doors or glazing',
  conservatory: 'Conservatory',
  extension: 'Extension',
  'loft-conversion': 'Loft conversion',
  'garage-conversion': 'Garage conversion',
  'internal-walls-removed': 'Internal walls removed or altered',
  'change-of-use': 'Change of use',
  'structural-roof-works': 'Structural work to the roof',
  other: 'Other change',
};

/** Which TA6AlterationKind each 5.1 tick is, in the order the form shows them. */
export const ALTERATION_KIND_BY_FLAG: Record<
  Exclude<keyof TA6AlterationTypes, 'otherDetails'>,
  TA6AlterationKind
> = {
  windowsPost2002: 'windows-post-2002',
  conservatory: 'conservatory',
  extension: 'extension',
  loftConversion: 'loft-conversion',
  garageConversion: 'garage-conversion',
  internalWallsRemoved: 'internal-walls-removed',
  changeOfUse: 'change-of-use',
  structuralRoofWorks: 'structural-roof-works',
  other: 'other',
};

/** The 5.1 changes currently ticked, in form order. */
export function tickedAlterationKinds(a: TA6AlterationTypes): TA6AlterationKind[] {
  return (Object.keys(ALTERATION_KIND_BY_FLAG) as Array<keyof typeof ALTERATION_KIND_BY_FLAG>)
    .filter((flag) => a[flag])
    .map((flag) => ALTERATION_KIND_BY_FLAG[flag]);
}

/**
 * doc-classify answers (its `doc_type` option keys) that are 5.2 paperwork.
 * Anything else — an EPC, a survey, 'other' — leaves the seller to choose.
 * A building regulations certificate reads as the completion certificate:
 * that is the document a seller holds; the approval is the earlier letter.
 */
export const ALTERATION_KIND_FROM_DOC_TYPE: Partial<Record<string, TA6AlterationDocumentKind>> = {
  planning_permission: 'planning-permission',
  building_regs_certificate: 'building-regs-completion',
  fensa: 'competent-person-certificate',
};
