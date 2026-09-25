// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The kinds of document a seller can add to the sales pack, and how a stored
 * documentType maps back to one. Shared by the Sales pack tab (the picker) and
 * the pack share link (labels in the snapshot). It lives here rather than in
 * the tab so a service never imports from a component, and so the component
 * file exports only components, which React fast refresh needs.
 */

/** documentType under which extra pack documents are stored. */
export const SALES_PACK_EXTRA_DOC_TYPE = 'sales_pack_extra';

/**
 * What a seller can put in the pack, one documentType per kind so the share
 * link and conveyancer brief can label them. Identity documents are
 * deliberately absent: the picker offers them as a separate option
 * (ID_DOC_KIND) that routes to the Transaction Wallet instead, because the
 * pack's share link must never carry personal ID.
 */
export const PACK_DOC_KINDS = [
  { id: 'sales_pack_epc', label: 'EPC certificate' },
  { id: 'sales_pack_floor_plan', label: 'Floor plan' },
  { id: 'sales_pack_fensa', label: 'FENSA / window certificate' },
  { id: 'sales_pack_gas_safety', label: 'Gas safety certificate' },
  { id: 'sales_pack_eicr', label: 'Electrical (EICR) certificate' },
  { id: 'sales_pack_warranty', label: 'Warranty or guarantee' },
  { id: 'sales_pack_lease', label: 'Lease' },
  { id: 'sales_pack_title_plan', label: 'Title plan' },
  { id: SALES_PACK_EXTRA_DOC_TYPE, label: 'Other' },
] as const;

/** Chosen from the same picker, but never stored in the pack. */
export const ID_DOC_KIND = 'identity_document';

const PACK_DOC_TYPE_IDS: readonly string[] = PACK_DOC_KINDS.map((k) => k.id);

/** Stored documentType -> picker label, for the list under the button. */
export function packDocLabel(documentType: string): string {
  return PACK_DOC_KINDS.find((k) => k.id === documentType)?.label ?? 'Other';
}

/** True for any document that belongs to the pack's "other documents" area. */
export function isPackDocument(documentType: string): boolean {
  return PACK_DOC_TYPE_IDS.includes(documentType);
}
