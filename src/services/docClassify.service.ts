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

const FUNCTION_NAME = 'doc-classify';

/** The `doc-classify` 200 body. `docType` is one of the function's option keys, `other` when unsure. */
export interface DocClassification {
  docType: string;
  /** 0..1, the probability mass behind `docType`. */
  confidence: number;
  /** Null when no validity window applies, no date was found, or the type is not confident. */
  inDate: boolean | null;
  /** 0..1 yes-probability that the document is about this property; null when unreadable. */
  matchesProperty: number | null;
  /** True for an image or image-only PDF: no text, so nothing was asked. */
  unreadable: boolean;
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
): Promise<DocClassification | null> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { transactionId, storagePath },
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

/** `warranty_scheme` reads as "a warranty scheme" when the key has no wording of its own. */
function label(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? `a ${docType.replace(/_/g, ' ')}`;
}

/** The one quiet line the slot shows under an attachment. */
export function describeClassification(result: DocClassification): string {
  if (result.unreadable) return UNREADABLE_LINE;
  if (result.docType === 'other' || result.confidence < DOC_TYPE_CONFIDENCE_AT) return UNSURE_LINE;

  const parts = [`Reads as ${label(result.docType)}.`];
  if (result.matchesProperty !== null && result.matchesProperty < MATCHES_PROPERTY_AT) {
    parts.push('It may not be for this property.');
  }
  if (result.inDate === false) parts.push('It looks out of date.');
  return parts.join(' ');
}
