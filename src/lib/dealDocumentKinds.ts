// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which deal documents are PROPERTY documents, open to every party on the deal
 * (Marc, 2026-11-09), and which group each one is listed under.
 *
 * The canister decides who may see a document (document_storage
 * access_matrix.mo, monorepo #419). This mirrors its classifyDocType so the
 * "Documents on this deal" view can group rows, and so a personal document
 * never reaches the list even if a server list ever returns one: defence in
 * depth. It is stricter than the canister in one place: a completion
 * statement carries the buyer's money figures, so it is kept out here.
 *
 * Order matters, as in the canister: every personal word is tested BEFORE any
 * property word, so "mortgage_valuation_survey" or "bank_transfer" stays
 * personal. Anything unrecognised is personal (fails closed).
 */

export type DealDocGroup = 'forms' | 'searches' | 'survey' | 'sales-pack' | 'title' | 'transfer';

/** Display order of the groups, with their headings. */
export const DEAL_DOC_GROUPS: ReadonlyArray<{ id: DealDocGroup; label: string }> = [
  { id: 'forms', label: 'Forms (TA6, TA7, TA10)' },
  { id: 'searches', label: 'Searches' },
  { id: 'survey', label: 'Survey' },
  { id: 'sales-pack', label: 'Sales pack' },
  { id: 'title', label: 'Title and HMLR register' },
  { id: 'transfer', label: 'Transfer (TR1, AP1)' },
];

// Personal words, checked first. "wallet" and "slot" cover wallet documents
// sent to the deal, which are shared only through wallet share grants.
const PERSONAL_WORDS = [
  'aml', 'indemnity', 'insurance', 'licen', 'mortgage', 'fund', 'bank',
  'savings_statement', 'investment_statement', 'gift_letter', 'payslip',
  'identity', 'passport', 'proofofid', 'address', 'wallet', 'slot',
  'completion',
];

// Exact docTypes and prefixes the canister's isPropertyDocType accepts.
const PROPERTY_EXACT = new Set([
  'ta7', 'floorplan', 'floor_plan', 'floor-plan', 'fensa', 'eicr', 'electrical-work',
  'gas_safety', 'building_regs', 'building_regs_certificate', 'building-regs-approval',
  'building-regs-completion', 'planning_permission', 'warranty_scheme', 'lease', 'lease_document',
]);
const FORM_PREFIXES = ['ta7_', 'ta7-', 'ta7leasehold'];

function namedGroup(d: string): DealDocGroup | null {
  if (d.includes('survey')) return 'survey';
  if (d.includes('ta10') || d.includes('fitting') || d.includes('ta6')) return 'forms';
  if (d.includes('epc') || d.includes('energyperformance') || d.includes('energy_performance')) {
    return 'sales-pack';
  }
  if (d.includes('search')) return 'searches';
  if (['hmlr', 'register-extract', 'official_copy', 'officialcopy', 'title'].some((w) => d.includes(w))) {
    return 'title';
  }
  if (d.includes('tr1') || d.includes('ap1') || d.includes('transfer')) return 'transfer';
  return null;
}

function otherPropertyGroup(d: string): DealDocGroup | null {
  if (d.includes('statement')) return null;
  if (d === 'ta7' || FORM_PREFIXES.some((p) => d.startsWith(p))) return 'forms';
  if (d.startsWith('sales_pack_') || PROPERTY_EXACT.has(d)) return 'sales-pack';
  return null;
}

/**
 * The group a docType is listed under, or null when it is personal or
 * unknown and must never be shown to another party.
 */
export function dealDocGroup(docType: string): DealDocGroup | null {
  const d = docType.toLowerCase();
  if (!d || PERSONAL_WORDS.some((w) => d.includes(w))) return null;
  // The seller picked these in the sales pack, so they are listed there even
  // when the name says title (sales_pack_title_plan).
  if (d.startsWith('sales_pack_')) return 'sales-pack';
  return namedGroup(d) ?? otherPropertyGroup(d);
}

const TYPE_LABELS: Readonly<Record<string, string>> = {
  ta6_attachment: 'TA6 attachment',
  ta6_pdf_record: 'TA6 property information form',
  ta6_canonical_upload: 'TA6 property information form',
  ta6PropertyInformationForm: 'TA6 property information form',
  ta10FittingsContents: 'TA10 fittings and contents form',
  surveyReport: 'Survey report',
  'survey-report': 'Survey report',
  'property-searches': 'Property searches',
  'local-search': 'Local authority search',
  'environmental-search': 'Environmental search',
  titleDeeds: 'Title deeds',
  'hmlr-register-extract': 'HMLR title register',
  energyPerformanceCertificate: 'EPC certificate',
};

/** A plain label for a docType, safe to show: built from the type, never a filename. */
export function dealDocTypeLabel(docType: string): string {
  const known = TYPE_LABELS[docType];
  if (known) return known;
  const words = docType.replace(/^sales_pack_/, '').replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Document';
}
