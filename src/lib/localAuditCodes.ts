// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Besides the ledger trail (see auditCodes.ts), some canisters keep their own
 * audit log of `action` + `metadata`. Since ADR 0019 step 1c-ii the metadata
 * is a code and its fields, `code;key=value;key=value`, e.g.
 * `doc_registered;hash=<hex>;docType=epc`. This turns document_storage's
 * codes into the sentence shown in a deal's document activity.
 *
 * The codes are the closed list in the monorepo's
 * packages/core/src/document_storage/audit_codes.mo. Entries written before
 * the codes carry a sentence instead: anything that is not a known code reads
 * as `null`, and the caller shows the entry's action as it always did.
 */

export interface LocalAuditEntry {
  code: string;
  fields: Readonly<Record<string, string>>;
}

/** The code and fields of a code-form metadata text, or null for an older sentence. */
export function parseLocalAudit(metadata: unknown): LocalAuditEntry | null {
  if (typeof metadata !== 'string' || metadata.length === 0 || /\s/.test(metadata)) return null;
  const [code, ...pairs] = metadata.split(';');
  if (!/^[a-z0-9_]+$/.test(code)) return null;
  const fields: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq <= 0) return null;
    fields[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return { code, fields };
}

type Render = (fields: Readonly<Record<string, string>>) => string;

const fixed = (sentence: string): Render => () => sentence;

const DOC_TYPE_WORDS: Readonly<Record<string, string>> = { epc: 'EPC', ta6: 'TA6', ta7: 'TA7', ta10: 'TA10' };

function docTypeWords(docType: string | undefined): string {
  if (!docType || docType === 'other' || docType === 'invalid') return 'Document';
  return DOC_TYPE_WORDS[docType] ?? docType.replace(/[_-]+/g, ' ');
}

function capitalise(words: string): string {
  return words.length > 0 ? words[0].toUpperCase() + words.slice(1) : words;
}

/** One sentence per document_storage code. */
export const DOCUMENT_STORAGE_CODES: Readonly<Record<string, Render>> = {
  not_admin: fixed('Refused: admin only'),
  canister_id_updated: fixed('Canister wiring updated'),
  rate_limited: fixed('Refused: too many uploads in an hour'),
  unauthorised: fixed('Refused: no access to this document'),
  caller_not_allowed: fixed('Refused: caller not allowed'),
  csrf_invalid: fixed('Refused: the session check failed'),
  not_tx_member: fixed('Refused: not on this deal'),
  not_owner: fixed('Refused: not the document owner'),
  hash_format_invalid: fixed('Refused: the file fingerprint was not valid'),
  integrity_ok: fixed('Integrity check passed: the stored file matches its fingerprint'),
  integrity_mismatch: fixed('Integrity check failed: the stored file does not match its fingerprint'),
  hash_match: fixed('Fingerprint check passed'),
  hash_mismatch: fixed('Fingerprint check failed'),
  doc_registered: (f) => `${capitalise(docTypeWords(f.docType))} registered on-chain`,
  notify_failed: fixed('The deal could not be told about this document'),
  doc_not_found: fixed('Document not found'),
  doc_deleted: (f) => (f.storage === 'onchain' ? 'Document and its file deleted' : 'Document record deleted'),
  doc_marked_deleted: fixed('Document marked as deleted; its history is kept'),
  lr_doc_registered: (f) => `HM Land Registry ${docTypeWords(f.docType)} registered on-chain`,
  not_onchain: fixed('Refused: not stored on-chain'),
  chunk_index_invalid: fixed('Refused: file part out of range'),
  chunk_too_large: fixed('Refused: file part too large'),
  chunk_uploaded: (f) => (f.uploaded && f.total ? `File part uploaded (${f.uploaded} of ${f.total})` : 'File part uploaded'),
  chunk_downloaded: fixed('File part downloaded'),
  csrf_generated: fixed('Session check issued'),
  csrf_valid: fixed('Session check passed'),
  csrf_mismatch: fixed('Session check failed'),
  csrf_missing: fixed('Session check missing'),
};

/**
 * The sentence for a document_storage audit entry, or null when its metadata
 * is an older sentence or a code this build does not know.
 */
export function describeDocumentAudit(metadata: unknown): string | null {
  const entry = parseLocalAudit(metadata);
  if (!entry) return null;
  const render = DOCUMENT_STORAGE_CODES[entry.code];
  return render ? render(entry.fields) : null;
}
