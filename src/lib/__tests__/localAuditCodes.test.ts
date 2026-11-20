// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { auditLogHash } from '../auditCodes';
import { DOCUMENT_STORAGE_CODES, describeDocumentAudit, parseLocalAudit } from '../localAuditCodes';

const HASH = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);

// One example of every document_storage code, exactly as the canister writes
// it (packages/core/src/document_storage/audit_codes.test.mo), and its
// sentence. A code with no row here fails the coverage test.
const CASES: Array<[string, string]> = [
  ['not_admin', 'Refused: admin only'],
  ['canister_id_updated', 'Canister wiring updated'],
  ['rate_limited', 'Refused: too many uploads in an hour'],
  ['unauthorised', 'Refused: no access to this document'],
  ['caller_not_allowed', 'Refused: caller not allowed'],
  ['csrf_invalid', 'Refused: the session check failed'],
  ['not_tx_member;tx=tx_1791543160237401939', 'Refused: not on this deal'],
  ['not_owner', 'Refused: not the document owner'],
  ['hash_format_invalid', 'Refused: the file fingerprint was not valid'],
  ['integrity_ok', 'Integrity check passed: the stored file matches its fingerprint'],
  [`integrity_mismatch;computed=${HASH};registered=${OTHER}`,
    'Integrity check failed: the stored file does not match its fingerprint'],
  ['hash_match', 'Fingerprint check passed'],
  [`hash_mismatch;stored=${HASH};provided=invalid`, 'Fingerprint check failed'],
  [`doc_registered;hash=${HASH};docType=completion_statement`, 'Completion statement registered on-chain'],
  [`doc_registered;hash=${HASH};docType=epc`, 'EPC registered on-chain'],
  [`doc_registered;hash=${HASH};docType=other`, 'Document registered on-chain'],
  ['notify_failed;tx=tx_5', 'The deal could not be told about this document'],
  ['doc_not_found', 'Document not found'],
  ['doc_deleted;storage=onchain', 'Document and its file deleted'],
  ['doc_deleted;storage=offchain', 'Document record deleted'],
  ['doc_marked_deleted', 'Document marked as deleted; its history is kept'],
  [`lr_doc_registered;hash=${HASH};docType=OS1;ref=HMLR-REF-123;title=GR506405;costPence=700`,
    'HM Land Registry OS1 registered on-chain'],
  ['not_onchain', 'Refused: not stored on-chain'],
  ['chunk_index_invalid;chunk=9', 'Refused: file part out of range'],
  ['chunk_too_large', 'Refused: file part too large'],
  ['chunk_uploaded;chunk=2;uploaded=3;total=5', 'File part uploaded (3 of 5)'],
  ['chunk_downloaded;chunk=4', 'File part downloaded'],
  ['csrf_generated', 'Session check issued'],
  ['csrf_valid', 'Session check passed'],
  ['csrf_mismatch', 'Session check failed'],
  ['csrf_missing', 'Session check missing'],
];

describe('describeDocumentAudit', () => {
  it.each(CASES)('should read %s as a sentence', (metadata, sentence) => {
    expect(describeDocumentAudit(metadata)).toBe(sentence);
  });

  it('should have an example for every code', () => {
    const covered = new Set(CASES.map(([m]) => m.split(';')[0]));
    expect(Object.keys(DOCUMENT_STORAGE_CODES).filter((c) => !covered.has(c))).toEqual([]);
  });

  it.each([
    ['the older register sentence', `Hash: ${HASH}, Type: epc`],
    ['an older failure sentence', 'Invalid or missing CSRF token'],
    ['an older chunk sentence', 'Chunk 2 uploaded. Progress: 3/5'],
    ['a code this build does not know', 'new_code;x=1'],
    ['an empty text', ''],
    ['not a string', undefined],
  ])('should return null for %s', (_label, metadata) => {
    expect(describeDocumentAudit(metadata)).toBeNull();
  });
});

describe('parseLocalAudit', () => {
  it('should split the code from its fields', () => {
    expect(parseLocalAudit(`doc_registered;hash=${HASH};docType=epc`)).toEqual({
      code: 'doc_registered',
      fields: { hash: HASH, docType: 'epc' },
    });
    expect(parseLocalAudit('csrf_invalid')).toEqual({ code: 'csrf_invalid', fields: {} });
  });

  it('should keep a `|` list as one value', () => {
    expect(parseLocalAudit('grant_recorded;scopes=a:b|c:d')?.fields.scopes).toBe('a:b|c:d');
  });

  it.each([
    ['a sentence', 'User registered'],
    ['a field with no key', 'doc_registered;=x'],
    ['a field with no value marker', 'doc_registered;hash'],
    ['an upper-case code', 'REGISTER'],
  ])('should return null for %s', (_label, metadata) => {
    expect(parseLocalAudit(metadata)).toBeNull();
  });
});

describe('document_storage file hash', () => {
  it('should be found in both the code form and the older sentence', () => {
    expect(auditLogHash(`doc_registered;hash=${HASH};docType=epc`)).toBe(HASH);
    expect(auditLogHash(`lr_doc_registered;hash=${HASH};docType=OS1;ref=R1;title=GR1;costPence=700`)).toBe(HASH);
    expect(auditLogHash(`Hash: ${HASH}, Type: epc`)).toBe(HASH);
  });

  it('should not take a compared hash for the file hash', () => {
    expect(auditLogHash(`integrity_mismatch;computed=${HASH};registered=${OTHER}`)).toBeNull();
    expect(auditLogHash(`hash_mismatch;stored=${HASH};provided=${OTHER}`)).toBeNull();
  });
});
