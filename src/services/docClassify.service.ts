// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * docClassify.service — the consumer side of document classification on
 * upload (Jev programme job J4). Wraps the monorepo-owned `doc-classify` edge
 * function, which reads the uploaded object itself: the client sends only the
 * transaction id and the bucket-relative path, never the file or its text.
 *
 * The result is ADVISORY. It never blocks an upload, never writes to the
 * chain and decides nothing: the seller's conveyancer does. Every failure
 * resolves to null and the slot renders without a line, the same posture as
 * searchesExplainer.service — a missing enhancement, never an error the
 * seller should see.
 */
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { DocFact } from './documentFacts.service';
import type { TA6AlterationDocumentKind, TA6AlterationKind } from '../types/ta6.alterationDocument';

const FUNCTION_NAME = 'doc-classify';

/** The 6.1 checklist, as the function's closed vocabulary spells it (the `6.1.<type>` ref suffixes). */
export const TA6_WARRANTY_TYPES = [
  'new-home-warranty',
  'damp-proofing',
  'timber-treatment',
  'roofing',
  'electrical-work',
  'windows-doors',
  'central-heating',
  'underpinning',
  'other',
] as const;
export type TA6WarrantyType = (typeof TA6_WARRANTY_TYPES)[number];

export const WARRANTY_TYPE_LABELS: Readonly<Record<TA6WarrantyType, string>> = {
  'new-home-warranty': 'New home warranty',
  'damp-proofing': 'Damp proofing',
  'timber-treatment': 'Timber treatment',
  roofing: 'Roofing',
  'electrical-work': 'Electrical work',
  'windows-doors': 'Windows and doors',
  'central-heating': 'Central heating',
  underpinning: 'Underpinning',
  other: 'Other work',
};

export function isWarrantyType(value: string): value is TA6WarrantyType {
  return (TA6_WARRANTY_TYPES as readonly string[]).includes(value);
}

/**
 * Which TA6 slot an upload sits in and what the form already says about it.
 * Sent with the upload so the function runs the consents scan in the same
 * Jev call; absent for every other slot, which then behaves as before.
 */
export type DocScanContext =
  | {
      section: '5.2';
      kind: TA6AlterationDocumentKind | null;
      relatesTo: TA6AlterationKind | null;
      /** The 5.1 changes ticked, for a row the seller has not linked yet. */
      ticked: TA6AlterationKind[];
    }
  | { section: '6.1'; warrantyType: TA6WarrantyType }
  /** A completed form handed in as a PDF from the stage card: the scan reviews the answers. */
  | { section: 'form'; form: 'ta6' | 'ta10' | 'ta7' };

export type DocFindingKey =
  | 'unrelated_to_change'
  | 'not_a_grant'
  | 'conditions_outstanding'
  | 'approval_not_completion'
  | 'planning_lapsed'
  | 'not_about_property'
  | 'wrong_warranty_type'
  | 'installer_promise_only'
  | 'not_transferable'
  | 'warranty_expired'
  | 'wrong_paperwork'
  | 'mostly_blank'
  | 'many_blanks'
  | 'some_blanks'
  | 'yes_without_detail'
  | 'answers_contradict'
  | 'alterations_without_paperwork'
  | 'dispute_undisclosed'
  | 'services_gap'
  | 'environment_detail_missing'
  | 'item_included_and_excluded'
  | 'rooms_not_covered'
  | 'lease_terms_missing'
  | 'charges_unanswered';

export interface DocPropertyCheck {
  expectedPostcode: string | null;
  foundPostcodes: string[];
  /** True when the transaction's postcode is in the document, false when others are and it is not, null when either side is empty. */
  postcodeMatches: boolean | null;
}

/** One thing the consents scan found worth saying, already at or above the function's bar. */
export interface DocFinding {
  key: DocFindingKey | string;
  label: string;
  /** 0..1, the probability the problem is present. */
  probability: number;
}

/** The `doc-classify` 200 body. `docType` is one of the function's option keys, `other` when unsure. */
export interface DocClassification {
  docType: string;
  /** 0..1, the probability mass behind `docType`. */
  confidence: number;
  /** Null when no validity window applies, no date was found, or the type is not confident. */
  inDate: boolean | null;
  /** 0..1 yes-probability that the document is about this property; null when unreadable. */
  matchesProperty: number | null;
  /** True when nothing could be read: an image-only PDF, a HEIC, or a photo outside the size limits. */
  unreadable: boolean;
  /**
   * The reason behind `matchesProperty`, computed in code by the function:
   * the postcodes the document carries against the transaction's. Null when
   * unreadable; absent from older function builds.
   */
  propertyCheck?: DocPropertyCheck | null;
  /**
   * The consents scan's findings. Present only when a `DocScanContext` was
   * sent: the list (possibly empty) for a readable document, null when it
   * could not be read. Absent for every other upload.
   */
  findings?: DocFinding[] | null;
  /**
   * Suggested property facts for the five TA6 certificates (gas safety,
   * EICR, FENSA, EPC, building regs). Each waits for the seller to confirm it
   * (documentFacts.service). Empty or absent for everything else.
   */
  facts?: DocFact[];
}

/**
 * Mirrors DOC_TYPE_CONFIDENCE_AT in the function's classify.ts. Below it the
 * function withholds `inDate`, and this side withholds the type name for the
 * same reason: naming a type we are not sure of manufactures a fact.
 */
export const DOC_TYPE_CONFIDENCE_AT = 0.6;

/** Below this yes-probability the document probably is not about this property. */
export const MATCHES_PROPERTY_AT = 0.5;

const UNSURE_LINE = "We couldn't confirm what this document is. Your conveyancer will check it.";
const UNREADABLE_LINE = "We couldn't read the text in this file. Your conveyancer will check it.";

/** Plain-English names for the function's option keys, with their article. */
const DOC_TYPE_LABELS: Readonly<Record<string, string>> = {
  epc: 'an Energy Performance Certificate',
  title_register: 'a Land Registry title register',
  title_plan: 'a Land Registry title plan',
  local_search: 'a local authority search',
  drainage_water_search: 'a drainage and water search',
  environmental_search: 'an environmental search',
  survey: "a surveyor's report",
  gas_safety: 'a gas safety record',
  eicr: 'an electrical installation condition report',
  fensa: 'a FENSA or CERTASS certificate',
  planning_permission: 'a planning decision notice',
  building_regs_certificate: 'a building regulations certificate',
  lease: 'a lease',
  id_document: 'an identity document',
  bank_statement: 'a bank statement',
  ta6_form: 'a completed TA6 form',
  ta10_form: 'a completed TA10 form',
  ta7_form: 'a completed TA7 form',
};

function isClassification(value: unknown): value is DocClassification {
  const v = value as Partial<DocClassification> | null;
  return (
    !!v &&
    typeof v.docType === 'string' &&
    typeof v.confidence === 'number' &&
    typeof v.unreadable === 'boolean'
  );
}

/**
 * Ask the function what was just uploaded. Resolves null on any failure:
 * forbidden, not found, rate limited, unconfigured, or no network.
 */
export async function classifyDocument(
  transactionId: string,
  storagePath: string,
  context?: DocScanContext,
): Promise<DocClassification | null> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: context ? { transactionId, storagePath, context } : { transactionId, storagePath },
    });
    if (error) {
      logger.warn('Document classification unavailable:', error);
      return null;
    }
    return isClassification(data) ? data : null;
  } catch (err) {
    logger.warn('Document classification request failed:', err);
    return null;
  }
}

/** The kind with its article, e.g. "an Energy Performance Certificate"; `warranty_scheme` reads as "a warranty scheme" when the key has no wording of its own. */
export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? `a ${docType.replace(/_/g, ' ')}`;
}

/**
 * Why the document may not be for this property, in the seller's words, or
 * null when nothing says so. The postcode fact is preferred over the bare
 * probability: "it gives SG19 1AB, not this transaction's SG19 2LA" is
 * something the seller can act on; "it may not be" is not.
 */
export function propertyCaveat(result: DocClassification): string | null {
  if (result.matchesProperty === null || result.matchesProperty >= MATCHES_PROPERTY_AT) return null;
  const check = result.propertyCheck;
  if (check?.postcodeMatches === false && check.expectedPostcode) {
    const found = check.foundPostcodes.join(' and ');
    return `It gives postcode ${found}, not this transaction's ${check.expectedPostcode}.`;
  }
  if (check && check.foundPostcodes.length === 0) {
    return "It names no postcode, so we couldn't tie it to this property.";
  }
  return 'It may not be for this property.';
}

/** The one quiet line the slot shows under an attachment. */
export function describeClassification(result: DocClassification): string {
  if (result.unreadable) return UNREADABLE_LINE;
  if (result.docType === 'other' || result.confidence < DOC_TYPE_CONFIDENCE_AT) return UNSURE_LINE;

  const parts = [`Reads as ${docTypeLabel(result.docType)}.`];
  const caveat = propertyCaveat(result);
  if (caveat) parts.push(caveat);
  if (result.inDate === false) parts.push('It looks out of date.');
  return parts.join(' ');
}
