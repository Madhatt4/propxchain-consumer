// The Blockchain Ledger page used to stamp every document "Verified" and, when
// no hash was known, invent one from Date.now(). Nothing ever wrote
// `blockchainHash` onto the localStorage copies, so every hash it showed was
// fiction. This module is the single place that decides what the ledger may
// claim: a hash and a verification state come only from document_storage rows
// (icpService.getDocumentsByTransaction); a local-only copy is shown as not
// on chain, never with a hash.

/** A row as icpService.getDocumentsByTransaction maps it from document_storage. */
export interface OnChainDocumentRow {
  id: string;
  hash?: string | null;
  verified?: boolean | null;
  name?: string;
  type?: string;
  fileSize?: number;
  uploadedAt?: string;
  uploadedAtNs?: string;
  uploadedBy?: string;
}

/** A document the browser remembers in localStorage for this transaction. */
export interface LocalDocumentRecord {
  name?: string;
  type?: string;
  size?: number;
  uploadedAt?: string;
  blockchainHash?: string;
}

/**
 * - verified: on chain, and the file has been re-hashed and matched since.
 * - recorded: on chain, fingerprint stored, never re-checked against the file.
 * - not-on-chain: no fingerprint on chain for this document.
 * - unchecked: the chain lookup failed, so we cannot say either way.
 */
export type LedgerChainStatus = 'verified' | 'recorded' | 'not-on-chain' | 'unchecked';

export interface LedgerDocument {
  id: string;
  transactionId: string;
  documentName: string;
  documentType: string;
  uploadedBy: string | null;
  uploadedAt: string | null;
  blockchainHash: string | null;
  fileSize: number;
  chainStatus: LedgerChainStatus;
  propertyAddress: string;
}

export interface LedgerTransactionInput {
  transactionId: string;
  propertyAddress: string;
  /** Rows from document_storage, or null when the lookup threw. */
  onChain: OnChainDocumentRow[] | null;
  local: LocalDocumentRecord[];
}

export const CHAIN_STATUS_LABEL: Record<LedgerChainStatus, string> = {
  verified: 'Verified',
  recorded: 'On chain · unverified',
  'not-on-chain': 'Not recorded on chain',
  unchecked: "Couldn't check chain",
};

function realHash(hash: string | null | undefined): string | null {
  const trimmed = hash?.trim();
  return trimmed ? trimmed : null;
}

function fromChain(row: OnChainDocumentRow, tx: LedgerTransactionInput): LedgerDocument {
  const hash = realHash(row.hash);
  let chainStatus: LedgerChainStatus = 'not-on-chain';
  if (hash) chainStatus = row.verified === true ? 'verified' : 'recorded';
  return {
    id: `chain_${tx.transactionId}_${row.id}`,
    transactionId: tx.transactionId,
    documentName: row.name || row.type || 'Document',
    documentType: row.type || 'document',
    uploadedBy: row.uploadedBy || null,
    uploadedAt: row.uploadedAt || null,
    blockchainHash: hash,
    fileSize: row.fileSize ?? 0,
    chainStatus,
    propertyAddress: tx.propertyAddress,
  };
}

function fromLocal(
  doc: LocalDocumentRecord,
  index: number,
  tx: LedgerTransactionInput,
): LedgerDocument {
  return {
    id: `local_${tx.transactionId}_${index}`,
    transactionId: tx.transactionId,
    documentName: doc.name || doc.type || 'Document',
    documentType: doc.type || 'document',
    uploadedBy: null,
    uploadedAt: doc.uploadedAt || null,
    blockchainHash: null,
    fileSize: doc.size ?? 0,
    chainStatus: tx.onChain === null ? 'unchecked' : 'not-on-chain',
    propertyAddress: tx.propertyAddress,
  };
}

/** Ledger rows for one transaction: chain rows first, then local-only copies. */
export function buildLedgerDocuments(tx: LedgerTransactionInput): LedgerDocument[] {
  const chainDocs = (tx.onChain ?? []).map(row => fromChain(row, tx));
  const chainHashes = new Set(
    chainDocs.map(d => d.blockchainHash?.toLowerCase()).filter((h): h is string => !!h),
  );
  // A local copy whose hash is already in the chain listing is the same
  // document; listing it twice would double-count it.
  const localOnly = tx.local
    .map((doc, index) => ({ doc, index }))
    .filter(({ doc }) => {
      const hash = realHash(doc.blockchainHash)?.toLowerCase();
      return !hash || !chainHashes.has(hash);
    })
    .map(({ doc, index }) => fromLocal(doc, index, tx));
  return [...chainDocs, ...localOnly];
}
