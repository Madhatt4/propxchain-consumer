// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * documentFindings.service — what the consents scan has already concluded
 * about the seller's TA6 attachments, read back from the `document_findings`
 * rows doc-classify writes (one per scan; the newest per document is the
 * current answer). "Check my answers" shows this list so the seller sees
 * every attachment's reading in one place without the files being touched
 * again.
 *
 * Advisory, like everything the scan says. The labels here are the same
 * words the slot shows and the conveyancer brief carries; a key this table
 * has no words for is dropped rather than shown as code. RLS admits the
 * transaction's parties, so a failed read means "nothing to show", never an
 * error the seller should see.
 */
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
  TA6_ALTERATION_DOCUMENT_KIND_LABELS,
  TA6_ALTERATION_KIND_LABELS,
} from '../types/ta6.alterationDocument';
import type { TA6AlterationDocumentKind, TA6AlterationKind } from '../types/ta6.alterationDocument';
import type { DocFindingKey, TA6WarrantyType } from './docClassify.service';
import { WARRANTY_TYPE_LABELS } from './docClassify.service';

/** The one label table, mirrored from the function's _shared/document-findings.ts. */
export const FINDING_LABELS: Readonly<Record<DocFindingKey, string>> = {
  unrelated_to_change: "Doesn't appear to cover the change it is attached to",
  not_a_grant: 'Reads as a refusal, a withdrawal or an application still pending, not a grant',
  conditions_outstanding: 'Carries conditions that may still need to be discharged',
  approval_not_completion: 'Reads as an approval of plans, not a completion certificate',
  planning_lapsed: 'Permission looks lapsed: over three years since the decision with no sign the works began',
  not_about_property: "Doesn't appear to be about this property",
  wrong_warranty_type: "Doesn't appear to cover this type of work",
  installer_promise_only: "The installer's own promise, with no insurance behind it",
  not_transferable: 'No sign the guarantee passes to a new owner',
  warranty_expired: 'The guarantee term appears to have ended',
  wrong_paperwork: 'Reads as a different kind of document, not what this slot is for',
  mostly_blank: 'Most of the answers are blank',
  many_blanks: 'Many answers are blank',
  some_blanks: 'A few answers are blank',
  yes_without_detail: 'A Yes answer has no detail where the form asks for it',
  answers_contradict: 'Some answers contradict each other',
  alterations_without_paperwork: 'Changes to the property are listed with no paperwork for them',
  dispute_undisclosed: 'Something reads like a dispute or notice that is not disclosed',
  services_gap: "The services or drainage answers would draw a conveyancer's query",
  environment_detail_missing: 'Flooding, radon or knotweed is answered without the detail asked for',
  item_included_and_excluded: 'An item is marked both included and excluded',
  rooms_not_covered: 'Some main rooms have no items listed',
  lease_terms_missing: 'Ground rent, service charge, lease term or landlord details are missing',
  charges_unanswered: 'Arrears, upcoming costs or the reserve fund are not answered',
};

const FORM_TITLES: Readonly<Record<string, string>> = {
  ta6: 'Uploaded TA6 Property Information Form',
  ta10: 'Uploaded TA10 Fittings and Contents Form',
  ta7: 'Uploaded TA7 Leasehold Information Form',
};

export interface DocumentFindingsRow {
  storage_path: string;
  section: string;
  context: Record<string, unknown> | null;
  findings: Array<{ key: string; probability: number }> | null;
  created_at: string;
}

/** One attachment with something to say, in the seller's words. */
export interface PaperworkSummary {
  section: string;
  /** "Planning permission for the extension", "Roofing guarantee", or the slot alone. */
  title: string;
  findings: string[];
}

const COLUMNS = 'storage_path, section, context, findings, created_at';

function alterationTitle(context: Record<string, unknown>): string {
  const kind = context.kind as TA6AlterationDocumentKind | null | undefined;
  const relatesTo = context.relatesTo as TA6AlterationKind | null | undefined;
  const kindLabel = kind && kind in TA6_ALTERATION_DOCUMENT_KIND_LABELS ? TA6_ALTERATION_DOCUMENT_KIND_LABELS[kind] : null;
  const changeLabel = relatesTo && relatesTo in TA6_ALTERATION_KIND_LABELS ? TA6_ALTERATION_KIND_LABELS[relatesTo] : null;
  if (kindLabel && changeLabel) return `${kindLabel} for the ${changeLabel.toLowerCase()}`;
  return kindLabel ?? 'Alteration paperwork';
}

function warrantyTitle(context: Record<string, unknown>): string {
  const type = context.warrantyType as TA6WarrantyType | undefined;
  const label = type && type in WARRANTY_TYPE_LABELS ? WARRANTY_TYPE_LABELS[type] : null;
  return label ? `${label} guarantee` : 'Guarantee or warranty';
}

function titleFor(row: DocumentFindingsRow): string {
  const context = row.context ?? {};
  if (row.section in FORM_TITLES) return FORM_TITLES[row.section];
  return row.section === '6.1' ? warrantyTitle(context) : alterationTitle(context);
}

/**
 * Rows arrive newest first; the first seen for each document is the current
 * answer. Documents with nothing to say are left out, so an empty result
 * means "nothing to raise", and the caller renders nothing.
 */
export function summarisePaperwork(rows: readonly DocumentFindingsRow[]): PaperworkSummary[] {
  const seen = new Set<string>();
  const out: PaperworkSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.storage_path)) continue;
    seen.add(row.storage_path);
    const labels = (row.findings ?? [])
      .map((f) => (FINDING_LABELS as Record<string, string | undefined>)[f.key])
      .filter((l): l is string => typeof l === 'string');
    if (labels.length === 0) continue;
    out.push({ section: row.section, title: titleFor(row), findings: labels });
  }
  return out;
}

/** Every attachment on the transaction with findings, newest reading per document. Empty on any failure. */
export async function loadPaperworkFindings(transactionId: string): Promise<PaperworkSummary[]> {
  try {
    const { data, error } = await supabase
      .from('document_findings')
      .select(COLUMNS)
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });
    if (error) {
      logger.warn('Paperwork findings unavailable:', error.message);
      return [];
    }
    return summarisePaperwork((data ?? []) as DocumentFindingsRow[]);
  } catch (err) {
    logger.warn('Paperwork findings request failed:', err);
    return [];
  }
}
