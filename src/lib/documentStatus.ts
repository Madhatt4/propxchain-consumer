// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// A party's document list holds only what they can open, plus their own
// uploads. document_storage reports everything else as a filename-free status
// row, so a seller can still see that the buyer's funds have arrived. This
// module turns those rows into status lines and progress ticks.

import type { Document } from '@/types/transaction.types';

/** A fetchTransactionDocumentStatus row, with the Int timestamp as a decimal string. */
export interface DocumentStatusRow {
  category: string;
  verified: boolean;
  uploadedAtNs: string;
}

interface RawStatusRow {
  category: string;
  verified: boolean;
  uploadedAt: bigint;
}

interface CategoryDisplay {
  label: string;
  side: Document['category'];
  /** The checklist storageKey this category ticks. Absent: it ticks nothing. */
  docType?: string;
}

// Keys are access_matrix.mo's categoryLabel values. "other" is deliberately not
// tied to a checklist item: it is every docType the canister does not recognise.
// "hmlr" is not tied to landRegistryConfirmation either: the canister files that
// upload under "other", and "hmlr" is the register extract a title pull stores,
// so a tick from it would claim a confirmation nobody uploaded.
const CATEGORIES: Readonly<Record<string, CategoryDisplay>> = {
  funds: { label: 'Buyer funds', side: 'buyer', docType: 'proofOfFunds' },
  mortgage: { label: 'Mortgage offer', side: 'buyer', docType: 'mortgageAgreement' },
  title: { label: 'Title deeds', side: 'seller', docType: 'titleDeeds' },
  epc: { label: 'Energy certificate', side: 'seller', docType: 'energyPerformanceCertificate' },
  ta6: { label: 'TA6 property form', side: 'seller', docType: 'ta6PropertyInformationForm' },
  ta10: { label: 'TA10 fittings form', side: 'seller', docType: 'ta10FittingsContents' },
  survey: { label: 'Survey', side: 'shared', docType: 'surveyReport' },
  searches: { label: 'Property searches', side: 'shared', docType: 'property-searches' },
  hmlr: { label: 'Land Registry register', side: 'shared' },
  transfer: { label: 'Transfer documents', side: 'shared' },
  identity: { label: 'Identity document', side: 'shared' },
  address: { label: 'Proof of address', side: 'shared' },
  credential: { label: 'Professional credentials', side: 'shared' },
  aml: { label: 'AML check', side: 'shared' },
  other: { label: 'Additional document', side: 'shared' },
};

function displayFor(category: string): CategoryDisplay {
  return CATEGORIES[category] ?? CATEGORIES.other;
}

export function toDocumentStatusRows(rows: readonly RawStatusRow[]): DocumentStatusRow[] {
  return rows.map((row) => ({
    category: row.category,
    verified: row.verified,
    uploadedAtNs: String(row.uploadedAt),
  }));
}

/**
 * The status rows that are NOT already in the caller's document list. A status
 * row has no id, so rows pair with visible documents on the upload timestamp,
 * one for one: two uploads in the same round must not cancel each other.
 */
export function hiddenDocumentStatuses(
  status: readonly DocumentStatusRow[],
  visibleUploadedAtNs: ReadonlyArray<string | undefined>,
): DocumentStatusRow[] {
  const unmatched = new Map<string, number>();
  for (const ns of visibleUploadedAtNs) {
    if (ns !== undefined) unmatched.set(ns, (unmatched.get(ns) ?? 0) + 1);
  }
  return status.filter((row) => {
    const remaining = unmatched.get(row.uploadedAtNs) ?? 0;
    if (remaining === 0) return true;
    unmatched.set(row.uploadedAtNs, remaining - 1);
    return false;
  });
}

/**
 * One line per category, such as "Buyer funds: received". `verified` is the
 * canister's file-integrity flag, so it is not shown: "Buyer funds: verified"
 * would read as a claim about the money.
 */
export function documentStatusLines(rows: readonly DocumentStatusRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const { label } = displayFor(row.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) =>
    count > 1 ? `${label}: ${count} received` : `${label}: received`,
  );
}

/**
 * Status rows as documents, for progress maths only: never list these. A blank
 * uploadedBy keeps them out of the checks that need a known uploader.
 */
export function statusProgressDocuments(
  rows: readonly DocumentStatusRow[],
  transactionId: string,
): Document[] {
  return rows.map((row, index) => {
    const display = displayFor(row.category);
    return {
      id: `status_${index}`,
      transactionId,
      type: display.docType ?? row.category,
      category: display.side,
      name: display.label,
      fileName: '',
      fileSize: 0,
      mimeType: '',
      uploadedBy: '',
      uploadedAt: new Date(Number(BigInt(row.uploadedAtNs) / 1_000_000n)).toISOString(),
      status: row.verified ? 'verified' : 'uploaded',
      required: true,
      hash: '',
    };
  });
}
